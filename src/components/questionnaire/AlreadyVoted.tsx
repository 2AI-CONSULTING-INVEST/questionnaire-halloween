"use client";

import Link from "next/link";
import { BarChart3, Gift } from "lucide-react";
import { useEffect, useState } from "react";
import { clientNow } from "@/lib/clock";
import { Emoji } from "./ui";
import { SocialCards } from "./SocialCards";

const two = (n: number) => String(n).padStart(2, "0");

/**
 * Écran « déjà voté aujourd'hui » : remplace l'accueil quand l'appareil a validé un vote ce jour-là.
 * Le compte à rebours court jusqu'au minuit parisien suivant ; arrivé à zéro, le vote rouvre sans recharger.
 */
export function AlreadyVoted({ nextResetAt, onReset }: { nextResetAt: string; onReset: () => void }) {
  const [left, setLeft] = useState(() => Math.max(0, Date.parse(nextResetAt) - clientNow()));

  useEffect(() => {
    const tick = () => {
      const ms = Math.max(0, Date.parse(nextResetAt) - clientNow());
      setLeft(ms);
      if (ms === 0) onReset();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [nextResetAt, onReset]);

  const total = Math.ceil(left / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  return (
    <main className="relative z-10 flex min-h-dvh flex-1 items-center px-4 pb-20 pt-[max(31vh,7rem)] sm:px-6 sm:py-20 md:px-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center text-center">
        {/* Sur téléphone, le titre descend sous la lune et repose sur un léger voile de lisibilité. */}
        <div className="rounded-3xl bg-page/55 px-3 py-4 backdrop-blur-sm sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
          <h1 className="text-[2rem] leading-[1.15] tracking-tight text-fg [text-shadow:0_2px_24px_rgba(0,0,0,0.45)] sm:text-5xl day:[text-shadow:none]">
            <Emoji name="pumpkin" size={64} priority className="mr-3 h-[1em] w-[1em]" />
            Vous avez déjà voté aujourd&apos;hui&nbsp;✅
          </h1>
          <p className="mt-4 max-w-xl text-lg text-fg-muted sm:mt-5 sm:text-xl">
            Merci&nbsp;! Revenez demain&nbsp;: le vote se réinitialise à minuit (heure de Paris).
          </p>
        </div>
        <div
          role="timer"
          aria-live="off"
          aria-label={`Prochain vote dans ${h} heures ${m} minutes ${s} secondes`}
          className="mt-6 inline-flex items-baseline gap-1.5 rounded-2xl border border-edge bg-surface/85 px-6 py-3 font-mono text-3xl font-bold tabular-nums tracking-wider text-brand shadow-lg shadow-black/25 backdrop-blur sm:text-4xl"
        >
          <span>{two(h)}</span>
          <span className="text-fg-muted">:</span>
          <span>{two(m)}</span>
          <span className="text-fg-muted">:</span>
          <span>{two(s)}</span>
        </div>
        <p className="mt-2 text-sm text-fg-muted">avant la réouverture du vote</p>

        <div className="mt-10 flex flex-col items-center gap-4">
          <Link
            href="/resultats"
            className="inline-flex min-h-12 items-center gap-2 rounded-full bg-brand px-7 text-lg font-bold text-black shadow-[0_0_30px_rgba(250,204,21,0.3)] transition-[filter] hover:brightness-105"
          >
            <BarChart3 className="h-5 w-5" aria-hidden /> Voir les résultats en direct
          </Link>
          <Link
            href="/participants"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-edge-strong bg-surface/80 px-5 text-base font-semibold text-fg backdrop-blur transition-colors hover:bg-surface-2"
          >
            <Gift className="h-5 w-5 text-brand" aria-hidden /> Voir les participants et les lots
          </Link>
          <SocialCards className="mt-4" delay={0.2} />
        </div>
      </div>
    </main>
  );
}
