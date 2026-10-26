import { getStore } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { json, readJson, zodError } from "@/lib/http";
import { riskSettingsSchema } from "@/lib/risk";

/** Admin (écriture, journalisé) : réglages du score de risque { mode, flag_threshold, block_threshold }. */
export async function PATCH(req: Request) {
  const denied = await requireRole("admin", req);
  if (denied) return denied;
  const body = await readJson(req);
  if (body instanceof Response) return body;
  const parsed = riskSettingsSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);
  await getStore().setSetting("risk", parsed.data);
  return json({ ok: true, settings: parsed.data });
}
