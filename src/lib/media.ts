import "server-only";
import { randomUUID } from "node:crypto";
import type { Store } from "./db";
import { MEDIA_LIMITS, MEDIA_TYPES } from "./schema";

/**
 * Image d'un lot reçue en multipart (stockage local) : vérifiée puis enregistrée sous un nom
 * généré par le serveur (conforme à FILE_NAME_RE). Renvoie l'URL, null sans fichier, ou un message d'erreur.
 */
export async function savePrizeImage(store: Store, file: FormDataEntryValue | null): Promise<string | null | { error: string }> {
  if (!(file instanceof File) || file.size === 0) return null;
  const ext = MEDIA_TYPES[file.type];
  if (!ext || file.type.startsWith("video/")) return { error: "Format accepté : JPG, PNG, WebP ou AVIF" };
  if (file.size > MEDIA_LIMITS.imageBytes) return { error: "Image trop lourde" };
  return store.saveFile(file, `${randomUUID()}.${ext}`);
}
