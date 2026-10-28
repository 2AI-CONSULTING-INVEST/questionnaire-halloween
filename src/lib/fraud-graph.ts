import { isAnonymousIp } from "./fraud-rules";
import type { HwEntropy, VoteStatus } from "./schema";

/**
 * Moteur de groupes : relie les tentatives d'une même journée, les regroupe (union-find) et décide
 * après coup quelles tentatives en trop exclure. Module pur : sans base, sans réseau, testé.
 *
 * Une clé faible seule (iPhone, iPad) ne crée jamais de lien : sinon tous les iPhone identiques de la
 * journée formeraient un seul groupe. Le lien « position » (clé faible, même ville, même décoration,
 * quelques minutes d'écart) est seulement suspect : il ne confirme jamais un groupe.
 * Le moteur ne promeut jamais un vote, il ne fait qu'en retirer : son passage automatique exclut et
 * groupe, rien d'autre. Lever une exclusion automatique devenue injustifiée, ou retirer un identifiant de
 * groupe, passe seulement par Recalculer (aperçu, puis Appliquer par un admin). Une décision humaine ne
 * bouge plus.
 * Le même cookie ne prouve jamais un groupe : ses refus de reconnaissance (le navigateur qui rouvre)
 * n'entrent pas dans le moteur, deux lignes du même cookie ne sont jamais reliées par le jeton, et les
 * conditions comptent des cookies distincts, pas des tentatives.
 */

export type GraphAttempt = {
  id: string;
  atMs: number;
  status: VoteStatus;
  voterId: string | null;
  hwKey: string | null;
  entropy: HwEntropy | null;
  storageKey: string | null;
  seenStorage: string[];
  ipNet: string | null;
  ipClass: string | null;
  city: string | null;
  decorationId: string | null;
  privateMode: boolean | null;
  participantId: string | null;
  phone: string | null;
  email: string | null;
  humanDecision: "validated" | "excluded" | null;
  /** Refus par reconnaissance du cookie (schema.ts, `isCookieRefusal`) : hors du moteur de groupes. */
  cookieRefusal?: boolean;
  /** Ouverture de la session (created_at), pour l'identifiant d'un groupe sans vote ; à défaut `atMs`. */
  createdMs?: number;
  /** Exclusion déjà posée par le moteur (pour ne réécrire que ce qui change). */
  autoExcluded: boolean;
  groupId: string | null;
};

export const LINK_KINDS = {
  cookie: { label: "Même cookie de vote", confirms: false, suspectOnly: false },
  storage: { label: "Jeton du stockage de l'appareil", confirms: true, suspectOnly: false },
  participant: { label: "Même participant au tirage (pseudo, téléphone ou email)", confirms: true, suspectOnly: false },
  strong: { label: "Même clé matérielle forte", confirms: false, suspectOnly: false },
  weak_network: { label: "Même clé faible et même réseau", confirms: false, suspectOnly: false },
  weak_anonymous: { label: "Même clé faible, deux IP Tor ou hébergeur", confirms: false, suspectOnly: false },
  weak_position: { label: "Même clé faible, même ville, même décoration, peu après", confirms: false, suspectOnly: true },
} as const;
export type LinkKind = keyof typeof LINK_KINDS;
export type Link = { a: string; b: string; kind: LinkKind };

export const GROUP_CONDITIONS = {
  C1: "Lien de stockage ou de participant",
  C2: "Cookies distincts reliés par une clé forte, au seuil réglé ou plus",
  C3: "Deux cookies ou plus depuis des IP Tor ou hébergeur",
  C4: "Navigation privée sur deux cookies ou plus, dans un groupe de trois cookies ou plus",
} as const;
export type GroupCondition = keyof typeof GROUP_CONDITIONS;

export type Group = {
  id: string;
  members: string[];
  links: Link[];
  status: "confirmed" | "suspect";
  conditions: GroupCondition[];
  /** Tentatives que le moteur exclut (vote en trop d'un groupe confirmé). */
  exclude: string[];
  /** Tentative gardée (la plus ancienne des votes du groupe confirmé). */
  kept: string | null;
};

export type GraphOptions = { c2MinAttempts: number; positionMinutes: number; withCookie?: boolean };

/**
 * Email canonique (preuve, ne change pas l'unicité des participants) : minuscules, partie après « + »
 * retirée, points retirés pour gmail.com et googlemail.com.
 */
export function canonicalEmail(email: string): string {
  const [local, domain] = email.trim().toLowerCase().split("@");
  if (!domain) return email.trim().toLowerCase();
  const base = local.split("+")[0];
  const gmail = domain === "gmail.com" || domain === "googlemail.com";
  return `${gmail ? base.replace(/\./g, "") : base}@${gmail ? "gmail.com" : domain}`;
}

class UnionFind {
  private parent = new Map<string, string>();
  find(x: string): string {
    let p = this.parent.get(x) ?? x;
    if (p !== x) {
      p = this.find(p);
      this.parent.set(x, p);
    }
    return p;
  }
  union(a: string, b: string) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra < rb ? rb : ra, ra < rb ? ra : rb); // racine = plus petit identifiant : stable
  }
}

/** Tous les liens entre tentatives d'une même journée. */
export function linkAttempts(attempts: GraphAttempt[], opts: GraphOptions): Link[] {
  const links: Link[] = [];
  const windowMs = opts.positionMinutes * 60_000;
  for (let i = 0; i < attempts.length; i++) {
    for (let j = i + 1; j < attempts.length; j++) {
      const x = attempts[i];
      const y = attempts[j];
      const add = (kind: LinkKind) => links.push({ a: x.id, b: y.id, kind });
      if (opts.withCookie && x.voterId && x.voterId === y.voterId) add("cookie");
      const sameCookie = !!x.voterId && x.voterId === y.voterId;
      // Le jeton dérive du cookie : deux lignes du même cookie le portent toujours, ce n'est pas un lien.
      if (!sameCookie && ((x.storageKey && y.seenStorage.includes(x.storageKey)) || (y.storageKey && x.seenStorage.includes(y.storageKey)))) add("storage");
      const samePerson =
        (x.participantId && x.participantId === y.participantId) ||
        (x.phone && x.phone === y.phone) ||
        (x.email && y.email && (x.email === y.email || canonicalEmail(x.email) === canonicalEmail(y.email)));
      if (samePerson) add("participant");
      if (x.hwKey && x.hwKey === y.hwKey && x.entropy === y.entropy) {
        if (x.entropy === "strong") add("strong");
        else if (x.entropy === "weak") {
          if (x.ipNet && x.ipNet === y.ipNet) add("weak_network");
          if (isAnonymousIp(x.ipClass) && isAnonymousIp(y.ipClass)) add("weak_anonymous");
          if (x.city && x.city === y.city && x.decorationId && x.decorationId === y.decorationId && Math.abs(x.atMs - y.atMs) < windowMs) add("weak_position");
        }
      }
    }
  }
  return links;
}

/** Composantes d'un ensemble de liens (identifiants triés, composantes de 2 tentatives ou plus). */
function components(ids: string[], links: Link[]): string[][] {
  const uf = new UnionFind();
  for (const l of links) uf.union(l.a, l.b);
  const by = new Map<string, string[]>();
  for (const id of ids) {
    const r = uf.find(id);
    (by.get(r) ?? by.set(r, []).get(r)!).push(id);
  }
  return [...by.values()].filter((c) => c.length >= 2);
}

/** Nombre de cookies distincts (une tentative sans cookie compte pour elle-même). */
const cookies = (list: GraphAttempt[]) => new Set(list.map((m) => m.voterId ?? m.id)).size;

function conditionsOf(ids: string[], links: Link[], byId: Map<string, GraphAttempt>, opts: GraphOptions): GroupCondition[] {
  const set = new Set(ids);
  const inner = links.filter((l) => set.has(l.a) && set.has(l.b));
  const members = ids.map((id) => byId.get(id)!);
  const out: GroupCondition[] = [];
  if (inner.some((l) => LINK_KINDS[l.kind].confirms)) out.push("C1");
  const byStrong = new Map<string, GraphAttempt[]>();
  for (const m of members) if (m.entropy === "strong" && m.hwKey) (byStrong.get(m.hwKey) ?? byStrong.set(m.hwKey, []).get(m.hwKey)!).push(m);
  if ([...byStrong.values()].some((list) => cookies(list) >= opts.c2MinAttempts)) out.push("C2");
  if (cookies(members.filter((m) => isAnonymousIp(m.ipClass))) >= 2) out.push("C3");
  if (cookies(members.filter((m) => m.privateMode === true)) >= 2 && cookies(members) >= 3) out.push("C4");
  return out;
}

/**
 * Groupes d'une journée et décisions du moteur. Les conditions C1 à C4 sont évaluées sur les liens qui
 * peuvent confirmer (tous sauf « position ») ; le groupe affiché réunit en plus les liens suspects.
 */
/**
 * Ancre stable de l'identifiant de groupe : le vote validé le plus ancien (completed_at), sinon la
 * tentative ouverte la plus ancienne (created_at), égalité départagée par l'id. Un membre arrivé ensuite
 * est plus récent : l'identifiant ne change pas (sauf fusion de deux groupes, ou premier vote d'un groupe
 * qui n'avait que des refus).
 */
function anchorOf(members: string[], byId: Map<string, GraphAttempt>): string {
  const list = members.map((id) => byId.get(id)!);
  const votes = list.filter((m) => m.status !== "blocked" && m.status !== "incomplete");
  const pool = votes.length ? votes : list;
  const at = (m: GraphAttempt) => (votes.length ? m.atMs : (m.createdMs ?? m.atMs));
  return pool.reduce((best, m) => (at(m) < at(best) || (at(m) === at(best) && m.id < best.id) ? m : best)).id;
}

export function buildGroups(day: string, all: GraphAttempt[], opts: GraphOptions): Group[] {
  const attempts = all.filter((a) => !a.cookieRefusal);
  const byId = new Map(attempts.map((a) => [a.id, a]));
  const ids = attempts.map((a) => a.id);
  const links = linkAttempts(attempts, opts);
  const firm = links.filter((l) => !LINK_KINDS[l.kind].suspectOnly);

  const confirmedCore = new Map<string, { members: string[]; conditions: GroupCondition[] }>();
  for (const c of components(ids, firm)) {
    const conditions = conditionsOf(c, firm, byId, opts);
    if (!conditions.length) continue;
    const core = { members: c, conditions }; // un seul objet par composante : il sert ensuite à dédoublonner
    for (const id of c) confirmedCore.set(id, core);
  }

  return components(ids, links).map((members) => {
    const set = new Set(members);
    const cores = [...new Set(members.map((id) => confirmedCore.get(id)).filter((x) => x !== undefined))];
    const exclude: string[] = [];
    let kept: string | null = null;
    for (const core of cores) {
      // La plus ancienne des tentatives validées garde son statut ; les autres votes validés sont exclus.
      const votes = core.members.map((id) => byId.get(id)!).filter((a) => a.status !== "blocked" && a.status !== "incomplete");
      votes.sort((x, y) => x.atMs - y.atMs || x.id.localeCompare(y.id));
      if (!votes.length) continue;
      kept ??= votes[0].id;
      for (const v of votes.slice(1)) if (!v.humanDecision) exclude.push(v.id);
    }
    return {
      id: `${day}:${anchorOf(members, byId).slice(0, 8)}`,
      members: [...members].sort((x, y) => byId.get(x)!.atMs - byId.get(y)!.atMs),
      links: links.filter((l) => set.has(l.a) && set.has(l.b)),
      status: cores.length ? "confirmed" : "suspect",
      conditions: [...new Set(cores.flatMap((c) => c.conditions))],
      exclude,
      kept,
    };
  });
}

/** `restore` : exclusion automatique levée (la ligne n'est plus un vote en trop d'un groupe confirmé). */
export type GraphChange = { id: string; exclude: boolean; restore: boolean; groupId: string | null };

/**
 * Écritures à faire pour appliquer les groupes : exclusion automatique des votes en trop, identifiant de
 * groupe sur les membres des groupes confirmés, et les retraits devenus justes (identifiant retiré d'une
 * ligne hors de tout groupe confirmé, exclusion automatique levée). Jamais sur une décision humaine.
 * Seules les lignes qui changent sont rendues. Les retraits ne s'appliquent que par Recalculer
 * (`withoutWithdrawals` pour le passage automatique).
 */
export function graphChanges(attempts: GraphAttempt[], groups: Group[]): GraphChange[] {
  const target = new Map<string, { exclude: boolean; groupId: string }>();
  for (const g of groups) {
    if (g.status !== "confirmed") continue;
    for (const id of g.members) target.set(id, { exclude: g.exclude.includes(id), groupId: g.id });
  }
  const out: GraphChange[] = [];
  for (const a of attempts) {
    if (a.humanDecision) continue;
    const t = target.get(a.id) ?? { exclude: false, groupId: null };
    const exclude = t.exclude && a.status !== "excluded";
    const restore = !t.exclude && a.autoExcluded && a.status === "excluded";
    if (exclude || restore || a.groupId !== t.groupId) out.push({ id: a.id, exclude, restore, groupId: t.groupId });
  }
  return out;
}

/** Retrait : exclusion automatique levée, ou identifiant de groupe retiré. */
export const isWithdrawal = (c: GraphChange) => c.restore || c.groupId === null;

/** Passage automatique (après un vote, une inscription) : exclure et grouper seulement, jamais un retrait. */
export const withoutWithdrawals = (changes: GraphChange[]) => changes.filter((c) => !isWithdrawal(c));

/**
 * Recalculer ne lève rien pour un jour plus ancien que la conservation des valeurs déduites de l'IP : la
 * purge efface réseau et classe de l'IP, des liens disparaîtraient et de faux votes redeviendraient comptés.
 */
export function withdrawalsAllowed(day: string, today: string, retentionDays: number): boolean {
  return (Date.parse(today) - Date.parse(day)) / 86_400_000 < retentionDays;
}

/**
 * Regroupement par personne pour la liste « Votes frauduleux » : même groupe au sens du moteur, ou à
 * défaut même cookie, même jeton ou même clé forte. Rend des composantes de 1 tentative ou plus.
 */
export function personClusters(attempts: GraphAttempt[], opts: GraphOptions): string[][] {
  const links = linkAttempts(attempts, { ...opts, withCookie: true }).filter((l) => !LINK_KINDS[l.kind].suspectOnly);
  const uf = new UnionFind();
  for (const l of links) uf.union(l.a, l.b);
  const by = new Map<string, string[]>();
  for (const a of attempts) {
    const r = uf.find(a.id);
    (by.get(r) ?? by.set(r, []).get(r)!).push(a.id);
  }
  return [...by.values()];
}
