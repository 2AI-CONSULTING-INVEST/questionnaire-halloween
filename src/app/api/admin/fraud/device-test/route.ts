import { serverNow } from "@/lib/clock";
import { parisDay } from "@/lib/day";
import { getStore } from "@/lib/db";
import { recognizeDevice, requestSignals } from "@/lib/fraud-server";
import { requireRole } from "@/lib/guard";
import { json, readJson, zodError } from "@/lib/http";
import { clientIp } from "@/lib/rate-limit";
import { loadRiskSettings } from "@/lib/risk";
import { deviceSchema } from "@/lib/schema";
import { readVoter } from "@/lib/voter";

/**
 * Admin (lecture) : « Tester cet appareil ». Ce que l'appareil actuel enverrait et ce que le serveur en
 * déduit (classe d'entropie, navigation privée, début de la clé hw, classe et pays de l'IP), et s'il serait
 * reconnu comme ayant voté aujourd'hui (et par quel moyen). Aucun vote n'est créé.
 */
export async function POST(req: Request) {
  const denied = await requireRole("viewer");
  if (denied) return denied;
  const body = await readJson(req);
  if (body instanceof Response) return body;
  const parsed = deviceSchema.optional().safeParse((body as { device?: unknown } | undefined)?.device);
  if (!parsed.success) return zodError(parsed.error);
  const store = getStore();
  const now = serverNow(req);
  const day = parisDay(now);
  const [settings, sig] = await Promise.all([loadRiskSettings(store), requestSignals(req, clientIp(req), parsed.data)]);
  const { recognized } = await recognizeDevice(store, settings, day, readVoter(req), sig, now);
  return json(
    {
      entropy: sig.stamp.hw_entropy ?? null,
      declaredEntropy: parsed.data?.hwEntropy ?? null,
      privateMode: sig.stamp.private_mode ?? null,
      hwPrefix: sig.stamp.hw_key?.slice(0, 8) ?? null,
      model: parsed.data?.model ?? null,
      ipClass: sig.ipClass,
      country: sig.country,
      city: sig.stamp.ip_city ?? null,
      tokens: sig.storageKeys.length,
      recognized,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
