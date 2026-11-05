"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useCallback, useState } from "react";
import { CelebrationConfetti } from "@/components/contest/CelebrationConfetti";
import { MEDAL_THEME, pctLabel } from "@/components/contest/medals";
import { VideoPlayer } from "@/components/media/VideoPlayer";
import { placeLabel, type PodiumSlot } from "@/components/scene/podium";
import { isLocalMedia, mediaKind, shortName } from "@/lib/schema";
import { LanternPost, Mound } from "./ModalDecor";

/**
 * Vidéo d'une place du podium (clic sur sa carte, au mur de la crypte), à la place du classement :
 * même décor (motte, poteau-lanterne), habillé selon la place — or, argent ou bronze (bordure,
 * halo, couronne posée sur le panneau, particules : paillettes d'or, givre d'argent, braises de
 * bronze ; confettis à l'ouverture pour le gagnant). La vidéo ne se télécharge qu'à la lecture.
 */
export function PodiumModal({ slot, media, onClose }: { slot: PodiumSlot | null; media: Record<string, string>; onClose: () => void }) {
  // Dernière place ouverte, gardée pendant le fondu de fermeture.
  const [shown, setShown] = useState(slot);
  if (slot && slot !== shown) setShown(slot);
  const s = slot ?? shown;
  const url = s ? media[s.entry.restaurant_name] : undefined;
  const theme = s ? MEDAL_THEME[s.rank] : null;
  // Format du média affiché : le panneau s'y ajuste.
  const [known, setKnown] = useState<{ url: string; ratio: number } | null>(null);
  const ratio = known && known.url === url ? known.ratio : 16 / 9;
  const onAspect = useCallback((value: number) => url && setKnown({ url, ratio: value }), [url]);

  return (
    <Dialog.Root open={!!slot} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md data-[state=open]:animate-[fade-in_200ms_ease-out]" />
        {s && theme && (
          <Dialog.Content
            aria-describedby={undefined}
            onClick={(e) => !(e.target as Element).closest("[data-board]") && onClose()}
            className="fixed inset-0 z-50 outline-none data-[state=open]:animate-[fade-in_200ms_ease-out] [--chrome:15rem] [--minw:15rem] [@media(max-height:500px)]:[--minw:24rem] [--mw:min(1150px,130vw,110dvh)] [--ridge:calc(var(--mw)*0.22)] [@media(max-height:500px)]:[--chrome:9.5rem] [@media(max-height:500px)]:[--ridge:0px]"
          >
            {/* Lumière de la place (or, argent, bronze) derrière le panneau. */}
            <span aria-hidden className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(60% 55% at 50% 45%, ${theme.halo}, transparent 70%)` }} />
            <Particles place={s.place} color={theme.particle} />
            {s.place === 1 && slot && <CelebrationConfetti cannon={36} rain={24} />}
            <div
              data-board
              // --mh : hauteur du média, une fois retirés le bas du décor, l'en-tête du panneau, la couronne et le bouton Fermer.
              className="absolute bottom-[var(--ridge)] left-4 [--mh:max(6rem,calc(100dvh-var(--ridge)-var(--chrome)))] [--side:5rem] sm:left-1/2 sm:-translate-x-1/2 sm:[--side:2.5rem]"
              style={{ width: `min(100vw - var(--side), 72rem, max(var(--minw), var(--mh) * ${ratio}))` }}
            >
              <LanternPost className="-z-10 bottom-[calc(var(--ridge)*-1)]!" />
              <Dialog.Close
                aria-label="Fermer"
                className="absolute bottom-full left-0 z-20 mb-2 flex h-10 w-10 items-center justify-center rounded-full border border-brand/60 bg-surface text-fg shadow-lg shadow-black/60 transition-colors hover:bg-surface-2"
              >
                <X className="h-5 w-5" />
              </Dialog.Close>
              {/* Couronne posée sur le haut du panneau. */}
              {/* eslint-disable-next-line @next/next/no-img-element -- rendu WebP déjà optimisé (public/decor) */}
              <img
                src={theme.crown}
                alt=""
                aria-hidden
                className={`pointer-events-none absolute left-1/2 top-0 z-20 h-auto -translate-x-1/2 -translate-y-[68%] drop-shadow-[0_10px_22px_rgba(0,0,0,0.6)] ${s.place === 1 ? "w-[min(8.5rem,34vw)]" : "w-[min(6.5rem,26vw)]"} [@media(max-height:500px)]:w-14 [@media(max-height:500px)]:-translate-y-[80%]`}
              />
              <div
                className={`relative flex flex-col overflow-hidden rounded-3xl border-2 bg-surface ${theme.border} ${theme.glow}`}
              >
                <span aria-hidden className={`pointer-events-none absolute inset-0 ${theme.tint}`} />
                <header className="relative border-b border-edge px-5 pb-3 pt-7 text-center [@media(max-height:500px)]:pb-1.5 [@media(max-height:500px)]:pt-3">
                  <span className={`inline-block rounded-full px-3 py-0.5 text-[11px] font-extrabold uppercase tracking-widest shadow ${theme.pill}`}>
                    {s.place === 1 ? "Meilleure décoration Halloween" : placeLabel(s.rank)}
                  </span>
                  <Dialog.Title className={`mt-2 text-xl font-extrabold uppercase leading-tight sm:text-2xl ${theme.text}`}>{shortName(s.entry.restaurant_name)}</Dialog.Title>
                  <p className="mt-0.5 text-xs text-fg-muted">
                    {placeLabel(s.rank)} · {s.entry.votes} vote{s.entry.votes > 1 ? "s" : ""} · {pctLabel(s.entry.share)}
                  </p>
                </header>
                <div className="relative bg-black/70" style={{ aspectRatio: ratio, maxHeight: "var(--mh)" }}>
                  {url && mediaKind(url) === "video" ? (
                    <VideoPlayer key={url} src={url} active={!!slot} onAspect={onAspect} label={`Décoration Halloween de ${shortName(s.entry.restaurant_name)}`} />
                  ) : url ? (
                    <Image src={url} alt={`Décoration Halloween de ${shortName(s.entry.restaurant_name)}`} fill sizes="(min-width: 640px) 512px, 90vw" unoptimized={isLocalMedia(url)} onLoad={(e) => onAspect(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)} className="object-contain" />
                  ) : (
                    <p className="flex h-full items-center justify-center px-6 text-center text-sm text-white/70">Pas de vidéo pour ce restaurant.</p>
                  )}
                </div>
              </div>
              <LanternPost front className="bottom-[calc(var(--ridge)*-1)]!" />
            </div>
            <div className="[@media(max-height:500px)]:hidden">
              <Mound />
            </div>
          </Dialog.Content>
        )}
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Ambiance de la place : paillettes d'or qui scintillent, givre d'argent qui flotte, braises de bronze qui montent. */
function Particles({ place, color }: { place: 1 | 2 | 3; color: string }) {
  const reduce = useReducedMotion();
  const [dots] = useState(() =>
    Array.from({ length: place === 1 ? 26 : 18 }, () => ({ x: Math.random() * 100, y: Math.random() * 100, s: 2 + Math.random() * (place === 1 ? 4 : 3), d: 2 + Math.random() * 3, delay: Math.random() * 3 })),
  );
  if (reduce) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {dots.map((p, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full"
          style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.s, height: p.s, background: color, boxShadow: `0 0 ${p.s * 3}px ${color}` }}
          animate={
            place === 1
              ? { opacity: [0, 1, 0], scale: [0.4, 1.3, 0.4] }
              : place === 2
                ? { opacity: [0, 0.8, 0], x: [0, 14, 0], y: [0, -10, 0] }
                : { opacity: [0, 0.9, 0], y: [0, -60] }
          }
          transition={{ duration: p.d, delay: p.delay, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}
