import { getStore } from "@/lib/db";
import { allResponsesRows, raffleRows, toCsv, toXlsx } from "@/lib/export";
import { requireRole } from "@/lib/guard";

/**
 * Admin : export des données.
 *   ?scope=all|raffle   (toutes les réponses / participants au tirage)
 *   ?format=xlsx|csv
 */
async function handle(req: Request) {
  const denied = await requireRole("viewer");
  if (denied) return denied;

  const url = new URL(req.url);
  const scope = url.searchParams.get("scope") === "raffle" ? "raffle" : "all";
  const format = url.searchParams.get("format") === "csv" ? "csv" : "xlsx";

  const store = getStore();
  const [responses, decorations] = await Promise.all([store.listResponses(), store.listDecorations()]);
  const rows = scope === "raffle" ? raffleRows(responses, decorations) : allResponsesRows(responses, decorations);

  const stamp = new Date().toISOString().slice(0, 10);
  const base = scope === "raffle" ? `participants-tirage-${stamp}` : `reponses-halloween-${stamp}`;
  const headers = {
    "Cache-Control": "no-store",
    "Content-Disposition": `attachment; filename="${base}.${format}"`,
  };

  if (format === "csv") {
    return new Response(toCsv(rows), { headers: { ...headers, "Content-Type": "text/csv; charset=utf-8" } });
  }
  const buf = toXlsx(rows, scope === "raffle" ? "Participants" : "Réponses");
  return new Response(new Uint8Array(buf), {
    headers: { ...headers, "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  });
}

export const GET = handle;
export const POST = handle;
