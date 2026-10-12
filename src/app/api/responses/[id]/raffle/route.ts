import { getStore } from "@/lib/db";
import { error, isUuid, json, limited, readJson, zodError } from "@/lib/http";
import { raffleSchema } from "@/lib/schema";

/** Validation finale de l'inscription au tirage au sort (Q7). :id = session_id */
export async function POST(req: Request, ctx: RouteContext<"/api/responses/[id]/raffle">) {
  const blocked = limited(req, "responses", 100);
  if (blocked) return blocked;

  const { id } = await ctx.params;
  if (!isUuid(id)) return error("Session invalide", 404);

  const parsed = raffleSchema.safeParse(await readJson(req));
  if (!parsed.success) return zodError(parsed.error);

  const store = getStore();
  const row = await store.getResponse(id);
  if (!row || row.session_id !== id) return error("Session introuvable", 404);
  if (!row.completed_at) return error("Le vote doit être validé avant le tirage au sort", 409);

  await store.updateRaffle(
    id,
    parsed.data.wants_raffle
      ? parsed.data
      : { wants_raffle: false, participant_name: null, phone_number: null, email: null },
  );
  return json({ ok: true });
}
