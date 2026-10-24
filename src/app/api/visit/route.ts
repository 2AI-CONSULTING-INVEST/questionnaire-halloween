import { serverNow } from "@/lib/clock";
import { parisDay } from "@/lib/day";
import { getStore, type VisitInput } from "@/lib/db";
import { limited, readJson, zodError } from "@/lib/http";
import { clientIp } from "@/lib/rate-limit";
import { visitSchema } from "@/lib/schema";
import { visitRejection, referrerHost } from "@/lib/visits";
import { deviceStamp, readVoter } from "@/lib/voter";

/**
 * Public : beacon de visite envoyé par la page (src/components/VisitBeacon.tsx). Barrières anti-robots
 * (src/lib/visits.ts) : UA de robot ou absent, webdriver, pas d'empreinte, appareil incohérent. Au-delà de
 * 30 beacons par minute depuis une même IP, les suivants sont ignorés sans rien écrire (une IP ne peut pas
 * remplir la table). Une ligne rejetée ne garde que l'IP, l'UA, la raison et le jour. Toujours 204.
 */
export async function POST(req: Request) {
  if (limited(req, "visit", 30)) return new Response(null, { status: 204 });
  const store = getStore();
  const day = parisDay(serverNow(req));
  const ip = clientIp(req);
  const userAgent = req.headers.get("user-agent")?.slice(0, 500) ?? null;
  const rejectedRow = (rejected: string): VisitInput => ({ day, ip, user_agent: userAgent, path: null, referrer: null, device_hash: null, device_info: null, visitor_id: null, rejected });

  const parsed = visitSchema.safeParse(await readJson(req));
  if (!parsed.success) return zodError(parsed.error);
  const { path, referrer, device } = parsed.data;

  const rejected = visitRejection(userAgent, device);
  if (rejected) {
    await store.recordVisit(rejectedRow(rejected));
    return new Response(null, { status: 204 });
  }
  const stamp = deviceStamp(device);
  await store.recordVisit({
    day,
    ip,
    user_agent: userAgent,
    path: path.replace(/^\/halloween(?=\/|$)/, "") || "/",
    referrer: referrerHost(referrer, req.headers.get("host")?.toLowerCase() ?? null),
    device_hash: stamp.device_hash,
    device_info: stamp.device_info,
    visitor_id: readVoter(req),
    rejected: null,
  });
  return new Response(null, { status: 204 });
}
