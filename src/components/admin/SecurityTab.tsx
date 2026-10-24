"use client";

import { Ban, RotateCcw, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { flagLabel, type RiskSettings, type SecuritySummary, type TopEntry } from "@/lib/risk";
import { shortName, type Decoration, type ResponseRow } from "@/lib/schema";
import { usePage } from "./paged";
import { RiskMethodology } from "./RiskMethodology";
import { Button, Card, ConfirmDialog, deviceLabel, Empty, fmtDate, inputClass, PageFooter, RiskBadge, StatusBadge } from "./ui";
import { withBase } from "@/lib/base-path";

function Stat({ label, value, tone = "" }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-lg border border-line p-3 dark:border-zinc-800">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted dark:text-zinc-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${tone || "text-ink dark:text-zinc-100"}`}>{value.toLocaleString("fr-FR")}</p>
    </div>
  );
}

function Counts({ title, c }: { title: string; c: SecuritySummary["today"] }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-ink dark:text-zinc-100">{title}</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Validés" value={c.validated} />
        <Stat label="Signalés" value={c.flagged} tone="text-amber-600 dark:text-amber-300" />
        <Stat label="Bloqués" value={c.blocked} tone="text-red-600 dark:text-red-300" />
        <Stat label="Exclus" value={c.excluded} />
      </div>
    </div>
  );
}

/** Réglages du score : mode et seuils, modifiables par un compte en écriture seulement. */
function SettingsForm({ settings, canWrite, onSaved }: { settings: RiskSettings; canWrite: boolean; onSaved: () => void }) {
  const [form, setForm] = useState(settings);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(withBase("/api/admin/settings"), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const body = (await res.json().catch(() => ({}))) as { error?: string; details?: Record<string, string[]> };
      if (!res.ok) throw new Error(Object.values(body.details ?? {}).flat()[0] ?? body.error ?? "Enregistrement impossible");
      setMessage({ ok: true, text: "Réglages enregistrés." });
      onSaved();
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : "Erreur" });
    } finally {
      setBusy(false);
    }
  }

  const num = (key: "flag_threshold" | "block_threshold") => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: Number(e.target.value) });
  return (
    <form onSubmit={save} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-xs font-semibold text-muted dark:text-zinc-400">
        Mode
        <select value={form.mode} disabled={!canWrite} onChange={(e) => setForm({ ...form, mode: e.target.value as RiskSettings["mode"] })} className={inputClass}>
          <option value="block">Blocage (refus au-delà du seuil)</option>
          <option value="observe">Observation (tout est signalé, rien n&apos;est refusé)</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold text-muted dark:text-zinc-400">
        Seuil de signalement
        <input type="number" min={0} max={200} step={1} value={form.flag_threshold} disabled={!canWrite} onChange={num("flag_threshold")} className={`${inputClass} w-28`} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold text-muted dark:text-zinc-400">
        Seuil de blocage
        <input type="number" min={0} max={200} step={1} value={form.block_threshold} disabled={!canWrite} onChange={num("block_threshold")} className={`${inputClass} w-28`} />
      </label>
      {canWrite && (
        <Button type="submit" variant="primary" disabled={busy || form.flag_threshold >= form.block_threshold}>
          Enregistrer
        </Button>
      )}
      {message && (
        <p role={message.ok ? "status" : "alert"} className={`text-sm font-medium ${message.ok ? "text-success" : "text-red-600 dark:text-red-400"}`}>
          {message.text}
        </p>
      )}
    </form>
  );
}

function TopList({ title, entries, mono = true }: { title: string; entries: TopEntry[]; mono?: boolean }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-ink dark:text-zinc-100">{title}</h3>
      {entries.length === 0 ? (
        <p className="text-sm text-muted dark:text-zinc-400">—</p>
      ) : (
        <ol className="divide-y divide-line text-sm dark:divide-zinc-800">
          {entries.map((e) => (
            <li key={e.key} className="flex items-center justify-between gap-3 py-1.5">
              <span className={`${mono ? "font-mono text-xs" : ""} text-ink dark:text-zinc-200`}>{e.key}</span>
              <span className="whitespace-nowrap tabular-nums text-muted dark:text-zinc-400">
                {e.votes} vote{e.votes > 1 ? "s" : ""}
                {e.flagged > 0 && <span className="ml-1 text-amber-600 dark:text-amber-300">· {e.flagged} signalé{e.flagged > 1 ? "s" : ""}</span>}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** Onglet Sécurité : KPI anti-fraude, réglages du score, votes à examiner (paginés), regroupements du jour. */
export function SecurityTab({
  summary,
  decorations,
  canWrite,
  tick,
  onChanged,
}: {
  summary: SecuritySummary | null;
  decorations: Decoration[];
  canWrite: boolean;
  tick: number;
  onChanged: () => void;
}) {
  const [q, setQ] = useState("");
  const [needle, setNeedle] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setNeedle(q.trim()), 300);
    return () => clearTimeout(id);
  }, [q]);
  const decoName = useMemo(() => new Map(decorations.map((d) => [d.id, d.restaurant_name])), [decorations]);
  const page = usePage<ResponseRow>("/api/admin/responses", { status: "all", risk: "flagged", ...(needle ? { q: needle } : {}) }, tick);
  const [error, setError] = useState<string | null>(null);

  async function act(id: string, init: RequestInit) {
    setError(null);
    const res = await fetch(withBase(`/api/responses/${id}`), init);
    if (!res.ok) setError("Action impossible, réessayez.");
    onChanged();
  }
  const exclude = (id: string, excluded: boolean) =>
    act(id, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ excluded }) });

  return (
    <div className="flex flex-col gap-6">
      <Card title="Anti-fraude : revote le même jour">
        <p className="mb-4 text-sm text-muted dark:text-zinc-400">
          À chaque validation, un score additionne des signaux (même empreinte d&apos;appareil, navigateur, stockage local, cookie, adresse IP, rapidité, automate).
          Au-delà du seuil de signalement le vote est accepté mais listé ici&nbsp;; au-delà du seuil de blocage il est refusé (mode « Blocage ») avec le message
          « déjà voté ». Seul un condensé non réversible de l&apos;appareil est conservé. La méthode complète est expliquée plus bas.
        </p>
        {summary ? (
          <div className="flex flex-col gap-5">
            <Counts title="Aujourd'hui (heure de Paris)" c={summary.today} />
            <Counts title="Depuis le début" c={summary.total} />
            <div>
              <h3 className="mb-2 text-sm font-semibold text-ink dark:text-zinc-100">Réglages</h3>
              {/* `key` : le formulaire repart des réglages enregistrés à chaque actualisation. */}
              <SettingsForm key={JSON.stringify(summary.settings)} settings={summary.settings} canWrite={canWrite} onSaved={onChanged} />
            </div>
          </div>
        ) : (
          <Empty>Chargement…</Empty>
        )}
      </Card>

      {summary && <RiskMethodology settings={summary.settings} />}

      <Card
        title={`Votes à examiner (${page.total.toLocaleString("fr-FR")})`}
        actions={
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <input
              type="search"
              placeholder="Adresse IP ou début d'empreinte"
              aria-label="Filtrer par adresse IP ou empreinte"
              value={q}
              maxLength={64}
              onChange={(e) => setQ(e.target.value.replace(/[^0-9a-fA-F:.]/g, ""))}
              className={`${inputClass} w-64 pl-8`}
            />
          </div>
        }
      >
        {(error || page.failed) && (
          <p role="alert" className="mb-3 text-sm font-medium text-red-600 dark:text-red-400">
            {error ?? "Chargement impossible, réessayez."}
          </p>
        )}
        {page.rows.length === 0 ? (
          <Empty>{page.loading ? "Chargement…" : "Aucun vote signalé ni bloqué."}</Empty>
        ) : (
          <>
            <div className="-mx-5 overflow-x-auto">
              <table className="w-full min-w-[1180px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs font-semibold uppercase text-muted dark:border-zinc-800 dark:text-zinc-400">
                    <th className="px-5 py-2">Date</th>
                    <th className="px-3 py-2">Score</th>
                    <th className="px-3 py-2">Signaux</th>
                    <th className="px-3 py-2">IP</th>
                    <th className="px-3 py-2">Appareil</th>
                    <th className="px-3 py-2">Empreinte</th>
                    <th className="px-3 py-2">Q1 Préféré</th>
                    <th className="px-3 py-2">Q2 Vote</th>
                    <th className="px-3 py-2">Statut</th>
                    <th className="px-5 py-2 text-right">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {page.rows.map((r) => {
                    const labels = (r.risk_flags ?? []).map(flagLabel);
                    return (
                      <tr key={r.id} className="border-b border-line align-top last:border-0 dark:border-zinc-800">
                        <td className="whitespace-nowrap px-5 py-2.5 text-muted dark:text-zinc-400">{fmtDate(r.completed_at ?? r.blocked_at ?? r.created_at)}</td>
                        <td className="px-3 py-2.5">
                          <RiskBadge score={r.risk_score} flags={r.risk_flags} settings={summary?.settings ?? { mode: "block", flag_threshold: 40, block_threshold: 80 }} />
                        </td>
                        <td className="max-w-xs px-3 py-2.5 text-xs text-ink dark:text-zinc-200" title={labels.map((l) => `· ${l}`).join("\n") || undefined}>
                          <p className="line-clamp-3" title={labels.map((l) => `· ${l}`).join("\n") || undefined}>
                            {labels.join(" · ") || "—"}
                          </p>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-ink dark:text-zinc-200">{r.ip_address ?? "—"}</td>
                        <td className="px-3 py-2.5 text-xs text-muted dark:text-zinc-400">{deviceLabel(r.device_info)}</td>
                        <td className="px-3 py-2.5 font-mono text-xs text-muted dark:text-zinc-400" title="8 premiers caractères de l'empreinte (HMAC)">
                          {r.device_hash?.slice(0, 8) ?? "—"}
                        </td>
                        <td className="px-3 py-2.5 text-ink dark:text-zinc-100">{r.selected_restaurant ? shortName(r.selected_restaurant) : "—"}</td>
                        <td className="px-3 py-2.5 font-medium text-ink dark:text-zinc-100">
                          {r.selected_decoration_id ? shortName(decoName.get(r.selected_decoration_id) ?? "(supprimée)") : "—"}
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusBadge row={r} />
                        </td>
                        <td className="whitespace-nowrap px-5 py-2.5 text-right">
                          {canWrite && (
                            <span className="inline-flex items-center gap-1">
                              {r.completed_at &&
                                (r.excluded_at ? (
                                  <Button variant="secondary" className="!min-h-8" onClick={() => void exclude(r.id, false)}>
                                    <RotateCcw className="h-4 w-4" aria-hidden /> Réintégrer
                                  </Button>
                                ) : (
                                  <Button variant="secondary" className="!min-h-8" onClick={() => void exclude(r.id, true)}>
                                    <Ban className="h-4 w-4" aria-hidden /> Exclure du classement
                                  </Button>
                                ))}
                              <ConfirmDialog
                                title="Supprimer cette réponse ?"
                                description="Le vote et les informations de contact associées seront définitivement supprimés."
                                onConfirm={() => void act(r.id, { method: "DELETE" })}
                                trigger={
                                  <Button variant="ghost" className="!min-h-8 !px-1.5" aria-label="Supprimer la réponse">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                }
                              />
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <PageFooter shown={page.rows.length} total={page.total} more={!!page.nextCursor} loading={page.loading} onMore={() => void page.loadMore()} />
          </>
        )}
      </Card>

      {summary && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Aujourd'hui : top 10 des adresses IP">
            <TopList title="Votes validés par adresse IP" entries={summary.topIps} />
          </Card>
          <Card title="Aujourd'hui : top 10 des empreintes">
            <TopList title="Votes validés par empreinte d'appareil (8 premiers caractères)" entries={summary.topDevices} />
          </Card>
        </div>
      )}
    </div>
  );
}
