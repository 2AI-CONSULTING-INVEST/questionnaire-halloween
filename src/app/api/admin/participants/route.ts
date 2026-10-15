import { getStore } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { json } from "@/lib/http";

/** Admin : tous les participants au tirage (les plus récents d'abord). */
export async function GET() {
  const denied = await requireRole("viewer");
  if (denied) return denied;
  return json(await getStore().listParticipants(), { headers: { "Cache-Control": "no-store" } });
}
