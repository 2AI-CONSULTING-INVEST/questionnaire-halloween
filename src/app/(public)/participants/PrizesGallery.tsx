"use client";

import { AnimatePresence, motion, useReducedMotion, type PanInfo } from "framer-motion";
import { ChevronLeft, ChevronRight, Trophy, X } from "lucide-react";
import Image from "next/image";
import { Dialog } from "radix-ui";
import { useRef, useState } from "react";
import { Cobweb } from "@/components/questionnaire/RaffleConfirmDialog";
import { withBase } from "@/lib/base-path";
import { isLocalMedia } from "@/lib/schema";
import { BatSwarm, PrizeDecor } from "./PrizeDecor";

export type GalleryPrize = { id: string; name: string; description: string | null; image_url: string | null; winner: string | null };

const card = "rounded-2xl border border-edge bg-surface/90 shadow-lg shadow-black/25 backdrop-blur-sm day:shadow-black/10";
/** Jaune « gagnant » : or sur fond sombre la nuit, ocre très sombre sur les surfaces terre du jour. */
const winnerText = "text-[#f5c542] day:text-[#4a2600]";

/**
 * Image d'un lot. `contain` (modale) : l'image entière, quel que soit son format (portrait ou
 * paysage), sur un fond flou et assombri de la même image qui remplit le cadre sans bandes vides.
 */
function PrizeImage({ prize, sizes, className = "", contain = false }: { prize: GalleryPrize; sizes: string; className?: string; contain?: boolean }) {
  const unoptimized = isLocalMedia(prize.image_url ?? "");
  return (
    <div className={`relative overflow-hidden bg-surface-2 ${className}`}>
      {/* Image non déplaçable : le glisser natif d'image couperait le geste du carrousel (souris). */}
      {prize.image_url ? (
        <>
          {contain && (
            <Image src={prize.image_url} alt="" aria-hidden fill sizes="64px" unoptimized={unoptimized} draggable={false} className="scale-110 select-none object-cover opacity-60 blur-2xl brightness-50" />
          )}
          <Image src={prize.image_url} alt={prize.name} fill sizes={sizes} unoptimized={unoptimized} draggable={false} className={`select-none ${contain ? "object-contain p-3 drop-shadow-[0_10px_24px_rgba(0,0,0,0.5)] sm:p-5" : "object-cover"}`} />
        </>
      ) : (
        <span className="flex h-full w-full items-center justify-center text-5xl" aria-hidden>
          🎁
        </span>
      )}
    </div>
  );
}

/**
 * Lots à gagner : une carte par lot ; un clic l'agrandit en modale (la carte grandit jusqu'à la
 * modale : layoutId de framer-motion), image à gauche et texte à droite (image en haut sur
 * téléphone). La modale est un carrousel : flèches, clavier (← →), glisser au doigt, indicateurs.
 * Décor : le logo long Chamas Tacos (scripts/3d/brand/wordmark.mjs), une toile d'araignée et les
 * rendus 3D de PrizeDecor (badge, citrouilles, squelette joyeux, cadeaux, nuée de chauves-souris).
 * Le pseudo du gagnant s'affiche sur la carte et dans la modale. Animations réduites : pas de zoom.
 */
export function PrizesGallery({ prizes }: { prizes: GalleryPrize[] }) {
  const reduce = useReducedMotion();
  /** Lot affiché dans la modale, et lot d'origine (la modale revient vers sa carte en se fermant). */
  const [index, setIndex] = useState<number | null>(null);
  const [origin, setOrigin] = useState<string | null>(null);
  const [dir, setDir] = useState(0);
  /** Instant d'ouverture : un clic dans le fond juste après (double-clic sur la carte) ne referme pas. */
  const openedAt = useRef(0);
  const n = prizes.length;
  const go = (step: number) => {
    if (index === null || n < 2) return;
    setDir(step);
    setIndex((index + step + n) % n);
  };
  /**
   * Modale en train de se refermer : une carte cliquée pendant ce temps s'ouvre dès la fin de
   * l'animation (rouvrir la modale qui sort afficherait l'ancien lot : AnimatePresence garde l'arbre
   * figé de la sortie).
   */
  const closing = useRef(false);
  /** Une ouverture = un nouvel arbre (clé) : rien de l'ouverture précédente n'est réutilisé. */
  const [session, setSession] = useState(0);
  const pending = useRef<[number, number] | null>(null);
  const open = (i: number, at: number) => {
    if (closing.current) {
      pending.current = [i, at];
      return;
    }
    openedAt.current = at;
    setSession((v) => v + 1);
    setDir(0);
    setIndex(i);
    setOrigin(prizes[i].id);
  };
  const close = () => {
    if (index === null) return;
    closing.current = true;
    setIndex(null);
  };
  const onExitComplete = () => {
    closing.current = false;
    const next = pending.current;
    pending.current = null;
    if (next) open(...next);
  };
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -60 || info.velocity.x < -400) go(1);
    else if (info.offset.x > 60 || info.velocity.x > 400) go(-1);
  };
  const prize = index === null ? null : prizes[index];
  const layout = (id: string) => (reduce ? undefined : `prize-${id}`);

  return (
    <>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {prizes.map((p, i) => (
          <li key={p.id}>
            <motion.button
              type="button"
              layoutId={layout(p.id)}
              onClick={(e) => open(i, e.timeStamp)}
              aria-label={`Voir le lot « ${p.name} » en grand`}
              data-prize={p.id}
              className={`${card} block w-full cursor-pointer overflow-hidden text-left transition-shadow hover:shadow-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/60`}
            >
              <PrizeImage prize={p} className="aspect-[4/3] w-full" sizes="(max-width: 640px) calc(100vw - 2rem), (max-width: 1024px) 50vw, 33vw" />
              <span className="block p-4">
                <span className="block text-base font-semibold text-fg">{p.name}</span>
                {p.description && <span className="mt-1 line-clamp-2 block text-sm leading-snug text-fg-muted">{p.description}</span>}
                {p.winner && <span className={`mt-2 block text-xs font-semibold uppercase tracking-wide ${winnerText}`}>Gagné par {p.winner}</span>}
              </span>
            </motion.button>
          </li>
        ))}
      </ul>

      <Dialog.Root open={prize !== null} onOpenChange={(o) => !o && close()}>
        <AnimatePresence onExitComplete={onExitComplete}>
          {prize && (
            <Dialog.Portal key={session} forceMount>
              <Dialog.Overlay asChild forceMount>
                <motion.div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-[state=closed]:pointer-events-none!" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
              </Dialog.Overlay>
              <Dialog.Content
                forceMount
                aria-describedby={undefined}
                // Fermeture : le focus revient sur la carte du lot affiché, SANS faire défiler la page (sur
                // téléphone, le défilement amenait cette carte sous le doigt qui touchait déjà une autre
                // carte : c'est elle qui s'ouvrait) ; rien si une autre carte vient d'être touchée.
                onCloseAutoFocus={(e) => {
                  e.preventDefault();
                  if (prize && !pending.current) document.querySelector<HTMLElement>(`[data-prize="${prize.id}"]`)?.focus({ preventScroll: true });
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowRight") go(1);
                  else if (e.key === "ArrowLeft") go(-1);
                }}
                // Fermeture « extérieure » de Radix désactivée : la modale couvre tout l'écran (le clic hors du
                // panneau est géré juste en dessous) ; sans cela, la modale encore montée pendant son
                // animation de sortie refermait aussitôt une carte rouverte (clic et focus « dehors »).
                onInteractOutside={(e) => e.preventDefault()}
                // Clic hors du panneau (zone transparente qui le centre) : fermeture ; ignoré dans les 450 ms
                // qui suivent l’ouverture (second clic d’un double-clic sur la carte).
                onPointerDown={(e) => e.target === e.currentTarget && e.timeStamp - openedAt.current > 450 && close()}
                // Pendant l’animation de fermeture, le voile et la modale ne captent plus les clics (« ! » : Radix
                // pose un pointer-events en ligne), une carte peut être rouverte aussitôt.
                className="fixed inset-0 z-50 flex items-center justify-center px-3 py-6 outline-none data-[state=closed]:pointer-events-none! sm:px-6"
              >
                <BatSwarm />
                <motion.div
                  layoutId={origin ? layout(origin) : undefined}
                  initial={reduce ? { opacity: 0 } : undefined}
                  animate={reduce ? { opacity: 1 } : undefined}
                  exit={reduce ? { opacity: 0 } : undefined}
                  transition={{ type: "spring", stiffness: 260, damping: 30 }}
                  className="relative flex max-h-[calc(100dvh-3rem)] w-full max-w-4xl flex-col overflow-visible rounded-3xl border border-brand/40 bg-solid shadow-[0_0_0_1px_rgba(0,0,0,0.4),0_25px_60px_rgba(0,0,0,0.6),0_0_70px_rgba(255,130,30,0.28)] md:h-[min(560px,calc(100dvh-6rem))]"
                  data-prize-modal
                >
                  {/* Logo long Chamas Tacos posé sur le haut du panneau, comme une enseigne. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={withBase("/decor/wordmark.png")}
                    alt=""
                    aria-hidden
                    width={1411}
                    height={267}
                    className="pointer-events-none absolute left-1/2 top-0 z-10 w-[min(86%,460px)] -translate-x-1/2 -translate-y-[62%] select-none drop-shadow-[0_10px_18px_rgba(0,0,0,0.6)]"
                  />
                  <div className="relative min-h-0 flex-1 overflow-hidden rounded-3xl">
                    <Cobweb className="right-0 top-0 z-[1] h-20 w-20 -scale-x-100 sm:h-28 sm:w-28" />
                    {/* Une diapositive à la fois (mode « wait ») : le geste ne peut pas viser celle qui sort. */}
                    <AnimatePresence mode="wait" initial={false} custom={dir}>
                      <motion.div
                        key={prize.id}
                        custom={dir}
                        initial={reduce ? { opacity: 0 } : { opacity: 0, x: dir * 60 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={reduce ? { opacity: 0 } : { opacity: 0, x: dir * -60 }}
                        transition={{ duration: 0.18 }}
                        className="h-full"
                      >
                        {/* Le glisser est porté par un élément à part : animer x et glisser sur le même élément se contrarient. */}
                        <motion.div
                          drag={n > 1 ? "x" : false}
                          dragConstraints={{ left: 0, right: 0 }}
                          dragElastic={0.25}
                          onDragEnd={onDragEnd}
                          className="grid h-full min-h-0 grid-rows-[auto_1fr] overflow-y-auto md:grid-cols-[1.1fr_1fr] md:grid-rows-1"
                        >
                        <PrizeImage prize={prize} contain className="h-[min(48dvh,26rem)] w-full md:h-full" sizes="(max-width: 768px) calc(100vw - 1.5rem), 480px" />
                        <div className="flex min-h-0 flex-col justify-center gap-3 px-5 pb-20 pt-5 sm:px-8 md:pb-16 md:pt-14">
                          <Dialog.Title className="text-2xl leading-snug text-fg sm:text-3xl">{prize.name}</Dialog.Title>
                          {prize.description && <p className="whitespace-pre-line text-base leading-relaxed text-fg-muted">{prize.description}</p>}
                          {prize.winner ? (
                            <p className={`mt-1 inline-flex items-center gap-2 text-base font-semibold ${winnerText}`}>
                              <Trophy className="h-5 w-5" aria-hidden /> Gagné par <span className="text-fg">{prize.winner}</span>
                            </p>
                          ) : (
                            <p className="mt-1 text-sm text-fg-muted">À gagner au tirage au sort en direct&nbsp;🎃</p>
                          )}
                        </div>
                        </motion.div>
                      </motion.div>
                    </AnimatePresence>
                  </div>
                  <PrizeDecor />
                  {/* Navigation du carrousel : sous le texte ; sur grand écran, centrée dans la colonne texte
                      (grille 1,1fr / 1fr : elle commence à 52,4 %), jamais sur l'image. */}
                  {n > 1 && (
                    <div className="absolute inset-x-0 bottom-3 z-10 flex items-center justify-center gap-3 md:left-[52.4%]">
                      <button type="button" onClick={() => go(-1)} aria-label="Lot précédent" className="flex h-11 w-11 items-center justify-center rounded-full border border-edge-strong bg-surface text-fg shadow-md transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/60">
                        <ChevronLeft className="h-5 w-5" aria-hidden />
                      </button>
                      <div className="flex items-center gap-1" role="group" aria-label="Choisir un lot">
                        {prizes.map((p, i) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setDir(i > (index ?? 0) ? 1 : -1);
                              setIndex(i);
                            }}
                            aria-label={`Lot ${i + 1} sur ${n} : ${p.name}`}
                            aria-current={i === index ? "true" : undefined}
                            className="flex h-11 w-6 items-center justify-center focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/60"
                          >
                            <span className={`block h-2.5 rounded-full transition-all ${i === index ? "w-5 bg-brand" : "w-2.5 bg-fg-muted/50"}`} />
                          </button>
                        ))}
                      </div>
                      <button type="button" onClick={() => go(1)} aria-label="Lot suivant" className="flex h-11 w-11 items-center justify-center rounded-full border border-edge-strong bg-surface text-fg shadow-md transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/60">
                        <ChevronRight className="h-5 w-5" aria-hidden />
                      </button>
                    </div>
                  )}
                  <Dialog.Close asChild>
                    <button type="button" aria-label="Fermer" className="absolute right-2 top-2 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-edge-strong bg-surface text-fg shadow-md transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/60">
                      <X className="h-5 w-5" aria-hidden />
                    </button>
                  </Dialog.Close>
                </motion.div>
              </Dialog.Content>
            </Dialog.Portal>
          )}
        </AnimatePresence>
      </Dialog.Root>
    </>
  );
}
