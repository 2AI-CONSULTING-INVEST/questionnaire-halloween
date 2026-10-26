// Badge rond 3D Chamas Tacos → favicon et icônes de l'app (src/app/favicon.ico, icon.png, apple-icon.png)
// et image du badge pour les aperçus de partage (scripts/3d/brand/out/badge.png).
// Usage : node scripts/3d/brand/render.mjs <racine du projet>
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");
const sharp = require("sharp");

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(process.argv[2] ?? ".");
const out = path.join(here, "out");
fs.mkdirSync(out, { recursive: true });
const types = { ".html": "text/html", ".js": "text/javascript", ".glb": "model/gltf-binary" };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split("?")[0]);
  const file = url === "/" ? path.join(here, "render.html") : path.join(root, url);
  if (url !== "/" && !file.startsWith(root)) return res.writeHead(403).end();
  fs.readFile(file, (err, data) => (err ? res.writeHead(404).end() : res.writeHead(200, { "Content-Type": types[path.extname(file)] ?? "application/octet-stream" }).end(data)));
});
await new Promise((r) => server.listen(5182, "127.0.0.1", r)); // jamais sur toutes les interfaces
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"] });
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 1200 });
page.on("pageerror", (e) => console.log("pageerror", e.message));
await page.goto("http://localhost:5182/", { waitUntil: "networkidle0" });
await page.waitForFunction(() => window.ready, { timeout: 60000 });
await page.evaluate(() => window.render(1024));
const raw = path.join(out, "badge-raw.png");
await (await page.$("canvas")).screenshot({ path: raw, omitBackground: true });
await browser.close();
server.close();

// Disque seul : les éclats de pierre au pied du modèle dépassent du cercle et décentreraient l'icône.
// Diamètre : la plus large rangée de la moitié haute (les éclats sont en bas) ; haut du cercle :
// première rangée visible.
const { data: px, info } = await sharp(raw).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const opaque = (x, y) => px[(y * info.width + x) * 4 + 3] > 8;
let top = 0;
while (top < info.height && ![...Array(info.width).keys()].some((x) => opaque(x, top))) top++;
let left = 0;
let right = -1;
for (let y = top; y < top + (info.height - top) * 0.5; y++) {
  let l = 0;
  let rr = info.width - 1;
  while (l < rr && !opaque(l, y)) l++;
  while (rr > l && !opaque(rr, y)) rr--;
  if (rr - l > right - left) [left, right] = [l, rr];
}
const r = (right - left + 1) / 2;
const cx = left + r;
const cy = top + r;
const side = Math.round(r * 2 * 1.08);
const x0 = Math.round(cx - side / 2);
const y0 = Math.round(cy - side / 2);
const disc = Buffer.from(`<svg width="${side}" height="${side}"><circle cx="${side / 2}" cy="${side / 2}" r="${r * 1.04}" fill="#fff"/></svg>`);
// (sharp découpe avant d'étendre dans une même chaîne : deux passes.)
const padded = await sharp(raw).extend({ top: side, bottom: side, left: side, right: side, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
const badge = await sharp(padded)
  .extract({ left: x0 + side, top: y0 + side, width: side, height: side })
  .composite([{ input: disc, blend: "dest-in" }])
  .png()
  .toBuffer();
fs.writeFileSync(path.join(out, "badge.png"), badge);

const appDir = path.join(root, "src", "app");
// Petites tailles un peu accentuées : le monogramme « CT » reste lisible dans l'onglet.
const square = (n) => {
  const img = sharp(badge).resize(n, n, { kernel: "lanczos3" });
  return (n <= 48 ? img.sharpen({ sigma: 0.6 }) : img).png({ compressionLevel: 9 }).toBuffer();
};
// icon.png : 512 px, fond transparent (onglets, Android, résultats de recherche).
fs.writeFileSync(path.join(appDir, "icon.png"), await square(512));
// apple-icon.png : 180 px, opaque (iOS remplit la transparence en noir) : fond de nuit du site.
fs.writeFileSync(
  path.join(appDir, "apple-icon.png"),
  await sharp({ create: { width: 180, height: 180, channels: 4, background: "#0c0a12" } })
    .composite([{ input: await sharp(badge).resize(156, 156).toBuffer(), gravity: "center" }])
    .png()
    .toBuffer(),
);
// favicon.ico : PNG 16, 32 et 48 px dans un même fichier ICO.
const sizes = [16, 32, 48];
const pngs = await Promise.all(sizes.map(square));
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
sizes.forEach((n, i) => {
  const e = 6 + 16 * i;
  header.writeUInt8(n, e);
  header.writeUInt8(n, e + 1);
  header.writeUInt8(0, e + 2);
  header.writeUInt8(0, e + 3);
  header.writeUInt16LE(1, e + 4);
  header.writeUInt16LE(32, e + 6);
  header.writeUInt32LE(pngs[i].length, e + 8);
  header.writeUInt32LE(offset, e + 12);
  offset += pngs[i].length;
});
fs.writeFileSync(path.join(appDir, "favicon.ico"), Buffer.concat([header, ...pngs]));
console.log("badge", side, "px → favicon.ico, icon.png, apple-icon.png");
