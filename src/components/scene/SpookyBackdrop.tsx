"use client";

import { useEffect, useRef, useState } from "react";
import { getTheme, setTheme, subscribeTheme } from "@/lib/theme";
import type { Graveyard } from "./graveyard";

type CSSVars = React.CSSProperties & Record<`--${string}`, string>;

// Étoiles à positions fixes (même rendu serveur / client).
const STARS = (() => {
  let seed = 7;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: 70 }, () => ({ x: r() * 100, y: r() * 100, d: 2.5 + r() * 4, dl: -r() * 6, s: r() < 0.15 ? 3 : 2 }));
})();

const SWARM_EVENT = "hw:swarm";

/** Fait s'envoler une nuée de chauves-souris (ex. : vote validé). */
export function triggerSwarm(size?: number) {
  window.dispatchEvent(new CustomEvent(SWARM_EVENT, { detail: size }));
}

/** Bascule nuit / jour ; le nouveau thème se dévoile en cercle depuis la lune. */
function toggleTheme(moon: HTMLElement | null) {
  const r = moon?.getBoundingClientRect();
  setTheme(getTheme() === "dark" ? "light" : "dark", r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : undefined);
}

function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * Fond animé du site public : ciel étoilé, lune, et cimetière 3D chargé après le premier
 * affichage (il ne retarde pas le questionnaire). Sans WebGL, seul le ciel s'affiche.
 *
 * Easter egg : toucher 3 fois la lune (ou taper « lumos » au clavier) allume le jour ;
 * 3 fois le soleil (ou « nox ») ramène la nuit.
 */
export function SpookyBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const moonRef = useRef<HTMLButtonElement>(null);
  const sceneRef = useRef<Graveyard | null>(null);
  const taps = useRef<number[]>([]);
  const [nudge, setNudge] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current!;
    let cancelled = false;

    const start = async () => {
      if (cancelled || !webglAvailable()) return;
      const { createGraveyard } = await import("./graveyard");
      if (cancelled) return;
      const nav = navigator as Navigator & { deviceMemory?: number };
      const low = (nav.deviceMemory ?? 8) <= 4 || (nav.hardwareConcurrency ?? 8) <= 4;
      try {
        sceneRef.current = createGraveyard(canvas, {
          theme: getTheme(),
          reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
          quality: low ? "low" : "high",
        });
      } catch {
        return; // pas de WebGL exploitable : le ciel CSS suffit
      }
      void sceneRef.current.ready.then(() => {
        if (!cancelled) canvas.dataset.ready = "";
      });
    };
    const idle = window.requestIdleCallback
      ? window.requestIdleCallback(() => void start(), { timeout: 1200 })
      : window.setTimeout(() => void start(), 300);

    const unsubscribe = subscribeTheme(() => sceneRef.current?.setTheme(getTheme()));
    const onSwarm = (e: Event) => sceneRef.current?.swarm((e as CustomEvent<number | undefined>).detail);
    window.addEventListener(SWARM_EVENT, onSwarm);

    // Formules magiques au clavier.
    let typed = "";
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable || e.key.length !== 1) return;
      typed = (typed + e.key.toLowerCase()).slice(-5);
      if ((typed.endsWith("lumos") && getTheme() === "dark") || (typed.endsWith("nox") && getTheme() === "light")) {
        toggleTheme(moonRef.current);
      }
    };
    window.addEventListener("keydown", onKey);

    return () => {
      cancelled = true;
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
      unsubscribe();
      window.removeEventListener(SWARM_EVENT, onSwarm);
      window.removeEventListener("keydown", onKey);
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, []);

  function onMoonTap() {
    const now = Date.now();
    taps.current = [...taps.current.filter((t) => now - t < 1200), now];
    setNudge((n) => (n % 2) + 1);
    if (taps.current.length >= 3) {
      taps.current = [];
      setNudge(0);
      toggleTheme(moonRef.current);
    }
  }

  return (
    <>
      <div className="sky" aria-hidden>
        <div className="sky-stars">
          {STARS.map((s, i) => (
            <i key={i} style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s, "--d": `${s.d}s`, "--dl": `${s.dl}s` } as CSSVars} />
          ))}
        </div>
      </div>
      <canvas ref={canvasRef} className="sky-canvas" aria-hidden />
      <div className="sky-scrim" aria-hidden />
      <button
        ref={moonRef}
        type="button"
        tabIndex={-1}
        aria-hidden
        className="moon"
        data-nudge={nudge || undefined}
        onClick={onMoonTap}
      />
    </>
  );
}
