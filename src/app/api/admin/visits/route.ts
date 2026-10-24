import { z } from "zod";
import { getStore } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { error, json, zodError } from "@/lib/http";
import { decodeCursor, PAGE_MAX, PAGE_SIZE } from "@/lib/paging";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(PAGE_MAX).default(PAGE_SIZE),
  cursor: z.string().max(600).optional(),
  status: z.enum(["counted", "rejected", "all"]).default("all"),
});

/** Admin (lecture) : page des dernières visites (comptées et rejetées), 100 par page. ?limit&cursor&status=counted|rejected|all */
export async function GET(req: Request) {
  const denied = await requireRole("viewer");
  if (denied) return denied;
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return zodError(parsed.error);
  const p = parsed.data;
  const cursor = p.cursor ? decodeCursor(p.cursor) : null;
  if (p.cursor && !cursor) return error("Curseur invalide");
  return json(await getStore().pageVisits(p.status, { limit: p.limit, cursor }), { headers: { "Cache-Control": "no-store" } });
}
