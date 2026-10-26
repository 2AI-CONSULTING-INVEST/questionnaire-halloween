import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Visit } from "../../src/lib/schema";
import { BOT_UA_RE, isDuplicateVisit, referrerHost, summarizeVisits, VISIT_REJECTIONS, visitRejection } from "../../src/lib/visits";

const HUMANS = {
  "Chrome iPhone": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.37 Mobile/15E148 Safari/604.1",
  "Safari iPad": "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  "Samsung Internet": "Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36",
  "Firefox Android": "Mozilla/5.0 (Android 14; Mobile; rv:130.0) Gecko/130.0 Firefox/130.0",
  "Edge Windows": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.2849.56",
  "Cubot Android": "Mozilla/5.0 (Linux; Android 11; CUBOT X20 PRO Build/RP1A.200720.011) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
};
const BOTS = {
  Googlebot: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Googlebot/2.1; +http://www.google.com/bot.html) Chrome/130.0.0.0 Safari/537.36",
  bingbot: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/116.0.1938.76 Safari/537.36",
  facebookexternalhit: "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
  WhatsApp: "WhatsApp/2.23.20.0",
  curl: "curl/8.4.0",
  AhrefsBot: "Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)",
};

const DEVICE = { hash: "a".repeat(64), mobile: true, platform: "iPhone", browser: "Chrome 130", screen: "390x844@3", touch: true, webdriver: false };

describe("BOT_UA_RE", () => {
  for (const [name, ua] of Object.entries(BOTS)) it(`robot : ${name}`, () => assert.ok(BOT_UA_RE.test(ua)));
  for (const [name, ua] of Object.entries(HUMANS)) it(`humain : ${name}`, () => assert.ok(!BOT_UA_RE.test(ua)));
});

describe("visitRejection", () => {
  it("humain cohérent → compté", () => {
    assert.equal(visitRejection(HUMANS["Chrome iPhone"], DEVICE), null);
    assert.equal(visitRejection(HUMANS["Edge Windows"], { ...DEVICE, mobile: false, browser: "Edge 130" }), null);
    assert.equal(visitRejection(HUMANS["Samsung Internet"], { ...DEVICE, browser: "Samsung Internet 26" }), null);
  });
  it("UA de robot ou absent → ua_bot (avant tout le reste)", () => {
    assert.equal(visitRejection(BOTS.Googlebot, DEVICE), "ua_bot");
    assert.equal(visitRejection(null, DEVICE), "ua_bot");
    assert.equal(visitRejection("", DEVICE), "ua_bot");
  });
  it("webdriver → webdriver", () => assert.equal(visitRejection(HUMANS["Chrome iPhone"], { ...DEVICE, webdriver: true }), "webdriver"));
  it("sans empreinte (pas de JavaScript) → no_js_signals", () => {
    assert.equal(visitRejection(HUMANS["Chrome iPhone"], undefined), "no_js_signals");
    assert.equal(visitRejection(HUMANS["Chrome iPhone"], { mobile: true }), "no_js_signals");
  });
  it("mobile ou navigateur déclaré incohérent avec l'UA → ua_mismatch ; non déclaré → rien", () => {
    assert.equal(visitRejection(HUMANS["Chrome iPhone"], { ...DEVICE, mobile: false }), "ua_mismatch");
    assert.equal(visitRejection(HUMANS["Chrome iPhone"], { ...DEVICE, browser: "Firefox 130" }), "ua_mismatch");
    assert.equal(visitRejection(HUMANS["Chrome iPhone"], { hash: DEVICE.hash }), null);
  });
  it("chaque raison a un libellé et une explication", () => {
    for (const [code, r] of Object.entries(VISIT_REJECTIONS)) assert.ok(r.label && r.why.length > 20, code);
    assert.deepEqual(Object.keys(VISIT_REJECTIONS).sort(), ["no_js_signals", "ua_bot", "ua_mismatch", "webdriver"]);
  });
});

describe("referrerHost", () => {
  it("hôte seulement, ≤ 120 caractères, jamais le site lui-même", () => {
    assert.equal(referrerHost("https://www.instagram.com/p/abc?x=1", "www.chamas-nord.fr"), "www.instagram.com");
    assert.equal(referrerHost("https://www.chamas-nord.fr/halloween", "www.chamas-nord.fr"), null);
    assert.equal(referrerHost("pas une url", null), null);
    assert.equal(referrerHost(undefined, null), null);
    assert.equal(referrerHost(`https://${"a".repeat(200)}.fr/`, null)?.length, 120);
  });
});

let n = 0;
const visit = (over: Partial<Visit>): Visit => ({
  id: `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`,
  day: "2026-10-23",
  created_at: "2026-10-23T10:00:00.000Z",
  ip: "1.1.1.1",
  user_agent: HUMANS["Chrome iPhone"],
  path: "/",
  referrer: null,
  device_hash: "h1",
  device_info: { mobile: true, browser: "Chrome 130" },
  visitor_id: null,
  rejected: null,
  ...over,
});

describe("isDuplicateVisit (F-17)", () => {
  const base = { day: "2026-10-23", ip: "1.1.1.1", path: "/", rejected: null, device_hash: "h1", visitor_id: null };
  it("ligne rejetée : doublon par (jour, IP, raison) seulement", () => {
    const bot = { ...base, path: null, device_hash: null, rejected: "ua_bot" };
    assert.equal(isDuplicateVisit(bot, { ...bot }), true);
    assert.equal(isDuplicateVisit(bot, { ...bot, rejected: "webdriver" }), false);
    assert.equal(isDuplicateVisit(bot, { ...bot, ip: "2.2.2.2" }), false);
    assert.equal(isDuplicateVisit(bot, { ...bot, day: "2026-10-24" }), false);
    assert.equal(isDuplicateVisit(bot, { ...bot, ip: null }), false);
    assert.equal(isDuplicateVisit({ ...bot, ip: null }, { ...bot, ip: null }), true, "sans IP : une ligne par (jour, raison)");
  });
  it("visite comptée : doublon par (jour, page, visiteur) ; une rejetée ne compte pas comme comptée", () => {
    assert.equal(isDuplicateVisit(base, { ...base }), true);
    assert.equal(isDuplicateVisit(base, { ...base, path: "/resultats" }), false);
    assert.equal(isDuplicateVisit(base, { ...base, device_hash: "h2" }), false);
    assert.equal(isDuplicateVisit({ ...base, rejected: "ua_bot" }, base), false);
    assert.equal(isDuplicateVisit(base, { ...base, device_hash: null, visitor_id: null }), false, "sans visiteur identifiable : jamais doublon");
  });
});

describe("summarizeVisits", () => {
  it("visites, uniques (par empreinte, sinon cookie, par jour), robots ; appareils, provenances, navigateurs, par jour", () => {
    const rows = [
      visit({ path: "/" }),
      visit({ path: "/resultats" }), // même appareil, autre page : 2 visites, 1 unique
      visit({ device_hash: null, visitor_id: "v1", device_info: { mobile: false, browser: "Edge 130" }, referrer: "www.instagram.com" }),
      visit({ device_hash: null, visitor_id: null, device_info: null, user_agent: HUMANS["Firefox Android"], referrer: "www.instagram.com" }),
      visit({ rejected: "ua_bot", user_agent: BOTS.Googlebot, device_hash: null, device_info: null, path: null }),
      visit({ day: "2026-10-22", created_at: "2026-10-22T10:00:00.000Z", device_hash: "h1" }), // même empreinte, la veille : unique à nouveau
    ];
    const s = summarizeVisits(rows, "2026-10-23");
    assert.deepEqual(s.today, { visits: 4, unique: 3, rejected: 1 });
    assert.deepEqual(s.total, { visits: 5, unique: 4, rejected: 1 });
    assert.deepEqual(s.devices, { mobile: 3, desktop: 1 });
    assert.deepEqual(s.referrers, [{ key: "www.instagram.com", count: 2 }]);
    assert.deepEqual(s.browsers, [
      { key: "Chrome", count: 3 },
      { key: "Edge", count: 1 },
      { key: "Firefox", count: 1 },
    ]);
    assert.deepEqual(s.daily, [
      { date: "2026-10-22", visits: 1, unique: 1 },
      { date: "2026-10-23", visits: 4, unique: 3 },
    ]);
  });
  it("aucune visite → tout à zéro", () => {
    const s = summarizeVisits([], "2026-10-23");
    assert.deepEqual(s.today, { visits: 0, unique: 0, rejected: 0 });
    assert.deepEqual(s.daily, []);
    assert.deepEqual(s.referrers, []);
  });
});
