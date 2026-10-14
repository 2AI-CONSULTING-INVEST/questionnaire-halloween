// Décor de la modale du classement : motte de terre garnie d'assets KayKit + poteau-lanterne.
// Rendus en PNG transparents (recadrés), avec la position des points utiles (flamme, crête).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { PNG } = require("pngjs");

const here = path.dirname(fileURLToPath(import.meta.url));
const [rootArg, packsArg, outDir] = process.argv.slice(2);
const projectRoot = path.resolve(rootArg);
const packsRoot = path.resolve(packsArg);
const types = { ".html": "text/html", ".js": "text/javascript", ".gltf": "model/gltf+json", ".bin": "application/octet-stream", ".png": "image/png" };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split("?")[0]);
  let file;
  if (url === "/") file = path.join(here, "render.html");
  else if (url.startsWith("/packs/")) file = path.join(packsRoot, url.slice(7));
  else file = path.join(projectRoot, url);
  if (url !== "/" && !file.startsWith(projectRoot) && !file.startsWith(packsRoot)) return res.writeHead(403).end();
  fs.readFile(file, (err, data) => {
    if (err) return res.writeHead(404).end();
    res.writeHead(200, { "Content-Type": types[path.extname(file)] ?? "application/octet-stream" }).end(data);
  });
});
await new Promise((r) => server.listen(5180, r));
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"] });
const page = await browser.newPage();
// Capture à la définition du rendu (pixelRatio 2) : sans ça, l'image sort à moitié de sa définition.
await page.setViewport({ width: 1600, height: 2100, deviceScaleFactor: 2 });
page.on("pageerror", (e) => console.log("pageerror", e.message));
await page.goto("http://localhost:5180/", { waitUntil: "networkidle0" });
await page.waitForFunction(() => window.ready);
const meta = {};
const crops = {};
for (const key of (process.env.ONLY ? [process.env.ONLY] : ["mound", "post", "lamp"])) {
  const info = await page.evaluate((k) => window.renderSet(k), key);
  const raw = path.join(outDir, `${key}-raw.png`);
  await (await page.$("canvas")).screenshot({ path: raw, omitBackground: true });
  // Recadrage aux pixels visibles ; les points mesurés sont convertis dans l'image recadrée.
  const p = PNG.sync.read(fs.readFileSync(raw));
  let x0 = p.width, y0 = p.height, x1 = 0, y1 = 0;
  for (let y = 0; y < p.height; y++) for (let x = 0; x < p.width; x++) if (p.data[(y * p.width + x) * 4 + 3] > 8) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const o = new PNG({ width: x1 - x0 + 1, height: y1 - y0 + 1 });
  PNG.bitblt(p, o, x0, y0, o.width, o.height, 0, 0);
  fs.writeFileSync(path.join(outDir, `modal-${key}.png`), PNG.sync.write(o));
  const rel = (pt) => [+(((pt[0] * 2 - x0) / o.width) * 100).toFixed(2), +(((pt[1] * 2 - y0) / o.height) * 100).toFixed(2)];
  crops[key] = { x0, y0, w: o.width, h: o.height };
  meta[key] = { width: o.width, height: o.height, ...Object.fromEntries(Object.entries(info).map(([k, v]) => [k, rel(v)])) };
}
// Lanterne : son cadre dans l'image du poteau (en % de celle-ci), pour la poser au même endroit.
if (crops.post && crops.lamp) {
  const { post: P, lamp: L } = crops;
  const pct = (v, n) => +((v / n) * 100).toFixed(2);
  meta.lamp.inPost = { left: pct(L.x0 - P.x0, P.w), top: pct(L.y0 - P.y0, P.h), width: pct(L.w, P.w), height: pct(L.h, P.h) };
}
console.log(JSON.stringify(meta, null, 1));
await browser.close();
server.close();
