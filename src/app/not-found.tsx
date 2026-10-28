import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page introuvable",
};

/**
 * Page 404 (adresse inconnue sous /halloween, ou `notFound()`). Statique et légère : le poster du
 * cimetière (posters.css, déjà préchargé par le script du layout) remplace le décor 3D.
 */
export default function NotFound() {
  return (
    <>
      <div className="sky-poster" data-scene="graveyard" aria-hidden />
      <main className="relative z-10 flex min-h-svh items-center justify-center px-4 py-[max(1.5rem,env(safe-area-inset-top))]">
        <div className="w-full max-w-md rounded-2xl border border-edge bg-surface/90 p-6 text-center shadow-lg shadow-black/25 backdrop-blur-sm day:shadow-black/10 sm:p-8">
          <p className="text-sm font-semibold text-brand day:text-[#4a2600]">Erreur 404</p>
          <h1 className="mt-2 text-3xl leading-tight tracking-tight text-fg sm:text-4xl">Page introuvable</h1>
          <p className="mt-3 text-base text-fg-muted">Cette page n&apos;existe pas ou a été déplacée. Le vote, lui, continue.</p>
          <div className="mt-8 flex flex-col items-center gap-3">
            <Link
              href="/"
              className="inline-flex min-h-12 items-center rounded-full bg-brand px-7 text-lg font-bold text-black transition-[filter] hover:brightness-105 active:brightness-95"
            >
              Retour au vote
            </Link>
            <Link href="/resultats" className="text-sm text-fg-muted underline-offset-2 hover:text-fg hover:underline">
              Voir les résultats en direct
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
