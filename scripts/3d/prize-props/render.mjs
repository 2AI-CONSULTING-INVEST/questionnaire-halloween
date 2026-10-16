// Décor de la modale des lots (/participants, PrizesGallery) : pile de cadeaux (ceux de la clairière,
// createGift de src/components/scene/props.ts) avec le badge rond Chamas Tacos (logos.glb) adossé,
// grosses citrouilles-lanternes allumées (recette glow.ts) et petit squelette KayKit qui saute de joie.
// Rendus en PNG transparents ×2, recadrés, puis écrits en WebP (alpha) dans public/decor/prize-*.webp.
// (Les chauves-souris de la modale sont en 3D temps réel : src/app/(public)/participants/prize-bats.ts.)
// Variables : ONLY=gifts,pumpkins,jumper (jeux à rendre) ; POSE=<JSON> (réglages, voir
// render.html) ; RAW=<dossier> garde aussi les PNG bruts.
// Usage : node scripts/3d/prize-props/render.mjs <racine du projet> <dossier des packs>
//   packs : <dossier>/skeletons/KayKit_Skeletons_1.1_FREE (pack KayKit Skeletons 1.1 dézippé) ;
//   Halloween Bits est lu dans <racine>/KayKit_HalloweenBits_1.0_FREE. Nécessite puppeteer-core,
//   pngjs, sharp, typescript (déjà présents) et Chrome.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");
const { PNG } = require("pngjs");
const sharp = require("sharp");
const ts = require("typescript");

const here = path.dirname(fileURLToPath(import.meta.url));
const [rootArg, packsArg] = process.argv.slice(2);
const projectRoot = path.resolve(rootArg);
const packsRoot = path.resolve(packsArg);
const outDir = path.join(projectRoot, "public/decor");
const types = { ".html": "text/html", ".js": "text/javascript", ".ts": "text/javascript", ".gltf": "model/gltf+json", ".glb": "model/gltf-binary", ".bin": "application/octet-stream", ".png": "image/png" };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split("?")[0]);
  let file;
  if (url === "/") file = path.join(here, "render.html");
  else if (url.startsWith("/packs/")) file = path.join(packsRoot, url.slice(7));
  else file = path.join(projectRoot, url);
  if (url !== "/" && !file.startsWith(projectRoot) && !file.startsWith(packsRoot)) return res.writeHead(403).end();
  fs.readFile(file, (err, data) => {
    if (err) {
      if (!/favicon/.test(url)) console.log("404", url);
      return res.writeHead(404).end();
    }
    // Modules du site (props.ts, glow.ts…) : transpilés à la volée, imports relatifs complétés en .ts.
    if (file.endsWith(".ts")) {
      const js = ts.transpileModule(data.toString(), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
      data = js.replace(/from "(\.\/[\w-]+)"/g, 'from "$1.ts"');
    }
    res.writeHead(200, { "Content-Type": types[path.extname(file)] ?? "application/octet-stream" }).end(data);
  });
});
await new Promise((r) => server.listen(5184, r));
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"] });
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 1400, deviceScaleFactor: 2 });
page.on("pageerror", (e) => console.log("pageerror", e.message));
page.on("console", (m) => m.type() === "error" && console.log("console", m.text()));
await page.goto("http://localhost:5184/", { waitUntil: "networkidle0" });
await page.waitForFunction(() => window.ready, { timeout: 60000 });
if (process.env.POSE) await page.evaluate((p) => (window.POSE = JSON.parse(p)), process.env.POSE);
const keys = process.env.ONLY ? process.env.ONLY.split(",") : await page.evaluate(() => Object.keys(window.SETS));

/** Recadre un PNG sur ses pixels visibles. */
function crop(buf) {
  const p = PNG.sync.read(buf);
  let x0 = p.width, y0 = p.height, x1 = 0, y1 = 0;
  for (let y = 0; y < p.height; y++) for (let x = 0; x < p.width; x++) if (p.data[(y * p.width + x) * 4 + 3] > 6) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const o = new PNG({ width: x1 - x0 + 1, height: y1 - y0 + 1 });
  PNG.bitblt(p, o, x0, y0, o.width, o.height, 0, 0);
  return PNG.sync.write(o);
}

for (const key of keys) {
  const file = path.join(outDir, `prize-${key}.webp`);
  await page.evaluate((k) => window.renderSet(k), key);
  const raw = Buffer.from(await (await page.$("canvas")).screenshot({ omitBackground: true }));
  if (process.env.RAW) fs.writeFileSync(path.join(process.env.RAW, `prize-${key}-raw.png`), raw);
  await sharp(crop(raw)).webp({ quality: 86, alphaQuality: 90, effort: 6 }).toFile(file);
  const m = await sharp(file).metadata();
  console.log(`${path.relative(projectRoot, file)} : ${m.width} × ${m.height}, ${(fs.statSync(file).size / 1024).toFixed(0)} Ko`);
}
await browser.close();
server.close();
