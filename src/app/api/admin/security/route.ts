import { currentSession } from "@/lib/auth";
import { serverNow } from "@/lib/clock";
import { parisDay } from "@/lib/day";
import { getStore } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { json } from "@/lib/http";
import { maskIp } from "@/lib/redact";
import { loadRiskSettings, type RiskCounts, type SecuritySummary, type TopEntry } from "@/lib/risk";
import { voteStatus, type ResponseRow } from "@/lib/schema";

/** Compteurs d'un ensemble de lignes : comptés, en attente, bloqués, exclus automatiquement, exclus à la main. */
function countOf(rows: ResponseRow[]): RiskCounts {
  const c: RiskCounts = { counted: 0, held: 0, blocked: 0, autoExcluded: 0, adminExcluded: 0 };
  for (const r of rows) {
    const s = voteStatus(r);
    if (s === "counted") c.counted++;
    else if (s === "held") c.held++;
    else if (s === "blocked") c.blocked++;
    else if (s === "excluded") {
      if (r.exclusion_source === "auto") c.autoExcluded++;
      else c.adminExcluded++;
    }
  }
  return c;
}

/**
 * Admin (lecture) : réglages, compteurs anti-fraude du jour (Europe/Paris) et depuis le début, votes en
 * attente, top 10 IP (masquées `x.x.x.*` en lecture seule) et clés matérielles du jour (votes comptés).
 */
export async function GET(req: Request) {
  const denied = await requireRole("viewer");
  if (denied) return denied;
  const viewerOnly = (await currentSession())?.role !== "admin";
  const store = getStore();
  const today = parisDay(serverNow(req));
  const [settings, rows, counted, held, blocked, excluded, review] = await Promise.all([
    loadRiskSettings(store),
    store.dayAttempts(today),
    store.countResponses({ status: "completed" }),
    store.countResponses({ status: "held" }),
    store.countResponses({ status: "blocked" }),
    store.countResponses({ status: "excluded" }),
    store.listReviewRows(),
  ]);
  const autoExcluded = review.filter((r) => r.excluded_at && r.exclusion_source === "auto").length;
  const pending = review.filter((r) => voteStatus(r) === "held");
  const top = (key: (r: ResponseRow) => string | null): TopEntry[] => {
    const m = new Map<string, TopEntry>();
    for (const r of rows) {
      const s = voteStatus(r);
      const k = s === "counted" || s === "held" ? key(r) : null;
      if (!k) continue;
      const e = m.get(k) ?? { key: k, votes: 0, held: 0 };
      if (s === "counted") e.votes += 1;
      else e.held += 1;
      m.set(k, e);
    }
    return [...m.values()].sort((a, b) => b.votes + b.held - (a.votes + a.held)).slice(0, 10);
  };
  const summary: SecuritySummary = {
    settings,
    today: countOf(rows),
    total: { counted, held, blocked, autoExcluded, adminExcluded: Math.max(0, excluded - autoExcluded) },
    pending: pending.length,
    highPriority: pending.filter((r) => r.held_priority).length,
    topIps: top((r) => r.ip_address).map((e) => (viewerOnly ? { ...e, key: maskIp(e.key) } : e)),
    topDevices: viewerOnly ? [] : top((r) => r.hw_key?.slice(0, 8) ?? r.device_hash?.slice(0, 8) ?? null),
  };
  return json(summary, { headers: { "Cache-Control": "no-store" } });
}
