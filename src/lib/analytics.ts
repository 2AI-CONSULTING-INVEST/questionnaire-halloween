import "server-only";
import { getStore } from "./db";
import { IMPACTS, VOTER_TYPES, isRaffleEntry, type Decoration, type Impact, type ResponseRow, type VoterType } from "./schema";

export type AnalyticsFilter = {
  from?: string;
  to?: string;
  voter?: VoterType;
  restaurant?: string;
};

export type DecorationResult = {
  id: string;
  restaurant_name: string;
  image_url: string;
  votes: number;
  share: number;
  client: number;
  employee: number;
};

export type Summary = {
  kpis: {
    totalVotes: number;
    clients: number;
    employees: number;
    raffleParticipants: number;
    started: number;
    completionRate: number;
  };
  byDecoration: DecorationResult[];
  impact: { key: Impact; count: number }[];
  timeline: { date: string; votes: number }[];
  byVoter: { key: VoterType; votes: number }[];
  updatedAt: string;
};

export function parseFilter(url: URL): AnalyticsFilter {
  const p = url.searchParams;
  const date = (v: string | null, end = false) =>
    v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T${end ? "23:59:59.999" : "00:00:00.000"}Z` : undefined;
  const voter = p.get("voter");
  return {
    from: date(p.get("from")),
    to: date(p.get("to"), true),
    voter: (VOTER_TYPES as readonly string[]).includes(voter ?? "") ? (voter as VoterType) : undefined,
    restaurant: p.get("restaurant")?.slice(0, 150) || undefined,
  };
}

export async function loadFiltered(filter: AnalyticsFilter) {
  const store = getStore();
  const [all, decorations] = await Promise.all([
    store.listResponses({ from: filter.from, to: filter.to }),
    store.listDecorations(),
  ]);
  const matches = (r: ResponseRow) =>
    (!filter.voter || r.voter_type === filter.voter) &&
    (!filter.restaurant || r.selected_restaurant === filter.restaurant);
  const scoped = all.filter(matches);
  return { started: scoped, completed: scoped.filter((r) => r.completed_at), decorations };
}

export function summarize(started: ResponseRow[], completed: ResponseRow[], decorations: Decoration[]): Summary {
  const total = completed.length;

  const byDecoration = decorations.map<DecorationResult>((d) => {
    const votes = completed.filter((r) => r.selected_decoration_id === d.id);
    return {
      id: d.id,
      restaurant_name: d.restaurant_name,
      image_url: d.image_url,
      votes: votes.length,
      share: total ? votes.length / total : 0,
      client: votes.filter((r) => r.voter_type === "client").length,
      employee: votes.filter((r) => r.voter_type === "employee").length,
    };
  });
  byDecoration.sort((a, b) => b.votes - a.votes || a.restaurant_name.localeCompare(b.restaurant_name, "fr"));

  const perDay = new Map<string, number>();
  for (const r of completed) {
    const day = (r.completed_at ?? r.created_at).slice(0, 10);
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
  }
  const timeline = fillDays([...perDay.entries()].sort(([a], [b]) => a.localeCompare(b)));

  return {
    kpis: {
      totalVotes: total,
      clients: completed.filter((r) => r.voter_type === "client").length,
      employees: completed.filter((r) => r.voter_type === "employee").length,
      raffleParticipants: completed.filter(isRaffleEntry).length,
      started: started.length,
      completionRate: started.length ? total / started.length : 0,
    },
    byDecoration,
    impact: IMPACTS.map((key) => ({ key, count: completed.filter((r) => r.decoration_impact === key).length })),
    timeline,
    byVoter: VOTER_TYPES.map((key) => ({ key, votes: completed.filter((r) => r.voter_type === key).length })),
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
