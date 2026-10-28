import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currentSession } from "@/lib/auth";
import { getStore } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { error, isUuid, json, readJson, zodError } from "@/lib/http";
import { clientIp } from "@/lib/rate-limit";
import { redactForViewer } from "@/lib/redact";
import { requireSecondPassword } from "@/lib/second-password";

const excludeSchema = z.object({ excluded: z.boolean(), password: z.string().max(200).optional() }).strict();

/** Admin : détail d'une réponse (id ou session_id) ; sans IP, navigateur ni appareil en lecture seule. */
export async function GET(_req: Request, ctx: RouteContext<"/api/responses/[id]">) {
  const denied = await requireRole("viewer");
  if (denied) return denied;
  const viewerOnly = (await currentSession())?.role !== "admin";
  const { id } = await ctx.params;
  if (!isUuid(id)) return error("Introuvable", 404);
  const row = await getStore().getResponse(id);
  if (!row) return error("Introuvable", 404);
  return json(viewerOnly ? redactForViewer(row) : row, { headers: { "Cache-Control": "no-store" } });
}

/**
 * Admin : exclusion du classement (`{ excluded: true }`) ou réintégration (`{ excluded: false, password }`),
 * réversible, journalisée. Réintégrer fait compter le vote : double validation (mot de passe de lecture seule).
 */
export async function PATCH(req: Request, ctx: RouteContext<"/api/responses/[id]">) {
  const denied = await requireRole("admin", req);
  if (denied) return denied;
  const { id } = await ctx.params;
  if (!isUuid(id)) return error("Introuvable", 404);
  const body = await readJson(req);
  if (body instanceof Response) return body;
  const parsed = excludeSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);
  const store = getStore();
  const row = await store.getResponse(id);
  if (!row) return error("Introuvable", 404);
  if (!parsed.data.excluded) {
    const refused = await requireSecondPassword(store, clientIp(req), parsed.data.password);
    if (refused) return refused;
  }
  const result = await store.decideResponses([row.id], parsed.data.excluded ? "invalidate" : "validate");
  if (result.refused.length) return error("Ce vote ne peut pas être compté : un autre vote de cet appareil compte déjà aujourd'hui.", 409);
  revalidatePath("/resultats");
  revalidatePath("/participants");
  return json({ ok: true });
}

/** Admin : suppression d'une réponse. */
export async function DELETE(req: Request, ctx: RouteContext<"/api/responses/[id]">) {
  const denied = await requireRole("admin", req);
  if (denied) return denied;
  const { id } = await ctx.params;
  if (!isUuid(id)) return error("Introuvable", 404);
  await getStore().deleteResponse(id);
  revalidatePath("/resultats");
  return json({ ok: true });
}
