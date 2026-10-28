import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { serverNow } from "@/lib/clock";
import { parisDay } from "@/lib/day";
import { getStore, requestMeta, type VoteStamp } from "@/lib/db";
import { strongConflict } from "@/lib/fraud-rules";
import { applyGraph, decideVote, requestSignals, type RequestSignals } from "@/lib/fraud-server";
import { alreadyVoted, error, isUuid, json, limited, readJson, zodError } from "@/lib/http";
import { clientIp } from "@/lib/rate-limit";
import { IP_DAILY_MAX_FLAG, loadRiskSettings, scoreRisk } from "@/lib/risk";
import { voteCompleteSchema } from "@/lib/schema";
import { deviceStamp, deviceToken, readVoter, storageKeyOf, uaImpliesStrong } from "@/lib/voter";

/**
 * Valide le vote (Q1 → Q3). Le tirage au sort est complété ensuite. :id = session_id
 * La session doit avoir été ouverte par /create (ligne existante) et la requête doit porter le cookie
 * hw_voter posé à l'ouverture, égal au voter_id de la ligne : sinon, refus 409 `already_voted_today`.
 * Décision (src/lib/fraud-rules.ts) : refus visible pour les cas sûrs (cookie, jeton du stockage B1,
 * clé hw forte avec un second indice B2, score B3, plafond par IP), mise en attente silencieuse pour les cas suspects (H1 à H9),
 * sinon vote compté. Un vote en attente reçoit la même réponse qu'un vote compté : aucun indice.
 * Un refus à cette étape alors qu'une session existe (cookie déjà utilisé, session déjà refusée rejouée)
 * laisse une trace (étape « complete ») ; sans cookie ni session, aucune trace. Après la réponse, le moteur de groupes repasse sur la journée (exclusion des votes en trop).
 */
export async function POST(req: Request, ctx: RouteContext<"/api/responses/[id]/complete">) {
  const blocked = limited(req, "responses", 100);
  if (blocked) return blocked;

  const { id } = await ctx.params;
  if (!isUuid(id)) return error("Session invalide", 404);

  const body = await readJson(req);
  if (body instanceof Response) return body;
  const parsed = voteCompleteSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);
  const { device, ...data } = parsed.data;

  const store = getStore();
  const [decoration, restaurants] = await Promise.all([store.getDecoration(data.selected_decoration_id), store.listRestaurants()]);
  if (!decoration) return error("Décoration inconnue", 422, { selected_decoration_id: ["Décoration inconnue"] });
  if (!restaurants.some((r) => r.name === data.selected_restaurant)) {
    return error("Restaurant inconnu", 422, { selected_restaurant: ["Restaurant inconnu"] });
  }

  const voter = readVoter(req);
  const now = serverNow(req);
  const voteDay = parisDay(now);
  if (!voter) return alreadyVoted(now); // ni cookie ni session : aucune trace
  const existing = await store.getResponse(id);
  if (!existing || existing.session_id !== id || existing.voter_id !== voter) return alreadyVoted(now);

  const ip = clientIp(req);
  /** Trace d'un refus à la validation (nouvelle ligne : la session garde son état), listée dans « Votes frauduleux ». */
  const trace = async (reasons: string[], fraud?: RequestSignals["stamp"]) => {
    const stamp = fraud ?? (await requestSignals(req, ip, device)).stamp;
    await store.recordRefusal({ sessionId: randomUUID(), meta: requestMeta(req, ip), voterId: voter, voteDay, device: deviceStamp(device), fraud: stamp, reasons, stage: "complete" });
    return alreadyVoted(now);
  };
  // Un refus est définitif pour la session : pas de rejeu avec d'autres signaux (le rejeu laisse une trace).
  if (existing.blocked_at) return trace(existing.fraud_reasons?.length ? existing.fraud_reasons : ["cookie"]);

  const [settings, sig, ipVotes] = await Promise.all([loadRiskSettings(store), requestSignals(req, ip, device), store.ipVotesToday(ip, voteDay)]);
  const ua = req.headers.get("user-agent");
  const risk = scoreRisk({
    // Sans clé matérielle alors que l'agent utilisateur en implique une forte : un vrai navigateur l'envoie toujours.
    noDevice: deviceStamp(device).device_hash === null || (!device?.hw && uaImpliesStrong(ua, req.headers.get("sec-ch-ua"), device?.model)),
    durationMs: now - Date.parse(existing.created_at),
    webdriver: device?.webdriver === true,
    userAgent: ua,
    secChUa: req.headers.get("sec-ch-ua"),
    declared: { mobile: device?.mobile, browser: device?.browser },
  });
  const ipCapped = settings.ip_daily_max > 0 && ipVotes >= settings.ip_daily_max;
  const decision = await decideVote(store, settings, { day: voteDay, nowMs: now, voterId: voter, decorationId: data.selected_decoration_id, score: risk.score, ipCapped, sig });

  const stamp: VoteStamp = {
    voterId: voter,
    voteDay,
    device: deviceStamp(device),
    fraud: { ...sig.stamp, storage_key: storageKeyOf(deviceToken(voter)) },
    riskScore: risk.score,
    riskFlags: ipCapped ? [...risk.flags, IP_DAILY_MAX_FLAG] : risk.flags,
    outcome: decision.outcome,
    priority: decision.priority,
    reasons: decision.reasons,
    observed: decision.observed,
  };
  let result = await store.completeResponse(id, data, stamp);
  if (result === "strong_conflict") {
    // Validation parallèle de la même clé forte, déjà comptée : la décision est relue avec la ligne gagnante
    // (refus B2 avec un second indice, sinon attente H4) ; à défaut, attente. Jamais une erreur. Mode
    // observation : le vote reste compté, l'issue évitée est notée (fraud-rules.ts).
    const again = await decideVote(store, settings, { day: voteDay, nowMs: now, voterId: voter, decorationId: data.selected_decoration_id, score: risk.score, ipCapped, sig });
    const retry = again.outcome !== "counted" || again.observed ? again : strongConflict(decision, settings);
    result = await store.completeResponse(id, data, { ...stamp, outcome: retry.outcome, reasons: retry.reasons, observed: retry.observed, priority: retry === again && again.priority });
    if (result === "strong_conflict") return trace([...retry.reasons], sig.stamp);
    if (retry.outcome === "blocked") return alreadyVoted(now);
  }
  // Index du cookie (ce navigateur a déjà voté aujourd'hui) ou session refusée entre-temps : trace.
  if (result === "already_voted_today") return trace(["cookie"], sig.stamp);
  if (decision.outcome === "blocked") return alreadyVoted(now);

  after(() => applyGraph(getStore(), voteDay, { reason: "validation d'un vote" }).catch((e) => console.error("Moteur anti-fraude :", e)));
  revalidatePath("/resultats");
  return json({ ok: true, alreadyCompleted: result === "completed", voteDay });
}
