"use client";

import { ArrowUpDown, Download, Search, Trophy } from "lucide-react";
import { useMemo, useState } from "react";
import { formatFrPhone, isRaffleEntry, type Decoration, type ResponseRow } from "@/lib/schema";
import { Button, Card, DownloadLink, Empty, fmtDate, inputClass } from "./ui";
import { withBase } from "@/lib/base-path";

type SortKey = "name" | "email" | "date";
type Sort = { key: SortKey; asc: boolean };

function SortBtn({ k, sort, setSort, children }: { k: SortKey; sort: Sort; setSort: React.Dispatch<React.SetStateAction<Sort>>; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => setSort((s) => ({ key: k, asc: s.key === k ? !s.asc : true }))}
      className="inline-flex items-center gap-1 font-semibold uppercase hover:text-ink dark:hover:text-zinc-100"
    >
      {children} <ArrowUpDown className={`h-3 w-3 ${sort.key === k ? "text-ink dark:text-zinc-100" : ""}`} aria-hidden />
    </button>
  );
}

export function ParticipantsTab({
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
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>({ key: "date", asc: false });
  const [busy, setBusy] = useState<string | null>(null);
  const decoName = useMemo(() => new Map(decorations.map((d) => [d.id, d.restaurant_name])), [decorations]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = responses
      .filter(isRaffleEntry)
      .filter((r) => !needle || r.participant_name?.toLowerCase().includes(needle) || r.email?.toLowerCase().includes(needle));
    const val = (r: ResponseRow) =>
      sort.key === "name" ? r.participant_name ?? "" : sort.key === "email" ? r.email ?? "" : r.completed_at ?? "";
    return list.sort((a, b) => (sort.asc ? 1 : -1) * val(a).localeCompare(val(b), "fr"));
  }, [responses, q, sort]);

  const winners = rows.filter((r) => r.is_winner).length;

  async function toggleWinner(r: ResponseRow) {
    setBusy(r.id);
    try {
      await fetch(withBase(`/api/responses/${r.id}/winner`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_winner: !r.is_winner }),
      });
      onChanged();
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card
      title={`Participants au tirage (${rows.length}) · ${winners} gagnant${winners > 1 ? "s" : ""}`}
      actions={
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <input
              type="search"
              placeholder="Rechercher nom ou email"
              aria-label="Rechercher un participant"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className={`${inputClass} w-60 pl-8`}
            />
          </div>
          <DownloadLink href={withBase("/api/responses/export?scope=raffle&format=csv")}>
            <Download className="h-4 w-4" aria-hidden /> CSV
          </DownloadLink>
        </div>
      }
    >
      {rows.length === 0 ? (
        <Empty>Aucun participant {q ? "ne correspond à la recherche" : "pour l'instant"}.</Empty>
      ) : (
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted dark:border-zinc-800 dark:text-zinc-400">
                <th className="px-5 py-2"><SortBtn k="name" sort={sort} setSort={setSort}>Nom</SortBtn></th>
                <th className="px-3 py-2"><SortBtn k="email" sort={sort} setSort={setSort}>Email</SortBtn></th>
                <th className="px-3 py-2 font-semibold uppercase">Téléphone</th>
                <th className="px-3 py-2 font-semibold uppercase">Restaurant voté</th>
                <th className="px-3 py-2"><SortBtn k="date" sort={sort} setSort={setSort}>Inscription</SortBtn></th>
                <th className="px-5 py-2 text-right font-semibold uppercase">Gagnant</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={`border-b border-line last:border-0 dark:border-zinc-800 ${r.is_winner ? "bg-brand-50 dark:bg-yellow-900/20" : ""}`}>
                  <td className="px-5 py-2.5 font-medium text-ink dark:text-zinc-100">{r.participant_name}</td>
                  <td className="px-3 py-2.5 text-ink dark:text-zinc-200">
                    <a href={`mailto:${r.email}`} className="hover:underline">{r.email}</a>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-ink dark:text-zinc-200">
                    <a href={`tel:${r.phone_number}`} className="hover:underline">{formatFrPhone(r.phone_number)}</a>
                  </td>
                  <td className="px-3 py-2.5 text-muted dark:text-zinc-400">
                    {(r.selected_decoration_id && decoName.get(r.selected_decoration_id)) || "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-muted dark:text-zinc-400">{fmtDate(r.completed_at)}</td>
                  <td className="px-5 py-2.5 text-right">
                    <Button
                      variant={r.is_winner ? "primary" : "secondary"}
                      disabled={!canWrite || busy === r.id}
                      onClick={() => toggleWinner(r)}
                      aria-pressed={r.is_winner}
                      title={canWrite ? undefined : "Lecture seule"}
                    >
                      <Trophy className="h-4 w-4" aria-hidden />
                      {r.is_winner ? "Gagnant" : "Marquer"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
