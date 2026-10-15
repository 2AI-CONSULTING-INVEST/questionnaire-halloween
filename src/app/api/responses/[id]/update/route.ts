import { CONFLICT_MESSAGES, getStore, requestMeta } from "@/lib/db";
import { error, isUuid, json, limited, readJson, zodError } from "@/lib/http";
import { clientIp } from "@/lib/rate-limit";
import { RAFFLE_FIELDS, responsePatchSchema } from "@/lib/schema";
import { ensureVoter, setVoterCookie } from "@/lib/voter";

/** Auto-save : met à jour un ou plusieurs champs d'une session. :id = session_id */
async function handle(req: Request, ctx: RouteContext<"/api/responses/[id]/update">) {
  const blocked = limited(req, "responses", 100);
  if (blocked) return blocked;

  const { id } = await ctx.params;
  if (!isUuid(id)) return error("Session invalide", 404);

  const parsed = responsePatchSchema.safeParse(await readJson(req));
  if (!parsed.success) return zodError(parsed.error);
  const patch = parsed.data;
  if (Object.keys(patch).length === 0) return error("Aucun champ à mettre à jour");

  const store = getStore();
  const voter = ensureVoter(req);
  const withCookie = (res: ReturnType<typeof json>) => (voter.isNew ? setVoterCookie(res, voter.id) : res);
  const result = await store.updateResponse(id, patch, requestMeta(req, clientIp(req)), voter.id);
  if (result === "ok") return withCookie(json({ ok: true }));

  // Vote déjà validé : seul le choix du tirage au sort reste modifiable (les coordonnées passent
  // par /raffle), et une inscription faite ne se détache jamais d'ici.
  const raffleOnly = Object.keys(patch).every((k) => (RAFFLE_FIELDS as readonly string[]).includes(k));
  if (!raffleOnly) return error("Vote déjà validé", 409);
  if (patch.wants_raffle != null) {
    const row = await store.getResponse(id);
    if (row?.participant_id) return error(CONFLICT_MESSAGES.raffle, 409, { raffle: [CONFLICT_MESSAGES.raffle] });
    await store.updateRaffle(id, { wants_raffle: patch.wants_raffle });
  }
  return withCookie(json({ ok: true }));
}

export const PATCH = handle;
// POST pour navigator.sendBeacon (envoi à la fermeture de l'onglet)
export const POST = handle;
