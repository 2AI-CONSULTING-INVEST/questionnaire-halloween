"use client";

import type { ReactNode } from "react";
import type { Summary } from "@/lib/analytics";
import { parisDay } from "@/lib/day";
import { shortName } from "@/lib/schema";
import { ChartLegend, FavoriteBarChart, fmtDay, MultiLineChart, SERIES_MAX, seriesColor, SeriesBarChart } from "./Charts";
import { Card, Empty, fmtPct } from "./ui";

/*
 * Contenu des modales plein écran du tableau de bord (ChartDialog) : KPI en tête, puis tableaux
 * complets, puis graphiques secondaires. Tout est calculé à partir de `Summary` (aucune requête).
 */

const nf = (n: number) => n.toLocaleString("fr-FR");
const OTHER = "Autres";
const plot = "h-[55vh] min-h-[320px]";
const th = "px-3 py-2 text-right font-semibold";
const td = "px-3 py-2.5 text-right tabular-nums text-ink dark:text-zinc-100";

function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted dark:text-zinc-400">{label}</p>
      <p className="mt-2 text-3xl font-bold text-ink dark:text-zinc-100">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted dark:text-zinc-400">{sub}</p>}
    </div>
  );
}

function Kpis({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{children}</div>;
}

function Table({ min = 640, children }: { min?: number; children: ReactNode }) {
  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="w-full text-sm" style={{ minWidth: min }}>
        {children}
      </table>
    </div>
  );
}
const headRow = "border-b border-line text-left text-xs uppercase tracking-wide text-muted dark:border-zinc-800 dark:text-zinc-400";
const bodyRow = "border-b border-line last:border-0 odd:bg-gray-50/60 dark:border-zinc-800 dark:odd:bg-zinc-800/30";
const totalRow = "border-t-2 border-line font-semibold dark:border-zinc-700";

/** Séries (restaurants) dans un ordre fixe, au plus SERIES_MAX : au-delà, regroupées dans « Autres ». */
function foldSeries(names: string[]) {
  const kept = names.length > SERIES_MAX ? names.slice(0, SERIES_MAX - 1) : names;
  const label = new Map(kept.map((n) => [n, shortName(n)]));
  const series = [...kept.map((n, i) => ({ name: shortName(n), color: seriesColor(i) })), ...(names.length > SERIES_MAX ? [{ name: OTHER, color: seriesColor(SERIES_MAX - 1) }] : [])];
  return { series, of: (restaurant: string) => label.get(restaurant) ?? OTHER };
}

/** Lignes d'un graphique : une clé par série, sommée après regroupement. */
function seriesRows(items: { name: string; votes: Record<string, number> }[], fold: ReturnType<typeof foldSeries>) {
  return items.map((it) => {
    const row: Record<string, string | number> = { name: it.name, date: it.name };
    for (const s of fold.series) row[s.name] = 0;
    for (const [restaurant, n] of Object.entries(it.votes)) row[fold.of(restaurant)] = (row[fold.of(restaurant)] as number) + n;
    return row;
  });
}

/** Résultats Q2 : classement, KPI, tableau complet par restaurant, évolution par jour et par restaurant. */
export function DecorationDetails({ summary }: { summary: Summary }) {
  const today = parisDay();
  const total = summary.kpis.totalVotes;
  const [leader, second] = summary.byDecoration;
  const todayVotes = summary.byDecorationDaily.find((d) => d.date === today)?.votes ?? {};
  const todayTotal = Object.values(todayVotes).reduce((a, b) => a + b, 0);
  const raffle = summary.byDecoration.reduce((a, d) => a + d.raffle, 0);
  const bestDay = (name: string) => {
    let best: { date: string; votes: number } | null = null;
    for (const d of summary.byDecorationDaily) if ((d.votes[name] ?? 0) > (best?.votes ?? 0)) best = { date: d.date, votes: d.votes[name] };
    return best;
  };
  const fold = foldSeries(summary.byDecoration.map((d) => d.restaurant_name));
  const daily = seriesRows(
    summary.byDecorationDaily.map((d) => ({ name: fmtDay(d.date), votes: d.votes })),
    fold,
  );

  if (summary.byDecoration.length === 0) return <Empty>Ajoutez des décorations dans l&apos;onglet « Décorations ».</Empty>;
  return (
    <>
      <Kpis>
        <Stat label="Total des votes" value={nf(total)} />
        <Stat label="En tête" value={leader && leader.votes > 0 ? shortName(leader.restaurant_name) : "—"} sub={leader && second ? `${nf(leader.votes - second.votes)} vote${leader.votes - second.votes > 1 ? "s" : ""} d'avance sur ${shortName(second.restaurant_name)}` : "un seul restaurant"} />
        <Stat label="Votes aujourd'hui" value={nf(todayTotal)} sub="heure de Paris" />
        <Stat label="Votants inscrits au tirage" value={total ? fmtPct(raffle / total) : "—"} sub={`${nf(raffle)} sur ${nf(total)}`} />
      </Kpis>

      <Card title="Classement">
        <div className={plot}>
          <FavoriteBarChart data={summary.byDecoration.map((d) => ({ name: d.restaurant_name, votes: d.votes }))} tall />
        </div>
      </Card>

      <Card title="Détail par restaurant">
        <Table min={860}>
          <thead>
            <tr className={headRow}>
              <th className="px-5 py-2 font-semibold">Restaurant</th>
              <th className={th}>Votes</th>
              <th className={th}>% du total</th>
              <th className={th}>Aujourd&apos;hui</th>
              <th className="px-3 py-2 font-semibold">Meilleur jour</th>
              <th className={th}>Commentaires</th>
              <th className={th}>Inscrits au tirage</th>
            </tr>
          </thead>
          <tbody>
            {summary.byDecoration.map((d, i) => {
              const best = bestDay(d.restaurant_name);
              return (
                <tr key={d.id} className={bodyRow}>
                  <td className="px-5 py-2.5 font-medium text-ink dark:text-zinc-100">
                    <span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: fold.series.find((s) => s.name === fold.of(d.restaurant_name))?.color }} aria-hidden />
                    {i + 1}. {d.restaurant_name}
                  </td>
                  <td className={`${td} font-semibold`}>{nf(d.votes)}</td>
                  <td className={td}>{fmtPct(d.share)}</td>
                  <td className={td}>{nf(todayVotes[d.restaurant_name] ?? 0)}</td>
                  <td className="px-3 py-2.5 text-ink dark:text-zinc-100">{best ? `${fmtDay(best.date)} (${nf(best.votes)})` : "—"}</td>
                  <td className={td}>{nf(d.comments)}</td>
                  <td className={td}>{nf(d.raffle)}</td>
                </tr>
              );
            })}
            <tr className={totalRow}>
              <td className="px-5 py-2.5 text-ink dark:text-zinc-100">Total</td>
              <td className={td}>{nf(total)}</td>
              <td className={td}>{total ? "100 %" : "—"}</td>
              <td className={td}>{nf(todayTotal)}</td>
              <td />
              <td className={td}>{nf(summary.byDecoration.reduce((a, d) => a + d.comments, 0))}</td>
              <td className={td}>{nf(raffle)}</td>
            </tr>
          </tbody>
        </Table>
      </Card>

      <Card title="Évolution par jour et par restaurant">
        <div className="h-80">
          <MultiLineChart rows={daily} series={fold.series} />
        </div>
        <ChartLegend series={fold.series} />
      </Card>
    </>
  );
}

/** Q1 préféré : KPI, tableau croisé préféré × voté avec totaux, répartition empilée. */
export function FavoriteDetails({ summary }: { summary: Summary }) {
  const voted = summary.byDecoration.map((d) => d.restaurant_name);
  const fold = foldSeries(voted);
  const rows = summary.favoriteVsVote;
  const total = rows.reduce((a, r) => a + Object.values(r.votes).reduce((x, y) => x + y, 0), 0);
  const loyal = rows.reduce((a, r) => a + (r.votes[r.favorite] ?? 0), 0);
  const colTotal = (name: string) => rows.reduce((a, r) => a + (r.votes[name] ?? 0), 0);
  const stacked = seriesRows(
    rows.map((r) => ({ name: shortName(r.favorite), votes: r.votes })),
    fold,
  );

  if (summary.byFavorite.length === 0) return <Empty>Aucun vote pour l&apos;instant</Empty>;
  return (
    <>
      <Kpis>
        <Stat label="Le plus souvent préféré" value={shortName(summary.byFavorite[0].name)} sub={`${nf(summary.byFavorite[0].votes)} votant${summary.byFavorite[0].votes > 1 ? "s" : ""}`} />
        <Stat label="Ont voté pour leur restaurant préféré" value={total ? fmtPct(loyal / total) : "—"} sub={`${nf(loyal)} sur ${nf(total)} votes avec Q1 et Q2 connus`} />
        <Stat label="Restaurants cités" value={nf(summary.byFavorite.length)} />
        <Stat label="Votes pris en compte" value={nf(summary.kpis.totalVotes)} />
      </Kpis>

      <Card title="Chamas Tacos préféré des votants (Q1)">
        <div className={plot}>
          <FavoriteBarChart data={summary.byFavorite} tall />
        </div>
      </Card>

      <Card title="Tableau croisé : restaurant préféré (lignes) × décoration votée (colonnes)">
        <Table min={640}>
          <thead>
            <tr className={headRow}>
              <th className="px-5 py-2 font-semibold">Préféré ↓ · Voté →</th>
              {voted.map((v) => (
                <th key={v} className={th}>
                  {shortName(v)}
                </th>
              ))}
              <th className={th}>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const sum = Object.values(r.votes).reduce((a, b) => a + b, 0);
              return (
                <tr key={r.favorite} className={bodyRow}>
                  <td className="px-5 py-2.5 font-medium text-ink dark:text-zinc-100">{shortName(r.favorite)}</td>
                  {voted.map((v) => (
                    <td key={v} className={`${td} ${v === r.favorite ? "font-semibold" : ""}`}>
                      {nf(r.votes[v] ?? 0)}
                    </td>
                  ))}
                  <td className={`${td} font-semibold`}>{nf(sum)}</td>
                </tr>
              );
            })}
            <tr className={totalRow}>
              <td className="px-5 py-2.5 text-ink dark:text-zinc-100">Total</td>
              {voted.map((v) => (
                <td key={v} className={td}>
                  {nf(colTotal(v))}
                </td>
              ))}
              <td className={td}>{nf(total)}</td>
            </tr>
          </tbody>
        </Table>
        <p className="mt-2 text-xs text-muted dark:text-zinc-400">En gras&nbsp;: les votants qui ont voté pour la décoration de leur restaurant préféré.</p>
      </Card>

      <Card title="Répartition des votes par restaurant préféré">
        <div className="h-80">
          <SeriesBarChart rows={stacked} series={fold.series} stacked vertical />
        </div>
        <ChartLegend series={fold.series} />
      </Card>
    </>
  );
}

/** Votes dans le temps : KPI, par jour (démarrés, validés), cumul, par heure (Paris), tableau par jour. */
export function TimelineDetails({ summary }: { summary: Summary }) {
  const today = parisDay();
  const days = summary.dailyTable;
  const best = summary.timeline.reduce<{ date: string; votes: number } | null>((b, d) => (d.votes > (b?.votes ?? 0) ? d : b), null);
  const activeDays = summary.timeline.filter((d) => d.votes > 0).length;
  const todayVotes = summary.timeline.find((d) => d.date === today)?.votes ?? 0;
  const peak = summary.byHour.reduce<{ hour: number; votes: number } | null>((b, h) => (h.votes > (b?.votes ?? 0) ? h : b), null);
  const dailySeries = [
    { name: "Démarrés", color: "var(--viz-s1)" },
    { name: "Validés", color: "var(--viz-s2)" },
  ];
  const dailyRows = days.map((d) => ({ name: fmtDay(d.date), Démarrés: d.started, Validés: d.completed }));
  const cumulRows = summary.timeline.map((d, i, all) => ({ date: fmtDay(d.date), "Cumul des votes": all.slice(0, i + 1).reduce((a, x) => a + x.votes, 0) }));
  const hourRows = summary.byHour.map((h) => ({ name: `${String(h.hour).padStart(2, "0")} h`, Votes: h.votes }));

  if (summary.timeline.length === 0) return <Empty>Aucun vote pour l&apos;instant</Empty>;
  return (
    <>
      <Kpis>
        <Stat label="Meilleur jour" value={best ? fmtDay(best.date) : "—"} sub={best ? `${nf(best.votes)} votes validés` : undefined} />
        <Stat label="Moyenne par jour" value={activeDays ? nf(Math.round(summary.kpis.totalVotes / activeDays)) : "—"} sub={`sur ${nf(activeDays)} jour${activeDays > 1 ? "s" : ""} avec au moins un vote`} />
        <Stat label="Votes aujourd'hui" value={nf(todayVotes)} sub="heure de Paris" />
        <Stat label="Heure de pointe" value={peak ? `${String(peak.hour).padStart(2, "0")} h` : "—"} sub={peak ? `${nf(peak.votes)} votes à cette heure (Paris)` : undefined} />
      </Kpis>

      <Card title="Par jour : questionnaires démarrés et votes validés">
        <div className={plot}>
          <SeriesBarChart rows={dailyRows} series={dailySeries} />
        </div>
        <ChartLegend series={dailySeries} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Votes validés, en cumul">
          <div className="h-72">
            <MultiLineChart rows={cumulRows} series={[{ name: "Cumul des votes", color: "var(--viz-s1)" }]} />
          </div>
        </Card>
        <Card title="Par heure de la journée (heure de Paris)">
          <div className="h-72">
            <SeriesBarChart rows={hourRows} series={[{ name: "Votes", color: "var(--viz-s1)" }]} />
          </div>
        </Card>
      </div>

      <Card title="Détail par jour">
        <Table min={720}>
          <thead>
            <tr className={headRow}>
              <th className="px-5 py-2 font-semibold">Jour</th>
              <th className={th}>Démarrés</th>
              <th className={th}>Validés</th>
              <th className={th}>Taux de complétion</th>
              <th className={th}>Inscrits au tirage</th>
              <th className={th}>Bloqués</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.date} className={bodyRow}>
                <td className="px-5 py-2.5 font-medium text-ink dark:text-zinc-100">{fmtDay(d.date)}</td>
                <td className={td}>{nf(d.started)}</td>
                <td className={`${td} font-semibold`}>{nf(d.completed)}</td>
                <td className={td}>{d.started ? fmtPct(d.completed / d.started) : "—"}</td>
                <td className={td}>{nf(d.raffle)}</td>
                <td className={td}>{nf(d.blocked)}</td>
              </tr>
            ))}
            <tr className={totalRow}>
              <td className="px-5 py-2.5 text-ink dark:text-zinc-100">Total</td>
              <td className={td}>{nf(summary.kpis.started)}</td>
              <td className={td}>{nf(summary.kpis.totalVotes)}</td>
              <td className={td}>{fmtPct(summary.kpis.completionRate)}</td>
              <td className={td}>{nf(days.reduce((a, d) => a + d.raffle, 0))}</td>
              <td className={td}>{nf(summary.kpis.blocked)}</td>
            </tr>
          </tbody>
        </Table>
      </Card>
    </>
  );
}
