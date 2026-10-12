import "server-only";
import { NextResponse } from "next/server";
import type { ZodError } from "zod";
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
