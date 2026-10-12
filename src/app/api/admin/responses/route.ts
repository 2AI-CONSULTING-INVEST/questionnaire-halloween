import { getStore } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { json } from "@/lib/http";

/** Admin : toutes les réponses (les plus récentes d'abord). */
export async function GET() {
  const denied = await requireRole("viewer");
  if (denied) return denied;
  const rows = await getStore().listResponses();
  rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return json(rows, { headers: { "Cache-Control": "no-store" } });
}
