/** Thème du site public : nuit par défaut, jour via l'easter egg. */
export type Theme = "dark" | "light";

export const THEME_STORAGE_KEY = "chamas-theme";

export function getTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

const listeners = new Set<() => void>();

export function subscribeTheme(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/**
 * Change de thème. Si `origin` est fourni (centre de la lune), la nouvelle ambiance
 * se dévoile en cercle depuis ce point (View Transitions, sinon changement direct).
 */
export function setTheme(theme: Theme, origin?: { x: number; y: number }) {
  const apply = () => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "light" ? "#f7f2ea" : "#0c0a12");
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      /* stockage indisponible : le thème vaut pour cette visite */
    }
    listeners.forEach((fn) => fn());
  };
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (origin && !reduce && "startViewTransition" in document) {
    document.documentElement.style.setProperty("--reveal-x", `${origin.x}px`);
    document.documentElement.style.setProperty("--reveal-y", `${origin.y}px`);
    document.startViewTransition(apply);
  } else {
    apply();
  }
}
