"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getTheme, setTheme, subscribeTheme } from "@/lib/theme";
import { useSceneState } from "./scene-state";
import type { SceneName, World } from "./world";

type CSSVars = React.CSSProperties & Record<`--${string}`, string>;

// Étoiles à positions fixes (même rendu serveur / client). Rythmes variés et rapides, amplitude
// forte (--lo : opacité au creux) ; quelques-unes, plus grosses, brillent avec un halo et un éclat en croix.
const STARS = (() => {
  let seed = 7;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: 96 }, () => {
    const bright = r() < 0.14;
    return {
      x: r() * 100,
      y: r() * 100,
      d: bright ? 1.4 + r() * 1.8 : 1.1 + r() * 2.4,
      dl: -r() * 5,
      s: bright ? 4 : r() < 0.3 ? 3 : 2,
      lo: 0.04 + r() * 0.2,
      bright,
    };
  });
})();

// Le code du monde 3D part dès l'évaluation de ce module (avant l'hydratation), en parallèle des
// modèles de la scène 1 annoncés dans le <head> du layout. Un échec réseau sera retenté dans start().
const worldModule = typeof window !== "undefined" ? import("./world").catch(() => null) : null;

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
 * Décor du site public, monté une seule fois (layout) : il persiste entre le questionnaire, la page
 * des résultats et celle des participants, ce qui permet à la caméra de voyager d'un lieu à l'autre.
 * Ciel étoilé en CSS ; monde 3D démarré immédiatement (le cimetière et le logo apparaissent d'un bloc).
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
  // Résultats : la crypte ; participants et lots : la clairière de la faucheuse (les cadeaux) ; sinon la scène du questionnaire.
  const scene: SceneName = pathname.startsWith("/resultats") ? "crypt" : pathname.startsWith("/participants") ? "reaper" : questionnaireScene;
  const sceneRef = useRef(scene);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const store = useSceneState.getState();
    let cancelled = false;

    const start = async () => {
      if (!canRun3D()) return store.setStatus("unsupported");
      const mod = (await worldModule) ?? (await import("./world"));
      if (cancelled) return;
      const nav = navigator as Navigator & { deviceMemory?: number; connection?: { effectiveType?: string } };
      const low = (nav.deviceMemory ?? 8) <= 4 || (nav.hardwareConcurrency ?? 8) <= 4 || nav.connection?.effectiveType === "3g";
      try {
        const world = mod.createWorld(canvas, {
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
    void start();

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
            <i
              key={i}
              className={s.bright ? "b" : undefined}
              style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s, "--d": `${s.d}s`, "--dl": `${s.dl}s`, "--lo": `${s.lo}` } as CSSVars}
            />
          ))}
        </div>
      </div>
      <canvas ref={canvasRef} className="sky-canvas" aria-hidden />
      <div className="sky-scrim" aria-hidden />
    </div>
  );
}
