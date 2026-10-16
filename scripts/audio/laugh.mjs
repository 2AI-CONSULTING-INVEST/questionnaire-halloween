// Rire diabolique « MOUAHAHA HA HA HA » : assemble les syllabes de laugh-voice.ps1 dans un
// OfflineAudioContext (Chrome) — « Mouaaah » long et grave, puis six « HA » saccadés qui descendent
// (hauteur et niveau), légère saturation, grave renforcé, réverbération de crypte — et exporte un WAV
// mono 22,05 kHz normalisé à −3 dBFS dans public/son/sfx/rire.wav.
// Usage : node scripts/audio/laugh.mjs <dossier des syllabes> <racine du projet>
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");

const [dir, root = "."] = process.argv.slice(2);
const server = http.createServer((req, res) => {
  if (req.url === "/") return res.writeHead(200, { "Content-Type": "text/html" }).end("<!doctype html><title>rire</title>");
  const f = path.join(dir, path.basename(req.url));
  fs.readFile(f, (e, d) => (e ? res.writeHead(404).end() : res.writeHead(200, { "Content-Type": "audio/wav" }).end(d)));
});
await new Promise((r) => server.listen(5192, r));
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new" });
const page = await browser.newPage();
await page.goto("http://localhost:5192/");
const samples = await page.evaluate(async () => {
  const RATE = 22050;
  const decode = async (name) => new OfflineAudioContext(1, RATE, RATE).decodeAudioData(await (await fetch("/" + name)).arrayBuffer());
  // Retire le silence autour d'une syllabe (seuil −45 dBFS).
  const trim = (buf) => {
    const d = buf.getChannelData(0);
    let a = 0, b = d.length - 1;
    while (a < b && Math.abs(d[a]) < 0.0056) a++;
    while (b > a && Math.abs(d[b]) < 0.0056) b--;
    return { buf, start: a / buf.sampleRate, dur: (b - a) / buf.sampleRate };
  };
  const moua = trim(await decode("laugh-moua.wav"));
  const ha = trim(await decode("laugh-ha.wav"));
  const total = 5.5;
  const ctx = new OfflineAudioContext(1, Math.ceil(total * RATE), RATE);
  // Chaîne : saturation douce → grave renforcé, aigus adoucis → sec + réverbération de crypte.
  const shaper = ctx.createWaveShaper();
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) { const x = (i / 511.5 - 1) * 2.2; curve[i] = Math.tanh(x) / Math.tanh(2.2); }
  shaper.curve = curve;
  const low = ctx.createBiquadFilter(); low.type = "lowshelf"; low.frequency.value = 180; low.gain.value = 5;
  const high = ctx.createBiquadFilter(); high.type = "lowpass"; high.frequency.value = 4200;
  const dry = ctx.createGain(); dry.gain.value = 0.8;
  const verb = ctx.createConvolver();
  const ir = ctx.createBuffer(1, Math.round(RATE * 1.6), RATE);
  const irD = ir.getChannelData(0);
  for (let i = 0; i < irD.length; i++) { const t = i / RATE; irD[i] = t < 0.025 ? 0 : (Math.random() * 2 - 1) * Math.exp(-t * 3.2); }
  verb.buffer = ir;
  const wet = ctx.createGain(); wet.gain.value = 0.32;
  shaper.connect(low).connect(high);
  high.connect(dry).connect(ctx.destination);
  high.connect(verb).connect(wet).connect(ctx.destination);
  const play = (s, at, rate, gain) => {
    const src = ctx.createBufferSource();
    src.buffer = s.buf;
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(g).connect(shaper);
    src.start(at, s.start, s.dur);
    return at + s.dur / rate;
  };
  // « MOUAAAH » : un peu plus grave et plus lent que la voix d'origine.
  let t = play(moua, 0.05, 0.88, 1.0) + 0.06;
  // « HA HA HA HA HA HA » : saccadés, de plus en plus graves et un peu moins forts ; le dernier traîne.
  const has = [[1.0, 0.95], [0.97, 0.92], [0.93, 0.88], [0.89, 0.82], [0.85, 0.76], [0.78, 0.7]];
  has.forEach(([rate, gain], i) => {
    play(ha, t, rate, gain);
    t += (i === has.length - 1 ? 0 : 0.19 + i * 0.012);
  });
  const out = await ctx.startRendering();
  const d = out.getChannelData(0);
  let peak = 0, last = 0;
  for (let i = 0; i < d.length; i++) { peak = Math.max(peak, Math.abs(d[i])); if (Math.abs(d[i]) > 0.002) last = i; }
  const k = 0.708 / peak; // −3 dBFS
  const end = Math.min(d.length, last + Math.round(RATE * 0.1));
  // Fondu de 50 ms à la fin (aucun clic).
  return Array.from(d.subarray(0, end), (v, i) => v * k * Math.min(1, (end - i) / (RATE * 0.05)));
});
await browser.close();
server.close();
// WAV PCM 16 bits mono 22,05 kHz.
const RATE = 22050;
const buf = Buffer.alloc(44 + samples.length * 2);
buf.write("RIFF", 0); buf.writeUInt32LE(36 + samples.length * 2, 4); buf.write("WAVE", 8);
buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
buf.writeUInt32LE(RATE, 24); buf.writeUInt32LE(RATE * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
buf.write("data", 36); buf.writeUInt32LE(samples.length * 2, 40);
samples.forEach((v, i) => buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(v * 32767))), 44 + i * 2));
const out = path.join(root, "public/son/sfx/rire.wav");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, buf);
console.log(`${out} : ${(samples.length / RATE).toFixed(2)} s, ${(buf.length / 1024).toFixed(0)} Ko`);
