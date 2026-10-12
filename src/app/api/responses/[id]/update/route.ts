import { getStore, requestMeta } from "@/lib/db";
import { error, isUuid, json, limited, readJson, zodError } from "@/lib/http";
import { clientIp } from "@/lib/rate-limit";
import { RAFFLE_FIELDS, responsePatchSchema } from "@/lib/schema";

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
  const result = await store.updateResponse(id, patch, requestMeta(req, clientIp(req)));
  if (result === "ok") return json({ ok: true });

  // Vote déjà validé : seuls les champs du tirage au sort restent modifiables.
  const raffleOnly = Object.keys(patch).every((k) => (RAFFLE_FIELDS as readonly string[]).includes(k));
  if (!raffleOnly) return error("Vote déjà validé", 409);
  await store.updateRaffle(
    id,
    patch.wants_raffle === false ? { wants_raffle: false, participant_name: null, phone_number: null, email: null } : patch,
  );
  return json({ ok: true });
}

export const PATCH = handle;
// POST pour navigator.sendBeacon (envoi à la fermeture de l'onglet)
export const POST = handle;
