import "server-only";
import { currentSession, isSecondPassword, readonlyPassword } from "./auth";
import type { Store } from "./db";
import { error } from "./http";

/** Verrouillage persistant (table `login_failures`), partagé avec la connexion : 10 échecs par IP ou 30 toutes IP en 15 minutes. */
export const LOCK_WINDOW_MS = 15 * 60_000;
export const LOCK_PER_IP = 10;
export const LOCK_GLOBAL = 30;

/** Vrai si les échecs récents (connexion et double validation confondues) verrouillent cette IP. */
export async function loginLocked(store: Store, ip: string | null) {
  const since = new Date(Date.now() - LOCK_WINDOW_MS).toISOString();
  const [byIp, all] = await Promise.all([store.countLoginFailures(since, ip), store.countLoginFailures(since)]);
  return byIp >= LOCK_PER_IP || all >= LOCK_GLOBAL;
}

/**
 * Double validation de toute action qui fait compter un vote : il faut une session admin (mot de passe
 * admin à la connexion) ET le mot de passe de lecture seule saisi dans la fenêtre. Comparaison à temps
 * constant ; chaque échec compte dans le verrouillage de la connexion ; le mot de passe n'est jamais
 * journalisé (masqué par maskDetails) ni stocké. Renvoie une réponse d'erreur, ou null si c'est bon.
 */
export async function requireSecondPassword(store: Store, ip: string | null, password: unknown): Promise<Response | null> {
  const session = await currentSession();
  if (session?.role !== "admin") return error("Accès en lecture seule", 403);
  if (!readonlyPassword()) {
    return error("Double validation impossible : le mot de passe de lecture seule (ADMIN_READONLY_PASSWORD) est absent ou trop court sur le serveur.", 503);
  }
  // Issue journalisée sur une ligne à part (la ligne de la requête est écrite avant ce contrôle).
  const log = async (action: string) => {
    try {
      await store.logAdminAction({ session_id: session.sid, method: "POST", path: "/double-validation", action, details: null });
    } catch (e) {
      console.error("Journal du backoffice indisponible :", e); // ne bloque jamais l'action elle-même
    }
  };
  if (await loginLocked(store, ip)) {
    await log("Double validation : refusée (trop de tentatives)");
    return error("Trop de tentatives, réessayez dans 15 minutes.", 429);
  }
  if (typeof password !== "string" || !isSecondPassword(password)) {
    await store.recordLoginFailure(ip);
    await log("Double validation : refusée (mot de passe incorrect)");
    return error("Mot de passe de double validation incorrect.", 403, { code: "second_password" });
  }
  await log("Double validation : réussie");
  return null;
}
