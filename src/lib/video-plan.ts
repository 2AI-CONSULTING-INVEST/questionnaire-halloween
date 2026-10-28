import { MEDIA_LIMITS } from "./schema";

/**
 * Compression des vidéos à l'envoi : règles pures, sans API du navigateur (testées sans ffmpeg).
 * Le but est une image identique à la source : même définition, même cadence, même son.
 * Le poids n'est qu'un résultat : on ne baisse jamais la qualité pour l'atteindre.
 * Le moteur (ffmpeg.wasm) est dans components/admin/video-compress.ts.
 */

/** Qualité x264 constante. À ne changer qu'après mesure (SSIM 0,992 sur les vidéos de test). */
export const VIDEO_CRF = 18;
/** Vitesse d'encodage : ne change pas la qualité à CRF égal, seulement le poids obtenu. */
export const VIDEO_PRESET = "veryfast";
/** En dessous de 10 % de gain, l'original part tel quel. */
export const MIN_GAIN = 0.1;
/** Écart de durée toléré entre la source et la sortie, en secondes. */
export const DURATION_TOLERANCE = 0.1;
/** Écart de cadence toléré (arrondi du journal de ffmpeg), en images par seconde. */
export const FPS_TOLERANCE = 0.05;
/** Au-delà, l'original part (environ 12 s de calcul par seconde de vidéo 1080p sur un PC courant). */
export const COMPRESS_TIMEOUT_MS = 20 * 60_000;
/** Marque posée dans les fichiers déjà traités : jamais deux compressions de suite. */
export const COMPRESSED_TAG = `chamas-x264-crf${VIDEO_CRF}`;

export type Probe = {
  /** Familles de conteneur annoncées par ffmpeg (« mov,mp4,m4a,3gp,3g2,mj2 », « matroska,webm »). */
  format: string;
  duration: number | null;
  codec: string | null;
  pixFmt: string | null;
  /** Indications de couleur entre parenthèses (« tv, bt709, progressive »). */
  color: string;
  width: number | null;
  height: number | null;
  fps: number | null;
  rotation: number;
  audio: string | null;
  comment: string | null;
};

/** Découpe aux virgules de premier niveau (celles entre parenthèses ou crochets restent). */
function splitTop(s: string) {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const c of s) {
    if (c === "(" || c === "[") depth++;
    else if (c === ")" || c === "]") depth--;
    if (c === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
    } else cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** Lit le journal de `ffmpeg -i fichier` (premier fichier, premier flux vidéo et audio). */
export function parseProbe(log: string): Probe {
  const probe: Probe = {
    format: /Input #0, (.+?), from /.exec(log)?.[1] ?? "",
    duration: null,
    codec: null,
    pixFmt: null,
    color: "",
    width: null,
    height: null,
    fps: null,
    rotation: 0,
    audio: null,
    comment: /^\s{4}comment\s*: (.*)$/m.exec(log)?.[1].trim() ?? null,
  };
  const d = /Duration: (\d+):(\d+):([\d.]+)/.exec(log);
  if (d) probe.duration = Number(d[1]) * 3600 + Number(d[2]) * 60 + Number(d[3]);
  const video = /Stream #0:\d+.*?: Video: (.*)$/m.exec(log)?.[1];
  if (video) {
    const fields = splitTop(video);
    probe.codec = fields[0].split(" ")[0];
    const pix = /^(\w+)(?:\((.*)\))?$/.exec(fields[1] ?? "");
    probe.pixFmt = pix?.[1] ?? null;
    probe.color = pix?.[2] ?? "";
    for (const f of fields) {
      const size = /^(\d+)x(\d+)/.exec(f);
      if (size && probe.width === null) [probe.width, probe.height] = [Number(size[1]), Number(size[2])];
      const fps = /^([\d.]+) fps$/.exec(f);
      if (fps) probe.fps = Number(fps[1]);
    }
  }
  const rot = /displaymatrix: rotation of (-?[\d.]+) degrees/.exec(log) ?? /^\s+rotate\s*: (-?\d+)/m.exec(log);
  if (rot) probe.rotation = Number(rot[1]);
  probe.audio = /Stream #0:\d+.*?: Audio: (\w+)/.exec(log)?.[1] ?? null;
  return probe;
}

/** Faut-il tenter la compression ? Seulement du H.264 8 bits SDR en MP4 / MOV, jamais déjà traité. */
export function shouldCompress(p: Probe): { ok: true } | { ok: false; reason: string } {
  if (p.comment === COMPRESSED_TAG) return { ok: false, reason: "vidéo déjà compressée" };
  if (!p.format.includes("mp4")) return { ok: false, reason: "format autre que MP4 ou MOV" };
  if (p.codec !== "h264") return { ok: false, reason: p.codec === "hevc" ? "vidéo en HEVC" : "codec autre que H.264" };
  // yuv420p seul : c'est aussi le format de sortie, donc aucune conversion de couleurs (ni 10 bits, ni plage pleine).
  if (p.pixFmt !== "yuv420p") return { ok: false, reason: "couleurs 10 bits ou format d'image particulier" };
  if (/bt2020|smpte2084|arib-std-b67/.test(p.color)) return { ok: false, reason: "vidéo HDR" };
  if (!p.width || !p.height || !p.fps || !p.duration) return { ok: false, reason: "vidéo non analysable" };
  return { ok: true };
}

/** iPhone, iPad (même en mode « ordinateur ») : ffmpeg.wasm y manque de mémoire et peut fermer l'onglet. */
export function isAppleMobile(userAgent: string, maxTouchPoints: number) {
  return /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}

/** Garde de l'appareil et du poids, avant tout chargement du moteur. */
export function canCompressHere(bytes: number, userAgent: string, maxTouchPoints: number): { ok: true } | { ok: false; reason: string } {
  if (isAppleMobile(userAgent, maxTouchPoints)) return { ok: false, reason: "compression indisponible sur iPhone et iPad" };
  if (bytes > MEDIA_LIMITS.videoInputBytes) return { ok: false, reason: "fichier trop lourd pour être compressé dans le navigateur" };
  return { ok: true };
}

/** Arguments de ffmpeg. Pas de filtre : définition, cadence et horodatages repris tels quels. */
export function encodeArgs(input: string, output: string, p: Probe) {
  const audio = p.audio === null ? [] : p.audio === "aac" ? ["-c:a", "copy"] : ["-c:a", "aac", "-b:a", "192k"];
  return [
    "-i", input,
    "-map", "0:v:0", "-map", "0:a:0?", // un flux vidéo et un flux audio : les pistes de données (position comprise) restent
    "-map_metadata", "-1", "-map_chapters", "-1", // retire les métadonnées, dont la localisation
    "-c:v", "libx264", "-preset", VIDEO_PRESET, "-crf", String(VIDEO_CRF), "-profile:v", "high", "-pix_fmt", "yuv420p",
    "-fps_mode", "passthrough",
    ...audio,
    "-movflags", "+faststart",
    "-metadata", `comment=${COMPRESSED_TAG}`,
    output,
  ];
}

/** Mesures d'une vidéo : journal de ffmpeg plus taille affichée par un élément vidéo (rotation comprise). */
export type Measured = {
  probe: Probe;
  bytes: number;
  displayWidth: number;
  displayHeight: number;
  playable: boolean;
};

/** Garde la sortie seulement si elle est en tout point identique à la source, et nettement plus légère. */
export function decide(source: Measured, output: Measured): { keep: "output" } | { keep: "original"; reason: string } {
  if (!output.playable) return { keep: "original", reason: "sortie illisible" };
  if (output.displayWidth !== source.displayWidth || output.displayHeight !== source.displayHeight) {
    return { keep: "original", reason: "définition différente" };
  }
  const [a, b] = [source.probe.fps, output.probe.fps];
  if (a === null || b === null || Math.abs(a - b) > FPS_TOLERANCE) return { keep: "original", reason: "cadence différente" };
  const [da, db] = [source.probe.duration, output.probe.duration];
  if (da === null || db === null || Math.abs(da - db) > DURATION_TOLERANCE) return { keep: "original", reason: "durée différente" };
  if (source.probe.audio !== null && output.probe.audio === null) return { keep: "original", reason: "son perdu" };
  if (output.bytes > source.bytes * (1 - MIN_GAIN)) return { keep: "original", reason: "gain inférieur à 10 %" };
  return { keep: "output" };
}
