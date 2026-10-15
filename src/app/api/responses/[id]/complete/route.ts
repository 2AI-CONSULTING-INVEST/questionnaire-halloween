import { revalidatePath } from "next/cache";
import { serverNow } from "@/lib/clock";
import { nextParisMidnight, parisDay } from "@/lib/day";
import { getStore, requestMeta } from "@/lib/db";
import { error, isUuid, json, limited, readJson, zodError } from "@/lib/http";
import { clientIp } from "@/lib/rate-limit";
import { voteCompleteSchema } from "@/lib/schema";
import { ensureVoter, setVoterCookie } from "@/lib/voter";

/**
 * Valide le vote (Q1 → Q5). Le tirage au sort (Q6) est complété ensuite. :id = session_id
 * Un seul vote par appareil (cookie hw_voter) et par jour (Europe/Paris) : sinon 409 `already_voted_today`.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/responses/[id]/complete">) {
  const blocked = limited(req, "responses", 100);
  if (blocked) return blocked;

  const { id } = await ctx.params;
  if (!isUuid(id)) return error("Session invalide", 404);

  const parsed = voteCompleteSchema.safeParse(await readJson(req));
  if (!parsed.success) return zodError(parsed.error);
  const data = parsed.data;

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

  const result = await store.completeResponse(id, data, requestMeta(req, clientIp(req)), { voterId: voter.id, voteDay });
  if (result === "already_voted_today") return alreadyVoted();
  revalidatePath("/resultats");
  const res = json({ ok: true, alreadyCompleted: result === "completed", voteDay });
  return voter.isNew ? setVoterCookie(res, voter.id) : res;
}
