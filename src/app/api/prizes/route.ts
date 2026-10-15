import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getStore } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { error, json, readJson, zodError } from "@/lib/http";
import { savePrizeImage } from "@/lib/media";
import { prizeDescriptionSchema, prizeNameSchema } from "@/lib/schema";

/** Admin : liste des lots (gagnants compris). */
export async function GET() {
  const denied = await requireRole("viewer");
  if (denied) return denied;
  return json(await getStore().listPrizes(), { headers: { "Cache-Control": "no-store" } });
}

const jsonSchema = z
  .object({
    name: prizeNameSchema,
    description: prizeDescriptionSchema.optional(),
    image_url: z.string().url().max(500).nullable().optional(),
  })
  .strict();

/**
 * Admin : crée un lot.
 * - JSON { name, description, image_url? } : image déjà envoyée au stockage (voir /api/decorations/upload).
 * - multipart { name, description, image? } : stockage local (développement).
 */
export async function POST(req: Request) {
  const denied = await requireRole("admin");
  if (denied) return denied;
  const store = getStore();

  let fields: z.infer<typeof jsonSchema>;
  let imageUrl: string | null = null;
  if (req.headers.get("content-type")?.includes("application/json")) {
    const parsed = jsonSchema.safeParse(await readJson(req));
    if (!parsed.success) return zodError(parsed.error);
    fields = parsed.data;
    if (fields.image_url && !store.isOwnFile(fields.image_url)) return error("Fichier inconnu");
    imageUrl = fields.image_url ?? null;
  } else {
    const form = await req.formData().catch(() => null);
    if (!form) return error("Formulaire invalide");
    const parsed = jsonSchema.safeParse({ name: String(form.get("name") ?? ""), description: String(form.get("description") ?? "") });
    if (!parsed.success) return zodError(parsed.error);
    fields = parsed.data;
    const saved = await savePrizeImage(store, form.get("image"));
    if (saved && typeof saved === "object") return error(saved.error);
    imageUrl = saved;
  }

  const prizes = await store.listPrizes();
  const prize = await store.addPrize({
    name: fields.name,
    description: fields.description || null,
    image_url: imageUrl,
    display_order: Math.max(-1, ...prizes.map((p) => p.display_order)) + 1,
  });
  revalidatePath("/participants");
  return json(prize, 201);
}
