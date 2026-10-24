import { revalidatePath } from "next/cache";
import { serverNow } from "@/lib/clock";
import { nextParisMidnight, parisDay } from "@/lib/day";
import { getStore, requestMeta } from "@/lib/db";
import { error, isUuid, json, limited, readJson, zodError } from "@/lib/http";
import { clientIp } from "@/lib/rate-limit";
import { loadRiskSettings, scoreRisk } from "@/lib/risk";
import { voteCompleteSchema } from "@/lib/schema";
import { deviceStamp, ensureVoter, setVoterCookie } from "@/lib/voter";

/**
 * Valide le vote (Q1 → Q5). Le tirage au sort (Q6) est complété ensuite. :id = session_id
 * Un seul vote par appareil (cookie hw_voter) et par jour (Europe/Paris) : sinon 409 `already_voted_today`.
 * Score de risque (src/lib/risk.ts) calculé avant l'écriture : au-delà du seuil de blocage (mode
 * « block »), même réponse 409 et la ligne reste non validée (`blocked_at`).
 */
export async function POST(req: Request, ctx: RouteContext<"/api/responses/[id]/complete">) {
  const blocked = limited(req, "responses", 100);
  if (blocked) return blocked;

  const { id } = await ctx.params;
  if (!isUuid(id)) return error("Session invalide", 404);

  const parsed = voteCompleteSchema.safeParse(await readJson(req));
  if (!parsed.success) return zodError(parsed.error);
  const { device, ...data } = parsed.data;

  const store = getStore();
  const [decoration, restaurants] = await Promise.all([
    store.getDecoration(data.selected_decoration_id),
    store.listRestaurants(),
  ]);
  if (!decoration) return error("Décoration inconnue", 422, { selected_decoration_id: ["Décoration inconnue"] });
  if (!restaurants.some((r) => r.name === data.selected_restaurant)) {
    return error("Restaurant inconnu", 422, { selected_restaurant: ["Restaurant inconnu"] });
  }

  const voter = ensureVoter(req);
  const now = serverNow(req);
  const voteDay = parisDay(now);
  const alreadyVoted = () =>
    error("Vous avez déjà voté aujourd'hui", 409, { code: "already_voted_today", nextResetAt: nextParisMidnight(now).toISOString() });
  // Pré-contrôle (message clair) ; la garantie réelle est l'index unique appliqué dans completeResponse.
  if (!voter.isNew && (await store.hasVotedToday(voter.id, voteDay))) return alreadyVoted();

  const ip = clientIp(req);
  const stamp = deviceStamp(device);
  const [settings, context, existing] = await Promise.all([loadRiskSettings(store), store.riskContext(stamp.device_hash, ip, voteDay), store.getResponse(id)]);
  const risk = scoreRisk({
    deviceVotesToday: context.deviceVotes,
    ipVotesToday: context.ipVotes,
    cookieIsNew: voter.isNew,
    voterId: voter.id,
    ip,
    decorationId: data.selected_decoration_id,
    today: voteDay,
    localVoteDay: device?.localVoteDay ?? null,
    durationMs: existing ? now - Date.parse(existing.created_at) : null,
    webdriver: device?.webdriver === true,
    userAgent: req.headers.get("user-agent"),
    declared: { mobile: device?.mobile, browser: device?.browser },
  });
  const refused = settings.mode === "block" && risk.score >= settings.block_threshold;

  const result = await store.completeResponse(id, data, requestMeta(req, ip), {
    voterId: voter.id,
    voteDay,
    device: stamp,
    riskScore: risk.score,
    riskFlags: risk.flags,
    blocked: refused,
  });
  if (result === "already_voted_today" || refused) return alreadyVoted();
  revalidatePath("/resultats");
  const res = json({ ok: true, alreadyCompleted: result === "completed", voteDay });
  return voter.isNew ? setVoterCookie(res, voter.id) : res;
}
