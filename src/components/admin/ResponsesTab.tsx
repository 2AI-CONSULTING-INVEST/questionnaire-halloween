"use client";

import { Download, FileSpreadsheet, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { RiskSettings } from "@/lib/risk";
import { type Decoration, type ResponseRow } from "@/lib/schema";
import { usePage } from "./paged";
import { Button, Card, ConfirmDialog, DownloadLink, Empty, fmtDate, inputClass, PageFooter, RiskBadge, StatusBadge } from "./ui";
import { withBase } from "@/lib/base-path";

export type ResponsesStatus = "completed" | "held" | "incomplete" | "all";
const STATUS_LABEL: Record<ResponsesStatus, string> = { completed: "Comptés", held: "En attente", incomplete: "Inachevés", all: "Tous" };
const TITLE: Record<ResponsesStatus, string> = { completed: "Votes comptés", held: "Votes en attente de vérification", incomplete: "Votes inachevés", all: "Toutes les réponses" };

/** Dernière question atteinte par un vote inachevé, déduite des champs remplis. */
const lastStep = (r: ResponseRow) => (r.comment ? "Q3 Commentaire" : r.selected_decoration_id ? "Q2 Vote" : r.selected_restaurant ? "Q1 Préféré" : "Accueil");

export function ResponsesTab({
  decorations,
  canWrite,
  settings,
  status,
  setStatus,
  tick,
  onChanged,
}: {
  decorations: Decoration[];
  canWrite: boolean;
  settings: RiskSettings;
  status: ResponsesStatus;
  setStatus: (s: ResponsesStatus) => void;
  tick: number;
  onChanged: () => void;
}) {
  /** Uniquement les réponses reliées à un inscrit au tirage (liste et exports). */
  const [onlyRaffle, setOnlyRaffle] = useState(false);
  const decoName = useMemo(() => new Map(decorations.map((d) => [d.id, d.restaurant_name])), [decorations]);
  const page = usePage<ResponseRow>("/api/admin/responses", { status, ...(onlyRaffle ? { raffle: "1" } : {}) }, tick);
  const exportHref = (format: "csv" | "xlsx") => withBase(`/api/responses/export?scope=all&format=${format}&status=${status}${onlyRaffle ? "&raffle=1" : ""}`);

  async function remove(id: string) {
    await fetch(withBase(`/api/responses/${id}`), { method: "DELETE" });
    onChanged();
  }

  return (
    <Card
      title={`${TITLE[status]} (${page.total.toLocaleString("fr-FR")})`}
      actions={
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-muted dark:text-zinc-400">
            Afficher
            <select value={status} onChange={(e) => setStatus(e.target.value as ResponsesStatus)} className={inputClass} aria-label="Statut des réponses">
              {(Object.keys(STATUS_LABEL) as ResponsesStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="inline-flex items-center gap-2 text-sm font-semibold text-ink dark:text-zinc-100">
            <input type="checkbox" checked={onlyRaffle} onChange={(e) => setOnlyRaffle(e.target.checked)} className="h-4 w-4 accent-yellow-400" data-testid="only-raffle" />
            Uniquement les inscrits au tirage
          </label>
          <DownloadLink href={exportHref("csv")}>
            <Download className="h-4 w-4" aria-hidden /> CSV
          </DownloadLink>
          <DownloadLink href={exportHref("xlsx")}>
            <FileSpreadsheet className="h-4 w-4" aria-hidden /> Excel
          </DownloadLink>
        </div>
      }
    >
      {page.failed && (
        <p role="alert" className="mb-3 text-sm font-medium text-red-600 dark:text-red-400">
          Chargement impossible, réessayez.
        </p>
      )}
      {page.rows.length === 0 ? (
        <Empty>{page.loading ? "Chargement…" : "Aucune réponse pour l'instant."}</Empty>
      ) : (
        <>
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full min-w-[1040px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs font-semibold uppercase text-muted dark:border-zinc-800 dark:text-zinc-400">
                  <th className="px-5 py-2">Date</th>
                  <th className="px-3 py-2">Statut</th>
                  <th className="px-3 py-2">Risque</th>
                  <th className="px-3 py-2">Q1 Préféré</th>
                  <th className="px-3 py-2">Q2 Vote</th>
                  <th className="px-3 py-2">Q3 Commentaire</th>
                  <th className="px-3 py-2">Tirage</th>
                  <th className="px-3 py-2">Dernière activité</th>
                  <th className="px-5 py-2 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {page.rows.map((r) => (
                  <tr key={r.id} className="border-b border-line align-top last:border-0 dark:border-zinc-800">
                    <td className="whitespace-nowrap px-5 py-2.5 text-muted dark:text-zinc-400">{fmtDate(r.created_at)}</td>
                    <td className="px-3 py-2.5">
                      <StatusBadge row={r} />
                      {!r.completed_at && !r.blocked_at && <p className="mt-1 text-xs text-muted dark:text-zinc-400">Arrêt : {lastStep(r)}</p>}
                    </td>
                    <td className="px-3 py-2.5">
                      <RiskBadge score={r.risk_score} flags={r.risk_flags} settings={settings} />
                    </td>
                    <td className="px-3 py-2.5 text-ink dark:text-zinc-100">{r.selected_restaurant?.replace(/^CHAMAS TACOS\s*-\s*/i, "") ?? "Non renseigné"}</td>
                    <td className="px-3 py-2.5 font-medium text-ink dark:text-zinc-100">
                      {r.selected_decoration_id ? (decoName.get(r.selected_decoration_id) ?? "(supprimée)").replace(/^CHAMAS TACOS\s*-\s*/i, "") : "Non renseignée"}
                    </td>
                    <td className="max-w-xs px-3 py-2.5 text-ink dark:text-zinc-200">
                      <p className="line-clamp-3 break-words">{r.comment || "Aucun"}</p>
                    </td>
                    <td className="px-3 py-2.5 text-muted dark:text-zinc-400">{r.wants_raffle ? "Oui" : r.wants_raffle === false ? "Non" : "Non renseigné"}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-muted dark:text-zinc-400">{fmtDate(r.updated_at)}</td>
                    <td className="px-5 py-2.5 text-right">
                      {canWrite && (
                        <ConfirmDialog
                          title="Supprimer cette réponse ?"
                          description="Le vote et les informations de contact associées seront définitivement supprimés."
                          onConfirm={() => remove(r.id)}
                          trigger={
                            <Button variant="ghost" aria-label="Supprimer la réponse">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          }
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PageFooter shown={page.rows.length} total={page.total} more={!!page.nextCursor} loading={page.loading} onMore={() => void page.loadMore()} />
        </>
      )}
    </Card>
  );
}
