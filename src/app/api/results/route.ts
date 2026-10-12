import { json, limited } from "@/lib/http";
import { getPublicResults } from "@/lib/public-results";

/** Public : résultats en direct (sans données personnelles). */
export async function GET(req: Request) {
  const blocked = limited(req, "results", 60);
  if (blocked) return blocked;
  return json(await getPublicResults(), {
    headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30" },
  });
}
