"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Summary } from "@/lib/analytics";
import { shortName } from "@/lib/schema";
import type { VisitsSummary } from "@/lib/visits";
import { Empty } from "./ui";

/*
 * Couleurs des graphiques : rôles CSS (.viz-root dans AdminDashboard) pour
 * que le mode sombre utilise ses propres teintes validées. Six teintes
 * catégorielles, attribuées dans un ordre fixe (jamais recyclées) : au-delà,
 * les séries sont regroupées dans « Autres » par l'appelant.
 */
const axis = { stroke: "var(--viz-axis)", fontSize: 12, tickLine: false } as const;
const tick = { fill: "var(--viz-muted)", fontSize: 12 };
export const SERIES_MAX = 6;
export const seriesColor = (i: number) => `var(--viz-s${Math.min(i, SERIES_MAX - 1) + 1})`;
/** Trait en couleur de surface : l'écart de 2 px entre segments empilés et marques superposées. */
const gap = { stroke: "var(--viz-surface)", strokeWidth: 2 } as const;
const dot = (color: string) => ({ r: 4, fill: color, ...gap });

export const fmtDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
const nf = (n: number) => n.toLocaleString("fr-FR");

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name?: string; value?: number; color?: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
      <p className="mb-1 font-semibold text-ink dark:text-zinc-100">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-muted dark:text-zinc-300">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />
          {p.name} : <strong className="tabular-nums text-ink dark:text-zinc-100">{nf(p.value ?? 0)}</strong>
        </p>
      ))}
    </div>
  );
}

/** Légende HTML (texte en encre, pastille en couleur de série) : toujours présente dès deux séries. */
export function ChartLegend({ series }: { series: { name: string; color: string }[] }) {
  if (series.length < 2) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted dark:text-zinc-400" aria-label="Légende">
      {series.map((s) => (
        <li key={s.name} className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} aria-hidden />
          {s.name}
        </li>
      ))}
    </ul>
  );
}

/** Q1 : Chamas Tacos préféré des votants (une seule série → une seule couleur). */
export function FavoriteBarChart({ data, tall = false }: { data: Summary["byFavorite"]; tall?: boolean }) {
  if (data.length === 0) return <Empty>Aucun vote pour l&apos;instant</Empty>;
  const rows = data.map((d) => ({ name: shortName(d.name), Votes: d.votes }));
  return (
    <ResponsiveContainer width="100%" height={tall ? "100%" : Math.max(220, rows.length * 44)}>
      <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 16 }} barCategoryGap="28%" maxBarSize={24}>
        <CartesianGrid horizontal={false} stroke="var(--viz-grid)" />
        <XAxis type="number" allowDecimals={false} {...axis} tick={tick} />
        <YAxis type="category" dataKey="name" width={130} {...axis} tick={tick} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--viz-hover)" }} />
        <Bar dataKey="Votes" fill="var(--viz-s1)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TimelineChart({ data, tall = false }: { data: Summary["timeline"]; tall?: boolean }) {
  if (data.length === 0) return <Empty>Aucun vote pour l&apos;instant</Empty>;
  const rows = data.map((d) => ({ date: fmtDay(d.date), Votes: d.votes }));
  return (
    <ResponsiveContainer width="100%" height={tall ? "100%" : 240}>
      <LineChart data={rows} margin={{ left: -16, right: 16, top: 8 }}>
        <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
        <XAxis dataKey="date" {...axis} tick={tick} />
        <YAxis allowDecimals={false} {...axis} tick={tick} />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--viz-axis)" }} />
        <Line type="monotone" dataKey="Votes" stroke="var(--viz-s1)" strokeWidth={2} dot={rows.length < 20 ? dot("var(--viz-s1)") : false} activeDot={{ r: 5, ...gap }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Une ligne par série (restaurant), une couleur fixe par série dans l'ordre donné. */
export function MultiLineChart({ rows, series }: { rows: Record<string, string | number>[]; series: { name: string; color: string }[] }) {
  if (rows.length === 0) return <Empty>Aucun vote pour l&apos;instant</Empty>;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={rows} margin={{ left: -16, right: 16, top: 8 }}>
        <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
        <XAxis dataKey="date" {...axis} tick={tick} />
        <YAxis allowDecimals={false} {...axis} tick={tick} />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--viz-axis)" }} />
        {series.map((s) => (
          <Line key={s.name} type="monotone" dataKey={s.name} stroke={s.color} strokeWidth={2} dot={rows.length < 20 ? dot(s.color) : false} activeDot={{ r: 5, ...gap }} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Barres (empilées si `stacked`) : une couleur fixe par série, écart de surface entre segments. */
export function SeriesBarChart({ rows, series, stacked = false, vertical = false }: { rows: Record<string, string | number>[]; series: { name: string; color: string }[]; stacked?: boolean; vertical?: boolean }) {
  if (rows.length === 0) return <Empty>Aucune donnée</Empty>;
  const cat = vertical ? <YAxis type="category" dataKey="name" width={130} {...axis} tick={tick} /> : <XAxis dataKey="name" {...axis} tick={tick} />;
  const num = vertical ? <XAxis type="number" allowDecimals={false} {...axis} tick={tick} /> : <YAxis allowDecimals={false} {...axis} tick={tick} />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} layout={vertical ? "vertical" : "horizontal"} margin={vertical ? { left: 8, right: 16 } : { left: -16, right: 16, top: 8 }} barCategoryGap="28%" barGap={2} maxBarSize={24}>
        <CartesianGrid horizontal={!vertical} vertical={vertical} stroke="var(--viz-grid)" />
        {cat}
        {num}
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--viz-hover)" }} />
        {series.map((s, i) => (
          <Bar key={s.name} dataKey={s.name} stackId={stacked ? "a" : undefined} fill={s.color} {...(stacked ? gap : {})} radius={!stacked || i === series.length - 1 ? (vertical ? [0, 4, 4, 0] : [4, 4, 0, 0]) : 0} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Journal : visites et visiteurs uniques par jour (deux lignes, couleurs fixes). */
export function VisitsChart({ data }: { data: VisitsSummary["daily"] }) {
  if (data.length === 0) return <Empty>Aucune visite pour l&apos;instant</Empty>;
  const rows = data.map((d) => ({ date: fmtDay(d.date), Visites: d.visits, "Visiteurs uniques": d.unique }));
  const series = [
    { name: "Visites", color: "var(--viz-s1)" },
    { name: "Visiteurs uniques", color: "var(--viz-s2)" },
  ];
  return (
    <div>
      <div className="h-56">
        <MultiLineChart rows={rows} series={series} />
      </div>
      <ChartLegend series={series} />
    </div>
  );
}
