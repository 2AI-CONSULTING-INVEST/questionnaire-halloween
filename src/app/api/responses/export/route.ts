import { getStore } from "@/lib/db";
import { allResponsesRows, participantsRows, toCsv, toXlsx } from "@/lib/export";
import { requireRole } from "@/lib/guard";

/**
 * Admin : export des données.
 *   ?scope=all|participants   (toutes les réponses / participants au tirage ; « raffle » = participants)
 *   ?raffle=1                 (réponses : uniquement celles reliées à un inscrit au tirage)
 *   ?format=xlsx|csv
 */
async function handle(req: Request) {
  const denied = await requireRole("viewer");
  if (denied) return denied;

  const url = new URL(req.url);
  const scopeParam = url.searchParams.get("scope");
  const scope = scopeParam === "participants" || scopeParam === "raffle" ? "participants" : "all";
  const format = url.searchParams.get("format") === "csv" ? "csv" : "xlsx";
  const onlyRaffle = scope === "all" && url.searchParams.get("raffle") === "1";

  const store = getStore();
  const [responses, decorations, participants, prizes] = await Promise.all([
    store.listResponses(),
    store.listDecorations(),
    store.listParticipants(),
    store.listPrizes(),
  ]);
  const rows =
    scope === "participants"
      ? participantsRows(participants, responses, prizes)
      : allResponsesRows(onlyRaffle ? responses.filter((r) => r.participant_id) : responses, decorations, participants);

  const stamp = new Date().toISOString().slice(0, 10);
  const base = scope === "participants" ? `participants-tirage-${stamp}` : onlyRaffle ? `reponses-inscrits-tirage-${stamp}` : `reponses-halloween-${stamp}`;
  const headers = {
    "Cache-Control": "no-store",
    "Content-Disposition": `attachment; filename="${base}.${format}"`,
  };

  if (format === "csv") {
    return new Response(toCsv(rows), { headers: { ...headers, "Content-Type": "text/csv; charset=utf-8" } });
  }
  const buf = toXlsx(rows, scope === "participants" ? "Participants" : "Réponses");
  return new Response(new Uint8Array(buf), {
    headers: { ...headers, "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  });
}

export const GET = handle;
export const POST = handle;
