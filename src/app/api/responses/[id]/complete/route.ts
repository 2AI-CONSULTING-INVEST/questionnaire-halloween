import { revalidatePath } from "next/cache";
import { getStore, requestMeta } from "@/lib/db";
import { error, isUuid, json, limited, readJson, zodError } from "@/lib/http";
import { clientIp } from "@/lib/rate-limit";
import { voteCompleteSchema } from "@/lib/schema";

/** Valide le vote (Q1 → Q6). Le tirage au sort (Q7) est complété ensuite. :id = session_id */
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

  const result = await store.completeResponse(id, data, requestMeta(req, clientIp(req)));
  revalidatePath("/resultats");
  return json({ ok: true, alreadyCompleted: result === "completed" });
}
