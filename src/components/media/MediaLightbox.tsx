"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, Play, VideoOff, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { isLocalMedia, mediaKind, posterOf, shortName, type Decoration } from "@/lib/schema";

export type LightboxGroup = { id: string; title: string; items: Decoration[] };

/**
 * Visionneuse plein écran : photos et vidéos d'un restaurant, à faire défiler au doigt
 * (défilement natif avec aimantation : fluide sur iPhone et Android), aux flèches ou au clavier.
 * Les restaurants se suivent : sur le dernier média, un petit élan et une étiquette annoncent le
 * restaurant suivant (sur le premier, le précédent) ; glisser encore fait glisser toute la page
 * vers ce restaurant.
 * Pensée pour des médias verticaux (format téléphone) : chaque média tient entier à l'écran.
 */
export function MediaLightbox({
  open,
  onOpenChange,
  groups,
  start,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: LightboxGroup[];
  /** Restaurant (index dans `groups`) et média de départ. */
  start: { group: number; index: number };
  footer?: (groupId: string, close: () => void) => ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/92 backdrop-blur-sm data-[state=open]:animate-[fade-in_200ms_ease-out]" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-50 flex flex-col overflow-hidden text-white outline-none"
        >
          {open && (
            <Viewer
              groups={groups}
              start={start}
              footer={footer && ((groupId) => footer(groupId, () => onOpenChange(false)))}
            />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

type Dir = 1 | -1;
/** Durée du glissement de page entre deux restaurants (sortie, puis entrée). */
const PAGE_MS = 280;

function Viewer({
  groups,
  start,
  footer,
}: {
  groups: LightboxGroup[];
  start: { group: number; index: number };
  footer?: (groupId: string) => ReactNode;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [gi, setGi] = useState(start.group);
  const [index, setIndex] = useState(start.index);
  /** Média où arriver en ouvrant un restaurant (le premier en avançant, le dernier en reculant). */
  const entry = useRef(start.index);
  /** Annonce du restaurant voisin (élan + étiquette), jouée en arrivant sur un bord. */
  const [hint, setHint] = useState<Dir | null>(null);
  /** Décalage de toute la page (px) et animation en cours. */
  const [page, setPage] = useState({ x: 0, animate: false });
  const busy = useRef(false);
  /** Comment on est arrivé sur le média courant : rien (ouverture), défilement, ou changement de page. */
  const arrival = useRef<"open" | "scroll" | Dir>("open");
  const drag = useRef<{ x: number; y: number; dir: Dir | null; dx: number } | null>(null);

  const group = groups[gi];
  const count = group?.items.length ?? 0;
  const prevGroup = groups[gi - 1];
  const nextGroup = groups[gi + 1];

  // Nouveau restaurant : on se place sur le média d'entrée, sans animation.
  useLayoutEffect(() => {
    const el = track.current;
    if (el) el.scrollLeft = entry.current * el.clientWidth;
  }, [gi]);

  // Arrivé (et posé) sur le dernier / premier média après un geste : élan vers le voisin.
  // Après un changement de page, seulement si l'on est déjà au bord dans le sens du voyage.
  useEffect(() => {
    const how = arrival.current;
    if (how === "open") return;
    const atEnd = index === count - 1 && !!nextGroup;
    const atStart = index === 0 && !!prevGroup;
    const dir: Dir | null = how === "scroll" ? (atEnd ? 1 : atStart ? -1 : null) : how === 1 && atEnd ? 1 : how === -1 && atStart ? -1 : null;
    if (!dir) return;
    const t = setTimeout(() => setHint(dir), 450);
    return () => clearTimeout(t);
  }, [index, gi, count, nextGroup, prevGroup]);

  /** Toute la page glisse vers le restaurant voisin. */
  const goGroup = (dir: Dir) => {
    const target = groups[gi + dir];
    if (!target || busy.current) return;
    busy.current = true;
    arrival.current = dir;
    setHint(null);
    const w = window.innerWidth;
    setPage({ x: -dir * w, animate: true });
    setTimeout(() => {
      entry.current = dir > 0 ? 0 : target.items.length - 1;
      setGi(gi + dir);
      setIndex(entry.current);
      setPage({ x: dir * w, animate: false });
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          setPage({ x: 0, animate: true });
          setTimeout(() => (busy.current = false), PAGE_MS);
        }),
      );
    }, PAGE_MS);
  };

  const goTo = (i: number) => {
    if (i < 0) return goGroup(-1);
    if (i > count - 1) return goGroup(1);
    const el = track.current;
    el?.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  // Glisser au-delà du premier / dernier média : la page entière suit le doigt.
  const edgeSwipe = {
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0];
      drag.current = { x: t.clientX, y: t.clientY, dir: null, dx: 0 };
    },
    onTouchMove: (e: React.TouchEvent) => {
      const d = drag.current;
      const el = track.current;
      if (!d || !el || busy.current) return;
      const t = e.touches[0];
      const dx = t.clientX - d.x;
      const dy = t.clientY - d.y;
      if (d.dir === null) {
        if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy)) return;
        const atStart = el.scrollLeft <= 2;
        const atEnd = el.scrollLeft >= el.scrollWidth - el.clientWidth - 2;
        if (dx < 0 && atEnd && nextGroup) d.dir = 1;
        else if (dx > 0 && atStart && prevGroup) d.dir = -1;
        else {
          drag.current = null;
          return;
        }
        setHint(null);
      }
      d.dx = dx;
      setPage({ x: dx * 0.9, animate: false });
    },
    onTouchEnd: () => {
      const d = drag.current;
      drag.current = null;
      if (!d?.dir) return;
      if (Math.abs(d.dx) > window.innerWidth * 0.2) goGroup(d.dir);
      else setPage({ x: 0, animate: true });
    },
  };

  if (!group) return null;

  return (
    <div
      className={`flex h-full flex-col will-change-transform ${hint === 1 ? "motion-safe:animate-nudge-next" : hint === -1 ? "motion-safe:animate-nudge-prev" : ""}`}
      style={{
        transform: page.x ? `translateX(${page.x}px)` : undefined,
        transition: page.animate ? `transform ${PAGE_MS}ms cubic-bezier(0.4, 0, 0.2, 1)` : "none",
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") goTo(index + 1);
        else if (e.key === "ArrowLeft") goTo(index - 1);
      }}
    >
      <header className="flex items-center gap-3 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="min-w-0 flex-1">
          <Dialog.Title className="truncate text-base font-semibold uppercase tracking-wide">{group.title}</Dialog.Title>
          {count > 1 && (
            <p className="text-xs text-white/60" aria-live="polite">
              {index + 1} / {count}
            </p>
          )}
        </div>
        <Dialog.Close
          aria-label="Fermer"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
        >
          <X className="h-6 w-6" />
        </Dialog.Close>
      </header>

      <div className="relative min-h-0 flex-1" {...edgeSwipe}>
        <div
          key={group.id}
          ref={track}
          className="no-scrollbar flex h-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
          onScroll={(e) => {
            const el = e.currentTarget;
            const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
            if (i !== index) {
              arrival.current = "scroll";
              setIndex(i);
              setHint(null);
            }
          }}
        >
          {group.items.map((item, i) => (
            <div key={item.id} className="relative flex h-full w-full shrink-0 snap-center snap-always items-center justify-center px-2 sm:px-16">
              {mediaKind(item.image_url) === "video" ? (
                <SlideVideo src={item.image_url} active={i === index} />
              ) : (
                <div className="relative h-full w-full">
                  <Image
                    src={item.image_url}
                    alt={`${group.title} — photo ${i + 1}`}
                    fill
                    sizes="100vw"
                    unoptimized={isLocalMedia(item.image_url)}
                    className="object-contain"
                    draggable={false}
                    loading={Math.abs(i - index) <= 1 ? "eager" : "lazy"}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Annonce du restaurant voisin, sur le bord vers lequel on glisse */}
        {hint === 1 && nextGroup && (
          <button
            type="button"
            onClick={() => goGroup(1)}
            className="absolute right-0 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded-l-full bg-brand py-2 pl-3 pr-2 text-xs font-bold uppercase text-black shadow-lg shadow-black/40 motion-safe:animate-peek-in"
          >
            {shortName(nextGroup.title)}
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        )}
        {hint === -1 && prevGroup && (
          <button
            type="button"
            onClick={() => goGroup(-1)}
            className="absolute left-0 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded-r-full bg-brand py-2 pl-2 pr-3 text-xs font-bold uppercase text-black shadow-lg shadow-black/40 motion-safe:animate-peek-in-left"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            {shortName(prevGroup.title)}
          </button>
        )}

        <button
          type="button"
          aria-label={index === 0 && prevGroup ? `Restaurant précédent : ${prevGroup.title}` : "Média précédent"}
          onClick={() => goTo(index - 1)}
          disabled={index === 0 && !prevGroup}
          className={`absolute left-3 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20 disabled:opacity-0 [@media(hover:hover)]:flex ${hint === -1 ? "invisible" : ""}`}
        >
          <ChevronLeft className="h-7 w-7" />
        </button>
        <button
          type="button"
          aria-label={index === count - 1 && nextGroup ? `Restaurant suivant : ${nextGroup.title}` : "Média suivant"}
          onClick={() => goTo(index + 1)}
          disabled={index === count - 1 && !nextGroup}
          className={`absolute right-3 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20 disabled:opacity-0 [@media(hover:hover)]:flex ${hint === 1 ? "invisible" : ""}`}
        >
          <ChevronRight className="h-7 w-7" />
        </button>
      </div>

      <footer className="flex flex-col items-center gap-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        {count > 1 && (
          <div className="flex gap-1.5" aria-hidden>
            {group.items.map((item, i) => (
              <span key={item.id} className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-brand" : "w-1.5 bg-white/40"}`} />
            ))}
          </div>
        )}
        {footer?.(group.id)}
      </footer>
    </div>
  );
}

/** Vidéo : affiche + gros bouton lecture ; se met en pause quand on change de média. */
function SlideVideo({ src, active }: { src: string; active: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!active) ref.current?.pause();
  }, [active]);

  if (failed) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 text-center text-white/70">
        <VideoOff className="h-10 w-10" aria-hidden />
        <p>Cette vidéo ne peut pas être lue sur cet appareil.</p>
      </div>
    );
  }

  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <video
        ref={ref}
        src={src}
        poster={posterOf(src)}
        playsInline
        controls={started}
        preload="none"
        onError={() => setFailed(true)}
        onPlay={() => setStarted(true)}
        className="max-h-full max-w-full rounded-lg bg-black object-contain"
      />
      {!started && (
        <button
          type="button"
          aria-label="Lire la vidéo"
          onClick={() => {
            setStarted(true);
            void ref.current?.play().catch(() => setFailed(true));
          }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-brand text-black shadow-[0_0_40px_rgba(250,204,21,0.45)]">
            <Play className="ml-1 h-9 w-9" fill="currentColor" />
          </span>
        </button>
      )}
    </div>
  );
}
