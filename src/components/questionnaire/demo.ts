"use client";

import { withBase } from "@/lib/base-path";
import { clientNow } from "@/lib/clock";
import { nextParisMidnight, parisDay } from "@/lib/day";
import { raffleSchema, voteCompleteSchema } from "@/lib/schema";

/**
 * Espace démo (/halloween/demo) : le questionnaire complet, mais rien ne part au serveur.
 * Les appels de l'API sont simulés ici, avec les mêmes validations zod que les routes : le
 * parcours (erreurs comprises) est identique, sans vote ni inscription au tirage en base.
 * Les réponses de la démo sont gardées dans une clé localStorage à part (voir store.ts).
 *
 * Démo « collante » : la page /demo (réservée au backoffice) pose un drapeau dans sessionStorage,
 * propre à l'onglet et effacé à sa fermeture. Tant qu'il est là, tout questionnaire de l'onglet
 * (accueil, retour arrière, rechargement…) reste en démo, jusqu'au bouton « Sortir de la démo ».
 * Le drapeau est lu dès l'évaluation de ce module : aucune requête d'écriture ne peut partir avant.
 * Un visiteur qui le poserait à la main ne ferait que s'empêcher de voter.
 */
const DEMO_FLAG = "hw-demo";
const DEMO_EVENT = "hw:demo";

function readFlag() {
  try {
    return sessionStorage.getItem(DEMO_FLAG) === "1";
  } catch {
    return false;
  }
}

let demo = typeof window !== "undefined" && readFlag();

export const isDemoMode = () => demo;
export function setDemoMode(on: boolean) {
  demo = on;
}

/** Onglet en démo (drapeau posé par /demo). */
export const isDemoTab = () => typeof window !== "undefined" && readFlag();
export function subscribeDemoTab(fn: () => void) {
  window.addEventListener(DEMO_EVENT, fn);
  return () => window.removeEventListener(DEMO_EVENT, fn);
}

/** Entrée dans la démo (page /demo uniquement). */
export function enterDemoTab() {
  try {
    sessionStorage.setItem(DEMO_FLAG, "1");
  } catch {
    /* sans sessionStorage, la démo ne vaut que pour la page /demo */
  }
  window.dispatchEvent(new Event(DEMO_EVENT));
}

/** Sortie de la démo : drapeau et session de démo effacés, retour au vrai vote (rechargement complet). */
export function exitDemoTab() {
  try {
    sessionStorage.removeItem(DEMO_FLAG);
    for (const k of Object.keys(localStorage)) if (k.endsWith("-demo")) localStorage.removeItem(k);
  } catch {
    /* rien à effacer */
  }
  demo = false;
  window.location.assign(withBase("/"));
}

/** « Recommencer » du bandeau démo : le questionnaire monté repart de l'accueil. */
export const DEMO_RESTART_EVENT = "hw:demo-restart";

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const invalid = (fieldErrors: Record<string, string[] | undefined>) =>
  reply({ error: "Données invalides", details: fieldErrors }, 422);

function readBody(init?: RequestInit): unknown {
  try {
    return typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
  } catch {
    return undefined;
  }
}

/** Réponse simulée de l'API, d'après le chemin appelé (sans le basePath). */
async function demoFetch(path: string, init?: RequestInit): Promise<Response> {
  // Petit délai : les états de chargement de l'interface restent visibles.
  await new Promise((r) => setTimeout(r, 250));
  const now = clientNow();
  if (path.startsWith("/api/vote-status")) {
    return reply({ votedToday: false, today: parisDay(now), nextResetAt: nextParisMidnight(now).toISOString() });
  }
  if (path === "/api/responses/create") return reply({ ok: true }, 201);
  if (path.endsWith("/complete")) {
    const parsed = voteCompleteSchema.safeParse(readBody(init));
    return parsed.success ? reply({ ok: true, alreadyCompleted: false, voteDay: parisDay(now) }) : invalid(parsed.error.flatten().fieldErrors);
  }
  if (path.endsWith("/raffle")) {
    const parsed = raffleSchema.safeParse(readBody(init));
    return parsed.success ? reply({ ok: true, alreadyRegistered: false }) : invalid(parsed.error.flatten().fieldErrors);
  }
  // Auto-save et tout le reste : accepté, rien n'est enregistré.
  return reply({ ok: true });
}

/** fetch() des appels du questionnaire (chemins sans basePath) : simulé en démo, réel sinon. */
export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return demo ? demoFetch(path, init) : fetch(withBase(path), init);
}
