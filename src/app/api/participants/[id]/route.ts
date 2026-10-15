import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ConflictError, getStore } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { conflictError, error, isUuid, json, readJson, zodError } from "@/lib/http";
import { pseudoKey, pseudoSchema } from "@/lib/schema";

const patchSchema = z.object({ pseudo: pseudoSchema }).strict();

/** Admin : modération du pseudonyme (unicité vérifiée). */
export async function PATCH(req: Request, ctx: RouteContext<"/api/participants/[id]">) {
  const denied = await requireRole("admin");
  if (denied) return denied;
  const { id } = await ctx.params;
  if (!isUuid(id)) return error("Introuvable", 404);
  const parsed = patchSchema.safeParse(await readJson(req));
  if (!parsed.success) return zodError(parsed.error);
  try {
    await getStore().updateParticipant(id, { pseudo: parsed.data.pseudo, pseudo_key: pseudoKey(parsed.data.pseudo) });
  } catch (e) {
    if (e instanceof ConflictError) return conflictError(e);
    throw e;
  }
  revalidatePath("/participants");
  return json({ ok: true });
}

/** Admin : supprime un participant (ses réponses restent, sans lien ; son lot éventuel redevient libre). */
export async function DELETE(_req: Request, ctx: RouteContext<"/api/participants/[id]">) {
  const denied = await requireRole("admin");
  if (denied) return denied;
  const { id } = await ctx.params;
  if (!isUuid(id)) return error("Introuvable", 404);
  await getStore().deleteParticipant(id);
  revalidatePath("/participants");
  return json({ ok: true });
}
