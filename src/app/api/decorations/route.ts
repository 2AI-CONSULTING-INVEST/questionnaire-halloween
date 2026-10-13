import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getStore } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { error, json, readJson, zodError } from "@/lib/http";
import { MEDIA_LIMITS, MEDIA_TYPES, mediaKind } from "@/lib/schema";

export async function GET() {
  return json(await getStore().listDecorations());
}

const directSchema = z.object({
  restaurant_name: z.string().trim().min(2).max(150),
  image_url: z.string().url().max(500),
});

/**
 * Admin : ajoute une photo ou une vidéo à un restaurant (question 3).
 * - JSON { restaurant_name, image_url } : fichier déjà envoyé au stockage (voir /api/decorations/upload).
 * - multipart { restaurant_name, media, poster? } : stockage local (développement).
 */
export async function POST(req: Request) {
  const denied = await requireRole("admin");
  if (denied) return denied;
  const store = getStore();

  let restaurantName: string;
  let imageUrl: string;

  if (req.headers.get("content-type")?.includes("application/json")) {
    const parsed = directSchema.safeParse(await readJson(req));
    if (!parsed.success) return zodError(parsed.error);
    if (!store.isOwnFile(parsed.data.image_url)) return error("Fichier inconnu");
    restaurantName = parsed.data.restaurant_name;
    imageUrl = parsed.data.image_url;
  } else {
    const form = await req.formData().catch(() => null);
    if (!form) return error("Formulaire invalide");
    restaurantName = String(form.get("restaurant_name") ?? "").trim();
    const media = form.get("media");
    const poster = form.get("poster");
    if (!(media instanceof File) || media.size === 0) return error("Fichier requis");
    const ext = MEDIA_TYPES[media.type];
    if (!ext) return error("Format accepté : JPG, PNG, WebP, AVIF, MP4 ou WebM");
    const isVideo = media.type.startsWith("video/");
    if (media.size > (isVideo ? MEDIA_LIMITS.videoBytes : MEDIA_LIMITS.imageBytes)) return error("Fichier trop lourd");
    const id = randomUUID();
    imageUrl = await store.saveFile(media, `${id}.${ext}`);
    if (isVideo && poster instanceof File && poster.type === "image/jpeg" && poster.size < MEDIA_LIMITS.imageBytes) {
      await store.saveFile(poster, `${id}.poster.jpg`);
    }
  }

  const [restaurants, decorations] = await Promise.all([store.listRestaurants(), store.listDecorations()]);
  if (!restaurants.some((r) => r.name === restaurantName)) {
    await store.removeFiles([imageUrl]);
    return error("Restaurant inconnu : ajoutez-le d'abord dans l'onglet « Restaurants »");
  }

  const deco = await store.addDecoration({
    restaurant_name: restaurantName,
    image_url: imageUrl,
    display_order: Math.max(-1, ...decorations.map((d) => d.display_order)) + 1,
  });
  revalidatePath("/");
  revalidatePath("/resultats");
  return json({ ...deco, kind: mediaKind(deco.image_url) }, 201);
}
