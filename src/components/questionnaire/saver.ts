"use client";

/**
 * Auto-save « live » : chaque réponse est envoyée immédiatement (ou après un
 * debounce pour les champs texte). Les envois échoués sont conservés et
 * renvoyés automatiquement (backoff, retour en ligne, fermeture d'onglet).
 */

type Patch = Record<string, unknown>;
type Status = "idle" | "saving" | "error";
type Listener = (status: Status) => void;

let sessionId: string | null = null;
let pending: Patch = {};
let timer: ReturnType<typeof setTimeout> | undefined;
let inflight: Promise<void> | null = null;
let retryDelay = 2000;
let status: Status = "idle";
const listeners = new Set<Listener>();

function setStatus(s: Status) {
  status = s;
  listeners.forEach((l) => l(s));
}

export function onSaveStatus(l: Listener) {
  listeners.add(l);
  l(status);
  return () => void listeners.delete(l);
}

export function initSaver(id: string) {
  sessionId = id;
}

export async function createSession(id: string) {
  sessionId = id;
  try {
    await fetch("/api/responses/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: id }),
      keepalive: true,
    });
  } catch {
    // Pas grave : la première mise à jour créera la ligne.
  }
}

/** Planifie l'enregistrement d'un ou plusieurs champs. */
export function save(patch: Patch, debounceMs = 0) {
  pending = { ...pending, ...patch };
  clearTimeout(timer);
  timer = setTimeout(() => void flush(), debounceMs);
}

/** Abandonne les champs en attente (ex. : après validation du vote). */
export function discard(keys: string[]) {
  for (const k of keys) delete pending[k];
}

export async function flush(): Promise<void> {
  clearTimeout(timer);
  while (inflight) await inflight;
  if (!sessionId || Object.keys(pending).length === 0) return;

  const sent = pending;
  pending = {};
  setStatus("saving");

  inflight = (async () => {
    try {
      const res = await fetch(`/api/responses/${sessionId}/update`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sent),
      });
      if (res.ok || (res.status >= 400 && res.status < 500 && res.status !== 429)) {
        // 4xx (hors 429) : donnée refusée, inutile de réessayer.
        retryDelay = 2000;
        setStatus(Object.keys(pending).length ? "saving" : "idle");
        return;
      }
      throw new Error(`HTTP ${res.status}`);
    } catch {
      // On remet les champs (sans écraser une valeur plus récente) et on réessaie.
      pending = { ...sent, ...pending };
      setStatus("error");
      clearTimeout(timer);
      timer = setTimeout(() => void flush(), retryDelay);
      retryDelay = Math.min(retryDelay * 2, 30_000);
    }
  })();

  await inflight;
  inflight = null;
  if (Object.keys(pending).length && status !== "error") await flush();
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    retryDelay = 2000;
    void flush();
  });
  // Dernière chance d'envoi si l'utilisateur ferme l'onglet.
  window.addEventListener("pagehide", () => {
    if (!sessionId || Object.keys(pending).length === 0) return;
    const blob = new Blob([JSON.stringify(pending)], { type: "application/json" });
    if (navigator.sendBeacon(`/api/responses/${sessionId}/update`, blob)) pending = {};
  });
}
