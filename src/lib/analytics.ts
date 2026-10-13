import "server-only";
import { getStore } from "./db";
import { groupDecorations, IMPACTS, isRaffleEntry, thumbOf, type Decoration, type Impact, type ResponseRow } from "./schema";

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
};

export type Summary = {
  kpis: {
    totalVotes: number;
    raffleParticipants: number;
    started: number;
    completionRate: number;
  };
  byDecoration: DecorationResult[];
  /** Question 1 : Chamas Tacos préféré. */
  byFavorite: { name: string; votes: number }[];
  impact: { key: Impact; count: number }[];
  timeline: { date: string; votes: number }[];
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
  const [all, decorations] = await Promise.all([
    store.listResponses({ from: filter.from, to: filter.to }),
    store.listDecorations(),
  ]);
  const scoped = all.filter((r) => !filter.restaurant || r.selected_restaurant === filter.restaurant);
  return { started: scoped, completed: scoped.filter((r) => r.completed_at), decorations };
}

export function summarize(started: ResponseRow[], completed: ResponseRow[], decorations: Decoration[]): Summary {
  const total = completed.length;

  const byDecoration = groupDecorations(decorations).map<DecorationResult>((g) => {
    const ids = new Set(g.items.map((d) => d.id));
    const votes = completed.filter((r) => r.selected_decoration_id && ids.has(r.selected_decoration_id)).length;
    return {
      id: g.id,
      restaurant_name: g.restaurant_name,
      image_url: thumbOf(g.items[0]),
      votes,
      share: total ? votes / total : 0,
    };
  });
  byDecoration.sort((a, b) => b.votes - a.votes || a.restaurant_name.localeCompare(b.restaurant_name, "fr"));

  const favorites = new Map<string, number>();
  for (const r of completed) {
    if (r.selected_restaurant) favorites.set(r.selected_restaurant, (favorites.get(r.selected_restaurant) ?? 0) + 1);
  }
  const byFavorite = [...favorites.entries()]
    .map(([name, votes]) => ({ name, votes }))
    .sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name, "fr"));

  const perDay = new Map<string, number>();
  for (const r of completed) {
    const day = (r.completed_at ?? r.created_at).slice(0, 10);
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
  }
  const timeline = fillDays([...perDay.entries()].sort(([a], [b]) => a.localeCompare(b)));

  return {
    kpis: {
      totalVotes: total,
      raffleParticipants: completed.filter(isRaffleEntry).length,
      started: started.length,
      completionRate: started.length ? total / started.length : 0,
    },
    byDecoration,
    byFavorite,
    impact: IMPACTS.map((key) => ({ key, count: completed.filter((r) => r.decoration_impact === key).length })),
    timeline,
    updatedAt: new Date().toISOString(),
  };
}

/** Complète les jours sans vote pour que la courbe ne saute pas de dates. */
function fillDays(entries: [string, number][]) {
  if (entries.length === 0) return [];
  const map = new Map(entries);
  const out: { date: string; votes: number }[] = [];
  const end = new Date(`${entries[entries.length - 1][0]}T00:00:00Z`);
  for (let d = new Date(`${entries[0][0]}T00:00:00Z`); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    out.push({ date: key, votes: map.get(key) ?? 0 });
  }
  return out;
}

export async function getSummary(filter: AnalyticsFilter) {
  const { started, completed, decorations } = await loadFiltered(filter);
  return summarize(started, completed, decorations);
}
