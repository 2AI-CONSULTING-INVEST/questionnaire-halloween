"use client";

import Link from "next/link";
import { BarChart3, Gift } from "lucide-react";
import { ShareButtons } from "./ShareButtons";
import { SocialCards } from "./SocialCards";

/** Séparateur discret entre deux groupes : filets dégradés de part et d'autre d'un petit intitulé. */
function Divider({ label }: { label: string }) {
  return (
    <div className="flex w-full items-center gap-3">
      <span aria-hidden className="h-px flex-1 bg-[linear-gradient(to_right,transparent,var(--color-edge-strong))]" />
      {/* Texte posé directement sur le décor (couleur lisible, sans pastille de fond). */}
      <h2 className="shrink-0 text-xs font-semibold tracking-wide text-fg [text-shadow:0_1px_8px_rgba(0,0,0,0.5)] day:[text-shadow:none] sm:text-[13px]">{label}</h2>
      <span aria-hidden className="h-px flex-1 bg-[linear-gradient(to_left,transparent,var(--color-edge-strong))]" />
    </div>
  );
}

/**
 * Actions des écrans de fin (remerciements, « déjà voté ») en trois groupes de même largeur,
 * séparés : (a) résultats et participants, (b) cartes « S'abonner », (c) partage.
 */
export function ThanksActions({ delay = 0.3, className = "" }: { delay?: number; className?: string }) {
  return (
    <div className={`mx-auto flex w-full max-w-[400px] flex-col items-center gap-5 sm:gap-6 ${className}`}>
      <div className="flex w-full flex-col gap-2.5 sm:gap-3">
        <Link
          href="/resultats"
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-brand px-5 text-base font-bold text-black shadow-[0_0_30px_rgba(250,204,21,0.3)] transition-[filter] hover:brightness-105 sm:min-h-12 sm:text-lg"
        >
          <BarChart3 className="h-5 w-5 shrink-0" aria-hidden /> Voir les résultats en direct
        </Link>
        <Link
          href="/participants"
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-edge-strong bg-surface/80 px-5 text-[15px] font-semibold text-fg backdrop-blur transition-colors hover:bg-surface-2 sm:text-base"
        >
          <Gift className="h-5 w-5 shrink-0 text-brand" aria-hidden /> Voir les participants et les lots
        </Link>
      </div>
      <Divider label="Suivez-nous" />
      <SocialCards delay={delay} />
      <Divider label="Partagez le vote" />
      <ShareButtons />
    </div>
  );
}
