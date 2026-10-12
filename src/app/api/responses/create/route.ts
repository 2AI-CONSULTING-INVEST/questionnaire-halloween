import { getStore, requestMeta } from "@/lib/db";
import { error, isUuid, json, limited, readJson } from "@/lib/http";
import { clientIp } from "@/lib/rate-limit";

/** Crée une session de réponse (idempotent). */
export async function POST(req: Request) {
  const blocked = limited(req, "responses", 100);
  if (blocked) return blocked;

  const body = (await readJson(req)) as { session_id?: unknown } | undefined;
  const sessionId = body?.session_id;
  if (typeof sessionId !== "string" || !isUuid(sessionId)) return error("session_id invalide");

  await getStore().createResponse(sessionId, requestMeta(req, clientIp(req)));
  return json({ ok: true }, 201);
}
