import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { summarize } from "../../src/lib/analytics";
import { isSecondPassword, readonlyPassword, roleForPassword } from "../../src/lib/auth";
import { formatWait, speakWait } from "../../src/lib/countdown";
import { countedVotesByParticipant } from "../../src/lib/db";
import { nextParisMidnight } from "../../src/lib/day";
import { participantsRows } from "../../src/lib/export";
import { crossBrowserText, entropyClass, FONT_LIST, gpuVendor, hwScreen, installedFonts, isComputerUa, osFamily, physicalPx, strictEligible, strictText } from "../../src/lib/fingerprint";
import { readGeo } from "../../src/lib/ip-geo";
import { toPublicResults } from "../../src/lib/public-results";
import { redactForViewer } from "../../src/lib/redact";
import { isCounted, voteStatus, type Decoration, type Participant, type ResponseRow } from "../../src/lib/schema";
import { deviceToken, effectiveEntropy, isComputer, storageKeyOf, uaImpliesStrong } from "../../src/lib/voter";

process.env.ADMIN_SESSION_SECRET ??= "test-secret-de-session-assez-long-0123456789";

let n = 0;
const row = (over: Partial<ResponseRow> = {}): ResponseRow => {
  n += 1;
  const at = "2026-10-27T12:00:00.000Z";
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    session_id: `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    selected_restaurant: "CHAMAS TACOS - LILLE MOULINS",
    selected_decoration_id: "d1",
    comment: null,
    wants_raffle: null,
    participant_id: null,
    voter_id: null,
    vote_day: "2026-10-27",
    completed_at: at,
    created_at: at,
    updated_at: at,
    ip_address: "203.0.113.1",
    user_agent: "UA",
    device_hash: "ab".repeat(32),
    device_info: { mobile: true },
    risk_score: 0,
    risk_flags: null,
    blocked_at: null,
    excluded_at: null,
    ...over,
  };
};

describe("vote compté : une seule définition, appliquée partout", () => {
  const counted = row();
  const held = row({ held_at: "2026-10-27T12:01:00.000Z" });
  const excludedAuto = row({ excluded_at: "2026-10-27T12:02:00.000Z", exclusion_source: "auto" });
  const excludedAdmin = row({ excluded_at: "2026-10-27T12:03:00.000Z", exclusion_source: "admin" });
  const blocked = row({ completed_at: null, blocked_at: "2026-10-27T12:04:00.000Z" });
  const all = [counted, held, excludedAuto, excludedAdmin, blocked];

  it("isCounted et voteStatus", () => {
    assert.deepEqual(all.map(isCounted), [true, false, false, false, false]);
    assert.deepEqual(all.map(voteStatus), ["counted", "held", "excluded", "excluded", "blocked"]);
    assert.equal(isCounted({ completed_at: "x", held_at: undefined, excluded_at: null }), true, "anciennes lignes sans held_at : lues comme null");
  });
  it("classement public et KPI : seuls les votes comptés", () => {
    const decorations: Decoration[] = [{ id: "d1", restaurant_name: "CHAMAS TACOS - LILLE MOULINS", image_url: "/x.webp", display_order: 0, created_at: "2026-10-01T00:00:00.000Z" }];
    const s = summarize(all, all.filter((r) => r.completed_at), decorations);
    assert.equal(s.kpis.totalVotes, 1);
    assert.equal(toPublicResults(s).total, 1);
    assert.equal(toPublicResults(s).results[0].votes, 1);
  });
  it("participants (backoffice et export) : votes comptés, un par jour au plus (F6)", () => {
    const p = "p1";
    const rows = [
      row({ participant_id: p }),
      row({ participant_id: p }), // même jour : un seul compte
      row({ participant_id: p, vote_day: "2026-10-28" }),
      row({ participant_id: p, vote_day: "2026-10-29", excluded_at: "x", exclusion_source: "admin" }),
      row({ participant_id: p, vote_day: "2026-10-30", held_at: "x" }),
    ];
    assert.equal(countedVotesByParticipant(rows).get(p), 2);
    const participant: Participant = { id: p, pseudo: "Alice", pseudo_key: "alice", email: "a@b.fr", phone_number: "+33612345678", created_at: "2026-10-27T00:00:00.000Z", updated_at: "2026-10-27T00:00:00.000Z" };
    const [line] = participantsRows([participant], rows, []);
    assert.ok(Object.values(line).includes(2), "l'export compte 2 votes");
  });
});

describe("position et pays déduits de l'IP (en-têtes Vercel)", () => {
  it("en-têtes absents : tout à null, aucun effet", () => {
    assert.deepEqual(readGeo(new Headers()), { city: null, region: null, country: null, timezone: null, latitude: null, longitude: null });
  });
  it("en-têtes valides, ville encodée RFC 3986", () => {
    const g = readGeo(new Headers({ "x-vercel-ip-city": "Villeneuve-d%27Ascq", "x-vercel-ip-country": "FR", "x-vercel-ip-timezone": "Europe/Paris", "x-vercel-ip-latitude": "50.62", "x-vercel-ip-longitude": "3.14" }));
    assert.deepEqual(g, { city: "Villeneuve-d'Ascq", region: null, country: "FR", timezone: "Europe/Paris", latitude: 50.62, longitude: 3.14 });
  });
  it("en-têtes invalides : ignorés", () => {
    const g = readGeo(new Headers({ "x-vercel-ip-country": "france", "x-vercel-ip-latitude": "abc", "x-vercel-ip-longitude": "999", "x-vercel-ip-timezone": "<script>", "x-vercel-ip-city": "%E0%A4%A" }));
    assert.deepEqual([g.country, g.latitude, g.longitude, g.timezone], [null, null, null, null]);
    assert.equal(g.city, "%E0%A4%A", "encodage invalide : valeur brute");
  });
});

describe("compte à rebours de la modale", () => {
  it("heures et minutes, puis minutes et secondes dans la dernière heure, puis secondes", () => {
    assert.equal(formatWait((5 * 3600 + 12 * 60 + 30) * 1000), "5 h 12 min");
    assert.equal(formatWait((3 * 60 + 40) * 1000), "3 min 40 s");
    assert.equal(formatWait(40_000), "40 s");
    assert.equal(formatWait(-5), "0 s");
    assert.equal(speakWait((2 * 3600 + 60) * 1000), "2 heures et 1 minute");
  });
  it("passage de minuit (heure de Paris) et changement d'heure du 25 octobre 2026", () => {
    const beforeDst = Date.parse("2026-10-24T21:30:00Z"); // 23 h 30 à Paris (UTC+2)
    assert.equal(formatWait(nextParisMidnight(beforeDst).getTime() - beforeDst), "30 min 0 s");
    const afterDst = Date.parse("2026-10-25T12:00:00Z"); // 13 h à Paris (UTC+1 depuis 3 h)
    assert.equal(formatWait(nextParisMidnight(afterDst).getTime() - afterDst), "11 h 0 min");
    const summer = Date.parse("2026-07-01T10:00:00Z"); // 12 h à Paris (UTC+2)
    assert.equal(formatWait(nextParisMidnight(summer).getTime() - summer), "12 h 0 min");
  });
});

describe("appareil : classe d'entropie, jetons, double validation", () => {
  it("classe d'entropie : forte (moteur lisible), faible (iPhone, moteur masqué), brouillée (Brave, valeurs changeantes, Firefox résistant)", () => {
    const base = { changing: false, brave: false, firefox: false, appleMobile: false, renderer: "Qualcomm/Adreno (TM) 730" };
    assert.equal(entropyClass(base), "strong");
    assert.equal(entropyClass({ ...base, appleMobile: true, renderer: "Apple Inc./Apple GPU" }), "weak");
    assert.equal(entropyClass({ ...base, renderer: "" }), "weak");
    assert.equal(entropyClass({ ...base, brave: true }), "noisy");
    assert.equal(entropyClass({ ...base, changing: true }), "noisy");
    assert.equal(entropyClass({ ...base, firefox: true, renderer: "Mozilla/Mozilla" }), "noisy");
  });
  it("classe retenue par le serveur : un Android Chrome qui se dit faible est fort ; un iPhone n'est jamais fort", () => {
    const android = "Mozilla/5.0 (Linux; Android 14; K) AppleWebKit/537.36 Chrome/156.0 Mobile Safari/537.36";
    assert.equal(effectiveEntropy("weak", android, '"Google Chrome";v="156"', "Pixel 8"), "strong");
    assert.equal(effectiveEntropy("noisy", android, '"Brave";v="156"', "Pixel 8"), "noisy");
    assert.equal(effectiveEntropy("strong", "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1", null), "weak");
    assert.equal(effectiveEntropy(undefined, android, null, "Pixel 8"), "strong");
  });
  it("A3 : classe absente ou basse, l'agent utilisateur tranche (Android Chrome, Chromium d'ordinateur) ; sinon faible", () => {
    const android = "Mozilla/5.0 (Linux; Android 14; K) AppleWebKit/537.36 Chrome/156.0 Mobile Safari/537.36";
    const windows = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0 Safari/537.36";
    const mac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0 Safari/537.36";
    const firefox = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0";
    const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1";
    const samsung = "Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 SamsungBrowser/27.0 Chrome/125.0 Mobile Safari/537.36";
    for (const claimed of [undefined, "weak", "noisy"] as const) {
      assert.equal(effectiveEntropy(claimed, android, null, "Pixel 8"), "strong", `Android ${claimed}`);
      assert.equal(effectiveEntropy(claimed, windows, '"Google Chrome";v="156"'), "strong", `Windows ${claimed}`);
      assert.equal(effectiveEntropy(claimed, mac, null), "strong", `Mac Chrome ${claimed}`);
    }
    assert.equal(effectiveEntropy(undefined, firefox, null), "weak");
    assert.equal(effectiveEntropy("noisy", firefox, null), "noisy");
    assert.equal(effectiveEntropy(undefined, iphone, null), "weak");
    assert.equal(effectiveEntropy(undefined, samsung, null), "weak");
    assert.equal(effectiveEntropy("noisy", windows, '"Brave";v="156"'), "noisy");
    assert.deepEqual([android, windows, mac, firefox, iphone, samsung].map((ua) => uaImpliesStrong(ua, null, "Pixel 8")), [true, true, true, false, false, false]);
  });
  it("clé inter-navigateurs : mêmes valeurs dans Chrome, Firefox et Edge ; processeurs plafonnés à 8, zoom sans effet", () => {
    const base = { os: "windows", width: 1536, height: 864, dpr: 1.25, cores: 12, tz: "Europe/Paris", touchPoints: 0 };
    const chrome = crossBrowserText(base);
    assert.equal(crossBrowserText({ ...base, cores: 16, width: 1745, height: 982, dpr: 1.1 }), chrome, "Firefox (16 coeurs au plus), zoom 110 %");
    assert.notEqual(crossBrowserText({ ...base, cores: 4 }), chrome);
    assert.notEqual(crossBrowserText({ ...base, touchPoints: 10 }), chrome);
    assert.deepEqual(
      [
        osFamily("Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0", undefined, false),
        osFamily("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/156.0 Safari/537.36 Edg/156.0", "Windows", false),
        osFamily("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15", undefined, true),
        osFamily("Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) Chrome/156.0 Safari/537.36", "Chrome OS", false),
      ],
      ["windows", "windows", "ios", "chromeos"],
    );
  });
  it("clé stricte : polices détectées par largeur, calculée seulement là où elle est stable", () => {
    const installed = new Set(["Calibri", "Segoe UI"]);
    const measure = (font: string) => {
      const m = font.match(/"([^"]+)"/);
      return m && installed.has(m[1]) ? 101 : 100;
    };
    assert.deepEqual(installedFonts(measure, ["Arial Black", "Calibri", "Segoe UI", "Menlo"]), ["Calibri", "Segoe UI"]);
    assert.equal(strictEligible("windows", "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0"), true);
    assert.equal(strictEligible("macos", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15"), false, "Safari masque les polices ajoutées");
    assert.equal(strictEligible("macos", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/156.0 Safari/537.36"), true);
    assert.equal(strictEligible("android", "Mozilla/5.0 (Linux; Android 14) Chrome/156.0 Mobile Safari/537.36"), false);
  });
  it("A29 : Chrome et Edge sur le même poste (Edge expose Roboto en plus) : même clé stricte après filtrage", () => {
    for (const f of ["Roboto", "Noto Sans", "Noto Serif", "Open Sans", "Twemoji Mozilla", "Aptos"]) assert.ok(!FONT_LIST.includes(f), f);
    const chrome = new Set(FONT_LIST.slice(0, 108)); // relevé de l'auditeur : 108 polices côté Chrome
    const edge = new Set([...chrome, "Roboto"]); // 109 côté Edge : les mêmes, plus Roboto
    const measureFor = (installed: Set<string>) => (font: string) => {
      const m = font.match(/"([^"]+)"/);
      return m && installed.has(m[1]) ? 101 : 100;
    };
    const keyOf = (installed: Set<string>) => strictText({ os: "windows", cores: 8, tz: "Europe/Paris", touchPoints: 0, gpu: "intel", fonts: installedFonts(measureFor(installed)) });
    assert.equal(keyOf(edge), keyOf(chrome));
  });
  it("A31 : ordinateur d'après l'agent utilisateur, écran tactile compris ; iPad en mode ordinateur exclu ; xKey stable", () => {
    const win = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/156.0 Safari/537.36";
    const mac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15";
    assert.equal(isComputer(win, true), true, "PC Windows tactile");
    assert.equal(isComputer(win, false), true);
    assert.equal(isComputer(mac, false), true);
    assert.equal(isComputer(mac, true), false, "iPad en mode ordinateur");
    assert.equal(isComputer("Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) Chrome/156.0", true), true);
    assert.equal(isComputer("Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/156.0 Mobile Safari/537.36", false), false);
    const touchPc = { os: "windows", width: 1920, height: 1280, dpr: 1.5, cores: 8, tz: "Europe/Paris" };
    assert.equal(crossBrowserText({ ...touchPc, touchPoints: 10 }), crossBrowserText({ ...touchPc, touchPoints: 5 }), "écran tactile en oui ou non : même clé quel que soit le nombre de points annoncé");
  });
  it("A36 : deux écrans sur le même PC (1536x960@1,25 et 2560x1440@1) : même clé stricte, même écran (vide) dans la clé matérielle", () => {
    const machine = { os: "windows", cores: 12, tz: "Europe/Paris", touchPoints: 0, gpu: "intel", fonts: ["Calibri", "Segoe UI"] };
    assert.equal(strictText({ ...machine }), strictText({ ...machine }), "aucune dimension d'écran dans la clé stricte");
    assert.ok(!strictText(machine).includes("1920") && !strictText(machine).includes("2560"));
    assert.equal(hwScreen(true, 1536, 960, 1.25, 24), hwScreen(true, 2560, 1440, 1, 30), "ordinateur : l'écran n'entre pas dans la clé matérielle");
    assert.notEqual(hwScreen(false, 412, 915, 2.625, 24), hwScreen(false, 393, 851, 2.75, 24), "téléphone : l'écran reste dans la clé");
    assert.equal(hwScreen(false, 412, 915, 2.625, 24), "1080x2400x24");
    assert.notEqual(crossBrowserText({ os: "windows", width: 1536, height: 960, dpr: 1.25, cores: 12, tz: "Europe/Paris", touchPoints: 0 }), crossBrowserText({ os: "windows", width: 2560, height: 1440, dpr: 1, cores: 12, tz: "Europe/Paris", touchPoints: 0 }), "la clé large garde l'écran (limite documentée)");
  });
  it("A36 : fabricant de la carte graphique normalisé (Chrome ANGLE, Edge, Firefox, Safari)", () => {
    const cases: [string, string][] = [
      ["Google Inc. (Intel)/ANGLE (Intel, Intel(R) UHD Graphics 620 (0x00005917) Direct3D11 vs_5_0 ps_5_0, D3D11)", "intel"],
      ["Google Inc. (Intel)/ANGLE (Intel, Intel(R) Iris(R) Xe Graphics (0x000046A6) Direct3D11 vs_5_0 ps_5_0, D3D11)", "intel"],
      ["Mozilla/ANGLE (Intel, Intel(R) HD Graphics 400 Direct3D11 vs_5_0 ps_5_0)", "intel"],
      ["Google Inc. (NVIDIA)/ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 (0x00002504) Direct3D11 vs_5_0 ps_5_0, D3D11)", "nvidia"],
      ["Mozilla/ANGLE (NVIDIA, NVIDIA GeForce GTX 980 Direct3D11 vs_5_0 ps_5_0)", "nvidia"],
      ["Google Inc. (AMD)/ANGLE (AMD, AMD Radeon(TM) Graphics (0x00001638) Direct3D11 vs_5_0 ps_5_0, D3D11)", "amd"],
      ["Google Inc. (Apple)/ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)", "apple"],
      ["Apple Inc./Apple GPU", "apple"],
      ["Google Inc. (Qualcomm)/ANGLE (Qualcomm, Adreno (TM) 730, OpenGL ES 3.2)", "qualcomm"],
      ["ARM/Mali-G78", "arm"],
      ["Google Inc. (Google)/ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)", "autre"],
      ["Mozilla/Mozilla", "autre"],
      ["", "autre"],
    ];
    for (const [renderer, vendor] of cases) assert.equal(gpuVendor(renderer), vendor, renderer);
  });
  it("A36 : ordinateur côté navigateur, même logique que le serveur", () => {
    const win = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/156.0";
    const mac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/18.0 Safari/605.1.15";
    assert.deepEqual([isComputerUa(win, 10), isComputerUa(mac, 0), isComputerUa(mac, 5), isComputerUa("Mozilla/5.0 (Linux; Android 14) Mobile", 5)], [true, true, false, false]);
    assert.deepEqual([isComputer(win, true), isComputer(mac, false), isComputer(mac, true)], [true, true, false]);
  });
  it("A17 : Android sans modèle ou en WebView, jamais fort (client et serveur)", () => {
    const android = "Mozilla/5.0 (Linux; Android 14; K) AppleWebKit/537.36 Chrome/156.0 Mobile Safari/537.36";
    const webview = "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP1A; wv) AppleWebKit/537.36 Version/4.0 Chrome/156.0 Mobile Safari/537.36";
    for (const claimed of [undefined, "weak", "strong"] as const) {
      assert.equal(effectiveEntropy(claimed, android, null), "weak", `sans modèle, ${claimed}`);
      assert.equal(effectiveEntropy(claimed, webview, null, "Pixel 8"), "weak", `WebView, ${claimed}`);
    }
    assert.equal(effectiveEntropy("noisy", android, null), "noisy");
    assert.equal(uaImpliesStrong(android, null), false);
    assert.equal(uaImpliesStrong(webview, null, "Pixel 8"), false);
    assert.equal(effectiveEntropy("strong", android, null, "Pixel 8"), "strong");
    const base = { changing: false, brave: false, firefox: false, appleMobile: false, renderer: "Qualcomm/Adreno (TM) 730" };
    assert.equal(entropyClass({ ...base, android: true, model: "Pixel 8" }), "strong");
    assert.equal(entropyClass({ ...base, android: true }), "weak");
    assert.equal(entropyClass({ ...base, android: true, model: "Pixel 8", webview: true }), "weak");
    assert.equal(entropyClass({ ...base, android: false }), "strong", "ordinateur : pas de modèle exigé");
  });
  it("A4 : écran en pixels physiques arrondis, insensible au zoom de Chrome sur ordinateur ; téléphones constants", () => {
    for (const [w, h, base] of [[1920, 1080, 1], [1920, 1080, 1.25], [2560, 1440, 1], [1366, 768, 1]]) {
      for (const zoom of [0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2]) {
        const dpr = base * zoom;
        assert.equal(physicalPx(Math.round(w / dpr), dpr), physicalPx(w, 1), `${w} à ${zoom}`);
        assert.equal(physicalPx(Math.round(h / dpr), dpr), physicalPx(h, 1), `${h} à ${zoom}`);
      }
    }
    assert.equal(physicalPx(412, 2.625), 1080); // Android : rapport fixe
    assert.equal(physicalPx(390, 3), 1170); // iPhone
  });
  it("jeton de l'appareil : dérivé du cookie, jamais égal, stable ; HMAC du jeton distinct", () => {
    const voter = "11111111-1111-4111-8111-111111111111";
    assert.equal(deviceToken(voter), deviceToken(voter));
    assert.notEqual(deviceToken(voter), voter);
    assert.match(deviceToken(voter), /^[A-Za-z0-9_-]{32}$/);
    assert.notEqual(storageKeyOf(deviceToken(voter)), deviceToken(voter));
  });
  it("double validation : mot de passe de lecture seule exact ; absent ou faux refusé", () => {
    const saved = process.env.ADMIN_READONLY_PASSWORD;
    process.env.ADMIN_READONLY_PASSWORD = "lecture-seule-0123456789";
    assert.equal(isSecondPassword("lecture-seule-0123456789"), true);
    assert.equal(isSecondPassword("lecture-seule-012345678"), false);
    assert.equal(isSecondPassword(""), false);
    delete process.env.ADMIN_READONLY_PASSWORD;
    assert.equal(isSecondPassword("lecture-seule-0123456789"), false, "variable absente : impossible");
    if (saved !== undefined) process.env.ADMIN_READONLY_PASSWORD = saved;
  });
  it("lecture seule trop courte en production : compte inactif, l'admin se connecte toujours", () => {
    const saved = { ...process.env };
    const logError = console.error;
    const logged: unknown[] = [];
    console.error = (...args: unknown[]) => void logged.push(args);
    try {
      Object.assign(process.env, { NODE_ENV: "production", ADMIN_PASSWORD: "admin-0123456789abcdef", ADMIN_READONLY_PASSWORD: "court" });
      assert.equal(roleForPassword("admin-0123456789abcdef"), "admin");
      assert.equal(roleForPassword("court"), null);
      assert.equal(isSecondPassword("court"), false);
      assert.equal(readonlyPassword(), null);
      assert.ok(logged.length > 0, "message dans les journaux du serveur");
      Object.assign(process.env, { ADMIN_PASSWORD: "court" });
      assert.throws(() => roleForPassword("x"), /ADMIN_PASSWORD/, "un mot de passe admin trop court reste une erreur (F-05)");
    } finally {
      console.error = logError;
      for (const k of ["NODE_ENV", "ADMIN_PASSWORD", "ADMIN_READONLY_PASSWORD"]) {
        if (saved[k] === undefined) delete process.env[k];
        else Object.assign(process.env, { [k]: saved[k] });
      }
    }
  });
  it("lecture seule : les nouveaux champs anti-fraude sont masqués", () => {
    const r = redactForViewer(row({ hw_key: "k".repeat(64), ip_city: "Lille", ip_latitude: 50, ip_country: "FR", storage_key: "s", seen_storage: ["s"], ip_net: "1.2.3.4", ip_class: "tor", held_at: "x" }));
    assert.deepEqual([r.hw_key, r.ip_city, r.ip_latitude, r.ip_country, r.storage_key, r.seen_storage, r.ip_net, r.ip_class, r.ip_address], [null, null, null, null, null, null, null, null, null]);
    assert.equal(r.held_at, "x", "le statut reste visible");
  });
});
