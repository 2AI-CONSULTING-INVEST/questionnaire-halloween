"use client";

import { FileSpreadsheet, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { LABELS, type Decoration, type ResponseRow } from "@/lib/schema";
import { Button, Card, ConfirmDialog, DownloadLink, Empty, fmtDate } from "./ui";

const PAGE = 50;

export function ResponsesTab({
  responses,
  decorations,
  canWrite,
  onChanged,
}: {
  responses: ResponseRow[];
  decorations: Decoration[];
  canWrite: boolean;
  onChanged: () => void;
}) {
  const [onlyCompleted, setOnlyCompleted] = useState(true);
  const [limit, setLimit] = useState(PAGE);
  const decoName = useMemo(() => new Map(decorations.map((d) => [d.id, d.restaurant_name])), [decorations]);
  const rows = onlyCompleted ? responses.filter((r) => r.completed_at) : responses;

  async function remove(id: string) {
    await fetch(`/api/responses/${id}`, { method: "DELETE" });
    onChanged();
  }

  return (
    <Card
      title={`Réponses (${rows.length})`}
      actions={
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-muted dark:text-zinc-400">
            <input type="checkbox" checked={onlyCompleted} onChange={(e) => setOnlyCompleted(e.target.checked)} className="h-4 w-4 accent-yellow-400" />
            Votes validés uniquement
          </label>
          <DownloadLink href="/api/responses/export?scope=all&format=xlsx">
            <FileSpreadsheet className="h-4 w-4" aria-hidden /> Excel
          </DownloadLink>
        </div>
      }
    >
      {rows.length === 0 ? (
        <Empty>Aucune réponse pour l&apos;instant.</Empty>
      ) : (
        <>
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs font-semibold uppercase text-muted dark:border-zinc-800 dark:text-zinc-400">
                  <th className="px-5 py-2">Date</th>
                  <th className="px-3 py-2">Q1</th>
                  <th className="px-3 py-2">Q2 Préféré</th>
                  <th className="px-3 py-2">Q3</th>
                  <th className="px-3 py-2">Q4 Vote</th>
                  <th className="px-3 py-2">Q5</th>
                  <th className="px-3 py-2">Q6 Commentaire</th>
                  <th className="px-3 py-2">Tirage</th>
                  <th className="px-5 py-2 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, limit).map((r) => (
                  <tr key={r.id} className="border-b border-line align-top last:border-0 dark:border-zinc-800">
                    <td className="whitespace-nowrap px-5 py-2.5 text-muted dark:text-zinc-400">
                      {fmtDate(r.created_at)}
                      {!r.completed_at && <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-muted dark:bg-zinc-800">incomplet</span>}
                    </td>
                    <td className="px-3 py-2.5 text-ink dark:text-zinc-100">{r.voter_type ? LABELS.voter_type[r.voter_type] : "—"}</td>
                    <td className="px-3 py-2.5 text-ink dark:text-zinc-100">{r.selected_restaurant?.replace(/^CHAMAS TACOS\s*-\s*/i, "") ?? "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-muted dark:text-zinc-400">{r.visit_period ? LABELS.visit_period[r.visit_period] : "—"}</td>
                    <td className="px-3 py-2.5 font-medium text-ink dark:text-zinc-100">
                      {r.selected_decoration_id ? (decoName.get(r.selected_decoration_id) ?? "(supprimée)").replace(/^CHAMAS TACOS\s*-\s*/i, "") : "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-muted dark:text-zinc-400">{r.decoration_impact ? LABELS.decoration_impact[r.decoration_impact] : "—"}</td>
                    <td className="max-w-xs px-3 py-2.5 text-ink dark:text-zinc-200">
                      <p className="line-clamp-3 break-words">{r.comment || "—"}</p>
                    </td>
                    <td className="px-3 py-2.5 text-muted dark:text-zinc-400">{r.wants_raffle ? "Oui" : r.wants_raffle === false ? "Non" : "—"}</td>
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
          {rows.length > limit && (
            <div className="mt-4 text-center">
              <Button onClick={() => setLimit((l) => l + PAGE)}>Afficher plus ({rows.length - limit} restantes)</Button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
