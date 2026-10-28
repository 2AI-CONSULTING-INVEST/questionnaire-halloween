"use client";

import { Download, FileSpreadsheet, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { ResponseStatus } from "@/lib/db";
import { reasonLabel } from "@/lib/fraud-rules";
import { flagLabel, type RiskSettings } from "@/lib/risk";
import { type Decoration, type ResponseRow } from "@/lib/schema";
import { usePage } from "./paged";
import { Button, Card, ConfirmDialog, DownloadLink, Empty, fmtDate, inputClass, PageFooter, RiskBadge, StatusBadge } from "./ui";
import { withBase } from "@/lib/base-path";

export type ResponsesStatus = ResponseStatus;
const STATUS_LABEL: Record<ResponsesStatus, string> = { validated: "Tous les votes validés", completed: "Comptés", held: "En attente", incomplete: "Incomplets", blocked: "Bloqués", excluded: "Exclus", all: "Tout" };
const TITLE: Record<ResponsesStatus, string> = {
  validated: "Votes validés",
  completed: "Votes comptés",
  held: "Votes en attente de vérification",
  incomplete: "Votes incomplets",
  blocked: "Votes bloqués",
  excluded: "Votes exclus",
  all: "Toutes les réponses",
};

/** Dernière question atteinte par un vote inachevé, déduite des champs remplis. */
const lastStep = (r: ResponseRow) => (r.comment ? "Q3 Commentaire" : r.selected_decoration_id ? "Q2 Vote" : r.selected_restaurant ? "Q1 Préféré" : "Accueil");

/** Raisons lisibles d'un score : règles anti-fraude puis signaux de l'appareil (mêmes libellés que l'onglet Sécurité). */
const reasons = (r: ResponseRow) => [...(r.fraud_reasons ?? []).map(reasonLabel), ...(r.risk_flags ?? []).map(flagLabel)].join(", ");

const checkboxClass = "h-4 w-4 accent-yellow-400";

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
  /** Score > 0 ou au moins une règle anti-fraude. */
  const [risky, setRisky] = useState(false);
  /** Jours de validation (Paris), inclus ; vide = sans borne. */
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [byRisk, setByRisk] = useState(false);
  /** Réponses cochées ; seules celles encore affichées comptent (changement de filtre, rechargement). */
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [removeFailed, setRemoveFailed] = useState(0);
  const decoName = useMemo(() => new Map(decorations.map((d) => [d.id, d.restaurant_name])), [decorations]);
  // Mêmes paramètres pour la liste et les exports (l'export ignore le tri).
  const params = Object.fromEntries(Object.entries({ status, raffle: onlyRaffle ? "1" : "", risk: risky ? "any" : "", from, to, sort: byRisk ? "risk" : "" }).filter(([, v]) => v));
  const page = usePage<ResponseRow>("/api/admin/responses", params, tick);
  const exportHref = (format: "csv" | "xlsx") => withBase(`/api/responses/export?${new URLSearchParams({ scope: "all", format, ...params })}`);
  const chosen = page.rows.filter((r) => selected.has(r.id));
  const toggle = (id: string, on: boolean) => setSelected((prev) => (on ? new Set(prev).add(id) : new Set([...prev].filter((x) => x !== id))));

  /** Suppression définitive par la route existante (une requête par réponse, chacune journalisée) ; les échecs sont comptés. */
  async function removeMany(ids: string[]) {
    let failed = 0;
    for (const id of ids) {
      const res = await fetch(withBase(`/api/responses/${id}`), { method: "DELETE" }).catch(() => null);
      if (!res?.ok) failed += 1;
    }
    setRemoveFailed(failed);
    setSelected(new Set());
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
          <label className="inline-flex items-center gap-2 text-sm text-muted dark:text-zinc-400">
            Du
            <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className={inputClass} aria-label="Validés à partir du" />
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-muted dark:text-zinc-400">
            Au
            <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={inputClass} aria-label="Validés jusqu'au" />
          </label>
          <label className="inline-flex items-center gap-2 text-sm font-semibold text-ink dark:text-zinc-100">
            <input type="checkbox" checked={risky} onChange={(e) => setRisky(e.target.checked)} className={checkboxClass} data-testid="only-risky" />
            Score non nul
          </label>
          <label className="inline-flex items-center gap-2 text-sm font-semibold text-ink dark:text-zinc-100">
            <input type="checkbox" checked={byRisk} onChange={(e) => setByRisk(e.target.checked)} className={checkboxClass} data-testid="sort-risk" />
            Score décroissant
          </label>
          <label className="inline-flex items-center gap-2 text-sm font-semibold text-ink dark:text-zinc-100">
            <input type="checkbox" checked={onlyRaffle} onChange={(e) => setOnlyRaffle(e.target.checked)} className={checkboxClass} data-testid="only-raffle" />
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
      {removeFailed > 0 && (
        <p role="alert" className="mb-3 text-sm font-medium text-red-600 dark:text-red-400">
          {removeFailed} suppression(s) ont échoué, actualisez puis réessayez.
        </p>
      )}
      {canWrite && chosen.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-3 text-sm font-semibold text-ink dark:text-zinc-100">
          <span aria-live="polite">{chosen.length.toLocaleString("fr-FR")} réponse(s) sélectionnée(s)</span>
          <ConfirmDialog
            title={`Supprimer ${chosen.length} réponse(s) ?`}
            description="Les votes sélectionnés seront définitivement supprimés. Les inscriptions au tirage éventuelles (pseudo, téléphone, email) restent dans l'onglet Participants."
            onConfirm={() => void removeMany(chosen.map((r) => r.id))}
            trigger={
              <Button variant="danger">
                <Trash2 className="h-4 w-4" aria-hidden /> Supprimer la sélection
              </Button>
            }
          />
          <Button variant="ghost" onClick={() => setSelected(new Set())}>
            Tout décocher
          </Button>
        </div>
      )}
      {page.rows.length === 0 ? (
        <Empty>{page.loading ? "Chargement…" : "Aucune réponse pour l'instant."}</Empty>
      ) : (
        <>
          <div className="relative -mx-5 overflow-x-auto">
            <table className="w-full min-w-[1080px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs font-semibold uppercase text-muted dark:border-zinc-800 dark:text-zinc-400">
                  {canWrite && (
                    <th className="w-10 py-2 pl-5">
                      <input
                        type="checkbox"
                        checked={chosen.length > 0 && chosen.length === page.rows.length}
                        onChange={(e) => setSelected(new Set(e.target.checked ? page.rows.map((r) => r.id) : []))}
                        className={checkboxClass}
                        aria-label="Sélectionner toutes les réponses affichées"
                      />
                    </th>
                  )}
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
                    {canWrite && (
                      <td className="py-2.5 pl-5">
                        <input type="checkbox" checked={selected.has(r.id)} onChange={(e) => toggle(r.id, e.target.checked)} className={checkboxClass} aria-label="Sélectionner cette réponse" />
                      </td>
                    )}
                    <td className="whitespace-nowrap px-5 py-2.5 text-muted dark:text-zinc-400">{fmtDate(r.created_at)}</td>
                    <td className="px-3 py-2.5">
                      <StatusBadge row={r} />
                      {!r.completed_at && !r.blocked_at && <p className="mt-1 text-xs text-muted dark:text-zinc-400">Arrêt : {lastStep(r)}</p>}
                    </td>
                    <td className="px-3 py-2.5">
                      <RiskBadge score={r.risk_score} flags={r.risk_flags} settings={settings} />
                      {reasons(r) && <p className="mt-1 max-w-xs text-xs text-muted dark:text-zinc-400">{reasons(r)}</p>}
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
                          description="Le vote sera définitivement supprimé. Si la personne s'est inscrite au tirage, son inscription (pseudo, téléphone, email) reste dans l'onglet Participants."
                          onConfirm={() => void removeMany([r.id])}
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
