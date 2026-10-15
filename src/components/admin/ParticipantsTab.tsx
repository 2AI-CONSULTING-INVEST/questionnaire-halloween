"use client";

import { ArrowUpDown, Check, Download, Pencil, Search, Trash2, Trophy, X } from "lucide-react";
import { useMemo, useState } from "react";
import { formatFrPhone, PSEUDO_MAX, pseudoKey, type Participant, type Prize, type ResponseRow } from "@/lib/schema";
import { Button, Card, ConfirmDialog, DownloadLink, Empty, fmtDate, inputClass } from "./ui";
import { withBase } from "@/lib/base-path";

type SortKey = "pseudo" | "email" | "date";
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

async function request(url: string, init: RequestInit) {
  const res = await fetch(url, init);
  if (!res.ok) {
    const b = (await res.json().catch(() => ({}))) as { error?: string; details?: Record<string, string[]> };
    throw new Error(Object.values(b.details ?? {}).flat()[0] ?? b.error ?? "Erreur");
  }
}

/** Participants au tirage (table `participants`) : recherche, lots, modération du pseudo, suppression. */
export function ParticipantsTab({
  participants,
  responses,
  prizes,
  canWrite,
  onChanged,
}: {
  participants: Participant[];
  responses: ResponseRow[];
  prizes: Prize[];
  canWrite: boolean;
  onChanged: () => void;
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>({ key: "date", asc: false });

  const votes = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of responses) if (r.completed_at && r.participant_id) m.set(r.participant_id, (m.get(r.participant_id) ?? 0) + 1);
    return m;
  }, [responses]);
  const prizeOf = useMemo(() => new Map(prizes.filter((p) => p.winner_participant_id).map((p) => [p.winner_participant_id!, p])), [prizes]);
  const freePrizes = useMemo(() => prizes.filter((p) => !p.winner_participant_id), [prizes]);

  const rows = useMemo(() => {
    const needle = pseudoKey(q);
    const list = participants.filter(
      (p) => !needle || pseudoKey(p.pseudo).includes(needle) || p.email.includes(needle) || p.phone_number.includes(needle.replace(/\s/g, "")),
    );
    const val = (p: Participant) => (sort.key === "pseudo" ? p.pseudo : sort.key === "email" ? p.email : p.created_at);
    return list.sort((a, b) => (sort.asc ? 1 : -1) * val(a).localeCompare(val(b), "fr"));
  }, [participants, q, sort]);

  const winners = participants.filter((p) => prizeOf.has(p.id)).length;

  return (
    <Card
      title={`Participants au tirage (${participants.length}) · ${winners} gagnant${winners > 1 ? "s" : ""}`}
      actions={
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <input
              type="search"
              placeholder="Pseudo, email ou téléphone"
              aria-label="Rechercher un participant"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className={`${inputClass} w-60 pl-8`}
            />
          </div>
          <DownloadLink href={withBase("/api/responses/export?scope=participants&format=csv")}>
            <Download className="h-4 w-4" aria-hidden /> CSV
          </DownloadLink>
        </div>
      }
    >
      {rows.length === 0 ? (
        <Empty>Aucun participant {q ? "ne correspond à la recherche" : "pour l'instant"}.</Empty>
      ) : (
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[960px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted dark:border-zinc-800 dark:text-zinc-400">
                <th className="px-5 py-2"><SortBtn k="pseudo" sort={sort} setSort={setSort}>Pseudo</SortBtn></th>
                <th className="px-3 py-2"><SortBtn k="email" sort={sort} setSort={setSort}>Email</SortBtn></th>
                <th className="px-3 py-2 font-semibold uppercase">Téléphone</th>
                <th className="px-3 py-2"><SortBtn k="date" sort={sort} setSort={setSort}>Inscription</SortBtn></th>
                <th className="px-3 py-2 text-right font-semibold uppercase">Votes</th>
                <th className="px-3 py-2 font-semibold uppercase">Lot gagné</th>
                <th className="px-5 py-2 text-right">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <ParticipantRow key={p.id} p={p} votes={votes.get(p.id) ?? 0} prize={prizeOf.get(p.id) ?? null} freePrizes={freePrizes} canWrite={canWrite} onChanged={onChanged} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function ParticipantRow({
  p,
  votes,
  prize,
  freePrizes,
  canWrite,
  onChanged,
}: {
  p: Participant;
  votes: number;
  prize: Prize | null;
  freePrizes: Prize[];
  canWrite: boolean;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [pseudo, setPseudo] = useState(p.pseudo);
  const [assigning, setAssigning] = useState(false);
  const [choice, setChoice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };
  const json = (body: unknown) => ({ method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

  const rename = () =>
    run(async () => {
      await request(withBase(`/api/participants/${p.id}`), json({ pseudo: pseudo.trim() }));
      setEditing(false);
    });
  const assign = () =>
    run(async () => {
      if (!choice) return;
      await request(withBase(`/api/prizes/${choice}`), json({ winner_participant_id: p.id }));
      setAssigning(false);
      setChoice("");
    });
  const unassign = () => run(() => request(withBase(`/api/prizes/${prize!.id}`), json({ winner_participant_id: null })));
  const remove = () => run(() => request(withBase(`/api/participants/${p.id}`), { method: "DELETE" }));

  return (
    <tr className={`border-b border-line align-top last:border-0 dark:border-zinc-800 ${prize ? "bg-brand-50 dark:bg-yellow-900/20" : ""}`}>
      <td className="px-5 py-2.5 font-medium text-ink dark:text-zinc-100">
        {editing ? (
          <span className="flex items-center gap-1">
            <input
              aria-label="Nouveau pseudo"
              value={pseudo}
              maxLength={PSEUDO_MAX}
              onChange={(e) => setPseudo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void rename()}
              className={`${inputClass} !min-h-8 w-44`}
              autoFocus
            />
            <Button variant="ghost" className="!min-h-8 !px-1.5" aria-label="Enregistrer le pseudo" disabled={busy || pseudo.trim().length < 3} onClick={() => void rename()}>
              <Check className="h-4 w-4" />
            </Button>
            <Button variant="ghost" className="!min-h-8 !px-1.5" aria-label="Annuler" disabled={busy} onClick={() => (setEditing(false), setPseudo(p.pseudo))}>
              <X className="h-4 w-4" />
            </Button>
          </span>
        ) : (
          <span className="flex items-center gap-1">
            {p.pseudo}
            {canWrite && (
              <Button variant="ghost" className="!min-h-7 !px-1" aria-label={`Modifier le pseudo ${p.pseudo}`} disabled={busy} onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
          </span>
        )}
        {error && (
          <p role="alert" className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </td>
      <td className="px-3 py-2.5 text-ink dark:text-zinc-200">
        <a href={`mailto:${p.email}`} className="hover:underline">{p.email}</a>
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-ink dark:text-zinc-200">
        <a href={`tel:${p.phone_number}`} className="hover:underline">{formatFrPhone(p.phone_number)}</a>
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-muted dark:text-zinc-400">{fmtDate(p.created_at)}</td>
      <td className="px-3 py-2.5 text-right tabular-nums text-ink dark:text-zinc-200">{votes}</td>
      <td className="px-3 py-2.5">
        {prize ? (
          <span className="inline-flex items-center gap-1 font-semibold text-ink dark:text-yellow-200">
            <Trophy className="h-4 w-4" aria-hidden /> {prize.name}
          </span>
        ) : assigning ? (
          <span className="flex items-center gap-1">
            <select aria-label="Lot à attribuer" value={choice} onChange={(e) => setChoice(e.target.value)} className={`${inputClass} !min-h-8 w-44`}>
              <option value="">Choisir un lot…</option>
              {freePrizes.map((pr) => (
                <option key={pr.id} value={pr.id}>
                  {pr.name}
                </option>
              ))}
            </select>
            <Button variant="primary" className="!min-h-8" disabled={busy || !choice} onClick={() => void assign()}>
              OK
            </Button>
            <Button variant="ghost" className="!min-h-8 !px-1.5" aria-label="Annuler" disabled={busy} onClick={() => setAssigning(false)}>
              <X className="h-4 w-4" />
            </Button>
          </span>
        ) : (
          <span className="text-muted dark:text-zinc-400">—</span>
        )}
      </td>
      <td className="whitespace-nowrap px-5 py-2.5 text-right">
        {canWrite && (
          <span className="inline-flex items-center gap-1">
            {prize ? (
              <Button variant="secondary" className="!min-h-8" disabled={busy} onClick={() => void unassign()}>
                Retirer le lot
              </Button>
            ) : (
              !assigning && (
                <Button variant="secondary" className="!min-h-8" disabled={busy || freePrizes.length === 0} title={freePrizes.length === 0 ? "Aucun lot libre" : undefined} onClick={() => setAssigning(true)}>
                  <Trophy className="h-4 w-4" aria-hidden /> Attribuer un lot
                </Button>
              )
            )}
            <ConfirmDialog
              title={`Supprimer ${p.pseudo} ?`}
              description="Le participant et ses coordonnées seront définitivement supprimés. Ses votes sont conservés, sans lien ; son lot éventuel redevient libre."
              onConfirm={() => void remove()}
              trigger={
                <Button variant="ghost" className="!min-h-8 !px-1.5" aria-label={`Supprimer ${p.pseudo}`} disabled={busy}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              }
            />
          </span>
        )}
      </td>
    </tr>
  );
}
