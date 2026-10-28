"use client";

import { Emoji } from "./ui";
import { useCountdown } from "./useCountdown";
import { ThanksActions } from "./ThanksActions";

const two = (n: number) => String(n).padStart(2, "0");

/**
 * Écran « déjà voté aujourd'hui » : remplace l'accueil quand l'appareil a validé un vote ce jour-là.
 * Le compte à rebours (calé sur l'heure du serveur) court jusqu'au minuit parisien suivant ; arrivé à zéro, le vote rouvre sans recharger.
 */
export function AlreadyVoted({ nextResetAt, onReset }: { nextResetAt: string; onReset: () => void }) {
  const left = useCountdown(nextResetAt, onReset);

  const total = Math.ceil(left / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  return (
    <main className="relative z-10 flex min-h-dvh flex-1 items-center px-4 pb-20 pt-[max(31vh,7rem)] sm:px-6 sm:py-20 md:px-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center text-center">
        {/* Sur téléphone, le titre descend sous la lune et repose sur un léger voile de lisibilité. */}
        <div className="rounded-3xl bg-page/55 px-3 py-4 backdrop-blur-sm sm:bg-transparent sm:p-0 sm:backdrop-blur-none day:bg-transparent day:backdrop-blur-none">
          <h1 className="text-[1.65rem] leading-[1.18] tracking-tight text-fg [text-shadow:0_2px_24px_rgba(0,0,0,0.45)] min-[400px]:text-[1.9rem] sm:text-5xl day:[text-shadow:none]">
            <Emoji name="pumpkin" size={64} priority className="mr-3 h-[1em] w-[1em]" />
            Vous avez déjà voté aujourd&apos;hui&nbsp;✅
          </h1>
          <p className="mt-3 max-w-xl text-base text-fg-muted sm:mt-5 sm:text-xl">
            Merci&nbsp;! Revenez demain&nbsp;: le vote se réinitialise à minuit (heure de Paris).
          </p>
        </div>
        <div
          role="timer"
          aria-live="off"
          aria-label={`Prochain vote dans ${h} heures ${m} minutes ${s} secondes`}
          className="mt-6 inline-flex items-baseline gap-1.5 rounded-2xl border border-edge bg-surface/85 px-6 py-3 font-mono text-3xl font-bold tabular-nums tracking-wider text-brand shadow-lg shadow-black/25 backdrop-blur sm:text-4xl day:text-[#451a03]"
        >
          <span>{two(h)}</span>
          <span className="text-fg-muted">:</span>
          <span>{two(m)}</span>
          <span className="text-fg-muted">:</span>
          <span>{two(s)}</span>
        </div>
        <p className="mt-2 text-sm text-fg-muted">avant la réouverture du vote</p>

        <ThanksActions className="mt-8 sm:mt-10" delay={0.2} />
      </div>
    </main>
  );
}
