"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";

const COLORS = ["#FACC15", "#FF7A1A", "#8B5CF6", "#10B981", "#F3E9D2", "#EF4444", "#38BDF8"];

type Piece = { from: "left" | "right" | "top"; x: number; dx: number; peak: number; delay: number; duration: number; rotate: number; color: string; w: number; h: number };

function makePieces(cannon: number, rain: number): Piece[] {
  const r = (a: number, b: number) => a + Math.random() * (b - a);
  const pieces: Piece[] = [];
  for (let i = 0; i < cannon; i++) {
    const from = i % 2 ? "right" : "left";
    pieces.push({ from, x: 0, dx: r(18, 62), peak: r(45, 85), delay: r(0, 0.35), duration: r(2.6, 3.8), rotate: r(-900, 900), color: COLORS[i % COLORS.length], w: r(6, 11), h: r(9, 16) });
  }
  for (let i = 0; i < rain; i++) {
    pieces.push({ from: "top", x: r(0, 100), dx: r(-8, 8), peak: 0, delay: r(0.2, 1.8), duration: r(2.8, 4.4), rotate: r(-720, 720), color: COLORS[i % COLORS.length], w: r(6, 10), h: r(9, 14) });
  }
  return pieces;
}

/**
 * Confettis « de partout » (gagnant du podium) : deux canons dans les coins bas de l'écran qui
 * tirent vers le centre, et une pluie depuis le haut. Une seule salve ; rien en mouvement réduit.
 */
export function CelebrationConfetti({ cannon = 70, rain = 50 }: { cannon?: number; rain?: number }) {
  const reduce = useReducedMotion();
  const [pieces] = useState(() => makePieces(cannon, rain));
  if (reduce) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      {pieces.map((p, i) =>
        p.from === "top" ? (
          <motion.span
            key={i}
            className="absolute top-0 block rounded-[2px]"
            style={{ left: `${p.x}%`, width: p.w, height: p.h, background: p.color }}
            initial={{ y: -30, x: 0, rotate: 0, opacity: 1 }}
            animate={{ y: "105vh", x: `${p.dx}vw`, rotate: p.rotate, opacity: [1, 1, 0] }}
            transition={{ duration: p.duration, delay: p.delay, ease: "easeIn" }}
          />
        ) : (
          <motion.span
            key={i}
            className="absolute bottom-0 block rounded-[2px]"
            style={{ [p.from]: 0, width: p.w, height: p.h, background: p.color }}
            initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
            animate={{
              x: [0, `${(p.from === "left" ? 1 : -1) * p.dx * 0.7}vw`, `${(p.from === "left" ? 1 : -1) * p.dx}vw`],
              y: [0, `-${p.peak}vh`, "12vh"],
              rotate: p.rotate,
              opacity: [1, 1, 0],
            }}
            transition={{ duration: p.duration, delay: p.delay, times: [0, 0.32, 1], ease: ["easeOut", "easeIn"] }}
          />
        ),
      )}
    </div>
  );
}
