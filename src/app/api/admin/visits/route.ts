import { z } from "zod";
import { currentSession } from "@/lib/auth";
import { getStore } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { error, json, zodError } from "@/lib/http";
import { decodeCursor, PAGE_MAX, PAGE_SIZE } from "@/lib/paging";
import { redactVisitForViewer } from "@/lib/redact";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(PAGE_MAX).default(PAGE_SIZE),
  cursor: z.string().max(600).optional(),
  status: z.enum(["counted", "rejected", "all"]).default("all"),
});

/** Admin (lecture) : page des dernières visites (comptées et rejetées), 100 par page ; sans IP, navigateur ni appareil en lecture seule. ?limit&cursor&status=counted|rejected|all */
export async function GET(req: Request) {
  const denied = await requireRole("viewer");
  if (denied) return denied;
  const viewerOnly = (await currentSession())?.role !== "admin";
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return zodError(parsed.error);
  const p = parsed.data;
  const cursor = p.cursor ? decodeCursor(p.cursor) : null;
  if (p.cursor && !cursor) return error("Curseur invalide");
  const page = await getStore().pageVisits(p.status, { limit: p.limit, cursor });
  return json(viewerOnly ? { ...page, rows: page.rows.map(redactVisitForViewer) } : page, { headers: { "Cache-Control": "no-store" } });
}
