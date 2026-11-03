import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { CONTEST_KEY, contestPatchSchema, loadContest } from "@/lib/contest";
import { getStore } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { error, json, readJson, zodError } from "@/lib/http";
import { MEDIA_LIMITS, MEDIA_TYPES, mediaKind, posterOf } from "@/lib/schema";

/** Backoffice : état du concours, liens des publications et vidéo du tirage. */
export async function GET() {
  const denied = await requireRole("viewer");
  if (denied) return denied;
  return json(await loadContest(getStore()));
}

/**
 * Admin (journalisé) : fin / réouverture du concours, liens des posts du tirage, vidéo du tirage
 * (déjà envoyée au stockage ; null la retire). L'ancienne vidéo et son affiche sont supprimées.
 * Toutes les pages publiques sont régénérées (accueil, décor de l'accueil, page du tirage).
 */
export async function PATCH(req: Request) {
  const denied = await requireRole("admin", req);
  if (denied) return denied;
  const body = await readJson(req);
  if (body instanceof Response) return body;
  const parsed = contestPatchSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);
  const patch = parsed.data;

  const store = getStore();
  const current = await loadContest(store);
  const next = { ...current };
  if (patch.closed !== undefined && patch.closed !== current.closed) {
    next.closed = patch.closed;
    next.closed_at = patch.closed ? new Date().toISOString() : null;
  }
  if (patch.instagram_url !== undefined) next.instagram_url = patch.instagram_url;
  if (patch.tiktok_url !== undefined) next.tiktok_url = patch.tiktok_url;
  if (patch.video_url !== undefined) {
    const url = patch.video_url;
    // L'URL doit désigner une vidéo de notre stockage, bel et bien envoyée.
    if (url !== null && (mediaKind(url) !== "video" || !store.isOwnFile(url) || !(await store.fileExists(url)))) return error("Fichier inconnu");
    next.video_url = url;
  }

  await store.setSetting(CONTEST_KEY, next);
  if (current.video_url && current.video_url !== next.video_url) await store.removeFiles([current.video_url, posterOf(current.video_url)]);
  revalidatePath("/", "layout");
  return json(next);
}

/** Admin, stockage local (développement) : reçoit la vidéo du tirage en multipart { media, poster? } et renvoie son URL. */
export async function POST(req: Request) {
  const denied = await requireRole("admin", req);
  if (denied) return denied;
  const form = await req.formData().catch(() => null);
  if (!form) return error("Formulaire invalide");
  const media = form.get("media");
  const poster = form.get("poster");
  if (!(media instanceof File) || media.size === 0) return error("Fichier requis");
  const ext = MEDIA_TYPES[media.type];
  if (!ext || !media.type.startsWith("video/")) return error("Format accepté : MP4 ou WebM");
  if (media.size > MEDIA_LIMITS.videoBytes) return error("Fichier trop lourd");
  const store = getStore();
  const id = randomUUID();
  const url = await store.saveFile(media, `${id}.${ext}`);
  if (poster instanceof File && poster.type === "image/jpeg" && poster.size < MEDIA_LIMITS.imageBytes) await store.saveFile(poster, `${id}.poster.jpg`);
  return json({ video_url: url }, 201);
}
