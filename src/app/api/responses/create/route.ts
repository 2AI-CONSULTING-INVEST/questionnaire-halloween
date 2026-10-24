import { serverNow } from "@/lib/clock";
import { nextParisMidnight, parisDay } from "@/lib/day";
import { getStore, requestMeta } from "@/lib/db";
import { error, isUuid, json, limited, readJson, zodError } from "@/lib/http";
import { clientIp } from "@/lib/rate-limit";
import { deviceSchema } from "@/lib/schema";
import { deviceStamp, ensureVoter, setVoterCookie } from "@/lib/voter";

/**
 * Crée une session de réponse (idempotent) et pose le cookie d'appareil `hw_voter`.
 * Un appareil qui a déjà voté aujourd'hui n'ouvre pas de nouvelle session (pas de ligne fantôme).
 * `device` (facultatif) : signaux d'appareil du navigateur, enregistrés pour le score de risque.
 */
export async function POST(req: Request) {
  const blocked = limited(req, "responses", 100);
  if (blocked) return blocked;

  const body = (await readJson(req)) as { session_id?: unknown; device?: unknown } | undefined;
  const sessionId = body?.session_id;
  if (typeof sessionId !== "string" || !isUuid(sessionId)) return error("session_id invalide");
  const device = deviceSchema.optional().safeParse(body?.device);
  if (!device.success) return zodError(device.error);

  const store = getStore();
  const voter = ensureVoter(req);
  const now = serverNow(req);
  if (!voter.isNew && (await store.hasVotedToday(voter.id, parisDay(now)))) {
    return error("Vous avez déjà voté aujourd'hui", 409, { code: "already_voted_today", nextResetAt: nextParisMidnight(now).toISOString() });
  }
  await store.createResponse(sessionId, requestMeta(req, clientIp(req)), voter.id, deviceStamp(device.data));
  const res = json({ ok: true }, 201);
  return voter.isNew ? setVoterCookie(res, voter.id) : res;
}
