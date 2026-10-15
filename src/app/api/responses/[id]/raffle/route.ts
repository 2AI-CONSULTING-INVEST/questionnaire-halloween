import { revalidatePath } from "next/cache";
import { CONFLICT_MESSAGES, ConflictError, getStore } from "@/lib/db";
import { conflictError, error, isUuid, json, limited, readJson, zodError } from "@/lib/http";
import { participantInput, raffleSchema } from "@/lib/schema";

/**
 * Validation finale de l'inscription au tirage au sort (Q6), après la modale de vérification.
 * :id = session_id. Une participation par personne : pseudo, email et téléphone sont uniques.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/responses/[id]/raffle">) {
  const blocked = limited(req, "raffle", 30);
  if (blocked) return blocked;

  const { id } = await ctx.params;
  if (!isUuid(id)) return error("Session invalide", 404);

  const parsed = raffleSchema.safeParse(await readJson(req));
  if (!parsed.success) return zodError(parsed.error);

  const store = getStore();
  const row = await store.getResponse(id);
  if (!row || row.session_id !== id) return error("Session introuvable", 404);
  if (!row.completed_at) return error("Le vote doit être validé avant le tirage au sort", 409);

  if (!parsed.data.wants_raffle) {
    // Une inscription faite ne se retire pas depuis le questionnaire (seul le backoffice supprime).
    if (row.participant_id) return error(CONFLICT_MESSAGES.raffle, 409, { raffle: [CONFLICT_MESSAGES.raffle] });
    await store.updateRaffle(id, { wants_raffle: false });
    return json({ ok: true });
  }
  try {
    const { alreadyRegistered } = await store.registerParticipant(id, participantInput(parsed.data));
    revalidatePath("/participants");
    return json({ ok: true, alreadyRegistered });
  } catch (e) {
    if (e instanceof ConflictError) return conflictError(e);
    throw e;
  }
}
