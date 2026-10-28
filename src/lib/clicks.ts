import { z } from "zod";

/**
 * Clics de partage et d'abonnement. Fonctions pures, partagées serveur / navigateur.
 * - share : un votant clique un bouton de partage ; `ref` est le code aléatoire mis dans le lien partagé ;
 * - arrival : quelqu'un arrive par un lien partagé (`?via=<réseau>&r=<code>`), relié au partage par `ref` ;
 *   le serveur lui pose le cookie de vote dès l'arrivée, pour relier ensuite son vote et son pseudo au partage ;
 * - follow : clic sur une carte « S'abonner » Instagram / TikTok.
 * Le code du lien n'est jamais l'identifiant du votant (cookie de vote) : il ne permet pas de voter à sa place.
 */

export const SHARE_TARGETS = ["whatsapp", "snapchat", "instagram", "tiktok", "copy"] as const;
export const FOLLOW_TARGETS = ["instagram", "tiktok"] as const;
export type ShareTarget = (typeof SHARE_TARGETS)[number];
export type FollowTarget = (typeof FOLLOW_TARGETS)[number];

export const TARGET_LABELS: Record<ShareTarget, string> = {
  whatsapp: "WhatsApp",
  snapchat: "Snapchat",
  instagram: "Instagram",
  tiktok: "TikTok",
  copy: "Lien copié",
};

/** Code du lien partagé : 10 caractères [a-z0-9]. */
export const REF_RE = /^[a-z0-9]{10}$/;

export function randomRef() {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => alphabet[b % alphabet.length]).join("");
}

/** Corps de POST /api/click. */
export const clickSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("share"), target: z.enum(SHARE_TARGETS), ref: z.string().regex(REF_RE) }).strict(),
  z.object({ kind: z.literal("arrival"), target: z.enum(SHARE_TARGETS), ref: z.string().regex(REF_RE) }).strict(),
  z.object({ kind: z.literal("follow"), target: z.enum(FOLLOW_TARGETS) }).strict(),
]);

export type Click = {
  id: string;
  day: string;
  created_at: string;
  kind: "share" | "arrival" | "follow";
  target: string;
  ref: string | null;
  /** Cookie de vote de l'auteur du clic (null s'il n'a jamais commencé de vote sur cet appareil). */
  voter_id: string | null;
};

/** Ce que l'on sait d'un cookie de vote : pseudo du participant au tirage relié, et vote validé ou non. */
export type Person = { voter: string; pseudo: string | null; voted: boolean };

/** `brought` : personnes arrivées par ses liens (une fois chacune, lui-même exclu). */
export type Sharer = Person & { shares: number; targets: ShareTarget[]; brought: Person[] };

/** Réponse de GET /api/admin/clicks/summary (onglet Journal). */
export type ClicksSummary = {
  shares: { target: ShareTarget; clicks: number; arrivals: number }[];
  follows: { target: FollowTarget; clicks: number }[];
  /** Qui partage : votants ayant cliqué un partage, ceux qui ont ramené le plus de monde d'abord (100 au plus). */
  sharers: Sharer[];
  /** Partages faits sans cookie de vote (auteur inconnu). */
  anonymousShares: number;
  /** Arrivées dont le code ne correspond à aucun partage enregistré (lien recopié à la main, partage hors fenêtre). */
  unmatchedArrivals: number;
};

/** Agrégats des clics. `whoIs` : pseudo et vote validé liés à un cookie de vote. */
export function summarizeClicks(rows: Click[], whoIs: (voterId: string) => Omit<Person, "voter">): ClicksSummary {
  const shareByRef = new Map<string, Click>();
  for (const c of rows) if (c.kind === "share" && c.ref) shareByRef.set(c.ref, c);

  const shares = SHARE_TARGETS.map((target) => ({ target, clicks: 0, arrivals: 0 }));
  const follows = FOLLOW_TARGETS.map((target) => ({ target, clicks: 0 }));
  const people = new Map<string, Sharer>();
  const person = (voter: string) => {
    let p = people.get(voter);
    if (!p) people.set(voter, (p = { voter, ...whoIs(voter), shares: 0, targets: [], brought: [] }));
    return p;
  };
  let anonymousShares = 0;
  let unmatchedArrivals = 0;

  for (const c of rows) {
    if (c.kind === "follow") {
      const f = follows.find((x) => x.target === c.target);
      if (f) f.clicks += 1;
      continue;
    }
    const s = shares.find((x) => x.target === c.target);
    if (!s) continue;
    if (c.kind === "share") {
      s.clicks += 1;
      if (!c.voter_id) {
        anonymousShares += 1;
        continue;
      }
      const p = person(c.voter_id);
      p.shares += 1;
      if (!p.targets.includes(s.target)) p.targets.push(s.target);
    } else {
      s.arrivals += 1;
      const origin = c.ref ? shareByRef.get(c.ref) : undefined;
      if (!origin) unmatchedArrivals += 1;
      else if (origin.voter_id && c.voter_id && c.voter_id !== origin.voter_id) {
        const p = person(origin.voter_id);
        if (!p.brought.some((b) => b.voter === c.voter_id)) p.brought.push({ voter: c.voter_id, ...whoIs(c.voter_id) });
      }
    }
  }

  const sharers = [...people.values()]
    .filter((p) => p.shares > 0)
    .sort((a, b) => b.brought.length - a.brought.length || b.shares - a.shares || a.voter.localeCompare(b.voter))
    .slice(0, 100);
  return { shares, follows, sharers, anonymousShares, unmatchedArrivals };
}
