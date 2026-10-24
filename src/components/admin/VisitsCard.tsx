"use client";

import { Bot, ChevronDown, Globe, Monitor, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { withBase } from "@/lib/base-path";
import type { Visit } from "@/lib/schema";
import { rejectionLabel, VISIT_REJECTIONS, type VisitsSummary, type VisitTop } from "@/lib/visits";
import { VisitsChart } from "./Charts";
import { usePage } from "./paged";
import { Badge, Card, deviceLabel, Empty, fmtDate, inputClass, PageFooter } from "./ui";

const nf = (n: number) => n.toLocaleString("fr-FR");

function Stat({ label, value, tone = "" }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-lg border border-line p-3 dark:border-zinc-800">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted dark:text-zinc-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tone || "text-ink dark:text-zinc-100"}`}>{nf(value)}</p>
    </div>
  );
}

function Counts({ title, c }: { title: string; c: VisitsSummary["today"] }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-ink dark:text-zinc-100">{title}</h3>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Visites" value={c.visits} />
        <Stat label="Visiteurs uniques" value={c.unique} />
        <Stat label="Robots écartés" value={c.rejected} tone="text-amber-600 dark:text-amber-300" />
      </div>
    </div>
  );
}

function TopList({ title, entries, empty }: { title: string; entries: VisitTop[]; empty: string }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-ink dark:text-zinc-100">{title}</h3>
      {entries.length === 0 ? (
        <p className="text-sm text-muted dark:text-zinc-400">{empty}</p>
      ) : (
        <ol className="divide-y divide-line text-sm dark:divide-zinc-800">
          {entries.map((e) => (
            <li key={e.key} className="flex items-center justify-between gap-3 py-1.5">
              <span className="truncate text-ink dark:text-zinc-200">{e.key}</span>
              <span className="whitespace-nowrap tabular-nums text-muted dark:text-zinc-400">{nf(e.count)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** Onglet Journal : compteur de visites (KPI, appareils, provenances, navigateurs, courbe par jour, dernières visites, barrières anti-robots). */
export function VisitsCard({ tick }: { tick: number }) {
  const [summary, setSummary] = useState<VisitsSummary | null>(null);
  const [failed, setFailed] = useState(false);
  const [status, setStatus] = useState<"all" | "counted" | "rejected">("all");
  useEffect(() => {
    let cancelled = false;
    fetch(withBase("/api/admin/visits/summary"), { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("load"))))
      .then((s) => !cancelled && (setSummary(s), setFailed(false)))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [tick]);
  const page = usePage<Visit>("/api/admin/visits", { status }, tick);
  const devicesTotal = summary ? summary.devices.mobile + summary.devices.desktop : 0;
  const pct = (n: number) => (devicesTotal ? `${Math.round((n / devicesTotal) * 100)} %` : "—");

  return (
    <Card title="Visites">
      <p className="mb-4 text-sm text-muted dark:text-zinc-400">
        Combien de personnes arrivent sur le site, chaque jour et depuis le début, robots écartés. C&apos;est une <strong className="text-ink dark:text-zinc-200">estimation</strong>&nbsp;:
        une visite = un beacon par onglet et par session de navigation (une seule par jour et par page, les rechargements ne comptent pas)&nbsp;; un
        visiteur unique = une empreinte d&apos;appareil distincte dans la journée (deux téléphones identiques peuvent se confondre, un même téléphone sur deux
        navigateurs compte deux fois).
      </p>
      {failed && (
        <p role="alert" className="mb-3 text-sm font-medium text-red-600 dark:text-red-400">
          Chargement impossible, réessayez.
        </p>
      )}
      {!summary ? (
        <Empty>Chargement…</Empty>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid gap-5 lg:grid-cols-2">
            <Counts title="Aujourd'hui (heure de Paris)" c={summary.today} />
            <Counts title="Depuis le début" c={summary.total} />
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-ink dark:text-zinc-100">Appareils (visites comptées)</h3>
              <ul className="space-y-1.5 text-sm text-ink dark:text-zinc-200">
                <li className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5">
                    <Smartphone className="h-4 w-4 text-muted" aria-hidden /> Téléphone
                  </span>
                  <span className="tabular-nums text-muted dark:text-zinc-400">
                    {nf(summary.devices.mobile)} · {pct(summary.devices.mobile)}
                  </span>
                </li>
                <li className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5">
                    <Monitor className="h-4 w-4 text-muted" aria-hidden /> Ordinateur
                  </span>
                  <span className="tabular-nums text-muted dark:text-zinc-400">
                    {nf(summary.devices.desktop)} · {pct(summary.devices.desktop)}
                  </span>
                </li>
              </ul>
            </div>
            <TopList title="Top 5 des provenances" entries={summary.referrers} empty="Accès directs seulement (QR code, lien tapé)." />
            <TopList title="Top 5 des navigateurs" entries={summary.browsers} empty="—" />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink dark:text-zinc-100">Par jour</h3>
            <VisitsChart data={summary.daily} />
          </div>
        </div>
      )}

      <details className="group mt-6 rounded-xl border border-line p-4 dark:border-zinc-800">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-ink dark:text-zinc-100">
          <span className="inline-flex items-center gap-2">
            <Bot className="h-4 w-4 text-muted" aria-hidden /> Comment les robots sont écartés
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <p className="mt-3 text-sm text-muted dark:text-zinc-400">
          Aucune méthode n&apos;est imparable&nbsp;: plusieurs barrières indépendantes se combinent, et chaque rejet est enregistré avec sa raison (sans
          autre donnée que l&apos;adresse IP et le navigateur).
        </p>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-muted dark:text-zinc-400">
          {Object.values(VISIT_REJECTIONS).map((r) => (
            <li key={r.label}>
              <strong className="text-ink dark:text-zinc-100">{r.label}.</strong> {r.why}
            </li>
          ))}
          <li>
            <strong className="text-ink dark:text-zinc-100">Débit.</strong> Au-delà de 30 beacons par minute depuis une même adresse, les suivants sont ignorés
            sans être enregistrés&nbsp;: une adresse ne peut pas remplir le compteur.
          </li>
          <li>
            <strong className="text-ink dark:text-zinc-100">Dédoublonnage.</strong> Un même appareil (empreinte, sinon cookie de vote) ne compte qu&apos;une
            visite par jour et par page&nbsp;: recharger la page ou revenir dans la journée n&apos;augmente pas le compteur.
          </li>
        </ol>
      </details>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-ink dark:text-zinc-100">Dernières visites ({nf(page.total)})</h3>
        <label className="flex items-center gap-2 text-xs font-semibold text-muted dark:text-zinc-400">
          Afficher
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={inputClass} aria-label="Statut des visites">
            <option value="all">Toutes</option>
            <option value="counted">Comptées</option>
            <option value="rejected">Rejetées</option>
          </select>
        </label>
      </div>
      {page.failed && (
        <p role="alert" className="mt-3 text-sm font-medium text-red-600 dark:text-red-400">
          Chargement impossible, réessayez.
        </p>
      )}
      {page.rows.length === 0 ? (
        <Empty>{page.loading ? "Chargement…" : "Aucune visite."}</Empty>
      ) : (
        <>
          <div className="-mx-5 mt-3 overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs font-semibold uppercase text-muted dark:border-zinc-800 dark:text-zinc-400">
                  <th className="px-5 py-2">Date</th>
                  <th className="px-3 py-2">IP</th>
                  <th className="px-3 py-2">Appareil</th>
                  <th className="px-3 py-2">Page</th>
                  <th className="px-3 py-2">Provenance</th>
                  <th className="px-5 py-2">Statut</th>
                </tr>
              </thead>
              <tbody>
                {page.rows.map((v) => (
                  <tr key={v.id} className="border-b border-line align-top last:border-0 dark:border-zinc-800">
                    <td className="whitespace-nowrap px-5 py-2.5 text-muted dark:text-zinc-400">{fmtDate(v.created_at)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-ink dark:text-zinc-200">{v.ip ?? "—"}</td>
                    <td className="px-3 py-2.5 text-xs text-muted dark:text-zinc-400" title={v.user_agent ?? undefined}>
                      {v.device_info ? deviceLabel(v.device_info) : (v.user_agent?.slice(0, 60) ?? "—")}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-ink dark:text-zinc-200">{v.path ?? "—"}</td>
                    <td className="px-3 py-2.5 text-xs text-ink dark:text-zinc-200">
                      {v.referrer ? (
                        <span className="inline-flex items-center gap-1">
                          <Globe className="h-3.5 w-3.5 text-muted" aria-hidden /> {v.referrer}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-5 py-2.5">
                      {v.rejected ? <Badge tone="warn" title={VISIT_REJECTIONS[v.rejected as keyof typeof VISIT_REJECTIONS]?.why}>Rejetée · {rejectionLabel(v.rejected)}</Badge> : <Badge tone="ok">Comptée</Badge>}
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
