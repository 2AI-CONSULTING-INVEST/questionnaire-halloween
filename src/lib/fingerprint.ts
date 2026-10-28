"use client";

import { readTokens } from "./device-memory";
import { uaBrowser } from "./risk";
import type { Device, HwEntropy } from "./schema";

/**
 * Signaux d'appareil pour le score de risque anti-revote (navigateur uniquement). Calculés une fois
 * par session, hors du fil principal (requestIdleCallback), en quelques millisecondes ; toute erreur
 * donne un signal vide : le vote reste possible. Le serveur ne reçoit qu'un condensé SHA-256 (jamais
 * les valeurs brutes) et quelques attributs grossiers. Aucune permission demandée, rien d'intrusif.
 *
 * `hash` (inchangé : l'onglet Visites et les données existantes en dépendent) change avec la version du
 * navigateur ou le mode sombre. La clé matérielle `hw` ne retient que le matériel et les réglages
 * stables : écran, processeur, mémoire, carte graphique (WebGL), fuseau, langues, et sur Chrome Android
 * le modèle et la version majeure d'Android. Ni canvas, ni audio, ni rien de ce que les navigateurs
 * anti-empreinte randomisent. Impossible pour une page web : adresse MAC, IMEI, numéro de série,
 * identifiant publicitaire. Deux iPhone du même modèle et mêmes réglages sont indiscernables.
 */

const STORE_KEY = "chamas-halloween-2026-v2";

type UaData = {
  brands: { brand: string; version: string }[];
  platform: string;
  mobile: boolean;
  getHighEntropyValues?: (hints: string[]) => Promise<{ model?: string; platformVersion?: string }>;
};
const nav = () => navigator as Navigator & { userAgentData?: UaData; deviceMemory?: number; brave?: unknown };

const uaIsMobile = (ua: string) => /Mobile|iPhone|iPod/i.test(ua);

/** « Chrome 130 », « Safari 17 »… : marque de `userAgentData` (hors marques factices) sinon famille et version lues dans l'UA. */
function browserName(uad: UaData | undefined, ua: string) {
  const brand = uad?.brands.find((b) => !/Not|Brand|Chromium/i.test(b.brand));
  if (brand) return `${brand.brand.replace(/^Google |^Microsoft /, "")} ${brand.version}`.slice(0, 32);
  const family = uaBrowser(ua);
  const version = ua.match(/(?:Version|CriOS|FxiOS|Firefox|Edg[eA]?|OPR|SamsungBrowser|Chrome)\/(\d+)/)?.[1];
  return `${family}${version ? ` ${version}` : ""}`.slice(0, 32);
}

function webgl() {
  try {
    const gl = document.createElement("canvas").getContext("webgl");
    if (!gl) return "";
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    return info ? `${gl.getParameter(info.UNMASKED_VENDOR_WEBGL)}/${gl.getParameter(info.UNMASKED_RENDERER_WEBGL)}` : `${gl.getParameter(gl.VENDOR)}/${gl.getParameter(gl.RENDERER)}`;
  } catch {
    return "";
  }
}

function canvas() {
  try {
    const c = document.createElement("canvas");
    c.width = 80;
    c.height = 20;
    const ctx = c.getContext("2d");
    if (!ctx) return "";
    ctx.font = "12px sans-serif";
    ctx.fillText("Chamas 🎃", 2, 14);
    ctx.beginPath();
    ctx.arc(70, 10, 6, 0, Math.PI * 1.5);
    ctx.stroke();
    return c.toDataURL();
  } catch {
    return "";
  }
}

function audioRate() {
  try {
    const ctx = new AudioContext();
    const rate = ctx.sampleRate;
    void ctx.close();
    return rate;
  } catch {
    return "";
  }
}

/** Valeurs WebGL stables (moteur et limites matérielles), sans liste d'extensions (elle change avec le navigateur). */
function webglStable() {
  try {
    const gl = document.createElement("canvas").getContext("webgl");
    if (!gl) return { renderer: "", params: "" };
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = info ? `${gl.getParameter(info.UNMASKED_VENDOR_WEBGL)}/${gl.getParameter(info.UNMASKED_RENDERER_WEBGL)}` : "";
    const params = [gl.MAX_TEXTURE_SIZE, gl.MAX_RENDERBUFFER_SIZE, gl.MAX_VIEWPORT_DIMS, gl.MAX_VERTEX_ATTRIBS, gl.MAX_VERTEX_UNIFORM_VECTORS, gl.MAX_FRAGMENT_UNIFORM_VECTORS, gl.ALIASED_POINT_SIZE_RANGE]
      .map((p) => String(gl.getParameter(p)))
      .join(",");
    return { renderer, params };
  } catch {
    return { renderer: "", params: "" };
  }
}

/** iPhone, iPad (même en mode « ordinateur ») : tous leurs navigateurs sont WebKit et se ressemblent. */
const isAppleMobile = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
/** Moteur WebGL masqué ou générique (anti-empreinte, Firefox en mode résistance, rendu logiciel). */
const genericRenderer = (r: string) => !r || /^(Mozilla|WebKit)\/(Mozilla|WebKit WebGL)$|Generic|SwiftShader|llvmpipe/i.test(r);

/** Modèle et version majeure d'Android (Chrome Android) : l'information la plus précise qu'une page puisse obtenir. */
async function androidModel(uad: UaData | undefined): Promise<{ model?: string; osVersion?: string }> {
  if (!uad?.getHighEntropyValues || !/Android/i.test(navigator.userAgent)) return {};
  try {
    const v = await Promise.race([uad.getHighEntropyValues(["model", "platformVersion"]), new Promise<never>((_, no) => setTimeout(() => no(new Error("délai")), 1500))]); // calculé au chargement (promesse partagée), jamais au clic
    return { model: v.model?.slice(0, 40) || undefined, osVersion: v.platformVersion?.split(".")[0]?.slice(0, 16) || undefined };
  } catch {
    return {};
  }
}

/**
 * Dimension physique de l'écran, arrondie à 10 pixels : le zoom de Chrome sur ordinateur change à la fois
 * `devicePixelRatio` et les dimensions CSS, pas leur produit ; l'arrondi absorbe l'écart dû aux dimensions
 * CSS entières (moins d'un demi-pixel CSS). Téléphones : rapport fixe, valeur constante.
 */
export const physicalPx = (css: number, dpr: number) => Math.round((css * dpr) / 10) * 10;

function hwParts(n: ReturnType<typeof nav>, uad: UaData | undefined, android: { model?: string; osVersion?: string }) {
  const gl = webglStable();
  return {
    renderer: gl.renderer,
    text: [
      uad?.platform || n.platform,
      uad?.mobile ?? uaIsMobile(n.userAgent),
      // Ni `devicePixelRatio` seul ni la hauteur disponible (qui suit le zoom et la barre des tâches).
      `${physicalPx(screen.width, devicePixelRatio)}x${physicalPx(screen.height, devicePixelRatio)}x${screen.colorDepth}`,
      n.maxTouchPoints,
      n.hardwareConcurrency,
      n.deviceMemory ?? "",
      gl.renderer,
      gl.params,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      n.languages.join(","),
      android.model ?? "",
      android.osVersion ?? "",
    ].join("|"),
  };
}

/**
 * Navigation privée, détection heuristique par navigateur (vrai, faux, ou null si incertain : null n'a
 * aucun effet). Évalué : la bibliothèque detectincognitojs (MIT, quelques Ko) ; les trois tests utiles
 * tiennent en quelques lignes, sans dépendance. Chromium : quota de stockage réduit en navigation privée ;
 * Firefox : pas de service worker ; Safari : système de fichiers privé refusé.
 */
async function privateMode(): Promise<boolean | null> {
  try {
    const ua = navigator.userAgent;
    if (/Firefox\//.test(ua)) return navigator.serviceWorker === undefined;
    if (/Chrome\//.test(ua) && navigator.storage?.estimate) {
      const { quota } = await navigator.storage.estimate();
      const heap = (performance as Performance & { memory?: { jsHeapSizeLimit?: number } }).memory?.jsHeapSizeLimit ?? 1_073_741_824;
      return quota !== undefined ? quota < heap * 2 : null;
    }
    if (/Safari\//.test(ua) && navigator.storage?.getDirectory) {
      try {
        await navigator.storage.getDirectory();
        return false;
      } catch (e) {
        return e instanceof Error && /unknown transient reason/i.test(e.message) ? true : null;
      }
    }
  } catch {
    /* incertain */
  }
  return null;
}

async function sha256(text: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Classe d'entropie (fonction pure, testée) : brouillée, faible (iPhone, iPad, moteur graphique masqué,
 * Android sans modèle ou en WebView) ou forte. Sur Android, le modèle est ce qui distingue deux appareils.
 */
export function entropyClass(input: { changing: boolean; brave: boolean; firefox: boolean; appleMobile: boolean; renderer: string; android?: boolean; model?: string; webview?: boolean }): HwEntropy {
  if (input.changing || input.brave || (input.firefox && genericRenderer(input.renderer))) return "noisy";
  if (input.appleMobile || genericRenderer(input.renderer)) return "weak";
  if (input.android && (input.webview || !input.model)) return "weak";
  return "strong";
}

/** Clé matérielle, classe d'entropie, modèle Android et navigation privée. */
async function hardware(): Promise<Pick<Device, "hw" | "hwEntropy" | "model" | "osVersion" | "privateMode">> {
  const n = nav();
  const uad = n.userAgentData;
  const [android, priv] = await Promise.all([androidModel(uad), privateMode()]);
  const first = hwParts(n, uad, android);
  const second = hwParts(n, uad, android); // valeurs qui changent entre deux calculs : clé brouillée
  const hwEntropy = entropyClass({
    changing: first.text !== second.text,
    brave: n.brave !== undefined,
    firefox: /Firefox\//.test(n.userAgent),
    appleMobile: isAppleMobile(),
    renderer: first.renderer,
    android: /Android/.test(n.userAgent),
    model: android.model,
    webview: /; wv\)/.test(n.userAgent),
  });
  return { hw: await sha256(first.text), hwEntropy, model: android.model, osVersion: android.osVersion, privateMode: priv };
}

async function compute(): Promise<Device> {
  const n = nav();
  const uad = n.userAgentData;
  const parts = [
    uad ? JSON.stringify([uad.brands, uad.platform, uad.mobile]) : n.userAgent,
    n.platform,
    n.languages.join(","),
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    `${screen.width}x${screen.height}x${screen.colorDepth}`,
    devicePixelRatio,
    n.maxTouchPoints,
    n.hardwareConcurrency,
    n.deviceMemory ?? "",
    webgl(),
    canvas(),
    audioRate(),
    matchMedia("(prefers-color-scheme: dark)").matches,
    matchMedia("(prefers-reduced-motion: reduce)").matches,
  ];
  const hw = await hardware().catch(() => ({}));
  return {
    ...hw,
    hash: await sha256(parts.join("|")),
    mobile: uad?.mobile ?? uaIsMobile(n.userAgent),
    platform: (uad?.platform || n.platform || "").slice(0, 32),
    browser: browserName(uad, n.userAgent),
    screen: `${screen.width}x${screen.height}@${Math.round(devicePixelRatio * 100) / 100}`,
    touch: n.maxTouchPoints > 0,
    webdriver: n.webdriver === true,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone?.slice(0, 64),
    lang: n.language?.slice(0, 35),
  };
}

/** `voteDay` du stockage local de l'application si un vote y est marqué validé, sinon null. */
function localVoteDay(): string | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const state = raw ? (JSON.parse(raw) as { state?: { voteCompleted?: boolean; voteDay?: string | null } }).state : undefined;
    return state?.voteCompleted && typeof state.voteDay === "string" ? state.voteDay : null;
  } catch {
    return null;
  }
}

let stable: Promise<Device> | null = null;
let startedAt: number | undefined;

/**
 * Signaux à joindre aux appels `vote-status`, `create` et `complete` ; jamais bloquant (200 ms au plus en
 * attente d'un moment creux, quelques millisecondes de calcul). Les jetons du stockage sont relus à chaque
 * appel (le serveur en remet un à l'ouverture de la session).
 */
export function deviceSignals(): Promise<Device> {
  if (typeof window === "undefined") return Promise.resolve({});
  startedAt ??= Date.now();
  stable ??= new Promise<Device>((resolve) => {
    const run = () => compute().then(resolve, () => resolve({}));
    if ("requestIdleCallback" in window) window.requestIdleCallback(run, { timeout: 200 });
    else setTimeout(run, 1);
  });
  return Promise.all([stable, readTokens()]).then(([d, tokens]) => ({ ...d, ...(tokens.length ? { tokens } : {}), localVoteDay: localVoteDay(), startedAt }));
}
