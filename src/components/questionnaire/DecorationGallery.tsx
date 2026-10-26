"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Check, ChevronLeft, ChevronRight, Expand, Film, Play } from "lucide-react";
import { RadioGroup } from "radix-ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { holdSound } from "@/components/sound/engine";
import { MediaLightbox } from "@/components/media/MediaLightbox";
import { isLocalMedia, mediaKind, shortName, thumbOf, type DecorationGroup } from "@/lib/schema";
import { KeyBadge } from "./ui";

export const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Question « meilleure décoration » : une carte par restaurant (choix unique).
 * Chaque carte fait défiler ses photos / vidéos au doigt ; l'icône « agrandir » ouvre
 * la visionneuse plein écran (qui enchaîne les restaurants), d'où l'on peut aussi voter.
 * Une fois un choix fait, les autres cartes sont grisées ; toucher la coche verte annule le choix.
 * Si le média affiché du restaurant choisi est une vidéo, elle se lance dans la carte, avec son :
 * le son du site s'efface pendant ce temps (voir `holdSound`).
 */
export function DecorationGallery({
  groups,
  value,
  onChange,
  labelledBy,
}: {
  groups: DecorationGroup[];
  /** Média voté (id de la couverture d'un restaurant). */
  value: string | null;
  /** Restaurant choisi (id de sa couverture), ou `null` pour annuler le choix. */
  onChange: (groupId: string | null) => void;
  labelledBy: string;
}) {
  const [viewer, setViewer] = useState<{ group: number; index: number } | null>(null);
  const selectedGroup = groups.find((g) => g.items.some((d) => d.id === value))?.id ?? "";
  const lightboxGroups = useMemo(() => groups.map((g) => ({ id: g.id, title: g.restaurant_name, items: g.items })), [groups]);

  return (
    <>
      <RadioGroup.Root
        value={selectedGroup}
        onValueChange={onChange}
        aria-labelledby={labelledBy}
        aria-required
        className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3"
      >
        {groups.map((g, i) => (
          <DecorationCard
            key={g.id}
            group={g}
            letter={LETTERS[i]}
            eager={i < 4}
            selected={g.id === selectedGroup}
            dimmed={selectedGroup !== "" && g.id !== selectedGroup}
            paused={viewer !== null}
            onExpand={(index) => setViewer({ group: i, index })}
            onDeselect={() => onChange(null)}
          />
        ))}
      </RadioGroup.Root>

      <MediaLightbox
        open={viewer !== null}
        onOpenChange={(open) => !open && setViewer(null)}
        groups={lightboxGroups}
        start={viewer ?? { group: 0, index: 0 }}
        footer={(groupId, close) => {
          const g = groups.find((x) => x.id === groupId);
          return (
            g && (
              <button
                type="button"
                onClick={() => {
                  onChange(g.id);
                  close();
                }}
                className={`inline-flex min-h-12 w-full max-w-sm items-center justify-center gap-2 rounded-full px-6 text-lg font-bold transition-[filter] ${
                  g.id === selectedGroup ? "bg-success text-white" : "bg-brand text-black hover:brightness-105"
                }`}
              >
                {g.id === selectedGroup ? (
                  <>
                    <Check className="h-5 w-5" aria-hidden /> Votre choix
                  </>
                ) : (
                  `Voter pour ${shortName(g.restaurant_name)}`
                )}
              </button>
            )
          );
        }}
      />
    </>
  );
}

function DecorationCard({
  group,
  letter,
  selected,
  dimmed,
  eager,
  paused,
  onExpand,
  onDeselect,
}: {
  group: DecorationGroup;
  letter: string;
  selected: boolean;
  /** Un autre restaurant est choisi : carte légèrement grisée. */
  dimmed: boolean;
  eager: boolean;
  /** La visionneuse est ouverte : la vidéo de la carte se tait. */
  paused: boolean;
  onExpand: (index: number) => void;
  onDeselect: () => void;
}) {
  const items = group.items;
  const count = items.length;
  const [index, setIndex] = useState(0);
  const [offset, setOffset] = useState(0);
  const [broken, setBroken] = useState<Set<string>>(() => new Set());
  const drag = useRef<{ x: number; y: number; dx: number; active: boolean } | null>(null);
  const swiped = useRef(false);
  const name = shortName(group.restaurant_name);

  // Vidéo du média affiché, lue dans la carte tant que le restaurant est choisi.
  const video = useRef<HTMLVideoElement>(null);
  const [videoFailed, setVideoFailed] = useState<string | null>(null);
  const [needsTap, setNeedsTap] = useState(false);
  const current = items[index];
  const playing = selected && !paused && mediaKind(current.image_url) === "video" && videoFailed !== current.image_url;
  const play = () => {
    void video.current?.play().then(
      () => setNeedsTap(false),
      () => setNeedsTap(true), // lecture avec son refusée sans geste direct (iOS) : bouton « lire »
    );
  };
  useEffect(() => {
    if (!playing) return;
    const el = video.current;
    holdSound(true);
    play();
    return () => {
      el?.pause();
      setNeedsTap(false);
      holdSound(false);
    };
  }, [playing, current.id]);

  const go = (i: number) => setIndex(Math.max(0, Math.min(count - 1, i)));

  // Glisser horizontalement fait défiler les médias ; un simple appui sélectionne la carte.
  const swipe = {
    onPointerDown: (e: React.PointerEvent) => {
      if (count > 1) drag.current = { x: e.clientX, y: e.clientY, dx: 0, active: false };
    },
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
      const d = drag.current;
      if (!d) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (!d.active) {
        if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
          d.active = true;
          e.currentTarget.setPointerCapture(e.pointerId);
        } else if (Math.abs(dy) > 10) {
          drag.current = null;
          return;
        }
      }
      if (d.active) {
        // Résistance aux extrémités.
        const atEdge = (index === 0 && dx > 0) || (index === count - 1 && dx < 0);
        d.dx = atEdge ? dx * 0.3 : dx;
        setOffset(d.dx);
      }
    },
    onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => {
      const d = drag.current;
      drag.current = null;
      if (!d?.active) return;
      swiped.current = true;
      const w = e.currentTarget.clientWidth;
      if (d.dx < -w * 0.18) go(index + 1);
      else if (d.dx > w * 0.18) go(index - 1);
      setOffset(0);
    },
    onPointerCancel: () => {
      drag.current = null;
      setOffset(0);
    },
    onClickCapture: (e: React.MouseEvent) => {
      if (swiped.current) {
        swiped.current = false;
        e.preventDefault();
        e.stopPropagation();
      }
    },
  };

  return (
    <div className="relative">
      <RadioGroup.Item
        value={group.id}
        aria-label={`${group.restaurant_name}${count > 1 ? `, ${count} médias` : ""}`}
        className={`block w-full overflow-hidden rounded-2xl border bg-surface text-left shadow-lg shadow-black/20 transition-[border-color,box-shadow,opacity,filter] duration-300 ${
          selected ? "border-brand ring-[3px] ring-brand" : "border-edge hover:border-edge-strong"
        } ${dimmed ? "opacity-60 grayscale-[70%] hover:opacity-85 hover:grayscale-[35%]" : ""}`}
      >
        <div className="relative aspect-[3/4] w-full touch-pan-y select-none overflow-hidden bg-surface-2" {...swipe}>
          <div
            className="flex h-full"
            style={{
              transform: `translateX(calc(${-index * 100}% + ${offset}px))`,
              transition: offset ? "none" : "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            {items.map((item, i) => {
              const isVideo = mediaKind(item.image_url) === "video";
              const src = thumbOf(item);
              return (
                <div key={item.id} className="relative h-full w-full shrink-0">
                  {broken.has(src) ? (
                    <div className="flex h-full items-center justify-center text-fg-muted">
                      <Film className="h-10 w-10" aria-hidden />
                    </div>
                  ) : (
                    <Image
                      src={src}
                      alt={`Décoration Halloween — ${group.restaurant_name}${count > 1 ? ` (${i + 1}/${count})` : ""}`}
                      fill
                      sizes="(min-width: 1024px) 300px, (min-width: 640px) 45vw, 48vw"
                      unoptimized={isLocalMedia(src)}
                      className="object-cover"
                      draggable={false}
                      loading={eager && i === 0 ? "eager" : "lazy"}
                      onError={() => setBroken((b) => new Set(b).add(src))}
                    />
                  )}
                  {isVideo && playing && i === index && (
                    <video
                      key={item.id}
                      ref={video}
                      src={item.image_url}
                      poster={src}
                      playsInline
                      loop
                      preload="auto"
                      onError={() => setVideoFailed(item.image_url)}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  )}
                  {isVideo && !(playing && i === index && !needsTap) && (
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm">
                        <Play className="ml-0.5 h-6 w-6" fill="currentColor" aria-hidden />
                      </span>
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/60 to-transparent" />
          {count > 1 && (
            <div className="pointer-events-none absolute inset-x-0 bottom-2.5 flex justify-center gap-1.5" aria-hidden>
              {items.map((item, i) => (
                <span key={item.id} className={`h-1.5 rounded-full shadow transition-all ${i === index ? "w-4 bg-white" : "w-1.5 bg-white/55"}`} />
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 p-2.5 sm:p-3">
          <KeyBadge letter={letter} active={selected} className="hidden sm:inline-flex" />
          <span className="min-w-0">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-fg-muted">Chamas Tacos</span>
            <span className="block truncate text-sm font-bold uppercase text-fg">{name}</span>
          </span>
        </div>
      </RadioGroup.Item>

      {/* Commandes posées sur la carte (hors du bouton de sélection) */}
      <div className="pointer-events-none absolute inset-x-0 top-0 aspect-[3/4]">
        {needsTap && (
          <button
            type="button"
            onClick={play}
            aria-label={`Lire la vidéo (${group.restaurant_name})`}
            className="pointer-events-auto absolute inset-0"
          />
        )}
        {selected && (
          <motion.button
            type="button"
            onClick={onDeselect}
            aria-label={`Annuler mon choix (${group.restaurant_name})`}
            title="Annuler mon choix"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 14 }}
            className="pointer-events-auto absolute left-1.5 top-1.5 flex h-10 w-10 items-center justify-center rounded-full bg-success text-white shadow-lg ring-2 ring-black/20"
          >
            <Check className="h-5 w-5" aria-hidden />
          </motion.button>
        )}
        <button
          type="button"
          onClick={() => onExpand(index)}
          aria-label={`Voir en grand — ${group.restaurant_name}`}
          className="pointer-events-auto absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/75"
        >
          <Expand className="h-4.5 w-4.5" aria-hidden />
        </button>
        {count > 1 && (
          <>
            <button
              type="button"
              tabIndex={-1}
              aria-hidden
              onClick={() => go(index - 1)}
              className={`pointer-events-auto absolute left-1.5 top-1/2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white transition-opacity hover:bg-black/70 [@media(hover:hover)]:flex ${index === 0 ? "invisible" : ""}`}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              tabIndex={-1}
              aria-hidden
              onClick={() => go(index + 1)}
              className={`pointer-events-auto absolute right-1.5 top-1/2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white transition-opacity hover:bg-black/70 [@media(hover:hover)]:flex ${index === count - 1 ? "invisible" : ""}`}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
