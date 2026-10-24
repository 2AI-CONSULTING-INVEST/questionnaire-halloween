import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getStore } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { error, isUuid, json, readJson, zodError } from "@/lib/http";
import { mediaKind, posterOf } from "@/lib/schema";

const patchSchema = z
  .object({
    restaurant_name: z.string().trim().min(2).max(150),
    display_order: z.number().int().min(0).max(100_000),
  })
  .partial()
  .strict();

export async function PATCH(req: Request, ctx: RouteContext<"/api/decorations/[id]">) {
  const denied = await requireRole("admin", req);
  if (denied) return denied;
  const { id } = await ctx.params;
  if (!isUuid(id)) return error("Introuvable", 404);
  const parsed = patchSchema.safeParse(await readJson(req));
  if (!parsed.success) return zodError(parsed.error);
  await getStore().updateDecoration(id, parsed.data);
  revalidatePath("/");
  revalidatePath("/resultats");
  return json({ ok: true });
}

/**
 * Supprime un média. Les votes sont rattachés au restaurant : ils passent sur un autre
 * média du même restaurant. Le dernier média d'un restaurant déjà voté ne peut pas être supprimé.
 */
export async function DELETE(req: Request, ctx: RouteContext<"/api/decorations/[id]">) {
  const denied = await requireRole("admin", req);
  if (denied) return denied;
  const { id } = await ctx.params;
  if (!isUuid(id)) return error("Introuvable", 404);

  const store = getStore();
  const decorations = await store.listDecorations();
  const deco = decorations.find((d) => d.id === id);
  if (!deco) return error("Introuvable", 404);

  const sibling = decorations.find((d) => d.restaurant_name === deco.restaurant_name && d.id !== id);
  if (sibling) {
    await store.moveVotes(id, sibling.id);
  } else {
    const votes = await store.countVotes(id);
    if (votes > 0) {
      return error(
        `Impossible : c'est le dernier média de ce restaurant et il a déjà ${votes} vote${votes > 1 ? "s" : ""}. Ajoutez d'abord un autre média.`,
        409,
      );
    }
  }

  await store.deleteDecoration(id);
  await store.removeFiles(mediaKind(deco.image_url) === "video" ? [deco.image_url, posterOf(deco.image_url)] : [deco.image_url]);
  revalidatePath("/");
  revalidatePath("/resultats");
  return json({ ok: true });
}
