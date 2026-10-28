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
    // Sans l'extension, VENDOR et RENDERER (Firefox les renvoie généralisés, fabricant compris).
    const renderer = info ? `${gl.getParameter(info.UNMASKED_VENDOR_WEBGL)}/${gl.getParameter(info.UNMASKED_RENDERER_WEBGL)}` : `${gl.getParameter(gl.VENDOR)}/${gl.getParameter(gl.RENDERER)}`;
    const params = [gl.MAX_TEXTURE_SIZE, gl.MAX_RENDERBUFFER_SIZE, gl.MAX_VIEWPORT_DIMS, gl.MAX_VERTEX_ATTRIBS, gl.MAX_VERTEX_UNIFORM_VECTORS, gl.MAX_FRAGMENT_UNIFORM_VECTORS, gl.ALIASED_POINT_SIZE_RANGE]
      .map((p) => String(gl.getParameter(p)))
      .join(",");
    return { renderer, params };
  } catch {
    return { renderer: "", params: "" };
  }
}

/**
 * Fabricant de la carte graphique, normalisé (fonction pure, testée) : seul ce que Chrome et Edge (ANGLE,
 * « Google Inc. (Intel) ») et Firefox (renderer généralisé, fabricant gardé) donnent de la même façon.
 * Rendu logiciel, masqué ou inconnu : « autre ».
 */
export function gpuVendor(renderer: string): string {
  const r = renderer.toLowerCase();
  if (/swiftshader|llvmpipe|microsoft basic render|^(mozilla|webkit)\/(mozilla|webkit webgl)$/.test(r)) return "autre";
  if (/nvidia|geforce|quadro|rtx/.test(r)) return "nvidia";
  if (/\bamd\b|radeon|\bati\b/.test(r)) return "amd";
  if (/intel/.test(r)) return "intel";
  if (/apple/.test(r)) return "apple";
  if (/qualcomm|adreno/.test(r)) return "qualcomm";
  if (/\bmali\b|\barm\b/.test(r)) return "arm";
  return "autre";
}

/**
 * Ordinateur, côté navigateur : même logique que `isComputer` du serveur (voter.ts). Windows, Linux,
 * ChromeOS, ou Macintosh sans écran tactile (un iPad en mode « ordinateur » s'annonce Macintosh), jamais « Mobile ».
 */
export function isComputerUa(userAgent: string, maxTouchPoints: number): boolean {
  if (/Android|iPhone|iPad|iPod|Mobile/.test(userAgent)) return false;
  if (/Macintosh/.test(userAgent)) return maxTouchPoints === 0; // comme le serveur : écran tactile déclaré = tablette
  return /Windows NT|X11|CrOS/.test(userAgent);
}

/**
 * Écran dans la clé matérielle : téléphones seulement (un seul écran). Sur ordinateur, `screen` et
 * `devicePixelRatio` sont ceux de l'écran qui affiche la fenêtre : la glisser sur un second écran, brancher
 * ou débrancher un portable changerait la clé.
 */
export const hwScreen = (computer: boolean, width: number, height: number, dpr: number, colorDepth: number) =>
  computer ? "" : `${physicalPx(width, dpr)}x${physicalPx(height, dpr)}x${colorDepth}`;

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
      // Téléphones : écran physique (ni `devicePixelRatio` seul ni la hauteur disponible). Ordinateurs : aucun écran.
      hwScreen(isComputerUa(n.userAgent, n.maxTouchPoints), screen.width, screen.height, devicePixelRatio, screen.colorDepth),
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

/** Famille de système, la même dans tous les navigateurs d'un appareil (iPad en mode « ordinateur » : iOS). */
export function osFamily(userAgent: string, uadPlatform: string | undefined, appleMobile: boolean): string {
  const s = `${uadPlatform ?? ""} ${userAgent}`;
  if (appleMobile || /iPhone|iPad|iPod|\biOS\b/.test(s)) return "ios";
  if (/Android/.test(s)) return "android";
  if (/CrOS|Chrome OS/.test(s)) return "chromeos";
  if (/Windows/.test(s)) return "windows";
  if (/Macintosh|macOS|Mac OS/.test(s)) return "macos";
  if (/Linux|X11/.test(s)) return "linux";
  return "autre";
}

/**
 * Texte de la clé inter-navigateurs (fonction pure, testée), condensé en `xKey` (règle B4) : seulement des
 * valeurs que Chrome, Edge, Firefox et Safari exposent de la même façon. Système, définition physique de
 * l'écran, processeurs plafonnés à 8 (Safari plafonne, Firefox s'arrête à 16), fuseau, écran tactile ou non.
 * Exclus : carte graphique (masquée par Firefox et Safari), mémoire (absente hors Chromium), langues
 * (Edge et Chrome diffèrent), profondeur de couleur (30 bits sous Chrome sur écran large gamme, 24 ailleurs),
 * navigateur et version. Firefox en mode résistance falsifie ces valeurs : clé différente, aucun lien.
 */
export function crossBrowserText(i: { os: string; width: number; height: number; dpr: number; cores: number; tz: string; touchPoints: number }): string {
  return [i.os, `${physicalPx(i.width, i.dpr)}x${physicalPx(i.height, i.dpr)}`, Math.min(i.cores || 0, 8), i.tz, i.touchPoints > 0].join("|");
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

/**
 * Polices testées pour la clé stricte (145) : système, Office, Adobe, LibreOffice et polices courantes.
 * Ce qui est installé révèle une partie des logiciels présents. Exclues : toute police qu'un navigateur
 * peut embarquer ou exposer lui-même (Edge expose Roboto que Chrome ne voit pas sur le même poste ; Noto,
 * Open Sans, Twemoji Mozilla et polices propres à Firefox ; polices Google et polices de développement
 * souvent livrées avec des applications web ou installées par profil ; Aptos, police Office « cloud »
 * installée par utilisateur ; Segoe UI Emoji, remplacée par certains navigateurs).
 */
export const FONT_LIST = [
  "Arial Black", "Arial Narrow", "Bahnschrift", "Calibri", "Calibri Light", "Cambria", "Cambria Math", "Candara",
  "Cascadia Code", "Cascadia Mono", "Comic Sans MS", "Consolas", "Constantia", "Corbel", "Ebrima", "Franklin Gothic Medium",
  "Gabriola", "Gadugi", "HoloLens MDL2 Assets", "Ink Free", "Javanese Text", "Leelawadee UI", "Lucida Console", "Lucida Sans Unicode",
  "Malgun Gothic", "Marlett", "Microsoft Himalaya", "Microsoft JhengHei", "Microsoft New Tai Lue", "Microsoft PhagsPa", "Microsoft Sans Serif", "Microsoft Tai Le",
  "Microsoft YaHei", "Microsoft Yi Baiti", "MingLiU-ExtB", "Mongolian Baiti", "MS Gothic", "MV Boli", "Myanmar Text", "Nirmala UI",
  "Palatino Linotype", "Segoe Fluent Icons", "Segoe MDL2 Assets", "Segoe Print", "Segoe Script", "Segoe UI", "Segoe UI Historic", "Segoe UI Variable",
  "SimSun", "Sitka Text", "Sylfaen", "Tahoma", "Trebuchet MS", "Verdana", "Yu Gothic", "Georgia",
  "Impact", "Webdings", "Wingdings", "Agency FB", "Algerian", "Bauhaus 93", "Bell MT", "Berlin Sans FB",
  "Bernard MT Condensed", "Book Antiqua", "Bookman Old Style", "Britannic Bold", "Broadway", "Brush Script MT", "Californian FB", "Castellar",
  "Century", "Century Gothic", "Century Schoolbook", "Colonna MT", "Cooper Black", "Copperplate Gothic Bold", "Curlz MT", "Edwardian Script ITC",
  "Elephant", "Engravers MT", "Footlight MT Light", "Forte", "Freestyle Script", "French Script MT", "Garamond", "Gill Sans MT",
  "Gloucester MT Extra Condensed", "Goudy Old Style", "Haettenschweiler", "Harlow Solid Italic", "High Tower Text", "Jokerman", "Kristen ITC", "Lucida Bright",
  "Lucida Calligraphy", "Lucida Handwriting", "Magneto", "Matura MT Script Capitals", "Mistral", "Monotype Corsiva", "Niagara Solid", "Old English Text MT",
  "Onyx", "Papyrus", "Perpetua", "Playbill", "Rockwell", "Showcard Gothic", "Snap ITC", "Stencil",
  "Tw Cen MT", "Vivaldi", "Wide Latin", "Myriad Pro", "Minion Pro", "Adobe Garamond Pro", "Adobe Caslon Pro", "Kozuka Gothic Pr6N",
  "Liberation Sans", "Liberation Serif", "Liberation Mono", "DejaVu Sans", "DejaVu Serif", "DejaVu Sans Mono", "Linux Libertine G", "Menlo",
  "Monaco", "Helvetica Neue", "Avenir", "Avenir Next", "Futura", "Gill Sans", "Optima", "Didot",
  "Baskerville", "Hoefler Text", "Lucida Grande", "American Typewriter", "Chalkboard", "Marker Felt", "Apple Chancery", "Skia",
  "SF Pro",
];
const FONT_BASES = ["monospace", "sans-serif", "serif"] as const;
const FONT_TEXT = "mmmmmmmmmmlli1WQ@#&";

/** Polices installées (fonction pure, testée) : une police est présente si elle change la largeur d'une des trois polices de repli. */
export function installedFonts(measure: (font: string) => number, list: readonly string[] = FONT_LIST): string[] {
  const base = FONT_BASES.map((b) => measure(`72px ${b}`));
  return list.filter((f) => FONT_BASES.some((b, i) => measure(`72px "${f}", ${b}`) !== base[i]));
}

/**
 * Clé stricte calculable : ordinateurs dont la liste des polices est la même d'un navigateur à l'autre.
 * Windows, Linux, ChromeOS : Chrome, Edge et Firefox voient les mêmes polices système (Firefox en
 * protection stricte ou en navigation privée n'en montre qu'une partie : clé différente, aucun lien).
 * macOS : Safari ne montre que les polices de base, pas celles installées par l'utilisateur ; Chrome et
 * Firefox les montrent : pas de clé stricte sous Safari. Téléphones : aucune.
 */
export function strictEligible(os: string, userAgent: string): boolean {
  if (os === "windows" || os === "linux" || os === "chromeos") return true;
  return os === "macos" && !(/Safari\//.test(userAgent) && !/Chrome\/|Chromium\/|Firefox\/|Edg\//.test(userAgent));
}

/** Mesure des polices dans un canvas hors écran ; quelques millisecondes, jamais d'erreur visible. */
function fontsOnCanvas(): string[] | null {
  try {
    const ctx = document.createElement("canvas").getContext("2d");
    if (!ctx) return null;
    return installedFonts((font) => {
      ctx.font = font;
      return ctx.measureText(FONT_TEXT).width;
    });
  } catch {
    return null;
  }
}

/**
 * Texte de la clé stricte (fonction pure, testée) : famille d'OS, processeurs plafonnés à 8, fuseau, écran
 * tactile ou non, fabricant de la carte graphique et polices installées. Aucune dimension d'écran ni
 * `devicePixelRatio` : ce sont ceux de l'écran qui affiche la fenêtre (deux écrans, portable branché ou non).
 */
export function strictText(i: { os: string; cores: number; tz: string; touchPoints: number; gpu: string; fonts: string[] }): string {
  return [i.os, Math.min(i.cores || 0, 8), i.tz, i.touchPoints > 0, i.gpu, i.fonts.join(",")].join("|");
}

/**
 * Clé stricte (`mKey`), sur les ordinateurs où elle est stable. Les voix de synthèse ne sont pas retenues : sous Windows, Chrome et Edge listent les voix
 * OneCore, Firefox les voix SAPI (noms et listes différents), elles casseraient la clé d'un navigateur à
 * l'autre. Calculée au chargement avec l'empreinte (promesse partagée), jamais au clic.
 */
async function strictKey(os: string, n: ReturnType<typeof nav>): Promise<{ mKey?: string }> {
  if (!strictEligible(os, n.userAgent)) return {};
  const fonts = fontsOnCanvas();
  if (!fonts || !fonts.length) return {};
  const text = strictText({
    os,
    cores: n.hardwareConcurrency,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
    touchPoints: n.maxTouchPoints,
    gpu: gpuVendor(webglStable().renderer),
    fonts,
  });
  return { mKey: await sha256(text) };
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
  const os = osFamily(n.userAgent, uad?.platform, isAppleMobile());
  const xText = crossBrowserText({
    os,
    width: screen.width,
    height: screen.height,
    dpr: devicePixelRatio,
    cores: n.hardwareConcurrency,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
    touchPoints: n.maxTouchPoints,
  });
  return {
    ...hw,
    hash: await sha256(parts.join("|")),
    xKey: await sha256(xText),
    ...(await strictKey(os, n)),
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
