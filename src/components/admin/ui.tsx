"use client";

import { ShieldAlert } from "lucide-react";
import { AlertDialog } from "radix-ui";
import type { ReactNode } from "react";
import { flagLabel, type RiskSettings } from "@/lib/risk";
import type { ResponseRow } from "@/lib/schema";

export function Card({ title, actions, children, className = "" }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-line bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 ${className}`}>
      {(title || actions) && (
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {title && <h2 className="text-base font-semibold text-ink dark:text-zinc-100">{title}</h2>}
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

const variants = {
  primary: "bg-brand text-black hover:brightness-95",
  secondary: "border border-line bg-white text-ink hover:bg-gray-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700",
  danger: "bg-red-600 text-white hover:bg-red-700",
  ghost: "text-muted hover:bg-gray-100 hover:text-ink dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
};

export function Button({
  variant = "secondary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof variants }) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex min-h-9 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50 ${variants[variant]} ${className}`}
    />
  );
}

export const linkButtonClass =
  "inline-flex min-h-9 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors duration-150 " + variants.secondary;

/** Lien de téléchargement mis en avant (bouton jaune de la marque). */
export const primaryLinkButtonClass =
  "inline-flex min-h-9 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors duration-150 " + variants.primary;

export const inputClass =
  "min-h-9 rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/40 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100";

export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = "Supprimer",
  onConfirm,
}: {
  trigger: ReactNode;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900">
          <AlertDialog.Title className="text-lg font-semibold text-ink dark:text-zinc-100">{title}</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm text-muted dark:text-zinc-400">{description}</AlertDialog.Description>
          <div className="mt-6 flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button>Annuler</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button variant="danger" onClick={onConfirm}>
                {confirmLabel}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-sm text-muted dark:text-zinc-400">{children}</p>;
}

export const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "Aucune date";

export const fmtPct = (v: number) => `${(Math.round(v * 1000) / 10).toLocaleString("fr-FR")} %`;

/** Lien de téléchargement d'un export (route API, pas une page : pas de <Link>). */
export function DownloadLink({ href, className = linkButtonClass, children }: { href: string; className?: string; children: ReactNode }) {
  return (
    <a href={href} download className={className}>
      {children}
    </a>
  );
}

/** Pastille (comme celles du Journal). */
export const badgeClass = {
  neutral: "bg-gray-100 text-muted dark:bg-zinc-800 dark:text-zinc-300",
  ok: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  warn: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  danger: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
} as const;

export function Badge({ tone, title, children }: { tone: keyof typeof badgeClass; title?: string; children: ReactNode }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${badgeClass[tone]}`}>
      {children}
    </span>
  );
}

/** Score de risque : rouge à partir du seuil de blocage, orange à partir du seuil de signalement ; signaux au survol. */
export function RiskBadge({ score, flags, settings }: { score: number; flags: string[] | null; settings: RiskSettings }) {
  const tone = score >= settings.block_threshold ? "danger" : score >= settings.flag_threshold ? "warn" : "neutral";
  const title = (flags ?? []).map(flagLabel).join("\n") || "Aucun signal";
  return (
    <Badge tone={tone} title={title}>
      {tone !== "neutral" && <ShieldAlert className="h-3 w-3" aria-hidden />}
      <span className="sr-only">Score de risque </span>
      {score}
    </Badge>
  );
}

/** Appareil d'une réponse, lisible : « Android, SM-A546B Android 14, Chrome 156, 393×851@2.75, mobile ». */
export function deviceLabel(info: ResponseRow["device_info"]) {
  if (!info) return "Inconnu";
  const model = info.model ? `${info.model}${info.osVersion ? ` Android ${info.osVersion}` : ""}` : null;
  return [info.platform, model, info.browser, info.screen?.replace("x", "×"), info.mobile === undefined ? null : info.mobile ? "mobile" : "ordinateur"].filter(Boolean).join(", ") || "Inconnu";
}

/** Statut d'une réponse : comptée, en attente, bloquée, exclue (à la main ou automatiquement), ou inachevée. */
export function StatusBadge({ row }: { row: Pick<ResponseRow, "completed_at" | "blocked_at" | "excluded_at" | "held_at" | "exclusion_source"> }) {
  if (row.excluded_at) return <Badge tone="warn">{row.exclusion_source === "auto" ? "Exclu (auto)" : "Exclu"}</Badge>;
  if (row.blocked_at) return <Badge tone="danger">Bloqué</Badge>;
  if (row.held_at) return <Badge tone="warn">En attente</Badge>;
  if (row.completed_at) return <Badge tone="ok">Compté</Badge>;
  return <Badge tone="neutral">Inachevé</Badge>;
}

/** Bas de liste paginée : « 100 sur 1 234 » et « Charger 100 de plus » (masqué quand tout est chargé). */
export function PageFooter({ shown, total, more, loading, onMore }: { shown: number; total: number; more: boolean; loading: boolean; onMore: () => void }) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-sm text-muted dark:text-zinc-400" aria-live="polite">
      <span>
        {shown.toLocaleString("fr-FR")} sur {total.toLocaleString("fr-FR")}
      </span>
      {more && (
        <Button onClick={onMore} disabled={loading}>
          {loading ? "Chargement…" : "Charger 100 de plus"}
        </Button>
      )}
    </div>
  );
}
