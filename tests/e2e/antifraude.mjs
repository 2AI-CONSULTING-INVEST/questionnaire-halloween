/**
 * Scénarios de bout en bout de l'anti-fraude, des votes inachevés, de la pagination, des participants
 * supprimés, des agrégats des graphiques, du compteur de visites et des correctifs de sécurité du lot 1
 * (F-01/F-18, F-02, F-03, F-04, F-05, F-06 de AUDIT-SECURITE-2026-10-24.md), contre un
 * serveur local en stockage JSON (jamais la base de production) :
 *
 *   NEXT_PUBLIC_SUPABASE_URL= SUPABASE_SERVICE_ROLE_KEY= ADMIN_PASSWORD=test-admin-9c2e-0123 \
 *   ADMIN_READONLY_PASSWORD=test-viewer-4b7a ADMIN_SESSION_SECRET=<32+ caractères> \
 *   node node_modules/next/dist/bin/next start -p 3200
 *   node tests/e2e/antifraude.mjs            (HW_BASE, ADMIN_PASSWORD, ADMIN_READONLY_PASSWORD surchargeables)
 *
 * Le fichier .data/db.json est sauvegardé, remplacé par un jeu de données vide, puis restauré.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

const BASE = process.env.HW_BASE ?? "http://localhost:3200/halloween";
const ADMIN = process.env.ADMIN_PASSWORD ?? "test-admin-9c2e-0123"; // 16 caractères minimum (next start = production)
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
    login_failures: [],
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
  const z5 = client("3.3.3.4"); // même appareil, autre connexion
  const zs5 = randomUUID();
  await open(z5, zs5, DEVICE("d"));
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
  // D-01 : un refus par score est définitif pour la journée, même en rejouant sans les signaux (ici sans localVoteDay : score < 80 sinon).
  const replayBefore = (await anon.req("/api/results")).body.total;
  const replay = await complete(wiped, wipedSession, DEVICE("a"));
  const wRow2 = await score(wipedSession);
  ok("D-01 : rejeu de complete sur la ligne refusée, même cookie, signaux allégés → 409, toujours sans completed_at, score inchangé, total public inchangé", replay.status === 409 && replay.body.details?.code === "already_voted_today" && !wRow2.completed_at && wRow2.blocked_at === wRow.blocked_at && wRow2.risk_score === wRow.risk_score && (await anon.req("/api/results")).body.total === replayBefore, [replay.status, wRow2.risk_score]);
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
  ok("F-14 : 3e vote même appareil, même IP, lent → 409 bloqué, score ≥ 80 (seule exception sans signal propre à la requête)", z3.status === 409 && s3.blocked_at && s3.risk_score >= 80 && s3.risk_flags.includes("device_voted_twice") && s3.risk_flags.includes("device_same_ip"), s3.risk_score);
  const r5 = await complete(z5, zs5, DEVICE("d"));
  const s5 = await score(zs5);
  ok("F-14 : 3e vote même appareil, IP différente, lent → 200 signalé, plafonné à 79", r5.status === 200 && s5.completed_at && !s5.blocked_at && s5.risk_score === 79 && !s5.risk_flags.includes("device_same_ip"), s5.risk_score);
  const z4 = client("3.3.3.3");
  const zs4 = randomUUID();
  await open(z4, zs4, DEVICE("d"));
  const r4 = await complete(z4, zs4, DEVICE("d"));
  const s4 = await score(zs4);
  ok("4e vote même appareil, validé aussitôt (signal propre à la requête) → 409, bloqué, score ≥ 80", r4.status === 409 && s4.blocked_at && s4.risk_score >= 80 && s4.risk_flags.includes("way_too_fast"), s4.risk_score);

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
  ok("GET /api/admin/security (lecture seule) : réglages, KPI du jour et totaux, top IP masqué x.x.x.*", sec.status === 200 && sec.body.settings.mode === "observe" && sec.body.today.blocked >= 2 && sec.body.total.validated >= 4 && sec.body.topIps.some((e) => e.key === "3.3.3.*" && e.votes === 2)); // IP masquée en lecture seule (F-04)
  const secAnon = await anon.req("/api/admin/security");
  ok("GET /api/admin/security sans cookie → 401", secAnon.status === 401);

  const o1 = await complete(o[0], os[0], DEVICE("e"));
  const o2 = await complete(o[1], os[1], DEVICE("e"));
  const o3 = await complete(o[2], os[2], DEVICE("e"));
  const so3 = await score(os[2]);
  ok("mode observe : même scénario, 3e vote → 200, signalé (score ≥ seuil de signalement), jamais bloqué", o1.status === 200 && o2.status === 200 && o3.status === 200 && so3.completed_at && !so3.blocked_at && so3.risk_score >= 80, so3.risk_score);
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
  ok("tableau de bord : total votes = résultats publics, inachevés = 230", summary.kpis.totalVotes === after && summary.kpis.incomplete === N && summary.kpis.blocked === 3);
  await admin.req(`/api/responses/${hRow.id}`, { method: "PATCH", body: { excluded: false } });
  ok("réintégration → total rétabli", (await anon.req("/api/results")).body.total === before);
  const excluded = await admin.req("/api/admin/responses?status=excluded");
  ok("filtre « exclus » vide après réintégration", excluded.body.total === 0);

  // ----- Participants : recherche et tri côté serveur --------------------------------------------
  console.log("\nParticipants");
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
  const csvDel = await admin.req("/api/responses/export?scope=participants&deleted=1&format=csv");
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
