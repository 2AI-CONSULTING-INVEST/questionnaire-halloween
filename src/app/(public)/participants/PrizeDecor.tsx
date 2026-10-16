"use client";

import { useEffect, useRef } from "react";
import { withBase } from "@/lib/base-path";

/**
 * Décor de la modale des lots : rendus 3D KayKit (scripts/3d/prize-props) posés autour du panneau,
 * sans recouvrir l'image du lot, le texte, la navigation ni le bouton Fermer :
 * - en bas à gauche, grosses citrouilles-lanternes allumées et, juste à leur droite, le petit
 *   squelette qui saute de joie, tourné vers la pile de cadeaux ;
 * - en bas à droite, la pile de cadeaux avec le badge rond Chamas Tacos adossé.
 * Sur téléphone, les éléments se posent sous le panneau, plus petits. Les images ne sont
 * téléchargées qu'à l'ouverture de la modale (le décor n'existe qu'avec elle).
 */
export function PrizeDecor() {
  return (
    <>
      {/* Citrouilles : lueur orange vive la nuit, ombre portée le jour. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={withBase("/decor/prize-pumpkins.webp")}
        alt=""
        aria-hidden
        width={1031}
        height={573}
        className="pointer-events-none absolute -bottom-[72px] left-0 z-20 w-[112px] max-w-none select-none drop-shadow-[0_0_22px_rgba(255,120,20,0.5)] md:-bottom-[72px] md:-left-[64px] md:w-[160px] xl:-bottom-[52px] xl:-left-[270px] xl:w-[230px] day:drop-shadow-[0_8px_16px_rgba(0,0,0,0.35)]"
      />
      <Jumper />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={withBase("/decor/prize-gifts.webp")}
        alt=""
        aria-hidden
        width={1013}
        height={794}
        className="pointer-events-none absolute -bottom-[80px] -right-1 z-20 w-[102px] max-w-none select-none drop-shadow-[0_10px_18px_rgba(0,0,0,0.55)] md:-bottom-[78px] md:-right-[56px] md:w-[150px] xl:-bottom-[52px] xl:-right-[200px] xl:w-[300px]"
      />
    </>
  );
}

/**
 * Petit squelette qui saute de joie, bras levés (rig KayKit respecté, image figée du saut), à droite
 * des citrouilles : saut en boucle avec son ombre ; immobile si les animations sont réduites.
 */
function Jumper() {
  return (
    <div
      aria-hidden
      data-jumper
      className="pointer-events-none absolute -bottom-[86px] left-[104px] z-20 w-[42px] md:-bottom-[92px] md:left-[92px] md:w-[52px] xl:-bottom-[44px] xl:-left-[52px] xl:w-[96px]"
    >
      <span className="absolute -bottom-1 left-1/2 h-[10%] w-[70%] -translate-x-1/2 rounded-[50%] bg-black/55 blur-[3px] motion-safe:animate-[hop-shadow_1.5s_ease-in-out_infinite]" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={withBase("/decor/prize-jumper.webp")}
        alt=""
        width={660}
        height={1041}
        className="relative block w-full origin-bottom select-none drop-shadow-[0_6px_10px_rgba(0,0,0,0.45)] motion-safe:animate-[hop_1.5s_ease-in-out_infinite]"
      />
    </div>
  );
}

/**
 * Nuée de chauves-souris 3D (prize-bats.ts : les mêmes que dans le décor du site), dans un canvas
 * plein écran DERRIÈRE le panneau : elles passent autour, jamais sur le texte. Le module Three.js
 * et le contexte WebGL ne sont créés qu'une fois l'animation d'ouverture terminée (900 ms : leur
 * création bloque un instant le fil principal) ; tout est arrêté et libéré à la fermeture.
 * Animations réduites : aucune chauve-souris.
 */
export function BatSwarm() {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let stop: (() => void) | null = null;
    let cancelled = false;
    const delay = window.setTimeout(() => {
      import("./prize-bats")
        .then(({ startBatSwarm }) => {
          if (!cancelled) stop = startBatSwarm(el, () => document.querySelector<HTMLElement>("[data-prize-modal]"));
        })
        .catch(() => {}); // pas de WebGL : pas de chauves-souris, la modale reste entière
    }, 900);
    return () => {
      cancelled = true;
      window.clearTimeout(delay);
      stop?.();
    };
  }, []);

  return <canvas ref={canvas} aria-hidden data-bat-swarm className="pointer-events-none fixed inset-0 h-full w-full drop-shadow-[0_0_5px_rgba(255,150,60,0.45)]" />;
}
