/**
 * Scénarios de bout en bout de l'anti-fraude, des votes inachevés, de la pagination, des participants
 * supprimés, des agrégats des graphiques et du compteur de visites, contre un
 * serveur local en stockage JSON (jamais la base de production) :
 *
 *   NEXT_PUBLIC_SUPABASE_URL= SUPABASE_SERVICE_ROLE_KEY= ADMIN_PASSWORD=test-admin-9c2e \
 *   ADMIN_READONLY_PASSWORD=test-viewer-4b7a ADMIN_SESSION_SECRET=<32+ caractères> \
 *   node node_modules/next/dist/bin/next start -p 3200
 *   node tests/e2e/antifraude.mjs            (HW_BASE, ADMIN_PASSWORD, ADMIN_READONLY_PASSWORD surchargeables)
 *
 * Le fichier .data/db.json est sauvegardé, remplacé par un jeu de données vide, puis restauré.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

const BASE = process.env.HW_BASE ?? "http://localhost:3200/halloween";
const ADMIN = process.env.ADMIN_PASSWORD ?? "test-admin-9c2e";
const VIEWER = process.env.ADMIN_READONLY_PASSWORD ?? "test-viewer-4b7a";
const DATA = path.join(process.cwd(), ".data", "db.json");
const BACKUP = `${DATA}.e2e-backup`;

const RESTAURANT = "CHAMAS TACOS - LILLE FIVES";
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
  };
}

/** Client HTTP avec son pot à cookies et son adresse IP (X-Forwarded-For). */
function client(ip) {
  const jar = new Map();
  return {
    ip,
    jar,
    async req(p, init = {}) {
      const headers = { "X-Forwarded-For": ip, "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148 Safari/604.1", ...(init.headers ?? {}) };
      if (jar.size) headers.Cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
      if (init.body !== undefined) headers["Content-Type"] = "application/json";
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
  assert.ok(cond, `${label}${detail ? ` — ${JSON.stringify(detail)}` : ""}`);
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

  // ----- Scénarios de vote : sessions ouvertes d'abord, validées 6 s plus tard (signal de rapidité) ---
  console.log("\nAnti-fraude");
  const honest = client("1.1.1.1");
  const honestSession = randomUUID();
  const wiped = client("1.1.1.1"); // même appareil, cookies effacés, stockage local conservé
  const wipedSession = randomUUID();
  const x = client("2.2.2.2");
  const y = client("2.2.2.2");
  const [xs, ys] = [randomUUID(), randomUUID()];
  const z = [client("3.3.3.3"), client("3.3.3.3"), client("3.3.3.3")];
  const zs = z.map(() => randomUUID());
  const o = [client("4.4.4.4"), client("4.4.4.4"), client("4.4.4.4")];
  const os = o.map(() => randomUUID());

  const open = async (c, id, device) => {
    const r = await c.req("/api/responses/create", { method: "POST", body: { session_id: id, device } });
    assert.equal(r.status, 201, "ouverture de session");
  };
  await open(honest, honestSession, DEVICE("a"));
  await open(wiped, wipedSession, DEVICE("a"));
  await open(x, xs, DEVICE("b"));
  await open(y, ys, DEVICE("c"));
  for (let i = 0; i < 3; i++) await open(z[i], zs[i], DEVICE("d"));
  for (let i = 0; i < 3; i++) await open(o[i], os[i], DEVICE("e"));
  ok("cookie hw_voter posé à l'ouverture", honest.jar.has("hw_voter"));

  const malformed = await honest.req(`/api/responses/${honestSession}/complete`, { method: "POST", body: { ...VOTE(), device: { hash: "zz", foo: 1 } } });
  ok("signaux d'appareil invalides (zod strict) → 422", malformed.status === 422);

  console.log("  … attente 6,5 s (durée d'ouverture → validation)");
  await sleep(6500);
  const complete = (c, id, device, deco) => c.req(`/api/responses/${id}/complete`, { method: "POST", body: { ...VOTE(deco), device } });
  const score = async (sessionId) => (await admin.req(`/api/responses/${sessionId}`)).body;

  const h = await complete(honest, honestSession, DEVICE("a"));
  ok("vote honnête → 200", h.status === 200 && h.body.voteDay === today, h.body);
  const hRow = await score(honestSession);
  ok("vote honnête : score 0, aucun signal", hRow.risk_score === 0 && hRow.completed_at && !hRow.blocked_at);

  const again = await honest.req("/api/responses/create", { method: "POST", body: { session_id: randomUUID(), device: DEVICE("a") } });
  ok("même cookie, même jour : nouvelle session refusée (409 already_voted_today)", again.status === 409 && again.body.details?.code === "already_voted_today");
  const again2 = await complete(honest, randomUUID(), DEVICE("a"));
  ok("même cookie, même jour : validation refusée (409)", again2.status === 409 && again2.body.details?.code === "already_voted_today");

  const w = await complete(wiped, wipedSession, DEVICE("a", { localVoteDay: today }));
  ok("cookies effacés + stockage local « voté aujourd'hui » + même empreinte → 409 identique à « déjà voté »", w.status === 409 && w.body.details?.code === "already_voted_today" && typeof w.body.details.nextResetAt === "string");
  const wRow = await score(wipedSession);
  ok("la ligne est bloquée (blocked_at), sans completed_at, score ≥ 80", wRow.blocked_at && !wRow.completed_at && wRow.risk_score >= 80 && wRow.risk_flags.includes("local_vote_day"), wRow);
  const flagged = await admin.req("/api/admin/responses?risk=flagged");
  ok("visible dans /api/admin/responses?risk=flagged", flagged.body.rows.some((r) => r.session_id === wipedSession && r.blocked_at));
  ok("l'empreinte stockée est un HMAC (64 hexa), différent du condensé client", /^[0-9a-f]{64}$/.test(wRow.device_hash) && wRow.device_hash !== DEVICE("a").hash && wRow.device_info?.platform === "iPhone");

  const [rx, ry] = [await complete(x, xs, DEVICE("b")), await complete(y, ys, DEVICE("c"))];
  const [sx, sy] = [await score(xs), await score(ys)];
  ok("deux empreintes différentes, même IP → 200 et 200, score ≤ 10", rx.status === 200 && ry.status === 200 && sx.risk_score <= 10 && sy.risk_score <= 10, [sx.risk_score, sy.risk_score]);

  const z1 = await complete(z[0], zs[0], DEVICE("d"));
  const z2 = await complete(z[1], zs[1], DEVICE("d"));
  const s2 = await score(zs[1]);
  ok("même empreinte, même IP, cookie neuf : 2e vote → 200 signalé (40 ≤ score < 80)", z1.status === 200 && z2.status === 200 && s2.risk_score >= 40 && s2.risk_score < 80, s2.risk_score);
  const z3 = await complete(z[2], zs[2], DEVICE("d"));
  const s3 = await score(zs[2]);
  ok("3e vote → 409, bloqué, score ≥ 80", z3.status === 409 && s3.blocked_at && s3.risk_score >= 80, s3.risk_score);

  // ----- Réglages : droits, journal, mode observation -------------------------------------------
  console.log("\nRéglages");
  const observe = { mode: "observe", flag_threshold: 40, block_threshold: 80 };
  const noAuth = await anon.req("/api/admin/settings", { method: "PATCH", body: observe });
  ok("PATCH /api/admin/settings sans cookie → 401", noAuth.status === 401);
  const ro = await viewer.req("/api/admin/settings", { method: "PATCH", body: observe });
  ok("PATCH /api/admin/settings en lecture seule → 403", ro.status === 403);
  const invalid = await admin.req("/api/admin/settings", { method: "PATCH", body: { mode: "block", flag_threshold: 90, block_threshold: 80 } });
  ok("seuils incohérents (flag ≥ block) → 422", invalid.status === 422);
  const saved = await admin.req("/api/admin/settings", { method: "PATCH", body: observe });
  ok("PATCH /api/admin/settings admin → 200", saved.status === 200 && saved.body.settings.mode === "observe");
  const journal = await admin.req("/api/admin/sessions");
  ok("modification journalisée dans /api/admin/sessions", journal.body.actions.some((a) => a.path === "/api/admin/settings" && a.method === "PATCH" && a.details?.mode === "observe"));
  const sec = await viewer.req("/api/admin/security");
  ok("GET /api/admin/security (lecture seule) : réglages, KPI du jour et totaux, top IP", sec.status === 200 && sec.body.settings.mode === "observe" && sec.body.today.blocked >= 2 && sec.body.total.validated >= 4 && sec.body.topIps.some((e) => e.key === "3.3.3.3" && e.votes === 2));
  const secAnon = await anon.req("/api/admin/security");
  ok("GET /api/admin/security sans cookie → 401", secAnon.status === 401);

  const o1 = await complete(o[0], os[0], DEVICE("e"));
  const o2 = await complete(o[1], os[1], DEVICE("e"));
  const o3 = await complete(o[2], os[2], DEVICE("e"));
  const so3 = await score(os[2]);
  ok("mode observe : même scénario, 3e vote → 200, signalé (score ≥ 80), jamais bloqué", o1.status === 200 && o2.status === 200 && o3.status === 200 && so3.completed_at && !so3.blocked_at && so3.risk_score >= 80, so3.risk_score);
  const back = await admin.req("/api/admin/settings", { method: "PATCH", body: { mode: "block", flag_threshold: 40, block_threshold: 80 } });
  ok("retour en mode block", back.status === 200);

  // ----- Exclusion manuelle : /api/results décrémente, réintégration -----------------------------
  console.log("\nExclusion");
  const before = (await anon.req("/api/results")).body.total;
  const exc = await admin.req(`/api/responses/${hRow.id}`, { method: "PATCH", body: { excluded: true } });
  const after = (await anon.req("/api/results")).body.total;
  ok("exclusion → /api/results décrémente", exc.status === 200 && after === before - 1, { before, after });
  const excRo = await viewer.req(`/api/responses/${hRow.id}`, { method: "PATCH", body: { excluded: false } });
  ok("exclusion refusée en lecture seule (403)", excRo.status === 403);
  const summary = (await admin.req("/api/analytics/summary")).body;
  ok("tableau de bord : total votes = résultats publics, inachevés = 230", summary.kpis.totalVotes === after && summary.kpis.incomplete === N && summary.kpis.blocked === 2);
  await admin.req(`/api/responses/${hRow.id}`, { method: "PATCH", body: { excluded: false } });
  ok("réintégration → total rétabli", (await anon.req("/api/results")).body.total === before);
  const excluded = await admin.req("/api/admin/responses?status=excluded");
  ok("filtre « exclus » vide après réintégration", excluded.body.total === 0);

  // ----- Participants : recherche et tri côté serveur --------------------------------------------
  console.log("\nParticipants");
  const raffle = await honest.req(`/api/responses/${honestSession}/raffle`, { method: "POST", body: { wants_raffle: true, pseudo: "Élodie Fantôme", phone_number: "06 12 34 56 78", email: "elodie@example.com" } });
  ok("inscription au tirage", raffle.status === 200, raffle.body);
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
  ok("liste légère { id, pseudo }", Array.isArray(light.body) && light.body.length === 1 && Object.keys(light.body[0]).sort().join() === "id,pseudo");
  const csv = await viewer.req("/api/responses/export?scope=all&format=csv&status=completed");
  ok("export CSV : colonnes anti-fraude, filtre du statut", csv.status === 200 && csv.body.includes("Score de risque") && csv.body.includes("Exclu") && !csv.body.includes("Incomplet"));

  // ----- Participants supprimés : suppression douce, réinscription, restauration -------------------
  console.log("\nParticipants supprimés");
  const del = await admin.req(`/api/participants/${pid}`, { method: "DELETE" });
  ok("suppression douce → 200", del.status === 200);
  const activeList = await admin.req("/api/admin/participants?q=elodie");
  ok("absent de la liste active", activeList.body.total === 0 && activeList.body.rows.length === 0);
  const lightAfter = await admin.req("/api/admin/participants?light=1");
  ok("absent de la liste légère", lightAfter.body.length === 0);
  const publicPage = await anon.req("/participants");
  ok("absent de la page publique (/participants rend 200 sans le pseudo)", publicPage.status === 200 && typeof publicPage.body === "string" && !publicPage.body.includes("Élodie Fantôme"));
  const deletedList = await admin.req("/api/admin/participants?deleted=1");
  ok("présent dans ?deleted=1 avec deleted_at", deletedList.body.total === 1 && deletedList.body.rows[0].id === pid && typeof deletedList.body.rows[0].deleted_at === "string");
  const votesAfter = await viewer.req(`/api/participants/${pid}/votes`);
  ok("ses votes restent consultables (participant_id conservé)", votesAfter.body.votes.length === 1 && votesAfter.body.votes[0].participant_id === pid);
  const summaryDel = (await admin.req("/api/analytics/summary")).body;
  ok("KPI participants du tableau de bord : 0 (supprimé exclu)", summaryDel.kpis.raffleParticipants === 0);
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
  const csvDel = await viewer.req("/api/responses/export?scope=participants&deleted=1&format=csv");
  ok("export des supprimés à part, colonne « Supprimé le »", csvDel.status === 200 && csvDel.body.includes("Supprimé le") && csvDel.body.includes("Élodie Bis") && !csvDel.body.includes("Élodie Fantôme"));

  // ----- Graphiques en grand : agrégats du résumé, rien de nouveau en public -------------------------
  console.log("\nGraphiques");
  const full = (await viewer.req("/api/analytics/summary")).body;
  ok("summary : byDecorationDaily, favoriteVsVote, byHour (24), dailyTable", Array.isArray(full.byDecorationDaily) && Array.isArray(full.favoriteVsVote) && full.byHour.length === 24 && Array.isArray(full.dailyTable) && full.dailyTable.length >= 1);
  ok("summary : votes du jour par restaurant et par heure cohérents avec le total", full.byDecorationDaily.reduce((a, d) => a + Object.values(d.votes).reduce((x, y) => x + y, 0), 0) === full.kpis.totalVotes && full.byHour.reduce((a, h) => a + h.votes, 0) === full.kpis.totalVotes);
  ok("summary : byDecoration porte commentaires et inscrits au tirage", typeof full.byDecoration[0].comments === "number" && full.byDecoration.reduce((a, d) => a + d.raffle, 0) === 1);
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
  const noJs = await beacon(client("7.7.7.9"), { path: "/halloween/" });
  const driver = await beacon(client("7.7.7.10"), { path: "/halloween/", device: DEVICE("3", { webdriver: true }) });
  const mismatch = await beacon(client("7.7.7.11"), { path: "/halloween/", device: DEVICE("4", { mobile: false }) });
  ok("robots : 204 silencieux dans tous les cas", [bot, noJs, driver, mismatch].every((r) => r.status === 204));
  const rejected = (await admin.req("/api/admin/visits?status=rejected")).body;
  const reasons = rejected.rows.map((r) => r.rejected).sort().join();
  ok("rejets enregistrés : ua_bot, no_js_signals, webdriver, ua_mismatch", rejected.total === 4 && reasons === "no_js_signals,ua_bot,ua_mismatch,webdriver", reasons);
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
}

main().catch((e) => {
  console.error(`\n✘ ${e.message}`);
  process.exit(1);
});
