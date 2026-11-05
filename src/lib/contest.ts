import { z } from "zod";

/**
 * Fin du concours (réglage `contest`, piloté depuis l'onglet « Concours » du backoffice).
 * Concours terminé : plus aucun vote, commentaire ni inscription au tirage n'est accepté (routes
 * /api/responses/*), et l'accueil annonce la fin avec les publications et la vidéo du tirage.
 * Réversible : rouvrir le concours rend le questionnaire (édition suivante).
 */
export const CONTEST_KEY = "contest";

/** Lien https vers un post d'un réseau donné (ou null : pas encore publié). */
const postUrl = (host: string) =>
  z
    .string()
    .trim()
    .max(500)
    .refine((v) => {
      try {
        const u = new URL(v);
        return u.protocol === "https:" && (u.hostname === host || u.hostname.endsWith(`.${host}`));
      } catch {
        return false;
      }
    }, `Lien attendu : https://…${host}/…`)
    .nullable();

export const contestSchema = z.object({
  closed: z.boolean(),
  closed_at: z.string().nullable(),
  instagram_url: postUrl("instagram.com"),
  tiktok_url: postUrl("tiktok.com"),
  /** Vidéo du tirage, dans notre stockage (affiche « <nom>.poster.jpg » à côté). */
  video_url: z.string().max(500).nullable(),
});
export type Contest = z.infer<typeof contestSchema>;

export const DEFAULT_CONTEST: Contest = { closed: false, closed_at: null, instagram_url: null, tiktok_url: null, video_url: null };

const blankToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

/** Modification depuis le backoffice : champs facultatifs ; un lien vide l'efface. */
export const contestPatchSchema = z
  .object({
    closed: z.boolean(),
    instagram_url: z.preprocess(blankToNull, contestSchema.shape.instagram_url),
    tiktok_url: z.preprocess(blankToNull, contestSchema.shape.tiktok_url),
    // URL absolue (Supabase) ou chemin local (/uploads/…) : vérifiée par la route (isOwnFile + fileExists).
    video_url: z.string().max(500).nullable(),
  })
  .partial()
  .strict();

/** Réglage absent ou illisible : concours ouvert (comportement d'origine). */
export async function loadContest(store: { getSetting(key: string): Promise<unknown> }): Promise<Contest> {
  const parsed = contestSchema.safeParse(await store.getSetting(CONTEST_KEY));
  return parsed.success ? parsed.data : DEFAULT_CONTEST;
}

/** Ce que voient les pages publiques une fois le concours terminé. */
export type DrawResults = Pick<Contest, "instagram_url" | "tiktok_url" | "video_url">;
/** Le tirage est annoncé quand sa vidéo est en ligne : jusque-là, on invite à suivre les réseaux sociaux. */
export const drawPublished = (r: Pick<Contest, "video_url">) => !!r.video_url;
/** Concours terminé : les gagnants restent secrets (ils ne quittent pas le serveur) tant que la vidéo n'est pas en ligne. */
export const winnersVisible = (c: Pick<Contest, "closed" | "video_url">) => !c.closed || drawPublished(c);

/** Lots attribués et pseudo de leur gagnant, seulement quand les gagnants peuvent quitter le serveur. */
export function drawWinners<P extends { winner_participant_id: string | null }>(contest: Pick<Contest, "closed" | "video_url">, prizes: P[], participants: { id: string; pseudo: string }[]) {
  if (!winnersVisible(contest)) return [];
  const pseudoOf = new Map(participants.map((p) => [p.id, p.pseudo]));
  return prizes.flatMap((prize) => {
    const pseudo = prize.winner_participant_id ? pseudoOf.get(prize.winner_participant_id) : undefined;
    return pseudo ? [{ prize, pseudo }] : [];
  });
}

export const drawResultsOf = ({ instagram_url, tiktok_url, video_url }: Contest): DrawResults => ({ instagram_url, tiktok_url, video_url });
