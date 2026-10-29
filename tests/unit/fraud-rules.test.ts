import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { arrivalVoted, crossBrowser, decide, FRAUD_RULE_ORDER, FRAUD_RULES, recognize, sinceLinked, strongConflict, strongWithClue, type RelatedAttempt, type RequestFacts } from "../../src/lib/fraud-rules";
import { DEFAULT_RISK_SETTINGS, type RiskSettings } from "../../src/lib/risk";

const NOW = Date.parse("2026-10-27T18:00:00Z");
const ME = "11111111-1111-4111-8111-111111111111";
const S = DEFAULT_RISK_SETTINGS;
/** Aucun second indice : ni navigation privée, ni réseau, ni ville. */
const NO_CLUE = { privateMode: null, ipNet: null, city: null, nowMs: NOW };

const facts = (over: Partial<RequestFacts> = {}): RequestFacts => ({
  stage: "complete",
  nowMs: NOW,
  voterId: ME,
  storageKeys: [],
  hwKey: "android-a",
  entropy: "strong",
  privateMode: false,
  ipNet: "203.0.113.10",
  ipClass: "normal",
  country: "FR",
  city: "Lille",
  decorationId: "deco-1",
  score: 0,
  ipCapped: false,
  recidivism: false,
  tzMismatch: false,
  langMismatch: false,
  ...over,
});
let n = 0;
const attempt = (over: Partial<RelatedAttempt> = {}): RelatedAttempt => ({
  id: `a${++n}`,
  voterId: "22222222-2222-4222-8222-222222222222",
  atMs: NOW - 60 * 60_000,
  hwKey: "android-a",
  entropy: "strong",
  storageKey: null,
  ipNet: "198.51.100.7",
  ipClass: "normal",
  city: "Lille",
  decorationId: "deco-1",
  groupId: null,
  ...over,
});
const settings = (over: Partial<RiskSettings> = {}): RiskSettings => ({ ...S, ...over });

describe("votants honnêtes (protections reprises de l'ancien score)", () => {
  it("premier vote du jour : compté, aucune raison", () => {
    assert.deepEqual(decide(facts(), [], S), { outcome: "counted", observed: null, reasons: [], priority: false, recognized: null });
  });
  it("Wi-Fi du restaurant : appareils différents sur la même IP → comptés (l'IP seule ne retient jamais)", () => {
    const other = attempt({ hwKey: "android-b", ipNet: "203.0.113.10" });
    assert.equal(decide(facts(), [other, attempt({ hwKey: "iphone-x", entropy: "weak", ipNet: "203.0.113.10" })], S).outcome, "counted");
  });
  it("deux iPhone identiques sur le même Wi-Fi : en attente, jamais bloqués", () => {
    const d = decide(facts({ hwKey: "iphone-x", entropy: "weak" }), [attempt({ hwKey: "iphone-x", entropy: "weak", ipNet: "203.0.113.10" })], S);
    assert.equal(d.outcome, "held");
    assert.ok(d.reasons.includes("H5"));
  });
  it("quatre iPhone identiques, réseaux mobiles différents, sans même ville : comptés", () => {
    const others = [1, 2, 3].map((i) => attempt({ hwKey: "iphone-x", entropy: "weak", ipNet: `10.0.0.${i}`, city: null }));
    assert.equal(decide(facts({ hwKey: "iphone-x", entropy: "weak", city: null }), others, S).outcome, "counted");
  });
  it("clé faible seule : jamais reconnue à l'arrivée (un client honnête avec le même iPhone)", () => {
    assert.equal(recognize({ voterId: null, storageKeys: [], hwKey: "iphone-x", entropy: "weak", ...NO_CLUE }, [attempt({ hwKey: "iphone-x", entropy: "weak" })], S), null);
  });
  it("clé brouillée (Brave, Firefox résistant) : ne relie rien", () => {
    assert.equal(decide(facts({ entropy: "noisy" }), [attempt({ entropy: "noisy" })], S).outcome, "counted");
  });
  it("seuils de production 25 / 30 : un iPhone identique honnête n'est jamais bloqué par le score (plus aucun point d'empreinte ni d'IP)", () => {
    const prod = settings({ flag_threshold: 25, block_threshold: 30 });
    const d = decide(facts({ hwKey: "iphone-x", entropy: "weak", city: null }), [attempt({ hwKey: "iphone-x", entropy: "weak", city: null })], prod);
    assert.equal(d.outcome, "counted");
  });
});

describe("refus visibles (cas sûrs)", () => {
  it("cookie : déjà une tentative aujourd'hui", () => {
    const d = decide(facts(), [attempt({ voterId: ME })], S);
    assert.equal(d.outcome, "blocked");
    assert.equal(d.recognized, "cookie");
  });
  it("B1 : jeton du stockage d'une tentative d'aujourd'hui, cookie absent", () => {
    const d = decide(facts({ voterId: null, storageKeys: ["tok"] }), [attempt({ storageKey: "tok", hwKey: "other" })], S);
    assert.deepEqual([d.outcome, d.recognized, d.reasons.includes("B1")], ["blocked", "storage", true]);
  });
  it("B2 : clé forte déjà vue aujourd'hui avec un second indice (navigation privée), même depuis une autre IP (faille F1)", () => {
    const d = decide(facts({ privateMode: true, ipNet: "192.0.2.99" }), [attempt({})], S);
    assert.deepEqual([d.outcome, d.recognized], ["blocked", "hw"]);
    assert.ok(d.reasons.includes("B2") && d.reasons.includes("H6"), "toutes les raisons sont enregistrées");
  });
  it("B3 : score au seuil de blocage", () => {
    assert.ok(decide(facts({ score: 80 }), [], S).reasons.includes("B3"));
    assert.equal(decide(facts({ score: 80 }), [], S).outcome, "blocked");
  });
  it("plafond par IP", () => assert.equal(decide(facts({ ipCapped: true }), [], S).outcome, "blocked"));
  it("arrivée et ouverture : seules les règles de reconnaissance (cookie, B1, B2) s'appliquent", () => {
    assert.equal(decide(facts({ stage: "create", ipClass: "tor", score: 200 }), [], S).outcome, "counted");
    assert.equal(decide(facts({ stage: "arrival", voterId: null, ipNet: "198.51.100.7" }), [attempt({})], S).outcome, "blocked");
    assert.equal(decide(facts({ stage: "arrival", voterId: null }), [attempt({})], S).outcome, "counted", "clé forte seule : la session s'ouvre");
  });
});

describe("mises en attente (cas suspects)", () => {
  it("H1 : clé forte d'un groupe confirmé aujourd'hui (B2 désactivé pour isoler la règle)", () => {
    const d = decide(facts(), [attempt({ groupId: "2026-10-27:abc" })], settings({ b2_strong_key: false }));
    assert.ok(d.reasons.includes("H1") && d.reasons.includes("H4"));
    assert.equal(d.outcome, "held");
  });
  it("H2 : Tor ou hébergeur ; iCloud Private Relay et IP normale : rien", () => {
    assert.equal(decide(facts({ ipClass: "tor" }), [], S).outcome, "held");
    assert.equal(decide(facts({ ipClass: "hosting" }), [], S).outcome, "held");
    assert.equal(decide(facts({ ipClass: "relay" }), [], S).outcome, "counted");
    assert.equal(decide(facts({ ipClass: "tor" }), [], settings({ h2_anonymous_ip: false })).outcome, "counted");
  });
  it("H3 : pays connu et différent de FR ; pays inconnu : rien", () => {
    assert.ok(decide(facts({ country: "DZ" }), [], S).reasons.includes("H3"));
    assert.equal(decide(facts({ country: null }), [], S).outcome, "counted");
  });
  it("H4 : clé forte déjà vue quand B2 est désactivé → attente au lieu du refus", () => {
    const d = decide(facts(), [attempt({})], settings({ b2_strong_key: false }));
    assert.deepEqual([d.outcome, d.reasons.includes("H4"), d.reasons.includes("B2")], ["held", true, false]);
  });
  it("H5 : clé faible et même réseau (IPv4 exacte), priorité haute à moins de 10 minutes", () => {
    const near = decide(facts({ hwKey: "iphone-x", entropy: "weak" }), [attempt({ hwKey: "iphone-x", entropy: "weak", ipNet: "203.0.113.10", atMs: NOW - 5 * 60_000 })], S);
    assert.deepEqual([near.outcome, near.priority], ["held", true]);
    const far = decide(facts({ hwKey: "iphone-x", entropy: "weak", city: null }), [attempt({ hwKey: "iphone-x", entropy: "weak", ipNet: "203.0.113.10", city: null })], S);
    assert.deepEqual([far.outcome, far.priority], ["held", false]);
    assert.equal(decide(facts({ hwKey: "iphone-x", entropy: "weak", city: null }), [attempt({ hwKey: "iphone-x", entropy: "weak", ipNet: "203.0.113.11", city: null })], S).outcome, "counted", "même /24, autre adresse : rien");
  });
  it("H6 : navigation privée et clé déjà vue (clé faible ; B5 désactivé pour isoler la règle)", () => {
    const d = decide(facts({ hwKey: "iphone-x", entropy: "weak", privateMode: true, city: null }), [attempt({ hwKey: "iphone-x", entropy: "weak", city: null })], settings({ b5_private_block: false }));
    assert.deepEqual([d.outcome, d.reasons], ["held", ["H6"]]);
  });
  it("H7 : récidive d'une clé forte ; jamais pour une clé faible", () => {
    assert.ok(decide(facts({ recidivism: true }), [], S).reasons.includes("H7"));
    assert.equal(decide(facts({ recidivism: true, entropy: "weak" }), [], S).outcome, "counted");
  });
  it("H8 : score au seuil de signalement → en attente, non compté", () => {
    const d = decide(facts({ score: 40 }), [], S);
    assert.deepEqual([d.outcome, d.reasons], ["held", ["H8"]]);
  });
  it("H9 : clé faible, même ville, même décoration, 5 minutes après → attente, priorité haute ; 15 minutes après : rien", () => {
    const d = decide(facts({ hwKey: "iphone-x", entropy: "weak" }), [attempt({ hwKey: "iphone-x", entropy: "weak", atMs: NOW - 5 * 60_000 })], S);
    assert.deepEqual([d.outcome, d.priority, d.reasons.includes("H9")], ["held", true, true]);
    assert.equal(decide(facts({ hwKey: "iphone-x", entropy: "weak" }), [attempt({ hwKey: "iphone-x", entropy: "weak", atMs: NOW - 15 * 60_000 })], S).outcome, "counted");
    assert.equal(decide(facts({ hwKey: "iphone-x", entropy: "weak" }), [attempt({ hwKey: "iphone-x", entropy: "weak", atMs: NOW - 5 * 60_000, decorationId: "deco-2" })], S).outcome, "counted");
  });
  it("indices (fuseau, langue) : enregistrés, sans effet sur l'issue", () => {
    const d = decide(facts({ tzMismatch: true, langMismatch: true }), [], S);
    assert.deepEqual([d.outcome, d.reasons], ["counted", ["tz_mismatch", "lang_mismatch"]]);
  });
});

describe("ordre, observation, reconnaissance, intervalle", () => {
  it("la première règle décide (refus avant attente) et toutes les raisons sont gardées", () => {
    const d = decide(facts({ ipClass: "tor", country: "NL", score: 90 }), [], S);
    assert.equal(d.outcome, "blocked");
    assert.deepEqual(d.reasons, ["B3", "H2", "H3"]);
  });
  it("mode observation : rien n'est bloqué ni retenu, l'issue évitée est rendue ; le cookie reste la règle de base", () => {
    const obs = settings({ mode: "observe" });
    assert.deepEqual([decide(facts({ ipClass: "tor" }), [], obs).outcome, decide(facts({ ipClass: "tor" }), [], obs).observed], ["counted", "held"]);
    assert.deepEqual([decide(facts({ privateMode: true }), [attempt({})], obs).outcome, decide(facts({ privateMode: true }), [attempt({})], obs).observed], ["counted", "blocked"]);
    assert.deepEqual([decide(facts(), [attempt({})], obs).outcome, decide(facts(), [attempt({})], obs).observed], ["counted", "held"]);
    assert.equal(decide(facts(), [attempt({ voterId: ME })], obs).outcome, "blocked");
  });
  it("reconnaissance dans l'ordre : cookie, stockage, clé forte avec un second indice (si B2) ; rien sinon", () => {
    const rel = [attempt({ voterId: ME, storageKey: "tok" })];
    const base = { hwKey: "android-a", entropy: "strong" as const, ...NO_CLUE };
    assert.equal(recognize({ voterId: ME, storageKeys: ["tok"], ...base }, rel, S), "cookie");
    assert.equal(recognize({ voterId: null, storageKeys: ["tok"], ...base }, rel, S), "storage");
    assert.equal(recognize({ voterId: null, storageKeys: [], ...base }, rel, S), null, "clé forte seule : pas de reconnaissance");
    assert.equal(recognize({ voterId: null, storageKeys: [], ...base, ipNet: "198.51.100.7" }, rel, S), "hw");
    assert.equal(recognize({ voterId: null, storageKeys: [], ...base, ipNet: "198.51.100.7" }, rel, settings({ b2_strong_key: false })), null);
  });
  it("intervalle depuis la dernière tentative reliée (cookie, jeton, clé, réseau)", () => {
    assert.equal(sinceLinked(facts(), [attempt({ atMs: NOW - 90_000 }), attempt({ atMs: NOW - 30_000, hwKey: "x", ipNet: "203.0.113.10" })]), 30_000);
    assert.equal(sinceLinked(facts(), [attempt({ hwKey: "x" })]), null);
  });
  it("chaque règle a un libellé et une explication ; l'ordre les couvre toutes", () => {
    for (const code of FRAUD_RULE_ORDER) assert.ok(FRAUD_RULES[code].label && FRAUD_RULES[code].why.length > 20, code);
  });
});

describe("A2 : validation parallèle de la même clé forte (index unique)", () => {
  const counted = { outcome: "counted" as const, observed: null, reasons: [] };
  it("repli quand la décision relue ne tranche pas : attente H4, jamais un refus sans second indice", () => {
    assert.deepEqual(strongConflict(counted, { mode: "block" }), { outcome: "held", observed: null, reasons: ["H4"] });
  });
  it("mode observation : le vote reste compté (rien de visible ne change), l'issue évitée est notée", () => {
    assert.deepEqual(strongConflict(counted, { mode: "observe" }), { outcome: "counted", observed: "held", reasons: ["H4"] });
    assert.deepEqual(strongConflict({ ...counted, observed: "blocked", reasons: ["B3"] }, { mode: "observe" }), { outcome: "counted", observed: "blocked", reasons: ["B3", "H4"] });
  });
  it("mode observation, validation séquentielle : decide rend compté avec B2 noté (hors de l'index)", () => {
    const d = decide(facts({ ipNet: "198.51.100.7" }), [attempt()], settings({ mode: "observe" }));
    assert.deepEqual([d.outcome, d.observed, d.reasons.includes("B2")], ["counted", "blocked", true]);
  });
});

describe("B2 : refus seulement avec un second indice, sinon attente (H4)", () => {
  const seen = () => [attempt({ atMs: NOW - 5 * 60_000 })]; // même clé forte, autre réseau, Lille, il y a 5 minutes
  const is = (d: ReturnType<typeof decide>, outcome: string, reason: string) => d.outcome === outcome && d.reasons.includes(reason as never);
  it("sans second indice (deux Android identiques, IP et ville différentes) : attente H4, sans B2", () => {
    const d = decide(facts({ city: "Paris" }), seen(), S);
    assert.deepEqual([d.outcome, d.reasons.includes("H4"), d.reasons.includes("B2"), d.recognized], ["held", true, false, null]);
  });
  it("navigation privée : refus B2", () => assert.ok(is(decide(facts({ city: "Paris", privateMode: true }), seen(), S), "blocked", "B2")));
  it("même réseau IP : refus B2", () => assert.ok(is(decide(facts({ city: "Paris", ipNet: "198.51.100.7" }), seen(), S), "blocked", "B2")));
  it("même ville à moins de h9_minutes : refus B2 ; même ville plus tard : attente", () => {
    assert.ok(is(decide(facts(), seen(), S), "blocked", "B2"));
    assert.ok(is(decide(facts(), [attempt({ atMs: NOW - 60 * 60_000 })], S), "held", "H4"));
  });
  it("jeton du stockage en commun : refus (B1 et B2)", () => {
    const d = decide(facts({ city: "Paris", storageKeys: ["tok"] }), [attempt({ storageKey: "tok", atMs: NOW - 5 * 60_000 })], S);
    assert.ok(d.outcome === "blocked" && d.reasons.includes("B1") && d.reasons.includes("B2"));
  });
  it("strongWithClue : aucune tentative de même clé, aucun indice", () => {
    assert.equal(strongWithClue({ ...NO_CLUE, privateMode: true, storageKeys: [] }, [], 10), false);
  });
});

describe("B4 : même ordinateur, autre navigateur (clé stricte et même réseau)", () => {
  const PC = { xdevKey: "x-pc", xdevStrictKey: "m-pc", computer: true, entropy: "weak" as const, privateMode: null, city: "Paris" };
  /** Tentatives successives, chacune avec son cookie et sa clé matérielle (Chrome, Firefox, Edge). */
  const run = (list: Partial<RequestFacts>[], s: RiskSettings = S) => {
    const related: RelatedAttempt[] = [];
    return list.map((over, i) => {
      const f = facts({ voterId: `cookie-${i}`, hwKey: `hw-${i}`, ...over });
      const d = decide(f, related, s);
      if (d.outcome !== "blocked") related.push(attempt({ id: `t${i}`, voterId: f.voterId, hwKey: f.hwKey, entropy: f.entropy, ipNet: f.ipNet, city: "Paris", xdevKey: f.xdevKey, xdevStrictKey: f.xdevStrictKey }));
      return d;
    });
  };
  it("Chrome, puis Firefox, puis Edge sur le même PC, même IP (même clé stricte) : 1 compté, les 2 autres refusés (B4)", () => {
    const d = run([PC, PC, PC]);
    assert.deepEqual(d.map((x) => x.outcome), ["counted", "blocked", "blocked"]);
    assert.ok(d[1].reasons.includes("B4") && d[1].recognized === "xdev");
  });
  it("même PC, autre IP (4G) : pas de B4 par défaut, attente H10 ; refus avec « B4 sur tout réseau »", () => {
    const g4 = { ...PC, ipNet: "192.0.2.200" };
    const def = run([PC, g4]);
    assert.deepEqual([def[1].outcome, def[1].reasons.includes("H10"), def[1].reasons.includes("B4")], ["held", true, false]);
    const any = run([PC, g4], settings({ b4_strict_any_network: true }));
    assert.deepEqual([any[1].outcome, any[1].reasons.includes("B4")], ["blocked", true]);
  });
  it("deux PC différents sur la même IP : pas de B4", () => {
    assert.deepEqual(run([PC, { ...PC, xdevKey: "x-autre-pc", xdevStrictKey: "m-autre-pc" }]).map((x) => x.outcome), ["counted", "counted"]);
  });
  it("deux PC de même clé large et de clé stricte différente, même IP : attente H10, pas de refus", () => {
    const d = run([PC, { ...PC, xdevStrictKey: "m-autres-polices" }]);
    assert.deepEqual([d[1].outcome, d[1].reasons.includes("H10"), d[1].reasons.includes("B4"), d[1].recognized], ["held", true, false, null]);
  });
  it("navigateur sans clé stricte (Safari sur macOS), clé large et même réseau : attente H10", () => {
    const d = run([PC, { ...PC, xdevStrictKey: null }]);
    assert.deepEqual([d[1].outcome, d[1].reasons.includes("H10")], ["held", true]);
  });
  it("deux téléphones de même clé sur la même IP : attente (H10), jamais refus", () => {
    const d = run([{ ...PC, computer: false }, { ...PC, computer: false }]);
    assert.deepEqual([d[1].outcome, d[1].reasons.includes("H10"), d[1].reasons.includes("B4"), d[1].recognized], ["held", true, false, null]);
  });
  it("mode observation : aucun refus, issue évitée notée ; réglage désactivé : rien", () => {
    const obs = run([PC, PC], settings({ mode: "observe" }));
    assert.deepEqual([obs[1].outcome, obs[1].observed], ["counted", "blocked"]);
    assert.deepEqual(run([PC, PC], settings({ b4_cross_browser: false })).map((x) => x.outcome), ["counted", "counted"]);
  });
  it("même cookie : jamais B4 (c'est la règle du cookie)", () => {
    assert.equal(crossBrowser({ ...PC, voterId: "c", ipNet: "1.1.1.1" }, [attempt({ voterId: "c", ipNet: "1.1.1.1", xdevKey: "x-pc", xdevStrictKey: "m-pc" })], S), null);
  });
});

describe("arrivée : écran « déjà voté » dès l'arrivée", () => {
  const PC = { voterId: "nouveau-navigateur", storageKeys: [], hwKey: "hw-firefox", entropy: "weak" as const, privateMode: null, ipNet: "203.0.113.10", city: "Paris", nowMs: NOW, xdevKey: "x-pc", xdevStrictKey: "m-pc", computer: true };
  const seen = [attempt({ voterId: "cookie-chrome", hwKey: "hw-chrome", ipNet: "203.0.113.10", xdevKey: "x-pc", xdevStrictKey: "m-pc" })];
  const arrival = (f: Parameters<typeof recognize>[0], s: RiskSettings = S) => arrivalVoted(recognize(f, seen, s), s.mode);
  it("nouveau navigateur sur le même ordinateur, même réseau (B4) : « déjà voté »", () => assert.equal(arrival(PC), true));
  it("clé stricte depuis un autre réseau : rien à l'arrivée par défaut (H10 silencieux), « déjà voté » avec B4 sur tout réseau", () => {
    const g4 = { ...PC, ipNet: "192.0.2.200", xdevStrictKey: "m-pc" };
    assert.equal(arrival(g4), false);
    assert.equal(arrival(g4, settings({ b4_strict_any_network: true })), true);
  });
  it("téléphone (H10) : rien de visible à l'arrivée", () => assert.equal(arrival({ ...PC, computer: false }), false));
  it("mode observation : rien de visible, sauf le cookie", () => {
    assert.equal(arrival(PC, settings({ mode: "observe" })), false);
    assert.equal(arrivalVoted("cookie", "observe"), true);
  });
  it("aucune correspondance : la page s'ouvre", () => assert.equal(arrival({ ...PC, xdevKey: "x-autre", xdevStrictKey: "m-autre" }), false));
  it("clé large seule, même réseau (deux PC de même configuration, ou Safari) : rien à l'arrivée (H10 silencieux)", () => {
    assert.equal(arrival({ ...PC, xdevStrictKey: "m-autres-polices" }), false);
    assert.equal(arrival({ ...PC, xdevStrictKey: null }), false);
  });
});

describe("A30 : Brave sur ordinateur", () => {
  const brave = { voterId: "cookie-brave", xdevKey: "aleatoire", computer: true, brave: true, ipNet: "203.0.113.10" };
  it("même réseau qu'une tentative du jour d'un autre cookie : attente H10, jamais refus", () => {
    const d = decide(facts({ ...brave, hwKey: "hw-brave", entropy: "noisy" }), [attempt({ voterId: "cookie-chrome", ipNet: "203.0.113.10", xdevKey: "x-pc" })], S);
    assert.deepEqual([d.outcome, d.reasons.includes("H10"), d.reasons.includes("B4"), d.recognized], ["held", true, false, null]);
  });
  it("autre réseau, ou même cookie : rien", () => {
    assert.equal(crossBrowser({ ...brave, ipNet: "192.0.2.9" }, [attempt({ voterId: "cookie-chrome", ipNet: "203.0.113.10" })], S), null);
    assert.equal(crossBrowser(brave, [attempt({ voterId: "cookie-brave", ipNet: "203.0.113.10" })], S), null);
  });
});

describe("B5 : navigation privée détectée", () => {
  const priv = { ...NO_CLUE, voterId: null, storageKeys: [], hwKey: "iphone-x", entropy: "weak" as const, privateMode: true };
  it("arrivée : reconnue, écran « déjà voté »", () => {
    assert.equal(recognize(priv, [], S), "private");
    assert.equal(arrivalVoted(recognize(priv, [], S), "block"), true);
  });
  it("validation : refus B5, score 0", () => {
    const d = decide(facts({ privateMode: true, voterId: "x" }), [], S);
    assert.deepEqual([d.outcome, d.reasons.includes("B5")], ["blocked", true]);
  });
  it("mode observation : rien ne change (compté, issue évitée notée) ; réglage désactivé : rien", () => {
    const obs = settings({ mode: "observe" });
    assert.equal(arrivalVoted(recognize(priv, [], obs), "observe"), false);
    assert.deepEqual([decide(facts({ privateMode: true }), [], obs).outcome, decide(facts({ privateMode: true }), [], obs).observed], ["counted", "blocked"]);
    assert.equal(decide(facts({ privateMode: true }), [], settings({ b5_private_block: false })).outcome, "counted");
  });
});

describe("B5 : Brave jamais, Safari oui", () => {
  const base = { ...NO_CLUE, voterId: null, storageKeys: [], hwKey: "k", entropy: "weak" as const, privateMode: true };
  it("Brave avec privateMode : pas de B5 (quota fixe, faux positif)", () => {
    assert.equal(recognize({ ...base, brave: true }, [], S), null);
    assert.ok(!decide(facts({ privateMode: true, brave: true }), [], S).reasons.includes("B5"));
  });
  it("Safari avec privateMode : B5", () => {
    assert.equal(recognize({ ...base, brave: false }, [], S), "private");
    assert.equal(decide(facts({ privateMode: true, hwKey: "iphone-x", entropy: "weak" }), [], S).outcome, "blocked");
  });
});
