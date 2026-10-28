import "server-only";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { isIP } from "node:net";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { parisDay } from "./day";
import { isUuid } from "./http";
import { afterCursor, compareKeys, encodeCursor, escapeLike, searchKind, type Cursor, type Page } from "./paging";
import type { GraphChange } from "./fraud-graph";
import { isCookieRefusal, isCounted, provesFraud, pseudoKey, type AdminAction, type AdminSession, type Decoration, type DeviceInfo, type LoginFailure, type Participant, type ParticipantInput, type Prize, type Restaurant, type ResponsePatch, type ResponseRow, type Visit } from "./schema";
import { isDuplicateVisit, visitorKey } from "./visits";
import type { Click } from "./clicks";

export type Meta = { ip: string | null; userAgent: string | null };
export type UpdateResult = "ok" | "completed";
/**
 * « already_voted_today » : cet appareil a déjà une réponse validée ce jour-là. « strong_conflict » :
 * une validation parallèle de la même clé forte a déjà un vote compté (index unique) ; rien n'est écrit.
 */
export type CompleteResult = UpdateResult | "already_voted_today" | "strong_conflict";
export type ListFilter = { completedOnly?: boolean; from?: string; to?: string; day?: string; participantId?: string };
/** Empreinte (HMAC) et attributs grossiers de l'appareil, enregistrés sur la réponse. */
export type DeviceStamp = { device_hash: string | null; device_info: DeviceInfo | null };
/** Signaux anti-fraude enregistrés sur une ligne (ouverture, validation, refus) : HMAC et valeurs déduites de l'IP. */
export type FraudStamp = Partial<
  Pick<ResponseRow, "hw_key" | "hw_entropy" | "private_mode" | "storage_key" | "seen_storage" | "ip_net" | "ip_class" | "ip_country" | "ip_timezone" | "ip_city" | "ip_latitude" | "ip_longitude">
>;
/**
 * Appareil, jour (Europe/Paris), score de risque et décision enregistrés à la validation du vote.
 * `blocked` : refus visible, la ligne garde `completed_at` null et reçoit `blocked_at`. `held` : vote
 * enregistré (`completed_at`) mais en attente (`held_at`), jamais compté sans décision humaine.
 */
export type VoteStamp = {
  voterId: string | null;
  voteDay: string;
  device: DeviceStamp;
  fraud: FraudStamp;
  riskScore: number;
  riskFlags: string[];
  outcome: "counted" | "held" | "blocked";
  priority: boolean;
  reasons: string[];
  observed: "held" | "blocked" | null;
};
/**
 * Refus visible : une trace, listée dans « Votes frauduleux ». `stage` : ouverture (défaut) ou validation
 * (nouvelle ligne, la session refusée reste telle quelle).
 */
export type RefusalInput = { sessionId: string; meta: Meta; voterId: string | null; voteDay: string; device: DeviceStamp; fraud: FraudStamp; reasons: string[]; stage?: "create" | "complete" };
/**
 * Plafonds de traces de refus par jour, par clé matérielle forte et par IP : au-delà, plus aucune trace
 * n'est écrite (un script qui insiste ne remplit pas la base ; le refus, lui, reste identique). Les refus
 * par le cookie ne comptent pas dans le plafond par IP (un Wi-Fi partagé où chacun rouvre son onglet).
 */
export const REFUSAL_TRACES_MAX = { hw: 50, ip: 200 } as const;
/** Clés qui relient une requête aux tentatives du jour (cookie, clé hw, jetons du stockage). */
export type AttemptKeys = { voterId: string | null; hwKey: string | null; storageKeys: string[] };
/** Décision d'un admin sur des votes : faire compter (double validation) ou exclure. */
export type HumanAction = "validate" | "invalidate";
export type HumanResult = { done: string[]; refused: { id: string; reason: "incomplete" | "conflict" | "missing" }[] };
/** `completed` = votes comptés (validés, ni en attente ni exclus) ; `held` = en attente de vérification. */
export type ResponseStatus = "completed" | "held" | "incomplete" | "blocked" | "excluded" | "all";
/** Filtre des listes paginées de réponses ; `flaggedFrom` : score ≥ seuil ou bloquée ; `q` : IP ou début d'empreinte. */
export type ResponseFilter = { status: ResponseStatus; raffle?: boolean; flaggedFrom?: number; q?: string };
export type ParticipantSort = "pseudo" | "email" | "date";
/** `deleted` : participants supprimés (suppression douce) au lieu des actifs. */
export type ParticipantFilter = { q?: string; sort: ParticipantSort; dir: "asc" | "desc"; deleted?: boolean };
export type VisitInput = Omit<Visit, "id" | "created_at">;
export type ClickInput = Omit<Click, "id" | "created_at">;
export type VisitStatus = "counted" | "rejected" | "all";
export type PageQuery = { limit: number; cursor: Cursor | null };
/** `votes` : votes comptés, un par jour au plus ; `groups` : groupes confirmés du moteur reliés à ce participant. */
export type ParticipantWithVotes = Participant & { votes: number; groups: string[] };
/** Choix du tirage ; `participant_id` absent = inchangé. */
export type RaffleLink = { wants_raffle: boolean; participant_id?: string | null };
export type PrizeInput = Pick<Prize, "name" | "description" | "image_url" | "display_order">;
export type PrizePatch = Partial<Pick<Prize, "name" | "description" | "image_url" | "display_order" | "winner_participant_id">>;
export type AdminSessionInput = Omit<AdminSession, "id" | "created_at" | "last_seen_at" | "revoked_at">;
/** Conservation (jours), mêmes valeurs que supabase/purge.sql : au-delà, `purge()` efface ou supprime. */
export const RETENTION_DAYS = { responses: 30, visits: 90, clicks: 90, admin_sessions: 180, login_failures: 30 } as const;
/** Résumé des visites : fenêtre de rétention (90 jours) et nombre de lignes relues borné. */
const VISITS_MAX = 50_000;
const visitsSince = () => new Date(Date.now() - RETENTION_DAYS.visits * 86_400_000).toISOString();
const clicksSince = () => new Date(Date.now() - RETENTION_DAYS.clicks * 86_400_000).toISOString();
export type AdminActionInput = Pick<AdminAction, "session_id" | "method" | "path" | "action" | "details">;

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
  restaurant: "Ce restaurant existe déjà",
} as const;

/** Les trois coordonnées de `input` désignent ce participant. */
const sameParticipant = (p: Participant, input: ParticipantInput) =>
  p.pseudo_key === input.pseudo_key && p.email === input.email && p.phone_number === input.phone_number;

type Matching = { pseudo: Participant | null; email: Participant | null; phone_number: Participant | null };
/** Parmi les participants actifs trouvés par pseudo / email / téléphone, celui qui porte les trois (même personne). */
const samePerson = (found: Matching) => (found.email && found.email.id === found.phone_number?.id && found.email.id === found.pseudo?.id ? found.email : null);
/** Message par champ déjà pris par un participant actif. */
function conflictFields(found: Matching) {
  const fields: Record<string, string> = {};
  for (const k of ["pseudo", "email", "phone_number"] as const) if (found[k]) fields[k] = CONFLICT_MESSAGES[k];
  return fields;
}
type Coordinates = Pick<ParticipantInput, "pseudo_key" | "email" | "phone_number">;

export interface Store {
  readonly kind: "supabase" | "local";
  createResponse(sessionId: string, meta: Meta, voterId: string | null, device: DeviceStamp, fraud?: FraudStamp): Promise<UpdateResult>;
  /** Auto-save ; « missing » si la session n'a jamais été ouverte (plus aucune ligne créée ici). */
  updateResponse(sessionId: string, patch: ResponsePatch): Promise<UpdateResult | "missing">;
  /** Valide le vote d'une session ouverte ; refuse si l'appareil a déjà voté ce jour-là (index unique côté base). */
  completeResponse(sessionId: string, data: ResponsePatch, vote: VoteStamp): Promise<CompleteResult>;
  /** Choix du tirage au sort : modifiable même après validation du vote. */
  updateRaffle(sessionId: string, link: RaffleLink): Promise<void>;
  getResponse(idOrSessionId: string): Promise<ResponseRow | null>;
  deleteResponse(id: string): Promise<void>;
  listResponses(filter?: ListFilter): Promise<ResponseRow[]>;
  /** Page de réponses (les plus récentes d'abord), filtre appliqué côté stockage, total filtré. */
  pageResponses(filter: ResponseFilter, page: PageQuery): Promise<Page<ResponseRow>>;
  countResponses(filter: ResponseFilter): Promise<number>;
  /** Vrai si cet appareil (cookie) a une tentative validée ce jour-là (comptée, en attente ou exclue). */
  hasVotedToday(voterId: string, day: string): Promise<boolean>;
  /** Votes validés ce jour-là depuis cette IP (plafond `ip_daily_max`) ; IP inconnue : votes sans IP, comptés ensemble. */
  ipVotesToday(ip: string | null, day: string): Promise<number>;
  /** Tentatives validées du jour reliées à la requête par le cookie, la clé hw ou un jeton du stockage. */
  relatedAttempts(day: string, keys: AttemptKeys): Promise<ResponseRow[]>;
  /**
   * Récidive (H7) : cette clé hw appartenait, un jour précédent, à un groupe confirmé qui contenait une
   * vraie fraude (exclusion, ou refus pour une autre raison que le cookie : schema.ts, `provesFraud`).
   */
  hwConfirmedBefore(hwKey: string, day: string): Promise<boolean>;
  /** Vrai si l'un de ces groupes confirmés contient une vraie fraude (même définition). */
  fraudInGroups(groupIds: string[]): Promise<boolean>;
  /**
   * Trace d'un refus, dédoublonnée (une par minute, par cookie et par étape) et plafonnée par jour
   * (REFUSAL_TRACES_MAX par clé forte, et par IP hors refus par le cookie) ; le limiteur de débit (100 requêtes par minute et par
   * IP) borne le reste : un script ne remplit pas la base.
   */
  recordRefusal(r: RefusalInput): Promise<void>;
  /** Toutes les tentatives d'un jour : validées (comptées, en attente, exclues) et bloquées. */
  dayAttempts(day: string): Promise<ResponseRow[]>;
  /**
   * Écritures du moteur de groupes : exclusion automatique, levée (Recalculer) et identifiant de groupe,
   * jamais sur une décision humaine. Non transactionnel mais idempotent : chaque écriture fixe un état
   * cible, et le passage suivant recalcule les écarts depuis la base, ce qui répare un échec partiel.
   */
  applyGraphChanges(changes: GraphChange[]): Promise<void>;
  /** Décision d'un admin (le moteur ne touchera plus ces lignes). */
  decideResponses(ids: string[], action: HumanAction): Promise<HumanResult>;
  /** Met en attente un vote compté (récidive d'un participant, H7), jamais une décision humaine. */
  holdResponse(id: string, reasons: string[]): Promise<void>;
  /** Lignes à revoir : bloquées, en attente ou exclues automatiquement (onglet Sécurité, 5 000 au plus). */
  listReviewRows(): Promise<ResponseRow[]>;
  /** Réglages (table `settings`, valeur JSON) : null si absent. */
  getSetting(key: string): Promise<unknown>;
  setSetting(key: string, value: unknown): Promise<void>;

  /**
   * Inscrit la réponse au tirage : au plus UNE inscription par réponse. Réponse déjà inscrite :
   * idempotent avec les mêmes coordonnées (`alreadyRegistered`), refus (ConflictError « raffle »)
   * avec d'autres. Si les trois coordonnées désignent un participant existant (même personne qui
   * revote), la réponse lui est reliée (`alreadyRegistered`). Si une partie seulement entre en
   * conflit, lève ConflictError avec le détail par champ. Jamais de participant orphelin.
   */
  registerParticipant(sessionId: string, input: ParticipantInput): Promise<{ participant: Participant; alreadyRegistered: boolean }>;
  /** Participants actifs (ou, avec `deleted`, les supprimés), les plus récents d'abord. */
  listParticipants(deleted?: boolean): Promise<Participant[]>;
  /** Page de participants : recherche (pseudo, email, téléphone) et tri côté stockage, nombre de votes validés par personne. */
  pageParticipants(filter: ParticipantFilter, page: PageQuery): Promise<Page<ParticipantWithVotes>>;
  getParticipant(id: string): Promise<Participant | null>;
  /** Modération du pseudo (unicité vérifiée par la base : ConflictError). */
  updateParticipant(id: string, patch: Pick<Participant, "pseudo" | "pseudo_key">): Promise<void>;
  /** Suppression douce : `deleted_at` posé, lot libéré, votes conservés (la fiche reste consultable). */
  deleteParticipant(id: string): Promise<void>;
  /** Annule la suppression ; ConflictError par champ si un participant actif a pris le pseudo / email / téléphone. */
  restoreParticipant(id: string): Promise<void>;

  /** Compteur de visites : une ligne par beacon ; un même visiteur ne compte qu'une visite par jour et par page. */
  recordVisit(v: VisitInput): Promise<"counted" | "duplicate" | "rejected">;
  pageVisits(status: VisitStatus, page: PageQuery): Promise<Page<Visit>>;
  listVisits(): Promise<Visit[]>;

  /** Clics de partage, d'arrivée par lien partagé et d'abonnement (src/lib/clicks.ts). */
  recordClick(c: ClickInput): Promise<void>;
  /** Clics de la fenêtre de rétention (90 jours), du plus ancien au plus récent. */
  listClicks(): Promise<Click[]>;

  listPrizes(): Promise<Prize[]>;
  getPrize(id: string): Promise<Prize | null>;
  addPrize(p: PrizeInput): Promise<Prize>;
  /** ConflictError si le gagnant a déjà un autre lot. */
  updatePrize(id: string, patch: PrizePatch): Promise<void>;
  deletePrize(id: string): Promise<void>;

  /** Journal du backoffice : sessions (connexions) et actions. */
  createAdminSession(s: AdminSessionInput): Promise<AdminSession>;
  getAdminSession(id: string): Promise<AdminSession | null>;
  /** Révocation (déconnexion, bouton du Journal) : le jeton de cette session n'est plus accepté. */
  revokeAdminSession(id: string): Promise<void>;
  logAdminAction(a: AdminActionInput): Promise<void>;
  listAdminSessions(): Promise<{ sessions: AdminSession[]; actions: AdminAction[] }>;
  /** Échecs de connexion (verrouillage persistant) : enregistrement, décompte depuis `since` (par IP si donnée ; null = sans IP), derniers échecs. */
  recordLoginFailure(ip: string | null): Promise<void>;
  countLoginFailures(since: string, ip?: string | null): Promise<number>;
  listLoginFailures(limit: number): Promise<LoginFailure[]>;
  /** Purge des données expirées (RETENTION_DAYS), idempotente. */
  purge(): Promise<void>;

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
  /** Vrai si ce fichier existe bien dans le stockage (après un envoi direct par URL signée). */
  fileExists(url: string): Promise<boolean>;
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
    return new Error(`Base Supabase pas à jour (${e.message}) : exécutez supabase/reset.sql puis supabase/schema.sql dans Supabase > SQL Editor.`);
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

const PARTICIPANT_SORT_COLUMN = { pseudo: "pseudo_key", email: "email", date: "created_at" } as const;

/** Recherche de réponses (voir `searchKind`) ; "none" = aucune requête, page vide. */
const kindOf = (q: string | undefined) => (q ? searchKind(q, (s) => isIP(s) !== 0) : null);

/**
 * Méthodes de filtre PostgREST utilisées : le même filtre s'applique à la requête de lignes et à celle
 * de comptage (types différents chez supabase-js : l'appelant convertit, voir `filtered`).
 */
interface PgFilter {
  not(column: string, operator: "is", value: null): PgFilter;
  is(column: string, value: null): PgFilter;
  or(filters: string): PgFilter;
  eq(column: string, value: string): PgFilter;
  like(column: string, pattern: string): PgFilter;
}

function applyResponseFilter(query: PgFilter, f: ResponseFilter): PgFilter {
  let q = query;
  if (f.status === "completed") q = q.not("completed_at", "is", null).is("held_at", null).is("excluded_at", null);
  else if (f.status === "held") q = q.not("completed_at", "is", null).not("held_at", "is", null).is("excluded_at", null);
  else if (f.status === "incomplete") q = q.is("completed_at", null).is("blocked_at", null);
  else if (f.status === "blocked") q = q.not("blocked_at", "is", null);
  else if (f.status === "excluded") q = q.not("excluded_at", "is", null);
  if (f.raffle) q = q.not("participant_id", "is", null);
  if (f.flaggedFrom !== undefined) q = q.or(`risk_score.gte.${f.flaggedFrom},blocked_at.not.is.null`);
  if (f.q) q = kindOf(f.q) === "ip" ? q.eq("ip_address", f.q) : q.like("device_hash", `${f.q.toLowerCase()}%`);
  return q;
}

/** Applique le filtre à un constructeur de requête supabase-js et le rend avec son type d'origine. */
const filtered = <Q>(query: Q, f: ResponseFilter): Q => applyResponseFilter(query as unknown as PgFilter, f) as unknown as Q;

/** `limit + 1` lignes lues → page de `limit` lignes, curseur suivant seulement s'il reste quelque chose. */
function slicePage<T extends { id: string }>(rows: T[], limit: number, value: (row: T) => string, total: number): Page<T> {
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  return { rows: page, nextCursor: rows.length > limit && last ? encodeCursor({ value: value(last), id: last.id }) : null, total };
}

/** Pagination en mémoire (stockage local) : tri (valeur, id), curseur, page. */
function pageLocal<T extends { id: string }>(rows: T[], value: (row: T) => string, dir: "asc" | "desc", page: PageQuery): Page<T> {
  const key = (r: T) => ({ value: value(r), id: r.id });
  const sorted = [...rows].sort((a, b) => (dir === "asc" ? 1 : -1) * compareKeys(key(a), key(b)));
  const after = page.cursor ? sorted.filter((r) => afterCursor(key(r), page.cursor!, dir)) : sorted;
  return slicePage(after.slice(0, page.limit + 1), page.limit, value, sorted.length);
}

/** Index unique « une clé forte, un vote compté par jour » (supabase/schema.sql). */
const STRONG_INDEX = "responses_hw_counted_unique";
const HEX64 = /^[0-9a-f]{64}$/;

/** Ce qui est déduit de l'IP, effacé avec elle après 30 jours (supabase/purge.sql). */
const IP_DERIVED_NULL = { ip_net: null, ip_class: null, ip_country: null, ip_timezone: null, ip_city: null, ip_latitude: null, ip_longitude: null };

/** Colonnes de la décision de validation (refus, attente ou vote compté). */
function voteColumns(vote: VoteStamp, now: string) {
  const decision =
    vote.outcome === "blocked" ? { blocked_at: now, block_stage: "complete" as const }
    : vote.outcome === "held" ? { completed_at: now, held_at: now, held_priority: vote.priority }
    : { completed_at: now };
  return { risk_score: vote.riskScore, risk_flags: vote.riskFlags, fraud_reasons: vote.reasons, observed_outcome: vote.observed, ...decision };
}

/** Identifiant de groupe du moteur (« jour:préfixe ») : seule forme acceptée dans un filtre. */
const GROUP_ID = /^[\w:-]{1,40}$/;

/** Ligne de trace d'un refus (ouverture ou validation). */
function refusalRow(r: RefusalInput) {
  const now = new Date().toISOString();
  return {
    session_id: r.sessionId,
    ip_address: r.meta.ip,
    user_agent: r.meta.userAgent,
    voter_id: r.voterId,
    vote_day: r.voteDay,
    ...r.device,
    ...r.fraud,
    blocked_at: now,
    block_stage: r.stage ?? ("create" as const),
    fraud_reasons: r.reasons,
  };
}

/**
 * Colonnes d'une décision humaine. Faire compter : un vote en attente ou exclu redevient compté ; un
 * vote bloqué à la validation devient validé (null si la ligne n'a pas de vote complet, ex. refus à l'ouverture).
 */
function humanPatch(row: ResponseRow, action: HumanAction): Partial<ResponseRow> | null {
  const now = new Date().toISOString();
  if (action === "invalidate") return { excluded_at: row.excluded_at ?? now, exclusion_source: "admin", human_decision: "excluded" };
  if (row.blocked_at) {
    if (!row.selected_decoration_id || !row.selected_restaurant) return null;
    return { completed_at: row.blocked_at, blocked_at: null, held_at: null, excluded_at: null, exclusion_source: null, human_decision: "validated" };
  }
  if (!row.completed_at) return null;
  return { held_at: null, excluded_at: null, exclusion_source: null, human_decision: "validated" };
}

/** Votes comptés par participant, un par jour au plus (règlement : un vote par personne et par jour). */
export function countedVotesByParticipant(rows: Pick<ResponseRow, "participant_id" | "vote_day" | "completed_at" | "held_at" | "excluded_at">[]) {
  const days = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!r.participant_id || !isCounted(r)) continue;
    (days.get(r.participant_id) ?? days.set(r.participant_id, new Set()).get(r.participant_id)!).add(r.vote_day ?? r.completed_at!.slice(0, 10));
  }
  return new Map([...days].map(([id, set]) => [id, set.size]));
}

/** Groupes confirmés (moteur anti-fraude) reliés à chaque participant. */
function groupsByParticipant(rows: Pick<ResponseRow, "participant_id" | "group_id">[]) {
  const out = new Map<string, string[]>();
  for (const r of rows) {
    if (!r.participant_id || !r.group_id) continue;
    const list = out.get(r.participant_id) ?? out.set(r.participant_id, []).get(r.participant_id)!;
    if (!list.includes(r.group_id)) list.push(r.group_id);
  }
  return out;
}

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

  async createResponse(sessionId: string, meta: Meta, voterId: string | null, device: DeviceStamp, fraud: FraudStamp = {}) {
    const res = await this.sb
      .from("responses")
      .upsert(
        { session_id: sessionId, ip_address: meta.ip, user_agent: meta.userAgent, voter_id: voterId, ...device, ...fraud },
        { onConflict: "session_id", ignoreDuplicates: true },
      );
    this.check(res);
    return "ok" as const;
  }

  async updateResponse(sessionId: string, patch: ResponsePatch) {
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
    return existing?.completed_at ? ("completed" as const) : ("missing" as const);
  }

  async completeResponse(sessionId: string, data: ResponsePatch, vote: VoteStamp) {
    // Une seule écriture : les champs du vote, l'appareil, le jour, le score et la décision (refus :
    // blocked_at, completed_at reste null ; attente : completed_at et held_at). Les index uniques partiels
    // refusent un second vote du même cookie le même jour, et un second vote compté de la même clé forte.
    const now = new Date().toISOString();
    const stamp = { voter_id: vote.voterId, vote_day: vote.voteDay, ...vote.device, ...vote.fraud, ...voteColumns(vote, now) };
    const res = await this.sb
      .from("responses")
      .update({ ...data, ...stamp })
      .eq("session_id", sessionId)
      .is("completed_at", null)
      .is("blocked_at", null) // une ligne refusée par le score ne se valide jamais
      .select("id");
    const violated = violatedConstraint(res.error);
    if (violated === STRONG_INDEX) return "strong_conflict" as const;
    if (violated !== null) return "already_voted_today" as const;
    const updated = this.check(res);
    if (updated && updated.length > 0) return "ok" as const;

    const existing = await this.getResponse(sessionId);
    if (existing?.completed_at) return "completed" as const;
    if (existing?.blocked_at) return "already_voted_today" as const;
    throw new Error("Session introuvable"); // la route a vérifié la ligne juste avant : supprimée entre-temps
  }

  async updateRaffle(sessionId: string, link: RaffleLink) {
    this.check(await this.sb.from("responses").update(link).eq("session_id", sessionId));
  }

  async getResponse(idOrSessionId: string) {
    if (!isUuid(idOrSessionId)) return null; // jamais de valeur libre dans le filtre PostgREST
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
      if (filter.day) q = q.eq("vote_day", filter.day);
      if (filter.participantId) q = q.eq("participant_id", filter.participantId);
      const data = this.check(await q.range(offset, offset + page - 1)) as ResponseRow[];
      rows.push(...data);
      if (data.length < page) break;
    }
    return rows;
  }

  async pageResponses(filter: ResponseFilter, page: PageQuery) {
    if (kindOf(filter.q) === "none") return { rows: [], nextCursor: null, total: 0 };
    // Lignes et total filtré (`count`) dans la même réponse PostgREST.
    let q = filtered(this.sb.from("responses").select("*", { count: "exact" }), filter).order("created_at", { ascending: false }).order("id", { ascending: false });
    const c = page.cursor;
    if (c) q = q.or(`created_at.lt."${c.value}",and(created_at.eq."${c.value}",id.lt."${c.id}")`);
    const res = await q.limit(page.limit + 1);
    const rows = this.check(res) as ResponseRow[];
    return slicePage(rows, page.limit, (r) => r.created_at, res.count ?? 0);
  }

  async countResponses(filter: ResponseFilter) {
    if (kindOf(filter.q) === "none") return 0;
    const res = await filtered(this.sb.from("responses").select("id", { count: "exact", head: true }), filter);
    this.check(res);
    return res.count ?? 0;
  }

  async hasVotedToday(voterId: string, day: string) {
    const data = this.check(
      await this.sb.from("responses").select("id").eq("voter_id", voterId).eq("vote_day", day).not("completed_at", "is", null).limit(1),
    );
    return (data?.length ?? 0) > 0;
  }

  async ipVotesToday(ip: string | null, day: string) {
    const base = this.sb.from("responses").select("id", { count: "exact", head: true }).eq("vote_day", day).not("completed_at", "is", null);
    // IP inconnue (en-tête absent ou mal formé) : les votes sans IP comptent ensemble, brouiller son IP ne rapporte rien.
    const res = await (ip ? base.eq("ip_address", ip) : base.is("ip_address", null));
    this.check(res);
    return res.count ?? 0;
  }

  async relatedAttempts(day: string, keys: AttemptKeys) {
    // Valeurs sûres dans le filtre PostgREST : uuid (cookie lu par readVoter) et HMAC hexadécimaux.
    const or = [
      keys.voterId && isUuid(keys.voterId) && `voter_id.eq.${keys.voterId}`,
      keys.hwKey && HEX64.test(keys.hwKey) && `hw_key.eq.${keys.hwKey}`,
      keys.storageKeys.filter((k) => HEX64.test(k)).length && `storage_key.in.(${keys.storageKeys.filter((k) => HEX64.test(k)).join(",")})`,
    ].filter(Boolean);
    if (!or.length) return [];
    return this.check(await this.sb.from("responses").select("*").eq("vote_day", day).not("completed_at", "is", null).or(or.join(",")).limit(500)) as ResponseRow[];
  }

  async hwConfirmedBefore(hwKey: string, day: string) {
    if (!HEX64.test(hwKey)) return false;
    const data = this.check(await this.sb.from("responses").select("group_id").eq("hw_key", hwKey).lt("vote_day", day).not("group_id", "is", null).limit(200)) as { group_id: string }[];
    return this.fraudInGroups([...new Set((data ?? []).map((r) => r.group_id))]);
  }

  async fraudInGroups(groupIds: string[]) {
    const ids = groupIds.filter((id) => GROUP_ID.test(id));
    if (!ids.length) return false;
    const data = this.check(
      await this.sb.from("responses").select("blocked_at,excluded_at,fraud_reasons").in("group_id", ids).or("excluded_at.not.is.null,blocked_at.not.is.null").limit(1000),
    ) as Pick<ResponseRow, "blocked_at" | "excluded_at" | "fraud_reasons">[];
    return (data ?? []).some(provesFraud);
  }

  async recordRefusal(r: RefusalInput) {
    const stage = r.stage ?? "create";
    const since = new Date(Date.now() - 60_000).toISOString();
    const traces = () => this.sb.from("responses").select("id", { count: "exact", head: true }).eq("vote_day", r.voteDay).not("blocked_at", "is", null);
    const strong = r.fraud.hw_entropy === "strong" && r.fraud.hw_key && HEX64.test(r.fraud.hw_key) ? r.fraud.hw_key : null;
    const [dup, byHw, byIp] = await Promise.all([
      r.voterId && isUuid(r.voterId) ? this.sb.from("responses").select("id").eq("vote_day", r.voteDay).eq("block_stage", stage).gte("created_at", since).eq("voter_id", r.voterId).limit(1) : null,
      strong ? traces().eq("hw_key", strong) : null,
      r.meta.ip ? traces().eq("ip_address", r.meta.ip).not("fraud_reasons", "cs", JSON.stringify(["cookie"])) : null,
    ]);
    if (dup && this.check(dup)?.length) return;
    for (const [res, max] of [[byHw, REFUSAL_TRACES_MAX.hw], [byIp, REFUSAL_TRACES_MAX.ip]] as const) {
      if (!res) continue;
      this.check(res);
      if ((res.count ?? 0) >= max) return;
    }
    this.check(await this.sb.from("responses").upsert(refusalRow(r), { onConflict: "session_id", ignoreDuplicates: true }));
  }

  async dayAttempts(day: string) {
    const rows: ResponseRow[] = [];
    const page = 1000;
    for (let offset = 0; ; offset += page) {
      const data = this.check(
        await this.sb.from("responses").select("*").eq("vote_day", day).or("completed_at.not.is.null,blocked_at.not.is.null").order("created_at", { ascending: true }).range(offset, offset + page - 1),
      ) as ResponseRow[];
      rows.push(...data);
      if (data.length < page) break;
    }
    return rows;
  }

  async applyGraphChanges(changes: GraphChange[]) {
    const now = new Date().toISOString();
    for (const c of changes) {
      const patch = c.exclude ? { group_id: c.groupId, excluded_at: now, exclusion_source: "auto" } : c.restore ? { group_id: c.groupId, excluded_at: null, exclusion_source: null } : { group_id: c.groupId };
      let q = this.sb.from("responses").update(patch).eq("id", c.id).is("human_decision", null);
      if (c.exclude) q = q.is("excluded_at", null);
      if (c.restore) q = q.eq("exclusion_source", "auto"); // seule une exclusion du moteur se lève
      this.check(await q);
    }
  }

  async listReviewRows() {
    const rows: ResponseRow[] = [];
    const page = 1000;
    for (let offset = 0; offset < 5000; offset += page) {
      const data = this.check(
        await this.sb.from("responses").select("*").or("blocked_at.not.is.null,held_at.not.is.null,exclusion_source.eq.auto").order("created_at", { ascending: false }).range(offset, offset + page - 1),
      ) as ResponseRow[];
      rows.push(...data);
      if (data.length < page) break;
    }
    return rows;
  }

  async holdResponse(id: string, reasons: string[]) {
    this.check(
      await this.sb.from("responses").update({ held_at: new Date().toISOString(), fraud_reasons: reasons }).eq("id", id).not("completed_at", "is", null).is("held_at", null).is("excluded_at", null).is("human_decision", null),
    );
  }

  async decideResponses(ids: string[], action: HumanAction): Promise<HumanResult> {
    const out: HumanResult = { done: [], refused: [] };
    for (const id of ids) {
      const row = await this.getResponse(id);
      if (!row) {
        out.refused.push({ id, reason: "missing" });
        continue;
      }
      const patch = humanPatch(row, action);
      if (!patch) {
        out.refused.push({ id, reason: "incomplete" });
        continue;
      }
      const res = await this.sb.from("responses").update(patch).eq("id", row.id);
      if (violatedConstraint(res.error) !== null) out.refused.push({ id, reason: "conflict" });
      else {
        this.check(res);
        out.done.push(id);
      }
    }
    return out;
  }

  async getSetting(key: string) {
    const data = this.check(await this.sb.from("settings").select("value").eq("key", key).limit(1)) as { value: unknown }[] | null;
    return data?.[0]?.value ?? null;
  }

  async setSetting(key: string, value: unknown) {
    this.check(await this.sb.from("settings").upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" }));
  }

  /** Participants actifs qui partagent au moins une coordonnée avec `input`. */
  private async matching(input: Coordinates): Promise<Matching> {
    const by = (col: string, value: string) => this.sb.from("participants").select("*").eq(col, value).is("deleted_at", null).limit(1);
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
      const fields = conflictFields(again);
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

  async listParticipants(deleted = false) {
    const rows: Participant[] = [];
    const page = 1000;
    for (let offset = 0; ; offset += page) {
      const q = this.sb.from("participants").select("*").order("created_at", { ascending: false }).range(offset, offset + page - 1);
      const data = this.check(await (deleted ? q.not("deleted_at", "is", null) : q.is("deleted_at", null))) as Participant[];
      rows.push(...data);
      if (data.length < page) break;
    }
    return rows;
  }

  async pageParticipants(filter: ParticipantFilter, page: PageQuery) {
    const col = PARTICIPANT_SORT_COLUMN[filter.sort];
    const asc = filter.dir === "asc";
    let q = this.sb.from("participants").select("*", { count: "exact" }).order(col, { ascending: asc }).order("id", { ascending: asc });
    q = filter.deleted ? q.not("deleted_at", "is", null) : q.is("deleted_at", null);
    if (filter.q) {
      const term = `*${escapeLike(pseudoKey(filter.q))}*`;
      q = q.or(`pseudo_key.ilike.${term},email.ilike.${term},phone_number.ilike.${term}`);
    }
    const c = page.cursor;
    if (c) {
      const op = asc ? "gt" : "lt";
      // Départage par id : created_at n'est pas unique, et les supprimés peuvent partager un pseudo ou un email.
      q = q.or(`${col}.${op}."${c.value}",and(${col}.eq."${c.value}",id.${op}."${c.id}")`);
    }
    const res = await q.limit(page.limit + 1);
    const rows = this.check(res) as Participant[];
    const out = slicePage(rows, page.limit, (p) => String(p[col]), res.count ?? 0);
    // Votes validés par personne, pour la page affichée seulement.
    // shortcut: au plus 1000 lignes de votes lues (≥ 10 votes pour chacun des 100 participants), à paginer si le concours dure des mois.
    const ids = out.rows.map((p) => p.id);
    let votes = new Map<string, number>();
    let groups = new Map<string, string[]>();
    if (ids.length) {
      const linked = this.check(
        await this.sb.from("responses").select("participant_id, vote_day, completed_at, held_at, excluded_at, group_id").in("participant_id", ids).not("completed_at", "is", null),
      ) as Pick<ResponseRow, "participant_id" | "vote_day" | "completed_at" | "held_at" | "excluded_at" | "group_id">[];
      votes = countedVotesByParticipant(linked);
      groups = groupsByParticipant(linked);
    }
    return { ...out, rows: out.rows.map((p) => ({ ...p, votes: votes.get(p.id) ?? 0, groups: groups.get(p.id) ?? [] })) };
  }

  async updateParticipant(id: string, patch: Pick<Participant, "pseudo" | "pseudo_key">) {
    const res = await this.sb.from("participants").update(patch).eq("id", id);
    this.conflict(res.error);
  }

  async getParticipant(id: string) {
    const data = this.check(await this.sb.from("participants").select("*").eq("id", id).limit(1));
    return (data?.[0] as Participant | undefined) ?? null;
  }

  async deleteParticipant(id: string) {
    this.check(await this.sb.from("participants").update({ deleted_at: new Date().toISOString() }).eq("id", id).is("deleted_at", null));
    this.check(await this.sb.from("prizes").update({ winner_participant_id: null }).eq("winner_participant_id", id));
  }

  async restoreParticipant(id: string) {
    const p = await this.getParticipant(id);
    if (!p) return;
    // L'index unique partiel (actifs seulement) tranche ; en cas de refus, on relit pour renvoyer tous les champs en conflit.
    const res = await this.sb.from("participants").update({ deleted_at: null }).eq("id", id);
    if (violatedConstraint(res.error) !== null) {
      const fields = conflictFields(await this.matching(p));
      if (Object.keys(fields).length) throw new ConflictError(fields);
    }
    this.conflict(res.error);
  }

  async recordVisit(v: VisitInput) {
    const key = visitorKey(v);
    // shortcut: contrôle puis insertion (deux beacons simultanés du même visiteur peuvent compter double), à remplacer par un index unique si le compteur doit être exact.
    if (v.rejected) {
      // Une ligne rejetée par (jour, IP, raison) au plus : les robots ne remplissent pas la table.
      const q = this.sb.from("visits").select("id").eq("day", v.day).eq("rejected", v.rejected);
      const dup = this.check(await (v.ip ? q.eq("ip", v.ip) : q.is("ip", null)).limit(1));
      if (dup?.length) return "duplicate" as const;
    } else if (key) {
      const dup = this.check(await this.sb.from("visits").select("id").eq("day", v.day).eq("path", v.path ?? "").is("rejected", null).eq(v.device_hash ? "device_hash" : "visitor_id", key).limit(1));
      if (dup?.length) return "duplicate" as const;
    }
    this.check(await this.sb.from("visits").insert(v));
    return v.rejected ? ("rejected" as const) : ("counted" as const);
  }

  async pageVisits(status: VisitStatus, page: PageQuery) {
    let q = this.sb.from("visits").select("*", { count: "exact" }).order("created_at", { ascending: false }).order("id", { ascending: false });
    if (status === "counted") q = q.is("rejected", null);
    else if (status === "rejected") q = q.not("rejected", "is", null);
    const c = page.cursor;
    if (c) q = q.or(`created_at.lt."${c.value}",and(created_at.eq."${c.value}",id.lt."${c.id}")`);
    const res = await q.limit(page.limit + 1);
    return slicePage(this.check(res) as Visit[], page.limit, (r) => r.created_at, res.count ?? 0);
  }

  async listVisits() {
    // shortcut: les visites de la fenêtre de rétention (90 jours, au plus VISITS_MAX) sont relues à chaque résumé (1000 par requête) ; à agréger en base si le site dépasse quelques dizaines de milliers de visites.
    const rows: Visit[] = [];
    const page = 1000;
    for (let offset = 0; offset < VISITS_MAX; offset += page) {
      const data = this.check(await this.sb.from("visits").select("*").gte("created_at", visitsSince()).order("created_at", { ascending: true }).range(offset, offset + page - 1)) as Visit[];
      rows.push(...data);
      if (data.length < page) break;
    }
    return rows;
  }

  async recordClick(c: ClickInput) {
    this.check(await this.sb.from("clicks").insert(c));
  }

  async listClicks() {
    const rows: Click[] = [];
    const page = 1000;
    for (let offset = 0; offset < VISITS_MAX; offset += page) {
      const data = this.check(await this.sb.from("clicks").select("*").gte("created_at", clicksSince()).order("created_at", { ascending: true }).range(offset, offset + page - 1)) as Click[];
      rows.push(...data);
      if (data.length < page) break;
    }
    return rows;
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

  async createAdminSession(s: AdminSessionInput) {
    return this.check(await this.sb.from("admin_sessions").insert(s).select("*").single()) as AdminSession;
  }

  async getAdminSession(id: string) {
    const data = this.check(await this.sb.from("admin_sessions").select("*").eq("id", id).limit(1));
    return (data?.[0] as AdminSession | undefined) ?? null;
  }

  async revokeAdminSession(id: string) {
    this.check(await this.sb.from("admin_sessions").update({ revoked_at: new Date().toISOString() }).eq("id", id).is("revoked_at", null));
  }

  async recordLoginFailure(ip: string | null) {
    this.check(await this.sb.from("login_failures").insert({ ip }));
  }

  async countLoginFailures(since: string, ip?: string | null) {
    let q = this.sb.from("login_failures").select("id", { count: "exact", head: true }).gte("created_at", since);
    if (ip !== undefined) q = ip === null ? q.is("ip", null) : q.eq("ip", ip);
    const res = await q;
    this.check(res);
    return res.count ?? 0;
  }

  async listLoginFailures(limit: number) {
    return this.check(await this.sb.from("login_failures").select("*").order("created_at", { ascending: false }).limit(limit)) as LoginFailure[];
  }

  async purge() {
    const before = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
    // Seules les lignes qui ont encore quelque chose à effacer (le trigger updated_at ne touche pas les autres).
    this.check(
      await this.sb
        .from("responses")
        .update({ ip_address: null, user_agent: null, device_info: null, ...IP_DERIVED_NULL })
        .lt("created_at", before(RETENTION_DAYS.responses))
        .or("ip_address.not.is.null,user_agent.not.is.null,device_info.not.is.null,ip_net.not.is.null,ip_class.not.is.null,ip_country.not.is.null,ip_timezone.not.is.null,ip_city.not.is.null,ip_latitude.not.is.null,ip_longitude.not.is.null"),
    );
    this.check(await this.sb.from("visits").delete().lt("created_at", before(RETENTION_DAYS.visits)));
    this.check(await this.sb.from("clicks").delete().lt("created_at", before(RETENTION_DAYS.clicks)));
    this.check(await this.sb.from("admin_sessions").delete().lt("created_at", before(RETENTION_DAYS.admin_sessions))); // actions en cascade
    this.check(await this.sb.from("login_failures").delete().lt("created_at", before(RETENTION_DAYS.login_failures)));
  }

  async logAdminAction(a: AdminActionInput) {
    this.check(await this.sb.from("admin_actions").insert(a));
    this.check(await this.sb.from("admin_sessions").update({ last_seen_at: new Date().toISOString() }).eq("id", a.session_id));
  }

  async listAdminSessions() {
    const sessions = this.check(await this.sb.from("admin_sessions").select("*").order("created_at", { ascending: false }).limit(300)) as AdminSession[];
    const actions = this.check(await this.sb.from("admin_actions").select("*").order("created_at", { ascending: false }).limit(5000)) as AdminAction[];
    return { sessions, actions };
  }

  async listRestaurants() {
    return this.check(await this.sb.from("restaurants").select("*").order("name")) as Restaurant[];
  }

  async addRestaurant(name: string, city: string | null) {
    const res = await this.sb.from("restaurants").insert({ name, city }).select("*").single();
    if (violatedConstraint(res.error) !== null) throw new ConflictError({ name: CONFLICT_MESSAGES.restaurant });
    return this.check(res) as Restaurant;
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

  async fileExists(url: string) {
    const key = this.keyOf(url);
    if (key === null) return false;
    const { data, error } = await this.sb.storage.from(this.bucket).list("", { search: key, limit: 1 });
    if (error) throw new Error(error.message);
    return data.some((o) => o.name === key);
  }

  async removeFiles(urls: string[]) {
    const keys = urls.map((u) => this.keyOf(u)).filter((k): k is string => k !== null);
    if (keys.length === 0) return;
    const { error } = await this.sb.storage.from(this.bucket).remove(keys);
    if (error) console.error("Suppression de fichiers impossible :", error.message);
  }
}

// ---------------------------------------------------------------------------
// Stockage local JSON, développement uniquement (système de fichiers en
// lecture seule sur Vercel).
// ---------------------------------------------------------------------------

export type LocalData = {
  responses: ResponseRow[];
  restaurants: Restaurant[];
  decorations: Decoration[];
  participants: Participant[];
  prizes: Prize[];
  admin_sessions: AdminSession[];
  admin_actions: AdminAction[];
  settings: Record<string, unknown>;
  visits: Visit[];
  clicks: Click[];
  login_failures: LoginFailure[];
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
    admin_sessions: [],
    admin_actions: [],
    settings: {},
    visits: [],
    clicks: [],
    login_failures: [],
  };
}

/**
 * Met à niveau un fichier écrit par une version précédente : nouvelles tables, nouvelles colonnes
 * de `responses` (jour du vote déduit de la validation). Appliquée en mémoire à chaque lecture ;
 * le fichier est réécrit à la première modification. Vrai si quelque chose a changé.
 */
export function migrateLocal(d: LocalData): boolean {
  let changed = false;
  if (!d.participants) {
    d.participants = [];
    changed = true;
  }
  if (!d.prizes) {
    d.prizes = [];
    changed = true;
  }
  if (!d.admin_sessions) {
    d.admin_sessions = [];
    d.admin_actions = [];
    changed = true;
  }
  if (!d.settings) {
    d.settings = {};
    changed = true;
  }
  if (!d.visits) {
    d.visits = [];
    changed = true;
  }
  if (!d.login_failures) {
    d.login_failures = [];
    changed = true;
  }
  if (!d.clicks) {
    d.clicks = [];
    changed = true;
  }
  for (const p of d.participants) {
    if (p.deleted_at === undefined) {
      p.deleted_at = null;
      changed = true;
    }
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
    // Anti-fraude : colonnes absentes des fichiers antérieurs.
    if (r.risk_score === undefined) {
      Object.assign(r, { device_hash: null, device_info: null, risk_score: 0, risk_flags: null, blocked_at: null, excluded_at: null });
      changed = true;
    }
    // Exclusions antérieures à la migration du 2026-10-28 : faites à la main (les autres colonnes manquantes se lisent null).
    if (r.excluded_at && r.exclusion_source === undefined) {
      Object.assign(r, { exclusion_source: "admin", human_decision: "excluded" });
      changed = true;
    }
  }
  return changed;
}

/** Purge locale (mêmes règles que `SupabaseStore.purge` et supabase/purge.sql), à l'instant `now` (ms). */
export function purgeLocal(d: LocalData, now: number) {
  const before = (days: number) => new Date(now - days * 86_400_000).toISOString();
  for (const r of d.responses) if (r.created_at < before(RETENTION_DAYS.responses)) Object.assign(r, { ip_address: null, user_agent: null, device_info: null, ...IP_DERIVED_NULL });
  d.visits = d.visits.filter((v) => v.created_at >= before(RETENTION_DAYS.visits));
  d.clicks = d.clicks.filter((c) => c.created_at >= before(RETENTION_DAYS.clicks));
  const expired = new Set(d.admin_sessions.filter((s) => s.created_at < before(RETENTION_DAYS.admin_sessions)).map((s) => s.id));
  d.admin_sessions = d.admin_sessions.filter((s) => !expired.has(s.id));
  d.admin_actions = d.admin_actions.filter((a) => !expired.has(a.session_id));
  d.login_failures = d.login_failures.filter((f) => f.created_at >= before(RETENTION_DAYS.login_failures));
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

  private blank(sessionId: string, meta: Meta, voterId: string | null, device: DeviceStamp): ResponseRow {
    const now = new Date().toISOString();
    return {
      id: randomUUID(),
      session_id: sessionId,
      selected_restaurant: null,
      selected_decoration_id: null,
      comment: null,
      wants_raffle: null,
      participant_id: null,
      voter_id: voterId,
      vote_day: null,
      completed_at: null,
      created_at: now,
      updated_at: now,
      ip_address: meta.ip,
      user_agent: meta.userAgent,
      ...device,
      risk_score: 0,
      risk_flags: null,
      blocked_at: null,
      excluded_at: null,
    };
  }

  createResponse(sessionId: string, meta: Meta, voterId: string | null, device: DeviceStamp, fraud: FraudStamp = {}) {
    return this.mutate((d) => {
      if (!d.responses.some((r) => r.session_id === sessionId)) d.responses.push({ ...this.blank(sessionId, meta, voterId, device), ...fraud });
      return "ok" as const;
    });
  }

  updateResponse(sessionId: string, patch: ResponsePatch) {
    return this.mutate((d) => {
      const row = d.responses.find((r) => r.session_id === sessionId);
      if (!row) return "missing" as const;
      if (row.completed_at) return "completed" as const;
      Object.assign(row, patch, { updated_at: new Date().toISOString() });
      return "ok" as const;
    });
  }

  completeResponse(sessionId: string, data: ResponsePatch, vote: VoteStamp) {
    // Même règle que l'index unique partiel de la base, appliquée dans la file d'écriture (atomique).
    return this.mutate((d) => {
      const row = d.responses.find((r) => r.session_id === sessionId);
      if (row?.completed_at) return "completed" as const;
      if (row?.blocked_at) return "already_voted_today" as const; // refus : définitif pour la session
      if (vote.voterId && vote.outcome !== "blocked" && d.responses.some((r) => r.completed_at && r.voter_id === vote.voterId && r.vote_day === vote.voteDay)) {
        return "already_voted_today" as const;
      }
      if (!row) throw new Error("Session introuvable"); // la route a vérifié la ligne juste avant
      // Même garantie que l'index unique de la clé forte, dans la file d'écriture (atomique).
      const key = vote.fraud.hw_key;
      // Comme l'index : un vote du mode observation (issue évitée notée) n'y est pas soumis.
      if (vote.outcome === "counted" && !vote.observed && key && vote.fraud.hw_entropy === "strong") {
        if (d.responses.some((r) => r !== row && r.hw_key === key && r.hw_entropy === "strong" && r.vote_day === vote.voteDay && isCounted(r) && !r.human_decision && !r.observed_outcome)) return "strong_conflict" as const;
      }
      const now = new Date().toISOString();
      Object.assign(row, data, { voter_id: vote.voterId, vote_day: vote.voteDay, ...vote.device, ...vote.fraud, ...voteColumns(vote, now), updated_at: now });
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
    if (!isUuid(idOrSessionId)) return null;
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
        (!filter.to || r.created_at <= filter.to) &&
        (!filter.day || r.vote_day === filter.day) &&
        (!filter.participantId || r.participant_id === filter.participantId),
    );
  }

  private matchesFilter(r: ResponseRow, f: ResponseFilter) {
    const status =
      f.status === "completed" ? isCounted(r)
      : f.status === "held" ? !!r.completed_at && !!r.held_at && !r.excluded_at
      : f.status === "incomplete" ? !r.completed_at && !r.blocked_at
      : f.status === "blocked" ? !!r.blocked_at
      : f.status === "excluded" ? !!r.excluded_at
      : true;
    const flagged = f.flaggedFrom === undefined || r.risk_score >= f.flaggedFrom || !!r.blocked_at;
    const kind = kindOf(f.q);
    const q = !kind || (kind === "ip" ? r.ip_address === f.q : kind === "device" && !!r.device_hash?.startsWith(f.q!.toLowerCase()));
    return status && (!f.raffle || !!r.participant_id) && flagged && q;
  }

  async pageResponses(filter: ResponseFilter, page: PageQuery) {
    const d = await this.read();
    return pageLocal(d.responses.filter((r) => this.matchesFilter(r, filter)), (r) => r.created_at, "desc", page);
  }

  async countResponses(filter: ResponseFilter) {
    const d = await this.read();
    return d.responses.filter((r) => this.matchesFilter(r, filter)).length;
  }

  async hasVotedToday(voterId: string, day: string) {
    const d = await this.read();
    return d.responses.some((r) => r.completed_at && r.voter_id === voterId && r.vote_day === day);
  }

  async ipVotesToday(ip: string | null, day: string) {
    const d = await this.read();
    return d.responses.filter((r) => r.completed_at && r.vote_day === day && r.ip_address === ip).length; // ip null : votes sans IP, comptés ensemble
  }

  async relatedAttempts(day: string, keys: AttemptKeys) {
    const d = await this.read();
    return d.responses.filter(
      (r) =>
        r.completed_at &&
        r.vote_day === day &&
        ((keys.voterId && r.voter_id === keys.voterId) || (keys.hwKey && r.hw_key === keys.hwKey) || (r.storage_key && keys.storageKeys.includes(r.storage_key))),
    );
  }

  async hwConfirmedBefore(hwKey: string, day: string) {
    const d = await this.read();
    return this.fraudInGroups([...new Set(d.responses.filter((r) => r.hw_key === hwKey && !!r.vote_day && r.vote_day < day && !!r.group_id).map((r) => r.group_id!))]);
  }

  async fraudInGroups(groupIds: string[]) {
    if (!groupIds.length) return false;
    const d = await this.read();
    return d.responses.some((r) => !!r.group_id && groupIds.includes(r.group_id) && provesFraud(r));
  }

  async recordRefusal(r: RefusalInput) {
    await this.mutate((d) => {
      const since = new Date(Date.now() - 60_000).toISOString();
      const stage = r.stage ?? "create";
      const dup = d.responses.some((x) => x.vote_day === r.voteDay && x.block_stage === stage && x.created_at >= since && !!r.voterId && x.voter_id === r.voterId);
      if (dup || d.responses.some((x) => x.session_id === r.sessionId)) return;
      const traces = d.responses.filter((x) => x.vote_day === r.voteDay && x.blocked_at);
      const strong = r.fraud.hw_entropy === "strong" ? r.fraud.hw_key : null;
      if (strong && traces.filter((x) => x.hw_key === strong).length >= REFUSAL_TRACES_MAX.hw) return;
      if (r.meta.ip && traces.filter((x) => x.ip_address === r.meta.ip && !isCookieRefusal(x)).length >= REFUSAL_TRACES_MAX.ip) return;
      d.responses.push({ ...this.blank(r.sessionId, r.meta, r.voterId, r.device), ...refusalRow(r) } as ResponseRow);
    });
  }

  async dayAttempts(day: string) {
    const d = await this.read();
    return d.responses.filter((r) => r.vote_day === day && (r.completed_at || r.blocked_at)).sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  async applyGraphChanges(changes: GraphChange[]) {
    await this.mutate((d) => {
      const now = new Date().toISOString();
      for (const c of changes) {
        const row = d.responses.find((r) => r.id === c.id);
        if (!row || row.human_decision) continue;
        row.group_id = c.groupId;
        if (c.exclude && !row.excluded_at) Object.assign(row, { excluded_at: now, exclusion_source: "auto" });
        if (c.restore && row.exclusion_source === "auto") Object.assign(row, { excluded_at: null, exclusion_source: null }); // seule une exclusion du moteur se lève
        row.updated_at = now;
      }
    });
  }

  async listReviewRows() {
    const d = await this.read();
    return d.responses.filter((r) => r.blocked_at || r.held_at || r.exclusion_source === "auto").sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5000);
  }

  async holdResponse(id: string, reasons: string[]) {
    await this.mutate((d) => {
      const row = d.responses.find((r) => r.id === id);
      if (row && isCounted(row) && !row.human_decision) Object.assign(row, { held_at: new Date().toISOString(), fraud_reasons: reasons, updated_at: new Date().toISOString() });
    });
  }

  async decideResponses(ids: string[], action: HumanAction): Promise<HumanResult> {
    return this.mutate((d) => {
      const out: HumanResult = { done: [], refused: [] };
      for (const id of ids) {
        const row = d.responses.find((r) => r.id === id);
        if (!row) {
          out.refused.push({ id, reason: "missing" });
          continue;
        }
        const patch = humanPatch(row, action);
        if (!patch) {
          out.refused.push({ id, reason: "incomplete" });
          continue;
        }
        // Même règle que l'index unique (cookie, jour) : un vote bloqué ne devient pas un second vote du même cookie.
        if (row.blocked_at && action === "validate" && d.responses.some((r) => r !== row && r.completed_at && r.voter_id === row.voter_id && r.vote_day === row.vote_day)) {
          out.refused.push({ id, reason: "conflict" });
          continue;
        }
        Object.assign(row, patch, { updated_at: new Date().toISOString() });
        out.done.push(id);
      }
      return out;
    });
  }

  async getSetting(key: string) {
    const d = await this.read();
    return d.settings[key] ?? null;
  }

  async setSetting(key: string, value: unknown) {
    await this.mutate((d) => {
      d.settings[key] = value;
    });
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
      const active = d.participants.filter((p) => !p.deleted_at);
      const byPseudo = active.find((p) => p.pseudo_key === input.pseudo_key) ?? null;
      const byEmail = active.find((p) => p.email === input.email) ?? null;
      const byPhone = active.find((p) => p.phone_number === input.phone_number) ?? null;
      const link = (id: string) => row && Object.assign(row, { wants_raffle: true, participant_id: id, updated_at: new Date().toISOString() });
      // 2. Même personne (pseudo, email et téléphone identiques) : on relie.
      if (byEmail && byEmail === byPhone && byEmail === byPseudo) {
        link(byEmail.id);
        return { participant: byEmail, alreadyRegistered: true };
      }
      const fields = conflictFields({ pseudo: byPseudo, email: byEmail, phone_number: byPhone });
      if (Object.keys(fields).length) throw new ConflictError(fields);
      const now = new Date().toISOString();
      const participant: Participant = { id: randomUUID(), ...input, created_at: now, updated_at: now, deleted_at: null };
      d.participants.push(participant);
      link(participant.id);
      return { participant, alreadyRegistered: false };
    });
  }

  async listParticipants(deleted = false) {
    const d = await this.read();
    return d.participants.filter((p) => !!p.deleted_at === deleted).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  async pageParticipants(filter: ParticipantFilter, page: PageQuery) {
    const d = await this.read();
    const needle = filter.q ? pseudoKey(filter.q) : "";
    const col = PARTICIPANT_SORT_COLUMN[filter.sort];
    const found = d.participants.filter((p) => !!p.deleted_at === !!filter.deleted && (!needle || p.pseudo_key.includes(needle) || p.email.includes(needle) || p.phone_number.includes(needle)));
    const out = pageLocal(found, (p) => String(p[col]), filter.dir, page);
    const votes = countedVotesByParticipant(d.responses);
    const groups = groupsByParticipant(d.responses);
    return { ...out, rows: out.rows.map((p) => ({ ...p, votes: votes.get(p.id) ?? 0, groups: groups.get(p.id) ?? [] })) };
  }

  async updateParticipant(id: string, patch: Pick<Participant, "pseudo" | "pseudo_key">) {
    await this.mutate((d) => {
      if (d.participants.some((p) => p.id !== id && !p.deleted_at && p.pseudo_key === patch.pseudo_key)) throw new ConflictError({ pseudo: CONFLICT_MESSAGES.pseudo });
      const p = d.participants.find((x) => x.id === id);
      if (p) Object.assign(p, patch, { updated_at: new Date().toISOString() });
    });
  }

  async getParticipant(id: string) {
    const d = await this.read();
    return d.participants.find((p) => p.id === id) ?? null;
  }

  async deleteParticipant(id: string) {
    await this.mutate((d) => {
      const p = d.participants.find((x) => x.id === id);
      if (p && !p.deleted_at) Object.assign(p, { deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() });
      for (const pr of d.prizes) if (pr.winner_participant_id === id) pr.winner_participant_id = null;
    });
  }

  async restoreParticipant(id: string) {
    await this.mutate((d) => {
      const p = d.participants.find((x) => x.id === id);
      if (!p?.deleted_at) return;
      const active = d.participants.filter((x) => x.id !== id && !x.deleted_at);
      const fields = conflictFields({
        pseudo: active.find((x) => x.pseudo_key === p.pseudo_key) ?? null,
        email: active.find((x) => x.email === p.email) ?? null,
        phone_number: active.find((x) => x.phone_number === p.phone_number) ?? null,
      });
      if (Object.keys(fields).length) throw new ConflictError(fields);
      Object.assign(p, { deleted_at: null, updated_at: new Date().toISOString() });
    });
  }

  recordVisit(v: VisitInput) {
    return this.mutate((d) => {
      if (d.visits.some((x) => isDuplicateVisit(x, v))) return "duplicate" as const;
      d.visits.push({ id: randomUUID(), created_at: new Date().toISOString(), ...v });
      return v.rejected ? ("rejected" as const) : ("counted" as const);
    });
  }

  async pageVisits(status: VisitStatus, page: PageQuery) {
    const d = await this.read();
    const rows = d.visits.filter((v) => status === "all" || (status === "rejected") === !!v.rejected);
    return pageLocal(rows, (v) => v.created_at, "desc", page);
  }

  async listVisits() {
    const d = await this.read();
    const since = visitsSince();
    return d.visits.filter((v) => v.created_at >= since).sort((a, b) => a.created_at.localeCompare(b.created_at)).slice(0, VISITS_MAX);
  }

  recordClick(c: ClickInput) {
    return this.mutate((d) => {
      d.clicks.push({ id: randomUUID(), created_at: new Date().toISOString(), ...c });
    });
  }

  async listClicks() {
    const d = await this.read();
    const since = clicksSince();
    return d.clicks.filter((c) => c.created_at >= since).sort((a, b) => a.created_at.localeCompare(b.created_at));
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

  async createAdminSession(s: AdminSessionInput) {
    const now = new Date().toISOString();
    const session: AdminSession = { id: randomUUID(), ...s, created_at: now, last_seen_at: now, revoked_at: null };
    await this.mutate((d) => d.admin_sessions.push(session));
    return session;
  }

  async getAdminSession(id: string) {
    const d = await this.read();
    return d.admin_sessions.find((s) => s.id === id) ?? null;
  }

  async revokeAdminSession(id: string) {
    await this.mutate((d) => {
      const s = d.admin_sessions.find((x) => x.id === id);
      if (s && !s.revoked_at) s.revoked_at = new Date().toISOString();
    });
  }

  async recordLoginFailure(ip: string | null) {
    await this.mutate((d) => d.login_failures.push({ id: randomUUID(), ip, created_at: new Date().toISOString() }));
  }

  async countLoginFailures(since: string, ip?: string | null) {
    const d = await this.read();
    return d.login_failures.filter((f) => f.created_at >= since && (ip === undefined || f.ip === ip)).length;
  }

  async listLoginFailures(limit: number) {
    const d = await this.read();
    return [...d.login_failures].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit);
  }

  async purge() {
    await this.mutate((d) => purgeLocal(d, Date.now()));
  }

  async logAdminAction(a: AdminActionInput) {
    const now = new Date().toISOString();
    await this.mutate((d) => {
      d.admin_actions.push({ id: randomUUID(), ...a, created_at: now });
      const s = d.admin_sessions.find((x) => x.id === a.session_id);
      if (s) s.last_seen_at = now;
    });
  }

  async listAdminSessions() {
    const d = await this.read();
    const desc = (a: { created_at: string }, b: { created_at: string }) => b.created_at.localeCompare(a.created_at);
    return { sessions: [...d.admin_sessions].sort(desc), actions: [...d.admin_actions].sort(desc) };
  }

  async listRestaurants() {
    const d = await this.read();
    return [...d.restaurants].sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }

  addRestaurant(name: string, city: string | null) {
    return this.mutate((d) => {
      if (d.restaurants.some((r) => r.name === name)) throw new ConflictError({ name: CONFLICT_MESSAGES.restaurant });
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

  async fileExists(url: string) {
    if (!this.isOwnFile(url)) return false;
    return fs.access(path.join(UPLOAD_DIR, url.slice("/uploads/".length))).then(() => true, () => false);
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
