"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";

const COLORS = ["#FACC15", "#FF7A1A", "#111111", "#8B5CF6", "#10B981", "#F3E9D2"];

type Piece = { x: number; delay: number; duration: number; rotate: number; color: string; w: number; h: number; drift: number };

function makePieces(n: number): Piece[] {
  return Array.from({ length: n }, (_, i) => ({
    x: Math.random() * 100,
    delay: Math.random() * 0.6,
    duration: 2.4 + Math.random() * 1.8,
    rotate: (Math.random() - 0.5) * 720,
    color: COLORS[i % COLORS.length],
    w: 6 + Math.random() * 6,
    h: 10 + Math.random() * 8,
    drift: (Math.random() - 0.5) * 120,
  }));
}

/** Pluie de confettis (Framer Motion), une seule fois à l'affichage. */
export function Confetti({ count = 70 }: { count?: number }) {
  const reduce = useReducedMotion();
  const [pieces] = useState(() => makePieces(count));
  if (reduce) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      {pieces.map((p, i) => (
        <motion.span
          key={i}
          className="absolute top-0 block rounded-[2px]"
          style={{ left: `${p.x}%`, width: p.w, height: p.h, background: p.color }}
          initial={{ y: -40, x: 0, rotate: 0, opacity: 1 }}
          animate={{ y: "105vh", x: p.drift, rotate: p.rotate, opacity: [1, 1, 0] }}
          transition={{ duration: p.duration, delay: p.delay, ease: "easeIn" }}
        />
      ))}
    </div>
  );
}
