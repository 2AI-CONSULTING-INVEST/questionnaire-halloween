import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getStore } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { error, isUuid, json, readJson, zodError } from "@/lib/http";

const patchSchema = z
  .object({
    restaurant_name: z.string().trim().min(2).max(150),
    display_order: z.number().int().min(0).max(1000),
  })
  .partial()
  .strict();

export async function PATCH(req: Request, ctx: RouteContext<"/api/decorations/[id]">) {
  const denied = await requireRole("admin");
  if (denied) return denied;
  const { id } = await ctx.params;
  if (!isUuid(id)) return error("Introuvable", 404);
  const parsed = patchSchema.safeParse(await readJson(req));
  if (!parsed.success) return zodError(parsed.error);
  await getStore().updateDecoration(id, parsed.data);
  revalidatePath("/");
  return json({ ok: true });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/decorations/[id]">) {
  const denied = await requireRole("admin");
  if (denied) return denied;
  const { id } = await ctx.params;
  if (!isUuid(id)) return error("Introuvable", 404);
  await getStore().deleteDecoration(id);
  revalidatePath("/");
  revalidatePath("/resultats");
  return json({ ok: true });
}
