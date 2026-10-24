import { serverNow } from "@/lib/clock";
import { parisDay } from "@/lib/day";
import { getStore } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { json } from "@/lib/http";
import { loadRiskSettings, type RiskCounts, type SecuritySummary, type TopEntry } from "@/lib/risk";
import type { ResponseRow } from "@/lib/schema";

/** Admin (lecture) : réglages, KPI anti-fraude du jour (Europe/Paris) et depuis le début, top 10 IP et empreintes du jour. */
export async function GET(req: Request) {
  const denied = await requireRole("viewer");
  if (denied) return denied;
  const store = getStore();
  const today = parisDay(serverNow(req));
  const settings = await loadRiskSettings(store);
  const flag = settings.flag_threshold;
  const [rows, validated, flagged, blocked, excluded, toReview] = await Promise.all([
    store.listResponses({ day: today }),
    store.countResponses({ status: "completed" }),
    store.countResponses({ status: "completed", flaggedFrom: flag }),
    store.countResponses({ status: "blocked" }),
    store.countResponses({ status: "excluded" }),
    store.countResponses({ status: "all", flaggedFrom: flag }),
  ]);
  const counts: RiskCounts = {
    validated: rows.filter((r) => r.completed_at).length,
    flagged: rows.filter((r) => r.completed_at && r.risk_score >= flag).length,
    blocked: rows.filter((r) => r.blocked_at).length,
    excluded: rows.filter((r) => r.excluded_at).length,
  };
  const top = (key: (r: ResponseRow) => string | null): TopEntry[] => {
    const m = new Map<string, TopEntry>();
    for (const r of rows) {
      const k = r.completed_at ? key(r) : null;
      if (!k) continue;
      const e = m.get(k) ?? { key: k, votes: 0, flagged: 0 };
      e.votes += 1;
      if (r.risk_score >= flag) e.flagged += 1;
      m.set(k, e);
    }
    return [...m.values()].sort((a, b) => b.votes - a.votes).slice(0, 10);
  };
  const summary: SecuritySummary = {
    settings,
    today: counts,
    total: { validated, flagged, blocked, excluded },
    toReview,
    topIps: top((r) => r.ip_address),
    topDevices: top((r) => r.device_hash?.slice(0, 8) ?? null),
  };
  return json(summary, { headers: { "Cache-Control": "no-store" } });
}
