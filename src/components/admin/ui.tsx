"use client";

import { AlertDialog } from "radix-ui";
import type { ReactNode } from "react";

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
  iso ? new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "—";

export const fmtPct = (v: number) => `${(Math.round(v * 1000) / 10).toLocaleString("fr-FR")} %`;

/** Lien de téléchargement d'un export (route API, pas une page : pas de <Link>). */
export function DownloadLink({ href, className = linkButtonClass, children }: { href: string; className?: string; children: ReactNode }) {
  return (
    <a href={href} download className={className}>
      {children}
    </a>
  );
}
