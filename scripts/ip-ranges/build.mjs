// Régénère src/lib/ip-ranges-data.ts : plages iCloud Private Relay et plages hébergeurs / VPN.
// Commande : node scripts/ip-ranges/build.mjs (Node 18+, sans dépendance, réseau requis).
//
// Sources et licences :
// - iCloud Private Relay : liste officielle Apple, https://mask-api.icloud.com/egress-ip-ranges.csv
//   (publiée par Apple pour que les sites reconnaissent ses sorties, sans licence restrictive).
// - Hébergeurs, centres de données et VPN : X4BNet lists_vpn, https://github.com/X4BNet/lists_vpn
//   fichiers output/datacenter/ipv4.txt et output/datacenter/ipv6.txt, licence MIT
//   (Copyright (c) 2024 X4B (Mathew Heard)), qui couvre aussi la liste générée.
// - Opérateurs français (à retirer des hébergeurs) et quelques hébergeurs absents de X4BNet
//   (ajoutés par ASN) : IPtoASN, https://iptoasn.com, fichiers ip2asn-v4-u32.tsv.gz et
//   ip2asn-v6.tsv.gz, domaine public (PDDL v1.0).
//
// Traitement : fusion des plages contiguës, puis hébergeurs moins Private Relay, moins opérateurs
// français, moins plages privées et réservées. Private Relay moins plages privées.
// IPv6 : seuls les 64 premiers bits comptent (clé /64). Une plage hébergeur plus fine qu'un /64
// couvre donc tout son /64 : sans effet en pratique, un /64 est attribué à un seul client.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const OUT = new URL("../../src/lib/ip-ranges-data.ts", import.meta.url);
const APPLE = "https://mask-api.icloud.com/egress-ip-ranges.csv";
const X4B = "https://raw.githubusercontent.com/X4BNet/lists_vpn/main/output/datacenter/";
const ASN = "https://iptoasn.com/data/";

// Box, fibre et mobile grand public en France (et leurs branches pro, où votent les commerçants).
const FR_OPERATORS = new Map([
  [3215, "Orange"],
  [15557, "SFR"],
  [21502, "SFR (ex-Numericable)"],
  [5410, "Bouygues Telecom"],
  [12844, "Bouygues Telecom Entreprises"],
  [12322, "Free"],
  [51207, "Free Mobile"],
  [199636, "Free Pro"],
  [24904, "K-Net"],
  [60032, "Coriolis"],
]);

// Hébergeurs vus chez des tricheurs et absents de X4BNet. Jamais de réseau grand public ici.
const EXTRA_HOSTING = new Map([
  [41075, "ATW Internet (centre de données, Hongrie)"],
  [20766, "Gitoyen (hébergement associatif, sorties VPN de FDN)"],
]);

const BOGONS_V4 = ["0.0.0.0/8", "10.0.0.0/8", "100.64.0.0/10", "127.0.0.0/8", "169.254.0.0/16", "172.16.0.0/12", "192.168.0.0/16", "224.0.0.0/3"];
const BOGONS_V6 = ["::/8", "fc00::/7", "fe80::/10", "ff00::/8"];

async function get(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} : HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

const v4 = (ip) => ip.split(".").reduce((n, p) => n * 256 + Number(p), 0);

/** 64 premiers bits d'une IPv6, en BigInt. */
function v6hi(ip) {
  const [head, tail = null] = ip.split("::");
  const a = head ? head.split(":") : [];
  const b = tail ? tail.split(":") : [];
  const groups = tail === null ? a : [...a, ...Array(8 - a.length - b.length).fill("0"), ...b];
  return BigInt("0x" + groups.slice(0, 4).map((g) => g.padStart(4, "0")).join(""));
}

function cidr(line) {
  const [ip, bits] = line.split("/");
  const len = Number(bits);
  if (ip.includes(":")) {
    const start = v6hi(ip);
    const size = len >= 64 ? 1n : 1n << BigInt(64 - len);
    return { v6: [start, start + size - 1n] };
  }
  const start = v4(ip);
  return { v4: [start, start + 2 ** (32 - len) - 1] };
}

function split(lines) {
  const out = { v4: [], v6: [] };
  for (const l of lines) {
    const r = cidr(l);
    if (r.v4) out.v4.push(r.v4);
    else out.v6.push(r.v6);
  }
  return out;
}

const one = (x) => (typeof x === "bigint" ? 1n : 1);

function merge(ranges) {
  const s = [...ranges].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const out = [];
  for (const [a, b] of s) {
    const last = out[out.length - 1];
    if (last && a <= last[1] + one(a)) {
      if (b > last[1]) last[1] = b;
    } else out.push([a, b]);
  }
  return out;
}

/** a moins b, toutes deux fusionnées et triées. */
function subtract(a, b) {
  const out = [];
  let j = 0;
  for (const [s0, e] of a) {
    let s = s0;
    while (j < b.length && b[j][1] < s) j++;
    let k = j;
    while (k < b.length && b[k][0] <= e && s <= e) {
      if (b[k][0] > s) out.push([s, b[k][0] - one(s)]);
      s = b[k][1] + one(s);
      k++;
    }
    if (s <= e) out.push([s, e]);
  }
  return out;
}

/** Écarts et longueurs : « écart-longueur » séparés par des virgules (base 36 en IPv4, hex en IPv6). */
function encode(ranges, base) {
  let prev = null;
  return ranges
    .map(([s, e]) => {
      const gap = prev === null ? s : s - prev - one(s);
      prev = e;
      return `${gap.toString(base)}-${(e - s).toString(base)}`;
    })
    .join(",");
}

const lines = (buf) => buf.toString("utf8").split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));

const [apple, dc4, dc6, asn4, asn6] = await Promise.all([
  get(APPLE),
  get(X4B + "ipv4.txt"),
  get(X4B + "ipv6.txt"),
  get(ASN + "ip2asn-v4-u32.tsv.gz"),
  get(ASN + "ip2asn-v6.tsv.gz"),
]);

const relay = split(lines(apple).map((l) => l.split(",")[0]));
const hosting = split([...lines(dc4), ...lines(dc6)]);
const fr = { v4: [], v6: [] };
for (const l of lines(gunzipSync(asn4))) {
  const [s, e, as] = l.split("\t");
  if (FR_OPERATORS.has(Number(as))) fr.v4.push([Number(s), Number(e)]);
  if (EXTRA_HOSTING.has(Number(as))) hosting.v4.push([Number(s), Number(e)]);
}
for (const l of lines(gunzipSync(asn6))) {
  const [s, e, as] = l.split("\t");
  if (FR_OPERATORS.has(Number(as))) fr.v6.push([v6hi(s), v6hi(e)]);
  if (EXTRA_HOSTING.has(Number(as))) hosting.v6.push([v6hi(s), v6hi(e)]);
}
const bogons = split([...BOGONS_V4, ...BOGONS_V6]);

const size = (ranges) => ranges.reduce((n, [s, e]) => n + BigInt(e - s) + 1n, 0n);
const result = {};
for (const fam of ["v4", "v6"]) {
  const bog = merge(bogons[fam]);
  const rel = subtract(merge(relay[fam]), bog);
  const raw = merge(hosting[fam]);
  const noRelay = subtract(raw, rel);
  const noFr = subtract(noRelay, merge(fr[fam]));
  const hos = subtract(noFr, bog);
  result[fam] = { relay: rel, hosting: hos };
  // Contrôle : ce que X4BNet classait à tort en hébergeur (adresses IPv4, /64 en IPv6).
  console.log(`${fam} : retirés des hébergeurs, Private Relay ${size(raw) - size(noRelay)}, opérateurs FR ${size(noRelay) - size(noFr)}`);
}

const date = new Date().toISOString().slice(0, 10);
const asList = (m) => [...m].map(([as, name]) => `AS${as} ${name}`).join(", ");
const src = `// Fichier généré par scripts/ip-ranges/build.mjs le ${date} : ne pas modifier à la main.
// Régénérer : node scripts/ip-ranges/build.mjs
//
// Sources :
// - iCloud Private Relay : Apple, ${APPLE}
// - Hébergeurs / VPN : X4BNet lists_vpn, https://github.com/X4BNet/lists_vpn (output/datacenter), licence MIT.
// - IPtoASN, https://iptoasn.com, domaine public (PDDL v1.0) :
//   opérateurs français retirés des hébergeurs : ${asList(FR_OPERATORS)} ;
//   hébergeurs ajoutés : ${asList(EXTRA_HOSTING)}.
//
// Licence de la liste X4BNet :
// MIT License
// Copyright (c) 2024 X4B (Mathew Heard)
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
// associated documentation files (the "Software"), to deal in the Software without restriction,
// including without limitation the rights to use, copy, modify, merge, publish, distribute,
// sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
// The above copyright notice and this permission notice shall be included in all copies or
// substantial portions of the Software.
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT
// NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES
// OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
// CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
//
// Format : plages triées et fusionnées, « écart-longueur » séparés par des virgules. L'écart part de
// la fin de la plage précédente (de 0 pour la première). IPv4 en base 36, IPv6 en hex sur les 64
// premiers bits.

export const IP_RANGES_DATE = "${date}";
export const RELAY_V4 = "${encode(result.v4.relay, 36)}";
export const RELAY_V6 = "${encode(result.v6.relay, 16)}";
export const HOSTING_V4 = "${encode(result.v4.hosting, 36)}";
export const HOSTING_V6 = "${encode(result.v6.hosting, 16)}";
`;
writeFileSync(OUT, src);
for (const fam of ["v4", "v6"]) console.log(`${fam} : relay ${result[fam].relay.length}, hosting ${result[fam].hosting.length}`);
console.log(`${fileURLToPath(OUT)} : ${(src.length / 1024).toFixed(0)} Ko`);
