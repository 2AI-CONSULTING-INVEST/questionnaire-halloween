import { getStore } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { json } from "@/lib/http";

/** Admin (écriture) : journal des sessions du backoffice et de leurs actions. */
export async function GET() {
  const denied = await requireRole("admin");
  if (denied) return denied;
  return json(await getStore().listAdminSessions());
}
