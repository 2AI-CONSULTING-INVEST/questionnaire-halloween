import { revalidatePath } from "next/cache";
import { getStore } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { error, isUuid, json } from "@/lib/http";

/** Admin : détail d'une réponse (id ou session_id). */
export async function GET(_req: Request, ctx: RouteContext<"/api/responses/[id]">) {
  const denied = await requireRole("viewer");
  if (denied) return denied;
  const { id } = await ctx.params;
  if (!isUuid(id)) return error("Introuvable", 404);
  const row = await getStore().getResponse(id);
  return row ? json(row) : error("Introuvable", 404);
}

/** Admin : suppression d'une réponse. */
export async function DELETE(_req: Request, ctx: RouteContext<"/api/responses/[id]">) {
  const denied = await requireRole("admin");
  if (denied) return denied;
  const { id } = await ctx.params;
  if (!isUuid(id)) return error("Introuvable", 404);
  await getStore().deleteResponse(id);
  revalidatePath("/resultats");
  return json({ ok: true });
}
