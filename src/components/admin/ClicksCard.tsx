"use client";

import { useEffect, useState } from "react";
import { withBase } from "@/lib/base-path";
import { TARGET_LABELS, type ClicksSummary, type Person } from "@/lib/clicks";
import { Badge, Card, Empty } from "./ui";

const nf = (n: number) => n.toLocaleString("fr-FR");

/** Pseudo du tirage, sinon « Votant » et le début de son cookie (pour le distinguer des autres). */
function Who({ p }: { p: Person }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className="font-semibold text-ink dark:text-zinc-100">{p.pseudo ?? `Votant ${p.voter.slice(0, 8)}`}</span>
      {p.pseudo ? <Badge tone="ok">Tirage</Badge> : null}
      {p.voted ? <Badge tone="neutral">A voté</Badge> : <Badge tone="warn">Pas encore voté</Badge>}
    </span>
  );
}

/** Onglet Journal : clics des boutons de partage, arrivées par lien partagé, clics « S'abonner », et qui a ramené qui. */
export function ClicksCard({ tick }: { tick: number }) {
  const [summary, setSummary] = useState<ClicksSummary | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch(withBase("/api/admin/clicks/summary"), { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("load"))))
      .then((s) => !cancelled && (setSummary(s), setFailed(false)))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [tick]);

  return (
    <Card title="Partages et abonnements">
      <p className="mb-4 text-sm text-muted dark:text-zinc-400">
        Chaque lien partagé porte un code propre au partage&nbsp;: une personne qui arrive par ce lien est reliée au votant qui l&apos;a envoyé, puis à son
        vote et à son pseudo s&apos;il s&apos;inscrit au tirage. Robots écartés, 90 derniers jours, rien n&apos;est compté en mode démo.
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
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-ink dark:text-zinc-100">Boutons de partage</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs font-semibold text-muted dark:border-zinc-800 dark:text-zinc-400">
                    <th className="py-1.5">Réseau</th>
                    <th className="py-1.5 text-right">Clics</th>
                    <th className="py-1.5 text-right">Arrivées par le lien</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.shares.map((s) => (
                    <tr key={s.target} className="border-b border-line last:border-0 dark:border-zinc-800">
                      <td className="py-1.5 text-ink dark:text-zinc-200">{TARGET_LABELS[s.target]}</td>
                      <td className="py-1.5 text-right tabular-nums text-ink dark:text-zinc-200">{nf(s.clicks)}</td>
                      <td className="py-1.5 text-right tabular-nums text-ink dark:text-zinc-200">{nf(s.arrivals)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-ink dark:text-zinc-100">Boutons « S&apos;abonner »</h3>
              <ul className="divide-y divide-line text-sm dark:divide-zinc-800">
                {summary.follows.map((f) => (
                  <li key={f.target} className="flex items-center justify-between gap-3 py-1.5">
                    <span className="text-ink dark:text-zinc-200">{TARGET_LABELS[f.target]}</span>
                    <span className="tabular-nums text-ink dark:text-zinc-200">{nf(f.clicks)} clics</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted dark:text-zinc-400">Un clic ouvre la page du compte&nbsp;: l&apos;abonnement lui-même se fait chez Instagram ou TikTok.</p>
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink dark:text-zinc-100">Qui partage, et qui ses liens ont ramené</h3>
            {summary.sharers.length === 0 ? (
              <Empty>Aucun partage pour l&apos;instant.</Empty>
            ) : (
              <ol className="flex flex-col gap-3">
                {summary.sharers.map((s) => (
                  <li key={s.voter} className="rounded-lg border border-line p-3 text-sm dark:border-zinc-800">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Who p={s} />
                      <span className="text-xs text-muted dark:text-zinc-400">
                        {nf(s.shares)} partage{s.shares > 1 ? "s" : ""} ({s.targets.map((t) => TARGET_LABELS[t]).join(", ")}) :{" "}
                        <strong className="text-ink dark:text-zinc-100">
                          {nf(s.brought.length)} personne{s.brought.length > 1 ? "s" : ""} ramenée{s.brought.length > 1 ? "s" : ""}
                        </strong>
                      </span>
                    </div>
                    {s.brought.length > 0 && (
                      <ul className="mt-2 flex flex-col gap-1 border-l-2 border-line pl-3 dark:border-zinc-800">
                        {s.brought.map((b) => (
                          <li key={b.voter}>
                            <Who p={b} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ol>
            )}
            {(summary.anonymousShares > 0 || summary.unmatchedArrivals > 0) && (
              <p className="mt-3 text-xs text-muted dark:text-zinc-400">
                Non attribués&nbsp;: {nf(summary.anonymousShares)} partage{summary.anonymousShares > 1 ? "s" : ""} sans cookie de vote,{" "}
                {nf(summary.unmatchedArrivals)} arrivée{summary.unmatchedArrivals > 1 ? "s" : ""} dont le code ne correspond à aucun partage enregistré.
              </p>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
