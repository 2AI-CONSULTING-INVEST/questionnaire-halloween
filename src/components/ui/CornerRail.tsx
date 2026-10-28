"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Volume2, VolumeX, X } from "lucide-react";
import Image from "next/image";
import { Popover } from "radix-ui";
import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { isDemoTab, subscribeDemoTab } from "@/components/questionnaire/demo";
import {
  getShownVolume,
  getSoundPrefs,
  isSoundStarted,
  isVideoPlaying,
  serverSoundPrefs,
  setSoundMuted,
  setSoundVolume,
  subscribeSound,
  unlockSound,
} from "@/components/sound/engine";
import { withBase } from "@/lib/base-path";
import { syncedNow } from "@/lib/clock";
import { readNextVote, setNextVote, subscribeNextVote } from "@/lib/next-vote";

const two = (n: number) => String(n).padStart(2, "0");
/** Le compte à rebours ne s'ouvre tout seul qu'une fois par onglet et par échéance (sessionStorage). */
const SHOWN_KEY = "hw-timer-shown";
function wasShown(target: number) {
  try {
    return sessionStorage.getItem(SHOWN_KEY) === String(target);
  } catch {
    return false;
  }
}
function markShown(target: number | null) {
  try {
    if (target !== null) sessionStorage.setItem(SHOWN_KEY, String(target));
  } catch {
    /* il se rouvrira à la prochaine page */
  }
}
/** « 8 heures 29 minutes 12 secondes » (singulier jusqu'à 1, espaces insécables ; heures omises à 0). */
const unit = (n: number, w: string) => `${n} ${w}${n > 1 ? "s" : ""}`;
const spelled = (h: number, m: number, s: number) => [h > 0 && unit(h, "heure"), (h > 0 || m > 0) && unit(m, "minute"), unit(s, "seconde")].filter(Boolean).join(" ");
/** Languette collée au bord droit de l'écran (cible ≥ 44 px). */
const TAB = "pointer-events-auto flex h-11 items-center rounded-l-xl border border-r-0 shadow-md shadow-black/25 backdrop-blur-sm transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/60";

/**
 * Languettes empilées en haut à droite des pages publiques, sous l'indicateur d'étape et le statut
 * de la crypte (et sous le bandeau du tirage quand il est affiché : voir globals.css, .hw-rail) :
 * le compte à rebours jusqu'au prochain vote, puis le son.
 */
export function CornerRail() {
  return (
    <div className="hw-rail pointer-events-none fixed right-0 z-40 flex flex-col items-end gap-2">
      <NextVoteTimer />
      <SoundControl />
    </div>
  );
}

/**
 * Compte à rebours jusqu'au prochain vote (minuit à Paris), affiché tant que le vote du jour est
 * fait : chiffres en HTML sur un bouclier KayKit (scripts/3d/raffle-props, jeu « timer ») et la phrase
 * « Vous pourrez à nouveau voter… dans 8 heures 29 minutes 12 secondes ». Il s'ouvre tout seul une
 * fois par onglet, se replie au bout de 6 s en une languette qui le rouvre ; on peut aussi le refermer.
 * À zéro il disparaît (l'écran « déjà voté » rouvre le vote de lui-même).
 */
function NextVoteTimer() {
  const demo = useSyncExternalStore(subscribeDemoTab, isDemoTab, () => false);
  const target = useSyncExternalStore(subscribeNextVote, () => readNextVote(demo), () => null);
  const [now, setNow] = useState(0);
  /** Choix de l'utilisateur (null : automatique : ouvert la première fois, replié ensuite). */
  const [manual, setManual] = useState<"open" | "closed" | null>(null);
  const reduce = useReducedMotion();
  const open = target !== null && (manual === "open" || (manual === null && !wasShown(target)));

  useEffect(() => {
    if (target === null) return;
    const tick = () => {
      const t = syncedNow(); // calé sur l'heure du serveur, comme l'écran « déjà voté »
      setNow(t);
      if (t >= target) setNextVote(null, demo);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target, demo]);

  // Repli automatique (6 s après l'ouverture).
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => {
      markShown(target);
      setManual("closed");
    }, 6000);
    return () => clearTimeout(id);
  }, [open, target]);

  if (target === null || now === 0) return null;
  const total = Math.max(0, Math.ceil((target - now) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const left = spelled(h, m, s);
  const label = `Vous pourrez à nouveau voter pour le restaurant le mieux décoré dans ${left}`;
  const anim = reduce ? { initial: false, animate: { opacity: 1 }, exit: { opacity: 0, transition: { duration: 0 } } } : { initial: { x: 40, opacity: 0 }, animate: { x: 0, opacity: 1 }, exit: { x: 40, opacity: 0 } };

  return (
    <AnimatePresence mode="wait" initial={false}>
      {open ? (
        <motion.div key="open" {...anim} transition={{ duration: 0.25 }} className="pointer-events-auto relative mr-2 flex flex-col items-center" data-hw-timer="open">
          <div role="timer" aria-live="off" aria-label={label} className="relative h-[104px] w-[104px] drop-shadow-[0_8px_14px_rgba(0,0,0,0.5)] sm:h-[124px] sm:w-[124px]">
            <Image src={withBase("/decor/timer-shield.png")} alt="" width={686} height={686} unoptimized className="h-full w-full select-none" />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-black/75 px-1.5 py-0.5 font-mono text-[15px] font-bold tabular-nums leading-tight text-brand ring-1 ring-brand/40 sm:text-lg">
              {two(h)}:{two(m)}:{two(s)}
            </span>
          </div>
          <p aria-hidden className="mt-1 w-[200px] rounded-xl bg-black/80 px-2.5 py-1.5 text-center text-xs leading-snug text-white/95 shadow-md sm:w-[230px] sm:text-[13px]">
            Vous pourrez à nouveau voter pour le restaurant le mieux décoré dans <strong className="font-bold tabular-nums text-brand">{left}</strong>
          </p>
          <button
            type="button"
            onClick={() => {
              markShown(target);
              setManual("closed");
            }}
            aria-label="Replier le compte à rebours"
            className="absolute -left-3 -top-3 flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/60"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full border border-edge-strong bg-solid text-fg shadow-md">
              <X className="h-4 w-4" aria-hidden />
            </span>
          </button>
        </motion.div>
      ) : (
        <motion.button
          key="tab"
          {...anim}
          transition={{ duration: 0.2 }}
          type="button"
          onClick={() => setManual("open")}
          aria-label={`Afficher le compte à rebours. ${label}`}
          data-hw-timer="tab"
          className={`${TAB} gap-1.5 border-edge bg-surface/85 pl-1.5 pr-2.5 hover:bg-surface-2`}
        >
          <Image src={withBase("/decor/timer-shield.png")} alt="" width={686} height={686} unoptimized className="h-7 w-7 select-none" />
          <span className="font-mono text-xs font-bold tabular-nums text-brand day:text-fg">
            {h}:{two(m)}
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}

/**
 * Panneau du son, derrière une languette transparente : coupure et volume (mémorisés). Le son ne
 * démarre qu'à la première interaction avec la page (règles d'autoplay des navigateurs).
 */
function SoundControl() {
  const prefs = useSyncExternalStore(subscribeSound, getSoundPrefs, serverSoundPrefs);
  const started = useSyncExternalStore(subscribeSound, isSoundStarted, () => false);
  const volume = useSyncExternalStore(subscribeSound, getShownVolume, () => serverSoundPrefs().volume);
  const video = useSyncExternalStore(subscribeSound, isVideoPlaying, () => false);
  const id = useId();

  // Première interaction (n'importe où) : démarrage en fondu.
  useEffect(() => {
    if (started) return;
    const go = () => unlockSound();
    const opts = { capture: true, passive: true } as const;
    window.addEventListener("pointerdown", go, opts);
    window.addEventListener("keydown", go, opts);
    return () => {
      window.removeEventListener("pointerdown", go, opts);
      window.removeEventListener("keydown", go, opts);
    };
  }, [started]);

  const off = prefs.muted || volume === 0;
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label="Réglages du son"
          data-hw-sound="tab"
          className={`${TAB} w-11 justify-center border-white/20 bg-black/20 text-white/85 hover:bg-black/35 day:border-edge day:bg-surface/40 day:text-fg day:hover:bg-surface/65`}
        >
          {off ? <VolumeX className="h-5 w-5" aria-hidden /> : <Volume2 className="h-5 w-5" aria-hidden />}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="left"
          align="start"
          sideOffset={8}
          collisionPadding={12}
          data-hw-sound="panel"
          className="z-50 w-64 rounded-2xl border border-edge bg-solid/95 p-4 text-fg shadow-xl shadow-black/40 backdrop-blur data-[state=open]:animate-[fade-in_150ms_ease-out]"
        >
          <p className="text-sm font-bold">Son</p>
          <button
            type="button"
            aria-pressed={prefs.muted}
            onClick={() => setSoundMuted(!prefs.muted)}
            className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-edge-strong px-4 text-sm font-semibold transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/60"
          >
            {prefs.muted ? <Volume2 className="h-4 w-4" aria-hidden /> : <VolumeX className="h-4 w-4" aria-hidden />}
            {prefs.muted ? "Remettre le son" : "Couper le son"}
          </button>
          <label htmlFor={`${id}-vol`} className="mt-4 block text-xs font-semibold uppercase tracking-wide text-fg-muted">
            {video ? "Volume de la vidéo" : "Volume"}
          </label>
          <input
            id={`${id}-vol`}
            type="range"
            min={0}
            max={100}
            step={5}
            value={Math.round(volume * 100)}
            aria-valuetext={`${Math.round(volume * 100)} %`}
            disabled={prefs.muted}
            onChange={(e) => setSoundVolume(Number(e.target.value) / 100)}
            className="mt-2 h-11 w-full cursor-pointer accent-[var(--color-brand)] disabled:cursor-not-allowed disabled:opacity-50"
          />
          {!started && !prefs.muted && <p className="mt-1 text-xs text-fg-muted">Le son démarre doucement au premier clic sur la page.</p>}
          <p className="mt-3 border-t border-edge pt-3 text-[11px] leading-snug text-fg-muted">
            Musiques&nbsp;: «&nbsp;Diabolus&nbsp;», Geoff Harvey,{" "}
            <a href="https://www.purple-planet.com" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-fg">
              Purple Planet Music
            </a>
            &nbsp;; «&nbsp;Background Horror Music&nbsp;», Soundore. Bruitages synthétisés.
          </p>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
