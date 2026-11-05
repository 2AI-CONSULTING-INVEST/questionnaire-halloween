"use client";

import { ArrowRight, Trophy, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Dialog } from "radix-ui";
import { isLocalMedia } from "@/lib/schema";

export type Winner = { id: string; name: string; image_url: string | null; pseudo: string };

/** Vignette d'un lot (image optimisée, chargée à l'approche de l'écran) ou tuile cadeau. */
export function PrizeThumb({ url, name, className, sizes }: { url: string | null; name: string; className: string; sizes: string }) {
  return (
    <div className={`relative overflow-hidden bg-surface-2 ${className}`}>
      {url ? (
        <Image src={url} alt={name} fill sizes={sizes} unoptimized={isLocalMedia(url)} className="object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-4xl" aria-hidden>
          🎁
        </span>
      )}
    </div>
  );
}

/** Accueil : début de la liste des gagnants ; un clic ouvre, sur toute la page, tous les gagnants et leurs lots. */
export function WinnersPreview({ winners }: { winners: Winner[] }) {
  return (
    <Dialog.Root>
      <Dialog.Trigger className="flex w-full max-w-sm flex-col rounded-2xl sm:h-[24.9rem] border border-[#f5c542]/70 bg-surface/90 p-4 text-left shadow-[0_0_28px_rgba(245,197,66,0.18)] backdrop-blur-sm transition-shadow hover:shadow-[0_0_40px_rgba(245,197,66,0.35)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/60">
        <span className="flex items-center gap-2 text-base font-bold uppercase leading-snug tracking-wide text-[#f5c542] day:text-[#4a2600]">
          <Trophy className="h-5 w-5 shrink-0" aria-hidden /> Les lots et les gagnants du tirage au sort
        </span>
        {/* Hauteur limitée, à la taille de l'aperçu vidéo sur grand écran : la liste s'efface vers le bas, le reste est à découvrir au clic. */}
        <span className={`my-3 flex flex-1 flex-col gap-3 overflow-hidden ${winners.length > 2 ? "max-sm:h-44 max-sm:flex-none [mask-image:linear-gradient(to_bottom,black_60%,transparent)]" : ""} sm:min-h-0`}>
          {winners.map((w) => (
            <span key={w.id} className="flex shrink-0 items-center gap-3">
              <PrizeThumb url={w.image_url} name="" className="h-14 w-14 shrink-0 rounded-lg" sizes="56px" />
              <span className="min-w-0">
                <span className="block truncate text-base font-extrabold text-fg">{w.pseudo}</span>
                <span className="block truncate text-sm text-fg-muted">{w.name}</span>
              </span>
            </span>
          ))}
        </span>
        <span className="inline-flex items-center gap-1.5 text-base font-bold text-fg underline decoration-brand decoration-2 underline-offset-4">
          Voir {winners.length > 1 ? `les ${winners.length} gagnants` : "le gagnant"} et les lots <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
        </span>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Content aria-describedby={undefined} className="fixed inset-0 z-50 overflow-y-auto bg-solid text-fg outline-none data-[state=open]:animate-[fade-in_200ms_ease-out]">
          <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-edge bg-solid px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-8">
            <Trophy className="h-6 w-6 shrink-0 text-[#f5c542] day:text-[#4a2600]" aria-hidden />
            <Dialog.Title className="min-w-0 flex-1 text-lg font-semibold leading-snug sm:text-2xl">Les lots et les gagnants du tirage au sort</Dialog.Title>
            <Dialog.Close aria-label="Fermer" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-2 transition-colors hover:brightness-110">
              <X className="h-6 w-6" aria-hidden />
            </Dialog.Close>
          </header>
          <ul className="mx-auto grid max-w-6xl gap-4 px-4 py-6 sm:grid-cols-2 sm:px-8 lg:grid-cols-3">
            {winners.map((w) => (
              <li key={w.id} className="overflow-hidden rounded-2xl border border-[#f5c542]/70 bg-surface shadow-[0_0_28px_rgba(245,197,66,0.18)]">
                <PrizeThumb url={w.image_url} name={w.name} className="aspect-[4/3] w-full" sizes="(max-width: 640px) calc(100vw - 2rem), (max-width: 1024px) 50vw, 33vw" />
                <div className="p-4">
                  <p className="text-xl font-extrabold">
                    <span aria-hidden>🎉</span> {w.pseudo}
                  </p>
                  <p className="mt-1 text-base text-fg-muted">a gagné : {w.name}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="pb-[max(2rem,env(safe-area-inset-bottom))] text-center">
            <Link href="/participants" className="inline-flex min-h-11 items-center text-base font-semibold underline decoration-brand decoration-2 underline-offset-4 hover:text-brand">
              Les lots et les participants du tirage
            </Link>
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
