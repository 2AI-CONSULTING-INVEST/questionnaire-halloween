import { z } from "zod";
import { getStore } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { error, json, zodError } from "@/lib/http";
import { decodeCursor, PAGE_MAX, PAGE_SIZE } from "@/lib/paging";
import { loadRiskSettings } from "@/lib/risk";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(PAGE_MAX).default(PAGE_SIZE),
  cursor: z.string().max(600).optional(),
  /** Défaut : validés ; avec `risk=flagged`, tous (les bloqués n'ont pas de completed_at). */
  status: z.enum(["completed", "incomplete", "blocked", "excluded", "all"]).optional(),
  raffle: z.enum(["1"]).optional(),
  risk: z.enum(["flagged"]).optional(),
  /** Adresse IP complète (v4 ou v6), ou début de l'empreinte en hexadécimal ; autre chose → page vide. */
  q: z.string().trim().regex(/^[0-9a-fA-F:.]{3,64}$/).optional(),
});

/**
 * Admin : page de réponses (les plus récentes d'abord), 100 par page, curseur `created_at|id`.
 * ?limit=100&cursor=…&status=completed|incomplete|blocked|excluded|all&raffle=1&risk=flagged&q=
 * → { rows, nextCursor, total }
 */
export async function GET(req: Request) {
  const denied = await requireRole("viewer");
  if (denied) return denied;
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return zodError(parsed.error);
  const p = parsed.data;
  const cursor = p.cursor ? decodeCursor(p.cursor) : null;
  if (p.cursor && !cursor) return error("Curseur invalide");

  const store = getStore();
  const flaggedFrom = p.risk ? (await loadRiskSettings(store)).flag_threshold : undefined;
  const status = p.status ?? (p.risk ? "all" : "completed");
  const page = await store.pageResponses({ status, raffle: p.raffle === "1", flaggedFrom, q: p.q }, { limit: p.limit, cursor });
  return json(page, { headers: { "Cache-Control": "no-store" } });
}
