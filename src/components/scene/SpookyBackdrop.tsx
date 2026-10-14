"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getTheme, setTheme, subscribeTheme } from "@/lib/theme";
import { useSceneState } from "./scene-state";
import type { SceneName, World } from "./world";

type CSSVars = React.CSSProperties & Record<`--${string}`, string>;

// Étoiles à positions fixes (même rendu serveur / client).
const STARS = (() => {
  let seed = 7;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: 70 }, () => ({ x: r() * 100, y: r() * 100, d: 2.5 + r() * 4, dl: -r() * 6, s: r() < 0.15 ? 3 : 2 }));
})();

const SWARM_EVENT = "hw:swarm";
/** Easter egg de la lune : nombre de tapes rapides et écart maximal entre deux tapes. */
const TAPS_NEEDED = 30;
const TAP_GAP_MS = 600;

/** Fait s'envoler une nuée de chauves-souris (ex. : vote validé). */
export function triggerSwarm(size?: number) {
  window.dispatchEvent(new CustomEvent(SWARM_EVENT, { detail: size }));
}

/** Bascule nuit / jour ; le nouveau thème se dévoile en cercle depuis la lune (objet 3D du ciel). */
function toggleTheme(origin: { x: number; y: number } | null | undefined) {
  setTheme(getTheme() === "dark" ? "light" : "dark", origin ?? undefined);
}

/** WebGL disponible, et connexion assez bonne pour télécharger le décor. */
function canRun3D() {
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (conn?.saveData || conn?.effectiveType === "slow-2g" || conn?.effectiveType === "2g") return false;
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * Décor du site public, monté une seule fois (layout) : il persiste entre le questionnaire et
 * la page des résultats, ce qui permet à la caméra de voyager d'un lieu à l'autre.
 * Ciel étoilé et lune en CSS, monde 3D chargé après le premier affichage.
 *
 * Easter egg : toucher la lune au moins 30 fois, vite (ou taper « lumos »), allume le jour ;
 * de même sur le soleil (ou « nox ») pour ramener la nuit.
 */
export function SpookyBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<World | null>(null);
  const taps = useRef<number[]>([]);
  const [indoor, setIndoor] = useState(false);
  const pathname = usePathname();
  const questionnaireScene = useSceneState((s) => s.questionnaireScene);
  const scene: SceneName = pathname.startsWith("/resultats") ? "crypt" : questionnaireScene;
  const sceneRef = useRef(scene);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const store = useSceneState.getState();
    let cancelled = false;

    const start = async () => {
      if (cancelled) return;
      if (!canRun3D()) return store.setStatus("unsupported");
      const { createWorld } = await import("./world");
      if (cancelled) return;
      const nav = navigator as Navigator & { deviceMemory?: number; connection?: { effectiveType?: string } };
      const low = (nav.deviceMemory ?? 8) <= 4 || (nav.hardwareConcurrency ?? 8) <= 4 || nav.connection?.effectiveType === "3g";
      try {
        const world = createWorld(canvas, {
          theme: getTheme(),
          reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
          quality: low ? "low" : "high",
          onIndoor: setIndoor,
          onReveal: () => useSceneState.getState().setRevealed(true),
          onPlaqueClick: () => {
            const s = useSceneState.getState();
            if (Date.now() - s.boardClosedAt > 400) s.setBoardOpen(true);
          },
          // Easter egg : au moins 30 tapes rapides sur la lune (moins de 0,6 s entre deux) ;
          // une pause remet à zéro. La lune s'illumine à mesure.
          onMoonTap: (point) => {
            const now = Date.now();
            const last = taps.current[taps.current.length - 1] ?? 0;
            taps.current = now - last < TAP_GAP_MS ? [...taps.current, now] : [now];
            worldRef.current?.setMoonCharge(taps.current.length / TAPS_NEEDED);
            if (taps.current.length >= TAPS_NEEDED) {
              taps.current = [];
              worldRef.current?.setMoonCharge(0);
              toggleTheme(point);
            }
          },
        });
        worldRef.current = world;
        world.setScene(sceneRef.current);
        const results = useSceneState.getState().results;
        if (results) world.setResults(results);
        await world.ready;
        if (cancelled) return;
        canvas.dataset.ready = "";
        store.setStatus("ready");
      } catch {
        store.setStatus("unsupported"); // pas de WebGL exploitable : le ciel CSS suffit
      }
    };
    const idle = window.requestIdleCallback
      ? window.requestIdleCallback(() => void start(), { timeout: 1200 })
      : window.setTimeout(() => void start(), 300);

    const unsubTheme = subscribeTheme(() => worldRef.current?.setTheme(getTheme()));
    const unsubResults = useSceneState.subscribe((s, prev) => {
      if (s.results && s.results !== prev.results) worldRef.current?.setResults(s.results);
    });
    const onSwarm = (e: Event) => worldRef.current?.swarm((e as CustomEvent<number | undefined>).detail);
    window.addEventListener(SWARM_EVENT, onSwarm);

    // Formules magiques au clavier.
    let typed = "";
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable || e.key.length !== 1) return;
      typed = (typed + e.key.toLowerCase()).slice(-5);
      if ((typed.endsWith("lumos") && getTheme() === "dark") || (typed.endsWith("nox") && getTheme() === "light")) {
        toggleTheme(worldRef.current?.moonScreenPoint());
      }
    };
    window.addEventListener("keydown", onKey);

    return () => {
      cancelled = true;
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
      unsubTheme();
      unsubResults();
      window.removeEventListener(SWARM_EVENT, onSwarm);
      window.removeEventListener("keydown", onKey);
      worldRef.current?.dispose();
      worldRef.current = null;
    };
  }, []);

  // Changement de lieu : la caméra s'y rend.
  useEffect(() => {
    sceneRef.current = scene;
    worldRef.current?.setScene(scene);
    if (scene !== "crypt") useSceneState.getState().setRevealed(false);
  }, [scene]);

  return (
    <div className="backdrop" data-indoor={indoor || undefined} data-scene={scene}>
      <div className="sky" aria-hidden>
        <div className="sky-stars">
          {STARS.map((s, i) => (
            <i key={i} style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s, "--d": `${s.d}s`, "--dl": `${s.dl}s` } as CSSVars} />
          ))}
        </div>
      </div>
      <canvas ref={canvasRef} className="sky-canvas" aria-hidden />
      <div className="sky-scrim" aria-hidden />
    </div>
  );
}
