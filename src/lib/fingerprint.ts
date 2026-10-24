"use client";

import { uaBrowser } from "./risk";
import type { Device } from "./schema";

/**
 * Signaux d'appareil pour le score de risque anti-revote (navigateur uniquement). Calculés une fois
 * par session, hors du fil principal (requestIdleCallback), en quelques millisecondes ; toute erreur
 * donne un signal vide : le vote reste possible. Le serveur ne reçoit qu'un condensé SHA-256 (jamais
 * les valeurs brutes) et quelques attributs grossiers. Aucune permission demandée, rien d'intrusif.
 */

const STORE_KEY = "chamas-halloween-2026-v2";

type UaData = { brands: { brand: string; version: string }[]; platform: string; mobile: boolean };
const nav = () => navigator as Navigator & { userAgentData?: UaData; deviceMemory?: number };

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
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(parts.join("|")));
  return {
    hash: [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join(""),
    mobile: uad?.mobile ?? uaIsMobile(n.userAgent),
    platform: (uad?.platform || n.platform || "").slice(0, 32),
    browser: browserName(uad, n.userAgent),
    screen: `${screen.width}x${screen.height}@${Math.round(devicePixelRatio * 100) / 100}`,
    touch: n.maxTouchPoints > 0,
    webdriver: n.webdriver === true,
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

/** Signaux à joindre aux appels `create` et `complete` ; jamais bloquant (200 ms au plus en attente d'un moment creux). */
export function deviceSignals(): Promise<Device> {
  if (typeof window === "undefined") return Promise.resolve({});
  startedAt ??= Date.now();
  stable ??= new Promise<Device>((resolve) => {
    const run = () => compute().then(resolve, () => resolve({}));
    if ("requestIdleCallback" in window) window.requestIdleCallback(run, { timeout: 200 });
    else setTimeout(run, 1);
  });
  return stable.then((d) => ({ ...d, localVoteDay: localVoteDay(), startedAt }));
}
