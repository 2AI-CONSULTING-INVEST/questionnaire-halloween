import "server-only";
import { isIPv4, isIPv6 } from "node:net";
import { HOSTING_V4, HOSTING_V6, RELAY_V4, RELAY_V6 } from "./ip-ranges-data";

// Classement d'une IP pour l'anti-fraude : sortie Tor, iCloud Private Relay, hébergeur / VPN, ou normale.
// Les plages viennent de scripts/ip-ranges/build.mjs (hors ligne). La liste Tor est chargée à chaud.

export type IpClass = "normal" | "tor" | "hosting" | "relay" | "unknown";

type Parsed = { v4: string } | { v6: number[] };

/** IP analysée : IPv4 (y compris mappée en IPv6) ou les 8 groupes d'une IPv6. null si invalide. */
function parse(ip: string | null): Parsed | null {
  const s = ip?.trim() ?? "";
  if (isIPv4(s)) return { v4: s };
  if (!isIPv6(s) || s.includes("%")) return null;
  const tail = s.match(/:(\d+\.\d+\.\d+\.\d+)$/);
  let hex = s;
  if (tail) {
    const [a, b, c, d] = tail[1].split(".").map(Number);
    hex = s.slice(0, -tail[1].length) + ((a << 8) | b).toString(16) + ":" + ((c << 8) | d).toString(16);
  }
  const [head, rest] = hex.split("::");
  const a = head ? head.split(":") : [];
  const b = rest ? rest.split(":") : [];
  const groups = (rest === undefined ? a : [...a, ...Array(8 - a.length - b.length).fill("0"), ...b]).map((g) => parseInt(g, 16));
  if (groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff) {
    return { v4: [groups[6] >> 8, groups[6] & 255, groups[7] >> 8, groups[7] & 255].join(".") };
  }
  return { v6: groups };
}

/** Forme canonique RFC 5952 : minuscules, sans zéros de tête, plus longue suite de zéros en « :: ». */
function formatV6(groups: number[]): string {
  let best = -1;
  let len = 1;
  for (let i = 0; i < 8; i++) {
    let j = i;
    while (j < 8 && groups[j] === 0) j++;
    if (j - i > len) [best, len] = [i, j - i];
  }
  const hex = groups.map((g) => g.toString(16));
  if (best < 0) return hex.join(":");
  return hex.slice(0, best).join(":") + "::" + hex.slice(best + len).join(":");
}

const key = (p: Parsed) => ("v4" in p ? p.v4 : formatV6(p.v6));

export function ipNetwork(ip: string | null): string | null {
  const p = parse(ip);
  if (!p) return null;
  return "v4" in p ? p.v4 : `${formatV6([...p.v6.slice(0, 4), 0, 0, 0, 0])}/64`;
}

type Ranges<T> = { starts: T[]; ends: T[] };

/** Décode « écart-longueur,... » (voir l'en-tête de ip-ranges-data.ts). */
function decode<T extends number | bigint>(data: string, num: (s: string) => T, one: T): Ranges<T> {
  const starts: T[] = [];
  const ends: T[] = [];
  let prev: T | null = null;
  for (const pair of data ? data.split(",") : []) {
    const [gap, size] = pair.split("-").map(num);
    // Les deux types ne se mélangent jamais : T est soit number, soit bigint.
    const start = (prev === null ? gap : (prev as number) + (one as number) + (gap as number)) as T;
    const end = ((start as number) + (size as number)) as T;
    starts.push(start);
    ends.push(end);
    prev = end;
  }
  return { starts, ends };
}

/** Recherche dichotomique : la dernière plage qui commence avant x le contient-elle ? */
export function inRanges<T extends number | bigint>({ starts, ends }: Ranges<T>, x: T): boolean {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (starts[mid] <= x) lo = mid + 1;
    else hi = mid - 1;
  }
  return hi >= 0 && x <= ends[hi];
}

const b36 = (s: string) => parseInt(s, 36);
const big = (s: string) => BigInt("0x" + s);
let tables: { relay4: Ranges<number>; relay6: Ranges<bigint>; hosting4: Ranges<number>; hosting6: Ranges<bigint> } | null = null;
/** Décodage paresseux (quelques millisecondes, une fois par instance). */
function ranges() {
  tables ??= {
    relay4: decode(RELAY_V4, b36, 1),
    relay6: decode(RELAY_V6, big, BigInt(1)),
    hosting4: decode(HOSTING_V4, b36, 1),
    hosting6: decode(HOSTING_V6, big, BigInt(1)),
  };
  return tables;
}

export function classifyIp(ip: string | null, tor: ReadonlySet<string> | null): IpClass {
  const p = parse(ip);
  if (!p) return "unknown";
  if (tor?.has(key(p))) return "tor";
  const t = ranges();
  if ("v4" in p) {
    const n = p.v4.split(".").reduce((acc, x) => acc * 256 + Number(x), 0);
    if (inRanges(t.relay4, n)) return "relay";
    if (inRanges(t.hosting4, n)) return "hosting";
  } else {
    const hi = big(p.v6.slice(0, 4).map((g) => g.toString(16).padStart(4, "0")).join(""));
    if (inRanges(t.relay6, hi)) return "relay";
    if (inRanges(t.hosting6, hi)) return "hosting";
  }
  return "normal";
}

const TOR_URL = "https://check.torproject.org/torbulkexitlist";
const TOR_TTL = 3 * 3600_000;
const TOR_RETRY = 10 * 60_000;
const tor: { set: ReadonlySet<string> | null; at: number; tried: number; loading: Promise<void> | null } = { set: null, at: 0, tried: 0, loading: null };

/** Télécharge la liste Tor (800 ms maximum). En cas d'échec, l'ancienne liste reste. */
function loadTor(): Promise<void> {
  tor.tried = Date.now();
  tor.loading ??= fetch(TOR_URL, { signal: AbortSignal.timeout(800), cache: "no-store" })
    .then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const set = new Set<string>();
      for (const line of (await res.text()).split(/\r?\n/)) {
        const p = parse(line);
        if (p) set.add(key(p));
      }
      if (set.size === 0) throw new Error("liste vide");
      tor.set = set;
      tor.at = Date.now();
    })
    .catch((e) => console.warn("Liste Tor indisponible :", e instanceof Error ? e.message : e))
    .finally(() => {
      tor.loading = null;
    });
  return tor.loading;
}

/**
 * Liste Tor fixée par l'environnement (`TOR_EXIT_LIST`, adresses séparées par des virgules) : tests de bout
 * en bout sans réseau. Jamais lue en production Vercel.
 */
function torOverride(): ReadonlySet<string> | null {
  const raw = process.env.VERCEL_ENV === "production" ? undefined : process.env.TOR_EXIT_LIST;
  if (!raw) return null;
  const set = new Set<string>();
  for (const v of raw.split(",")) {
    const p = parse(v.trim());
    if (p) set.add(key(p));
  }
  return set;
}

export async function ipClass(ip: string | null): Promise<IpClass> {
  const fixed = torOverride();
  if (fixed) return classifyIp(ip, fixed);
  const now = Date.now();
  if (now - tor.at > TOR_TTL && now - tor.tried > TOR_RETRY) {
    const loading = loadTor();
    // Premier chargement : on attend au plus 150 ms, sinon on classe sans Tor.
    if (!tor.set) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([loading, new Promise((r) => (timer = setTimeout(r, 150)))]);
      clearTimeout(timer);
    }
  }
  return classifyIp(ip, tor.set);
}
