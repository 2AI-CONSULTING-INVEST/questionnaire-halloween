"use client";

import { useEffect, useState } from "react";
import { syncedNow } from "@/lib/clock";

/**
 * Temps restant (ms) jusqu'à `targetIso`, rafraîchi chaque seconde et calé sur l'heure du serveur.
 * À zéro, `onZero` est appelé (réouverture du vote sans recharger la page). Partagé par l'écran
 * « déjà voté » et la modale de vote bloqué.
 */
export function useCountdown(targetIso: string, onZero?: () => void) {
  const [left, setLeft] = useState(() => Math.max(0, Date.parse(targetIso) - syncedNow()));
  useEffect(() => {
    const tick = () => {
      const ms = Math.max(0, Date.parse(targetIso) - syncedNow());
      setLeft(ms);
      if (ms === 0) onZero?.();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetIso, onZero]);
  return left;
}
