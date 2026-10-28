import { currentSession } from "@/lib/auth";
import { getStore } from "@/lib/db";
import { attemptView, loadReview } from "@/lib/fraud-server";
import { requireRole } from "@/lib/guard";
import { json } from "@/lib/http";

/**
 * Admin (lecture, rôle lecture seule compris) : notifications de l'en-tête. Nombre de votes en attente et
 * derniers votes suspects et frauduleux (l'état « vu » est gardé par chaque navigateur d'admin).
 */
export async function GET() {
  const denied = await requireRole("viewer");
  if (denied) return denied;
  const viewerOnly = (await currentSession())?.role !== "admin";
  const data = await loadReview(getStore());
  const view = (id: string) => attemptView(data.rows.get(id)!, data.participants, viewerOnly);
  const latest = [
    ...data.pending.slice(0, 10).map((a) => ({ kind: "suspect" as const, key: a.id, view: view(a.id), count: 1 })),
    ...data.persons.slice(0, 10).map((p) => ({ kind: "fraud" as const, key: p.key, view: view(p.first), count: p.count })),
  ]
    .sort((a, b) => b.view.at.localeCompare(a.view.at))
    .slice(0, 12);
  return json({ pending: data.pending.length, highPriority: data.pending.filter((a) => a.priority).length, latest }, { headers: { "Cache-Control": "no-store" } });
}
