"use client";

import { Loader2 } from "lucide-react";
import Image from "next/image";
import { Dialog } from "radix-ui";
import { useEffect, useState } from "react";
import { withBase } from "@/lib/base-path";
import { isLocalMedia } from "@/lib/schema";
import { Cobweb, LanternPost } from "./RaffleConfirmDialog";

/** Lot tel qu'il est montré au public (ni gagnant ni donnée personnelle). */
export type PublicPrize = { id: string; name: string; description: string | null; image_url: string | null };

/** Largeur affichée du grand visuel : toute la largeur utile de la modale (max-w-lg dès 640 px, moins les marges). */
const FEATURE_SIZES = "(max-width: 640px) calc(100vw - 4.5rem), 464px";

/**
 * Confirmation du « Non » au tirage au sort (même décor que la modale des coordonnées) : met les lots
 * en vitrine pour donner envie — un grand visuel (image entière sur fond flou de la même image, comme
 * la modale de détail des lots) avec le nom du lot, qui passe d'un lot à l'autre toutes les 3,5 s
 * (pas si les animations sont réduites), et une rangée de vignettes pour choisir. Sans lot, un message
 * générique. « Finalement, je participe » repasse au Oui et enchaîne sur la saisie ; « Oui, je
 * confirme » enregistre le Non.
 */
export function RaffleDeclineDialog({
  open,
  onOpenChange,
  prizes,
  busy,
  onConfirm,
  onParticipate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prizes: PublicPrize[];
  busy: boolean;
  onConfirm: () => void;
  onParticipate: () => void;
}) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = prizes.length;
  const featured = n > 0 ? prizes[current % n] : null;

  // Défilement automatique, arrêté dès que la personne choisit une vignette.
  useEffect(() => {
    if (!open || n < 2 || paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setInterval(() => setCurrent((c) => (c + 1) % n), 3500);
    return () => window.clearInterval(t);
  }, [open, n, paused]);

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-[fade-in_200ms_ease-out]" />
        <Dialog.Content
          data-decline-dialog
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 sm:max-w-lg -translate-y-1/2 outline-none data-[state=open]:animate-pop"
        >
          <LanternPost />
          <div className="relative flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden rounded-3xl border border-edge bg-solid shadow-2xl shadow-black/60">
            <Cobweb />
            <div className="min-h-0 overflow-y-auto px-5 pt-5 sm:px-6 sm:pt-6">
              <Dialog.Title className="relative text-xl leading-snug text-fg sm:text-2xl">Êtes-vous sûr(e) de votre choix&nbsp;?</Dialog.Title>
              <Dialog.Description className="mt-2 text-base leading-snug text-fg-muted">
                {n > 1
                  ? `${n} lots sont à gagner au tirage au sort, dont :`
                  : n === 1
                    ? "Un lot est à gagner au tirage au sort :"
                    : "Il y a de nombreux lots à gagner au tirage au sort : ne passez pas à côté !"}
              </Dialog.Description>
              {featured && (
                <div className="mt-3" data-decline-prizes>
                  {/* Grand visuel : image entière (contain) sur un fond flou de la même image. */}
                  <figure className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl border border-edge bg-surface-2 shadow-lg shadow-black/30">
                    {prizes.map((p, i) =>
                      p.image_url ? (
                        <div key={p.id} aria-hidden={i !== current % n} className={`absolute inset-0 transition-opacity duration-500 ${i === current % n ? "opacity-100" : "opacity-0"}`}>
                          <Image src={p.image_url} alt="" aria-hidden fill sizes="64px" unoptimized={isLocalMedia(p.image_url)} className="scale-110 object-cover opacity-60 blur-2xl brightness-50" />
                          <Image
                            src={p.image_url}
                            alt={p.name}
                            fill
                            sizes={FEATURE_SIZES}
                            unoptimized={isLocalMedia(p.image_url)}
                            data-decline-feature={i === current % n ? "" : undefined}
                            className="object-contain p-2 drop-shadow-[0_8px_18px_rgba(0,0,0,0.5)]"
                          />
                        </div>
                      ) : (
                        i === current % n && (
                          <span key={p.id} className="absolute inset-0 flex items-center justify-center text-6xl" aria-hidden>
                            🎁
                          </span>
                        )
                      ),
                    )}
                    <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/55 to-transparent px-3 pb-2 pt-8 text-[15px] font-semibold leading-snug text-white" aria-live="polite">
                      <span aria-hidden>🎁 </span>
                      {featured.name}
                    </figcaption>
                  </figure>
                  {n > 1 && (
                    <div className="mt-2 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Choisir un lot">
                      {prizes.map((p, i) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setPaused(true);
                            setCurrent(i);
                          }}
                          aria-label={p.name}
                          aria-current={i === current % n ? "true" : undefined}
                          title={p.name}
                          className={`relative h-12 min-w-11 max-w-14 flex-1 overflow-hidden rounded-lg border-2 bg-surface-2 transition-[border-color,opacity] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/60 ${i === current % n ? "border-brand opacity-100" : "border-edge opacity-70 hover:opacity-100"}`}
                        >
                          {p.image_url ? (
                            <Image src={p.image_url} alt="" fill sizes="56px" unoptimized={isLocalMedia(p.image_url)} className="object-cover" />
                          ) : (
                            <span className="flex h-full items-center justify-center text-xl" aria-hidden>
                              🎁
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2 px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
              <button
                type="button"
                onClick={onParticipate}
                disabled={busy}
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-brand px-5 text-base font-bold text-black shadow-[0_0_24px_rgba(250,204,21,0.25)] transition-[filter] hover:brightness-105 disabled:opacity-60"
              >
                Finalement, je participe
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={busy}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-edge-strong px-5 text-base font-semibold text-fg transition-colors hover:bg-surface-2 disabled:opacity-60"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                Oui, je confirme, je ne participe pas
              </button>
            </div>
          </div>
          <LanternPost lampOnly />
          <Image
            src={withBase("/decor/raffle-mound.png")}
            alt=""
            width={1212}
            height={657}
            unoptimized
            aria-hidden
            className="pointer-events-none absolute right-2 top-full -mt-2 w-[180px] max-w-none select-none drop-shadow-[0_8px_16px_rgba(0,0,0,0.55)] md:-right-[130px] md:w-[300px]"
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
