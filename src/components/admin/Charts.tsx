"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Summary } from "@/lib/analytics";
import { LABELS } from "@/lib/schema";
import { Empty } from "./ui";

/*
 * Couleurs des graphiques : rôles CSS (.viz-root dans AdminDashboard) pour
 * que le mode sombre utilise ses propres teintes validées.
 * série 1 = clients (bleu), série 2 = employés (orange).
 */
const axis = { stroke: "var(--viz-axis)", fontSize: 12, tickLine: false } as const;
const tick = { fill: "var(--viz-muted)", fontSize: 12 };

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name?: string; value?: number; color?: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
      <p className="mb-1 font-semibold text-ink dark:text-zinc-100">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-muted dark:text-zinc-300">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />
          {p.name} : <strong className="tabular-nums text-ink dark:text-zinc-100">{p.value}</strong>
        </p>
      ))}
    </div>
  );
}

const shortName = (n: string) => n.replace(/^CHAMAS TACOS\s*-\s*/i, "");

export function VoterBarChart({ data }: { data: Summary["byDecoration"] }) {
  if (data.every((d) => d.votes === 0)) return <Empty>Aucun vote pour l&apos;instant</Empty>;
  const rows = data.map((d) => ({ name: shortName(d.restaurant_name), Clients: d.client, Employés: d.employee }));
  return (
    <ResponsiveContainer width="100%" height={Math.max(220, rows.length * 52)}>
      <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 16 }} barGap={2} barCategoryGap="28%">
        <CartesianGrid horizontal={false} stroke="var(--viz-grid)" />
        <XAxis type="number" allowDecimals={false} {...axis} tick={tick} />
        <YAxis type="category" dataKey="name" width={130} {...axis} tick={tick} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--viz-hover)" }} />
        <Legend iconType="square" wrapperStyle={{ fontSize: 12, color: "var(--viz-muted)" }} />
        <Bar dataKey="Clients" stackId="v" fill="var(--viz-s1)" stroke="var(--viz-surface)" strokeWidth={2} />
        <Bar dataKey="Employés" stackId="v" fill="var(--viz-s2)" stroke="var(--viz-surface)" strokeWidth={2} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TimelineChart({ data }: { data: Summary["timeline"] }) {
  if (data.length === 0) return <Empty>Aucun vote pour l&apos;instant</Empty>;
  const rows = data.map((d) => ({
    date: new Date(`${d.date}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
    Votes: d.votes,
  }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={rows} margin={{ left: -16, right: 16, top: 8 }}>
        <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
        <XAxis dataKey="date" {...axis} tick={tick} />
        <YAxis allowDecimals={false} {...axis} tick={tick} />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--viz-axis)" }} />
        <Line
          type="monotone"
          dataKey="Votes"
          stroke="var(--viz-s1)"
          strokeWidth={2}
          dot={rows.length < 20 ? { r: 4, fill: "var(--viz-s1)", stroke: "var(--viz-surface)", strokeWidth: 2 } : false}
          activeDot={{ r: 5, stroke: "var(--viz-surface)", strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Impact de la décoration : barres de proportion (remplace la jauge, plus lisible). */
export function ImpactBars({ data }: { data: Summary["impact"] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) return <Empty>Aucune réponse pour l&apos;instant</Empty>;
  const emoji = { beaucoup: "🔥", un_peu: "👍", pas_du_tout: "😐" } as const;
  return (
    <ul className="flex flex-col gap-4">
      {data.map((d) => {
        const share = d.count / total;
        return (
          <li key={d.key} title={`${LABELS.decoration_impact[d.key]} : ${d.count}`}>
            <div className="mb-1.5 flex justify-between text-sm">
              <span className="text-ink dark:text-zinc-100">
                {emoji[d.key]} {LABELS.decoration_impact[d.key]}
              </span>
              <span className="tabular-nums text-muted dark:text-zinc-400">
                {Math.round(share * 100)} % · {d.count}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-[var(--viz-grid)]">
              <div className="h-full rounded-full bg-[var(--viz-s1)] transition-[width] duration-500" style={{ width: `${share * 100}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
