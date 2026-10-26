import "server-only";
import { NextResponse } from "next/server";
import type { ZodError } from "zod";
import type { ConflictError } from "./db";
import { clientIp, rateLimit } from "./rate-limit";

/** Réponse JSON ; `Cache-Control: no-store` par défaut (réponses admin, cookies) sauf si l'appelant fixe le sien (`/api/results` : cache public). */
export function json<T>(data: T, init?: number | ResponseInit) {
  const base: ResponseInit = typeof init === "number" ? { status: init } : (init ?? {});
  const headers = new Headers(base.headers);
  if (!headers.has("Cache-Control")) headers.set("Cache-Control", "no-store");
  return NextResponse.json(data, { ...base, headers });
}

export function error(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status, headers: { "Cache-Control": "no-store" } });
}

export function zodError(e: ZodError) {
  return error("Données invalides", 422, e.flatten().fieldErrors);
}

/** Conflit d'unicité (pseudo, email, téléphone…) : 409 avec un message par champ, comme zodError. */
export function conflictError(e: ConflictError) {
  return error(e.message, 409, Object.fromEntries(Object.entries(e.fields).map(([k, v]) => [k, [v]])));
}

/** Renvoie une réponse 429 si la limite est dépassée, sinon null. */
export function limited(req: Request, scope: string, limit = 100) {
  const ip = clientIp(req) ?? "unknown";
  return rateLimit(`${scope}:${ip}`, limit) ? null : error("Trop de requêtes, réessayez dans une minute.", 429);
}

/**
 * Corps JSON de la requête, ou une réponse d'erreur à renvoyer telle quelle : 403 si le navigateur
 * annonce une requête cross-site, 415 sans `Content-Type: application/json` (un site tiers ne peut
 * alors envoyer qu'une requête « simple » en text/plain, refusée ici, ou passer par une pré-vérification
 * CORS, qui échoue faute d'en-têtes CORS). Corps illisible : undefined (la validation zod répond 422).
 */
export async function readJson(req: Request): Promise<unknown> {
  if (req.headers.get("sec-fetch-site") === "cross-site") return error("Requête cross-site refusée", 403);
  if (!req.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return error("Content-Type application/json attendu", 415);
  try {
    return await req.json();
  } catch {
    return undefined;
  }
}

export function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}
