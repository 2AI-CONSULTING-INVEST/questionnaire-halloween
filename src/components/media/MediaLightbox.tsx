"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, Play, VideoOff, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { mediaKind, posterOf, type Decoration } from "@/lib/schema";

/**
 * Visionneuse plein écran : photos et vidéos d'un restaurant, à faire défiler au doigt
 * (défilement natif avec aimantation : fluide sur iPhone et Android), aux flèches ou au clavier.
 * Pensée pour des médias verticaux (format téléphone) : chaque média tient entier à l'écran.
 */
export function MediaLightbox({
  open,
  onOpenChange,
  title,
  items,
  startIndex = 0,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  items: Decoration[];
  startIndex?: number;
  footer?: (close: () => void) => ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/92 backdrop-blur-sm data-[state=open]:animate-[fade-in_200ms_ease-out]" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-50 flex flex-col text-white outline-none"
        >
          {open && <Viewer title={title} items={items} startIndex={startIndex} footer={footer?.(() => onOpenChange(false))} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Viewer({ title, items, startIndex, footer }: { title: string; items: Decoration[]; startIndex: number; footer?: ReactNode }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(startIndex);
  const count = items.length;

  useLayoutEffect(() => {
    const el = track.current;
    if (el) el.scrollLeft = startIndex * el.clientWidth;
  }, [startIndex]);

  const goTo = (i: number) => {
    const el = track.current;
    if (!el) return;
    const next = Math.max(0, Math.min(count - 1, i));
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
  };

  return (
    <div
      className="flex h-full flex-col"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") goTo(index + 1);
        else if (e.key === "ArrowLeft") goTo(index - 1);
      }}
    >
      <header className="flex items-center gap-3 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="min-w-0 flex-1">
          <Dialog.Title className="truncate text-base font-semibold uppercase tracking-wide">{title}</Dialog.Title>
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

      <div className="relative min-h-0 flex-1">
        <div
          ref={track}
          className="no-scrollbar flex h-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
          onScroll={(e) => {
            const el = e.currentTarget;
            setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
          }}
        >
          {items.map((item, i) => (
            <div key={item.id} className="relative flex h-full w-full shrink-0 snap-center items-center justify-center px-2 sm:px-16">
              {mediaKind(item.image_url) === "video" ? (
                <SlideVideo src={item.image_url} active={i === index} />
              ) : (
                <div className="relative h-full w-full">
                  <Image
                    src={item.image_url}
                    alt={`${title} — photo ${i + 1}`}
                    fill
                    sizes="100vw"
                    className="object-contain"
                    draggable={false}
                    loading={Math.abs(i - startIndex) <= 1 ? "eager" : "lazy"}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {count > 1 && (
          <>
            <button
              type="button"
              aria-label="Média précédent"
              onClick={() => goTo(index - 1)}
              disabled={index === 0}
              className="absolute left-3 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20 disabled:opacity-0 [@media(hover:hover)]:flex"
            >
              <ChevronLeft className="h-7 w-7" />
            </button>
            <button
              type="button"
              aria-label="Média suivant"
              onClick={() => goTo(index + 1)}
              disabled={index === count - 1}
              className="absolute right-3 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20 disabled:opacity-0 [@media(hover:hover)]:flex"
            >
              <ChevronRight className="h-7 w-7" />
            </button>
          </>
        )}
      </div>

      <footer className="flex flex-col items-center gap-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        {count > 1 && (
          <div className="flex gap-1.5" aria-hidden>
            {items.map((item, i) => (
              <span key={item.id} className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-brand" : "w-1.5 bg-white/40"}`} />
            ))}
          </div>
        )}
        {footer}
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
