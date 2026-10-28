// Fixture anonymisée du rejeu anti-fraude, à partir de l'onglet Sécurité enregistré (« Votes à examiner »).
// Usage :
//   node --experimental-transform-types --disable-warning=ExperimentalWarning --import ./tests/unit/register.mjs \
//     scripts/fraud/replay-fixture.mjs "<fichier HTML enregistré>"
// Écrit tests/fixtures/replay-2026-10.json. Aucune IP réelle : chaque adresse est remplacée par une adresse
// fictive (plage de test 198.18.0.0/15) qui conserve les égalités, accompagnée de la classe d'IP calculée
// par src/lib/ip-class.ts sur l'adresse réelle (liste Tor téléchargée au moment de la génération).
// Les empreintes ne sont que les 8 premiers caractères d'un HMAC : elles servent d'étiquettes aux tests.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { classifyIp } from "../../src/lib/ip-class.ts";

const file = process.argv[2];
if (!file) throw new Error("Chemin du fichier HTML attendu");
const html = readFileSync(file, "utf8");
const start = [...html.matchAll(/Votes à examiner \(/g)].at(-1)?.index;
if (start === undefined) throw new Error("Liste « Votes à examiner » introuvable");
const table = html.slice(start).match(/<table.*?<\/table>/s)?.[0] ?? "";
const decode = (s) =>
  s
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
const rows = [...table.matchAll(/<tr[^>]*>(.*?)<\/tr>/gs)].slice(1).map((m) => [...m[1].matchAll(/<t[dh][^>]*>(.*?)<\/t[dh]>/gs)].map((c) => decode(c[1])));

const fake = new Map();
const fakeIp = (ip) => {
  if (!fake.has(ip)) {
    const i = fake.size + 1;
    fake.set(ip, `198.18.${Math.floor(i / 250)}.${(i % 250) + 1}`);
  }
  return fake.get(ip);
};
const STATUS = { Validé: "counted", Bloqué: "blocked", Exclu: "excluded" };

// Liste Tor officielle, téléchargée ici sans la limite de 800 ms du vote (script hors ligne) ; sans elle, aucune IP n'est classée Tor.
let tor = null;
try {
  const res = await fetch("https://check.torproject.org/torbulkexitlist", { signal: AbortSignal.timeout(15000) });
  if (res.ok) tor = new Set((await res.text()).split(/\s+/).filter(Boolean));
} catch (e) {
  console.warn("Liste Tor indisponible :", e instanceof Error ? e.message : e);
}
console.log(`Liste Tor : ${tor ? `${tor.size} sorties` : "indisponible"}`);

const out = [];
for (const [date, , signals, ip, device, fp, , vote, status] of rows) {
  const [d, mo, y, hh, mm] = date.match(/(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})/).slice(1);
  out.push({
    day: `${y}-${mo}-${d}`,
    time: `${hh}:${mm}`,
    fp,
    device: device.replace(/ · /g, ", "),
    ip: fakeIp(ip),
    ipClass: classifyIp(ip, tor),
    decoration: vote,
    before: STATUS[status] ?? status,
    oldSignals: signals.replace(/ · /g, ", "),
  });
}
out.sort((a, b) => `${a.day} ${a.time}`.localeCompare(`${b.day} ${b.time}`));
mkdirSync(new URL("../../tests/fixtures/", import.meta.url), { recursive: true });
writeFileSync(new URL("../../tests/fixtures/replay-2026-10.json", import.meta.url), JSON.stringify({ source: "Onglet Sécurité, « Votes à examiner », 27/10/2026 19:50 (137 lignes)", rows: out }, null, 1));
console.log(`${out.length} lignes, ${fake.size} adresses fictives`);
