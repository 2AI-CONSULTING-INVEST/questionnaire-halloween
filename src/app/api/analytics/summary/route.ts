import { getSummary, parseFilter } from "@/lib/analytics";
import { requireRole } from "@/lib/guard";
import { json } from "@/lib/http";

/** Admin : statistiques du tableau de bord. Filtres : ?from=YYYY-MM-DD&to=YYYY-MM-DD&voter=client|employee&restaurant=... */
export async function GET(req: Request) {
  const denied = await requireRole("viewer");
  if (denied) return denied;
  return json(await getSummary(parseFilter(new URL(req.url))), { headers: { "Cache-Control": "no-store" } });
}
