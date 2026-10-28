import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  browserFamily,
  browserMismatch,
  chBrands,
  DEFAULT_RISK_SETTINGS,
  flagLabel,
  loadRiskSettings,
  riskSettingsSchema,
  RISK_SIGNAL_ORDER,
  RISK_SIGNALS,
  scoreRisk,
  uaBrowser,
  uaIsMobile,
  type RiskInput,
} from "../../src/lib/risk";

const IPHONE_SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1";
const ANDROID_CHROME = "Mozilla/5.0 (Linux; Android 14; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Mobile Safari/537.36";
const WINDOWS_CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36";
const SAMSUNG = "Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/30.0 Chrome/131.0.0.0 Mobile Safari/537.36";

/** Votant honnête : questionnaire rempli en 45 s, signaux cohérents. */
const honest = (over: Partial<RiskInput> = {}): RiskInput => ({
  noDevice: false,
  durationMs: 45_000,
  webdriver: false,
  userAgent: IPHONE_SAFARI,
  declared: { mobile: true },
  ...over,
});

const only = (over: Partial<RiskInput>, points: number, flag: string) => {
  const r = scoreRisk(honest(over));
  assert.equal(r.score, points);
  assert.deepEqual(r.flags, [flag]);
};

describe("scoreRisk : seuls les signaux propres à la requête", () => {
  it("votant honnête → 0, aucun signal", () => {
    assert.deepEqual(scoreRisk(honest()), { score: 0, flags: [] });
  });
  it("aucun signal d'empreinte, de stockage ni d'IP dans le score (ils passent par les règles B1 à H9 et le moteur de groupes)", () => {
    for (const legacy of ["device_voted_today", "device_voted_twice", "local_vote_day", "new_cookie_device_voted", "device_same_ip", "ip_many_votes", "ip_very_many_votes", "device_same_decoration"]) {
      assert.ok(!(legacy in RISK_SIGNALS), legacy);
      assert.ok(flagLabel(legacy).includes("ancien calcul"), `libellé conservé pour les anciennes lignes : ${legacy}`);
    }
  });
  it("sans empreinte → 45", () => only({ noDevice: true }, 45, "no_device"));
  it("durée < 6 s → 25 ; < 2 s → 40 ; inconnue ou ≥ 6 s → 0", () => {
    only({ durationMs: 5999 }, 25, "too_fast");
    only({ durationMs: 1999 }, 40, "way_too_fast");
    assert.equal(scoreRisk(honest({ durationMs: null })).score, 0);
    assert.equal(scoreRisk(honest({ durationMs: 6000 })).score, 0);
  });
  it("webdriver → 40", () => only({ webdriver: true }, 40, "webdriver"));
  it("UA mobile mais mobile=false déclaré → 15 ; navigateur incohérent → 15 ; cohérent ou inconnu → 0", () => {
    only({ declared: { mobile: false } }, 15, "ua_mismatch");
    only({ declared: { browser: "Chrome 130" } }, 15, "browser_mismatch"); // UA iPhone Safari
    assert.equal(scoreRisk(honest({ declared: { mobile: true, browser: "Safari 17" } })).score, 0);
    assert.equal(scoreRisk(honest({ declared: { mobile: true, browser: "Autre" } })).score, 0);
    assert.equal(scoreRisk(honest({ declared: {} })).score, 0);
    assert.equal(scoreRisk(honest({ userAgent: WINDOWS_CHROME, declared: { mobile: false } })).score, 0);
  });
});

describe("F8 : Brave et Samsung Internet honnêtes, sans affaiblir le contrôle", () => {
  it("Brave (agent utilisateur de Chrome) : aucun signal browser_mismatch, avec ou sans Sec-CH-UA", () => {
    const brave = '"Brave";v="156", "Chromium";v="156", "Not=A?Brand";v="24"';
    assert.deepEqual(chBrands(brave), ["Brave"]);
    assert.equal(browserMismatch("Brave 156", WINDOWS_CHROME, brave), false);
    assert.equal(browserMismatch("Brave 155", ANDROID_CHROME, null), false);
    assert.equal(scoreRisk(honest({ userAgent: WINDOWS_CHROME, secChUa: brave, declared: { mobile: false, browser: "Brave 156" } })).score, 0);
  });
  it("Samsung Internet (déclaré « Samsung Browser ») : aucun signal", () => {
    assert.equal(browserFamily("Samsung Browser 30.0"), "Samsung Internet");
    assert.equal(browserMismatch("Samsung Browser 30.0", SAMSUNG, null), false);
  });
  it("le contrôle reste entier pour les autres : Chrome déclaré sur un UA Safari, marque absente de Sec-CH-UA", () => {
    assert.equal(browserMismatch("Chrome 156", IPHONE_SAFARI, null), true);
    assert.equal(browserMismatch("Firefox 130", WINDOWS_CHROME, null), true);
    assert.equal(browserMismatch("Brave 156", WINDOWS_CHROME, '"Google Chrome";v="156", "Chromium";v="156"'), true, "Brave déclaré, Chrome dans les en-têtes");
    assert.equal(browserMismatch("Chrome 156", WINDOWS_CHROME, '"Google Chrome";v="156", "Chromium";v="156", "Not.A/Brand";v="99"'), false);
    assert.equal(browserMismatch("Edge 156", WINDOWS_CHROME + " Edg/156.0", '"Microsoft Edge";v="156", "Chromium";v="156"'), false);
  });
});

describe("agent utilisateur", () => {
  it("uaBrowser : Edge et Opera avant Chrome, Chrome avant Safari, versions iOS", () => {
    assert.equal(uaBrowser("Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/130.0 Safari/537.36 Edg/130.0"), "Edge");
    assert.equal(uaBrowser("Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/130.0 Safari/537.36 OPR/115.0"), "Opera");
    assert.equal(uaBrowser(ANDROID_CHROME), "Chrome");
    assert.equal(uaBrowser("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/130.0 Mobile/15E148 Safari/604.1"), "Chrome");
    assert.equal(uaBrowser(IPHONE_SAFARI), "Safari");
    assert.equal(uaBrowser("Mozilla/5.0 (Android 14; Mobile; rv:130.0) Gecko/130.0 Firefox/130.0"), "Firefox");
    assert.equal(uaBrowser(SAMSUNG), "Samsung Internet");
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

describe("réglages", () => {
  it("valeurs par défaut : block, 40, 80, plafond 60 et règles de la méthodologie ; bornes et clés inconnues refusées", () => {
    assert.deepEqual(DEFAULT_RISK_SETTINGS, {
      mode: "block",
      flag_threshold: 40,
      block_threshold: 80,
      ip_daily_max: 60,
      b2_strong_key: true,
      h2_anonymous_ip: true,
      h3_foreign_country: true,
      h4_strong_seen: true,
      h5_weak_network: true,
      h6_private_seen: true,
      h7_recidivism: true,
      b4_cross_browser: true,
      b4_strict_any_network: false,
      b5_private_block: true,
      h9_weak_nearby: true,
      h9_minutes: 10,
      c2_min_attempts: 3,
    });
    assert.ok(riskSettingsSchema.safeParse({ mode: "observe", flag_threshold: 0, block_threshold: 200 }).success);
    assert.ok(!riskSettingsSchema.safeParse({ mode: "block", flag_threshold: 40, block_threshold: 80, ip_daily_max: 1001 }).success);
    assert.ok(!riskSettingsSchema.safeParse({ mode: "block", flag_threshold: 80, block_threshold: 80 }).success);
    assert.ok(!riskSettingsSchema.safeParse({ mode: "block", flag_threshold: 10, block_threshold: 80, h9_minutes: 0 }).success);
    assert.ok(!riskSettingsSchema.safeParse({ mode: "block", flag_threshold: 10, block_threshold: 80, c2_min_attempts: 1 }).success);
    assert.ok(!riskSettingsSchema.safeParse({ mode: "off", flag_threshold: 10, block_threshold: 80 }).success);
    assert.ok(!riskSettingsSchema.safeParse({ mode: "block", flag_threshold: 10, block_threshold: 80, extra: 1 }).success);
  });
  it("réglages enregistrés en production avant la refonte (25 / 30, sans les nouvelles clés) : toujours valides, nouvelles règles aux valeurs par défaut", async () => {
    const stored = { mode: "block", flag_threshold: 25, block_threshold: 30, ip_daily_max: 60 };
    const s = await loadRiskSettings({ getSetting: async () => stored });
    assert.equal(s.flag_threshold, 25);
    assert.equal(s.b2_strong_key, true);
    assert.equal(s.h9_minutes, 10);
    assert.deepEqual(await loadRiskSettings({ getSetting: async () => null }), DEFAULT_RISK_SETTINGS);
    assert.deepEqual(await loadRiskSettings({ getSetting: async () => ({ mode: "observe" }) }), DEFAULT_RISK_SETTINGS);
  });
});
