import { z } from "zod";
import { currentSession } from "@/lib/auth";
import { getStore, RESPONSE_STATUSES } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { error, json, zodError } from "@/lib/http";
import { decodeCursor, PAGE_MAX, PAGE_SIZE } from "@/lib/paging";
import { redactForViewer } from "@/lib/redact";
import { loadRiskSettings } from "@/lib/risk";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(PAGE_MAX).default(PAGE_SIZE),
  cursor: z.string().max(600).optional(),
  /** Défaut : tous les votes validés ; avec `risk`, tous (les bloqués n'ont pas de completed_at). */
  status: z.enum(RESPONSE_STATUSES).optional(),
  raffle: z.enum(["1"]).optional(),
  /** `flagged` : score ≥ seuil de signalement ou bloquée ; `any` : score > 0 ou au moins une règle anti-fraude. */
  risk: z.enum(["flagged", "any"]).optional(),
  /** Jours de validation (Paris), inclus. */
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  /** Score décroissant au lieu des plus récentes d'abord. */
  sort: z.enum(["risk"]).optional(),
  /** Adresse IP complète (v4 ou v6), ou début de l'empreinte en hexadécimal ; autre chose → page vide. */
  q: z.string().trim().regex(/^[0-9a-fA-F:.]{3,64}$/).optional(),
});

/**
 * Admin : page de réponses (les plus récentes d'abord, ou par score), 100 par page, curseur `created_at|id` (ou `score|id`).
 * ?limit=100&cursor=…&status=validated|completed|held|incomplete|blocked|excluded|all&raffle=1&risk=flagged|any&from=AAAA-MM-JJ&to=AAAA-MM-JJ&sort=risk&q=
 * (validated : tous les votes validés ; completed : votes comptés)
 * → { rows, nextCursor, total } (en lecture seule : sans IP, navigateur ni appareil)
 */
export async function GET(req: Request) {
  const denied = await requireRole("viewer");
  if (denied) return denied;
  const viewerOnly = (await currentSession())?.role !== "admin";
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return zodError(parsed.error);
  const p = parsed.data;
  const cursor = p.cursor ? decodeCursor(p.cursor) : null;
  if (p.cursor && !cursor) return error("Curseur invalide");

  const store = getStore();
  const flaggedFrom = p.risk === "flagged" ? (await loadRiskSettings(store)).flag_threshold : undefined;
  const status = p.status ?? (p.risk ? "all" : "validated");
  const page = await store.pageResponses({ status, raffle: p.raffle === "1", flaggedFrom, risky: p.risk === "any", from: p.from, to: p.to, q: p.q, sort: p.sort }, { limit: p.limit, cursor });
  return json(viewerOnly ? { ...page, rows: page.rows.map(redactForViewer) } : page, { headers: { "Cache-Control": "no-store" } });
}
