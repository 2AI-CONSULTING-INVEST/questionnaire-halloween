import { getStore } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { error, isUuid, json } from "@/lib/http";

/** Admin (écriture, journalisé) : révoque une session du backoffice ; son jeton est refusé dès la requête suivante. */
export async function POST(req: Request, ctx: RouteContext<"/api/admin/sessions/[id]/revoke">) {
  const denied = await requireRole("admin", req);
  if (denied) return denied;
  const { id } = await ctx.params;
  if (!isUuid(id)) return error("Introuvable", 404);
  const store = getStore();
  if (!(await store.getAdminSession(id))) return error("Introuvable", 404);
  await store.revokeAdminSession(id);
  return json({ ok: true });
}
