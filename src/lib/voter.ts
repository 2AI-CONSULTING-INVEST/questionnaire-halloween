import "server-only";
import { createHmac, randomUUID } from "node:crypto";
import type { NextResponse } from "next/server";
import { riskSecret } from "./auth";
import { BASE_PATH } from "./base-path";
import type { DeviceStamp } from "./db";
import { isUuid } from "./http";
import type { Device, DeviceInfo, HwEntropy } from "./schema";

/**
 * Identifiant d'appareil du vote quotidien : cookie `hw_voter` (uuid aléatoire), posé par le
 * serveur à la création de la session de vote, lu à la validation. httpOnly : le navigateur ne
 * peut pas le lire ; il n'identifie personne, il sert seulement à la règle « un vote par jour ».
 */
export const VOTER_COOKIE = "hw_voter";
const TTL_SECONDS = 60 * 60 * 24 * 60; // durée de l'opération, pas plus

export const voterCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: BASE_PATH,
  maxAge: TTL_SECONDS,
};

/** Valeur du cookie d'appareil de la requête, si elle est bien formée. */
export function readVoter(req: Request): string | null {
  const raw = req.headers.get("cookie") ?? "";
  for (const part of raw.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === VOTER_COOKIE) {
      const value = decodeURIComponent(rest.join("="));
      return isUuid(value) ? value.toLowerCase() : null;
    }
  }
  return null;
}

/** Cookie existant, ou nouvel identifiant à poser sur la réponse. */
export function ensureVoter(req: Request): { id: string; isNew: boolean } {
  const existing = readVoter(req);
  return existing ? { id: existing, isNew: false } : { id: randomUUID(), isNew: true };
}

export function setVoterCookie(res: NextResponse, id: string) {
  res.cookies.set(VOTER_COOKIE, id, voterCookieOptions);
  return res;
}

/**
 * Empreinte d'appareil enregistrée : HMAC-SHA256 (secret serveur) du condensé envoyé par le
 * navigateur, en hexa. Le condensé brut n'est jamais stocké ; sans secret, rien n'est recalculable.
 */
export function deviceHash(raw: string | undefined): string | null {
  if (!raw) return null;
  return createHmac("sha256", riskSecret()).update(raw).digest("hex");
}

/** Ce qui est enregistré sur la réponse : l'empreinte HMAC et les attributs grossiers (sans le condensé, ni les signaux de session `localVoteDay` / `startedAt`, qui ne servent qu'au score). */
export function deviceStamp(device: Device | undefined): DeviceStamp {
  if (!device) return { device_hash: null, device_info: null };
  const info: DeviceInfo = {};
  for (const k of ["mobile", "platform", "browser", "screen", "touch", "webdriver", "model", "osVersion"] as const) if (device[k] !== undefined) Object.assign(info, { [k]: device[k] });
  return { device_hash: deviceHash(device.hash), device_info: Object.keys(info).length ? info : null };
}

const hmac = (label: string, value: string) => createHmac("sha256", riskSecret()).update(`${label}:${value}`);

/**
 * Jeton opaque remis à l'appareil à l'ouverture de la session, gardé dans localStorage et IndexedDB :
 * dérivé du cookie de vote, jamais égal à sa valeur (le cookie reste httpOnly). Renvoyé à la validation,
 * il ne vaut que s'il correspond à une tentative du jour en base (règle B1).
 */
export const deviceToken = (voterId: string) => hmac("device-token", voterId).digest("base64url").slice(0, 32);
/** Ce qui est enregistré d'un jeton : son HMAC (`storage_key`, `seen_storage`). */
export const storageKeyOf = (token: string) => hmac("storage-key", token).digest("hex");
/** HMAC de la clé inter-navigateurs envoyée par le navigateur (`xdev_key`, règle B4). */
export const xdevKeyOf = (x: string | undefined) => (x ? hmac("xdev", x).digest("hex") : null);
/** HMAC de la clé stricte (`xdev_strict_key`), ordinateurs seulement. */
export const xdevStrictKeyOf = (m: string | undefined) => (m ? hmac("xdev-strict", m).digest("hex") : null);
/**
 * Ordinateur pour B4, d'après l'agent utilisateur : Windows, Linux, ChromeOS, ou Macintosh sans écran
 * tactile (un iPad en mode « ordinateur » s'annonce Macintosh avec un écran tactile ; aucun Mac n'en a),
 * jamais « Mobile ». Un PC Windows tactile reste un ordinateur.
 */
export function isComputer(userAgent: string | null, touch: boolean | undefined): boolean {
  const ua = userAgent ?? "";
  if (/Android|iPhone|iPad|iPod|Mobile/.test(ua)) return false;
  if (/Macintosh/.test(ua)) return touch !== true;
  return /Windows NT|X11|CrOS/.test(ua);
}
/** HMAC de la clé matérielle envoyée par le navigateur (`hw_key`). */
export const hwKeyOf = (hw: string | undefined) => (hw ? hmac("hw", hw).digest("hex") : null);

/**
 * Agent utilisateur qui implique une clé matérielle forte : Chrome Android (hors WebView et navigateurs
 * dérivés qui brouillent ou masquent) avec son modèle, et Chromium sur ordinateur (Windows, macOS, Linux,
 * ChromeOS). Brave : non. `model` : modèle Android déclaré par la page (absent : pas de clé forte).
 */
export function uaImpliesStrong(userAgent: string | null, secChUa: string | null, model?: string): boolean {
  const ua = userAgent ?? "";
  if (!/Chrome\//.test(ua) || /"Brave"/.test(secChUa ?? "") || /Firefox|OPR|iPhone|iPad|iPod/.test(ua)) return false;
  if (/Android/.test(ua)) return !/SamsungBrowser|EdgA|; wv\)/.test(ua) && !!model;
  return /Windows NT|Macintosh|X11|CrOS/.test(ua) && !/Mobile/.test(ua);
}

/**
 * Classe d'entropie retenue par le serveur. La page la déclare, mais un Android Chrome ou un Chromium
 * d'ordinateur qui se dirait « faible » ou « brouillé », ou qui ne dirait rien, échapperait à B2 : l'agent
 * utilisateur tranche. Classe absente : traitée comme « faible » (non fiable). iPhone et iPad : jamais forte.
 * Android en WebView ou sans modèle : jamais forte (deux appareils différents partageraient la clé).
 */
export function effectiveEntropy(claimed: HwEntropy | undefined, userAgent: string | null, secChUa: string | null, model?: string): HwEntropy {
  const c = claimed ?? "weak";
  const ua = userAgent ?? "";
  const weakOrNoisy = c === "noisy" ? "noisy" : "weak";
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && /Version\/[\d.]+.*Safari/.test(ua) && c !== "strong")) return weakOrNoisy;
  if (/Android/.test(ua) && (/; wv\)/.test(ua) || !model)) return weakOrNoisy;
  if (c !== "strong" && uaImpliesStrong(ua, secChUa, model)) return "strong";
  return c;
}
