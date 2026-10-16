// Passages calmes des musiques (public/son) : décode chaque mp3 dans Chrome (decodeAudioData), calcule
// le RMS par fenêtre de 1 s et le « mordant » (montée brusque d'une fenêtre à l'autre), puis retient,
// par morceau, jusqu'à 3 plages de 20 à 45 s (les morceaux font 1 min 30 et 1 min 54) parmi les moins bruyantes et les moins agressives, sans
// chevauchement. Résultat à recopier dans src/components/sound/engine.ts (MUSIC_SEGMENTS).
// Usage : node scripts/audio/music-segments.mjs <racine du projet>   (puppeteer-core et Chrome requis)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");

const root = path.resolve(process.argv[2] ?? ".");
const TRACKS = ["geoff-harvey-diabolus.mp3", "soundore-background-horror.mp3"];
const server = http.createServer((req, res) => {
  const name = decodeURIComponent(req.url.slice(1));
  if (req.url === "/") return res.writeHead(200, { "Content-Type": "text/html" }).end("<!doctype html><title>analyse</title>");
  if (!TRACKS.includes(name)) return res.writeHead(404).end();
  res.writeHead(200, { "Content-Type": "audio/mpeg" }).end(fs.readFileSync(path.join(root, "public/son", name)));
});
await new Promise((r) => server.listen(5191, r));
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new" });
const page = await browser.newPage();
await page.goto("http://localhost:5191/");

const result = {};
for (const [index, name] of TRACKS.entries()) {
  // RMS (dBFS) et crête par fenêtre de 1 s, canaux mélangés.
  const { duration, rms, peak } = await page.evaluate(async (name) => {
    const buf = await (await fetch("/" + name)).arrayBuffer();
    const audio = await new OfflineAudioContext(2, 44100, 44100).decodeAudioData(buf);
    const n = audio.sampleRate;
    const chans = [...Array(audio.numberOfChannels).keys()].map((c) => audio.getChannelData(c));
    const rms = [], peak = [];
    for (let w = 0; w + n <= audio.length; w += n) {
      let s = 0, p = 0;
      for (let i = w; i < w + n; i++) {
        let v = 0;
        for (const ch of chans) v += ch[i];
        v /= chans.length;
        s += v * v;
        p = Math.max(p, Math.abs(v));
      }
      rms.push(20 * Math.log10(Math.sqrt(s / n) + 1e-9));
      peak.push(20 * Math.log10(p + 1e-9));
    }
    return { duration: audio.duration, rms, peak };
  }, name);
  const sorted = [...rms].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  // Score d'une fenêtre : son niveau, plus une pénalité pour une attaque (montée > 3 dB).
  const score = rms.map((v, i) => v + 1.5 * Math.max(0, v - (rms[i - 1] ?? v) - 3));
  const taken = new Array(rms.length).fill(false);
  const segments = [];
  for (let k = 0; k < 3; k++) {
    let best = null;
    for (let len = 20; len <= 45; len += 5)
      for (let s = 2; s + len <= rms.length - 1; s++) {
        if (taken.slice(s - 2, s + len + 2).some(Boolean)) continue;
        const win = rms.slice(s, s + len);
        if (Math.max(...win) > median + 6) continue; // aucun pic nettement plus fort que d'habitude
        const mean = score.slice(s, s + len).reduce((a, b) => a + b, 0) / len - len * 0.02; // léger bonus aux plages longues
        if (!best || mean < best.mean) best = { start: s, end: s + len, mean };
      }
    if (!best) break;
    for (let i = best.start; i < best.end; i++) taken[i] = true;
    const win = rms.slice(best.start, best.end);
    segments.push({ track: index, start: best.start, end: best.end, rmsMean: +(win.reduce((a, b) => a + b, 0) / win.length).toFixed(1), rmsMax: +Math.max(...win).toFixed(1), peakMax: +Math.max(...peak.slice(best.start, best.end)).toFixed(1) });
  }
  segments.sort((a, b) => a.start - b.start);
  result[name] = { curve: rms.map((v) => Math.round(v)).join(" "), duration: +duration.toFixed(1), rmsMedian: +median.toFixed(1), rmsMin: +sorted[0].toFixed(1), rmsMax: +sorted.at(-1).toFixed(1), segments };
}
console.log(JSON.stringify(result, null, 1));
await browser.close();
server.close();
