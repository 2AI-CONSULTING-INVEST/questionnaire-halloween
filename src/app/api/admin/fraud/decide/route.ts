import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getStore } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { error, json, readJson, zodError } from "@/lib/http";
import { clientIp } from "@/lib/rate-limit";
import { requireSecondPassword } from "@/lib/second-password";

const decideSchema = z
  .object({
    ids: z.array(z.string().uuid()).min(1).max(500),
    action: z.enum(["validate", "invalidate"]),
    password: z.string().max(200).optional(),
  })
  .strict();

/**
 * Admin (écriture, journalisé avec les votes concernés) : faire compter (`validate` : valider un vote en
 * attente, réintégrer un vote exclu, compter un vote bloqué) ou exclure (`invalidate`). Faire compter exige
 * la double validation (mot de passe de lecture seule, une fois pour toute une action groupée).
 * Exclure ne demande pas de mot de passe. Le moteur de groupes ne touchera plus ces lignes.
 */
export async function POST(req: Request) {
  const denied = await requireRole("admin", req);
  if (denied) return denied;
  const body = await readJson(req);
  if (body instanceof Response) return body;
  const parsed = decideSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);
  const store = getStore();
  if (parsed.data.action === "validate") {
    const refused = await requireSecondPassword(store, clientIp(req), parsed.data.password);
    if (refused) return refused;
  }
  const result = await store.decideResponses(parsed.data.ids, parsed.data.action);
  revalidatePath("/resultats");
  revalidatePath("/participants");
  if (!result.done.length && result.refused.length) {
    return error("Aucun vote n'a pu être compté : un autre vote du même appareil compte déjà ce jour-là, ou la tentative n'a pas de vote complet.", 409, result);
  }
  return json(result);
}
