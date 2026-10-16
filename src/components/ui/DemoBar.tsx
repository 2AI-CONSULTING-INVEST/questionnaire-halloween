"use client";

import { LogOut, RotateCcw } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import { DEMO_RESTART_EVENT, exitDemoTab, isDemoTab, subscribeDemoTab } from "@/components/questionnaire/demo";

/**
 * Bandeau permanent de l'espace démo, sur toutes les pages publiques tant que l'onglet est en démo
 * (drapeau de /demo, voir demo.ts) : rien n'est enregistré ; « Recommencer » repart de l'accueil du
 * questionnaire, « Sortir de la démo » efface le drapeau et la session de démo.
 */
export function DemoBar() {
  const demo = useSyncExternalStore(subscribeDemoTab, isDemoTab, () => false);
  const pathname = usePathname();
  const router = useRouter();
  if (!demo) return null;
  const restart = () => {
    window.dispatchEvent(new Event(DEMO_RESTART_EVENT));
    if (pathname !== "/" && pathname !== "/demo") router.push("/");
  };
  return (
    <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 z-30 flex max-w-[calc(100vw-9rem)] flex-col items-start gap-1.5 rounded-2xl border border-brand/60 bg-surface/90 px-2 py-2 text-xs font-semibold text-fg shadow-lg shadow-black/30 backdrop-blur sm:bottom-6 sm:left-6 sm:text-sm">
      {/* Texte en haut, boutons en dessous. */}
      <span className="max-w-full truncate px-1">
        <span aria-hidden>🧪 </span>
        <span className="sm:hidden">Démo · non enregistré</span>
        <span className="hidden sm:inline">Mode démo · rien n&apos;est enregistré</span>
      </span>
      <div className="flex gap-1.5">
      <button
        type="button"
        onClick={restart}
        aria-label="Recommencer la démo"
        className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand px-2 py-1 font-bold text-black transition-[filter] hover:brightness-105 sm:px-3"
      >
        <RotateCcw className="h-3.5 w-3.5" aria-hidden />
        <span className="hidden sm:inline">Recommencer</span>
      </button>
      <button
        type="button"
        onClick={exitDemoTab}
        aria-label="Sortir de la démo"
        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-edge-strong px-2 py-1 font-bold text-fg transition-colors hover:bg-surface-2 sm:px-3"
      >
        <LogOut className="h-3.5 w-3.5" aria-hidden />
        <span className="hidden sm:inline">Sortir de la démo</span>
      </button>
      </div>
    </div>
  );
}
