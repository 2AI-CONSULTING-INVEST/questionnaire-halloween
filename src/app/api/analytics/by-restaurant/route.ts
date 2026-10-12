import { getSummary, parseFilter } from "@/lib/analytics";
import { requireRole } from "@/lib/guard";
import { json } from "@/lib/http";

/** Admin : votes par décoration de restaurant (avec répartition client / employé). */
export async function GET(req: Request) {
  const denied = await requireRole("viewer");
  if (denied) return denied;
  const { byDecoration, kpis } = await getSummary(parseFilter(new URL(req.url)));
  return json({ total: kpis.totalVotes, results: byDecoration }, { headers: { "Cache-Control": "no-store" } });
}
