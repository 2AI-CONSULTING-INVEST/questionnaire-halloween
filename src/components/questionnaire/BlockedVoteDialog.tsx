"use client";

import { Dialog } from "radix-ui";
import { formatWait, speakWait } from "@/lib/countdown";
import { useCountdown } from "./useCountdown";

/**
 * Modale « Votre vote est bloqué » : ouverte dès que le serveur refuse un vote de façon visible (409
 * already_voted_today, à l'ouverture ou à la validation). Même texte pour tous les motifs : la raison
 * n'est jamais donnée. Compte à rebours en direct jusqu'à la réouverture (minuit, heure de Paris),
 * calé sur l'heure du serveur ; à zéro, « Voter à nouveau » rouvre le vote sans recharger. Fermer la
 * modale (bouton, Échap, clic à côté) mène à l'écran « déjà voté ».
 */
export function BlockedVoteDialog({ nextResetAt, onClose, onReopen }: { nextResetAt: string; onClose: () => void; onReopen: () => void }) {
  const left = useCountdown(nextResetAt);
  const done = left === 0;

  return (
    <Dialog.Root open onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-[fade-in_200ms_ease-out]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 outline-none data-[state=open]:animate-pop">
          <div className="flex flex-col gap-4 rounded-3xl border border-edge bg-solid p-5 shadow-2xl shadow-black/60 sm:p-6">
            <Dialog.Title className="text-xl leading-snug text-fg sm:text-2xl">Votre vote est bloqué</Dialog.Title>
            <Dialog.Description className="text-base leading-relaxed text-fg-muted">
              La limite d&apos;un vote par jour est atteinte : ce vote n&apos;a pas été enregistré.{" "}
              {done ? "Le vote est rouvert." : <>Vous pourrez voter à nouveau dans {speakWait(left)}, à minuit, heure de Paris.</>}
            </Dialog.Description>
            {!done && (
              <div className="rounded-2xl bg-surface-2 px-4 py-3 text-center">
                {/* Thème clair : ambre très foncé (4,6:1 sur l'ocre de surface-2), le jaune y tombe à 2:1. */}
                <p role="timer" aria-live="off" aria-hidden className="font-mono text-2xl font-bold tabular-nums text-brand sm:text-3xl day:text-[#451a03]">
                  {formatWait(left)}
                </p>
                <p className="mt-1 text-sm text-fg-muted">avant la réouverture, à minuit (heure de Paris)</p>
              </div>
            )}
            {done ? (
              <button
                type="button"
                onClick={onReopen}
                className="min-h-12 rounded-full bg-brand px-6 text-lg font-bold text-black transition-[filter] hover:brightness-105 active:brightness-95"
              >
                Voter à nouveau
              </button>
            ) : (
              <Dialog.Close className="min-h-12 rounded-full border border-edge-strong px-6 text-base font-semibold text-fg transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/60">
                J&apos;ai compris
              </Dialog.Close>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
