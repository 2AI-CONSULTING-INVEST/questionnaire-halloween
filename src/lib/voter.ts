import "server-only";
import { createHmac, randomUUID } from "node:crypto";
import type { NextResponse } from "next/server";
import { BASE_PATH } from "./base-path";
import type { DeviceStamp } from "./db";
import { isUuid } from "./http";
import type { Device } from "./schema";

/**
 * Identifiant d'appareil du vote quotidien : cookie `hw_voter` (uuid aléatoire), posé par le
 * serveur à la création de la session de vote, lu à la validation. httpOnly : le navigateur ne
 * peut pas le lire ; il n'identifie personne, il sert seulement à la règle « un vote par jour ».
 */
export const VOTER_COOKIE = "hw_voter";
const TTL_SECONDS = 60 * 60 * 24 * 400;

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
  const secret = process.env.RISK_SECRET || process.env.ADMIN_SESSION_SECRET || "dev-only-secret-change-me-dev-only-secret";
  return createHmac("sha256", secret).update(raw).digest("hex");
}

/** Ce qui est enregistré sur la réponse : l'empreinte HMAC et les attributs grossiers (sans le condensé). */
export function deviceStamp(device: Device | undefined): DeviceStamp {
  if (!device) return { device_hash: null, device_info: null };
  const { hash, ...info } = device;
  return { device_hash: deviceHash(hash), device_info: Object.keys(info).length ? info : null };
}
