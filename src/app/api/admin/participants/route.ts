import { z } from "zod";
import { getStore } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { error, json, zodError } from "@/lib/http";
import { decodeCursor, PAGE_MAX, PAGE_SIZE } from "@/lib/paging";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(PAGE_MAX).default(PAGE_SIZE),
  cursor: z.string().max(600).optional(),
  q: z.string().trim().max(64).optional(),
  sort: z.enum(["pseudo", "email", "date"]).default("date"),
  dir: z.enum(["asc", "desc"]).default("desc"),
  /** Participants supprimés (suppression douce) au lieu des actifs. */
  deleted: z.enum(["1"]).optional(),
});

/**
 * Admin : page de participants au tirage, 100 par page, recherche et tri côté stockage.
 * ?limit=100&cursor=…&q=&sort=pseudo|email|date&dir=asc|desc&deleted=1 → { rows, nextCursor, total } (avec `votes` par personne).
 * ?light=1 → liste complète allégée [{ id, pseudo }] des actifs (attribution des lots, compteur de l'onglet).
 */
export async function GET(req: Request) {
  const denied = await requireRole("viewer");
  if (denied) return denied;
  const headers = { "Cache-Control": "no-store" };
  const url = new URL(req.url);
  if (url.searchParams.get("light") === "1") {
    const all = await getStore().listParticipants();
    return json(all.map((p) => ({ id: p.id, pseudo: p.pseudo })), { headers });
  }
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return zodError(parsed.error);
  const p = parsed.data;
  const cursor = p.cursor ? decodeCursor(p.cursor) : null;
  if (p.cursor && !cursor) return error("Curseur invalide");
  const page = await getStore().pageParticipants({ q: p.q || undefined, sort: p.sort, dir: p.dir, deleted: p.deleted === "1" }, { limit: p.limit, cursor });
  return json(page, { headers });
}
