"use client";

import { Check, ChevronDown, ChevronRight, Loader2, RotateCcw, ShieldAlert, Smartphone, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useCallback, useEffect, useId, useState } from "react";
import { withBase } from "@/lib/base-path";
import { deviceSignals } from "@/lib/fingerprint";
import type { AttemptView, FraudList, PendingList, PersonDetail } from "@/lib/fraud-review";
import { FRAUD_RULES, reasonLabel } from "@/lib/fraud-rules";
import { GROUP_CONDITIONS, LINK_KINDS, type GroupCondition, type LinkKind } from "@/lib/fraud-graph";
import { flagLabel } from "@/lib/risk";
import { shortName } from "@/lib/schema";
import { Badge, Button, Card, Empty, fmtDate, inputClass } from "./ui";

const nf = (v: number) => v.toLocaleString("fr-FR");

/** Lien « voir le groupe » (onglet Participants, notifications) : ouvre l'onglet Sécurité sur ce jour. Détail : AAAA-MM-JJ. */
export const SHOW_GROUP_EVENT = "hw:admin-show-group";
const IP_CLASS: Record<string, string> = { normal: "IP normale", tor: "Sortie Tor", hosting: "Hébergeur ou VPN", relay: "iCloud Private Relay", unknown: "IP inconnue" };
const STAGE: Record<string, string> = { create: "ouverture", complete: "validation" };
const time = (iso: string) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const gap = (a: string, b: string) => {
  const s = Math.round(Math.abs(Date.parse(b) - Date.parse(a)) / 1000);
  return s < 60 ? `${s} s` : s < 3600 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min`;
};

function device(v: AttemptView) {
  if (!v.device) return "Inconnu";
  const d = v.device;
  return [d.platform, d.model ? `${d.model}${d.osVersion ? ` Android ${d.osVersion}` : ""}` : null, d.browser, d.screen?.replace("x", "×")].filter(Boolean).join(", ");
}
const reasons = (v: AttemptView) => [...v.reasons.map(reasonLabel), ...v.flags.map(flagLabel)];
const place = (v: AttemptView) => [v.ipClass ? IP_CLASS[v.ipClass] ?? v.ipClass : null, v.country, v.city].filter(Boolean).join(", ") || "Inconnue";

// ---------------------------------------------------------------------------
// Double validation
// ---------------------------------------------------------------------------

type Pending = { ids: string[]; lines: string[]; title: string };

/**
 * Fenêtre de double validation : toute action qui fait compter un vote demande le mot de passe de
 * lecture seule, une seule fois pour une action groupée, après affichage de la liste des votes.
 */
function SecondPasswordDialog({ pending, onClose, onDone }: { pending: Pending | null; onClose: () => void; onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = useId();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(withBase("/api/admin/fraud/decide"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: pending.ids, action: "validate", password }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Action impossible");
      setPassword("");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action impossible");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog.Root open={pending !== null} onOpenChange={(o) => !o && !busy && (setPassword(""), setError(null), onClose())}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-5 shadow-xl dark:bg-zinc-900">
          <Dialog.Title className="text-lg font-bold text-ink dark:text-zinc-100">{pending?.title}</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted dark:text-zinc-400">
            Double validation : saisissez le mot de passe de lecture seule pour faire compter {pending && pending.ids.length > 1 ? `ces ${nf(pending.ids.length)} votes` : "ce vote"}.
          </Dialog.Description>
          <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-line p-2 text-xs text-ink dark:border-zinc-800 dark:text-zinc-200">
            {pending?.lines.map((l, i) => <li key={i}>{l}</li>)}
          </ul>
          <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
            <label htmlFor={id} className="text-xs font-semibold text-muted dark:text-zinc-400">
              Mot de passe de lecture seule
            </label>
            <input id={id} name="double-validation" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
            {error && (
              <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Dialog.Close asChild>
                <Button disabled={busy}>Annuler</Button>
              </Dialog.Close>
              <Button type="submit" variant="primary" disabled={busy || !password}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />} Faire compter
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Actions de décision : exclure tout de suite, faire compter après la double validation. */
function useDecisions(onChanged: () => void) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState<string | null>(null);
  const invalidate = useCallback(
    async (ids: string[]) => {
      setError(null);
      const res = await fetch(withBase("/api/admin/fraud/decide"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, action: "invalidate" }) });
      if (!res.ok) setError("Action impossible, réessayez.");
      onChanged();
    },
    [onChanged],
  );
  const validate = (views: AttemptView[], title: string) =>
    setPending({ ids: views.map((v) => v.id), title, lines: views.map((v) => `${fmtDate(v.at)}, ${v.decorationId ? shortName(v.restaurant ?? "") : "sans vote"}, ${reasons(v).join(", ") || "aucune règle"}`) });
  const dialog = <SecondPasswordDialog pending={pending} onClose={() => setPending(null)} onDone={() => (setPending(null), onChanged())} />;
  return { invalidate, validate, dialog, error };
}

// ---------------------------------------------------------------------------
// Listes
// ---------------------------------------------------------------------------

function useList<T extends FraudList | PendingList>(kind: T["kind"], tick: number) {
  const [data, setData] = useState<T | null>(null);
  const [limit, setLimit] = useState(20);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch(withBase(`/api/admin/fraud/review?kind=${kind}&limit=${limit}`), { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<T>) : Promise.reject(new Error("load"))))
      .then((d) => !cancelled && (setData(d), setFailed(false)))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [kind, limit, tick]);
  return { data, failed, more: () => setLimit((l) => l + 20) };
}

function AttemptLine({ v, prev, decoName, label }: { v: AttemptView; prev?: AttemptView; decoName: (id: string | null) => string; label?: string }) {
  return (
    <li className="grid gap-1 border-b border-line py-2 text-xs last:border-0 sm:grid-cols-[110px_90px_1fr_1fr] dark:border-zinc-800">
      <span className="font-semibold text-ink dark:text-zinc-100">
        {label && <span className="mr-1 text-success">{label}</span>}
        {time(v.at)}
      </span>
      <span className="text-muted dark:text-zinc-400">{prev ? `+${gap(prev.at, v.at)}` : ""}</span>
      <span className="text-ink dark:text-zinc-200">
        {v.status === "blocked" ? `Bloqué (${STAGE[v.stage ?? "complete"]})` : v.status === "excluded" ? (v.exclusionSource === "auto" ? "Exclu automatiquement" : "Exclu à la main") : v.status === "held" ? "En attente" : "Compté"}
        {reasons(v).length > 0 && <span className="text-muted dark:text-zinc-400"> : {reasons(v).join(", ")}</span>}
      </span>
      <span className="text-muted dark:text-zinc-400">
        {place(v)}, {decoName(v.decorationId)}
      </span>
    </li>
  );
}

/** « Votes frauduleux » : une ligne par personne et par jour, dépli des autres tentatives à la demande. */
export function FraudPersons({ tick, decoName, canWrite, onChanged, onShowDay }: { tick: number; decoName: (id: string | null) => string; canWrite: boolean; onChanged: () => void; onShowDay: (day: string) => void }) {
  const list = useList<FraudList>("fraud", tick);
  const [open, setOpen] = useState<Record<string, PersonDetail | "loading">>({});
  const decisions = useDecisions(onChanged);

  async function toggle(key: string) {
    const close = () => setOpen((o) => Object.fromEntries(Object.entries(o).filter(([k]) => k !== key)));
    if (open[key]) return close();
    setOpen((o) => ({ ...o, [key]: "loading" }));
    const res = await fetch(withBase(`/api/admin/fraud/person?key=${encodeURIComponent(key)}`), { cache: "no-store" });
    if (res.ok) {
      const detail = (await res.json()) as PersonDetail;
      setOpen((o) => ({ ...o, [key]: detail }));
    } else close();
  }

  return (
    <Card title={`Votes frauduleux (${nf(list.data?.total ?? 0)})`}>
      <p className="mb-3 text-sm text-muted dark:text-zinc-400">
        Les cas sûrs : bloqués (à l&apos;ouverture ou à la validation) ou exclus automatiquement. Une ligne par personne et par jour, son premier blocage d&apos;abord.
      </p>
      {decisions.dialog}
      {(list.failed || decisions.error) && (
        <p role="alert" className="mb-3 text-sm font-medium text-red-600 dark:text-red-400">
          {decisions.error ?? "Chargement impossible, réessayez."}
        </p>
      )}
      {!list.data ? (
        <Empty>Chargement…</Empty>
      ) : list.data.items.length === 0 ? (
        <Empty>Aucun vote frauduleux.</Empty>
      ) : (
        <ul className="flex flex-col gap-2">
          {list.data.items.map((p) => {
            const detail = open[p.key];
            const v = p.firstView;
            return (
              <li key={p.key} className="rounded-xl border border-line p-3 dark:border-zinc-800">
                <div className="flex flex-wrap items-start gap-3">
                  <button
                    type="button"
                    aria-expanded={!!detail}
                    aria-controls={`person-${p.key}`}
                    onClick={() => void toggle(p.key)}
                    className="mt-0.5 rounded-md p-1 text-muted hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand dark:hover:bg-zinc-800"
                    aria-label={detail ? "Replier les tentatives" : "Déplier les tentatives"}
                  >
                    {detail ? <ChevronDown className="h-4 w-4" aria-hidden /> : <ChevronRight className="h-4 w-4" aria-hidden />}
                  </button>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-semibold text-ink dark:text-zinc-100">
                      {fmtDate(v.at)} : {v.status === "blocked" ? `bloqué à l'${STAGE[v.stage ?? "complete"] === "ouverture" ? "ouverture" : "étape de validation"}` : "exclu automatiquement"}
                      {v.pseudo && <span className="ml-2 font-normal text-muted">participant {v.pseudo}</span>}
                    </p>
                    <p className="mt-0.5 text-xs text-ink dark:text-zinc-200">{reasons(v).join(", ") || "Aucune règle"}</p>
                    <p className="mt-0.5 text-xs text-muted dark:text-zinc-400">
                      {device(v)}
                      {v.hwPrefix && <span className="font-mono"> (clé {v.hwPrefix})</span>}, {place(v)}
                    </p>
                  </div>
                  <div className="text-right text-xs text-muted dark:text-zinc-400">
                    <Badge tone="danger">
                      {nf(p.count)} tentative{p.count > 1 ? "s" : ""}
                    </Badge>
                    <p className="mt-1">dernière à {time(new Date(p.lastAtMs).toISOString())}</p>
                    {p.recidivism.length > 0 && (
                      <p className="mt-1">
                        Récidive :{" "}
                        {p.recidivism.map((d) => (
                          <button key={d} type="button" onClick={() => onShowDay(d)} className="underline underline-offset-2 hover:text-ink">
                            {d}
                          </button>
                        ))}
                      </p>
                    )}
                  </div>
                </div>
                {detail && (
                  <div id={`person-${p.key}`} className="mt-2 border-t border-line pt-2 dark:border-zinc-800">
                    {detail === "loading" ? (
                      <p className="text-xs text-muted">Chargement…</p>
                    ) : (
                      <ul>
                        {detail.counted && <AttemptLine v={detail.counted} decoName={decoName} label="Vote compté :" />}
                        <AttemptLine v={v} decoName={decoName} label="1er blocage :" />
                        {detail.attempts.map((a, i) => (
                          <AttemptLine key={a.id} v={a} prev={i === 0 ? v : detail.attempts[i - 1]} decoName={decoName} />
                        ))}
                      </ul>
                    )}
                    {canWrite && detail !== "loading" && v.status !== "blocked" && (
                      <Button className="mt-2 !min-h-8" onClick={() => decisions.validate([v], "Réintégrer ce vote")}>
                        <RotateCcw className="h-4 w-4" aria-hidden /> Réintégrer
                      </Button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {list.data && list.data.items.length < list.data.total && (
        <div className="mt-3 flex justify-center">
          <Button onClick={list.more}>Afficher 20 personnes de plus</Button>
        </div>
      )}
    </Card>
  );
}

/** « Votes suspects en attente » : jamais comptés par défaut, priorité haute en tête, actions groupées. */
export function PendingVotes({ tick, decoName, canWrite, onChanged }: { tick: number; decoName: (id: string | null) => string; canWrite: boolean; onChanged: () => void }) {
  const list = useList<PendingList>("pending", tick);
  const decisions = useDecisions(onChanged);
  const [reason, setReason] = useState("");
  const items = list.data?.items ?? [];
  const reasonsInList = [...new Set(items.flatMap((v) => v.reasons))].filter((r) => r in FRAUD_RULES);

  return (
    <Card title={`Votes suspects en attente (${nf(list.data?.total ?? 0)})`}>
      <p className="mb-3 text-sm text-muted dark:text-zinc-400">
        Enregistrés, jamais comptés tant qu&apos;un admin ne les a pas validés (double validation). Invalider ne demande pas de mot de passe.
      </p>
      {decisions.dialog}
      {(list.failed || decisions.error) && (
        <p role="alert" className="mb-3 text-sm font-medium text-red-600 dark:text-red-400">
          {decisions.error ?? "Chargement impossible, réessayez."}
        </p>
      )}
      {canWrite && reasonsInList.length > 0 && (
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <label className="flex w-full min-w-0 max-w-full flex-col gap-1 text-xs font-semibold text-muted sm:w-auto dark:text-zinc-400">
            Tous les votes d&apos;une même raison
            <select value={reason} onChange={(e) => setReason(e.target.value)} className={`${inputClass} w-full min-w-0 max-w-full`}>
              <option value="">Choisir une raison…</option>
              {reasonsInList.map((r) => (
                <option key={r} value={r}>
                  {reasonLabel(r)}
                </option>
              ))}
            </select>
          </label>
          <Button disabled={!reason} onClick={() => decisions.validate(items.filter((v) => v.reasons.includes(reason)), `Valider les votes « ${reasonLabel(reason)} »`)}>
            <Check className="h-4 w-4" aria-hidden /> Valider
          </Button>
          <Button disabled={!reason} onClick={() => void decisions.invalidate(items.filter((v) => v.reasons.includes(reason)).map((v) => v.id))}>
            <X className="h-4 w-4" aria-hidden /> Invalider
          </Button>
        </div>
      )}
      {!list.data ? (
        <Empty>Chargement…</Empty>
      ) : items.length === 0 ? (
        <Empty>Aucun vote en attente.</Empty>
      ) : (
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs font-semibold text-muted dark:border-zinc-800 dark:text-zinc-400">
                {/* Actions en tête de ligne : atteignables sur téléphone sans faire défiler la table. */}
                <th className="px-5 py-2">
                  <span className="sr-only">Actions</span>
                </th>
                <th className="px-3 py-2">Heure</th>
                <th className="px-3 py-2">Raisons</th>
                <th className="px-3 py-2">Appareil</th>
                <th className="px-3 py-2">IP</th>
                <th className="px-5 py-2">Vote</th>
              </tr>
            </thead>
            <tbody>
              {items.map((v) => {
                const group = items.filter((x) => x.personKey === v.personKey);
                return (
                  <tr key={v.id} className="border-b border-line align-top last:border-0 dark:border-zinc-800">
                    <td className="px-5 py-2.5">
                      {canWrite && (
                        <span className="inline-flex w-44 flex-wrap gap-1">
                          <Button className="!min-h-8" onClick={() => decisions.validate([v], "Valider ce vote")}>
                            <Check className="h-4 w-4" aria-hidden /> Valider
                          </Button>
                          <Button className="!min-h-8" onClick={() => void decisions.invalidate([v.id])}>
                            <X className="h-4 w-4" aria-hidden /> Invalider
                          </Button>
                          {group.length > 1 && (
                            <>
                              <Button variant="ghost" className="!min-h-8" onClick={() => decisions.validate(group, "Valider tout le groupe")}>
                                Valider le groupe ({group.length})
                              </Button>
                              <Button variant="ghost" className="!min-h-8" onClick={() => void decisions.invalidate(group.map((x) => x.id))}>
                                Invalider le groupe ({group.length})
                              </Button>
                            </>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-muted dark:text-zinc-400">
                      {v.priority && (
                        <Badge tone="danger" title="Priorité haute">
                          <ShieldAlert className="h-3 w-3" aria-hidden /> Priorité
                        </Badge>
                      )}{" "}
                      {fmtDate(v.at)}
                    </td>
                    <td className="max-w-xs px-3 py-2.5 text-xs text-ink dark:text-zinc-200">{reasons(v).join(", ") || "Aucune règle"}</td>
                    <td className="px-3 py-2.5 text-xs text-muted dark:text-zinc-400">
                      {device(v)}
                      {v.hwPrefix && <span className="font-mono"> ({v.hwPrefix})</span>}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted dark:text-zinc-400">
                      {v.ip && <span className="font-mono">{v.ip}</span>} {place(v)}
                    </td>
                    <td className="px-5 py-2.5 text-ink dark:text-zinc-100">{decoName(v.decorationId)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {list.data && items.length < list.data.total && (
        <div className="mt-3 flex justify-center">
          <Button onClick={list.more}>Afficher 20 votes de plus</Button>
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Groupes et recalcul
// ---------------------------------------------------------------------------

type GroupView = { id: string; status: "confirmed" | "suspect"; conditions: GroupCondition[]; links: LinkKind[]; exclude: string[]; kept: string | null; ipCount: number; members: AttemptView[] };
type Preview = { day: string; confirmed: number; suspect: number; exclude: string[]; restore: string[]; ungroup: number; regroup: number; withdrawalsRefused: number };

/** Vue « Groupes » d'un jour, et Recalculer : aperçu sans écriture, puis application journalisée. */
export function GroupsView({ day, setDay, tick, decoName, canWrite, onChanged }: { day: string; setDay: (d: string) => void; tick: number; decoName: (id: string | null) => string; canWrite: boolean; onChanged: () => void }) {
  const [groups, setGroups] = useState<GroupView[] | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const decisions = useDecisions(onChanged);

  useEffect(() => {
    let cancelled = false;
    fetch(withBase(`/api/admin/fraud/groups?day=${day}`), { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<{ groups: GroupView[] }>) : Promise.reject(new Error("load"))))
      .then((d) => !cancelled && setGroups(d.groups))
      .catch(() => !cancelled && setGroups([]));
    return () => {
      cancelled = true;
    };
  }, [day, tick]);

  async function runPreview() {
    setBusy(true);
    setMessage(null);
    const res = await fetch(withBase(`/api/admin/fraud/recompute?day=${day}`), { cache: "no-store" });
    setPreview(res.ok ? ((await res.json()) as Preview) : null);
    setBusy(false);
  }
  async function apply() {
    setBusy(true);
    const res = await fetch(withBase("/api/admin/fraud/recompute"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ day }) });
    const body = (await res.json().catch(() => null)) as Preview | null;
    setMessage(res.ok && body ? `Appliqué : ${nf(body.exclude.length)} vote(s) exclu(s) automatiquement, ${nf(body.restore.length)} exclusion(s) levée(s), ${nf(body.ungroup)} ligne(s) retirée(s) d'un groupe.` : "Recalcul impossible, réessayez.");
    setPreview(null);
    setBusy(false);
    onChanged();
  }

  return (
    <Card
      title="Groupes"
      actions={
        <label className="flex items-center gap-2 text-xs font-semibold text-muted dark:text-zinc-400">
          Jour
          <input type="date" value={day} onChange={(e) => e.target.value && (setDay(e.target.value), setPreview(null))} className={inputClass} />
        </label>
      }
    >
      {decisions.dialog}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button onClick={() => void runPreview()} disabled={busy}>
          Recalculer : aperçu
        </Button>
        {preview && (
          <>
            <span className="text-sm text-ink dark:text-zinc-100">
              {nf(preview.confirmed)} groupe(s) confirmé(s), {nf(preview.suspect)} suspect(s) ; {nf(preview.exclude.length)} vote(s) seraient exclus, {nf(preview.restore.length)} exclusion(s) automatique(s) levée(s), {nf(preview.ungroup)} ligne(s) retirée(s) d&apos;un groupe.
              {preview.withdrawalsRefused > 0 && ` ${nf(preview.withdrawalsRefused)} retrait(s) refusé(s) : jour de plus de 30 jours, les valeurs de l'IP ont pu être purgées.`}
            </span>
            {canWrite && (
              <Button variant="primary" onClick={() => void apply()} disabled={busy}>
                Appliquer
              </Button>
            )}
          </>
        )}
        {message && (
          <span role="status" className="text-sm font-medium text-success">
            {message}
          </span>
        )}
      </div>
      {!groups ? (
        <Empty>Chargement…</Empty>
      ) : groups.length === 0 ? (
        <Empty>Aucun groupe ce jour-là.</Empty>
      ) : (
        <ul className="flex flex-col gap-3">
          {groups.map((g) => {
            const first = g.members[0];
            const last = g.members[g.members.length - 1];
            const excluded = g.members.filter((m) => m.status === "excluded");
            const counted = g.members.filter((m) => m.status === "counted" || m.status === "held");
            return (
              <li key={g.id} className="rounded-xl border border-line p-3 text-sm dark:border-zinc-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-ink dark:text-zinc-100">
                    <Badge tone={g.status === "confirmed" ? "danger" : "warn"}>{g.status === "confirmed" ? "Confirmé" : "Suspect"}</Badge> {nf(g.members.length)} tentatives,{" "}
                    {nf(g.ipCount)} réseau(x), de {time(first.at)} à {time(last.at)}
                  </p>
                  {canWrite && (
                    <span className="flex gap-1">
                      {excluded.length > 0 && (
                        <Button className="!min-h-8" onClick={() => decisions.validate(excluded, "Réintégrer les votes exclus du groupe")}>
                          <RotateCcw className="h-4 w-4" aria-hidden /> Réintégrer
                        </Button>
                      )}
                      {counted.length > 1 && (
                        <Button className="!min-h-8" onClick={() => void decisions.invalidate(counted.slice(1).map((m) => m.id))}>
                          <X className="h-4 w-4" aria-hidden /> Exclure les votes en trop
                        </Button>
                      )}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted dark:text-zinc-400">
                  Liens : {g.links.map((l) => LINK_KINDS[l].label).join(", ")}
                  {g.conditions.length > 0 && <> ; confirmé par : {g.conditions.map((c) => GROUP_CONDITIONS[c]).join(", ")}</>}
                </p>
                <p className="mt-1 text-xs text-muted dark:text-zinc-400">
                  Classes d&apos;IP : {[...new Set(g.members.map((m) => (m.ipClass ? IP_CLASS[m.ipClass] : null)).filter(Boolean))].join(", ") || "Inconnues"} ; décorations :{" "}
                  {[...new Set(g.members.map((m) => decoName(m.decorationId)))].join(", ")}
                </p>
                <ul className="mt-2">
                  {g.members.map((m, i) => (
                    <AttemptLine key={m.id} v={m} prev={g.members[i - 1]} decoName={decoName} label={m.id === g.kept ? "Gardé :" : undefined} />
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Tester cet appareil
// ---------------------------------------------------------------------------

type DeviceTest = { entropy: string | null; declaredEntropy: string | null; privateMode: boolean | null; hwPrefix: string | null; model: string | null; ipClass: string; country: string | null; city: string | null; tokens: number; recognized: "cookie" | "storage" | "hw" | null };
const ENTROPY: Record<string, string> = { strong: "forte", weak: "faible", noisy: "brouillée" };
const RECOGNIZED: Record<string, string> = { cookie: "oui, par le cookie", storage: "oui, par le stockage de l'appareil", hw: "oui, par la clé matérielle forte" };

/** « Tester cet appareil » : ce que l'appareil actuel enverrait, sans créer de vote (navigation normale et privée). */
export function DeviceTestPanel() {
  const [result, setResult] = useState<DeviceTest | null>(null);
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try {
      const device = await deviceSignals();
      const res = await fetch(withBase("/api/admin/fraud/device-test"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ device }) });
      setResult(res.ok ? ((await res.json()) as DeviceTest) : null);
    } finally {
      setBusy(false);
    }
  }
  const row = (label: string, value: React.ReactNode) => (
    <div className="flex justify-between gap-3 border-b border-line py-1.5 last:border-0 dark:border-zinc-800">
      <dt className="text-muted dark:text-zinc-400">{label}</dt>
      <dd className="text-right font-medium text-ink dark:text-zinc-100">{value}</dd>
    </div>
  );
  return (
    <Card title="Tester cet appareil">
      <p className="mb-3 text-sm text-muted dark:text-zinc-400">
        Ouvrez le backoffice sur un téléphone, en navigation normale puis privée : ce panneau montre ce que l&apos;appareil enverrait. Aucun vote n&apos;est créé.
      </p>
      <Button onClick={() => void run()} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Smartphone className="h-4 w-4" aria-hidden />} Tester cet appareil
      </Button>
      {result && (
        <dl className="mt-3 text-sm">
          {row("Classe d'entropie", `${result.entropy ? ENTROPY[result.entropy] : "inconnue"}${result.declaredEntropy && result.declaredEntropy !== result.entropy ? ` (déclarée ${ENTROPY[result.declaredEntropy]})` : ""}`)}
          {row("Navigation privée", result.privateMode === null ? "incertain" : result.privateMode ? "oui" : "non")}
          {row("Début de la clé hw", result.hwPrefix ? <span className="font-mono">{result.hwPrefix}</span> : "Aucune")}
          {row("Modèle", result.model ?? "Non renseigné")}
          {row("Classe de l'IP (serveur)", IP_CLASS[result.ipClass] ?? result.ipClass)}
          {row("Pays et ville (IP)", [result.country, result.city].filter(Boolean).join(", ") || "Inconnus")}
          {row("Jetons trouvés dans le stockage", nf(result.tokens))}
          {row("Reconnu comme ayant voté aujourd'hui", result.recognized ? RECOGNIZED[result.recognized] : "non")}
        </dl>
      )}
    </Card>
  );
}
