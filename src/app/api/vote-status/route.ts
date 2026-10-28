import { serverNow } from "@/lib/clock";
import { nextParisMidnight, parisDay } from "@/lib/day";
import { getStore } from "@/lib/db";
import { arrivalVoted } from "@/lib/fraud-rules";
import { recognizeDevice, requestSignals } from "@/lib/fraud-server";
import { json, limited, readJson, zodError } from "@/lib/http";
import { clientIp } from "@/lib/rate-limit";
import { loadRiskSettings } from "@/lib/risk";
import { deviceSchema } from "@/lib/schema";
import { readVoter } from "@/lib/voter";

/**
 * Public, lecture seule : cet appareil a-t-il déjà une tentative aujourd'hui, et quand le vote rouvre-t-il ?
 * Même fonction de reconnaissance que l'ouverture et la validation (cookie, jetons du stockage, clé hw
 * forte avec un second indice, même ordinateur depuis un autre navigateur B4, avec la clé inter-navigateurs,
 * la clé stricte, le réseau et l'heure du serveur) : elles ne peuvent pas diverger. Ne renvoie jamais le motif, et ne laisse aucune trace.
 * POST : avec les signaux d'appareil (arrivée sur la page) ; GET : cookie seul (anciennes pages en cache).
 */
async function status(req: Request, device: unknown) {
  const parsed = deviceSchema.optional().safeParse(device);
  if (!parsed.success) return zodError(parsed.error);
  const store = getStore();
  const now = serverNow(req);
  const day = parisDay(now);
  const [settings, sig] = await Promise.all([loadRiskSettings(store), requestSignals(req, clientIp(req), parsed.data)]);
  const { recognized } = await recognizeDevice(store, settings, day, readVoter(req), sig, now);
  // Mode observation : seul le cookie reconnaît (la règle de base) ; clé hw, stockage et B4 n'ont aucun effet.
  const votedToday = arrivalVoted(recognized, settings.mode);
  return json(
    { votedToday, today: day, nextResetAt: nextParisMidnight(now).toISOString(), now: new Date(now).toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(req: Request) {
  const blocked = limited(req, "vote-status", 60);
  if (blocked) return blocked;
  const body = await readJson(req);
  if (body instanceof Response) return body;
  return status(req, (body as { device?: unknown } | undefined)?.device);
}

export async function GET(req: Request) {
  const blocked = limited(req, "vote-status", 60);
  if (blocked) return blocked;
  return status(req, undefined);
}
