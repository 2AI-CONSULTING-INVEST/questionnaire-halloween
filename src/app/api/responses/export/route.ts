import { currentSession } from "@/lib/auth";
import { getStore } from "@/lib/db";
import { allResponsesRows, participantsRows, toCsv, toXlsx } from "@/lib/export";
import { requireRole } from "@/lib/guard";
import { error } from "@/lib/http";
import type { ResponseRow } from "@/lib/schema";

/**
 * Admin : export des données.
 *   ?scope=all|participants   (toutes les réponses / participants au tirage ; « raffle » = participants)
 *   ?deleted=1                (participants : les supprimés, à part, avec la colonne « Supprimé le »)
 *   ?raffle=1                 (réponses : uniquement celles reliées à un inscrit au tirage)
 *   ?status=completed|incomplete|all  (réponses : filtre de l'onglet Réponses ; défaut : toutes)
 *   ?format=xlsx|csv
 * Rôle « lecture seule » : l'export des participants est refusé (403) et celui des réponses sort sans
 * les colonnes personnelles (email, téléphone, prénom, nom, adresse IP, navigateur).
 */
const STATUS_FILTER: Record<string, (r: ResponseRow) => boolean> = {
  completed: (r) => !!r.completed_at,
  incomplete: (r) => !r.completed_at && !r.blocked_at,
};
const PERSONAL_COLUMNS = new Set(["Email", "Téléphone", "Prénom", "Nom", "Adresse IP", "Navigateur"]);

async function handle(req: Request) {
  const denied = await requireRole("viewer", req);
  if (denied) return denied;
  const viewerOnly = (await currentSession())?.role !== "admin";

  const url = new URL(req.url);
  const scopeParam = url.searchParams.get("scope");
  const scope = scopeParam === "participants" || scopeParam === "raffle" ? "participants" : "all";
  if (scope === "participants" && viewerOnly) return error("Export réservé au compte en écriture", 403);
  const format = url.searchParams.get("format") === "csv" ? "csv" : "xlsx";
  const onlyRaffle = scope === "all" && url.searchParams.get("raffle") === "1";
  const status = STATUS_FILTER[url.searchParams.get("status") ?? ""] ?? (() => true);
  const deleted = scope === "participants" && url.searchParams.get("deleted") === "1";

  const store = getStore();
  const [responses, decorations, participants, prizes] = await Promise.all([
    store.listResponses(),
    store.listDecorations(),
    store.listParticipants(deleted),
    store.listPrizes(),
  ]);
  const full =
    scope === "participants"
      ? participantsRows(participants, responses, prizes)
      : allResponsesRows(responses.filter((r) => status(r) && (!onlyRaffle || r.participant_id)), decorations, participants);
  const rows = viewerOnly ? full.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !PERSONAL_COLUMNS.has(k)))) : full;

  const stamp = new Date().toISOString().slice(0, 10);
  const base = deleted ? `participants-supprimes-${stamp}` : scope === "participants" ? `participants-tirage-${stamp}` : onlyRaffle ? `reponses-inscrits-tirage-${stamp}` : `reponses-halloween-${stamp}`;
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
