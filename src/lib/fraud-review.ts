import { personClusters, type GraphAttempt, type GraphOptions } from "./fraud-graph";

/**
 * Listes de l'onglet Sécurité, en fonctions pures (testées) :
 * - « Votes frauduleux » : les cas sûrs (bloqués, exclus automatiquement), une ligne par personne et par
 *   jour, regroupés comme le moteur de groupes (même groupe, ou à défaut même cookie, jeton ou clé forte) ;
 * - « Votes suspects en attente » : jamais comptés par défaut, priorité haute en tête.
 */

export type ReviewAttempt = GraphAttempt & { day: string; priority: boolean };

export const isFraud = (a: Pick<GraphAttempt, "status" | "autoExcluded">) => a.status === "blocked" || (a.status === "excluded" && a.autoExcluded);

export type FraudPerson = {
  /** Clé stable de la ligne : jour et première tentative frauduleuse. */
  key: string;
  day: string;
  /** Premier blocage ou exclusion automatique de la personne ce jour-là. */
  first: string;
  /** Nombre total de tentatives bloquées ou exclues automatiquement, et heure de la dernière. */
  count: number;
  lastAtMs: number;
  firstAtMs: number;
  /** Toutes les tentatives de la personne ce jour-là, dans l'ordre chronologique. */
  attempts: string[];
  /** Vote compté de la personne, rappelé en tête du dépli. */
  counted: string | null;
  /** Autres jours où la même clé forte ou le même participant revient dans « Votes frauduleux ». */
  recidivism: string[];
};

/** Lignes « Votes frauduleux », triées par premier blocage, du plus récent au plus ancien. */
export function fraudPersons(attempts: ReviewAttempt[], opts: GraphOptions): FraudPerson[] {
  const byDay = new Map<string, ReviewAttempt[]>();
  for (const a of attempts) (byDay.get(a.day) ?? byDay.set(a.day, []).get(a.day)!).push(a);
  const byId = new Map(attempts.map((a) => [a.id, a]));
  const persons: (FraudPerson & { strong: Set<string>; participants: Set<string> })[] = [];
  for (const [day, list] of byDay) {
    for (const cluster of personClusters(list, opts)) {
      const members = cluster.map((id) => byId.get(id)!).sort((x, y) => x.atMs - y.atMs || x.id.localeCompare(y.id));
      const fraud = members.filter(isFraud);
      if (!fraud.length) continue;
      persons.push({
        key: `${day}:${fraud[0].id}`,
        day,
        first: fraud[0].id,
        count: fraud.length,
        firstAtMs: fraud[0].atMs,
        lastAtMs: fraud[fraud.length - 1].atMs,
        attempts: members.map((m) => m.id),
        counted: members.find((m) => m.status === "counted")?.id ?? null,
        recidivism: [],
        strong: new Set(members.filter((m) => m.entropy === "strong" && m.hwKey).map((m) => m.hwKey!)),
        participants: new Set(members.flatMap((m) => (m.participantId ? [m.participantId] : []))),
      });
    }
  }
  for (const p of persons) {
    const days = persons.filter((o) => o.day !== p.day && ([...o.strong].some((k) => p.strong.has(k)) || [...o.participants].some((id) => p.participants.has(id)))).map((o) => o.day);
    p.recidivism = [...new Set(days)].sort();
  }
  return persons
    .sort((a, b) => b.firstAtMs - a.firstAtMs || a.key.localeCompare(b.key))
    .map((p) => ({ key: p.key, day: p.day, first: p.first, count: p.count, lastAtMs: p.lastAtMs, firstAtMs: p.firstAtMs, attempts: p.attempts, counted: p.counted, recidivism: p.recidivism }));
}

/** Votes en attente (ni exclus ni décidés) : priorité haute en tête, puis les plus récents. */
export function pendingAttempts(attempts: ReviewAttempt[]): ReviewAttempt[] {
  return attempts.filter((a) => a.status === "held").sort((a, b) => Number(b.priority) - Number(a.priority) || b.atMs - a.atMs || a.id.localeCompare(b.id));
}

/** Tentative telle que l'onglet Sécurité l'affiche (champs sensibles à null pour le rôle lecture seule). */
export type AttemptView = {
  id: string;
  day: string;
  at: string;
  status: GraphAttempt["status"];
  stage: "create" | "complete" | null;
  reasons: string[];
  flags: string[];
  score: number;
  device: { mobile?: boolean; platform?: string; browser?: string; screen?: string; model?: string; osVersion?: string } | null;
  ip: string | null;
  ipClass: string | null;
  country: string | null;
  city: string | null;
  decorationId: string | null;
  restaurant: string | null;
  hwPrefix: string | null;
  entropy: string | null;
  privateMode: boolean | null;
  priority: boolean;
  groupId: string | null;
  pseudo: string | null;
  humanDecision: "validated" | "excluded" | null;
  exclusionSource: "admin" | "auto" | null;
  observed: string | null;
};

/** Réponse de GET /api/admin/fraud/review. */
export type FraudList = { kind: "fraud"; total: number; items: (Omit<FraudPerson, "attempts" | "counted"> & { firstView: AttemptView; members: number })[] };
export type PendingList = { kind: "pending"; total: number; items: (AttemptView & { personKey: string })[] };
/** Réponse de GET /api/admin/fraud/person : vote compté rappelé en tête, puis toutes les autres tentatives. */
export type PersonDetail = { key: string; counted: AttemptView | null; attempts: AttemptView[] };
