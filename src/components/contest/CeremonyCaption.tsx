"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { PodiumSlot } from "@/components/scene/podium";
import { placeLabel } from "@/components/scene/podium";
import { shortName } from "@/lib/schema";
import { MEDAL_THEME, pctLabel } from "./medals";

type Step = 1 | 2 | 3 | "drumroll" | "start" | null;

/**
 * Légendes de la cérémonie du podium, en haut de l'écran (le panneau de la crypte reste visible) :
 * chaque place dévoilée (couronne, rang, restaurant, votes), le suspense avant le gagnant, puis
 * « Meilleure décoration Halloween ».
 */
export function CeremonyCaption({ step, slots }: { step: Step; slots: PodiumSlot[] }) {
  const slot = typeof step === "number" ? slots.find((s) => s.place === step) : undefined;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[max(6rem,calc(env(safe-area-inset-top)+5.5rem))] z-30 flex justify-center px-4" aria-live="assertive">
      <AnimatePresence mode="wait">
        {step === "drumroll" && (
          <motion.p
            key="drumroll"
            initial={{ opacity: 0, y: -12, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 1.08, filter: "blur(6px)" }}
            transition={{ duration: 0.45 }}
            className="rounded-3xl bg-black/45 px-6 py-4 text-center text-xl font-bold text-white backdrop-blur-sm sm:text-3xl"
          >
            Et la meilleure décoration Halloween est
            <motion.span animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 1, repeat: Infinity }}>
              …
            </motion.span>
          </motion.p>
        )}
        {slot && (
          <motion.div
            key={`place-${slot.place}`}
            initial={{ opacity: 0, y: -24, scale: 0.86, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -16, scale: 0.94, filter: "blur(6px)" }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className={`flex max-w-[min(32rem,100%)] flex-col items-center rounded-3xl bg-black/45 text-center backdrop-blur-sm ${slot.place === 1 ? "px-7 pb-5 pt-2" : "px-6 pb-4 pt-1.5"}`}
          >
            <motion.img
              src={MEDAL_THEME[slot.rank].crown}
              alt=""
              aria-hidden
              initial={{ y: -40, rotate: -18, opacity: 0 }}
              animate={{ y: 0, rotate: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 320, damping: 11, delay: 0.15 }}
              className={`-mt-9 h-auto drop-shadow-[0_8px_18px_rgba(0,0,0,0.6)] ${slot.place === 1 ? "w-28 sm:w-36" : "w-20 sm:w-24"}`}
            />
            <span className={`mt-1 rounded-full px-3 py-0.5 text-xs font-extrabold uppercase tracking-widest shadow sm:text-sm ${MEDAL_THEME[slot.rank].pill}`}>
              {slot.place === 1 ? "Meilleure décoration Halloween" : placeLabel(slot.rank)}
            </span>
            <span
              className={`mt-2 font-extrabold uppercase leading-tight ${MEDAL_THEME[slot.rank].text} ${slot.place === 1 ? "text-3xl sm:text-5xl" : "text-2xl sm:text-4xl"}`}
              style={{ textShadow: `0 0 24px ${MEDAL_THEME[slot.rank].halo}` }}
            >
              {shortName(slot.entry.restaurant_name)}
            </span>
            <span className="mt-1 text-sm text-white/80">
              {slot.entry.votes} vote{slot.entry.votes > 1 ? "s" : ""} · {pctLabel(slot.entry.share)}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
