"use client";

import { CalendarDays, Globe, Mail, MessageSquareQuote, Phone, Smartphone, Store, Trophy, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useEffect, useState } from "react";
import { withBase } from "@/lib/base-path";
import { DEFAULT_RISK_SETTINGS, type RiskSettings } from "@/lib/risk";
import { formatFrPhone, shortName, type Participant, type Prize, type ResponseRow } from "@/lib/schema";
import { Badge, Button, deviceLabel, Empty, fmtDate, RiskBadge, StatusBadge } from "./ui";

type Vote = ResponseRow & { decoration: string | null };

/** Bordure gauche d'une carte de vote selon son statut. */
const edge = (v: Vote) => (v.excluded_at ? "border-l-amber-400" : v.blocked_at ? "border-l-red-500" : v.completed_at ? "border-l-emerald-500" : "border-l-zinc-300 dark:border-l-zinc-600");

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-muted dark:bg-zinc-800 dark:text-zinc-400" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted dark:text-zinc-400">{label}</p>
        <div className="text-sm text-ink dark:text-zinc-100">{children}</div>
      </div>
    </div>
  );
}

/** Votes du participant, chargés à l'ouverture (monté avec le contenu du panneau : état neuf à chaque ouverture). */
function Votes({ id }: { id: string }) {
  const [data, setData] = useState<{ votes: Vote[]; settings: RiskSettings } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch(withBase(`/api/participants/${id}/votes`), { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("load"))))
      .then((d) => !cancelled && setData(d))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [id]);
  const settings = data?.settings ?? DEFAULT_RISK_SETTINGS;
  const count = data?.votes.length ?? 0;

  return (
    <section className="mt-6">
      <h3 className="mb-3 flex items-baseline gap-2 text-sm font-semibold text-ink dark:text-zinc-100">
        Votes
        {data && (
          <span className="text-xs font-medium text-muted dark:text-zinc-400">
            {count} au total · un par jour au plus
          </span>
        )}
      </h3>
      {failed ? (
        <Empty>Impossible de charger les votes.</Empty>
      ) : !data ? (
        <p className="text-sm text-muted dark:text-zinc-400">Chargement…</p>
      ) : count === 0 ? (
        <Empty>Aucun vote relié à ce participant.</Empty>
      ) : (
        <ol className="space-y-3">
          {data.votes.map((v) => (
            <li key={v.id} className={`rounded-xl border border-line border-l-4 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 ${edge(v)}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-ink dark:text-zinc-100">{fmtDate(v.completed_at ?? v.created_at)}</span>
                <StatusBadge row={v} />
                <RiskBadge score={v.risk_score} flags={(v.risk_flags as string[] | null) ?? null} settings={settings} />
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Row icon={<Store className="h-3.5 w-3.5" />} label="Q2 · A voté pour">
                  <span className="font-semibold">{v.decoration ? shortName(v.decoration) : "—"}</span>
                </Row>
                <Row icon={<Store className="h-3.5 w-3.5" />} label="Q1 · Restaurant préféré">
                  {v.selected_restaurant ? shortName(v.selected_restaurant) : "—"}
                </Row>
              </div>
              {v.comment && (
                <blockquote className="mt-3 flex gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm italic text-ink dark:bg-zinc-800/60 dark:text-zinc-200">
                  <MessageSquareQuote className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
                  <span className="whitespace-pre-wrap">{v.comment}</span>
                </blockquote>
              )}
              <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted dark:text-zinc-400">
                <span className="inline-flex items-center gap-1">
                  <Globe className="h-3.5 w-3.5" aria-hidden /> <span className="font-mono">{v.ip_address ?? "IP inconnue"}</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <Smartphone className="h-3.5 w-3.5" aria-hidden /> {deviceLabel(v.device_info)}
                </span>
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** Panneau latéral : fiche d'un participant au tirage et tous ses votes. */
export function ParticipantDrawer({ p, prize, open, onOpenChange }: { p: Participant; prize: Prize | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const fullName = [p.first_name, p.last_name].filter(Boolean).join(" ");
  const initial = (p.pseudo.trim()[0] ?? "?").toUpperCase();

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col bg-canvas shadow-2xl outline-none dark:bg-zinc-950"
        >
          <header className="flex items-start gap-4 border-b border-line bg-white px-6 py-5 dark:border-zinc-800 dark:bg-zinc-900">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand text-xl font-bold text-ink" aria-hidden>
              {initial}
            </span>
            <div className="min-w-0 flex-1">
              <Dialog.Title className="truncate text-lg font-bold leading-tight text-ink dark:text-zinc-100">{p.pseudo}</Dialog.Title>
              <p className="text-sm text-muted dark:text-zinc-400">{fullName || "Prénom et nom non renseignés"}</p>
              {p.deleted_at && (
                <p className="mt-1.5">
                  <Badge tone="warn">Supprimé le {fmtDate(p.deleted_at)}</Badge>
                </p>
              )}
              {prize && (
                <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-ink dark:bg-yellow-900/30 dark:text-yellow-200">
                  <Trophy className="h-3.5 w-3.5" aria-hidden /> A gagné : {prize.name}
                </p>
              )}
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" className="!min-h-8 !px-1.5" aria-label="Fermer">
                <X className="h-4 w-4" aria-hidden />
              </Button>
            </Dialog.Close>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <section className="grid gap-4 rounded-xl border border-line bg-white p-4 sm:grid-cols-2 dark:border-zinc-800 dark:bg-zinc-900">
              <Row icon={<Mail className="h-3.5 w-3.5" />} label="Email">
                <a href={`mailto:${p.email}`} className="break-all hover:underline">{p.email}</a>
              </Row>
              <Row icon={<Phone className="h-3.5 w-3.5" />} label="Téléphone">
                <a href={`tel:${p.phone_number}`} className="tabular-nums hover:underline">{formatFrPhone(p.phone_number)}</a>
              </Row>
              <Row icon={<CalendarDays className="h-3.5 w-3.5" />} label="Inscrit au tirage le">
                {fmtDate(p.created_at)}
              </Row>
              <Row icon={<Trophy className="h-3.5 w-3.5" />} label="Lot">
                {prize ? prize.name : "Aucun lot attribué"}
              </Row>
            </section>
            <Votes id={p.id} />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
