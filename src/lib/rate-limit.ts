import "server-only";

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

export function clientIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  const ip = fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip");
  return ip && /^[0-9a-fA-F:.]{3,45}$/.test(ip) ? ip : null;
}
