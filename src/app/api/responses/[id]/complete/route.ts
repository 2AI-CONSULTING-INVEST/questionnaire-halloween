import { revalidatePath } from "next/cache";
import { serverNow } from "@/lib/clock";
import { nextParisMidnight, parisDay } from "@/lib/day";
import { getStore } from "@/lib/db";
import { error, isUuid, json, limited, readJson, zodError } from "@/lib/http";
import { clientIp } from "@/lib/rate-limit";
import { IP_DAILY_MAX_FLAG, loadRiskSettings, scoreRisk } from "@/lib/risk";
import { voteCompleteSchema } from "@/lib/schema";
import { deviceStamp, readVoter } from "@/lib/voter";

/**
 * Valide le vote (Q1 → Q5). Le tirage au sort (Q6) est complété ensuite. :id = session_id
 * La session doit avoir été ouverte par /create (ligne existante) et la requête doit porter le
 * cookie hw_voter posé à l'ouverture, égal au voter_id de la ligne : sans cookie, avec un autre, ou
 * sur une session jamais ouverte, même réponse 409 `already_voted_today` (rien n'est révélé, aucune
 * ligne n'est créée ici). Un seul vote par appareil (cookie hw_voter) et par jour (Europe/Paris).
 * Score de risque (src/lib/risk.ts) calculé avant l'écriture : au-delà du seuil de blocage (mode
 * « block »), même réponse 409 et la ligne reste non validée (`blocked_at`). Sans empreinte, signal
 * `no_device` (+45). Plafond dur par IP et par jour (`ip_daily_max`) : même refus, signal `ip_daily_max`.
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
  const [decoration, restaurants] = await Promise.all([
    store.getDecoration(data.selected_decoration_id),
    store.listRestaurants(),
  ]);
  if (!decoration) return error("Décoration inconnue", 422, { selected_decoration_id: ["Décoration inconnue"] });
  if (!restaurants.some((r) => r.name === data.selected_restaurant)) {
    return error("Restaurant inconnu", 422, { selected_restaurant: ["Restaurant inconnu"] });
  }

  const voter = readVoter(req);
  const now = serverNow(req);
  const voteDay = parisDay(now);
  const alreadyVoted = () =>
    error("Vous avez déjà voté aujourd'hui", 409, { code: "already_voted_today", nextResetAt: nextParisMidnight(now).toISOString() });
  if (!voter) return alreadyVoted();
  // Pré-contrôle (message clair) ; la garantie réelle est l'index unique appliqué dans completeResponse.
  if (await store.hasVotedToday(voter, voteDay)) return alreadyVoted();
  const existing = await store.getResponse(id);
  // Un refus par score (blocked_at) est définitif pour la journée : pas de rejeu avec d'autres signaux.
  if (!existing || existing.session_id !== id || existing.voter_id !== voter || existing.blocked_at) return alreadyVoted();

  const ip = clientIp(req);
  const stamp = deviceStamp(device);
  const [settings, context] = await Promise.all([loadRiskSettings(store), store.riskContext(stamp.device_hash, ip, voteDay)]);
  const risk = scoreRisk({
    deviceVotesToday: context.deviceVotes,
    ipVotesToday: context.ipVotes,
    cookieIsNew: false, // le cookie est désormais toujours celui posé à l'ouverture de la session
    noDevice: stamp.device_hash === null,
    voterId: voter,
    ip,
    decorationId: data.selected_decoration_id,
    today: voteDay,
    localVoteDay: device?.localVoteDay ?? null,
    durationMs: now - Date.parse(existing.created_at),
    webdriver: device?.webdriver === true,
    userAgent: req.headers.get("user-agent"),
    declared: { mobile: device?.mobile, browser: device?.browser },
    blockThreshold: settings.block_threshold,
  });
  const ipCapped = settings.ip_daily_max > 0 && context.ipVotes >= settings.ip_daily_max;
  const refused = settings.mode === "block" && (risk.score >= settings.block_threshold || ipCapped);

  const result = await store.completeResponse(id, data, {
    voterId: voter,
    voteDay,
    device: stamp,
    riskScore: risk.score,
    riskFlags: ipCapped ? [...risk.flags, IP_DAILY_MAX_FLAG] : risk.flags,
    blocked: refused,
  });
  if (result === "already_voted_today" || refused) return alreadyVoted();
  revalidatePath("/resultats");
  return json({ ok: true, alreadyCompleted: result === "completed", voteDay });
}
