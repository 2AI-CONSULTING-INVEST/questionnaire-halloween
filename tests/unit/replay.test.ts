import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { buildGroups, type GraphAttempt } from "../../src/lib/fraud-graph";
import { decide, type RelatedAttempt } from "../../src/lib/fraud-rules";
import { DEFAULT_RISK_SETTINGS } from "../../src/lib/risk";
import type { HwEntropy, VoteStatus } from "../../src/lib/schema";

/**
 * Rejeu des données réelles du 26 et du 27 octobre (tests/fixtures/replay-2026-10.json, produite par
 * scripts/fraud/replay-fixture.mjs, IP fictives). Chaque tentative passe par les vraies règles puis par le
 * moteur de groupes. Hypothèse : la clé matérielle est l'appareil sans la version du navigateur (plateforme,
 * écran, mobile) ; les tricheurs repartent d'un cookie et d'un stockage vides à chaque tentative ; ni pays ni
 * ville (absents du fichier) ; durée du questionnaire inconnue (score 0).
 */
type Row = { day: string; time: string; fp: string; device: string; ip: string; ipClass: string; decoration: string; before: VoteStatus };
const fixture = JSON.parse(readFileSync(new URL("../fixtures/replay-2026-10.json", import.meta.url), "utf8")) as { rows: Row[] };

const hwOf = (device: string) => device.replace(/, (Chrome|Safari|Brave|Samsung Browser|Firefox|Edge)[^,]*/, "");
const entropyOf = (device: string): HwEntropy => (/Brave|Firefox/.test(device) ? "noisy" : /^iPhone|^iPad/.test(device) ? "weak" : "strong");

type Sim = Row & { id: string; atMs: number; after: VoteStatus; reasons: string[] };

function replay(rows: Row[]): Sim[] {
  const out: Sim[] = [];
  const confirmedKeys = new Map<string, string>(); // clé forte → jour d'un groupe confirmé (récidive)
  for (const day of [...new Set(rows.map((r) => r.day))].sort()) {
    const related: RelatedAttempt[] = [];
    const sims: Sim[] = [];
    rows
      .filter((r) => r.day === day)
      .forEach((r, i) => {
        const atMs = Date.parse(`${r.day}T${r.time}:00+01:00`) + i; // ordre stable à la minute près
        const hwKey = hwOf(r.device);
        const entropy = entropyOf(r.device);
        const d = decide(
          {
            stage: "complete",
            nowMs: atMs,
            voterId: `voter-${day}-${i}`,
            storageKeys: [],
            hwKey,
            entropy,
            privateMode: null,
            ipNet: r.ip,
            ipClass: r.ipClass as never,
            country: null,
            city: null,
            decorationId: r.decoration,
            score: 0,
            ipCapped: false,
            recidivism: entropy === "strong" && [...confirmedKeys].some(([k, d0]) => k === hwKey && d0 < day),
            tzMismatch: false,
            langMismatch: false,
          },
          related,
          DEFAULT_RISK_SETTINGS,
        );
        const sim: Sim = { ...r, id: `${day}-${i}`, atMs, after: d.outcome, reasons: d.reasons };
        sims.push(sim);
        if (d.outcome !== "blocked")
          related.push({ id: sim.id, voterId: `voter-${day}-${i}`, atMs, hwKey, entropy, storageKey: null, ipNet: r.ip, ipClass: r.ipClass, city: null, decorationId: r.decoration, groupId: null });
      });
    const graph: GraphAttempt[] = sims.map((s) => ({
      id: s.id,
      atMs: s.atMs,
      status: s.after,
      voterId: null,
      hwKey: hwOf(s.device),
      entropy: entropyOf(s.device),
      storageKey: null,
      seenStorage: [],
      ipNet: s.ip,
      ipClass: s.ipClass,
      city: null,
      decorationId: s.decoration,
      privateMode: null,
      participantId: null,
      phone: null,
      email: null,
      humanDecision: null,
      autoExcluded: false,
      groupId: null,
    }));
    for (const g of buildGroups(day, graph, { c2MinAttempts: DEFAULT_RISK_SETTINGS.c2_min_attempts, positionMinutes: DEFAULT_RISK_SETTINGS.h9_minutes })) {
      if (g.status !== "confirmed") continue;
      for (const id of g.exclude) sims.find((s) => s.id === id)!.after = "excluded";
      for (const id of g.members) {
        const s = sims.find((x) => x.id === id)!;
        if (entropyOf(s.device) === "strong") confirmedKeys.set(hwOf(s.device), day);
      }
    }
    out.push(...sims);
  }
  return out;
}

const result = replay(fixture.rows);
const count = (day: string, fp: string, field: "before" | "after", status: VoteStatus) => result.filter((r) => r.day === day && r.fp === fp && r[field] === status).length;

describe("rejeu des données réelles (26 et 27 octobre)", () => {
  it("la fixture est anonymisée : aucune IP réelle, 137 lignes", () => {
    assert.equal(fixture.rows.length, 137);
    assert.ok(fixture.rows.every((r) => r.ip.startsWith("198.18.")));
  });
  it("27/10 : 5bee1f71 a au plus 1 vote compté (15 avant)", () => {
    assert.equal(count("2026-10-27", "5bee1f71", "before", "counted"), 15);
    assert.ok(count("2026-10-27", "5bee1f71", "after", "counted") <= 1);
  });
  it("26/10 : b5a194eb, 9a7ae094 et dbdf6634 ont chacun au plus 1 vote compté", () => {
    for (const fp of ["b5a194eb", "9a7ae094", "dbdf6634"]) assert.ok(count("2026-10-26", fp, "after", "counted") <= 1, fp);
  });
  it("tableau avant et après, par empreinte et par restaurant (iPhone ambigus : décision affichée sans l'imposer)", (t) => {
    const keys = [...new Set(result.map((r) => `${r.day} ${r.fp} ${r.decoration}`))];
    for (const k of keys) {
      const rows = result.filter((r) => `${r.day} ${r.fp} ${r.decoration}` === k);
      const tally = (field: "before" | "after") =>
        (["counted", "held", "blocked", "excluded"] as const)
          .map((s) => [s, rows.filter((r) => r[field] === s).length] as const)
          .filter(([, v]) => v)
          .map(([s, v]) => `${s} ${v}`)
          .join(", ");
      t.diagnostic(`${k} (${rows[0].device}) : avant ${tally("before")} ; après ${tally("after")}`);
    }
    assert.ok(keys.length > 0);
  });
});
