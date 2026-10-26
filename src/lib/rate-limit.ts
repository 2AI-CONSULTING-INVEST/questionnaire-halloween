import "server-only";
import { isIP } from "node:net";

type Bucket = { count: number; reset: number };
const buckets = new Map<string, Bucket>();

/**
 * Limiteur en mémoire (fenêtre fixe). Best-effort : sur Vercel chaque instance
 * serverless a sa propre mémoire. Suffisant pour freiner les abus basiques.
 */
export function rateLimit(key: string, limit = 100, windowMs = 60_000): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset <= now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    if (buckets.size > 10_000) {
      for (const [k, v] of buckets) if (v.reset <= now) buckets.delete(k);
    }
    return true;
  }
  b.count += 1;
  return b.count <= limit;
}

/**
 * Adresse IP du client d'après les en-têtes (fonction pure, testable). Sur Vercel, `x-real-ip` puis
 * `x-vercel-forwarded-for` (posés par la plateforme, non falsifiables) avant `x-forwarded-for` ;
 * ailleurs `x-forwarded-for` (premier élément) puis `x-real-ip`. Valeur mal formée → null : le
 * limiteur et le plafond par IP s'appliquent alors sous la clé « inconnue », partagée.
 */
export function ipFromHeaders(get: (name: string) => string | null, vercel: boolean): string | null {
  const first = (v: string | null) => v?.split(",")[0]?.trim() || null;
  const candidates = vercel
    ? [get("x-real-ip"), first(get("x-vercel-forwarded-for")), first(get("x-forwarded-for"))]
    : [first(get("x-forwarded-for")), get("x-real-ip")];
  const ip = candidates.find((c) => c !== null) ?? null;
  return ip && isIP(ip) !== 0 ? ip : null;
}

export function clientIp(req: Request): string | null {
  return ipFromHeaders((name) => req.headers.get(name), !!process.env.VERCEL);
}
