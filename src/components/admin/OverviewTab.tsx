"use client";

import Image from "next/image";
import { Check, ChevronDown, Download, FileSpreadsheet, Trophy } from "lucide-react";
import { Select } from "radix-ui";
import type { Summary } from "@/lib/analytics";
import { FavoriteBarChart, ImpactBars, TimelineChart } from "./Charts";
import { Card, DownloadLink, Empty, fmtPct, inputClass } from "./ui";
import { withBase } from "@/lib/base-path";

export type Filters = { from: string; to: string; restaurant: string };

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold text-muted dark:text-zinc-400">
      {label}
      <Select.Root value={value} onValueChange={onChange}>
        <Select.Trigger className={`${inputClass} inline-flex min-w-44 items-center justify-between gap-2`} aria-label={label}>
          <Select.Value />
          <Select.Icon>
            <ChevronDown className="h-4 w-4" />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content position="popper" sideOffset={4} className="z-50 max-h-80 overflow-hidden rounded-lg border border-line bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
            <Select.Viewport className="p-1">
              {options.map((o) => (
                <Select.Item
                  key={o.value}
                  value={o.value}
                  className="relative flex cursor-pointer select-none items-center rounded-md py-2 pl-7 pr-3 text-sm text-ink outline-none data-[highlighted]:bg-brand-100 dark:text-zinc-100 dark:data-[highlighted]:bg-zinc-700"
                >
                  <Select.ItemIndicator className="absolute left-2">
                    <Check className="h-4 w-4" />
                  </Select.ItemIndicator>
                  <Select.ItemText>{o.label}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </label>
  );
}

function Kpi({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted dark:text-zinc-400">{label}</p>
      <p className="mt-2 text-3xl font-bold text-ink dark:text-zinc-100">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted dark:text-zinc-400">{sub}</p>}
    </div>
  );
}

export function OverviewTab({
  summary,
  filters,
  setFilters,
  restaurants,
}: {
  summary: Summary | null;
  filters: Filters;
  setFilters: (f: Filters) => void;
  restaurants: string[];
}) {
  const k = summary?.kpis;
  const top = summary?.byDecoration.filter((d) => d.votes > 0).slice(0, 3) ?? [];
  const max = Math.max(1, ...(summary?.byDecoration.map((d) => d.votes) ?? [1]));
  const nf = (n: number) => n.toLocaleString("fr-FR");

  return (
    <div className="flex flex-col gap-6">
      {/* Filtres */}
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted dark:text-zinc-400">
          Du
          <input type="date" className={inputClass} value={filters.from} max={filters.to || undefined} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted dark:text-zinc-400">
          Au
          <input type="date" className={inputClass} value={filters.to} min={filters.from || undefined} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
        </label>
        <FilterSelect
          label="Chamas Tacos préféré (Q1)"
          value={filters.restaurant}
          onChange={(restaurant) => setFilters({ ...filters, restaurant })}
          options={[{ value: "all", label: "Tous les restaurants" }, ...restaurants.map((r) => ({ value: r, label: r }))]}
        />
        {(filters.from || filters.to || filters.restaurant !== "all") && (
          <button
            type="button"
            className="min-h-9 text-sm font-semibold text-muted underline underline-offset-2 hover:text-ink dark:text-zinc-400"
            onClick={() => setFilters({ from: "", to: "", restaurant: "all" })}
          >
            Réinitialiser
          </button>
        )}
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Total votes" value={k ? nf(k.totalVotes) : "—"} />
        <Kpi label="Taux de complétion" value={k ? `${Math.round(k.completionRate * 100)} %` : "—"} sub={k ? `${nf(k.started)} questionnaires commencés` : null} />
        <Kpi label="Participants tirage" value={k ? nf(k.raffleParticipants) : "—"} />
        <div className="col-span-2 rounded-xl border border-line bg-white p-4 shadow-sm lg:col-span-1 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted dark:text-zinc-400">Top 3</p>
          {top.length === 0 ? (
            <p className="mt-2 text-sm text-muted">—</p>
          ) : (
            <ol className="mt-2 flex flex-col gap-1 text-sm">
              {top.map((d, i) => (
                <li key={d.id} className="flex items-center justify-between gap-2 text-ink dark:text-zinc-100">
                  <span className="truncate">
                    {["🥇", "🥈", "🥉"][i]} {d.restaurant_name.replace(/^CHAMAS TACOS\s*-\s*/i, "")}
                  </span>
                  <span className="tabular-nums text-muted dark:text-zinc-400">{d.votes}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {/* Tableau des résultats */}
      <Card
        title={
          <span className="inline-flex items-center gap-2">
            <Trophy className="h-4 w-4" aria-hidden /> Résultats — meilleure décoration (Q3)
          </span>
        }
      >
        {!summary ? (
          <Empty>Chargement…</Empty>
        ) : summary.byDecoration.length === 0 ? (
          <Empty>Ajoutez des décorations dans l&apos;onglet « Décorations ».</Empty>
        ) : (
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted dark:border-zinc-800 dark:text-zinc-400">
                  <th className="px-5 py-2 font-semibold">Restaurant</th>
                  <th className="px-3 py-2 text-right font-semibold">Votes</th>
                  <th className="px-3 py-2 text-right font-semibold">% du total</th>
                  <th className="w-[35%] px-5 py-2 font-semibold">
                    <span className="sr-only">Graphique</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {summary.byDecoration.map((d, i) => (
                  <tr key={d.id} className="border-b border-line last:border-0 dark:border-zinc-800">
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-3">
                        <span className="w-4 text-xs font-bold text-muted">{i + 1}</span>
                        <div className="relative aspect-[3/4] w-10 shrink-0 overflow-hidden rounded bg-gray-100">
                          <Image src={d.image_url} alt="" fill sizes="40px" className="object-cover" />
                        </div>
                        <span className="font-medium text-ink dark:text-zinc-100">{d.restaurant_name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-ink dark:text-zinc-100">{d.votes}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted dark:text-zinc-400">{fmtPct(d.share)}</td>
                    <td className="px-5 py-2.5">
                      <div className="h-2.5 overflow-hidden rounded-full bg-[var(--viz-grid)]">
                        <div className="h-full rounded-full bg-[var(--viz-s1)] transition-[width] duration-500" style={{ width: `${(d.votes / max) * 100}%` }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Graphiques */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Chamas Tacos préféré des votants (Q1)">{summary ? <FavoriteBarChart data={summary.byFavorite} /> : <Empty>Chargement…</Empty>}</Card>
        <Card title="Votes dans le temps">{summary ? <TimelineChart data={summary.timeline} /> : <Empty>Chargement…</Empty>}</Card>
        <Card title="La décoration a-t-elle influencé l'expérience ? (Q4)">{summary ? <ImpactBars data={summary.impact} /> : <Empty>Chargement…</Empty>}</Card>
        <Card title="Export des données">
          <div className="flex flex-col gap-3">
            <DownloadLink
              href={withBase("/api/responses/export?scope=all&format=xlsx")}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-bold text-black transition-[filter] hover:brightness-95"
            >
              <FileSpreadsheet className="h-4 w-4" aria-hidden /> Télécharger Excel (toutes les réponses)
            </DownloadLink>
            <DownloadLink
              href={withBase("/api/responses/export?scope=raffle&format=csv")}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line px-4 text-sm font-bold text-ink transition-colors hover:bg-gray-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              <Download className="h-4 w-4" aria-hidden /> Télécharger CSV (participants tirage)
            </DownloadLink>
            <p className="text-xs text-muted dark:text-zinc-400">
              L&apos;export Excel contient les questions Q1 → Q6 et les métadonnées (IP, date, navigateur). Les filtres ne s&apos;appliquent pas aux exports.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
