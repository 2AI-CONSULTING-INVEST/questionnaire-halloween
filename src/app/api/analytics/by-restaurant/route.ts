import { getSummary, parseFilter } from "@/lib/analytics";
import { requireRole } from "@/lib/guard";
import { json } from "@/lib/http";

/** Admin : votes par restaurant (tous ses médias confondus). */
export async function GET(req: Request) {
  const denied = await requireRole("viewer");
  if (denied) return denied;
  const { byDecoration, kpis } = await getSummary(parseFilter(new URL(req.url)));
  return json({ total: kpis.totalVotes, results: byDecoration }, { headers: { "Cache-Control": "no-store" } });
}
