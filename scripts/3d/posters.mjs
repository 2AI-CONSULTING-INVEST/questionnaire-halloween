// Posters de la scène d'arrivée : capture du vrai rendu 3D (ciel CSS + canvas, sans interface, sans le
// voile central ni le poster lui-même), juste après l'affichage du décor (temps de la scène ≈ 0, pose
// de départ de la caméra), pour chaque page (accueil = cimetière, /participants = clairière,
// /resultats = crypte avant la révélation), chaque thème et chaque format. Images AVIF + WebP dans
// public/poster/, règles CSS dans src/app/posters.css (affichées par SpookyBackdrop, préchargées par
// le script de tête du layout).
// Usage : node scripts/3d/posters.mjs <racine du projet> [url du site, défaut http://localhost:3100/halloween] [--css]
//   Le site doit tourner (next start) en stockage local. --css : écrit seulement posters.css.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const args = process.argv.slice(2);
const root = path.resolve(args[0] ?? ".");
const base = args.find((a) => a.startsWith("http")) ?? "http://localhost:3100/halloween";
const cssOnly = args.includes("--css");
const BASE_PATH = "/halloween";

const SCENES = [
  ["graveyard", ""],
  ["reaper", "/participants"],
  ["crypt", "/resultats"],
];
const THEMES = ["dark", "light"];
// Formats : cadrage calculé par le monde 3D selon le rapport largeur / hauteur ; même règle que posterScript (layout.tsx).
const FORMATS = [
  { name: "land", w: 1440, h: 900, dpr: 1, media: null }, // paysage (3/4 < rapport < 17/10)
  { name: "wide", w: 1600, h: 900, dpr: 1, media: "(min-aspect-ratio: 17/10)" }, // paysage large (16/9)
  { name: "port", w: 390, h: 844, dpr: 2, media: "(max-aspect-ratio: 3/4)" }, // portrait (téléphone)
];

// ----- CSS -----
const url = (scene, theme, f, ext) => `${BASE_PATH}/poster/${scene}-${theme}-${f}.${ext}`;
const rule = (sel, scene, theme, f) =>
  `${sel} { background-image: url("${url(scene, theme, f, "webp")}"); background-image: image-set(url("${url(scene, theme, f, "avif")}") type("image/avif"), url("${url(scene, theme, f, "webp")}") type("image/webp")); }`;
const block = (f) =>
  SCENES.flatMap(([scene]) => THEMES.map((theme) => rule(`${theme === "light" ? '[data-theme="light"] ' : ""}.sky-poster[data-scene="${scene}"]`, scene, theme, f.name))).join("\n");
const css = `/* Généré par scripts/3d/posters.mjs : posters de la scène d'arrivée (voir SpookyBackdrop). Ne pas modifier à la main. */
.sky-poster {
  position: fixed;
  inset: 0;
  z-index: 0;
  width: 100vw;
  height: 100lvh;
  pointer-events: none;
  background: center / cover no-repeat;
  transition: opacity 500ms ease;
}
.sky-poster[data-gone] { opacity: 0; }
${block(FORMATS[0])}
${FORMATS.slice(1)
  .map((f) => `@media ${f.media} {\n${block(f).replace(/^/gm, "  ")}\n}`)
  .join("\n")}
`;
fs.writeFileSync(path.join(root, "src/app/posters.css"), css);
console.log("src/app/posters.css écrit");
if (cssOnly) process.exit(0);

// ----- Captures -----
const puppeteer = require("puppeteer-core");
const sharp = require("sharp");
const out = path.join(root, "public/poster");
fs.mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"] });
const sizes = [];
for (const [scene, route] of SCENES) {
  for (const theme of THEMES) {
    for (const f of FORMATS) {
      const ctx = await browser.createBrowserContext();
      const page = await ctx.newPage();
      await page.setViewport({ width: f.w, height: f.h, deviceScaleFactor: f.dpr });
      page.on("pageerror", (e) => console.log("pageerror", e.message));
      await page.evaluateOnNewDocument((t) => {
        try {
          localStorage.setItem("chamas-theme", t);
        } catch {}
      }, theme);
      await page.goto(base + route, { waitUntil: "domcontentloaded", timeout: 180000 });
      // Canvas affiché d'un coup (pas de fondu) : la capture montre la scène opaque, comme une fois le fondu terminé.
      await page.addStyleTag({ content: "main, nextjs-portal, .hw-rail, .sky-scrim, .sky-poster { visibility: hidden !important; } .sky-canvas { transition: none !important; }" });
      await page.waitForFunction(() => document.querySelector("canvas.sky-canvas")?.hasAttribute("data-ready"), { timeout: 180000, polling: 50 });
      // Deux images rendues, puis capture immédiate (temps de la scène ≈ 0).
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      const png = await page.screenshot({ type: "png" });
      const name = `${scene}-${theme}-${f.name}`;
      await sharp(png).avif({ quality: 50, effort: 6 }).toFile(path.join(out, `${name}.avif`));
      await sharp(png).webp({ quality: 72, effort: 6 }).toFile(path.join(out, `${name}.webp`));
      sizes.push(`${name} : ${f.w * f.dpr}×${f.h * f.dpr}, AVIF ${(fs.statSync(path.join(out, `${name}.avif`)).size / 1024).toFixed(0)} Ko, WebP ${(fs.statSync(path.join(out, `${name}.webp`)).size / 1024).toFixed(0)} Ko`);
      console.log(sizes.at(-1));
      await ctx.close();
    }
  }
}
await browser.close();
