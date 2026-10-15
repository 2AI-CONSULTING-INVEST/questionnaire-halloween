import "server-only";
import { NextResponse } from "next/server";
import type { ZodError } from "zod";
import type { ConflictError } from "./db";
import { clientIp, rateLimit } from "./rate-limit";

export function json<T>(data: T, init?: number | ResponseInit) {
  return NextResponse.json(data, typeof init === "number" ? { status: init } : init);
}

export function error(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status });
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

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return undefined;
  }
}

export function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}
