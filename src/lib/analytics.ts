import "server-only";
import { parisDay, parisHour } from "./day";
import { getStore } from "./db";
import { groupDecorations, thumbOf, type Decoration, type Participant, type ResponseRow } from "./schema";

export type AnalyticsFilter = {
  from?: string;
  to?: string;
  restaurant?: string;
};

/** Résultat d'un restaurant : les votes de tous ses médias (photos / vidéos) sont additionnés. */
export type DecorationResult = {
  id: string;
  restaurant_name: string;
  image_url: string;
  votes: number;
  share: number;
  /** Détail de la modale (jamais exposé publiquement, voir public-results.ts) : commentaires laissés, votants inscrits au tirage. */
  comments: number;
  raffle: number;
};

export type Summary = {
  kpis: {
    totalVotes: number;
    raffleParticipants: number;
    started: number;
    completionRate: number;
    /** Démarrés sans validation ni refus par score (Lot B). */
    incomplete: number;
    /** Refusés par le score de risque. */
    blocked: number;
  };
  byDecoration: DecorationResult[];
  /** Question 1 : Chamas Tacos préféré. */
  byFavorite: { name: string; votes: number }[];
  timeline: { date: string; votes: number }[];
  /** Votes validés par jour (Europe/Paris) et par restaurant voté (Q2), jours vides compris. */
  byDecorationDaily: { date: string; votes: Record<string, number> }[];
  /** Tableau croisé : restaurant préféré (Q1, lignes) × restaurant voté (Q2, colonnes). */
  favoriteVsVote: { favorite: string; votes: Record<string, number> }[];
  /** Votes validés par heure de la journée (Europe/Paris), 24 entrées. */
  byHour: { hour: number; votes: number }[];
  /** Par jour (Europe/Paris) : questionnaires démarrés, validés, inscrits au tirage, bloqués. */
  dailyTable: { date: string; started: number; completed: number; raffle: number; blocked: number }[];
  updatedAt: string;
};

export function parseFilter(url: URL): AnalyticsFilter {
  const p = url.searchParams;
  const date = (v: string | null, end = false) =>
    v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T${end ? "23:59:59.999" : "00:00:00.000"}Z` : undefined;
  return {
    from: date(p.get("from")),
    to: date(p.get("to"), true),
    restaurant: p.get("restaurant")?.slice(0, 150) || undefined,
  };
}

export async function loadFiltered(filter: AnalyticsFilter) {
  const store = getStore();
  const [all, decorations, participants] = await Promise.all([
    store.listResponses({ from: filter.from, to: filter.to }),
    store.listDecorations(),
    store.listParticipants(),
  ]);
  const scoped = all.filter((r) => !filter.restaurant || r.selected_restaurant === filter.restaurant);
  return { started: scoped, completed: scoped.filter((r) => r.completed_at), decorations, participants };
}

/** Jour (Europe/Paris) d'une réponse : celui du vote, sinon celui de sa création. */
const dayOf = (r: ResponseRow) => r.vote_day ?? parisDay(r.completed_at ?? r.created_at);

const count = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

export function summarize(started: ResponseRow[], validated: ResponseRow[], decorations: Decoration[], participants: Participant[] = []): Summary {
  // Les votes exclus du classement par un admin ne comptent nulle part (les bloqués n'ont pas de completed_at).
  const completed = validated.filter((r) => !r.excluded_at);
  const total = completed.length;
  // Participants au tirage : la table `participants`, restreinte aux réponses du périmètre filtré.
  const linked = new Set(completed.map((r) => r.participant_id).filter((id): id is string => !!id));
  const raffleParticipants = participants.filter((p) => linked.has(p.id)).length;
  const active = new Set(participants.map((p) => p.id));
  const inRaffle = (r: ResponseRow) => !!r.participant_id && active.has(r.participant_id);

  // Restaurant voté (Q2) d'une réponse, d'après le média choisi.
  const groups = groupDecorations(decorations);
  const restaurantOf = new Map(groups.flatMap((g) => g.items.map((d) => [d.id, g.restaurant_name] as const)));
  const votedName = (r: ResponseRow) => (r.selected_decoration_id ? (restaurantOf.get(r.selected_decoration_id) ?? null) : null);

  const byDecoration = groups.map<DecorationResult>((g) => {
    const mine = completed.filter((r) => votedName(r) === g.restaurant_name);
    return {
      id: g.id,
      restaurant_name: g.restaurant_name,
      image_url: thumbOf(g.items[0]),
      votes: mine.length,
      share: total ? mine.length / total : 0,
      comments: mine.filter((r) => r.comment).length,
      raffle: mine.filter(inRaffle).length,
    };
  });
  byDecoration.sort((a, b) => b.votes - a.votes || a.restaurant_name.localeCompare(b.restaurant_name, "fr"));

  const favorites = new Map<string, number>();
  for (const r of completed) if (r.selected_restaurant) count(favorites, r.selected_restaurant);
  const byFavorite = [...favorites.entries()]
    .map(([name, votes]) => ({ name, votes }))
    .sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name, "fr"));

  const perDay = new Map<string, number>();
  for (const r of completed) count(perDay, dayOf(r));
  const days = dayRange([...perDay.keys()]);
  const timeline = days.map((date) => ({ date, votes: perDay.get(date) ?? 0 }));

  const byDecorationDaily = days.map((date) => {
    const votes: Record<string, number> = {};
    for (const r of completed) {
      const name = votedName(r);
      if (name && dayOf(r) === date) votes[name] = (votes[name] ?? 0) + 1;
    }
    return { date, votes };
  });

  const cross = new Map<string, Record<string, number>>();
  for (const r of completed) {
    const name = votedName(r);
    if (!r.selected_restaurant || !name) continue;
    const row = cross.get(r.selected_restaurant) ?? {};
    row[name] = (row[name] ?? 0) + 1;
    cross.set(r.selected_restaurant, row);
  }
  const sum = (row: Record<string, number>) => Object.values(row).reduce((a, b) => a + b, 0);
  const favoriteVsVote = [...cross.entries()].map(([favorite, votes]) => ({ favorite, votes })).sort((a, b) => sum(b.votes) - sum(a.votes) || a.favorite.localeCompare(b.favorite, "fr"));

  const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, votes: 0 }));
  for (const r of completed) byHour[parisHour(r.completed_at ?? r.created_at)].votes += 1;

  const allDays = dayRange(started.map(dayOf));
  const dailyTable = allDays.map((date) => {
    const mine = started.filter((r) => dayOf(r) === date);
    return {
      date,
      started: mine.length,
      completed: mine.filter((r) => r.completed_at && !r.excluded_at).length,
      raffle: mine.filter((r) => r.completed_at && !r.excluded_at && inRaffle(r)).length,
      blocked: mine.filter((r) => r.blocked_at).length,
    };
  });

  return {
    kpis: {
      totalVotes: total,
      raffleParticipants,
      started: started.length,
      completionRate: started.length ? total / started.length : 0,
      incomplete: started.filter((r) => !r.completed_at && !r.blocked_at).length,
      blocked: started.filter((r) => r.blocked_at).length,
    },
    byDecoration,
    byFavorite,
    timeline,
    byDecorationDaily,
    favoriteVsVote,
    byHour,
    dailyTable,
    updatedAt: new Date().toISOString(),
  };
}

/** Tous les jours du premier au dernier, pour que les courbes ne sautent pas de dates. */
function dayRange(days: string[]): string[] {
  if (days.length === 0) return [];
  const sorted = [...days].sort();
  const out: string[] = [];
  const end = new Date(`${sorted[sorted.length - 1]}T00:00:00Z`);
  for (let d = new Date(`${sorted[0]}T00:00:00Z`); d <= end; d.setUTCDate(d.getUTCDate() + 1)) out.push(d.toISOString().slice(0, 10));
  return out;
}

export async function getSummary(filter: AnalyticsFilter) {
  const { started, completed, decorations, participants } = await loadFiltered(filter);
  return summarize(started, completed, decorations, participants);
}
