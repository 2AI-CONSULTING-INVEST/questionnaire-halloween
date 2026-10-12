import { getSummary, parseFilter } from "@/lib/analytics";
import { requireRole } from "@/lib/guard";
import { json } from "@/lib/http";

/** Admin : votes clients vs employés, globalement et par décoration. */
export async function GET(req: Request) {
  const denied = await requireRole("viewer");
  if (denied) return denied;
  const { byVoter, byDecoration } = await getSummary(parseFilter(new URL(req.url)));
  return json(
    {
      byVoter,
      byDecoration: byDecoration.map(({ id, restaurant_name, client, employee }) => ({ id, restaurant_name, client, employee })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
