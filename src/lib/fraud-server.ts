import "server-only";
import { revalidatePath } from "next/cache";
import { RETENTION_DAYS, type FraudStamp, type Store } from "./db";
import { buildGroups, graphChanges, isWithdrawal, withdrawalsAllowed, withoutWithdrawals, type GraphAttempt, type Group } from "./fraud-graph";
import { fraudPersons, pendingAttempts, type AttemptView, type FraudPerson, type ReviewAttempt } from "./fraud-review";
import { decide, recognize, type Decision, type IpClassName, type RelatedAttempt, type RequestFacts } from "./fraud-rules";
import { ipClass, ipNetwork } from "./ip-class";
import { readGeo } from "./ip-geo";
import { loadRiskSettings, type RiskSettings } from "./risk";
import { isCookieRefusal, voteStatus, type Device, type Participant, type ResponseRow } from "./schema";
import { effectiveEntropy, hwKeyOf, isComputer, storageKeyOf, xdevKeyOf, xdevStrictKeyOf } from "./voter";

/**
 * Orchestration serveur de l'anti-fraude : signaux de la requête (HMAC, classe et position de l'IP),
 * reconnaissance partagée par l'arrivée, l'ouverture et la validation, décision de validation, et
 * passage du moteur de groupes avec son journal. Les règles elles-mêmes sont pures (fraud-rules.ts,
 * fraud-graph.ts) : ce module ne fait que lire, assembler et écrire.
 */

export type RequestSignals = {
  stamp: FraudStamp;
  storageKeys: string[];
  ip: string | null;
  ipClass: IpClassName;
  country: string | null;
  tzMismatch: boolean;
  langMismatch: boolean;
  /** Ordinateur (B4 : refus) ou téléphone et tablette (H10 : attente). */
  computer: boolean;
  /** Brave (marque dans Sec-CH-UA) : écran, cœurs et polices brouillés, ses clés ne relient rien. */
  brave: boolean;
};

/** Langue principale de l'en-tête Accept-Language (« fr-FR,fr;q=0.9 » → « fr »). */
const primaryLang = (v: string | null | undefined) => v?.split(",")[0]?.trim().split(/[-;]/)[0]?.toLowerCase() || null;

export async function requestSignals(req: Request, ip: string | null, device: Device | undefined): Promise<RequestSignals> {
  const geo = readGeo(req.headers);
  const cls = (await ipClass(ip)) as IpClassName;
  const entropy = effectiveEntropy(device?.hwEntropy, req.headers.get("user-agent"), req.headers.get("sec-ch-ua"), device?.model);
  const storageKeys = [...new Set((device?.tokens ?? []).map(storageKeyOf))];
  const acceptLang = primaryLang(req.headers.get("accept-language"));
  const declaredLang = primaryLang(device?.lang);
  return {
    stamp: {
      hw_key: hwKeyOf(device?.hw),
      xdev_key: xdevKeyOf(device?.xKey),
      xdev_strict_key: xdevStrictKeyOf(device?.mKey),
      hw_entropy: device?.hw ? entropy : null,
      private_mode: device?.privateMode ?? null,
      seen_storage: storageKeys.length ? storageKeys : null,
      ip_net: ipNetwork(ip),
      ip_class: cls,
      ip_country: geo.country,
      ip_timezone: geo.timezone,
      ip_city: geo.city,
      ip_latitude: geo.latitude,
      ip_longitude: geo.longitude,
    },
    storageKeys,
    ip,
    ipClass: cls,
    country: geo.country,
    tzMismatch: !!(device?.tz && geo.timezone && device.tz !== geo.timezone),
    langMismatch: !!(acceptLang && declaredLang && acceptLang !== declaredLang),
    computer: isComputer(req.headers.get("user-agent"), device?.touch),
    brave: /"Brave"/.test(req.headers.get("sec-ch-ua") ?? "") || device?.browser?.startsWith("Brave") === true,
  };
}

const atMs = (r: ResponseRow) => Date.parse(r.completed_at ?? r.blocked_at ?? r.created_at);

export const toRelated = (r: ResponseRow): RelatedAttempt => ({
  id: r.id,
  voterId: r.voter_id,
  atMs: atMs(r),
  hwKey: r.hw_key ?? null,
  entropy: r.hw_entropy ?? null,
  storageKey: r.storage_key ?? null,
  ipNet: r.ip_net ?? null,
  ipClass: r.ip_class ?? null,
  city: r.ip_city ?? null,
  decorationId: r.selected_decoration_id,
  groupId: r.group_id ?? null,
  xdevKey: r.xdev_key ?? null,
  xdevStrictKey: r.xdev_strict_key ?? null,
});

/** Clés inter-navigateurs de la requête ; Brave sur ordinateur (clés brouillées) : son réseau, pour H10. */
const xdevKeys = (sig: RequestSignals) => ({
  xdevKey: sig.stamp.xdev_key ?? null,
  xdevStrictKey: sig.stamp.xdev_strict_key ?? null,
  ipNet: sig.brave && sig.computer ? (sig.stamp.ip_net ?? null) : null,
});

/** Reconnaissance d'un appareil qui a déjà une tentative aujourd'hui (arrivée et ouverture). */
export async function recognizeDevice(store: Store, settings: RiskSettings, day: string, voterId: string | null, sig: RequestSignals, nowMs: number) {
  const related = (await store.relatedAttempts(day, { voterId, hwKey: sig.stamp.hw_key ?? null, storageKeys: sig.storageKeys, ...xdevKeys(sig) })).map(toRelated);
  const facts = {
    voterId,
    storageKeys: sig.storageKeys,
    hwKey: sig.stamp.hw_key ?? null,
    entropy: sig.stamp.hw_entropy ?? null,
    privateMode: sig.stamp.private_mode ?? null,
    ipNet: sig.stamp.ip_net ?? null,
    city: sig.stamp.ip_city ?? null,
    nowMs,
    xdevKey: sig.stamp.xdev_key ?? null,
    xdevStrictKey: sig.stamp.xdev_strict_key ?? null,
    computer: sig.computer,
    brave: sig.brave,
  };
  return { recognized: recognize(facts, related, settings), related };
}

/** Décision à la validation (toutes les règles). */
export async function decideVote(
  store: Store,
  settings: RiskSettings,
  input: { day: string; nowMs: number; voterId: string; decorationId: string; score: number; ipCapped: boolean; sig: RequestSignals },
): Promise<Decision> {
  const { sig } = input;
  const hwKey = sig.stamp.hw_key ?? null;
  const entropy = sig.stamp.hw_entropy ?? null;
  const [rows, recidivism] = await Promise.all([
    store.relatedAttempts(input.day, { voterId: input.voterId, hwKey, storageKeys: sig.storageKeys, ...xdevKeys(sig) }),
    settings.h7_recidivism && entropy === "strong" && hwKey ? store.hwConfirmedBefore(hwKey, input.day) : Promise.resolve(false),
  ]);
  const facts: RequestFacts = {
    stage: "complete",
    nowMs: input.nowMs,
    voterId: input.voterId,
    storageKeys: sig.storageKeys,
    hwKey,
    entropy,
    privateMode: sig.stamp.private_mode ?? null,
    ipNet: sig.stamp.ip_net ?? null,
    ipClass: sig.ipClass,
    country: sig.country,
    city: sig.stamp.ip_city ?? null,
    decorationId: input.decorationId,
    score: input.score,
    ipCapped: input.ipCapped,
    recidivism,
    tzMismatch: sig.tzMismatch,
    langMismatch: sig.langMismatch,
    xdevKey: sig.stamp.xdev_key ?? null,
    xdevStrictKey: sig.stamp.xdev_strict_key ?? null,
    computer: sig.computer,
    brave: sig.brave,
  };
  return decide(facts, rows.map(toRelated), settings);
}

// ---------------------------------------------------------------------------
// Moteur de groupes
// ---------------------------------------------------------------------------

export function toGraphAttempt(r: ResponseRow, participants: Map<string, Participant>): GraphAttempt {
  const p = r.participant_id ? participants.get(r.participant_id) : undefined;
  return {
    id: r.id,
    atMs: atMs(r),
    status: voteStatus(r),
    voterId: r.voter_id,
    hwKey: r.hw_key ?? null,
    entropy: r.hw_entropy ?? null,
    storageKey: r.storage_key ?? null,
    seenStorage: r.seen_storage ?? [],
    ipNet: r.ip_net ?? null,
    ipClass: r.ip_class ?? null,
    city: r.ip_city ?? null,
    decorationId: r.selected_decoration_id,
    privateMode: r.private_mode ?? null,
    participantId: r.participant_id,
    phone: p?.phone_number ?? null,
    email: p?.email ?? null,
    humanDecision: r.human_decision ?? null,
    cookieRefusal: isCookieRefusal(r),
    xdevKey: r.xdev_key ?? null,
    xdevStrictKey: r.xdev_strict_key ?? null,
    computer: isComputer(r.user_agent, r.device_info?.touch),
    createdMs: Date.parse(r.created_at),
    autoExcluded: r.exclusion_source === "auto",
    groupId: r.group_id ?? null,
  };
}

/** `withdrawalsRefused` : retraits non appliqués parce que le jour dépasse la conservation des valeurs de l'IP. */
export type GraphRun = { day: string; attempts: ResponseRow[]; groups: Group[]; changes: ReturnType<typeof graphChanges>; withdrawalsRefused: number };

/**
 * Calcule les groupes d'un jour et les écritures qu'il faudrait faire (aperçu : rien n'est écrit).
 * `manualToday` (Recalculer, jour courant) : les retraits sont permis, sauf au-delà de la conservation
 * des valeurs déduites de l'IP (RETENTION_DAYS.responses). Sans lui (passage automatique) : jamais.
 */
export async function previewGraph(store: Store, day: string, settings?: RiskSettings, manualToday?: string): Promise<GraphRun> {
  const s = settings ?? (await loadRiskSettings(store));
  const [attempts, active, deleted] = await Promise.all([store.dayAttempts(day), store.listParticipants(), store.listParticipants(true)]);
  const participants = new Map([...active, ...deleted].map((p) => [p.id, p]));
  const graph = attempts.map((r) => toGraphAttempt(r, participants));
  const groups = buildGroups(day, graph, { c2MinAttempts: s.c2_min_attempts, positionMinutes: s.h9_minutes });
  const all = graphChanges(graph, groups);
  const allowed = !!manualToday && withdrawalsAllowed(day, manualToday, RETENTION_DAYS.responses);
  const changes = allowed ? all : withoutWithdrawals(all);
  return { day, attempts, groups, changes, withdrawalsRefused: manualToday && !allowed ? all.filter(isWithdrawal).length : 0 };
}

const SYSTEM_SESSION_KEY = "fraud_engine_session";

/** Session du journal pour les passages automatiques du moteur (révoquée : aucun jeton ne peut l'utiliser). */
async function systemSession(store: Store): Promise<string> {
  const known = (await store.getSetting(SYSTEM_SESSION_KEY)) as string | null;
  if (known && (await store.getAdminSession(known))) return known;
  const s = await store.createAdminSession({ role: "admin", ip: null, user_agent: "Moteur anti-fraude (automatique)", city: null, region: null, country: null, latitude: null, longitude: null });
  await store.revokeAdminSession(s.id);
  await store.setSetting(SYSTEM_SESSION_KEY, s.id);
  return s.id;
}

/**
 * Passe le moteur sur un jour et applique ses décisions. Mode observation : rien n'est écrit (les
 * décisions restent visibles dans l'aperçu). Passage automatique (sans `manualToday`) : exclure et grouper
 * seulement ; Recalculer (`sessionId` et `manualToday` de l'admin) applique aussi les retraits permis.
 * Journalisé seulement s'il exclut ou lève quelque chose ; rafraîchit /resultats et /participants.
 */
export async function applyGraph(store: Store, day: string, opts: { sessionId?: string; reason: string; manualToday?: string }): Promise<GraphRun> {
  const settings = await loadRiskSettings(store);
  const run = await previewGraph(store, day, settings, opts.manualToday);
  if (!run.changes.length || settings.mode === "observe") return run;
  await store.applyGraphChanges(run.changes);
  if (!run.changes.some((c) => c.exclude || c.restore)) return run; // simple regroupement : rien à journaliser ni à rafraîchir
  try {
    await store.logAdminAction({
      session_id: opts.sessionId ?? (await systemSession(store)),
      method: "POST",
      path: "/moteur-anti-fraude",
      action: `Moteur anti-fraude : ${run.changes.filter((c) => c.exclude).length} vote(s) exclu(s) automatiquement, ${run.changes.filter((c) => c.restore).length} exclusion(s) levée(s)`,
      details: {
        day,
        reason: opts.reason,
        excluded: run.changes.filter((c) => c.exclude).map((c) => c.id),
        restored: run.changes.filter((c) => c.restore).map((c) => c.id),
        ungrouped: run.changes.filter((c) => c.groupId === null).map((c) => c.id),
        groups: [...new Set(run.changes.map((c) => c.groupId).filter(Boolean))],
      },
    });
  } catch (e) {
    console.error("Journal du moteur anti-fraude indisponible :", e); // ne bloque jamais l'exclusion elle-même
  }
  try {
    revalidatePath("/resultats");
    revalidatePath("/participants");
  } catch {
    /* hors contexte de requête (après la réponse) : les pages se rafraîchissent seules (15 s, 1 min) */
  }
  return run;
}

// ---------------------------------------------------------------------------
// Onglet Sécurité
// ---------------------------------------------------------------------------

/** Vue d'une tentative pour l'onglet Sécurité ; lecture seule : IP, appareil, clé et position masqués (comme redact.ts). */
export function attemptView(r: ResponseRow, participants: Map<string, Participant>, viewerOnly: boolean): AttemptView {
  return {
    id: r.id,
    day: r.vote_day ?? r.created_at.slice(0, 10),
    at: r.completed_at ?? r.blocked_at ?? r.created_at,
    status: voteStatus(r),
    stage: r.block_stage ?? (r.blocked_at ? "complete" : null),
    reasons: r.fraud_reasons ?? [],
    flags: r.risk_flags ?? [],
    score: r.risk_score,
    device: viewerOnly ? null : r.device_info,
    ip: viewerOnly ? null : r.ip_address,
    ipClass: viewerOnly ? null : (r.ip_class ?? null),
    country: viewerOnly ? null : (r.ip_country ?? null),
    city: viewerOnly ? null : (r.ip_city ?? null),
    decorationId: r.selected_decoration_id,
    restaurant: r.selected_restaurant,
    hwPrefix: viewerOnly ? null : (r.hw_key?.slice(0, 8) ?? null),
    entropy: viewerOnly ? null : (r.hw_entropy ?? null),
    privateMode: viewerOnly ? null : (r.private_mode ?? null),
    priority: !!r.held_priority,
    groupId: r.group_id ?? null,
    pseudo: r.participant_id ? (participants.get(r.participant_id)?.pseudo ?? null) : null,
    humanDecision: r.human_decision ?? null,
    exclusionSource: r.exclusion_source ?? (r.excluded_at ? "admin" : null),
    observed: r.observed_outcome ?? null,
  };
}

export type ReviewData = {
  rows: Map<string, ResponseRow>;
  participants: Map<string, Participant>;
  persons: FraudPerson[];
  pending: ReviewAttempt[];
  settings: RiskSettings;
};

/** Toutes les tentatives des jours qui ont quelque chose à revoir, regroupées par personne. */
export async function loadReview(store: Store): Promise<ReviewData> {
  const [settings, review, active, deleted] = await Promise.all([loadRiskSettings(store), store.listReviewRows(), store.listParticipants(), store.listParticipants(true)]);
  const participants = new Map([...active, ...deleted].map((p) => [p.id, p]));
  const days = [...new Set(review.map((r) => r.vote_day).filter((d): d is string => !!d))];
  const perDay = await Promise.all(days.map((d) => store.dayAttempts(d)));
  const rows = new Map<string, ResponseRow>();
  for (const r of [...perDay.flat(), ...review]) rows.set(r.id, r);
  const attempts: ReviewAttempt[] = [...rows.values()].map((r) => ({
    ...toGraphAttempt(r, participants),
    day: r.vote_day ?? r.created_at.slice(0, 10),
    priority: !!r.held_priority,
  }));
  const opts = { c2MinAttempts: settings.c2_min_attempts, positionMinutes: settings.h9_minutes };
  return { rows, participants, persons: fraudPersons(attempts, opts), pending: pendingAttempts(attempts), settings };
}
