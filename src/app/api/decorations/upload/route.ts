import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getStore } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { error, json, readJson, zodError } from "@/lib/http";
import { MEDIA_TYPES } from "@/lib/schema";

const bodySchema = z.object({
  type: z.string().refine((t) => t in MEDIA_TYPES, "Format non pris en charge"),
  poster: z.boolean().optional(),
});

/**
 * Admin : prépare l'envoi d'un média.
 * Supabase → URLs signées : le navigateur envoie le fichier directement au stockage (vidéos lourdes).
 * Stockage local → { mode: "form" } : le fichier passe par POST /api/decorations.
 */
export async function POST(req: Request) {
  const denied = await requireRole("admin");
  if (denied) return denied;
  const parsed = bodySchema.safeParse(await readJson(req));
  if (!parsed.success) return zodError(parsed.error);

  const id = randomUUID();
  const store = getStore();
  try {
    const media = await store.createUploadTarget(`${id}.${MEDIA_TYPES[parsed.data.type]}`);
    if (!media) return json({ mode: "form" });
    const poster = parsed.data.poster ? await store.createUploadTarget(`${id}.poster.jpg`) : null;
    return json({ mode: "direct", media, poster });
  } catch (e) {
    return error(e instanceof Error ? e.message : "Stockage indisponible", 502);
  }
}
