import { currentSession } from "@/lib/auth";
import { getStore } from "@/lib/db";
import { attemptView, loadReview } from "@/lib/fraud-server";
import type { FraudList, PendingList } from "@/lib/fraud-review";
import { requireRole } from "@/lib/guard";
import { error, json } from "@/lib/http";

/**
 * Admin (lecture) : listes de l'onglet Sécurité. `kind=fraud` : « Votes frauduleux », une ligne par personne
 * et par jour (pagination par personne) ; `kind=pending` : « Votes suspects en attente », priorité haute en tête.
 */
export async function GET(req: Request) {
  const denied = await requireRole("viewer");
  if (denied) return denied;
  const viewerOnly = (await currentSession())?.role !== "admin";
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind");
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 20));
  if (kind !== "fraud" && kind !== "pending") return error("kind attendu : fraud ou pending");
  const data = await loadReview(getStore());
  const view = (id: string) => attemptView(data.rows.get(id)!, data.participants, viewerOnly);
  if (kind === "fraud") {
    const body: FraudList = {
      kind,
      total: data.persons.length,
      items: data.persons.slice(offset, offset + limit).map((p) => ({
        key: p.key,
        day: p.day,
        first: p.first,
        count: p.count,
        firstAtMs: p.firstAtMs,
        lastAtMs: p.lastAtMs,
        recidivism: p.recidivism,
        firstView: view(p.first),
        members: p.attempts.length,
      })),
    };
    return json(body, { headers: { "Cache-Control": "no-store" } });
  }
  const personOf = new Map<string, string>();
  for (const p of data.persons) for (const id of p.attempts) personOf.set(id, p.key);
  const body: PendingList = {
    kind,
    total: data.pending.length,
    items: data.pending.slice(offset, offset + limit).map((a) => ({ ...view(a.id), personKey: personOf.get(a.id) ?? a.groupId ?? a.id })),
  };
  return json(body, { headers: { "Cache-Control": "no-store" } });
}
