import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getStore } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { error, isUuid, json, readJson, zodError } from "@/lib/http";

const excludeSchema = z.object({ excluded: z.boolean() }).strict();

/** Admin : détail d'une réponse (id ou session_id). */
export async function GET(_req: Request, ctx: RouteContext<"/api/responses/[id]">) {
  const denied = await requireRole("viewer");
  if (denied) return denied;
  const { id } = await ctx.params;
  if (!isUuid(id)) return error("Introuvable", 404);
  const row = await getStore().getResponse(id);
  return row ? json(row) : error("Introuvable", 404);
}

/** Admin : exclusion du classement (`{ excluded: true }`) ou réintégration (`false`), réversible, journalisée. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/responses/[id]">) {
  const denied = await requireRole("admin", req);
  if (denied) return denied;
  const { id } = await ctx.params;
  if (!isUuid(id)) return error("Introuvable", 404);
  const parsed = excludeSchema.safeParse(await readJson(req));
  if (!parsed.success) return zodError(parsed.error);
  const row = await getStore().getResponse(id);
  if (!row) return error("Introuvable", 404);
  await getStore().setExcluded(row.id, parsed.data.excluded);
  revalidatePath("/resultats");
  return json({ ok: true });
}

/** Admin : suppression d'une réponse. */
export async function DELETE(req: Request, ctx: RouteContext<"/api/responses/[id]">) {
  const denied = await requireRole("admin", req);
  if (denied) return denied;
  const { id } = await ctx.params;
  if (!isUuid(id)) return error("Introuvable", 404);
  await getStore().deleteResponse(id);
  revalidatePath("/resultats");
  return json({ ok: true });
}
