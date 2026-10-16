/**
 * Prochain vote : dès que le vote du jour est fait (vote validé, ou appareil reconnu « déjà voté »),
 * l'instant de réouverture (minuit à Paris) est mémorisé sur l'appareil. Le compte à rebours en haut
 * à droite le lit sur toutes les pages publiques. L'espace démo a sa propre clé (rien de réel).
 */
import { clientNow } from "./clock";

const KEY = (demo: boolean) => (demo ? "hw-next-vote-demo" : "hw-next-vote");
const EVENT = "hw:next-vote";

export function setNextVote(iso: string | null, demo: boolean) {
  try {
    if (iso) localStorage.setItem(KEY(demo), iso);
    else localStorage.removeItem(KEY(demo));
  } catch {
    /* stockage indisponible : pas de compte à rebours hors de l'écran du vote */
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Instant (ms) du prochain vote, ou null si le vote du jour n'est pas fait (ou déjà rouvert). */
export function readNextVote(demo: boolean): number | null {
  try {
    const t = Date.parse(localStorage.getItem(KEY(demo)) ?? "");
    return Number.isFinite(t) && t > clientNow() ? t : null;
  } catch {
    return null;
  }
}

export function subscribeNextVote(fn: () => void) {
  window.addEventListener(EVENT, fn);
  window.addEventListener("storage", fn);
  return () => {
    window.removeEventListener(EVENT, fn);
    window.removeEventListener("storage", fn);
  };
}
