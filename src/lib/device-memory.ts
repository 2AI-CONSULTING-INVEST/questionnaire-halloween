"use client";

import { DEVICE_TOKEN_RE } from "./schema";

/**
 * Mémoire de l'appareil, côté navigateur : jeton opaque remis par le serveur à l'ouverture de la
 * session, et repère du jour de vote. Écrits dans localStorage ET IndexedDB (l'un peut survivre à
 * l'effacement de l'autre). Rien ne survit à la navigation privée ni à l'effacement complet des
 * données du site : seule la clé matérielle forte reconnaît alors l'appareil (côté serveur).
 * Toute erreur est silencieuse : le vote ne dépend jamais de ce stockage.
 */

const TOKEN_KEY = "hw-device-token";
const DAY_KEY = "hw-vote-day";
const DB = "chamas-hw";
const STORE = "kv";

function idb<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return new Promise((resolve) => {
    try {
      const open = indexedDB.open(DB, 1);
      open.onupgradeneeded = () => open.result.createObjectStore(STORE);
      open.onerror = () => resolve(undefined);
      open.onsuccess = () => {
        try {
          const tx = open.result.transaction(STORE, mode);
          const req = run(tx.objectStore(STORE));
          tx.oncomplete = () => {
            open.result.close();
            resolve(req ? (req.result as T) : undefined);
          };
          tx.onerror = tx.onabort = () => {
            open.result.close();
            resolve(undefined);
          };
        } catch {
          resolve(undefined);
        }
      };
    } catch {
      resolve(undefined);
    }
  });
}

/** Lecture bornée dans le temps : IndexedDB peut être lent ou bloqué (300 ms au plus). */
const within = <T,>(p: Promise<T>, fallback: T) => Promise.race([p, new Promise<T>((r) => setTimeout(() => r(fallback), 300))]);

function lsGet(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function lsSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* stockage indisponible */
  }
}

export function rememberToken(token: string) {
  if (!DEVICE_TOKEN_RE.test(token)) return;
  lsSet(TOKEN_KEY, token);
  void idb("readwrite", (s) => void s.put(token, TOKEN_KEY));
}

/** Jetons trouvés sur l'appareil (localStorage et IndexedDB, sans doublon). */
export async function readTokens(): Promise<string[]> {
  const fromIdb = await within(idb<string>("readonly", (s) => s.get(TOKEN_KEY) as IDBRequest<string>), undefined);
  return [...new Set([lsGet(TOKEN_KEY), fromIdb].filter((t): t is string => typeof t === "string" && DEVICE_TOKEN_RE.test(t)))];
}

/** Repère « tentative faite ce jour-là » (jour de Paris, AAAA-MM-JJ), posé à chaque tentative. */
export function markVoteDay(day: string) {
  lsSet(DAY_KEY, day);
  void idb("readwrite", (s) => void s.put(day, DAY_KEY));
}

/** Repère synchrone (localStorage) : affiche l'écran « déjà voté » sans attendre le réseau. */
export const readVoteDaySync = () => lsGet(DAY_KEY);

export async function readVoteDay(): Promise<string | null> {
  return readVoteDaySync() ?? (await within(idb<string>("readonly", (s) => s.get(DAY_KEY) as IDBRequest<string>), undefined)) ?? null;
}
