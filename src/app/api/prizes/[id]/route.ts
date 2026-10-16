import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ConflictError, getStore, type PrizePatch } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { conflictError, error, isUuid, json, readJson, zodError } from "@/lib/http";
import { savePrizeImage } from "@/lib/media";
import { prizeDescriptionSchema, prizeNameSchema } from "@/lib/schema";

const patchSchema = z
  .object({
    name: prizeNameSchema,
    description: prizeDescriptionSchema,
    display_order: z.number().int().min(0).max(100_000),
    image_url: z.string().url().max(500).nullable(),
    winner_participant_id: z.string().uuid().nullable(),
  })
  .partial()
  .strict();

/**
 * Admin : modifie un lot (nom, description, ordre, image, gagnant).
 * - JSON : champs ci-dessus ; `image_url` désigne un fichier déjà envoyé au stockage (null = retirer l'image).
 * - multipart { image } : remplace l'image (stockage local).
 * L'ancienne image est supprimée du stockage quand elle est remplacée ou retirée.
 */
export async function PATCH(req: Request, ctx: RouteContext<"/api/prizes/[id]">) {
  const denied = await requireRole("admin");
  if (denied) return denied;
  const { id } = await ctx.params;
  if (!isUuid(id)) return error("Introuvable", 404);
  const store = getStore();
  const prize = await store.getPrize(id);
  if (!prize) return error("Introuvable", 404);

  let patch: PrizePatch;
  if (req.headers.get("content-type")?.includes("application/json")) {
    const parsed = patchSchema.safeParse(await readJson(req));
    if (!parsed.success) return zodError(parsed.error);
    patch = parsed.data;
    if (patch.image_url && !store.isOwnFile(patch.image_url)) return error("Fichier inconnu");
    if (patch.description !== undefined) patch.description = patch.description || null;
  } else {
    const form = await req.formData().catch(() => null);
    if (!form) return error("Formulaire invalide");
    const saved = await savePrizeImage(store, form.get("image"));
    if (saved && typeof saved === "object") return error(saved.error);
    if (!saved) return error("Image requise");
    patch = { image_url: saved };
  }

  try {
    await store.updatePrize(id, patch);
  } catch (e) {
    if (e instanceof ConflictError) {
      if (patch.image_url && patch.image_url !== prize.image_url) await store.removeFiles([patch.image_url]);
      return conflictError(e);
    }
    throw e;
  }
  if (patch.image_url !== undefined && prize.image_url && prize.image_url !== patch.image_url) await store.removeFiles([prize.image_url]);
  revalidatePath("/participants");
  revalidatePath("/"); // lots proposés dans la confirmation du « Non » au tirage
  return json({ ok: true });
}

/** Admin : supprime un lot et son image. */
export async function DELETE(_req: Request, ctx: RouteContext<"/api/prizes/[id]">) {
  const denied = await requireRole("admin");
  if (denied) return denied;
  const { id } = await ctx.params;
  if (!isUuid(id)) return error("Introuvable", 404);
  const store = getStore();
  const prize = await store.getPrize(id);
  if (!prize) return error("Introuvable", 404);
  await store.deletePrize(id);
  if (prize.image_url) await store.removeFiles([prize.image_url]);
  revalidatePath("/participants");
  revalidatePath("/"); // lots proposés dans la confirmation du « Non » au tirage
  return json({ ok: true });
}
