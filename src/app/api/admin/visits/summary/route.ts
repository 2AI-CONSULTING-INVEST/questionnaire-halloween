import { serverNow } from "@/lib/clock";
import { parisDay } from "@/lib/day";
import { getStore } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { json } from "@/lib/http";
import { summarizeVisits } from "@/lib/visits";

/** Admin (lecture) : KPI du compteur de visites (jour à Paris et total), appareils, provenances, navigateurs, série par jour. */
export async function GET(req: Request) {
  const denied = await requireRole("viewer");
  if (denied) return denied;
  const rows = await getStore().listVisits();
  return json(summarizeVisits(rows, parisDay(serverNow(req))), { headers: { "Cache-Control": "no-store" } });
}
