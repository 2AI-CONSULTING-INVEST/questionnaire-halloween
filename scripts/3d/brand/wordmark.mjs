// Logo long « CHAMAS TACOS » (version Halloween, pack logos.glb) en PNG transparent HD, recadré et
// compressé en palette : public/decor/wordmark.png (décor de la modale des lots).
// Usage : node scripts/3d/brand/wordmark.mjs <racine du projet>   (puppeteer-core, sharp, Chrome)
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
const types = { ".html": "text/html", ".js": "text/javascript", ".glb": "model/gltf-binary" };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split("?")[0]);
  const file = url === "/" ? path.join(here, "render.html") : path.join(root, url);
  if (url !== "/" && !file.startsWith(root)) return res.writeHead(403).end();
  fs.readFile(file, (err, data) => (err ? res.writeHead(404).end() : res.writeHead(200, { "Content-Type": types[path.extname(file)] ?? "application/octet-stream" }).end(data)));
});
await new Promise((r) => server.listen(5183, r));
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"] });
const page = await browser.newPage();
await page.setViewport({ width: 1800, height: 700 });
page.on("pageerror", (e) => console.log("pageerror", e.message));
await page.goto("http://localhost:5183/", { waitUntil: "networkidle0" });
await page.waitForFunction(() => window.ready, { timeout: 60000 });
await page.evaluate(() => window.renderObject("chamastacos_wordmark_halloween", 1600, 600));
const raw = await (await page.$("canvas")).screenshot({ omitBackground: true });
await browser.close();
server.close();
const out = path.join(root, "public/decor/wordmark.png");
await sharp(raw).trim({ threshold: 1 }).png({ palette: true, quality: 90, effort: 10 }).toFile(out);
const meta = await sharp(out).metadata();
console.log(`${out} : ${meta.width} × ${meta.height}, ${(fs.statSync(out).size / 1024).toFixed(0)} Ko`);
