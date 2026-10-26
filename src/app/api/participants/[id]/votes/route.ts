import { currentSession } from "@/lib/auth";
import { getStore } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { error, isUuid, json } from "@/lib/http";
import { redactForViewer } from "@/lib/redact";
import { loadRiskSettings } from "@/lib/risk";

/** Admin (lecture) : tous les votes reliés à un participant, les plus récents d'abord, avec le nom de la décoration (sans IP ni appareil en lecture seule). */
export async function GET(_req: Request, ctx: RouteContext<"/api/participants/[id]/votes">) {
  const denied = await requireRole("viewer");
  if (denied) return denied;
  const viewerOnly = (await currentSession())?.role !== "admin";
  const { id } = await ctx.params;
  if (!isUuid(id)) return error("Introuvable", 404);
  const store = getStore();
  const [rows, decorations, settings] = await Promise.all([store.listResponses({ participantId: id }), store.listDecorations(), loadRiskSettings(store)]);
  const name = new Map(decorations.map((d) => [d.id, d.restaurant_name]));
  const votes = rows
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((r) => ({ ...(viewerOnly ? redactForViewer(r) : r), decoration: r.selected_decoration_id ? (name.get(r.selected_decoration_id) ?? null) : null }));
  return json({ votes, settings }, { headers: { "Cache-Control": "no-store" } });
}
