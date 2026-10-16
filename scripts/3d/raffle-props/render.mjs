// Décor de la modale « Vérifiez vos coordonnées » : squelette paniqué devant un panneau « attention »,
// petite motte (pierre tombale, main squelette qui sort de la terre) — rendus KayKit en PNG
// transparents recadrés, définition ×2 (public/decor/raffle-*.png). Le poteau et sa lanterne sont
// ceux de la modale du classement (modal-post.png, modal-lamp.png).
// Variables : ONLY=inspector,mound (jeux à rendre) ; POSE=<JSON> (réglages de pose, voir render.html) ;
// KEEP_RAW=1 garde le rendu brut non recadré (contrôle des mains à fort grossissement).
// Usage : node scripts/3d/raffle-props/render.mjs <racine du projet> <dossier des packs> <sortie>
//   packs : <dossier>/skeletons/KayKit_Skeletons_1.1_FREE (pack KayKit Skeletons 1.1 dézippé) ;
//   <dossier>/Forest_Nature_Pack_1.0/KayKit_Forest_Nature_Pack_1.0_FREE (herbes, rochers) ;
//   Halloween Bits est lu dans <racine>/KayKit_HalloweenBits_1.0_FREE. Nécessite puppeteer-core, pngjs, Chrome.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");
const { PNG } = require("pngjs");

const here = path.dirname(fileURLToPath(import.meta.url));
const [rootArg, packsArg, outDir] = process.argv.slice(2);
const projectRoot = path.resolve(rootArg);
const packsRoot = path.resolve(packsArg);
const types = { ".html": "text/html", ".js": "text/javascript", ".gltf": "model/gltf+json", ".glb": "model/gltf-binary", ".bin": "application/octet-stream", ".png": "image/png" };
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
    res.writeHead(200, { "Content-Type": types[path.extname(file)] ?? "application/octet-stream" }).end(data);
  });
});
await new Promise((r) => server.listen(5181, r));
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"] });
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 1400, deviceScaleFactor: 2 });
page.on("pageerror", (e) => console.log("pageerror", e.message));
page.on("console", (m) => m.type() === "error" && console.log("console", m.text()));
await page.goto("http://localhost:5181/", { waitUntil: "networkidle0" });
await page.waitForFunction(() => window.ready);
if (process.env.POSE) await page.evaluate((p) => (window.POSE = JSON.parse(p)), process.env.POSE);
const keys = process.env.ONLY ? process.env.ONLY.split(",") : await page.evaluate(() => Object.keys(window.SETS));
const meta = {};
for (const key of keys) {
  const info = await page.evaluate((k) => window.renderSet(k), key);
  const name = await page.evaluate((k) => window.SETS[k].file ?? `raffle-${k}`, key);
  const raw = path.join(outDir, `${name}-raw.png`);
  await (await page.$("canvas")).screenshot({ path: raw, omitBackground: true });
  const p = PNG.sync.read(fs.readFileSync(raw));
  let x0 = p.width, y0 = p.height, x1 = 0, y1 = 0;
  for (let y = 0; y < p.height; y++) for (let x = 0; x < p.width; x++) if (p.data[(y * p.width + x) * 4 + 3] > 8) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const o = new PNG({ width: x1 - x0 + 1, height: y1 - y0 + 1 });
  PNG.bitblt(p, o, x0, y0, o.width, o.height, 0, 0);
  fs.writeFileSync(path.join(outDir, `${name}.png`), PNG.sync.write(o));
  if (!process.env.KEEP_RAW) fs.unlinkSync(raw);
  if (process.env.DEBUG) console.log(key, await page.evaluate(() => JSON.stringify(window.debug ?? null)));
  const rel = (pt) => [+(((pt[0] * 2 - x0) / o.width) * 100).toFixed(2), +(((pt[1] * 2 - y0) / o.height) * 100).toFixed(2)];
  meta[key] = { width: o.width, height: o.height, ...Object.fromEntries(Object.entries(info).map(([k, v]) => [k, rel(v)])) };
}
console.log(JSON.stringify(meta, null, 1));
await browser.close();
server.close();
