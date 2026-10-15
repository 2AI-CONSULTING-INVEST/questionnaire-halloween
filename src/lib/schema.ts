import { z } from "zod";

export const VOTER_TYPES = ["client", "employee"] as const;
export const VISIT_PERIODS = ["lundi-jeudi", "vendredi-samedi", "dimanche"] as const;
export const IMPACTS = ["beaucoup", "un_peu", "pas_du_tout"] as const;

export type VoterType = (typeof VOTER_TYPES)[number];
export type VisitPeriod = (typeof VISIT_PERIODS)[number];
export type Impact = (typeof IMPACTS)[number];

export const COMMENT_MAX = 300;
// Lettres, chiffres, ponctuation, symboles (emojis), espaces et retours à la ligne — sans chevrons.
const COMMENT_RE = /^[\p{L}\p{N}\p{P}\p{S}\p{M}\p{Zs}\n\r‍️]*$/u;

/** Normalise un numéro français vers E.164 (+33XXXXXXXXX). Retourne null si invalide. */
export function normalizeFrPhone(input: string): string | null {
  const digits = input.replace(/[\s.\-()]/g, "");
  let national: string | null = null;
  if (/^0[1-9]\d{8}$/.test(digits)) national = digits.slice(1);
  else if (/^\+33[1-9]\d{8}$/.test(digits)) national = digits.slice(3);
  else if (/^0033[1-9]\d{8}$/.test(digits)) national = digits.slice(4);
  return national ? `+33${national}` : null;
}

/** +33612345678 -> "06 12 34 56 78" */
export function formatFrPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  const m = /^\+33(\d{9})$/.exec(e164);
  if (!m) return e164;
  return ("0" + m[1]).replace(/(\d{2})(?=\d)/g, "$1 ");
}

const trimmed = (max: number) => z.string().trim().max(max);

export const commentSchema = trimmed(COMMENT_MAX)
  .refine((v) => COMMENT_RE.test(v) && !/[<>]/.test(v), "Caractères non autorisés");

// ---------------------------------------------------------------------------
// Pseudonyme du tirage au sort : affiché publiquement dans la liste des participants.
// 3 à 24 caractères : lettres (accents acceptés), chiffres, espace, « . », « _ », « - ».
// ---------------------------------------------------------------------------

export const PSEUDO_MIN = 3;
export const PSEUDO_MAX = 24;
const PSEUDO_RE = /^[\p{L}\p{N} ._-]+$/u;

/** Espaces de début / fin retirés, espaces multiples fusionnés. */
export const normalizePseudo = (v: string) => v.trim().replace(/\s+/g, " ");

/**
 * Clé d'unicité d'un pseudonyme : minuscules, sans accents, espaces fusionnés.
 * « Élodie  Dupont » et « elodie dupont » désignent le même pseudo.
 */
export const pseudoKey = (v: string) =>
  normalizePseudo(v)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();

export const pseudoSchema = z
  .string()
  .transform(normalizePseudo)
  .pipe(
    z
      .string()
      .min(PSEUDO_MIN, `${PSEUDO_MIN} caractères minimum`)
      .max(PSEUDO_MAX, `${PSEUDO_MAX} caractères maximum`)
      .regex(PSEUDO_RE, "Lettres, chiffres, espaces, « . », « _ » et « - » uniquement"),
  );

export const emailSchema = z.string().trim().toLowerCase().max(255).email("Adresse email invalide");
export const phoneSchema = z
  .string()
  .transform((v, ctx) => {
    const n = normalizeFrPhone(v);
    if (!n) {
      ctx.addIssue({ code: "custom", message: "Numéro français invalide" });
      return z.NEVER;
    }
    return n;
  });

/**
 * Champs mis à jour en direct (auto-save). Chaque champ est optionnel ; null efface la valeur.
 * Les coordonnées du tirage (pseudo, téléphone, email) ne sont jamais enregistrées en direct :
 * elles ne partent qu'à la confirmation (minimisation des données).
 */
export const responsePatchSchema = z
  .object({
    voter_type: z.enum(VOTER_TYPES).nullable(),
    selected_restaurant: trimmed(150).min(1).nullable(),
    visit_period: z.enum(VISIT_PERIODS).nullable(),
    selected_decoration_id: z.string().uuid().nullable(),
    decoration_impact: z.enum(IMPACTS).nullable(),
    comment: commentSchema.nullable(),
    wants_raffle: z.boolean().nullable(),
  })
  .partial()
  .strict();

export type ResponsePatch = z.infer<typeof responsePatchSchema>;

/** Champs encore modifiables une fois le vote validé. */
export const RAFFLE_FIELDS = ["wants_raffle"] as const;

/**
 * Validation du vote (questions 1 → 5). Comme dans le Typeform, le vote est enregistré avant le tirage au sort.
 * « Qui êtes-vous ? » (voter_type) a été retirée du questionnaire : la colonne reste pour les anciennes réponses.
 */
export const voteCompleteSchema = z
  .object({
    selected_restaurant: trimmed(150).min(1),
    visit_period: z.enum(VISIT_PERIODS).nullable().optional(),
    selected_decoration_id: z.string().uuid(),
    decoration_impact: z.enum(IMPACTS),
    comment: commentSchema.nullable().optional(),
  })
  .strict();

/** Validation finale du tirage au sort (Q6) : pseudonyme + téléphone + email, confirmés dans la modale. */
export const raffleSchema = z.discriminatedUnion("wants_raffle", [
  z.object({ wants_raffle: z.literal(false) }).strict(),
  z
    .object({
      wants_raffle: z.literal(true),
      pseudo: pseudoSchema,
      phone_number: phoneSchema,
      email: emailSchema,
    })
    .strict(),
]);

export type RaffleEntry = Extract<z.infer<typeof raffleSchema>, { wants_raffle: true }>;

/** Coordonnées d'un participant, prêtes à enregistrer (normalisées, clé de pseudo calculée). */
export type ParticipantInput = { pseudo: string; pseudo_key: string; email: string; phone_number: string };

export const participantInput = (e: RaffleEntry): ParticipantInput => ({
  pseudo: e.pseudo,
  pseudo_key: pseudoKey(e.pseudo),
  email: e.email,
  phone_number: e.phone_number,
});

export type ResponseRow = {
  id: string;
  session_id: string;
  voter_type: VoterType | null;
  selected_restaurant: string | null;
  visit_period: VisitPeriod | null;
  selected_decoration_id: string | null;
  decoration_impact: Impact | null;
  comment: string | null;
  wants_raffle: boolean | null;
  /** Anciennes colonnes (réponses d'avant la table participants) : lues, plus jamais écrites. */
  participant_name: string | null;
  phone_number: string | null;
  email: string | null;
  is_winner: boolean;
  /** Inscription au tirage reliée à cette réponse. */
  participant_id: string | null;
  /** Identifiant de l'appareil (cookie hw_voter) et jour du vote à Paris : un vote par jour. */
  voter_id: string | null;
  vote_day: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  ip_address: string | null;
  user_agent: string | null;
};

/** Participant au tirage au sort : une personne (email / téléphone / pseudo uniques). */
export type Participant = {
  id: string;
  pseudo: string;
  pseudo_key: string;
  email: string;
  phone_number: string;
  created_at: string;
  updated_at: string;
};

/** Lot à gagner ; un lot a au plus un gagnant, un participant gagne au plus un lot. */
export type Prize = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  display_order: number;
  winner_participant_id: string | null;
  created_at: string;
  updated_at: string;
};

export const PRIZE_DESCRIPTION_MAX = 500;
export const prizeNameSchema = z.string().trim().min(2, "2 caractères minimum").max(120, "120 caractères maximum");
export const prizeDescriptionSchema = z.string().trim().max(PRIZE_DESCRIPTION_MAX, `${PRIZE_DESCRIPTION_MAX} caractères maximum`);

export type Decoration = {
  id: string;
  restaurant_name: string;
  image_url: string;
  display_order: number;
  created_at: string;
};

export type Restaurant = {
  id: string;
  name: string;
  city: string | null;
  created_at: string;
};

export const LABELS = {
  voter_type: { client: "Client", employee: "Employé" } as Record<VoterType, string>,
  visit_period: {
    "lundi-jeudi": "Lundi - Jeudi",
    "vendredi-samedi": "Vendredi - Samedi",
    dimanche: "Dimanche",
  } as Record<VisitPeriod, string>,
  decoration_impact: {
    beaucoup: "Beaucoup",
    un_peu: "Un peu",
    pas_du_tout: "Pas du tout",
  } as Record<Impact, string>,
};

// ---------------------------------------------------------------------------
// Médias des décorations : plusieurs photos / vidéos par restaurant.
// Le type se déduit de l'extension ; une vidéo a une affiche « <nom>.poster.jpg ».
// ---------------------------------------------------------------------------

const VIDEO_RE = /\.(mp4|webm|mov|m4v)(\?.*)?$/i;

export type MediaKind = "image" | "video";

export function mediaKind(url: string): MediaKind {
  return VIDEO_RE.test(url) ? "video" : "image";
}

/** Affiche (première image) d'une vidéo, générée à l'envoi depuis le backoffice. */
export function posterOf(url: string) {
  return url.replace(VIDEO_RE, ".poster.jpg");
}

/** Image à afficher en vignette : la photo elle-même, ou l'affiche de la vidéo. */
export function thumbOf(d: Pick<Decoration, "image_url">) {
  return mediaKind(d.image_url) === "video" ? posterOf(d.image_url) : d.image_url;
}

/**
 * Média du stockage local (développement : /seed, /uploads) et non du bucket Supabase (URL absolue).
 * Ceux-là sont affichés sans l'optimiseur d'images : sa requête interne ignore le basePath et tombe
 * sur la redirection globale vers /halloween.
 */
export const isLocalMedia = (url: string) => url.startsWith("/");

export type DecorationGroup = {
  /** Média de couverture : c'est son id qui est enregistré comme vote. */
  id: string;
  restaurant_name: string;
  items: Decoration[];
};

/** Regroupe les médias par restaurant, dans l'ordre d'affichage (le premier sert de couverture). */
export function groupDecorations(decorations: Decoration[]): DecorationGroup[] {
  const groups = new Map<string, DecorationGroup>();
  for (const d of decorations) {
    const g = groups.get(d.restaurant_name);
    if (g) g.items.push(d);
    else groups.set(d.restaurant_name, { id: d.id, restaurant_name: d.restaurant_name, items: [d] });
  }
  return [...groups.values()];
}

/** « CHAMAS TACOS - LILLE FIVES » → « LILLE FIVES » */
export const shortName = (name: string) => name.replace(/^CHAMAS TACOS\s*-\s*/i, "");

/** Formats acceptés à l'envoi (après préparation dans le navigateur) → extension du fichier stocké. */
export const MEDIA_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "video/mp4": "mp4",
  "video/webm": "webm",
};

export const MEDIA_LIMITS = {
  /** Les photos sont redimensionnées dans le navigateur avant l'envoi (~1 Mo). */
  imageBytes: 10 * 1024 * 1024,
  /** Limite par fichier du plan gratuit Supabase. */
  videoBytes: 50 * 1024 * 1024,
};
