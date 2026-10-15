"use client";

import { MEDIA_LIMITS } from "@/lib/schema";
import { withBase } from "@/lib/base-path";

/**
 * Préparation des médias dans le navigateur, avant l'envoi :
 * - photos : redressées (EXIF), réduites à 2048 px, ré-encodées en JPEG — ce qui retire aussi
 *   les métadonnées (position GPS du téléphone) et convertit le HEIC quand le navigateur le lit ;
 * - vidéos : vérifiées (lisibles par le navigateur, 50 Mo max) et dotées d'une affiche JPEG.
 * Les fichiers partent ensuite directement vers le stockage, avec une barre de progression.
 */

export type PreparedMedia = {
  kind: "image" | "video";
  file: Blob;
  type: string;
  poster?: Blob;
  warning?: string;
};

const MB = 1024 * 1024;
const fmtMb = (bytes: number) => `${(bytes / MB).toFixed(bytes < 10 * MB ? 1 : 0).replace(".", ",")} Mo`;

export async function prepareMedia(file: File): Promise<PreparedMedia> {
  const name = file.name.toLowerCase();
  if (file.type.startsWith("video/") || /\.(mp4|mov|m4v|webm)$/.test(name)) return prepareVideo(file);
  if (file.type.startsWith("image/") || /\.(jpe?g|png|webp|avif|heic|heif)$/.test(name)) return prepareImage(file);
  throw new Error("Format non pris en charge (photo ou vidéo uniquement).");
}

/** Photos uniquement (image d'un lot). */
export async function prepareImageOnly(file: File): Promise<PreparedMedia> {
  const name = file.name.toLowerCase();
  if (file.type.startsWith("image/") || /\.(jpe?g|png|webp|avif|heic|heif)$/.test(name)) return prepareImage(file);
  throw new Error("Format non pris en charge (photo uniquement).");
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Conversion impossible"))), type, quality),
  );
}

function drawScaled(source: CanvasImageSource, w: number, h: number, max: number) {
  const scale = Math.min(1, max / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

async function decodeImage(file: File): Promise<{ source: CanvasImageSource; w: number; h: number }> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { source: bmp, w: bmp.width, h: bmp.height };
  } catch {
    // Repli : certains navigateurs ne décodent le HEIC que via <img>.
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return { source: img, w: img.naturalWidth, h: img.naturalHeight };
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

async function prepareImage(file: File): Promise<PreparedMedia> {
  let decoded;
  try {
    decoded = await decodeImage(file);
  } catch {
    throw new Error(
      "Photo illisible par ce navigateur (format HEIC ?). Envoyez-la depuis un iPhone avec Safari, ou réglez l'iPhone sur Réglages › Appareil photo › Formats › « Le plus compatible ».",
    );
  }
  const blob = await canvasToBlob(drawScaled(decoded.source, decoded.w, decoded.h, 2048), "image/jpeg", 0.86);
  if (blob.size > MEDIA_LIMITS.imageBytes) throw new Error("Photo trop lourde, même après compression.");
  return { kind: "image", file: blob, type: "image/jpeg" };
}

function once(el: HTMLMediaElement, ok: string, timeoutMs: number) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
    const done = (fn: () => void) => () => {
      clearTimeout(timer);
      el.removeEventListener(ok, onOk);
      el.removeEventListener("error", onErr);
      fn();
    };
    const onOk = done(resolve);
    const onErr = done(() => reject(new Error("error")));
    el.addEventListener(ok, onOk);
    el.addEventListener("error", onErr);
  });
}

/** Repère le codec HEVC (H.265) dans les premiers / derniers octets du fichier. */
async function looksHevc(file: File) {
  const chunk = 4 * MB;
  const parts = [file.slice(0, chunk), file.slice(Math.max(0, file.size - chunk))];
  for (const p of parts) {
    const text = new TextDecoder("latin1").decode(await p.arrayBuffer());
    if (text.includes("hvc1") || text.includes("hev1")) return true;
  }
  return false;
}

async function prepareVideo(file: File): Promise<PreparedMedia> {
  if (file.size > MEDIA_LIMITS.videoBytes) {
    throw new Error(`Vidéo trop lourde (${fmtMb(file.size)}, 50 Mo max). Raccourcissez-la ou exportez-la en 720p.`);
  }
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;
  let poster: Blob;
  try {
    // iOS ne précharge rien sans lecture : une lecture muette déclenche le chargement.
    const loaded = once(video, "loadeddata", 20_000);
    void video.play().catch(() => undefined);
    await loaded;
    video.pause();
    try {
      video.currentTime = Math.min(0.5, (video.duration || 1) / 3);
      await once(video, "seeked", 5_000);
    } catch {
      /* pas de saut possible : on garde l'image courante */
    }
    if (!video.videoWidth) throw new Error("empty");
    poster = await canvasToBlob(drawScaled(video, video.videoWidth, video.videoHeight, 1280), "image/jpeg", 0.82);
  } catch {
    throw new Error(
      "Vidéo illisible par ce navigateur (codec HEVC / H.265 ?). Exportez-la en MP4 (H.264), ou réglez l'iPhone sur « Le plus compatible ».",
    );
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }

  const warnings: string[] = [];
  if (await looksHevc(file)) {
    warnings.push("Vidéo en HEVC : lisible sur les téléphones récents, mais pas sur certains ordinateurs. L'idéal est le H.264 (« Le plus compatible » sur iPhone).");
  }
  if (file.size > 20 * MB) {
    warnings.push(`Vidéo lourde (${fmtMb(file.size)}) : chaque lecture consomme du forfait des votants et du quota Supabase. Visez moins de 20 Mo (30 s en 720p).`);
  }
  return {
    kind: "video",
    file,
    type: file.type === "video/webm" ? "video/webm" : "video/mp4", // .mov (iPhone) servi comme MP4
    poster,
    warning: warnings.join(" ") || undefined,
  };
}

// ---------------------------------------------------------------------------

function send(method: "PUT" | "POST" | "PATCH", url: string, body: Blob | FormData, headers: Record<string, string>, onProgress?: (p: number) => void) {
  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve(xhr.responseText);
      let message = `Échec de l'envoi (${xhr.status})`;
      try {
        const body = JSON.parse(xhr.responseText) as { error?: string; message?: string };
        message = body.error ?? body.message ?? message;
      } catch {
        /* réponse non JSON */
      }
      reject(new Error(message));
    };
    xhr.onerror = () => reject(new Error("Connexion perdue pendant l'envoi."));
    xhr.send(body);
  });
}

async function sendJson(method: "POST" | "PATCH", url: string, data: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown> & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `Erreur ${res.status}`);
  return body;
}

type Target = { signedUrl: string; publicUrl: string };

/**
 * Envoie un média préparé vers le stockage (Supabase : URL signée, directement depuis le navigateur).
 * Renvoie son URL publique, ou null en stockage local : le fichier doit alors partir en multipart
 * avec la ressource (décoration, lot) qui le reçoit.
 */
export async function storeMedia(media: PreparedMedia, onProgress: (p: number) => void): Promise<string | null> {
  const plan = (await sendJson("POST", withBase("/api/decorations/upload"), { type: media.type, poster: !!media.poster })) as
    | { mode: "form" }
    | { mode: "direct"; media: Target; poster: Target | null };
  if (plan.mode === "form") return null;
  const headers = (type: string) => ({ "content-type": type, "cache-control": "max-age=31536000", "x-upsert": "false" });
  if (media.poster && plan.poster) await send("PUT", plan.poster.signedUrl, media.poster, headers("image/jpeg"));
  await send("PUT", plan.media.signedUrl, media.file, headers(media.type), onProgress);
  return plan.media.publicUrl;
}

const asFile = (media: PreparedMedia) => new File([media.file], `media.${media.type.split("/")[1]}`, { type: media.type });

/** Envoie un média préparé et l'ajoute au restaurant. */
export async function uploadMedia(restaurant: string, media: PreparedMedia, onProgress: (p: number) => void) {
  const url = await storeMedia(media, onProgress);
  if (url === null) {
    const form = new FormData();
    form.set("restaurant_name", restaurant);
    form.set("media", asFile(media));
    if (media.poster) form.set("poster", new File([media.poster], "poster.jpg", { type: "image/jpeg" }));
    await send("POST", withBase("/api/decorations"), form, {}, onProgress);
    return;
  }
  await sendJson("POST", withBase("/api/decorations"), { restaurant_name: restaurant, image_url: url });
}

/** Crée un lot, avec son image éventuelle (même chaîne d'envoi que les décorations). */
export async function createPrize(fields: { name: string; description: string }, image: PreparedMedia | null, onProgress: (p: number) => void) {
  const url = image ? await storeMedia(image, onProgress) : null;
  if (image && url === null) {
    const form = new FormData();
    form.set("name", fields.name);
    form.set("description", fields.description);
    form.set("image", asFile(image));
    await send("POST", withBase("/api/prizes"), form, {}, onProgress);
    return;
  }
  await sendJson("POST", withBase("/api/prizes"), { ...fields, image_url: url });
}

/** Remplace l'image d'un lot (l'ancienne est supprimée par le serveur). */
export async function replacePrizeImage(prizeId: string, image: PreparedMedia, onProgress: (p: number) => void) {
  const url = await storeMedia(image, onProgress);
  if (url === null) {
    const form = new FormData();
    form.set("image", asFile(image));
    await send("PATCH", withBase(`/api/prizes/${prizeId}`), form, {}, onProgress);
    return;
  }
  await sendJson("PATCH", withBase(`/api/prizes/${prizeId}`), { image_url: url });
}
