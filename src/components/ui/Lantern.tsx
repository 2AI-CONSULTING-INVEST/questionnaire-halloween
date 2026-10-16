"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { withBase } from "@/lib/base-path";

// Lanterne du poteau KayKit (public/decor/modal-post.png + modal-lamp.png), partagée par la modale
// du classement (LiveResults) et la modale de vérification des coordonnées (RaffleConfirmDialog).

/**
 * Insectes autour de la lanterne : orbites inclinées et aplaties (vues de biais), vitesses et sens
 * variés ; une partie passe derrière la lanterne. Rayons en px autour du verre.
 */
const MOTHS = [
  { r: 30, d: 2.4, delay: 0, tilt: -12, squash: 0.45, back: false, rev: false },
  { r: 42, d: 3.4, delay: -1.2, tilt: 18, squash: 0.35, back: true, rev: false },
  { r: 24, d: 1.9, delay: -0.6, tilt: 35, squash: 0.6, back: false, rev: true },
  { r: 52, d: 4.2, delay: -2.5, tilt: -28, squash: 0.3, back: true, rev: true },
  { r: 36, d: 2.9, delay: -1.8, tilt: 5, squash: 0.5, back: false, rev: false },
  { r: 46, d: 3.8, delay: -0.3, tilt: -40, squash: 0.4, back: true, rev: false },
];

function Moths({ back = false }: { back?: boolean }) {
  return (
    <span className="absolute left-[47%] top-[70%] motion-reduce:hidden">
      {MOTHS.filter((m) => m.back === back).map((m, i) => (
        <span key={i} className="absolute" style={{ transform: `rotate(${m.tilt}deg) scaleY(${m.squash})` }}>
          <span
            className="absolute animate-[orbit_linear_infinite]"
            style={{ "--r": `${m.r}px`, animationDuration: `${m.d}s`, animationDelay: `${m.delay}s`, animationDirection: m.rev ? "reverse" : "normal" } as CSSProperties}
          >
            <span
              className="block h-[6px] w-[4px] -translate-x-1/2 -translate-y-1/2 animate-[flutter_0.45s_ease-in-out_infinite] rounded-full bg-[#ffeec2] shadow-[0_0_6px_2px_rgba(255,196,110,0.65)]"
              style={{ animationDelay: `${m.delay / 3}s` }}
            />
          </span>
        </span>
      ))}
    </span>
  );
}

/**
 * Lanterne seule, posée sous le bout du bras (cadre mesuré par scripts/3d/modal-props/render.mjs :
 * -1,58 % / 2,6 %, 50,36 % × 17,62 % de l'image du poteau). Elle pivote autour du haut de sa
 * chaîne ; le halo et la flamme, centrés sur le verre, bougent avec elle.
 */
export function Lantern() {
  return (
    <div className="absolute left-[-1.58%] top-[2.6%] h-[17.62%] w-[50.36%]">
      <Moths back />
      <div className="absolute inset-0 origin-[47%_0] motion-safe:animate-[sway_3.6s_ease-in-out_infinite]">
        <span className="absolute left-[47%] top-[76%] aspect-square w-[300%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(255,170,70,0.4),rgba(255,140,40,0.12)_55%,transparent)] motion-safe:animate-[flicker_2.6s_ease-in-out_infinite]" />
        <Image src={withBase("/decor/modal-lamp.png")} alt="" unoptimized width={350} height={631} className="relative h-full w-full select-none drop-shadow-[0_8px_14px_rgba(0,0,0,0.5)]" />
        <span className="absolute left-[47%] top-[77%] aspect-square w-[60%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(255,230,160,0.85),rgba(255,160,60,0.3)_60%,transparent)] mix-blend-screen motion-safe:animate-[flicker_1.7s_ease-in-out_infinite]" />
      </div>
      <Moths />
    </div>
  );
}
