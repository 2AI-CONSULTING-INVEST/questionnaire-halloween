import { revalidatePath } from "next/cache";
import { getStore } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { error, isUuid, json } from "@/lib/http";

export async function DELETE(_req: Request, ctx: RouteContext<"/api/restaurants/[id]">) {
  const denied = await requireRole("admin");
  if (denied) return denied;
  const { id } = await ctx.params;
  if (!isUuid(id)) return error("Introuvable", 404);
  await getStore().deleteRestaurant(id);
  revalidatePath("/");
  return json({ ok: true });
}
