import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { parisDay } from "./day";
import { normalizeFrPhone, pseudoKey, type Decoration, type Participant, type ParticipantInput, type Prize, type Restaurant, type ResponsePatch, type ResponseRow } from "./schema";

export type Meta = { ip: string | null; userAgent: string | null };
export type UpdateResult = "ok" | "completed";
/** « already_voted_today » : cet appareil a déjà une réponse validée ce jour-là. */
export type CompleteResult = UpdateResult | "already_voted_today";
export type ListFilter = { completedOnly?: boolean; from?: string; to?: string };
/** Appareil et jour (Europe/Paris) enregistrés à la validation du vote. */
export type VoteStamp = { voterId: string | null; voteDay: string };
/** Choix du tirage ; `participant_id` absent = inchangé. */
export type RaffleLink = { wants_raffle: boolean; participant_id?: string | null };
export type PrizeInput = Pick<Prize, "name" | "description" | "image_url" | "display_order">;
export type PrizePatch = Partial<Pick<Prize, "name" | "description" | "image_url" | "display_order" | "winner_participant_id">>;

/**
 * Conflit d'unicité (pseudo, email, téléphone, gagnant) : `fields` donne un message par champ
 * de l'API (« pseudo », « email », « phone_number », « winner_participant_id »).
 */
export class ConflictError extends Error {
  constructor(public readonly fields: Record<string, string>) {
    super(Object.values(fields)[0] ?? "Conflit");
    this.name = "ConflictError";
  }
}

export const CONFLICT_MESSAGES = {
  pseudo: "Ce pseudonyme est déjà pris",
  email: "Cette adresse email est déjà inscrite au tirage",
  phone_number: "Ce numéro est déjà inscrit au tirage",
  winner_participant_id: "Ce participant a déjà gagné un lot",
  raffle: "Une inscription au tirage est déjà enregistrée pour ce vote",
} as const;

/** Les trois coordonnées de `input` désignent ce participant. */
const sameParticipant = (p: Participant, input: ParticipantInput) =>
  p.pseudo_key === input.pseudo_key && p.email === input.email && p.phone_number === input.phone_number;

/** Parmi les participants trouvés par pseudo / email / téléphone, celui qui porte les trois (même personne). */
const samePerson = (found: { pseudo: Participant | null; email: Participant | null; phone_number: Participant | null }) =>
  found.email && found.email.id === found.phone_number?.id && found.email.id === found.pseudo?.id ? found.email : null;

export interface Store {
  readonly kind: "supabase" | "local";
  createResponse(sessionId: string, meta: Meta, voterId: string | null): Promise<UpdateResult>;
  updateResponse(sessionId: string, patch: ResponsePatch, meta: Meta, voterId: string | null): Promise<UpdateResult>;
  /** Valide le vote ; refuse si l'appareil a déjà voté ce jour-là (index unique côté base). */
  completeResponse(sessionId: string, data: ResponsePatch, meta: Meta, vote: VoteStamp): Promise<CompleteResult>;
  /** Choix du tirage au sort : modifiable même après validation du vote. */
  updateRaffle(sessionId: string, link: RaffleLink): Promise<void>;
  getResponse(idOrSessionId: string): Promise<ResponseRow | null>;
  deleteResponse(id: string): Promise<void>;
  listResponses(filter?: ListFilter): Promise<ResponseRow[]>;
  /** Vrai si cet appareil a une réponse validée ce jour-là. */
  hasVotedToday(voterId: string, day: string): Promise<boolean>;

  /**
   * Inscrit la réponse au tirage : au plus UNE inscription par réponse. Réponse déjà inscrite :
   * idempotent avec les mêmes coordonnées (`alreadyRegistered`), refus (ConflictError « raffle »)
   * avec d'autres. Si les trois coordonnées désignent un participant existant (même personne qui
   * revote), la réponse lui est reliée (`alreadyRegistered`). Si une partie seulement entre en
   * conflit, lève ConflictError avec le détail par champ. Jamais de participant orphelin.
   */
  registerParticipant(sessionId: string, input: ParticipantInput): Promise<{ participant: Participant; alreadyRegistered: boolean }>;
  listParticipants(): Promise<Participant[]>;
  /** Modération du pseudo (unicité vérifiée par la base : ConflictError). */
  updateParticipant(id: string, patch: Pick<Participant, "pseudo" | "pseudo_key">): Promise<void>;
  deleteParticipant(id: string): Promise<void>;

  listPrizes(): Promise<Prize[]>;
  getPrize(id: string): Promise<Prize | null>;
  addPrize(p: PrizeInput): Promise<Prize>;
  /** ConflictError si le gagnant a déjà un autre lot. */
  updatePrize(id: string, patch: PrizePatch): Promise<void>;
  deletePrize(id: string): Promise<void>;

  listRestaurants(): Promise<Restaurant[]>;
  addRestaurant(name: string, city: string | null): Promise<Restaurant>;
  deleteRestaurant(id: string): Promise<void>;

  listDecorations(): Promise<Decoration[]>;
  getDecoration(id: string): Promise<Decoration | null>;
  addDecoration(d: Pick<Decoration, "restaurant_name" | "image_url" | "display_order">): Promise<Decoration>;
  updateDecoration(id: string, d: Partial<Pick<Decoration, "restaurant_name" | "display_order">>): Promise<void>;
  deleteDecoration(id: string): Promise<void>;
  /** Nombre de réponses qui pointent vers ce média. */
  countVotes(decorationId: string): Promise<number>;
  /** Reporte les votes d'un média vers un autre (même restaurant) avant sa suppression. */
  moveVotes(fromId: string, toId: string): Promise<void>;

  /**
   * Supabase : URL signée pour envoyer un fichier directement depuis le navigateur
   * (les fonctions Vercel refusent les requêtes de plus de 4,5 Mo). null en local.
   */
  createUploadTarget(name: string): Promise<{ signedUrl: string; publicUrl: string } | null>;
  /** Enregistre un fichier reçu par le serveur (stockage local). */
  saveFile(file: Blob, name: string): Promise<string>;
  /** Vrai si l'URL désigne un fichier de notre propre stockage. */
  isOwnFile(url: string): boolean;
  removeFiles(urls: string[]): Promise<void>;
}

// ---------------------------------------------------------------------------
// Supabase
// ---------------------------------------------------------------------------

type PgError = { message: string; code?: string; details?: string | null };

/** Codes Postgres / PostgREST d'une table ou d'une colonne absente : la migration n'a pas été exécutée. */
const MISSING_SCHEMA = new Set(["42P01", "42703", "PGRST204", "PGRST205"]);

/** Erreur à relayer, avec un message explicite si le schéma de la base n'est pas à jour. */
function pgError(e: PgError) {
  if (e.code && MISSING_SCHEMA.has(e.code)) {
    return new Error(`Base Supabase pas à jour (${e.message}) : exécutez supabase/migrations/2026-10-14_tirage-vote-quotidien.sql dans Supabase > SQL Editor.`);
  }
  return new Error(e.message);
}

/** Nom de la contrainte violée (erreur 23505), ou null. */
function violatedConstraint(e: PgError | null): string | null {
  if (!e || e.code !== "23505") return null;
  return /constraint "([^"]+)"/.exec(e.message)?.[1] ?? "";
}

/** Contrainte d'unicité → champ de l'API (voir supabase/schema.sql). */
const CONSTRAINT_FIELD: Record<string, keyof typeof CONFLICT_MESSAGES> = {
  participants_pseudo_key_unique: "pseudo",
  participants_email_unique: "email",
  participants_phone_unique: "phone_number",
  prizes_winner_unique: "winner_participant_id",
};

class SupabaseStore implements Store {
  readonly kind = "supabase" as const;
  constructor(
    private sb: SupabaseClient,
    private bucket: string,
  ) {}

  private check<T>(res: { data: T; error: PgError | null }): T {
    if (res.error) throw pgError(res.error);
    return res.data;
  }

  /** Lève ConflictError si l'erreur est une violation d'unicité connue, sinon la relaie. */
  private conflict(e: PgError | null) {
    const name = violatedConstraint(e);
    if (name !== null) {
      const field = CONSTRAINT_FIELD[name];
      if (field) throw new ConflictError({ [field]: CONFLICT_MESSAGES[field] });
    }
    if (e) throw pgError(e);
  }

  async createResponse(sessionId: string, meta: Meta, voterId: string | null) {
    const res = await this.sb
      .from("responses")
      .upsert(
        { session_id: sessionId, ip_address: meta.ip, user_agent: meta.userAgent, voter_id: voterId },
        { onConflict: "session_id", ignoreDuplicates: true },
      );
    this.check(res);
    return "ok" as const;
  }

  async updateResponse(sessionId: string, patch: ResponsePatch, meta: Meta, voterId: string | null) {
    const updated = this.check(
      await this.sb
        .from("responses")
        .update(patch)
        .eq("session_id", sessionId)
        .is("completed_at", null)
        .select("id"),
    );
    if (updated && updated.length > 0) return "ok" as const;

    const existing = await this.getResponse(sessionId);
    if (existing?.completed_at) return "completed" as const;
    // La création initiale a échoué (réseau) : on crée la ligne maintenant.
    this.check(
      await this.sb.from("responses").insert({
        session_id: sessionId,
        ip_address: meta.ip,
        user_agent: meta.userAgent,
        voter_id: voterId,
        ...patch,
      }),
    );
    return "ok" as const;
  }

  async completeResponse(sessionId: string, data: ResponsePatch, meta: Meta, vote: VoteStamp) {
    // Une seule écriture : les champs du vote, l'appareil, le jour et la validation. L'index unique
    // partiel (voter_id, vote_day) refuse un second vote le même jour, même en requêtes parallèles.
    const stamp = { voter_id: vote.voterId, vote_day: vote.voteDay, completed_at: new Date().toISOString() };
    const res = await this.sb
      .from("responses")
      .update({ ...data, ...stamp })
      .eq("session_id", sessionId)
      .is("completed_at", null)
      .select("id");
    if (violatedConstraint(res.error) !== null) return "already_voted_today" as const;
    const updated = this.check(res);
    if (updated && updated.length > 0) return "ok" as const;

    const existing = await this.getResponse(sessionId);
    if (existing?.completed_at) return "completed" as const;
    const ins = await this.sb.from("responses").insert({ session_id: sessionId, ip_address: meta.ip, user_agent: meta.userAgent, ...data, ...stamp });
    if (violatedConstraint(ins.error) !== null) return "already_voted_today" as const;
    this.check(ins);
    return "ok" as const;
  }

  async updateRaffle(sessionId: string, link: RaffleLink) {
    this.check(await this.sb.from("responses").update(link).eq("session_id", sessionId));
  }

  async getResponse(idOrSessionId: string) {
    const data = this.check(
      await this.sb
        .from("responses")
        .select("*")
        .or(`id.eq.${idOrSessionId},session_id.eq.${idOrSessionId}`)
        .limit(1),
    );
    return (data?.[0] as ResponseRow | undefined) ?? null;
  }

  async deleteResponse(id: string) {
    this.check(await this.sb.from("responses").delete().eq("id", id));
  }

  async listResponses(filter: ListFilter = {}) {
    const rows: ResponseRow[] = [];
    const page = 1000;
    for (let offset = 0; ; offset += page) {
      let q = this.sb.from("responses").select("*").order("created_at", { ascending: true });
      if (filter.completedOnly) q = q.not("completed_at", "is", null);
      if (filter.from) q = q.gte("created_at", filter.from);
      if (filter.to) q = q.lte("created_at", filter.to);
      const data = this.check(await q.range(offset, offset + page - 1)) as ResponseRow[];
      rows.push(...data);
      if (data.length < page) break;
    }
    return rows;
  }

  async hasVotedToday(voterId: string, day: string) {
    const data = this.check(
      await this.sb.from("responses").select("id").eq("voter_id", voterId).eq("vote_day", day).not("completed_at", "is", null).limit(1),
    );
    return (data?.length ?? 0) > 0;
  }

  /** Participants qui partagent au moins une coordonnée avec `input`. */
  private async matching(input: ParticipantInput) {
    const by = (col: string, value: string) => this.sb.from("participants").select("*").eq(col, value).limit(1);
    const [p, e, t] = await Promise.all([by("pseudo_key", input.pseudo_key), by("email", input.email), by("phone_number", input.phone_number)]);
    return {
      pseudo: (this.check(p)?.[0] as Participant | undefined) ?? null,
      email: (this.check(e)?.[0] as Participant | undefined) ?? null,
      phone_number: (this.check(t)?.[0] as Participant | undefined) ?? null,
    };
  }

  /** Participant déjà relié à cette réponse, s'il existe. */
  private async linkedParticipant(sessionId: string) {
    const row = await this.getResponse(sessionId);
    if (!row?.participant_id) return null;
    const data = this.check(await this.sb.from("participants").select("*").eq("id", row.participant_id).limit(1));
    return (data?.[0] as Participant | undefined) ?? null;
  }

  /**
   * Relie la réponse au participant SI elle n'est pas encore inscrite : mise à jour conditionnelle
   * (`participant_id is null`), atomique côté base. Vrai si la liaison a eu lieu.
   */
  private async link(sessionId: string, participantId: string) {
    const data = this.check(
      await this.sb
        .from("responses")
        .update({ wants_raffle: true, participant_id: participantId })
        .eq("session_id", sessionId)
        .is("participant_id", null)
        .select("id"),
    );
    return (data?.length ?? 0) > 0;
  }

  /** Liaison, ou, si un appel parallèle a inscrit la réponse entre-temps : idempotent (même participant) ou refus. */
  private async linkOrExplain(sessionId: string, participant: Participant, alreadyRegistered: boolean) {
    if (await this.link(sessionId, participant.id)) return { participant, alreadyRegistered };
    const linked = await this.linkedParticipant(sessionId);
    if (linked && linked.id === participant.id) return { participant, alreadyRegistered: true };
    throw new ConflictError({ raffle: CONFLICT_MESSAGES.raffle });
  }

  async registerParticipant(sessionId: string, input: ParticipantInput) {
    // 1. Réponse déjà inscrite : idempotent si ce sont les mêmes coordonnées, refus sinon.
    const linked = await this.linkedParticipant(sessionId);
    if (linked) {
      if (sameParticipant(linked, input)) return { participant: linked, alreadyRegistered: true };
      throw new ConflictError({ raffle: CONFLICT_MESSAGES.raffle });
    }
    // 2. Même personne (pseudo, email et téléphone identiques) : on relie.
    const same = samePerson(await this.matching(input));
    if (same) return this.linkOrExplain(sessionId, same, true);
    // 3. Nouveau participant (insertion atomique : les contraintes d'unicité tranchent), puis liaison.
    const ins = await this.sb.from("participants").insert(input).select("*").single();
    if (violatedConstraint(ins.error) !== null) {
      // L'insertion a échoué : on relit pour renvoyer tous les champs en conflit (ou relier si la
      // même personne vient d'être créée par un appel parallèle).
      const again = await this.matching(input);
      const sameNow = samePerson(again);
      if (sameNow) return this.linkOrExplain(sessionId, sameNow, true);
      const fields: Record<string, string> = {};
      for (const k of ["pseudo", "email", "phone_number"] as const) if (again[k]) fields[k] = CONFLICT_MESSAGES[k];
      throw new ConflictError(Object.keys(fields).length ? fields : { email: CONFLICT_MESSAGES.email });
    }
    const participant = this.check(ins) as Participant;
    if (await this.link(sessionId, participant.id)) return { participant, alreadyRegistered: false };
    // La réponse a été inscrite entre-temps (appel parallèle) : pas de participant orphelin.
    this.check(await this.sb.from("participants").delete().eq("id", participant.id));
    const now = await this.linkedParticipant(sessionId);
    if (now && sameParticipant(now, input)) return { participant: now, alreadyRegistered: true };
    throw new ConflictError({ raffle: CONFLICT_MESSAGES.raffle });
  }

  async listParticipants() {
    const rows: Participant[] = [];
    const page = 1000;
    for (let offset = 0; ; offset += page) {
      const data = this.check(
        await this.sb.from("participants").select("*").order("created_at", { ascending: false }).range(offset, offset + page - 1),
      ) as Participant[];
      rows.push(...data);
      if (data.length < page) break;
    }
    return rows;
  }

  async updateParticipant(id: string, patch: Pick<Participant, "pseudo" | "pseudo_key">) {
    const res = await this.sb.from("participants").update(patch).eq("id", id);
    this.conflict(res.error);
  }

  async deleteParticipant(id: string) {
    this.check(await this.sb.from("participants").delete().eq("id", id));
  }

  async listPrizes() {
    return this.check(await this.sb.from("prizes").select("*").order("display_order").order("created_at")) as Prize[];
  }

  async getPrize(id: string) {
    const data = this.check(await this.sb.from("prizes").select("*").eq("id", id).limit(1));
    return (data?.[0] as Prize | undefined) ?? null;
  }

  async addPrize(p: PrizeInput) {
    return this.check(await this.sb.from("prizes").insert(p).select("*").single()) as Prize;
  }

  async updatePrize(id: string, patch: PrizePatch) {
    const res = await this.sb.from("prizes").update(patch).eq("id", id);
    this.conflict(res.error);
  }

  async deletePrize(id: string) {
    this.check(await this.sb.from("prizes").delete().eq("id", id));
  }

  async listRestaurants() {
    return this.check(await this.sb.from("restaurants").select("*").order("name")) as Restaurant[];
  }

  async addRestaurant(name: string, city: string | null) {
    return this.check(
      await this.sb.from("restaurants").insert({ name, city }).select("*").single(),
    ) as Restaurant;
  }

  async deleteRestaurant(id: string) {
    this.check(await this.sb.from("restaurants").delete().eq("id", id));
  }

  async listDecorations() {
    return this.check(
      await this.sb
        .from("decorations")
        .select("*")
        .order("display_order")
        .order("created_at"),
    ) as Decoration[];
  }

  async getDecoration(id: string) {
    const data = this.check(await this.sb.from("decorations").select("*").eq("id", id).limit(1));
    return (data?.[0] as Decoration | undefined) ?? null;
  }

  async addDecoration(d: Pick<Decoration, "restaurant_name" | "image_url" | "display_order">) {
    return this.check(await this.sb.from("decorations").insert(d).select("*").single()) as Decoration;
  }

  async updateDecoration(id: string, d: Partial<Pick<Decoration, "restaurant_name" | "display_order">>) {
    this.check(await this.sb.from("decorations").update(d).eq("id", id));
  }

  async deleteDecoration(id: string) {
    this.check(await this.sb.from("decorations").delete().eq("id", id));
  }

  async countVotes(decorationId: string) {
    const res = await this.sb
      .from("responses")
      .select("id", { count: "exact", head: true })
      .eq("selected_decoration_id", decorationId);
    this.check(res);
    return res.count ?? 0;
  }

  async moveVotes(fromId: string, toId: string) {
    this.check(
      await this.sb.from("responses").update({ selected_decoration_id: toId }).eq("selected_decoration_id", fromId),
    );
  }

  private publicUrl(name: string) {
    return this.sb.storage.from(this.bucket).getPublicUrl(name).data.publicUrl;
  }

  async createUploadTarget(name: string) {
    const { data, error } = await this.sb.storage.from(this.bucket).createSignedUploadUrl(name);
    if (error) throw new Error(error.message);
    return { signedUrl: data.signedUrl, publicUrl: this.publicUrl(name) };
  }

  async saveFile(file: Blob, name: string) {
    const { error } = await this.sb.storage
      .from(this.bucket)
      .upload(name, await file.arrayBuffer(), { contentType: file.type, cacheControl: "31536000" });
    if (error) throw new Error(error.message);
    return this.publicUrl(name);
  }

  /** Nom du fichier dans le bucket, si l'URL vient bien de notre stockage. */
  private keyOf(url: string) {
    const prefix = this.publicUrl("");
    const key = url.startsWith(prefix) ? url.slice(prefix.length).replace(/^\//, "") : "";
    return FILE_NAME_RE.test(key) ? key : null;
  }

  isOwnFile(url: string) {
    return this.keyOf(url) !== null;
  }

  async removeFiles(urls: string[]) {
    const keys = urls.map((u) => this.keyOf(u)).filter((k): k is string => k !== null);
    if (keys.length === 0) return;
    const { error } = await this.sb.storage.from(this.bucket).remove(keys);
    if (error) console.error("Suppression de fichiers impossible :", error.message);
  }
}

// ---------------------------------------------------------------------------
// Stockage local JSON — développement uniquement (système de fichiers en
// lecture seule sur Vercel).
// ---------------------------------------------------------------------------

type LocalData = {
  responses: ResponseRow[];
  restaurants: Restaurant[];
  decorations: Decoration[];
  participants: Participant[];
  prizes: Prize[];
};

const DATA_FILE = path.join(process.cwd(), ".data", "db.json");
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

const SEED_RESTAURANTS = [
  ["CHAMAS TACOS - LILLE FIVES", "Lille"],
  ["CHAMAS TACOS - LILLE MOULINS", "Lille"],
  ["CHAMAS TACOS - VILLENEUVE D'ASCQ", "Villeneuve d'Ascq"],
] as const;

function seed(): LocalData {
  const now = new Date().toISOString();
  return {
    responses: [],
    restaurants: SEED_RESTAURANTS.map(([name, city]) => ({ id: randomUUID(), name, city, created_at: now })),
    decorations: SEED_RESTAURANTS.map(([name], i) => ({
      id: randomUUID(),
      restaurant_name: name,
      image_url: `/seed/deco-${i + 1}.webp`,
      display_order: i,
      created_at: now,
    })),
    participants: [],
    prizes: [],
  };
}

/** Identifiant stable dérivé d'une graine (participants repris d'un ancien fichier : même id à chaque lecture). */
function derivedId(seed: string) {
  const h = createHash("sha256").update(seed).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/**
 * Met à niveau un fichier écrit par une version précédente : nouvelles tables, nouvelles colonnes
 * de `responses` (jour du vote déduit de la validation), et reprise des anciennes inscriptions au
 * tirage dans `participants` (même logique que la migration SQL : une personne par email / téléphone,
 * la plus ancienne gagne, pseudos rendus uniques). Déterministe et appliquée en mémoire à chaque
 * lecture ; le fichier est réécrit à la première modification. Vrai si quelque chose a changé.
 */
function migrateLocal(d: LocalData): boolean {
  let changed = false;
  if (!d.participants) {
    d.participants = [];
    changed = true;
  }
  if (!d.prizes) {
    d.prizes = [];
    changed = true;
  }
  for (const r of d.responses) {
    if (r.participant_id === undefined) {
      r.participant_id = null;
      changed = true;
    }
    if (r.voter_id === undefined) {
      r.voter_id = null;
      changed = true;
    }
    if (r.vote_day === undefined) {
      r.vote_day = r.completed_at ? parisDay(r.completed_at) : null;
      changed = true;
    }
  }
  const legacy = d.responses
    .filter((r) => r.completed_at && r.wants_raffle && r.participant_name && r.phone_number && r.email && !r.participant_id)
    .sort((a, b) => a.completed_at!.localeCompare(b.completed_at!));
  for (const r of legacy) {
    const email = r.email!.trim().toLowerCase();
    const phone = normalizeFrPhone(r.phone_number!) ?? r.phone_number!;
    let p = d.participants.find((x) => x.email === email || x.phone_number === phone);
    if (!p) {
      const base = normalizePseudoLegacy(r.participant_name!);
      let pseudo = base;
      for (let n = 2; d.participants.some((x) => x.pseudo_key === pseudoKey(pseudo)); n++) pseudo = `${base.slice(0, 24 - String(n).length)}${n}`;
      p = { id: derivedId(`participant:${r.id}`), pseudo, pseudo_key: pseudoKey(pseudo), email, phone_number: phone, created_at: r.completed_at!, updated_at: r.completed_at! };
      d.participants.push(p);
    }
    r.participant_id = p.id;
    changed = true;
  }
  return changed;
}

/** Ancien « nom et prénom » → pseudo valide (caractères autorisés, 3 à 24 caractères). */
function normalizePseudoLegacy(name: string) {
  const cleaned = name.replace(/[^\p{L}\p{N} ._-]/gu, " ").trim().replace(/\s+/g, " ").slice(0, 24).trim();
  return cleaned.length >= 3 ? cleaned : `${cleaned}Participant`.slice(0, 24);
}

class LocalStore implements Store {
  readonly kind = "local" as const;
  private queue: Promise<unknown> = Promise.resolve();

  private ready: Promise<void> | null = null;

  /** Crée le fichier de démo une seule fois (évite deux jeux de données concurrents). */
  private ensure() {
    this.ready ??= fs.access(DATA_FILE).catch(() => this.write(seed()));
    return this.ready;
  }

  private async read(): Promise<LocalData> {
    await this.ensure();
    const data = JSON.parse(await fs.readFile(DATA_FILE, "utf8")) as LocalData;
    migrateLocal(data); // en mémoire seulement : une lecture (prérendu, workers parallèles) n'écrit jamais
    return data;
  }

  private async write(data: LocalData) {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    const tmp = `${DATA_FILE}.${randomUUID()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(data, null, 2));
    // Windows refuse le remplacement pendant qu'un autre processus lit le fichier : quelques essais.
    for (let attempt = 0; ; attempt++) {
      try {
        await fs.rename(tmp, DATA_FILE);
        return;
      } catch (e) {
        const code = (e as NodeJS.ErrnoException).code;
        if ((code !== "EPERM" && code !== "EBUSY") || attempt >= 5) throw e;
        await new Promise((r) => setTimeout(r, 30 * (attempt + 1)));
      }
    }
  }

  /** Sérialise les écritures pour éviter les pertes concurrentes. */
  private mutate<T>(fn: (d: LocalData) => T | Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      const data = await this.read();
      const out = await fn(data);
      await this.write(data);
      return out;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  private blank(sessionId: string, meta: Meta, voterId: string | null): ResponseRow {
    const now = new Date().toISOString();
    return {
      id: randomUUID(),
      session_id: sessionId,
      voter_type: null,
      selected_restaurant: null,
      visit_period: null,
      selected_decoration_id: null,
      decoration_impact: null,
      comment: null,
      wants_raffle: null,
      participant_name: null,
      phone_number: null,
      email: null,
      is_winner: false,
      participant_id: null,
      voter_id: voterId,
      vote_day: null,
      completed_at: null,
      created_at: now,
      updated_at: now,
      ip_address: meta.ip,
      user_agent: meta.userAgent,
    };
  }

  createResponse(sessionId: string, meta: Meta, voterId: string | null) {
    return this.mutate((d) => {
      if (!d.responses.some((r) => r.session_id === sessionId)) d.responses.push(this.blank(sessionId, meta, voterId));
      return "ok" as const;
    });
  }

  updateResponse(sessionId: string, patch: ResponsePatch, meta: Meta, voterId: string | null) {
    return this.mutate((d) => {
      let row = d.responses.find((r) => r.session_id === sessionId);
      if (row?.completed_at) return "completed" as const;
      if (!row) {
        row = this.blank(sessionId, meta, voterId);
        d.responses.push(row);
      }
      Object.assign(row, patch, { updated_at: new Date().toISOString() });
      return "ok" as const;
    });
  }

  completeResponse(sessionId: string, data: ResponsePatch, meta: Meta, vote: VoteStamp) {
    // Même règle que l'index unique partiel de la base, appliquée dans la file d'écriture (atomique).
    return this.mutate((d) => {
      let row = d.responses.find((r) => r.session_id === sessionId);
      if (row?.completed_at) return "completed" as const;
      if (vote.voterId && d.responses.some((r) => r.completed_at && r.voter_id === vote.voterId && r.vote_day === vote.voteDay)) {
        return "already_voted_today" as const;
      }
      if (!row) {
        row = this.blank(sessionId, meta, vote.voterId);
        d.responses.push(row);
      }
      const now = new Date().toISOString();
      Object.assign(row, data, { voter_id: vote.voterId, vote_day: vote.voteDay, completed_at: now, updated_at: now });
      return "ok" as const;
    });
  }

  async updateRaffle(sessionId: string, link: RaffleLink) {
    await this.mutate((d) => {
      const row = d.responses.find((r) => r.session_id === sessionId);
      if (row) Object.assign(row, link, { updated_at: new Date().toISOString() });
    });
  }

  async getResponse(idOrSessionId: string) {
    const d = await this.read();
    return d.responses.find((r) => r.id === idOrSessionId || r.session_id === idOrSessionId) ?? null;
  }

  async deleteResponse(id: string) {
    await this.mutate((d) => {
      d.responses = d.responses.filter((r) => r.id !== id);
    });
  }

  async listResponses(filter: ListFilter = {}) {
    const d = await this.read();
    return d.responses.filter(
      (r) =>
        (!filter.completedOnly || r.completed_at) &&
        (!filter.from || r.created_at >= filter.from) &&
        (!filter.to || r.created_at <= filter.to),
    );
  }

  async hasVotedToday(voterId: string, day: string) {
    const d = await this.read();
    return d.responses.some((r) => r.completed_at && r.voter_id === voterId && r.vote_day === day);
  }

  registerParticipant(sessionId: string, input: ParticipantInput) {
    // Toute la règle s'exécute dans la file d'écriture : atomique, comme les contraintes de la base.
    return this.mutate((d) => {
      const row = d.responses.find((r) => r.session_id === sessionId);
      // 1. Réponse déjà inscrite : idempotent si mêmes coordonnées, refus sinon.
      const linked = row?.participant_id ? (d.participants.find((p) => p.id === row.participant_id) ?? null) : null;
      if (linked) {
        if (sameParticipant(linked, input)) return { participant: linked, alreadyRegistered: true };
        throw new ConflictError({ raffle: CONFLICT_MESSAGES.raffle });
      }
      const byPseudo = d.participants.find((p) => p.pseudo_key === input.pseudo_key) ?? null;
      const byEmail = d.participants.find((p) => p.email === input.email) ?? null;
      const byPhone = d.participants.find((p) => p.phone_number === input.phone_number) ?? null;
      const link = (id: string) => row && Object.assign(row, { wants_raffle: true, participant_id: id, updated_at: new Date().toISOString() });
      // 2. Même personne (pseudo, email et téléphone identiques) : on relie.
      if (byEmail && byEmail === byPhone && byEmail === byPseudo) {
        link(byEmail.id);
        return { participant: byEmail, alreadyRegistered: true };
      }
      const fields: Record<string, string> = {};
      if (byPseudo) fields.pseudo = CONFLICT_MESSAGES.pseudo;
      if (byEmail) fields.email = CONFLICT_MESSAGES.email;
      if (byPhone) fields.phone_number = CONFLICT_MESSAGES.phone_number;
      if (Object.keys(fields).length) throw new ConflictError(fields);
      const now = new Date().toISOString();
      const participant: Participant = { id: randomUUID(), ...input, created_at: now, updated_at: now };
      d.participants.push(participant);
      link(participant.id);
      return { participant, alreadyRegistered: false };
    });
  }

  async listParticipants() {
    const d = await this.read();
    return [...d.participants].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  async updateParticipant(id: string, patch: Pick<Participant, "pseudo" | "pseudo_key">) {
    await this.mutate((d) => {
      if (d.participants.some((p) => p.id !== id && p.pseudo_key === patch.pseudo_key)) throw new ConflictError({ pseudo: CONFLICT_MESSAGES.pseudo });
      const p = d.participants.find((x) => x.id === id);
      if (p) Object.assign(p, patch, { updated_at: new Date().toISOString() });
    });
  }

  async deleteParticipant(id: string) {
    await this.mutate((d) => {
      d.participants = d.participants.filter((p) => p.id !== id);
      // Comme « on delete set null » en base.
      for (const r of d.responses) if (r.participant_id === id) r.participant_id = null;
      for (const p of d.prizes) if (p.winner_participant_id === id) p.winner_participant_id = null;
    });
  }

  async listPrizes() {
    const d = await this.read();
    return [...d.prizes].sort((a, b) => a.display_order - b.display_order || a.created_at.localeCompare(b.created_at));
  }

  async getPrize(id: string) {
    const d = await this.read();
    return d.prizes.find((p) => p.id === id) ?? null;
  }

  addPrize(input: PrizeInput) {
    return this.mutate((d) => {
      const now = new Date().toISOString();
      const prize: Prize = { id: randomUUID(), winner_participant_id: null, created_at: now, updated_at: now, ...input };
      d.prizes.push(prize);
      return prize;
    });
  }

  async updatePrize(id: string, patch: PrizePatch) {
    await this.mutate((d) => {
      const prize = d.prizes.find((p) => p.id === id);
      if (!prize) return;
      const winner = patch.winner_participant_id;
      if (winner && d.prizes.some((p) => p.id !== id && p.winner_participant_id === winner)) {
        throw new ConflictError({ winner_participant_id: CONFLICT_MESSAGES.winner_participant_id });
      }
      Object.assign(prize, patch, { updated_at: new Date().toISOString() });
    });
  }

  async deletePrize(id: string) {
    await this.mutate((d) => {
      d.prizes = d.prizes.filter((p) => p.id !== id);
    });
  }

  async listRestaurants() {
    const d = await this.read();
    return [...d.restaurants].sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }

  addRestaurant(name: string, city: string | null) {
    return this.mutate((d) => {
      if (d.restaurants.some((r) => r.name === name)) throw new Error("Ce restaurant existe déjà");
      const r: Restaurant = { id: randomUUID(), name, city, created_at: new Date().toISOString() };
      d.restaurants.push(r);
      return r;
    });
  }

  async deleteRestaurant(id: string) {
    await this.mutate((d) => {
      d.restaurants = d.restaurants.filter((r) => r.id !== id);
    });
  }

  async listDecorations() {
    const d = await this.read();
    return [...d.decorations].sort(
      (a, b) => a.display_order - b.display_order || a.created_at.localeCompare(b.created_at),
    );
  }

  async getDecoration(id: string) {
    const d = await this.read();
    return d.decorations.find((x) => x.id === id) ?? null;
  }

  addDecoration(input: Pick<Decoration, "restaurant_name" | "image_url" | "display_order">) {
    return this.mutate((d) => {
      const deco: Decoration = { id: randomUUID(), created_at: new Date().toISOString(), ...input };
      d.decorations.push(deco);
      return deco;
    });
  }

  async updateDecoration(id: string, patch: Partial<Pick<Decoration, "restaurant_name" | "display_order">>) {
    await this.mutate((d) => {
      const deco = d.decorations.find((x) => x.id === id);
      if (deco) Object.assign(deco, patch);
    });
  }

  async deleteDecoration(id: string) {
    await this.mutate((d) => {
      d.decorations = d.decorations.filter((x) => x.id !== id);
      for (const r of d.responses) if (r.selected_decoration_id === id) r.selected_decoration_id = null;
    });
  }

  async countVotes(decorationId: string) {
    const d = await this.read();
    return d.responses.filter((r) => r.selected_decoration_id === decorationId).length;
  }

  async moveVotes(fromId: string, toId: string) {
    await this.mutate((d) => {
      for (const r of d.responses) if (r.selected_decoration_id === fromId) r.selected_decoration_id = toId;
    });
  }

  async createUploadTarget() {
    return null;
  }

  async saveFile(file: Blob, name: string) {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    await fs.writeFile(path.join(UPLOAD_DIR, name), Buffer.from(await file.arrayBuffer()));
    return `/uploads/${name}`;
  }

  isOwnFile(url: string) {
    return url.startsWith("/uploads/") && FILE_NAME_RE.test(url.slice("/uploads/".length));
  }

  async removeFiles(urls: string[]) {
    for (const u of urls.filter((x) => this.isOwnFile(x))) {
      await fs.rm(path.join(UPLOAD_DIR, u.slice("/uploads/".length)), { force: true });
    }
  }
}

/** Noms de fichiers générés par le serveur : « <uuid>.<ext> » ou « <uuid>.poster.jpg ». */
export const FILE_NAME_RE = /^[0-9a-f-]{36}(\.poster)?\.[a-z0-9]{2,4}$/;

// ---------------------------------------------------------------------------

let store: Store | undefined;

export function getStore(): Store {
  if (store) return store;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    store = new SupabaseStore(
      createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }),
      process.env.SUPABASE_STORAGE_BUCKET || "decorations",
    );
  } else {
    if (process.env.VERCEL) {
      throw new Error("Supabase n'est pas configuré (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).");
    }
    store = new LocalStore();
  }
  return store;
}

export function requestMeta(req: Request, ip: string | null): Meta {
  return { ip, userAgent: req.headers.get("user-agent")?.slice(0, 500) ?? null };
}
