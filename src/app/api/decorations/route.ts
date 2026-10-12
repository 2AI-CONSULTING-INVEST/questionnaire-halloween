import { revalidatePath } from "next/cache";
import { getStore } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { error, json } from "@/lib/http";

const MAX_BYTES = 8 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

export async function GET() {
  return json(await getStore().listDecorations());
}

/** Admin : ajout d'une photo de décoration (multipart : restaurant_name, image, display_order). */
export async function POST(req: Request) {
  const denied = await requireRole("admin");
  if (denied) return denied;

  const form = await req.formData().catch(() => null);
  if (!form) return error("Formulaire invalide");
  const name = String(form.get("restaurant_name") ?? "").trim();
  const order = Number(form.get("display_order") ?? 0);
  const image = form.get("image");

  if (name.length < 2 || name.length > 150) return error("Nom du restaurant requis");
  if (!(image instanceof File) || image.size === 0) return error("Image requise");
  if (!TYPES.includes(image.type)) return error("Format accepté : JPG, PNG, WebP ou AVIF");
  if (image.size > MAX_BYTES) return error("Image trop lourde (8 Mo max)");

  const store = getStore();
  const imageUrl = await store.uploadImage(image);
  const deco = await store.addDecoration({
    restaurant_name: name,
    image_url: imageUrl,
    display_order: Number.isFinite(order) ? Math.trunc(order) : 0,
  });
  revalidatePath("/");
  return json(deco, 201);
}
