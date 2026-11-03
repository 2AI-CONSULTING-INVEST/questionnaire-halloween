"use client";

import Image from "next/image";
import { Lantern } from "@/components/ui/Lantern";
import { withBase } from "@/lib/base-path";

/**
 * Décor des modales de la crypte (classement, vidéo d'une place du podium) : motte de terre au bas
 * de l'écran et poteau-lanterne planté à droite du panneau (rendus KayKit, scripts/3d/modal-props).
 */

/**
 * Poteau-lanterne (rendu KayKit, mât allongé) planté dans la motte à droite du panneau.
 * Hauteur liée au panneau : de 6 % au-dessus de lui (24 % sur mobile : la lanterne pend alors
 * au-dessus) jusqu'à 6 % sous son bord (pied planté dans la motte). Mât à 83 % de la largeur.
 * Deux plans : le poteau derrière le panneau ; devant, la lanterne (image à part, accrochée sous le
 * bout du bras) qui se balance, avec son halo et les insectes qui tournent autour.
 */
export function LanternPost({ front = false, className = "" }: { front?: boolean; className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute -bottom-[6%] -top-[24%] sm:-top-[6%] right-0 translate-x-[calc(17%+22px)] sm:translate-x-[calc(17%+110px)] ${front ? "z-10" : ""} ${className}`}
    >
      {/* Devant, l'image (invisible) ne sert qu'à donner au plan la taille du poteau. */}
      <Image
        src={withBase("/decor/modal-post.png")}
        alt=""
        unoptimized
        width={695}
        height={3581}
        className={`h-full w-auto max-w-none select-none drop-shadow-[0_8px_18px_rgba(0,0,0,0.55)] ${front ? "invisible" : ""}`}
      />
      {front && <Lantern />}
    </div>
  );
}

/** Motte de terre (assets KayKit Halloween Bits + Forest Nature), au bas-centre de l'écran, légèrement enfoncée sous le bord. */
export function Mound() {
  return (
    <Image
      src={withBase("/decor/modal-mound.png")}
      alt=""
      width={2018}
      height={585}
      unoptimized
      aria-hidden
      priority
      className="pointer-events-none absolute bottom-0 left-1/2 h-auto w-[var(--mw)] max-w-none -translate-x-1/2 translate-y-[22%] select-none drop-shadow-[0_-6px_24px_rgba(0,0,0,0.5)]"
    />
  );
}
