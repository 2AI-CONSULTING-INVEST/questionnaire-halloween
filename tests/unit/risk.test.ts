import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { browserFamily, DEFAULT_RISK_SETTINGS, IP_POINTS_MAX, loadRiskSettings, riskSettingsSchema, RISK_SIGNAL_ORDER, RISK_SIGNALS, scoreRisk, uaBrowser, uaIsMobile, type DeviceVote, type RiskInput } from "../../src/lib/risk";

const TODAY = "2026-10-23";
const COOKIE = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const DECO = "33333333-3333-4333-8333-333333333333";
const IP = "192.168.1.10";
const { flag_threshold: FLAG, block_threshold: BLOCK } = DEFAULT_RISK_SETTINGS;

/** Votant honnête : nouveau jour, même appareil, même cookie qu'hier, aucune activité aujourd'hui. */
const honest = (over: Partial<RiskInput> = {}): RiskInput => ({
  deviceVotesToday: [],
  ipVotesToday: 0,
  cookieIsNew: false,
  noDevice: false,
  voterId: COOKIE,
  ip: IP,
  decorationId: DECO,
  today: TODAY,
  localVoteDay: "2026-10-22",
  durationMs: 45_000,
  webdriver: false,
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
  declared: { mobile: true },
  blockThreshold: BLOCK,
  ...over,
});

/** Vote validé aujourd'hui par le même appareil, avec un autre cookie. */
const vote = (over: Partial<DeviceVote> = {}): DeviceVote => ({ voterId: OTHER, ip: "10.0.0.1", decorationId: "44444444-4444-4444-8444-444444444444", ...over });

describe("scoreRisk : invariants", () => {
  it("votant honnête → 0, aucun signal", () => {
    assert.deepEqual(scoreRisk(honest()), { score: 0, flags: [] });
  });

  it("deux appareils différents sur la même IP le même jour → 0 et au plus 10", () => {
    assert.equal(scoreRisk(honest({ ipVotesToday: 0 })).score, 0);
    assert.equal(scoreRisk(honest({ ipVotesToday: 1 })).score, 0);
    assert.equal(scoreRisk(honest({ ipVotesToday: 3 })).score, 10);
  });

  it("l'IP seule n'atteint jamais le seuil de signalement (plafond 20)", () => {
    const r = scoreRisk(honest({ ipVotesToday: 500 }));
    assert.equal(r.score, IP_POINTS_MAX);
    assert.ok(r.score < FLAG);
  });

  it("empreinte seule (1 vote précédent) : signalée, jamais bloquée, même avec IP et décoration identiques", () => {
    const one = scoreRisk(honest({ deviceVotesToday: [vote()] }));
    assert.equal(one.score, 45);
    assert.ok(one.score >= FLAG && one.score < BLOCK);
    // Deux téléphones identiques sur le même Wi-Fi, même choix, restaurant très fréquenté.
    const twins = scoreRisk(honest({ deviceVotesToday: [vote({ ip: IP, decorationId: DECO })], ipVotesToday: 6 }));
    assert.equal(twins.score, 45 + IP_POINTS_MAX + 10);
    assert.ok(twins.score >= FLAG && twins.score < BLOCK);
  });

  it("cookie effacé mais stockage local conservé, même appareil → bloqué", () => {
    const r = scoreRisk(honest({ deviceVotesToday: [vote({ ip: IP })], cookieIsNew: true, voterId: "55555555-5555-4555-8555-555555555555", localVoteDay: TODAY }));
    assert.equal(r.score, 45 + 50 + 15 + 15);
    assert.ok(r.score >= BLOCK);
    assert.deepEqual(r.flags, ["device_voted_today", "local_vote_day", "new_cookie_device_voted", "device_same_ip"]);
  });

  it("F-14 : 3e vote même appareil, même IP, lent → bloqué (≥ 80 : seule exception sans signal propre à la requête)", () => {
    const r = scoreRisk(honest({ deviceVotesToday: [vote({ ip: IP }), vote({ ip: IP })] }));
    assert.equal(r.score, 70 + 15);
    assert.ok(r.score >= BLOCK);
    assert.ok(r.flags.includes("device_voted_twice") && r.flags.includes("device_same_ip"));
  });
  it("F-14 : 3e vote même appareil, autre IP, lent → plafonné 79, signalé", () => {
    const r = scoreRisk(honest({ deviceVotesToday: [vote({ decorationId: DECO }), vote({ decorationId: DECO })], ipVotesToday: 6 }));
    assert.equal(r.score, BLOCK - 1, "70 + 20 + 10 = 100 sans plafond");
    assert.ok(r.score >= FLAG && r.score < BLOCK && !r.flags.includes("device_same_ip"));
    assert.equal(scoreRisk(honest({ deviceVotesToday: [vote(), vote()], blockThreshold: 60 })).score, 59, "suit le seuil réglé");
  });
  it("F-14 : 2e vote même appareil, même IP, lent → 70, signalé", () => {
    const r = scoreRisk(honest({ deviceVotesToday: [vote({ ip: IP, decorationId: DECO })] }));
    assert.equal(r.score, 45 + 15 + 10);
    assert.ok(r.score >= FLAG && r.score < BLOCK);
  });
  it("F-14 : appareil identique d'un tiers, 2 votes antérieurs depuis une autre IP → jamais bloqué", () => {
    const r = scoreRisk(honest({ deviceVotesToday: [vote({ ip: "10.9.9.9", decorationId: DECO }), vote({ ip: "10.9.9.9", decorationId: DECO })], ipVotesToday: 6 }));
    assert.ok(r.score < BLOCK && r.score >= FLAG, String(r.score));
  });
  it("F-14 : 3e vote même appareil + rapide → bloqué (un signal propre à la requête suffit)", () => {
    const r = scoreRisk(honest({ deviceVotesToday: [vote({ ip: IP }), vote({ ip: IP })], durationMs: 4000 }));
    assert.equal(r.score, 70 + 15 + 25);
    assert.ok(r.score >= BLOCK);
  });
  it("F-14 : les signaux propres à la requête ne sont jamais plafonnés (cookies effacés + stockage conservé → toujours bloqué ; sans empreinte + rapide + IP → bloqué)", () => {
    assert.ok(scoreRisk(honest({ deviceVotesToday: [vote({ ip: IP })], cookieIsNew: true, voterId: "55555555-5555-4555-8555-555555555555", localVoteDay: TODAY })).score >= BLOCK);
    assert.ok(scoreRisk(honest({ noDevice: true, durationMs: 4000, ipVotesToday: 3 })).score >= BLOCK);
  });

  it("un attaquant ne peut gonfler pour un tiers que les signaux d'IP, plafonnés à 20 (< seuil de signalement)", () => {
    // La victime : appareil propre, cookie d'hier ; l'attaquant inonde la même IP de votes.
    const victim = scoreRisk(honest({ ipVotesToday: 1000 }));
    assert.equal(victim.score, IP_POINTS_MAX);
    assert.ok(victim.score < FLAG);
    // Omettre ou falsifier son empreinte ne change rien pour les autres : sans empreinte, aucun signal d'appareil.
    assert.equal(scoreRisk(honest({ deviceVotesToday: [], localVoteDay: null })).score, 0);
  });
});

describe("scoreRisk : chaque signal isolé", () => {
  const only = (over: Partial<RiskInput>, score: number, flag: string) => {
    const r = scoreRisk(honest(over));
    assert.equal(r.score, score, flag);
    assert.deepEqual(r.flags, [flag]);
  };
  it("sans empreinte et sans autre signal → 45 (< seuil de blocage : signalé seulement)", () => {
    only({ noDevice: true }, 45, "no_device");
    assert.ok(45 >= FLAG && 45 < BLOCK);
  });
  it("sans empreinte + rapide (< 6 s) + IP ≥ 3 votes → ≥ 80, bloqué (F-01 : rotation de cookie sans empreinte)", () => {
    const r = scoreRisk(honest({ noDevice: true, durationMs: 4000, ipVotesToday: 3 }));
    assert.ok(r.score >= BLOCK, String(r.score));
    assert.deepEqual(r.flags, ["no_device", "ip_many_votes", "too_fast"]);
  });
  it("honnête avec empreinte → 0 (no_device jamais sans raison)", () => assert.equal(scoreRisk(honest({ noDevice: false })).score, 0));
  it("même appareil, 1 vote → 45", () => only({ deviceVotesToday: [vote()] }, 45, "device_voted_today"));
  it("même appareil, ≥ 2 votes → 70 (remplace 45)", () => only({ deviceVotesToday: [vote(), vote(), vote()] }, 70, "device_voted_twice"));
  it("localVoteDay = aujourd'hui, cookie neuf → 50", () => only({ localVoteDay: TODAY, cookieIsNew: true }, 50, "local_vote_day"));
  it("localVoteDay = aujourd'hui mais c'est le cookie du vote précédent → rien de plus que l'appareil", () => {
    const r = scoreRisk(honest({ localVoteDay: TODAY, deviceVotesToday: [vote({ voterId: COOKIE })] }));
    assert.deepEqual(r.flags, ["device_voted_today"]);
  });
  it("cookie neuf alors que l'appareil a voté → 45 + 15", () => {
    const r = scoreRisk(honest({ cookieIsNew: true, deviceVotesToday: [vote()] }));
    assert.equal(r.score, 60);
    assert.ok(r.flags.includes("new_cookie_device_voted"));
  });
  it("cookie neuf sans vote de l'appareil → 0", () => assert.equal(scoreRisk(honest({ cookieIsNew: true })).score, 0));
  it("même appareil et même IP → 45 + 15", () => {
    const r = scoreRisk(honest({ deviceVotesToday: [vote({ ip: IP })] }));
    assert.equal(r.score, 60);
    assert.ok(r.flags.includes("device_same_ip"));
  });
  it("IP : ≥ 3 votes → 10 ; ≥ 6 → 20 ; en dessous → 0", () => {
    only({ ipVotesToday: 3 }, 10, "ip_many_votes");
    only({ ipVotesToday: 6 }, 20, "ip_very_many_votes");
    assert.equal(scoreRisk(honest({ ipVotesToday: 2 })).score, 0);
  });
  it("signaux d'IP cumulés plafonnés à 20", () => {
    const r = scoreRisk(honest({ deviceVotesToday: [vote({ ip: IP })], ipVotesToday: 6 }));
    assert.equal(r.score, 45 + IP_POINTS_MAX);
  });
  it("même appareil et même décoration → 45 + 10", () => {
    const r = scoreRisk(honest({ deviceVotesToday: [vote({ decorationId: DECO })] }));
    assert.equal(r.score, 55);
    assert.ok(r.flags.includes("device_same_decoration"));
  });
  it("durée < 6 s → 25 ; < 2 s → 40 ; inconnue → 0", () => {
    only({ durationMs: 5999 }, 25, "too_fast");
    only({ durationMs: 1999 }, 40, "way_too_fast");
    assert.equal(scoreRisk(honest({ durationMs: null })).score, 0);
    assert.equal(scoreRisk(honest({ durationMs: 6000 })).score, 0);
  });
  it("webdriver → 40", () => only({ webdriver: true }, 40, "webdriver"));
  it("UA mobile mais mobile=false déclaré → 15 ; non déclaré → 0", () => {
    only({ declared: { mobile: false } }, 15, "ua_mismatch");
    only({ declared: { browser: "Chrome 130" } }, 15, "browser_mismatch"); // UA iPhone Safari
    assert.equal(scoreRisk(honest({ declared: { mobile: true, browser: "Safari 17" } })).score, 0, "navigateur cohérent : 0");
    assert.equal(scoreRisk(honest({ declared: { mobile: true, browser: "Autre" } })).score, 0, "navigateur inconnu : pas de signal");
    assert.equal(scoreRisk(honest({ declared: {} })).score, 0);
    assert.equal(scoreRisk(honest({ userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130", declared: { mobile: false } })).score, 0);
  });
  it("uaBrowser : Edge et Opera avant Chrome, Chrome avant Safari, versions iOS", () => {
    assert.equal(uaBrowser("Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/130.0 Safari/537.36 Edg/130.0"), "Edge");
    assert.equal(uaBrowser("Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/130.0 Safari/537.36 OPR/115.0"), "Opera");
    assert.equal(uaBrowser("Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36"), "Chrome");
    assert.equal(uaBrowser("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/130.0 Mobile/15E148 Safari/604.1"), "Chrome");
    assert.equal(uaBrowser("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1"), "Safari");
    assert.equal(uaBrowser("Mozilla/5.0 (Android 14; Mobile; rv:130.0) Gecko/130.0 Firefox/130.0"), "Firefox");
    assert.equal(uaBrowser("Mozilla/5.0 (Linux; Android 14) SamsungBrowser/26.0 Chrome/122.0 Mobile Safari/537.36"), "Samsung Internet");
    assert.equal(uaBrowser("curl/8.0"), "Autre");
    assert.equal(browserFamily("Samsung Internet 26"), "Samsung Internet");
  });

  it("RISK_SIGNALS : chaque signal a un libellé, des points > 0, une explication, et l'ordre d'affichage les couvre tous", () => {
    for (const [code, s] of Object.entries(RISK_SIGNALS)) assert.ok(s.label && s.points > 0 && s.why.length > 20, code);
    assert.deepEqual([...RISK_SIGNAL_ORDER].sort(), Object.keys(RISK_SIGNALS).sort());
  });

  it("uaIsMobile : téléphone Android et iPhone oui, tablette Android et ordinateur non", () => {
    assert.equal(uaIsMobile("Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/130 Mobile Safari/537.36"), true);
    assert.equal(uaIsMobile("Mozilla/5.0 (Linux; Android 14; SM-X910) Chrome/130 Safari/537.36"), false);
    assert.equal(uaIsMobile("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15"), false);
  });
});

describe("réglages du score", () => {
  it("valeurs par défaut : block, 40, 80 ; seuils bornés 0–200 et flag < block ; clés inconnues refusées", () => {
    assert.deepEqual(DEFAULT_RISK_SETTINGS, { mode: "block", flag_threshold: 40, block_threshold: 80, ip_daily_max: 60 });
    assert.ok(riskSettingsSchema.safeParse({ mode: "observe", flag_threshold: 0, block_threshold: 200 }).success);
    assert.equal(riskSettingsSchema.parse({ mode: "observe", flag_threshold: 0, block_threshold: 200 }).ip_daily_max, 60, "réglages enregistrés sans ip_daily_max : défaut");
    assert.ok(riskSettingsSchema.safeParse({ mode: "block", flag_threshold: 40, block_threshold: 80, ip_daily_max: 0 }).success);
    assert.ok(!riskSettingsSchema.safeParse({ mode: "block", flag_threshold: 40, block_threshold: 80, ip_daily_max: 1001 }).success);
    assert.ok(!riskSettingsSchema.safeParse({ mode: "block", flag_threshold: 40, block_threshold: 80, ip_daily_max: -1 }).success);
    assert.ok(!riskSettingsSchema.safeParse({ mode: "block", flag_threshold: 80, block_threshold: 80 }).success);
    assert.ok(!riskSettingsSchema.safeParse({ mode: "block", flag_threshold: 10, block_threshold: 201 }).success);
    assert.ok(!riskSettingsSchema.safeParse({ mode: "block", flag_threshold: 10.5, block_threshold: 80 }).success);
    assert.ok(!riskSettingsSchema.safeParse({ mode: "off", flag_threshold: 10, block_threshold: 80 }).success);
    assert.ok(!riskSettingsSchema.safeParse({ mode: "block", flag_threshold: 10, block_threshold: 80, extra: 1 }).success);
  });
  it("loadRiskSettings : valeur absente ou invalide → défauts", async () => {
    assert.deepEqual(await loadRiskSettings({ getSetting: async () => null }), DEFAULT_RISK_SETTINGS);
    assert.deepEqual(await loadRiskSettings({ getSetting: async () => ({ mode: "observe" }) }), DEFAULT_RISK_SETTINGS);
    const custom = { mode: "observe", flag_threshold: 30, block_threshold: 90 };
    assert.deepEqual(await loadRiskSettings({ getSetting: async () => custom }), { ...custom, ip_daily_max: 60 }); // réglages enregistrés avant le plafond : défaut
  });
});
