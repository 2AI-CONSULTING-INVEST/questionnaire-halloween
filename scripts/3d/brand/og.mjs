// Images d'aperçu des liens partagés (Open Graph / X / WhatsApp…), 1200 × 630 :
//   src/app/opengraph-image.jpg                    (accueil, et toutes les pages par défaut)
//   src/app/(public)/resultats/opengraph-image.jpg (résultats en direct)
// Fond : une capture de la scène 3D sans l'interface (out/bg-home.png, out/bg-results.png) et deux
// lignes de texte, rien d'autre (volontairement sobre).
// Usage : node scripts/3d/brand/og.mjs <racine du projet> [--capture http://localhost:3000]
//   --capture refait les fonds depuis le serveur de dev : vérifiez ensuite que la crypte est bien
//   cadrée, panneau encore poussiéreux (délais CRYPT_DELAY / HOME_DELAY en ms selon la machine).
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
const captureFrom = process.argv.includes("--capture") ? process.argv[process.argv.indexOf("--capture") + 1] : null;
const chrome = { executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"] };

if (captureFrom) {
  // Scène seule : on masque toute l'interface de la page.
  const browser = await puppeteer.launch(chrome);
  for (const [route, file, delay] of [["/", "bg-home.png", +(process.env.HOME_DELAY ?? 20000)], ["/resultats", "bg-results.png", +(process.env.CRYPT_DELAY ?? 20500)]]) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 630 });
    await page.goto(captureFrom + route, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.addStyleTag({ content: "main, header, nav, footer, button, a, h1, p, nextjs-portal, [role=dialog] { visibility: hidden !important; }" });
    await new Promise((r) => setTimeout(r, delay));
    await page.screenshot({ path: path.join(out, file) });
    await page.close();
  }
  await browser.close();
}

const CARDS = [
  {
    file: path.join(root, "src/app/opengraph-image.jpg"),
    bg: "bg-home.png",
    l1: "Chamas Tacos",
    l2: "Jeux concours Halloween",
    alt: "Chamas Tacos : jeux concours Halloween.",
  },
  {
    file: path.join(root, "src/app/(public)/resultats/opengraph-image.jpg"),
    bg: "bg-results.png",
    l1: "Chamas Tacos",
    l2: "Jeux concours Halloween",
    alt: "Chamas Tacos : jeux concours Halloween, résultats en direct.",
  },
];

const types = { ".html": "text/html", ".png": "image/png" };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split("?")[0]);
  const file = url === "/" ? path.join(here, "og.html") : path.join(out, path.basename(url));
  fs.readFile(file, (err, data) => (err ? res.writeHead(404).end() : res.writeHead(200, { "Content-Type": types[path.extname(file)] ?? "application/octet-stream" }).end(data)));
});
await new Promise((r) => server.listen(5183, r));
const browser = await puppeteer.launch(chrome);
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 630 });
for (const card of CARDS) {
  await page.goto("http://localhost:5183/", { waitUntil: "networkidle0" });
  await page.evaluate((c) => window.fill(c), { l1: card.l1, l2: card.l2, bg: card.bg });
  const png = await page.screenshot({ type: "png" });
  fs.writeFileSync(card.file, await sharp(png).jpeg({ quality: 86, mozjpeg: true }).toBuffer());
  fs.writeFileSync(card.file.replace(/\.jpg$/, ".alt.txt"), card.alt);
  console.log(path.relative(root, card.file));
}
await browser.close();
server.close();
