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
export const nameSchema = z.string().trim().min(2, "2 caractères minimum").max(50, "50 caractères maximum");
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

/** Champs mis à jour en direct (auto-save). Chaque champ est optionnel ; null efface la valeur. */
export const responsePatchSchema = z
  .object({
    voter_type: z.enum(VOTER_TYPES).nullable(),
    selected_restaurant: trimmed(150).min(1).nullable(),
    visit_period: z.enum(VISIT_PERIODS).nullable(),
    selected_decoration_id: z.string().uuid().nullable(),
    decoration_impact: z.enum(IMPACTS).nullable(),
    comment: commentSchema.nullable(),
    wants_raffle: z.boolean().nullable(),
    participant_name: nameSchema.nullable(),
    phone_number: phoneSchema.nullable(),
    email: emailSchema.nullable(),
  })
  .partial()
  .strict();

export type ResponsePatch = z.infer<typeof responsePatchSchema>;

export const RAFFLE_FIELDS = ["wants_raffle", "participant_name", "phone_number", "email"] as const;

/** Validation du vote (Q1 → Q6). Comme dans le Typeform, le vote est enregistré avant le tirage au sort. */
export const voteCompleteSchema = z
  .object({
    voter_type: z.enum(VOTER_TYPES),
    selected_restaurant: trimmed(150).min(1),
    visit_period: z.enum(VISIT_PERIODS).nullable().optional(),
    selected_decoration_id: z.string().uuid(),
    decoration_impact: z.enum(IMPACTS),
    comment: commentSchema.nullable().optional(),
  })
  .strict();

/** Validation finale du tirage au sort (Q7). */
export const raffleSchema = z.discriminatedUnion("wants_raffle", [
  z.object({ wants_raffle: z.literal(false) }).strict(),
  z
    .object({
      wants_raffle: z.literal(true),
      participant_name: nameSchema,
      phone_number: phoneSchema,
      email: emailSchema,
    })
    .strict(),
]);

/** Un participant au tirage est valide si les 3 informations de contact sont présentes. */
export function isRaffleEntry(r: Pick<ResponseRow, "wants_raffle" | "participant_name" | "phone_number" | "email" | "completed_at">) {
  return Boolean(r.completed_at && r.wants_raffle && r.participant_name && r.phone_number && r.email);
}

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
  participant_name: string | null;
  phone_number: string | null;
  email: string | null;
  is_winner: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  ip_address: string | null;
  user_agent: string | null;
};

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
