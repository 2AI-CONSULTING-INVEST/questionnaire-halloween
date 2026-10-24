import { revalidatePath } from "next/cache";
import { ConflictError, getStore } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { conflictError, error, isUuid, json } from "@/lib/http";

/** Admin (journalisé) : restaure un participant supprimé ; 409 par champ si un actif a pris son pseudo / email / téléphone. */
export async function POST(req: Request, ctx: RouteContext<"/api/participants/[id]/restore">) {
  const denied = await requireRole("admin", req);
  if (denied) return denied;
  const { id } = await ctx.params;
  if (!isUuid(id)) return error("Introuvable", 404);
  const store = getStore();
  const p = await store.getParticipant(id);
  if (!p) return error("Introuvable", 404);
  try {
    await store.restoreParticipant(id);
  } catch (e) {
    if (e instanceof ConflictError) return conflictError(e);
    throw e;
  }
  revalidatePath("/participants");
  return json({ ok: true });
}
