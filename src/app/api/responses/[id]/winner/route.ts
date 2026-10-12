import { z } from "zod";
import { getStore } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { error, isUuid, json, readJson, zodError } from "@/lib/http";

/** Admin : marquer / démarquer un participant comme gagnant. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/responses/[id]/winner">) {
  const denied = await requireRole("admin");
  if (denied) return denied;
  const { id } = await ctx.params;
  if (!isUuid(id)) return error("Introuvable", 404);
  const parsed = z.object({ is_winner: z.boolean() }).safeParse(await readJson(req));
  if (!parsed.success) return zodError(parsed.error);
  await getStore().setWinner(id, parsed.data.is_winner);
  return json({ ok: true });
}
