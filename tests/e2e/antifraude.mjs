/**
 * Scénarios de bout en bout de l'anti-fraude, des votes inachevés, de la pagination, des participants
 * supprimés, des agrégats des graphiques, du compteur de visites et des correctifs de sécurité du lot 1
 * (F-01/F-18, F-02, F-03, F-04, F-05, F-06 de AUDIT-SECURITE-2026-10-24.md), contre un
 * serveur local en stockage JSON (jamais la base de production) :
 *
 *   NEXT_PUBLIC_SUPABASE_URL= SUPABASE_SERVICE_ROLE_KEY= ADMIN_PASSWORD=test-admin-9c2e-0123 \
 *   ADMIN_READONLY_PASSWORD=test-viewer-4b7a ADMIN_SESSION_SECRET=<32+ caractères> \
 *   TOR_EXIT_LIST=185.220.101.10,185.220.101.11 node node_modules/next/dist/bin/next start -p 3200
 * après un build avec l'horloge de test (scénarios du lendemain) :
 *   NEXT_PUBLIC_HW_TEST_CLOCK=1 NEXT_PUBLIC_SUPABASE_URL= SUPABASE_SERVICE_ROLE_KEY= node node_modules/next/dist/bin/next build
 *   node tests/e2e/antifraude.mjs            (HW_BASE, ADMIN_PASSWORD, ADMIN_READONLY_PASSWORD surchargeables)
 *
 * Le fichier .data/db.json est sauvegardé, remplacé par un jeu de données vide, puis restauré.
 */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

const BASE = process.env.HW_BASE ?? "http://localhost:3200/halloween";
const ADMIN = process.env.ADMIN_PASSWORD ?? "test-admin-9c2e-0123"; // 16 caractères minimum (next start = production)
const VIEWER = process.env.ADMIN_READONLY_PASSWORD ?? "test-viewer-4b7a";
const DATA = path.join(process.cwd(), ".data", "db.json");
const BACKUP = `${DATA}.e2e-backup`;

const RESTAURANT = "CHAMAS TACOS - LILLE FIVES";
/** Sorties Tor fictives, déclarées au serveur de test par TOR_EXIT_LIST ; horloge de test (cookie, build NEXT_PUBLIC_HW_TEST_CLOCK=1). */
const TOR_IP = "185.220.101.10";
const TOR_IP2 = "185.220.101.11";
const TEST_CLOCK_COOKIE = "hw_test_now";
const DECO_A = randomUUID();
const DECO_B = randomUUID();

function seedData() {
  const now = new Date().toISOString();
  return {
    responses: [],
    restaurants: [{ id: randomUUID(), name: RESTAURANT, city: "Lille", created_at: now }],
    decorations: [
      { id: DECO_A, restaurant_name: RESTAURANT, image_url: "/seed/deco-1.webp", display_order: 0, created_at: now },
      { id: DECO_B, restaurant_name: "CHAMAS TACOS - LILLE MOULINS", image_url: "/seed/deco-2.webp", display_order: 1, created_at: now },
    ],
    participants: [],
    prizes: [],
    admin_sessions: [],
    admin_actions: [],
    settings: {},
    visits: [],
    login_failures: [],
  };
}

/** Client HTTP avec son pot à cookies, son adresse IP (X-Forwarded-For) et ses en-têtes (agent utilisateur, position Vercel…). */
function client(ip, base = {}) {
  const jar = new Map();
  return {
    ip,
    jar,
    async req(p, init = {}) {
      const headers = { "X-Forwarded-For": ip, "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148 Safari/604.1", ...base, ...(init.headers ?? {}) };
      if (jar.size) headers.Cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
      if (init.body !== undefined && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
      const res = await fetch(`${BASE}${p}`, { ...init, headers, body: init.body === undefined ? undefined : JSON.stringify(init.body), redirect: "manual" });
      for (const c of res.headers.getSetCookie()) {
        const [pair] = c.split(";");
        const [k, v] = pair.split("=");
        jar.set(k.trim(), v);
      }
      const text = await res.text();
      let body = null;
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
      return { status: res.status, body };
    },
  };
}

const DEVICE = (seed, extra = {}) => ({ hash: seed.repeat(64).slice(0, 64), mobile: true, platform: "iPhone", screen: "390x844@3", touch: true, webdriver: false, ...extra });
const VOTE = (deco = DECO_A) => ({ selected_restaurant: RESTAURANT, selected_decoration_id: deco, comment: null });

let passed = 0;
function ok(label, cond, detail) {
  assert.ok(cond, `${label}${detail ? ` : ${JSON.stringify(detail)}` : ""}`);
  passed += 1;
  console.log(`  ✔ ${label}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login(password) {
  const c = client("9.9.9.9");
  const r = await c.req("/api/admin/login", { method: "POST", body: { password } });
  assert.equal(r.status, 200, `connexion backoffice (${password})`);
  return c;
}

async function main() {
  mkdirSync(path.dirname(DATA), { recursive: true });
  if (existsSync(DATA)) renameSync(DATA, BACKUP);
  writeFileSync(DATA, JSON.stringify(seedData(), null, 2));
  try {
    await run();
    console.log(`\n${passed} vérifications réussies.`);
  } finally {
    if (existsSync(BACKUP)) {
      unlinkSync(DATA);
      renameSync(BACKUP, DATA);
    }
  }
}

async function run() {
  const admin = await login(ADMIN);
  const viewer = await login(VIEWER);
  const anon = client("8.8.8.8");
  const status = await anon.req("/api/vote-status");
  const today = status.body.today;
  ok("GET /api/vote-status donne le jour courant à Paris", /^\d{4}-\d{2}-\d{2}$/.test(today));

  // ----- Pagination : 230 réponses, 100 par page, curseur, total exact --------------------------
  console.log("\nPagination");
  const N = 230;
  const created = [];
  for (let i = 0; i < N; i += 10) {
    await Promise.all(
      Array.from({ length: 10 }, async (_, j) => {
        const id = randomUUID();
        // Une IP par groupe : la limite de 100 requêtes/min par IP ne doit pas jouer ici.
        const c = client(`10.0.${(i >> 8) & 255}.${(i + j) & 255}`);
        const r = await c.req("/api/responses/create", { method: "POST", body: { session_id: id, device: DEVICE("f") } });
        assert.equal(r.status, 201, "création de session");
        created.push(id);
      }),
    );
  }
  const seen = new Set();
  let cursor = null;
  let pages = 0;
  let total = 0;
  do {
    const r = await admin.req(`/api/admin/responses?status=all&limit=100${cursor ? `&cursor=${cursor}` : ""}`);
    assert.equal(r.status, 200);
    pages += 1;
    total = r.body.total;
    for (const row of r.body.rows) seen.add(row.session_id);
    if (pages < 3) ok(`page ${pages} : 100 lignes et un curseur`, r.body.rows.length === 100 && typeof r.body.nextCursor === "string");
    else ok(`page ${pages} : ${r.body.rows.length} lignes, sans curseur`, r.body.rows.length === 30 && r.body.nextCursor === null);
    cursor = r.body.nextCursor;
  } while (cursor);
  ok("3 pages, total exact, aucune ligne manquante ni en double", pages === 3 && total === N && seen.size === N && created.every((id) => seen.has(id)));
  const inc = await admin.req("/api/admin/responses?status=incomplete&limit=5");
  ok("filtre « inachevés » appliqué côté serveur (total = 230, 5 lignes)", inc.body.total === N && inc.body.rows.length === 5);
  const bad = await admin.req("/api/admin/responses?cursor=%24%24");
  ok("curseur mal formé refusé", bad.status === 400 || bad.status === 422);
  const over = await admin.req("/api/admin/responses?limit=500");
  ok("limit > 200 refusé", over.status === 422);
  const badIp = await admin.req("/api/admin/responses?status=all&q=999.999.999.999");
  ok("recherche d'une IP incomplète → 200 et 0 ligne (aucune requête inet)", badIp.status === 200 && badIp.body.total === 0 && badIp.body.rows.length === 0);
  const hex = await admin.req("/api/admin/responses?status=all&q=ff");
  ok("recherche hexa trop courte (2 caractères) → 422 (regex de la route)", hex.status === 422);

  // ----- Anti-fraude (refonte du 2026-10-28) : les 30 scénarios du cahier des charges, puis B4 et H10 (31 à 36) --------------
  // Réglages par défaut de la méthodologie. Chaque vote laisse 2,1 s entre l'ouverture et la validation
  // (pas de signal « way_too_fast »). Chaque scénario a ses clés et ses adresses IP.
  console.log("\nAnti-fraude");
  const DEFAULTS = { mode: "block", flag_threshold: 40, block_threshold: 80, ip_daily_max: 60 };
  const setSettings = async (over = {}) => {
    const r = await admin.req("/api/admin/settings", { method: "PATCH", body: { ...DEFAULTS, ...over } });
    assert.equal(r.status, 200, `réglages ${JSON.stringify(over)}`);
  };
  await setSettings();
  const sha = (seed) => createHash("sha256").update(seed).digest("hex");
  const UA_ANDROID = "Mozilla/5.0 (Linux; Android 14; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Mobile Safari/537.36";
  const ANDROID = (key, extra = {}) => ({ hash: sha(`h-${key}`), hw: sha(`hw-${key}`), hwEntropy: "strong", model: "Pixel 8", osVersion: "14", mobile: true, platform: "Android", browser: "Chrome 156", screen: "393x851@2.75", touch: true, webdriver: false, ...extra });
  const IPHONE = (key, extra = {}) => ({ hash: sha(`h-${key}`), hw: sha(`hw-${key}`), hwEntropy: "weak", mobile: true, platform: "iPhone", browser: "Safari 17", screen: "390x844@3", touch: true, webdriver: false, ...extra });
  const android = (ip, headers = {}) => client(ip, { "User-Agent": UA_ANDROID, ...headers });
  const iphone = (ip, headers = {}) => client(ip, headers);
  const open = async (c, id, device) => c.req("/api/responses/create", { method: "POST", body: { session_id: id, device } });
  const complete = (c, id, device, deco) => c.req(`/api/responses/${id}/complete`, { method: "POST", body: { ...VOTE(deco), device } });
  const score = async (sessionId) => (await admin.req(`/api/responses/${sessionId}`)).body;
  /** Un vote complet : ouverture, 2,1 s, validation. Refus à l'ouverture : { stage: "create" }. */
  const vote = async (c, device, { deco, wait = 2100 } = {}) => {
    const sid = randomUUID();
    const o = await open(c, sid, device);
    if (o.status !== 201) return { stage: "create", status: o.status, body: o.body, sid };
    await sleep(wait);
    const r = await complete(c, sid, device, deco);
    return { stage: "complete", status: r.status, body: r.body, sid, token: o.body.deviceToken };
  };
  const publicTotal = async () => (await anon.req("/api/results")).body.total;
  const settle = () => sleep(400); // le moteur de groupes tourne après la réponse (after)
  const statusOf = (row) => (row.blocked_at ? "blocked" : !row.completed_at ? "incomplete" : row.excluded_at ? "excluded" : row.held_at ? "held" : "counted");
  const refusal = (r) => r.status === 409 && r.body.details?.code === "already_voted_today" && typeof r.body.details.nextResetAt === "string";
  const shape = (r) => JSON.stringify({ status: r.status, error: r.body.error, keys: Object.keys(r.body.details ?? {}).sort(), code: r.body.details?.code });

  // 1. votant honnête, un vote par jour pendant deux jours
  const honest = iphone("1.1.1.1");
  const af_v1 = await vote(honest, IPHONE("honnete"));
  const honestSession = af_v1.sid;
  ok("1. votant honnête, 1er jour : compté", af_v1.status === 200 && statusOf(await score(af_v1.sid)) === "counted" && af_v1.body.voteDay === today, af_v1.body);
  honest.jar.set(TEST_CLOCK_COOKIE, encodeURIComponent("+86400000"));
  const af_v1b = await vote(honest, IPHONE("honnete"));
  ok("1. votant honnête, lendemain (horloge de test) : compté", af_v1b.status === 200 && statusOf(await score(af_v1b.sid)) === "counted" && af_v1b.body.voteDay !== today, af_v1b.body);
  honest.jar.delete(TEST_CLOCK_COOKIE);
  const hRow = await score(honestSession);

  // 2. navigation privée en boucle, Android (clé forte), même IP
  // Chromium : la navigation privée n'est pas détectée (privateMode null), seule la clé forte et le même réseau relient.
  const loop = await vote(android("2.2.2.2"), ANDROID("boucle"));
  const loop2 = await vote(android("2.2.2.2"), ANDROID("boucle"));
  const loop3 = await vote(android("2.2.2.2"), ANDROID("boucle"));
  ok("2. Android en navigation privée, même IP : 1er compté, les suivants refusés dès l'ouverture (B2)", loop.status === 200 && loop2.stage === "create" && refusal(loop2) && loop3.stage === "create" && refusal(loop3));
  await setSettings({ b2_strong_key: false });
  const k2 = [1, 2, 3].map(() => android("2.2.2.3"));
  const b1 = await vote(k2[0], ANDROID("boucle-b2off"));
  const b2 = await vote(k2[1], ANDROID("boucle-b2off"));
  const b2row = await score(b2.sid);
  const b3 = await vote(k2[2], ANDROID("boucle-b2off"));
  await settle();
  const [af_r1, af_r2, r3] = [await score(b1.sid), await score(b2.sid), await score(b3.sid)];
  ok("2. B2 désactivé : 2e en attente (H4), le 3e confirme le groupe (C2), 2e et 3e exclus, le 1er reste compté", statusOf(b2row) === "held" && b2row.fraud_reasons.includes("H4") && statusOf(af_r1) === "counted" && statusOf(af_r2) === "excluded" && statusOf(r3) === "excluded" && r3.exclusion_source === "auto" && !!af_r1.group_id, [statusOf(b2row), statusOf(af_r1), statusOf(af_r2), statusOf(r3)]);
  await setSettings();

  // 3. même scénario, une IP différente à chaque vote (la faille F1)
  const f1 = [];
  for (let i = 0; i < 4; i++) f1.push(await vote(android(`33.3.${i}.${i + 1}`), ANDROID("rotation-ip"))); // 3.3.x.x : plage d'hébergeur
  const f1rows = await Promise.all(f1.filter((r) => r.stage === "complete").map((r) => score(r.sid)));
  ok("3. IP différente à chaque vote : au plus 1 compté (F1 fermée), les autres en attente (H4) ou refusés", f1rows.filter((r) => statusOf(r) === "counted").length <= 1, f1rows.map(statusOf));

  // 4. sortie Tor (TOR_EXIT_LIST du serveur de test)
  const tor = await vote(iphone(TOR_IP), IPHONE("tor"));
  const torRow = await score(tor.sid);
  ok("4. IP de sortie Tor : en attente (H2), réponse identique à celle d'un vote compté", tor.status === 200 && Object.keys(tor.body).sort().join() === Object.keys(af_v1.body).sort().join() && statusOf(torRow) === "held" && torRow.fraud_reasons.includes("H2") && torRow.ip_class === "tor", torRow.fraud_reasons);

  // 5. pays différent de FR (en-tête Vercel)
  const dz = await vote(iphone("5.5.5.5", { "x-vercel-ip-country": "DZ" }), IPHONE("etranger"));
  const dzRow = await score(dz.sid);
  ok("5. pays de l'IP différent de FR : en attente (H3)", dz.status === 200 && statusOf(dzRow) === "held" && dzRow.fraud_reasons.includes("H3") && dzRow.ip_country === "DZ");

  // 6. quatre iPhone identiques, quatre IP mobiles différentes, même décoration (QR code en restaurant)
  const qr = await Promise.all([1, 2, 3, 4].map((i) => vote(iphone(`6.6.6.${i}`), IPHONE("qr-code"))));
  await settle();
  ok("6. quatre iPhone identiques, quatre réseaux mobiles : les quatre comptés", qr.every((r) => r.status === 200) && (await Promise.all(qr.map((r) => score(r.sid)))).every((x) => statusOf(x) === "counted"));

  // 7. deux iPhone identiques sur le même Wi-Fi
  const w1 = await vote(iphone("7.7.7.7"), IPHONE("wifi"));
  const w2 = await vote(iphone("7.7.7.7"), IPHONE("wifi"));
  await settle();
  const [wr1, wr2] = [await score(w1.sid), await score(w2.sid)];
  ok("7. deux iPhone identiques sur le même Wi-Fi : un compté, un en attente (H5), jamais bloqué ni exclu", w1.status === 200 && w2.status === 200 && statusOf(wr1) === "counted" && statusOf(wr2) === "held" && wr2.fraud_reasons.includes("H5"));

  // 8. deux Android identiques (même modèle), IP et ville différentes : aucun second indice
  const af_t1 = await vote(android("8.8.1.1", { "x-vercel-ip-city": "Lille" }), ANDROID("jumeaux"));
  const af_t2 = await vote(android("8.8.2.2", { "x-vercel-ip-city": "Roubaix" }), ANDROID("jumeaux"));
  const t2row = await score(af_t2.sid);
  ok("8. même modèle Android, IP et ville différentes : 201 à l'ouverture, en attente (H4) à la validation, jamais refusé", af_t1.status === 200 && af_t2.stage === "complete" && af_t2.status === 200 && statusOf(t2row) === "held" && t2row.fraud_reasons.includes("H4") && !t2row.fraud_reasons.includes("B2"), [af_t2.stage, t2row.fraud_reasons]);
  const pendingList = (await admin.req("/api/admin/fraud/review?kind=pending&limit=100")).body;
  ok("8. le vote en attente est visible dans « Votes suspects en attente »", pendingList.items.some((v) => v.id === t2row.id));
  await setSettings({ b2_strong_key: false });
  const af_u1 = await vote(android("8.8.3.3"), ANDROID("jumeaux-b2off"));
  const af_u2 = await vote(android("8.9.4.4"), ANDROID("jumeaux-b2off")); // 8.8.4.4 : hébergeur (H2 fausserait le motif)
  await settle();
  ok("8. B2 désactivé : un compté, un en attente, jamais exclu", statusOf(await score(af_u1.sid)) === "counted" && statusOf(await score(af_u2.sid)) === "held");
  await setSettings();

  // 9. même participant depuis deux appareils le même jour
  const pA = iphone("9.9.1.1");
  const pB = android("9.9.2.2");
  const af_pa = await vote(pA, IPHONE("participant-a"));
  const pb = await vote(pB, ANDROID("participant-b"));
  const coords = { wants_raffle: true, pseudo: "Double Vote", phone_number: "06 11 22 33 44", email: "double.vote+1@gmail.com" };
  await pA.req(`/api/responses/${af_pa.sid}/raffle`, { method: "POST", body: coords });
  const linked = await pB.req(`/api/responses/${pb.sid}/raffle`, { method: "POST", body: coords });
  await settle();
  const pList = (await admin.req("/api/admin/participants?q=double")).body;
  ok("9. même participant, deux appareils : le second vote est exclu après l'inscription, le participant compte 1 vote", linked.status === 200 && statusOf(await score(af_pa.sid)) === "counted" && statusOf(await score(pb.sid)) === "excluded" && pList.rows[0]?.votes === 1 && pList.rows[0]?.groups.length === 1, pList.rows[0]);

  // 10. jeton retrouvé dans le stockage alors que le cookie est absent
  const tk = await vote(iphone("10.0.0.1"), IPHONE("jeton-1"));
  const tkAgain = await open(iphone("10.0.0.1"), randomUUID(), IPHONE("jeton-2", { tokens: [tk.token] }));
  ok("10. jeton du stockage d'une tentative du jour, cookie absent : 409 (B1)", typeof tk.token === "string" && refusal(tkAgain));

  // 11. après coup, B2 désactivé : 1 compté, 2 en attente, la 3e confirme, 2 et 3 exclues, total public juste
  await setSettings({ b2_strong_key: false });
  const before11 = await publicTotal();
  const a11 = [];
  for (let i = 0; i < 3; i++) a11.push(await vote(android(`11.0.${i}.1`), ANDROID("apres-coup")));
  await settle();
  const s11 = await Promise.all(a11.map((r) => score(r.sid)));
  ok("11. après coup : la 1re reste comptée, 2e et 3e exclues, le total public augmente de 1", s11.map(statusOf).join() === "counted,excluded,excluded" && (await publicTotal()) === before11 + 1, s11.map(statusOf));
  await setSettings();

  // 12. décision humaine prioritaire sur Recalculer
  const held12 = await vote(iphone(TOR_IP), IPHONE("humain-valide"));
  const ok12 = await admin.req("/api/admin/fraud/decide", { method: "POST", body: { ids: [(await score(held12.sid)).id], action: "validate", password: VIEWER } });
  const excl12 = await admin.req("/api/admin/fraud/decide", { method: "POST", body: { ids: [s11[0].id], action: "invalidate" } });
  await admin.req("/api/admin/fraud/recompute", { method: "POST", body: { day: today } });
  const [h12, e12] = [await score(held12.sid), await score(a11[0].sid)];
  ok("12. un vote validé à la main reste compté après Recalculer, un vote exclu à la main reste exclu", ok12.status === 200 && excl12.status === 200 && statusOf(h12) === "counted" && h12.human_decision === "validated" && statusOf(e12) === "excluded" && e12.human_decision === "excluded");

  // 13. cinq validations parallèles du même Android, cookies différents
  const par = [1, 2, 3, 4, 5].map((i) => ({ c: android(`13.0.0.${i}`), sid: randomUUID() }));
  const opened = await Promise.all(par.map((p) => open(p.c, p.sid, ANDROID("parallele"))));
  await sleep(2100);
  const parRes = await Promise.all(par.map((p) => complete(p.c, p.sid, ANDROID("parallele"))));
  await settle();
  const parRows = await Promise.all(par.map((p) => score(p.sid)));
  ok("13. cinq validations parallèles, même Android : au plus 1 compté, aucune erreur 500", opened.every((o) => o.status === 201) && parRes.every((r) => r.status === 200 || r.status === 409) && parRows.filter((r) => statusOf(r) === "counted").length <= 1, parRes.map((r) => r.status));

  // 14. mode observation
  await setSettings({ mode: "observe" });
  const ob1 = await vote(android("14.0.0.1"), ANDROID("observation"));
  const ob2 = await vote(android("14.0.0.2"), ANDROID("observation"));
  const ob3 = await vote(iphone(TOR_IP), IPHONE("observation-tor"));
  const [obr2, obr3] = [await score(ob2.sid), await score(ob3.sid)];
  ok("14. mode observation : rien n'est retenu ni bloqué, les décisions évitées sont visibles", ob1.status === 200 && ob2.status === 200 && ob3.status === 200 && statusOf(obr2) === "counted" && obr3.observed_outcome === "held" && statusOf(obr3) === "counted", [obr2.observed_outcome, obr3.observed_outcome]);
  await setSettings();

  // 15. rôle lecture seule
  const roRow = (await viewer.req(`/api/responses/${tor.sid}`)).body;
  const roDecide = await viewer.req("/api/admin/fraud/decide", { method: "POST", body: { ids: [torRow.id], action: "invalidate" } });
  const roRecompute = await viewer.req("/api/admin/fraud/recompute", { method: "POST", body: { day: today } });
  const roList = (await viewer.req("/api/admin/fraud/review?kind=pending")).body;
  ok("15. lecture seule : nouveaux champs masqués, aucune action possible", roRow.hw_key === null && roRow.ip_class === null && roRow.ip_city === null && roDecide.status === 403 && roRecompute.status === 403 && roList.items.every((v) => v.ip === null && v.hwPrefix === null));

  // 16. lendemain d'un groupe confirmé : récidive de l'Android, iPhone identique compté
  const anonIp = [1, 2].map(() => vote(iphone(TOR_IP2), IPHONE("groupe-iphone", { privateMode: true })));
  await Promise.all(anonIp);
  await settle();
  const tomorrow = (c) => (c.jar.set(TEST_CLOCK_COOKIE, encodeURIComponent("+86400000")), c);
  const rec = await vote(tomorrow(android("16.0.0.1")), ANDROID("apres-coup"));
  const twin = await vote(tomorrow(iphone("16.0.0.2")), IPHONE("groupe-iphone"));
  const [recRow, twinRow] = [await score(rec.sid), await score(twin.sid)];
  ok("16. lendemain : l'Android du groupe passe en attente (H7), l'iPhone identique est compté", statusOf(recRow) === "held" && recRow.fraud_reasons.includes("H7") && statusOf(twinRow) === "counted", [recRow.fraud_reasons, statusOf(twinRow)]);

  // 17. iCloud Private Relay
  const relay = await vote(iphone("172.225.116.162"), IPHONE("relay"));
  const relayRow = await score(relay.sid);
  ok("17. adresse d'iCloud Private Relay : comptée", relay.status === 200 && statusOf(relayRow) === "counted" && relayRow.ip_class === "relay");

  // 18. refus visible : même code et même corps pour tous les motifs
  const byCookie = await open(honest, randomUUID(), IPHONE("honnete"));
  const byIpCap = await (async () => {
    await setSettings({ ip_daily_max: 1 });
    const r = await vote(iphone("18.0.0.1"), IPHONE("cap-1"));
    const s = await vote(iphone("18.0.0.1"), IPHONE("cap-2"));
    await setSettings();
    return r.status === 200 ? s : r;
  })();
  ok("18. refus visibles (cookie, stockage, clé forte, plafond par IP) : même code, même forme, nextResetAt", [byCookie, tkAgain, loop2, byIpCap].every(refusal) && new Set([byCookie, tkAgain, loop2, byIpCap].map(shape)).size === 1, [byCookie, tkAgain, loop2, byIpCap].map(shape));

  // 19 à 21. verrouillage à l'arrivée (vote-status en POST, même reconnaissance que create et complete)
  const arrival = async (c, device) => (await c.req("/api/vote-status", { method: "POST", body: { device } })).body;
  const s19 = await arrival(honest, IPHONE("honnete"));
  ok("19. arrivée avec le cookie d'une tentative du jour : votedToday, l'ouverture est refusée", s19.votedToday === true && refusal(byCookie) && typeof s19.nextResetAt === "string" && !("reason" in s19));
  ok("20. arrivée sans cookie ni jeton, même Android (clé forte), même réseau (second indice) : votedToday", (await arrival(android("2.2.2.2"), ANDROID("boucle"))).votedToday === true);
  ok("21. arrivée sans cookie ni jeton, iPhone identique : votedToday faux", (await arrival(iphone("21.0.0.1"), IPHONE("wifi"))).votedToday === false);

  // 22. vote-status jamais appelé (lent ou en erreur côté page) : create refuse quand même
  ok("22. sans passer par vote-status, l'ouverture refuse quand même", refusal(await open(android("2.2.2.2"), randomUUID(), ANDROID("boucle"))));

  // 23. après minuit, le vote rouvre pour tous
  const dayAfter = (c) => (c.jar.set(TEST_CLOCK_COOKIE, encodeURIComponent("+172800000")), c); // J+2 : le votant honnête a déjà voté à J+1 (scénario 1)
  const reopen = await open(dayAfter(android("2.2.2.2")), randomUUID(), ANDROID("boucle"));
  const reopenHonest = await open(dayAfter(honest), randomUUID(), IPHONE("honnete"));
  ok("23. après minuit (horloge de test) : le vote rouvre pour tous, même cookie et même clé forte", reopen.status === 201 && reopenHonest.status === 201, [reopen.status, reopenHonest.status]);
  honest.jar.delete(TEST_CLOCK_COOKIE);

  // 24. vote compté, puis nouvelle tentative 1 minute après, même Android sans cookie
  const c24 = await vote(android("24.0.0.1"), ANDROID("une-minute"));
  const r24 = await open(android("24.0.0.1"), randomUUID(), ANDROID("une-minute")); // même Wi-Fi : second indice
  const list24 = (await admin.req("/api/admin/fraud/review?kind=fraud&limit=100")).body;
  const key24 = (await score(c24.sid)).hw_key.slice(0, 8);
  ok("24. nouvelle tentative du même Android sans cookie, même réseau : refusée, listée dans « Votes frauduleux »", c24.status === 200 && refusal(r24) && list24.items.some((p) => p.firstView.hwPrefix === key24 && p.firstView.stage === "create"));

  // 25. iPhone identique, même ville, même décoration, peu après : attente, priorité haute, notification
  const city = { "x-vercel-ip-city": "Lille", "x-vercel-ip-country": "FR" };
  await vote(iphone("25.0.0.1", city), IPHONE("meme-ville"));
  const near = await vote(iphone("25.0.0.2", city), IPHONE("meme-ville"));
  const nearRow = await score(near.sid);
  const notif = (await admin.req("/api/admin/fraud/notifications")).body;
  ok("25. même ville, même décoration, peu après : en attente, priorité haute (H9), non compté, notification créée", statusOf(nearRow) === "held" && nearRow.held_priority === true && nearRow.fraud_reasons.includes("H9") && notif.latest.some((i) => i.view.id === nearRow.id) && notif.highPriority >= 1);

  // 26. en-têtes de position absents ou invalides
  const badGeo = await vote(iphone("26.0.0.1", { "x-vercel-ip-latitude": "abc", "x-vercel-ip-country": "france" }), IPHONE("entetes"));
  ok("26. en-têtes de position invalides : aucun effet, vote compté", badGeo.status === 200 && statusOf(await score(badGeo.sid)) === "counted");

  // 27. cinq tentatives bloquées du même Android : une seule ligne, dépli dans l'ordre
  // 27.0.0.0/16 est classé hébergeur (le vote serait en attente, H2) : 27.1.x.x est une plage ordinaire.
  const c27 = await vote(android("27.1.0.1"), ANDROID("cinq-blocages"));
  for (let i = 0; i < 5; i++) await open(android("27.1.0.1"), randomUUID(), ANDROID("cinq-blocages")); // nouveau cookie à chaque fois, même réseau : second indice
  const row27 = await score(c27.sid);
  const list27 = (await admin.req("/api/admin/fraud/review?kind=fraud&limit=100")).body;
  const p27 = list27.items.filter((p) => p.firstView.hwPrefix === row27.hw_key.slice(0, 8));
  const d27 = p27.length === 1 ? (await admin.req(`/api/admin/fraud/person?key=${encodeURIComponent(p27[0].key)}`)).body : null;
  ok("27. cinq tentatives bloquées du même Android : une seule ligne (son premier blocage, 5 tentatives), le vote compté rappelé en tête, les quatre autres dans l'ordre", c27.status === 200 && p27.length === 1 && p27[0].count === 5 && d27?.counted?.id === row27.id && d27.attempts.length === 4 && d27.attempts.every((a, i, all) => i === 0 || all[i - 1].at <= a.at), [p27.map((p) => p.count), d27?.attempts.length]);

  // 28. double validation
  const h28 = await vote(iphone(TOR_IP), IPHONE("double-validation"));
  const id28 = (await score(h28.sid)).id;
  const before28 = await publicTotal();
  const noPw = await admin.req("/api/admin/fraud/decide", { method: "POST", body: { ids: [id28], action: "validate" } });
  const badPw = await admin.req("/api/admin/fraud/decide", { method: "POST", body: { ids: [id28], action: "validate", password: "mauvais-mot-de-passe" } });
  const asViewer = await viewer.req("/api/admin/fraud/decide", { method: "POST", body: { ids: [id28], action: "validate", password: VIEWER } });
  const af_failures = (await admin.req("/api/admin/sessions")).body.failures.last24h;
  const good = await admin.req("/api/admin/fraud/decide", { method: "POST", body: { ids: [id28], action: "validate", password: VIEWER } });
  ok("28. double validation : sans mot de passe ou mauvais → refusé et compté ; lecture seule → 403 ; bon mot de passe → compté, total public mis à jour", noPw.status === 403 && badPw.status === 403 && asViewer.status === 403 && af_failures >= 2 && good.status === 200 && statusOf(await score(h28.sid)) === "counted" && (await publicTotal()) === before28 + 1, [noPw.status, badPw.status, asViewer.status, good.status, af_failures]);
  const journal28 = (await admin.req("/api/admin/sessions")).body.actions.find((a) => a.path === "/api/admin/fraud/decide" && a.details?.action === "validate");
  ok("28. action journalisée avec les votes concernés, mot de passe masqué", !!journal28 && JSON.stringify(journal28.details).includes(id28) && !JSON.stringify(journal28.details).includes(VIEWER));

  // 29. vote au seuil de signalement (« trop rapide », 25 points, seuil réglé à 25)
  await setSettings({ flag_threshold: 25, block_threshold: 80 });
  const af_fast = await vote(iphone("29.0.0.1"), IPHONE("seuil"), { wait: 2100 });
  const af_fastRow = await score(af_fast.sid);
  ok("29. vote au seuil de signalement : en attente (H8), non compté", af_fast.status === 200 && statusOf(af_fastRow) === "held" && af_fastRow.fraud_reasons.includes("H8"), af_fastRow.risk_flags);
  await setSettings();

  // 30. Brave honnête
  const brave = await vote(client("30.0.0.1", { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36", "sec-ch-ua": '"Brave";v="156", "Chromium";v="156", "Not=A?Brand";v="24"' }), { ...ANDROID("brave"), hwEntropy: "noisy", mobile: false, platform: "Windows", browser: "Brave 156", screen: "1366x768@1.5" });
  const braveRow = await score(brave.sid);
  ok("30. Brave honnête : aucun signal browser_mismatch, compté", brave.status === 200 && !(braveRow.risk_flags ?? []).includes("browser_mismatch") && statusOf(braveRow) === "counted", braveRow.risk_flags);

  // B5. navigation privée sur Safari iPhone (détectée) : refus dès l'ouverture
  const priv = await vote(iphone("26.0.0.2"), IPHONE("prive", { privateMode: true }));
  ok("B5. Safari iPhone en navigation privée : refusé dès l'ouverture", priv.stage === "create" && refusal(priv), [priv.stage, priv.status]);

  // 31. même ordinateur Windows, trois navigateurs (Chrome, Firefox, Edge), même réseau : B4
  const UA_WIN = {
    chrome: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36",
    firefox: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0",
    edge: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36 Edg/156.0.0.0",
  };
  const PC = (browser, key, extra = {}) => ({
    hash: sha(`h-${key}-${browser}`),
    hw: sha(`hw-${key}-${browser}`), // chaque navigateur a sa clé matérielle (carte graphique masquée, langues, mémoire)
    hwEntropy: browser === "firefox" ? "weak" : "strong",
    xKey: sha(`x-${key}`),
    mKey: sha(`m-${key}`), // clé stricte : polices identiques d'un navigateur à l'autre (relevé réel Chrome et Edge)
    mobile: false,
    platform: "Windows",
    browser: { chrome: "Chrome 156", firefox: "Firefox 140", edge: "Edge 156" }[browser],
    screen: "1536x864@1.25",
    touch: false,
    webdriver: false,
    ...extra,
  });
  const pc = (ip, browser) => client(ip, { "User-Agent": UA_WIN[browser] });
  const c31 = await vote(pc("31.0.0.1", "chrome"), PC("chrome", "pc31"));
  const arrival31 = (await pc("31.0.0.1", "firefox").req("/api/vote-status", { method: "POST", body: { device: PC("firefox", "pc31") } })).body;
  ok("31. arrivée du 2e navigateur (Firefox), avant toute ouverture : votedToday et nextResetAt (écran « déjà voté », sans bouton)", arrival31.votedToday === true && typeof arrival31.nextResetAt === "string" && !("reason" in arrival31), arrival31);
  const f31 = await open(pc("31.0.0.1", "firefox"), randomUUID(), PC("firefox", "pc31"));
  const e31 = await open(pc("31.0.0.1", "edge"), randomUUID(), PC("edge", "pc31"));
  const c31row = await score(c31.sid);
  ok("31. même PC (même clé stricte), Chrome puis Firefox puis Edge, même IP : Chrome compté, Firefox et Edge refusés dès l'ouverture (B4)", c31.status === 200 && statusOf(c31row) === "counted" && refusal(f31) && refusal(e31), [c31.status, f31.status, e31.status]);
  const list31 = (await admin.req("/api/admin/fraud/review?kind=fraud&limit=100")).body;
  ok("31. les refus portent la raison B4 et sont visibles dans « Votes frauduleux »", list31.items.some((p) => p.firstView.reasons.includes("B4")));

  // 32. même PC, autre navigateur, passage en 4G : clé stricte (polices). Attente par défaut, refus avec « B4 sur tout réseau »
  const strict = { mKey: sha("m-pc32") };
  const c32 = await vote(pc("32.0.0.1", "chrome"), PC("chrome", "pc32", strict));
  const f32 = await vote(pc("32.1.0.1", "firefox"), PC("firefox", "pc32", strict));
  const f32row = await score(f32.sid);
  ok("32. clé stricte depuis un autre réseau (4G), réglage par défaut : ouverture 201, en attente (H10), non compté", c32.status === 200 && f32.stage === "complete" && f32.status === 200 && statusOf(f32row) === "held" && f32row.fraud_reasons.includes("H10"), [f32.stage, f32row.fraud_reasons]);
  await setSettings({ b4_strict_any_network: true });
  const e32 = await open(pc("32.2.0.1", "edge"), randomUUID(), PC("edge", "pc32", strict));
  await setSettings();
  ok("32. même PC, autre navigateur, passage en 4G, « B4 sur tout réseau » activé : refusé avec la clé stricte", refusal(e32), [e32.status, e32.body]);

  // 33. Chrome sur le Wi-Fi, puis Edge en 4G : clé stricte identique (Roboto, exposée par Edge seul, n'est pas mesurée)
  const strict33 = { mKey: sha("m-pc33") };
  const c33 = await vote(pc("33.0.0.1", "chrome"), PC("chrome", "pc33", strict33));
  const e33 = await vote(pc("33.1.0.1", "edge"), PC("edge", "pc33", strict33));
  const e33row = await score(e33.sid);
  ok("33. Chrome sur le Wi-Fi puis Edge en 4G, réglage par défaut : Edge en attente (H10)", c33.status === 200 && e33.stage === "complete" && statusOf(e33row) === "held" && e33row.fraud_reasons.includes("H10"), [e33.stage, e33row.fraud_reasons]);
  await setSettings({ b4_strict_any_network: true });
  const e33b = await open(pc("33.2.0.1", "edge"), randomUUID(), PC("edge", "pc33-bis", strict33));
  await setSettings();
  ok("33. même cas avec « B4 sur tout réseau » activé : refusé", refusal(e33b), [e33b.status]);

  // 34. deux PC de même configuration (même clé large), polices différentes (autre clé stricte), même réseau
  const c34 = await vote(pc("34.0.0.1", "chrome"), PC("chrome", "pc34"));
  const o34sid = randomUUID();
  const second34 = pc("34.0.0.1", "chrome");
  const other34 = PC("chrome", "pc34", { hw: sha("hw-pc34-second"), hash: sha("h-pc34-second"), mKey: sha("m-pc34-autres-polices") });
  const o34 = await open(second34, o34sid, other34);
  await sleep(2100);
  const v34 = await complete(second34, o34sid, other34);
  const r34 = await score(o34sid);
  ok("34. deux PC, même clé large, clé stricte différente, même IP : 201 à l'ouverture puis en attente (H10), jamais refusé", c34.status === 200 && o34.status === 201 && v34.status === 200 && statusOf(r34) === "held" && r34.fraud_reasons.includes("H10") && !r34.fraud_reasons.includes("B4"), [o34.status, v34.status, r34.fraud_reasons]);

  // 35. Chrome puis Brave sur le même réseau : Brave brouille ses clés, seul le réseau le relie (H10)
  const c35 = await vote(pc("35.0.0.1", "chrome"), PC("chrome", "pc35"));
  const brave35 = client("35.0.0.1", { "User-Agent": UA_WIN.chrome, "sec-ch-ua": '"Brave";v="156", "Chromium";v="156", "Not=A?Brand";v="24"' });
  const b35 = await vote(brave35, PC("chrome", "pc35-brave-brouille", { hwEntropy: "noisy", browser: "Brave 156", xKey: sha(`x-brave-${randomUUID()}`), mKey: sha(`m-brave-${randomUUID()}`) }));
  const r35 = await score(b35.sid);
  ok("35. Chrome puis Brave, même réseau : Brave en attente (H10), jamais refusé", c35.status === 200 && b35.stage === "complete" && b35.status === 200 && statusOf(r35) === "held" && r35.fraud_reasons.includes("H10"), [b35.stage, r35.fraud_reasons]);

  // 36. même PC à deux écrans : fenêtre glissée de 1536x960@1,25 vers 2560x1440@1. Clé matérielle et clé
  // stricte calculées sans l'écran (même valeur) ; la clé large change (elle garde l'écran).
  const twoScreens = (screenLabel, extra = {}) => PC("chrome", "pc36", { screen: screenLabel, ...extra });
  const c36 = await vote(pc("36.0.0.1", "chrome"), twoScreens("1536x960@1.25", { xKey: sha("x-pc36-ecran-portable") }));
  const second36 = pc("36.0.0.1", "edge");
  const arrival36 = (await second36.req("/api/vote-status", { method: "POST", body: { device: PC("edge", "pc36", { screen: "2560x1440@1", xKey: sha("x-pc36-ecran-externe") }) } })).body;
  const o36 = await open(second36, randomUUID(), PC("edge", "pc36", { screen: "2560x1440@1", xKey: sha("x-pc36-ecran-externe") }));
  ok("36. même PC, autre écran (2560x1440@1 contre 1536x960@1,25), même réseau : « déjà voté » à l'arrivée et refus B4 à l'ouverture", c36.status === 200 && arrival36.votedToday === true && refusal(o36), [arrival36, o36.status]);

  // Compteurs de l'onglet Sécurité (lecture seule : IP masquées)
  const sec = await viewer.req("/api/admin/security");
  ok("onglet Sécurité : compteurs comptés, en attente, bloqués, exclus (auto et à la main)", sec.status === 200 && sec.body.today.counted > 0 && sec.body.today.held > 0 && sec.body.today.blocked > 0 && sec.body.today.autoExcluded > 0 && sec.body.today.adminExcluded > 0 && sec.body.pending > 0);
  ok("GET /api/admin/security sans cookie → 401", (await anon.req("/api/admin/security")).status === 401);

  // Exclusion et réintégration (réintégrer fait compter : double validation)
  const beforeEx = await publicTotal();
  const exc = await admin.req(`/api/responses/${hRow.id}`, { method: "PATCH", body: { excluded: true } });
  ok("exclusion → /api/results décrémente", exc.status === 200 && (await publicTotal()) === beforeEx - 1);
  const noPwBack = await admin.req(`/api/responses/${hRow.id}`, { method: "PATCH", body: { excluded: false } });
  const back = await admin.req(`/api/responses/${hRow.id}`, { method: "PATCH", body: { excluded: false, password: VIEWER } });
  ok("réintégration sans mot de passe refusée, avec le mot de passe de lecture seule → total rétabli", noPwBack.status === 403 && back.status === 200 && (await publicTotal()) === beforeEx);
  ok("exclusion refusée en lecture seule (403)", (await viewer.req(`/api/responses/${hRow.id}`, { method: "PATCH", body: { excluded: true } })).status === 403);

  // Variables reprises par les sections suivantes (participants, sécurité du lot 1).
  const x = iphone("2.2.9.9");
  const xv = await vote(x, IPHONE("participant-x"));
  const xs = xv.sid;
  const wipedSession = tor.sid; // ligne d'iPhone relue par les contrôles F-21

  // ----- Participants : recherche et tri côté serveur --------------------------------------------
  console.log("\nParticipants");
  // Comptes relatifs : les scénarios anti-fraude ont déjà inscrit un participant (scénario 9).
  const lightBefore = (await viewer.req("/api/admin/participants?light=1")).body.length;
  const summaryBefore = (await admin.req("/api/analytics/summary")).body;
  const kpiBefore = summaryBefore.kpis.raffleParticipants;
  const raffleBefore = summaryBefore.byDecoration.reduce((a, d) => a + d.raffle, 0);
  const raffle = await honest.req(`/api/responses/${honestSession}/raffle`, { method: "POST", body: { wants_raffle: true, pseudo: "Élodie Fantôme", phone_number: "06 12 34 56 78", email: "elodie@example.com" } });
  ok("inscription au tirage", raffle.status === 200, raffle.body);
  const dupMail = await x.req(`/api/responses/${xs}/raffle`, { method: "POST", body: { wants_raffle: true, pseudo: "Quelquun", phone_number: "06 00 00 00 01", email: "elodie@example.com" } });
  const dupPhone = await x.req(`/api/responses/${xs}/raffle`, { method: "POST", body: { wants_raffle: true, pseudo: "Quelquun", phone_number: "06 12 34 56 78", email: "autre@example.com" } });
  ok("F-09 : conflit email → 409 générique sans details.email ; conflit téléphone → même corps", dupMail.status === 409 && dupPhone.status === 409 && !dupMail.body.details && JSON.stringify(dupMail.body) === JSON.stringify(dupPhone.body) && dupMail.body.error === "Ces coordonnées sont déjà utilisées pour une inscription", dupMail.body);
  const badName = await x.req(`/api/responses/${xs}/raffle`, { method: "POST", body: { wants_raffle: true, pseudo: "Quelquun", first_name: "<b>Marc</b>", phone_number: "06 00 00 00 01", email: "nouveau@example.com" } });
  ok("F-21 : prénom hors jeu de caractères du pseudo → 422 first_name", badName.status === 422 && Array.isArray(badName.body.details?.first_name));
  const found = await admin.req("/api/admin/participants?q=elodie%20fant");
  ok("recherche par pseudo (sans accents) → 1 participant, 1 vote", found.body.total === 1 && found.body.rows[0].pseudo === "Élodie Fantôme" && found.body.rows[0].votes === 1);
  const byMail = await admin.req("/api/admin/participants?q=elodie%40example&sort=email&dir=asc");
  ok("recherche par email, tri email", byMail.body.rows.length === 1 && byMail.body.nextCursor === null);
  const none = await admin.req("/api/admin/participants?q=%25_rien");
  ok("motif « %_ » échappé : aucun résultat", none.body.total === 0);
  const pid = found.body.rows[0].id;
  const votes = await viewer.req(`/api/participants/${pid}/votes`);
  ok("votes d'un participant (lecture seule) : 1 vote validé avec sa décoration et les réglages", votes.status === 200 && votes.body.votes.length === 1 && votes.body.votes[0].participant_id === pid && typeof votes.body.votes[0].decoration === "string" && votes.body.settings.block_threshold > 0);
  const nobody = await viewer.req("/api/participants/00000000-0000-4000-8000-000000000000/votes");
  ok("votes d'un participant inconnu → 200 et liste vide", nobody.status === 200 && nobody.body.votes.length === 0);
  const light = await viewer.req("/api/admin/participants?light=1");
  ok("liste légère { id, pseudo }", Array.isArray(light.body) && light.body.length === lightBefore + 1 && light.body.some((p) => p.id === pid) && light.body.every((p) => Object.keys(p).sort().join() === "id,pseudo"));
  const csv = await viewer.req("/api/responses/export?scope=all&format=csv&status=completed");
  ok("export CSV : colonnes anti-fraude, filtre du statut", csv.status === 200 && csv.body.includes("Score de risque") && csv.body.includes("Exclu") && !csv.body.includes("Incomplet"));

  // ----- Participants supprimés : suppression douce, réinscription, restauration -------------------
  console.log("\nParticipants supprimés");
  const del = await admin.req(`/api/participants/${pid}`, { method: "DELETE" });
  ok("suppression douce → 200", del.status === 200);
  const activeList = await admin.req("/api/admin/participants?q=elodie");
  ok("absent de la liste active", activeList.body.total === 0 && activeList.body.rows.length === 0);
  const lightAfter = await admin.req("/api/admin/participants?light=1");
  ok("absent de la liste légère", lightAfter.body.length === lightBefore && !lightAfter.body.some((p) => p.id === pid));
  const publicPage = await anon.req("/participants");
  ok("absent de la page publique (/participants rend 200 sans le pseudo)", publicPage.status === 200 && typeof publicPage.body === "string" && !publicPage.body.includes("Élodie Fantôme"));
  const deletedList = await admin.req("/api/admin/participants?deleted=1");
  ok("présent dans ?deleted=1 avec deleted_at", deletedList.body.total === 1 && deletedList.body.rows[0].id === pid && typeof deletedList.body.rows[0].deleted_at === "string");
  const votesAfter = await viewer.req(`/api/participants/${pid}/votes`);
  ok("ses votes restent consultables (participant_id conservé)", votesAfter.body.votes.length === 1 && votesAfter.body.votes[0].participant_id === pid);
  const summaryDel = (await admin.req("/api/analytics/summary")).body;
  ok("KPI participants du tableau de bord : inchangé (supprimé exclu)", summaryDel.kpis.raffleParticipants === kpiBefore);
  const again3 = await x.req(`/api/responses/${xs}/raffle`, { method: "POST", body: { wants_raffle: true, pseudo: "Élodie Bis", phone_number: "06 12 34 56 78", email: "elodie@example.com" } });
  ok("réinscription avec le même email et téléphone → 200, nouvelle ligne", again3.status === 200 && again3.body.alreadyRegistered === false, again3.body);
  const restoreKo = await admin.req(`/api/participants/${pid}/restore`, { method: "POST" });
  ok("restaurer l'ancien → 409 email (et téléphone)", restoreKo.status === 409 && Array.isArray(restoreKo.body.details?.email) && Array.isArray(restoreKo.body.details?.phone_number), restoreKo.body);
  const newRow = (await admin.req("/api/admin/participants?q=elodie%20bis")).body.rows[0];
  const prize = await admin.req("/api/prizes", { method: "POST", body: { name: "Menu offert" } });
  assert.equal(prize.status, 201, "création d'un lot");
  await admin.req(`/api/participants/${newRow.id}`, { method: "DELETE" });
  const prizeKo = await admin.req(`/api/prizes/${prize.body.id}`, { method: "PATCH", body: { winner_participant_id: newRow.id } });
  ok("un lot ne peut pas être attribué à un supprimé → 409", prizeKo.status === 409);
  const restoreOk = await admin.req(`/api/participants/${pid}/restore`, { method: "POST" });
  ok("supprimer le nouveau puis restaurer l'ancien → 200", restoreOk.status === 200);
  const back2 = await admin.req("/api/admin/participants?q=elodie");
  ok("l'ancien est de nouveau actif", back2.body.total === 1 && back2.body.rows[0].id === pid && back2.body.rows[0].deleted_at === null);
  const restoreRo = await viewer.req(`/api/participants/${newRow.id}/restore`, { method: "POST" });
  ok("restauration refusée en lecture seule (403)", restoreRo.status === 403);
  const journal2 = (await admin.req("/api/admin/sessions")).body.actions;
  ok("journal : « Suppression : participant » et « Restauration : participant »", journal2.some((a) => a.action === "Suppression : participant") && journal2.some((a) => a.action === "Restauration : participant" && a.path === `/api/participants/${pid}/restore`));
  const csvDel = await admin.req("/api/responses/export?scope=participants&deleted=1&format=csv");
  ok("export des supprimés à part, colonne « Supprimé le »", csvDel.status === 200 && csvDel.body.includes("Supprimé le") && csvDel.body.includes("Élodie Bis") && !csvDel.body.includes("Élodie Fantôme"));

  // ----- Graphiques en grand : agrégats du résumé, rien de nouveau en public -------------------------
  console.log("\nGraphiques");
  const full = (await viewer.req("/api/analytics/summary")).body;
  ok("summary : byDecorationDaily, favoriteVsVote, byHour (24), dailyTable", Array.isArray(full.byDecorationDaily) && Array.isArray(full.favoriteVsVote) && full.byHour.length === 24 && Array.isArray(full.dailyTable) && full.dailyTable.length >= 1);
  ok("summary : votes du jour par restaurant et par heure cohérents avec le total", full.byDecorationDaily.reduce((a, d) => a + Object.values(d.votes).reduce((x, y) => x + y, 0), 0) === full.kpis.totalVotes && full.byHour.reduce((a, h) => a + h.votes, 0) === full.kpis.totalVotes);
  ok("summary : byDecoration porte commentaires et inscrits au tirage", typeof full.byDecoration[0].comments === "number" && full.byDecoration.reduce((a, d) => a + d.raffle, 0) === raffleBefore + 1);
  const pub = (await anon.req("/api/results")).body;
  ok("/api/results n'expose rien de nouveau (total, results[id, restaurant_name, image_url, votes, share], updatedAt)", Object.keys(pub).sort().join() === "results,total,updatedAt" && pub.results.every((r) => Object.keys(r).sort().join() === "id,image_url,restaurant_name,share,votes"));

  // ----- Compteur de visites : beacons, robots écartés, résumé --------------------------------------
  console.log("\nVisites");
  const visitor = client("7.7.7.7");
  const beacon = (c, body, headers = {}) => c.req("/api/visit", { method: "POST", body, headers });
  const v1 = await beacon(visitor, { path: "/halloween/", referrer: "https://www.instagram.com/chamas/", device: DEVICE("1") });
  ok("beacon accepté → 204", v1.status === 204);
  const sum1 = (await admin.req("/api/admin/visits/summary")).body;
  ok("visite comptée : 1 visite, 1 visiteur unique aujourd'hui", sum1.today.visits === 1 && sum1.today.unique === 1 && sum1.today.rejected === 0, sum1.today);
  await beacon(visitor, { path: "/halloween/", device: DEVICE("1") });
  const sum2 = (await admin.req("/api/admin/visits/summary")).body;
  ok("même empreinte, même jour, même page → pas de nouvelle visite", sum2.today.visits === 1 && sum2.today.unique === 1);
  await beacon(visitor, { path: "/halloween/resultats", device: DEVICE("1") });
  const sum3 = (await admin.req("/api/admin/visits/summary")).body;
  ok("autre page, même visiteur → 2 visites, toujours 1 unique", sum3.today.visits === 2 && sum3.today.unique === 1);
  const bot = await beacon(client("7.7.7.8"), { path: "/halloween/", device: DEVICE("2") }, { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" });
  for (let i = 0; i < 4; i++) await beacon(client("7.7.7.8"), { path: `/halloween/p${i}`, device: DEVICE("2") }, { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" });
  const noJs = await beacon(client("7.7.7.9"), { path: "/halloween/" });
  const driver = await beacon(client("7.7.7.10"), { path: "/halloween/", device: DEVICE("3", { webdriver: true }) });
  const mismatch = await beacon(client("7.7.7.11"), { path: "/halloween/", device: DEVICE("4", { mobile: false }) });
  ok("robots : 204 silencieux dans tous les cas", [bot, noJs, driver, mismatch].every((r) => r.status === 204));
  const rejected = (await admin.req("/api/admin/visits?status=rejected")).body;
  const reasons = rejected.rows.map((r) => r.rejected).sort().join();
  ok("rejets enregistrés : ua_bot, no_js_signals, webdriver, ua_mismatch", rejected.total === 4 && reasons === "no_js_signals,ua_bot,ua_mismatch,webdriver", reasons);
  ok("F-17 : 5 beacons ua_bot depuis la même IP le même jour → 1 seule ligne", rejected.rows.filter((r) => r.rejected === "ua_bot" && r.ip === "7.7.7.8").length === 1);
  ok("une ligne rejetée ne garde que ip, user_agent, rejected, day", rejected.rows.every((r) => r.path === null && r.device_hash === null && r.device_info === null && r.referrer === null && r.visitor_id === null && r.ip));
  const sum4 = (await admin.req("/api/admin/visits/summary")).body;
  ok("résumé du jour cohérent : 2 visites, 1 unique, 4 robots écartés, provenance instagram, mobile", sum4.today.visits === 2 && sum4.today.unique === 1 && sum4.today.rejected === 4 && sum4.total.visits === 2 && sum4.referrers[0]?.key === "www.instagram.com" && sum4.devices.mobile === 2 && sum4.daily.length === 1 && sum4.daily[0].visits === 2, sum4);
  const counted = (await viewer.req("/api/admin/visits?status=counted")).body;
  ok("liste des visites comptées (lecture seule) : chemin sans basePath, referrer = hôte", counted.total === 2 && counted.rows.some((r) => r.path === "/" && r.referrer === "www.instagram.com") && counted.rows.some((r) => r.path === "/resultats"));
  const visitsAnon = await anon.req("/api/admin/visits");
  const summaryAnon = await anon.req("/api/admin/visits/summary");
  ok("routes admin des visites protégées (401 sans cookie)", visitsAnon.status === 401 && summaryAnon.status === 401);
  const badBeacon = await beacon(client("7.7.7.12"), { path: "x".repeat(300) });
  ok("beacon invalide (zod) → 422", badBeacon.status === 422);
  const flood = client("7.7.7.20");
  const floodRes = await Promise.all(Array.from({ length: 31 }, (_, i) => beacon(flood, { path: `/halloween/p${i}`, device: DEVICE("5") })));
  const allVisits = (await admin.req("/api/admin/visits?status=all&limit=200")).body;
  const mine = allVisits.rows.filter((r) => r.ip === "7.7.7.20");
  ok("31 beacons rapides depuis une même IP → 204 partout, au plus 30 lignes, aucune ligne « rate »", floodRes.every((r) => r.status === 204) && mine.length <= 30 && mine.length >= 1 && allVisits.rows.every((r) => r.rejected !== "rate"), mine.length);
  // ===== Correctifs de sécurité, lot 1 (AUDIT-SECURITE-2026-10-24) =================================

  // ----- F-01 / F-18 : validation sans session ni cookie ------------------------------------------
  console.log("\nValidation du vote (F-01, F-18)");
  const totalBefore = (await anon.req("/api/results")).body.total;
  const ghost = client("5.5.5.1");
  const g1 = await ghost.req(`/api/responses/${randomUUID()}/complete`, { method: "POST", body: VOTE() });
  ok("complete sans cookie, sans device, sans create → 409 already_voted_today, aucun cookie posé", g1.status === 409 && g1.body.details?.code === "already_voted_today" && !ghost.jar.has("hw_voter"));
  const trio = await Promise.all([2, 3, 4].map((i) => client(`5.5.5.${i}`).req(`/api/responses/${randomUUID()}/complete`, { method: "POST", body: VOTE() })));
  ok("trois complete avec trois uuid sans cookie → 409 ×3, 0 vote ajouté", trio.every((r) => r.status === 409) && (await anon.req("/api/results")).body.total === totalBefore);
  const owner = client("5.5.6.1");
  const ownerSession = randomUUID();
  await open(owner, ownerSession, DEVICE("7"));
  const ownerOpenedAt = Date.now();
  const thief = client("5.5.6.2");
  await open(thief, randomUUID(), DEVICE("8"));
  const t1 = await thief.req(`/api/responses/${ownerSession}/complete`, { method: "POST", body: VOTE() });
  ok("complete avec un cookie différent de celui de create → 409 (même corps que « déjà voté »)", t1.status === 409 && t1.body.details?.code === "already_voted_today");
  const t2 = await client("5.5.6.3").req(`/api/responses/${ownerSession}/complete`, { method: "POST", body: VOTE() });
  ok("complete d'une session ouverte, sans cookie → 409", t2.status === 409);
  const strayId = randomUUID();
  const stray = client("5.5.6.4");
  const u1 = await stray.req(`/api/responses/${strayId}/update`, { method: "PATCH", body: { selected_restaurant: RESTAURANT } });
  ok("auto-sauvegarde update sur un uuid inconnu → 404, aucune ligne créée", u1.status === 404 && (await admin.req(`/api/responses/${strayId}`)).status === 404);
  const u2 = await stray.req(`/api/responses/${strayId}/complete`, { method: "POST", body: VOTE() });
  ok("… et complete sur cet uuid → refusé, 0 vote ajouté", u2.status !== 200 && (await anon.req("/api/results")).body.total === totalBefore);
  const sessionOk = await client("5.5.6.5").req(`/api/responses/${randomUUID()}/complete`, { method: "POST", body: VOTE(), headers: { Cookie: `hw_voter=${randomUUID()}` } });
  ok("cookie inventé sur une session jamais ouverte → 409 (rien n'est révélé)", sessionOk.status === 409 && sessionOk.body.details?.code === "already_voted_today");

  // ----- F-02 : requêtes cross-site « simples » -----------------------------------------------------
  console.log("\nRequêtes cross-site (F-02)");
  const plain = await owner.req(`/api/responses/${ownerSession}/complete`, { method: "POST", headers: { "Content-Type": "text/plain" }, body: VOTE() });
  ok("complete avec Content-Type: text/plain → 415", plain.status === 415);
  const xsite = await owner.req(`/api/responses/${ownerSession}/complete`, { method: "POST", headers: { "Sec-Fetch-Site": "cross-site", Origin: "https://evil.example" }, body: VOTE() });
  ok("complete avec Sec-Fetch-Site: cross-site → 403", xsite.status === 403);
  const xcreate = await client("5.5.6.6").req("/api/responses/create", { method: "POST", headers: { "Content-Type": "text/plain" }, body: { session_id: randomUUID() } });
  const xvisit = await client("5.5.6.6").req("/api/visit", { method: "POST", headers: { "Sec-Fetch-Site": "cross-site" }, body: { path: "/halloween/" } });
  ok("create en text/plain → 415 ; visit cross-site → 403", xcreate.status === 415 && xvisit.status === 403);
  const beaconSave = await owner.req(`/api/responses/${ownerSession}/update`, { method: "POST", body: { comment: "via beacon" } });
  ok("auto-sauvegarde (POST sendBeacon, Blob JSON) → 200", beaconSave.status === 200);
  await sleep(Math.max(0, 6100 - (Date.now() - ownerOpenedAt))); // une vraie personne met plus de 6 s (ni way_too_fast ni too_fast)
  const h2 = await complete(owner, ownerSession, DEVICE("7"));
  ok("parcours honnête create → update → complete → 200, +1 vote", h2.status === 200 && (await anon.req("/api/results")).body.total === totalBefore + 1, h2.body);
  const setCookie = await fetch(`${BASE}/api/responses/create`, { method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": "5.5.7.1" }, body: JSON.stringify({ session_id: randomUUID() }) });
  ok("cookie hw_voter : Max-Age 60 jours, chemin /halloween (F-06 d)", setCookie.headers.getSetCookie().some((c) => c.startsWith("hw_voter=") && /Max-Age=5184000/i.test(c) && /Path=\/halloween/i.test(c)));

  // ----- F-03 : révocation des sessions admin -------------------------------------------------------
  console.log("\nSessions du backoffice (F-03)");
  const a2 = await login(ADMIN);
  const token = a2.jar.get("chamas_admin");
  ok("route admin → 200 avec le jeton", (await a2.req("/api/admin/sessions")).status === 200);
  await a2.req("/api/admin/logout", { method: "POST" });
  a2.jar.set("chamas_admin", token);
  ok("rejeu de l'ancien cookie après déconnexion → 401", (await a2.req("/api/admin/sessions")).status === 401);
  const adminPage = await a2.req("/admin");
  ok("page /admin avec le jeton révoqué → redirection vers la connexion", adminPage.status === 307);
  const v2 = await login(VIEWER);
  const v2Sid = v2.jar.get("chamas_admin").split(".")[2];
  const rvRo = await viewer.req(`/api/admin/sessions/${v2Sid}/revoke`, { method: "POST" });
  ok("révocation en lecture seule → 403", rvRo.status === 403);
  const rv = await admin.req(`/api/admin/sessions/${v2Sid}/revoke`, { method: "POST" });
  const journal3 = (await admin.req("/api/admin/sessions")).body;
  ok("révocation depuis le Journal → 200, journalisée, revoked_at posé", rv.status === 200 && journal3.actions.some((a) => a.action === "Déconnexion : session du backoffice") && typeof journal3.sessions.find((s) => s.id === v2Sid)?.revoked_at === "string");
  ok("401 pour la session visée, 200 pour les autres", (await v2.req("/api/admin/security")).status === 401 && (await viewer.req("/api/admin/security")).status === 200 && (await admin.req("/api/admin/security")).status === 200);
  ok("révoquer un inconnu → 404", (await admin.req(`/api/admin/sessions/${randomUUID()}/revoke`, { method: "POST" })).status === 404);

  // ----- F-04 : rôle lecture seule et données personnelles -------------------------------------------
  console.log("\nLecture seule (F-04)");
  ok("export participants en viewer → 403", (await viewer.req("/api/responses/export?scope=participants&format=csv")).status === 403);
  const exR = await viewer.req("/api/responses/export?scope=all&format=csv");
  const csvHeader = (body) => String(body).split("\n")[0].split(";");
  ok("export réponses en viewer sans colonnes « Adresse IP » ni « Navigateur »", exR.status === 200 && !csvHeader(exR.body).includes("Adresse IP") && !csvHeader(exR.body).includes("Navigateur") && csvHeader(exR.body).includes("Score de risque"), csvHeader(exR.body));
  const exA = await admin.req("/api/responses/export?scope=all&format=csv");
  const exPA = await admin.req("/api/responses/export?scope=participants&format=csv");
  ok("en admin inchangé : colonne « Adresse IP » et export participants avec « Email »", csvHeader(exA.body).includes("Adresse IP") && exPA.status === 200 && csvHeader(exPA.body).includes("Email"));
  const rowV = (await viewer.req(`/api/responses/${honestSession}`)).body;
  const rowA = (await admin.req(`/api/responses/${honestSession}`)).body;
  ok("GET /api/responses/[id] en viewer sans ip_address, user_agent, device_hash, device_info ; en admin inchangé", rowV.ip_address === null && rowV.user_agent === null && rowV.device_hash === null && rowV.device_info === null && rowV.completed_at && rowA.ip_address === "1.1.1.1" && /^[0-9a-f]{64}$/.test(rowA.device_hash));
  const pv = (await viewer.req("/api/admin/participants?q=elodie")).body.rows[0];
  const pa = (await admin.req("/api/admin/participants?q=elodie")).body.rows[0];
  ok("liste participants en viewer : email et téléphone masqués ; en admin en clair", pv.email === "e***@example.com" && pv.phone_number === "06 ** ** ** 78" && pa.email === "elodie@example.com" && pa.phone_number === "+33612345678");
  const lv = (await viewer.req("/api/admin/responses?status=all&risk=flagged&limit=5")).body;
  ok("liste des réponses en viewer sans IP ni empreinte", lv.rows.length > 0 && lv.rows.every((r) => r.ip_address === null && r.device_hash === null && r.user_agent === null));
  const vv = (await viewer.req(`/api/participants/${pid}/votes`)).body;
  ok("votes d'un participant en viewer sans IP", vv.votes.length === 1 && vv.votes[0].ip_address === null && typeof vv.votes[0].decoration === "string");

  // ----- F-06 : information, conservation, journal ---------------------------------------------------
  console.log("\nConfidentialité et conservation (F-06)");
  const privacy = await anon.req("/confidentialite");
  ok("page /confidentialite → 200 avec « Confidentialité », cookies et durées", privacy.status === 200 && privacy.body.includes("Confidentialité") && privacy.body.includes("hw_voter") && privacy.body.includes("30 jours"));
  ok("POST /api/admin/purge en viewer → 403, sans cookie → 401", (await viewer.req("/api/admin/purge", { method: "POST" })).status === 403 && (await anon.req("/api/admin/purge", { method: "POST" })).status === 401);
  const db = JSON.parse(readFileSync(DATA, "utf8"));
  const old = (d) => new Date(Date.now() - d * 86_400_000).toISOString();
  const oldResp = { ...db.responses.find((r) => r.completed_at), id: randomUUID(), session_id: randomUUID(), voter_id: randomUUID(), created_at: old(31), vote_day: old(31).slice(0, 10), completed_at: old(31), ip_address: "6.6.6.6", user_agent: "Old UA", device_info: { mobile: true } };
  db.responses.push(oldResp);
  db.visits.push({ id: randomUUID(), day: old(91).slice(0, 10), created_at: old(91), ip: "6.6.6.6", user_agent: "UA", path: "/", referrer: null, device_hash: null, device_info: null, visitor_id: null, rejected: null });
  const oldSid = randomUUID();
  db.admin_sessions.push({ id: oldSid, role: "viewer", ip: "6.6.6.6", user_agent: null, city: null, region: null, country: null, latitude: null, longitude: null, created_at: old(181), last_seen_at: old(181), revoked_at: null });
  db.admin_actions.push({ id: randomUUID(), session_id: oldSid, method: "POST", path: "/x", action: "Test", details: null, created_at: old(181) });
  db.login_failures = [...(db.login_failures ?? []), { id: randomUUID(), ip: "6.6.6.6", created_at: old(31) }];
  writeFileSync(DATA, JSON.stringify(db, null, 2));
  const visitsBefore = (await admin.req("/api/admin/visits?status=all&limit=200")).body.total;
  const purge = await admin.req("/api/admin/purge", { method: "POST" });
  const sess = (await admin.req("/api/admin/sessions")).body;
  ok("POST /api/admin/purge en admin → 200, journalisé « Purge : données expirées »", purge.status === 200 && sess.actions.some((a) => a.action === "Purge : données expirées"));
  const purged = (await admin.req(`/api/responses/${oldResp.id}`)).body;
  ok("réponse de 31 jours : IP, navigateur, appareil effacés ; vote, jour et empreinte conservés", purged.ip_address === null && purged.user_agent === null && purged.device_info === null && purged.completed_at && purged.vote_day && purged.device_hash);
  ok("visite de 91 jours supprimée", (await admin.req("/api/admin/visits?status=all&limit=200")).body.total === visitsBefore - 1);
  ok("session de 181 jours et son action supprimées ; échec de connexion de 31 jours supprimé", !sess.sessions.some((s) => s.id === oldSid) && !sess.actions.some((a) => a.session_id === oldSid) && !sess.failures.recent.some((f) => f.ip === "6.6.6.6"));
  ok("les lignes récentes restent (vote honnête intact)", (await admin.req(`/api/responses/${honestSession}`)).body.ip_address === "1.1.1.1");
  await admin.req(`/api/participants/${pid}`, { method: "PATCH", body: { pseudo: "Élodie Fantôme", email: "secret@example.com", phone_number: "0612345678" } });
  const logged = (await admin.req("/api/admin/sessions")).body.actions.find((a) => a.method === "PATCH" && a.path === `/api/participants/${pid}` && a.details?.email);
  ok("journal : email et téléphone masqués « *** » dans les détails (F-06 c)", logged && logged.details.email === "***" && logged.details.phone_number === "***" && logged.details.pseudo === "Élodie Fantôme");

  // ----- F-01 bis : rotation de cookie (create → complete) sans empreinte, plafond par IP ------------
  console.log("\nRotation de cookie et plafond par IP (F-01 bis)");
  const rotate = async (ip, device, sessions) => {
    const list = [];
    for (let i = 0; i < sessions; i++) {
      const c = client(ip);
      const sid = randomUUID();
      await open(c, sid, device ? device() : undefined);
      list.push({ c, sid, device });
    }
    return list;
  };
  const total0 = (await anon.req("/api/results")).body.total;
  const fast = await rotate("5.5.8.1", null, 3);
  const fastRes = [];
  for (const s of fast) fastRes.push(await s.c.req(`/api/responses/${s.sid}/complete`, { method: "POST", body: VOTE() }));
  const total1 = (await anon.req("/api/results")).body.total;
  ok("rotation de cookie sans empreinte, 3 votes rapides depuis une IP → le 3e est 409, total public +2 au plus", fastRes[2].status === 409 && fastRes[2].body.details?.code === "already_voted_today" && total1 - total0 <= 2, [fastRes.map((r) => r.status), total1 - total0]);
  const fastRow = (await admin.req(`/api/responses/${fast[2].sid}`)).body;
  ok("la ligne est bloquée avec le signal « no_device » (+45), visible dans Votes à examiner", fastRow.blocked_at && fastRow.risk_flags.includes("no_device") && fastRow.risk_score >= 80);
  const slowNoDevice = await rotate("5.5.8.2", null, 1);
  await sleep(6500);
  const snd = await slowNoDevice[0].c.req(`/api/responses/${slowNoDevice[0].sid}/complete`, { method: "POST", body: VOTE() });
  const sndRow = (await admin.req(`/api/responses/${slowNoDevice[0].sid}`)).body;
  ok("sans empreinte mais lent et IP neuve → 200 signalé (45), jamais bloqué seul", snd.status === 200 && sndRow.risk_score === 45 && sndRow.risk_flags.join() === "no_device");

  // Empreinte aléatoire sur 64 hexa : aucune collision possible avec les empreintes fixes des autres scénarios.
  const randomDevice = () => ({ ...DEVICE("0"), hash: (randomUUID() + randomUUID()).replace(/-/g, "") });
  const cap = await admin.req("/api/admin/settings", { method: "PATCH", body: { mode: "block", flag_threshold: 40, block_threshold: 80, ip_daily_max: 5 } });
  ok("PATCH /api/admin/settings ip_daily_max=5 → 200", cap.status === 200 && cap.body.settings.ip_daily_max === 5);
  ok("ip_daily_max hors bornes (1001) → 422", (await admin.req("/api/admin/settings", { method: "PATCH", body: { mode: "block", flag_threshold: 40, block_threshold: 80, ip_daily_max: 1001 } })).status === 422);
  const slow = await rotate("5.5.9.1", randomDevice, 7);
  const honestDev = client("5.5.9.9");
  const honestSid = randomUUID();
  await open(honestDev, honestSid, DEVICE("9"));
  await sleep(6500);
  const slowRes = [];
  for (const s of slow.slice(0, 6)) slowRes.push(await s.c.req(`/api/responses/${s.sid}/complete`, { method: "POST", body: { ...VOTE(), device: s.device() } }));
  ok("rotation de cookie avec empreintes aléatoires et lents : 5 votes → 200, le 6e (plafond 5 atteint) → 409", slowRes.slice(0, 5).every((r) => r.status === 200) && slowRes[5].status === 409 && slowRes[5].body.details?.code === "already_voted_today", slowRes.map((r) => r.status));
  const capRow = (await admin.req(`/api/responses/${slow[5].sid}`)).body;
  ok("ligne bloquée (blocked_at) avec le signal « ip_daily_max », 0 point de plus", capRow.blocked_at && !capRow.completed_at && capRow.risk_flags.includes("ip_daily_max") && capRow.risk_score < 80);
  const review = (await admin.req("/api/admin/responses?risk=flagged&limit=200")).body;
  ok("visible dans « Votes à examiner » (risk=flagged)", review.rows.some((r) => r.session_id === slow[5].sid));
  const hd = await honestDev.req(`/api/responses/${honestSid}/complete`, { method: "POST", body: { ...VOTE(), device: DEVICE("9") } });
  ok("parcours honnête avec empreinte, autre IP → 200, score 0", hd.status === 200 && (await admin.req(`/api/responses/${honestSid}`)).body.risk_score === 0);
  await admin.req("/api/admin/settings", { method: "PATCH", body: { mode: "observe", flag_threshold: 40, block_threshold: 80, ip_daily_max: 5 } });
  const obs = await slow[6].c.req(`/api/responses/${slow[6].sid}/complete`, { method: "POST", body: { ...VOTE(), device: slow[6].device() } });
  const obsRow = (await admin.req(`/api/responses/${slow[6].sid}`)).body;
  ok("mode observe : plafond atteint → 200, validé et marqué « ip_daily_max »", obs.status === 200 && obsRow.completed_at && !obsRow.blocked_at && obsRow.risk_flags.includes("ip_daily_max"));
  const reset = await admin.req("/api/admin/settings", { method: "PATCH", body: { mode: "block", flag_threshold: 40, block_threshold: 80, ip_daily_max: 60 } });
  ok("retour aux réglages par défaut (block, 60)", reset.status === 200 && reset.body.settings.ip_daily_max === 60);
  const secSettings = (await viewer.req("/api/admin/security")).body.settings;
  ok("réglages enregistrés sans ip_daily_max restent lisibles (défaut 60 dans /api/admin/security)", secSettings.ip_daily_max === 60);

  // ----- D-02 : IP mal formée (X-Forwarded-For: zz) → IP inconnue, plafond appliqué sous la clé partagée --
  console.log("\nIP inconnue (D-02)");
  await admin.req("/api/admin/settings", { method: "PATCH", body: { mode: "block", flag_threshold: 40, block_threshold: 80, ip_daily_max: 2 } });
  const unknownIp = await rotate("zz", randomDevice, 3);
  await sleep(6500);
  const unkRes = [];
  for (const s of unknownIp) unkRes.push(await s.c.req(`/api/responses/${s.sid}/complete`, { method: "POST", body: { ...VOTE(), device: s.device() } }));
  const unkRow = (await admin.req(`/api/responses/${unknownIp[0].sid}`)).body;
  const unkRows = await Promise.all(unknownIp.map((u) => score(u.sid)));
  ok("X-Forwarded-For: zz → ip_address null ; plafond 2 → 200, 200 puis 3e vote 409 (clé « inconnue » partagée)", unkRow.ip_address === null && unkRes[0].status === 200 && unkRes[1].status === 200 && unkRes[2].status === 409 && unkRows[2].risk_flags.includes("ip_daily_max"), unkRows.map((r, i) => [unkRes[i].status, r.risk_score, r.risk_flags]));
  const xri = await fetch(`${BASE}/api/responses/create`, { method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": "zz", "X-Real-IP": "5.5.10.1" }, body: JSON.stringify({ session_id: randomUUID() }) });
  ok("X-Forwarded-For mal formé mais X-Real-IP valide → session ouverte (201)", xri.status === 201);
  await admin.req("/api/admin/settings", { method: "PATCH", body: { mode: "block", flag_threshold: 40, block_threshold: 80, ip_daily_max: 60 } });

  // ----- F-04 compléments : top IP, visites, prénom / nom ------------------------------------------------
  console.log("\nLecture seule, compléments (F-04)");
  const secV = (await viewer.req("/api/admin/security")).body;
  const secA = (await admin.req("/api/admin/security")).body;
  ok("top 10 IP en viewer masqué x.x.x.*, en admin en clair", secV.topIps.length > 0 && secV.topIps.every((e) => /^\d+\.\d+\.\d+\.\*$/.test(e.key)) && secA.topIps.every((e) => /^\d+\.\d+\.\d+\.\d+$/.test(e.key)));
  const visV = (await viewer.req("/api/admin/visits?status=all&limit=50")).body;
  const visA = (await admin.req("/api/admin/visits?status=all&limit=50")).body;
  ok("visites en viewer sans IP, UA, empreinte ni appareil ; en admin inchangé", visV.rows.length > 0 && visV.rows.every((v) => v.ip === null && v.user_agent === null && v.device_hash === null && v.device_info === null) && visA.rows.some((v) => v.ip && v.user_agent));
  const y = iphone("2.2.9.8");
  const ys = (await vote(y, IPHONE("participant-y"))).sid;
  const marc = await y.req(`/api/responses/${ys}/raffle`, { method: "POST", body: { wants_raffle: true, pseudo: "Marc Zombie", first_name: "Marc", last_name: "Zombie", phone_number: "06 98 76 54 32", email: "marc@example.com" } });
  assert.equal(marc.status, 200, "inscription de Marc");
  const marcV = (await viewer.req("/api/admin/participants?q=marc")).body.rows[0];
  const marcA = (await admin.req("/api/admin/participants?q=marc")).body.rows[0];
  ok("prénom / nom en viewer masqués (M***, Z***), en admin en clair", marcV.first_name === "M***" && marcV.last_name === "Z***" && marcA.first_name === "Marc" && marcA.last_name === "Zombie");

  // ----- Lot 2 : en-têtes, journal, messages fixes, cookie, redirections, cache --------------------------
  console.log("\nLot 2 (F-07, F-10, F-16, F-19, F-20, F-21)");
  const ORIGIN = BASE.replace(/\/halloween$/, "");
  const head = async (p) => (await fetch(`${BASE}${p}`, { redirect: "manual" })).headers;
  const secHeads = await Promise.all(["", "/admin/login", "/api/results"].map(head)); // "" = /halloween (avec « / » final, Next répond 308)
  ok("F-07 : CSP Report-Only, HSTS et COOP présents sur /, /admin/login et /api/results", secHeads.every((h) => h.get("content-security-policy-report-only")?.startsWith("default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'") && h.get("content-security-policy-report-only")?.includes("frame-ancestors 'none'") && h.get("strict-transport-security") === "max-age=63072000; includeSubDomains" && h.get("cross-origin-opener-policy") === "same-origin" && !h.get("cross-origin-embedder-policy") && !h.get("content-security-policy")));
  const geoLogin = client("9.9.9.10");
  const geoRes = await geoLogin.req("/api/admin/login", { method: "POST", body: { password: VIEWER }, headers: { "x-vercel-ip-city": "%", "x-vercel-ip-country": "FR" } });
  const geoSid = geoLogin.jar.get("chamas_admin")?.split(".")[2];
  const geoSession = (await admin.req("/api/admin/sessions")).body.sessions.find((s) => s.id === geoSid);
  ok("F-10 : x-vercel-ip-city: % → connexion 200 et session présente dans le journal (ville brute)", geoRes.status === 200 && geoSession && geoSession.city === "%" && geoSession.country === "FR");
  const loginRaw = await fetch(`${BASE}/api/admin/login`, { method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": "9.9.9.11" }, body: JSON.stringify({ password: VIEWER }) });
  const adminCookie = loginRaw.headers.getSetCookie().find((c) => c.startsWith("chamas_admin="));
  const adminPageOk = await fetch(`${BASE}/admin`, { headers: { Cookie: adminCookie.split(";")[0] }, redirect: "manual" });
  ok("F-20 : /halloween/admin reçoit le cookie (page servie, pas de redirection vers la connexion)", adminPageOk.status === 200);
  const logoutRaw = await fetch(`${BASE}/api/admin/logout`, { method: "POST", headers: { Cookie: adminCookie.split(";")[0] } });
  ok("F-20 : Set-Cookie chamas_admin avec Path=/halloween, HttpOnly, SameSite=Strict ; logout efface avec le même Path", /Path=\/halloween/i.test(adminCookie) && /HttpOnly/i.test(adminCookie) && /SameSite=Strict/i.test(adminCookie) && logoutRaw.headers.getSetCookie().some((c) => c.startsWith("chamas_admin=;") && /Path=\/halloween/i.test(c) && /Max-Age=0/i.test(c)));
  const resto = { name: "chamas tacos - test lot 2", city: "Lille" };
  const r1 = await admin.req("/api/restaurants", { method: "POST", body: resto });
  const r2 = await admin.req("/api/restaurants", { method: "POST", body: resto });
  ok("F-19 : restaurant en double → 409 avec le message fixe", r1.status === 201 && r2.status === 409 && r2.body.error === "Ce restaurant existe déjà" && !/duplicate|constraint/i.test(JSON.stringify(r2.body)), r2.body);
  await admin.req(`/api/restaurants/${r1.body.id}`, { method: "DELETE" });
  const ghostFile = await admin.req("/api/decorations", { method: "POST", body: { restaurant_name: RESTAURANT, image_url: `http://localhost:3200/uploads/${randomUUID()}.jpg` } });
  const ghostFile2 = await admin.req("/api/decorations", { method: "POST", body: { restaurant_name: RESTAURANT, image_url: `/uploads/${randomUUID()}.jpg` } });
  ok("F-16 : décoration par URL hors stockage → 400 « Fichier inconnu » ; chemin relatif → 422 (pas une URL)", ghostFile.status === 400 && ghostFile.body.error === "Fichier inconnu" && ghostFile2.status === 422, [ghostFile.body, ghostFile2.status]);
  const wk = await fetch(`${ORIGIN}/.well-known/security.txt`, { redirect: "manual" });
  const st = await fetch(`${ORIGIN}/security.txt`, { redirect: "manual" });
  const legacy = await fetch(`${ORIGIN}/resultats`, { redirect: "manual" });
  ok("F-21 : /.well-known/* et /security.txt ne sont plus redirigés (404) ; /resultats → 307 vers /halloween/resultats", wk.status === 404 && st.status === 404 && legacy.status === 307 && /\/halloween\/resultats$/.test(legacy.headers.get("location") ?? ""));
  const decoHead = await head("/api/decorations");
  const resultsHead = await head("/api/results");
  ok("F-21 : réponses JSON en no-store par défaut, /api/results garde son cache public", decoHead.get("cache-control") === "no-store" && /public, s-maxage=15/.test(resultsHead.get("cache-control") ?? ""));
  const wDev = (await admin.req(`/api/responses/${wipedSession}`)).body.device_info;
  ok("F-21 : device_info sans localVoteDay ni startedAt (attributs grossiers seulement)", wDev && wDev.platform === "iPhone" && wDev.localVoteDay === undefined && wDev.startedAt === undefined);

  // ----- F-05 : verrouillage persistant de la connexion (en dernier : bloque toute connexion 15 min) ---
  console.log("\nConnexion admin (F-05)");
  // Les échecs de double validation (scénario 28) comptent dans le verrou global (30 en 15 min) : remis à
  // zéro dans le fichier de test pour que ce scénario parte de zéro.
  const dataNow = JSON.parse(readFileSync(DATA, "utf8"));
  dataNow.login_failures = [];
  writeFileSync(DATA, JSON.stringify(dataNow, null, 2));
  const octet = () => 20 + Math.floor(Math.random() * 200);
  const ips = [1, 2, 3].map(() => `6.${octet()}.${octet()}.${octet()}`);
  for (const ip of ips) {
    for (let i = 0; i < 10; i++) {
      const f = await client(ip).req("/api/admin/login", { method: "POST", body: { password: "mauvais-mot-de-passe" } });
      assert.equal(f.status, 401, `échec ${i + 1} depuis ${ip}`);
    }
  }
  const locked = await client(ips[0]).req("/api/admin/login", { method: "POST", body: { password: ADMIN } });
  ok("10 échecs depuis une IP → 11e tentative 429 même avec le bon mot de passe", locked.status === 429);
  const freshIp = await client(`6.${octet()}.${octet()}.${octet()}`).req("/api/admin/login", { method: "POST", body: { password: ADMIN } });
  ok("30 échecs toutes IP → 429 pour une IP neuve avec le bon mot de passe (compte en base, pas en mémoire)", freshIp.status === 429);
  const failures = (await admin.req("/api/admin/sessions")).body.failures;
  ok("journal : compteur 24 h ≥ 30, 20 derniers échecs avec IP et date", failures.last24h >= 30 && failures.recent.length === 20 && failures.recent.every((f) => ips.includes(f.ip) && typeof f.created_at === "string"));
}

main().catch((e) => {
  console.error(`\n✘ ${e.message}`);
  process.exit(1);
});
