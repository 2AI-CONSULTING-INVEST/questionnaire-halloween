import "server-only";
import { currentSession, type Role, type Session } from "./auth";
import { getStore } from "./db";
import { error } from "./http";
import { maskDetails } from "./redact";

const VERBS: Record<string, string> = { POST: "Ajout", PATCH: "Modification", PUT: "Modification", DELETE: "Suppression", GET: "Consultation" };
const NOUNS: [RegExp, string][] = [
  [/\/api\/admin\/settings/, "réglages de sécurité"],
  [/\/api\/admin\/sessions/, "session du backoffice"],
  [/\/api\/admin\/purge/, "données expirées"],
  [/\/api\/decorations\/upload/, "envoi d'un média"],
  [/\/api\/decorations/, "média de décoration"],
  [/\/api\/prizes/, "lot"],
  [/\/api\/participants/, "participant"],
  [/\/api\/restaurants/, "restaurant"],
  [/\/api\/responses\/export/, "export"],
  [/\/api\/responses/, "réponse"],
];
const DETAILS_MAX = 2000;

/** Journalise la requête dans la session (écritures et exports ; jamais les simples lectures). */
async function logRequest(sid: string, req: Request) {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/halloween(?=\/)/, "");
  if (req.method === "GET" && !/\/export$/.test(path)) return;
  const noun = NOUNS.find(([re]) => re.test(path))?.[1] ?? path;
  const verb = /\/restore$/.test(path) ? "Restauration" : /\/revoke$/.test(path) ? "Déconnexion" : /\/purge$/.test(path) ? "Purge" : (VERBS[req.method] ?? req.method);
  const action = /\/export$/.test(path) ? `Export : ${url.searchParams.get("scope") === "participants" ? "participants" : "réponses"}` : `${verb} : ${noun}`;
  let details: unknown = null;
  if (req.method === "GET") details = Object.fromEntries(url.searchParams);
  else if (req.headers.get("content-type")?.includes("application/json")) {
    const body = maskDetails(await req.clone().json().catch(() => null));
    const text = body === null ? null : JSON.stringify(body);
    details = text === null ? null : text.length > DETAILS_MAX ? text.slice(0, DETAILS_MAX) + "…" : body;
  }
  try {
    await getStore().logAdminAction({ session_id: sid, method: req.method, path: path + (req.method === "GET" ? "" : ""), action, details });
  } catch (e) {
    console.error("Journal du backoffice indisponible :", e); // ne bloque jamais l'action elle-même
  }
}

/**
 * Session du cookie signé, à condition qu'elle existe encore en base et n'ait pas été révoquée
 * (déconnexion, bouton du Journal). Lève si la base est indisponible : on refuse plutôt qu'accepter.
 */
export async function liveSession(): Promise<Session | null> {
  const session = await currentSession();
  if (!session) return null;
  const row = await getStore().getAdminSession(session.sid);
  return row && !row.revoked_at ? session : null;
}

/**
 * Renvoie une réponse d'erreur si l'utilisateur n'a pas le rôle requis, sinon null. Avec `req`,
 * l'action (méthode, route, corps JSON) est consignée dans le journal de la session.
 */
export async function requireRole(min: Role, req?: Request) {
  let session: Session | null;
  try {
    session = await liveSession();
  } catch (e) {
    console.error("Sessions du backoffice indisponibles :", e);
    return error("Service indisponible", 503);
  }
  if (!session) return error("Non authentifié", 401);
  if (min === "admin" && session.role !== "admin") return error("Accès en lecture seule", 403);
  if (req) await logRequest(session.sid, req);
  return null;
}
