import { getStore } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { json } from "@/lib/http";

/** Admin (écriture) : journal des sessions du backoffice, de leurs actions et des échecs de connexion (24 h, 20 derniers). */
export async function GET() {
  const denied = await requireRole("admin");
  if (denied) return denied;
  const store = getStore();
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const [journal, last24h, recent] = await Promise.all([store.listAdminSessions(), store.countLoginFailures(since), store.listLoginFailures(20)]);
  return json({ ...journal, failures: { last24h, recent } }, { headers: { "Cache-Control": "no-store" } });
}
