import { serverNow } from "@/lib/clock";
import { parisDay } from "@/lib/day";
import { getStore, requestMeta } from "@/lib/db";
import { recognizeDevice, requestSignals } from "@/lib/fraud-server";
import { alreadyVoted, error, isUuid, json, limited, readJson, zodError } from "@/lib/http";
import { clientIp } from "@/lib/rate-limit";
import { loadRiskSettings } from "@/lib/risk";
import { deviceSchema } from "@/lib/schema";
import { deviceStamp, deviceToken, ensureVoter, setVoterCookie, storageKeyOf } from "@/lib/voter";

const RECOGNITION_REASON = { cookie: "cookie", storage: "B1", hw: "B2" } as const;

/**
 * Crée une session de réponse (idempotent) et pose le cookie d'appareil `hw_voter`.
 * Un appareil reconnu comme ayant déjà une tentative aujourd'hui (cookie, jeton du stockage, clé hw
 * forte : src/lib/fraud-rules.ts, `recognize`) n'ouvre pas de session : refus 409 identique pour tous
 * les motifs, avec une trace listée dans « Votes frauduleux ». Sinon, la réponse remet à l'appareil
 * son jeton opaque (`deviceToken`), à garder dans localStorage et IndexedDB.
 */
export async function POST(req: Request) {
  const blocked = limited(req, "responses", 100);
  if (blocked) return blocked;

  const raw = await readJson(req);
  if (raw instanceof Response) return raw;
  const body = raw as { session_id?: unknown; device?: unknown } | undefined;
  const sessionId = body?.session_id;
  if (typeof sessionId !== "string" || !isUuid(sessionId)) return error("session_id invalide");
  const device = deviceSchema.optional().safeParse(body?.device);
  if (!device.success) return zodError(device.error);

  const store = getStore();
  const voter = ensureVoter(req);
  const now = serverNow(req);
  const day = parisDay(now);
  const ip = clientIp(req);
  const [settings, sig] = await Promise.all([loadRiskSettings(store), requestSignals(req, ip, device.data)]);
  const { recognized } = await recognizeDevice(store, settings, day, voter.isNew ? null : voter.id, sig, now);
  const meta = requestMeta(req, ip);
  const stamp = deviceStamp(device.data);

  // Mode observation : seul le cookie refuse (règle de base) ; B1 et B2 sont notés sur la ligne, sans effet.
  if (recognized && (recognized === "cookie" || settings.mode === "block")) {
    await store.recordRefusal({ sessionId, meta, voterId: voter.id, voteDay: day, device: stamp, fraud: sig.stamp, reasons: [RECOGNITION_REASON[recognized]] });
    const res = alreadyVoted(now);
    return voter.isNew ? setVoterCookie(res, voter.id) : res;
  }
  const token = deviceToken(voter.id);
  await store.createResponse(sessionId, meta, voter.id, stamp, {
    ...sig.stamp,
    storage_key: storageKeyOf(token),
    ...(recognized ? { observed_outcome: "blocked", fraud_reasons: [RECOGNITION_REASON[recognized]] } : {}),
  });
  const res = json({ ok: true, deviceToken: token }, 201);
  return voter.isNew ? setVoterCookie(res, voter.id) : res;
}
