import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildGroups, canonicalEmail, graphChanges, linkAttempts, personClusters, withdrawalsAllowed, withoutWithdrawals, type GraphAttempt } from "../../src/lib/fraud-graph";
import { fraudPersons, pendingAttempts, type ReviewAttempt } from "../../src/lib/fraud-review";
import { decide } from "../../src/lib/fraud-rules";
import { DEFAULT_RISK_SETTINGS } from "../../src/lib/risk";
import { provesFraud, type ResponseRow } from "../../src/lib/schema";

const DAY = "2026-10-27";
const T0 = Date.parse("2026-10-27T12:00:00Z");
const OPTS = { c2MinAttempts: 3, positionMinutes: 10 };
let n = 0;
const a = (over: Partial<GraphAttempt> = {}): GraphAttempt => {
  n += 1;
  return {
    id: `id-${String(n).padStart(3, "0")}`,
    atMs: T0 + n * 60_000,
    status: "counted",
    voterId: `voter-${n}`,
    hwKey: null,
    entropy: null,
    storageKey: null,
    seenStorage: [],
    ipNet: `10.0.0.${n}`,
    ipClass: "normal",
    city: null,
    decorationId: "deco-1",
    privateMode: null,
    participantId: null,
    phone: null,
    email: null,
    humanDecision: null,
    autoExcluded: false,
    groupId: null,
    ...over,
  };
};
const kinds = (list: GraphAttempt[]) => linkAttempts(list, OPTS).map((l) => l.kind);

describe("liens", () => {
  it("stockage : l'une porte le jeton de l'autre", () => {
    assert.deepEqual(kinds([a({ storageKey: "s1" }), a({ seenStorage: ["s1"] })]), ["storage"]);
  });
  it("participant : même participant, même téléphone, même email, même email canonique", () => {
    assert.deepEqual(kinds([a({ participantId: "p1" }), a({ participantId: "p1" })]), ["participant"]);
    assert.deepEqual(kinds([a({ phone: "+33612345678" }), a({ phone: "+33612345678" })]), ["participant"]);
    assert.deepEqual(kinds([a({ email: "jean.dupont+1@gmail.com" }), a({ email: "jeandupont@googlemail.com" })]), ["participant"]);
  });
  it("clé forte quel que soit le réseau ; clé faible avec même réseau, ou deux IP anonymes ; position seulement suspecte", () => {
    assert.deepEqual(kinds([a({ hwKey: "k", entropy: "strong" }), a({ hwKey: "k", entropy: "strong" })]), ["strong"]);
    assert.deepEqual(kinds([a({ hwKey: "w", entropy: "weak", ipNet: "1.1.1.1" }), a({ hwKey: "w", entropy: "weak", ipNet: "1.1.1.1" })]), ["weak_network"]);
    assert.deepEqual(kinds([a({ hwKey: "w", entropy: "weak", ipClass: "tor" }), a({ hwKey: "w", entropy: "weak", ipClass: "hosting" })]), ["weak_anonymous"]);
    assert.deepEqual(kinds([a({ hwKey: "w", entropy: "weak", city: "Lille" }), a({ hwKey: "w", entropy: "weak", city: "Lille" })]), ["weak_position"]);
  });
  it("clé faible seule, sans réseau ni anonymat ni position communs : jamais de lien", () => {
    const iphones = [1, 2, 3, 4].map(() => a({ hwKey: "w", entropy: "weak" }));
    assert.deepEqual(kinds(iphones), []);
    assert.equal(buildGroups(DAY, iphones, OPTS).length, 0);
  });
  it("clé brouillée : jamais de lien", () => {
    assert.deepEqual(kinds([a({ hwKey: "z", entropy: "noisy" }), a({ hwKey: "z", entropy: "noisy" })]), []);
  });
  it("email canonique : minuscules, partie après « + » retirée, points retirés pour Gmail seulement", () => {
    assert.equal(canonicalEmail("Jean.Dupont+promo@GMAIL.com"), "jeandupont@gmail.com");
    assert.equal(canonicalEmail("jean.dupont@googlemail.com"), "jeandupont@gmail.com");
    assert.equal(canonicalEmail("jean.dupont+x@orange.fr"), "jean.dupont@orange.fr");
  });
});

describe("groupes et décisions", () => {
  it("C2 : 3 tentatives d'une clé forte → confirmé ; la plus ancienne garde son statut, les autres sont exclues", () => {
    const list = [a({ hwKey: "k", entropy: "strong" }), a({ hwKey: "k", entropy: "strong" }), a({ hwKey: "k", entropy: "strong" })];
    const [g] = buildGroups(DAY, list, OPTS);
    assert.deepEqual([g.status, g.conditions, g.kept, g.exclude], ["confirmed", ["C2"], list[0].id, [list[1].id, list[2].id]]);
  });
  it("2 tentatives d'une clé forte, réseau normal : suspect, rien n'est exclu", () => {
    const [g] = buildGroups(DAY, [a({ hwKey: "k", entropy: "strong" }), a({ hwKey: "k", entropy: "strong" })], OPTS);
    assert.deepEqual([g.status, g.exclude], ["suspect", []]);
  });
  it("C1 : un lien participant suffit à confirmer (même personne depuis deux appareils)", () => {
    const [g] = buildGroups(DAY, [a({ participantId: "p1" }), a({ participantId: "p1" })], OPTS);
    assert.deepEqual([g.status, g.conditions], ["confirmed", ["C1"]]);
  });
  it("C3 : 2 tentatives Tor ou hébergeur reliées par la clé forte", () => {
    const [g] = buildGroups(DAY, [a({ hwKey: "k", entropy: "strong", ipClass: "tor" }), a({ hwKey: "k", entropy: "strong", ipClass: "hosting" })], OPTS);
    assert.ok(g.conditions.includes("C3"));
  });
  it("C4 : navigation privée sur 2 tentatives, groupe de 3 (clé faible, même réseau)", () => {
    const list = [1, 2, 3].map((i) => a({ hwKey: "w", entropy: "weak", ipNet: "9.9.9.9", privateMode: i < 3 }));
    assert.ok(buildGroups(DAY, list, OPTS)[0].conditions.includes("C4"));
  });
  it("le lien de position ne confirme jamais, même avec deux IP d'hébergeur", () => {
    const [g] = buildGroups(DAY, [a({ hwKey: "w", entropy: "weak", city: "Lille", ipClass: "normal" }), a({ hwKey: "w", entropy: "weak", city: "Lille", ipClass: "normal" })], OPTS);
    assert.deepEqual([g.status, g.exclude], ["suspect", []]);
  });
  it("union-find : A-B par stockage, B-C par clé forte → un seul groupe", () => {
    const x = a({ storageKey: "s" });
    const y = a({ seenStorage: ["s"], hwKey: "k", entropy: "strong" });
    const z = a({ hwKey: "k", entropy: "strong" });
    const groups = buildGroups(DAY, [x, y, z], OPTS);
    assert.equal(groups.length, 1);
    assert.deepEqual(groups[0].members, [x.id, y.id, z.id]);
  });
  it("décisions humaines prioritaires : un vote validé à la main n'est jamais exclu ; le moteur ne réintègre jamais", () => {
    const list = [a({ hwKey: "k", entropy: "strong" }), a({ hwKey: "k", entropy: "strong", humanDecision: "validated" }), a({ hwKey: "k", entropy: "strong" })];
    const groups = buildGroups(DAY, list, OPTS);
    assert.deepEqual(groups[0].exclude, [list[2].id]);
    const changes = graphChanges(list, groups);
    assert.ok(!changes.some((c) => c.id === list[1].id), "la ligne décidée n'est pas réécrite");
    const already = list.map((x, i) => (i === 2 ? { ...x, status: "excluded" as const, autoExcluded: true, groupId: groups[0].id } : x));
    assert.ok(!graphChanges(already, buildGroups(DAY, already, OPTS)).some((c) => c.exclude), "rien à refaire");
  });
  it("les tentatives bloquées comptent pour relier et confirmer, mais ne sont ni gardées ni exclues", () => {
    const list = [a({ hwKey: "k", entropy: "strong", status: "blocked" }), a({ hwKey: "k", entropy: "strong" }), a({ hwKey: "k", entropy: "strong" })];
    const [g] = buildGroups(DAY, list, OPTS);
    assert.deepEqual([g.status, g.kept, g.exclude], ["confirmed", list[1].id, [list[2].id]]);
  });
  it("cas 5bee1f71 : un Android, 25 tentatives, 16 IP (Tor, hébergeurs) → un seul vote compté", () => {
    const list = Array.from({ length: 25 }, (_, i) => a({ hwKey: "5bee", entropy: "strong", ipNet: `185.220.100.${i % 16}`, ipClass: i % 3 ? "hosting" : "tor", privateMode: true }));
    const [g] = buildGroups(DAY, list, OPTS);
    assert.equal(g.status, "confirmed");
    assert.equal(list.length - g.exclude.length, 1);
  });
});

describe("listes de l'onglet Sécurité", () => {
  const review = (x: GraphAttempt, over: Partial<ReviewAttempt> = {}): ReviewAttempt => ({ ...x, day: DAY, priority: false, ...over });
  it("cinq tentatives bloquées du même Android : une seule ligne, son premier blocage, le vote compté rappelé, les autres dans l'ordre", () => {
    const counted = review(a({ hwKey: "k", entropy: "strong", voterId: "v1" }));
    const blocked = [1, 2, 3, 4, 5].map(() => review(a({ hwKey: "k", entropy: "strong", status: "blocked" })));
    const persons = fraudPersons([counted, ...blocked], OPTS);
    assert.equal(persons.length, 1);
    const [p] = persons;
    assert.deepEqual([p.first, p.count, p.counted], [blocked[0].id, 5, counted.id]);
    assert.deepEqual(p.attempts, [counted.id, ...blocked.map((b) => b.id)]);
  });
  it("blocage sans aucun lien (plafond par IP seul) : ligne isolée", () => {
    const persons = fraudPersons([review(a({ status: "blocked" })), review(a({ status: "blocked" }))], OPTS);
    assert.equal(persons.length, 2);
  });
  it("récidive : même clé forte un autre jour", () => {
    const d1 = review(a({ hwKey: "k", entropy: "strong", status: "blocked" }), { day: "2026-10-26" });
    const d2 = review(a({ hwKey: "k", entropy: "strong", status: "blocked" }));
    const persons = fraudPersons([d1, d2], OPTS);
    assert.deepEqual(persons.map((p) => [p.day, p.recidivism]), [[DAY, ["2026-10-26"]], ["2026-10-26", [DAY]]]);
  });
  it("même personne : même cookie (trace bloquée et vote compté du même navigateur)", () => {
    assert.equal(personClusters([a({ voterId: "v" }), a({ voterId: "v", status: "blocked" })], OPTS).length, 1);
  });
  it("votes en attente : priorité haute en tête, puis les plus récents", () => {
    const low = review(a({ status: "held" }));
    const high = review(a({ status: "held" }), { priority: true });
    const recent = review(a({ status: "held" }));
    assert.deepEqual(pendingAttempts([low, high, recent, review(a())]).map((x) => x.id), [high.id, recent.id, low.id]);
  });
});

describe("A1 : le même cookie ne prouve jamais un groupe", () => {
  const settings = { ...DEFAULT_RISK_SETTINGS, mode: "block" as const };
  /** Rejoue le lendemain : la récidive (H7) ne vient que d'un groupe confirmé, posé par le moteur, qui contient une vraie fraude. */
  const nextDay = (day1: GraphAttempt[], rows: Record<string, Pick<ResponseRow, "blocked_at" | "excluded_at" | "fraud_reasons">>) => {
    const groups = buildGroups(DAY, day1, OPTS);
    const tagged = new Map(graphChanges(day1, groups).map((c) => [c.id, c.groupId]));
    const recidivism = [...tagged.keys()].some((id) => provesFraud(rows[id]));
    const facts = { stage: "complete" as const, nowMs: T0 + 86_400_000, voterId: "voter-honnete", storageKeys: [], hwKey: "K", entropy: "strong" as const, privateMode: false, ipNet: "10.9.9.9", ipClass: "normal" as const, country: "FR", city: "Lille", decorationId: "deco-1", score: 0, ipCapped: false, recidivism, tzMismatch: false, langMismatch: false };
    return { groups, tagged, decision: decide(facts, [], settings) };
  };
  const vote = () => a({ voterId: "voter-honnete", hwKey: "K", entropy: "strong", storageKey: "S" });
  const reopen = (atMs: number) => a({ voterId: "voter-honnete", hwKey: "K", entropy: "strong", seenStorage: ["S"], status: "blocked", cookieRefusal: true, atMs });
  const cookieRow = { blocked_at: "x", excluded_at: null, fraud_reasons: ["cookie"] };
  const voteRow = { blocked_at: null, excluded_at: null, fraud_reasons: [] };

  it("même cookie qui rouvre avec son jeton, puis vote le lendemain : compté", () => {
    const v = vote();
    const t = reopen(v.atMs + 30_000);
    const { groups, tagged, decision } = nextDay([v, t], { [v.id]: voteRow, [t.id]: cookieRow });
    assert.ok(!groups.some((g) => g.status === "confirmed"));
    assert.equal(tagged.size, 0, "aucun group_id posé sur le vote honnête");
    assert.deepEqual([decision.outcome, decision.reasons], ["counted", []]);
  });
  it("deux réouvertures du même cookie à plus de 60 s d'écart, puis vote le lendemain : compté", () => {
    const v = vote();
    const t1 = reopen(v.atMs + 90_000);
    const t2 = reopen(v.atMs + 300_000);
    const { tagged, decision } = nextDay([v, t1, t2], { [v.id]: voteRow, [t1.id]: cookieRow, [t2.id]: cookieRow });
    assert.equal(tagged.size, 0);
    assert.equal(decision.outcome, "counted");
  });
  it("même sans le marqueur de refus par cookie : pas de lien de jeton entre lignes du même cookie, C2 compte les cookies", () => {
    const v = vote();
    const same = [v, a({ voterId: "voter-honnete", hwKey: "K", entropy: "strong", seenStorage: ["S"], status: "blocked" }), a({ voterId: "voter-honnete", hwKey: "K", entropy: "strong", seenStorage: ["S"], status: "blocked" })];
    assert.ok(!linkAttempts(same, OPTS).some((l) => l.kind === "storage"));
    assert.ok(!buildGroups(DAY, same, OPTS).some((g) => g.status === "confirmed"));
    const three = [vote(), a({ hwKey: "K", entropy: "strong" }), a({ hwKey: "K", entropy: "strong" })];
    assert.deepEqual(buildGroups(DAY, three, OPTS)[0].conditions, ["C2"], "trois cookies distincts : confirmé");
  });
  it("H7 : seul un groupe passé avec une vraie fraude compte (exclusion, ou refus pour une autre raison que le cookie)", () => {
    assert.equal(provesFraud(cookieRow), false);
    assert.equal(provesFraud({ blocked_at: "x", excluded_at: null, fraud_reasons: ["cookie", "B1", "B2"] }), false);
    assert.equal(provesFraud({ blocked_at: "x", excluded_at: null, fraud_reasons: ["B2"] }), true);
    assert.equal(provesFraud({ blocked_at: null, excluded_at: "x", fraud_reasons: [] }), true);
    assert.equal(provesFraud(voteRow), false);
    // Trois cookies d'un même Android le 27 : le moteur exclut, la récidive vaut le lendemain.
    const list = [a({ hwKey: "K", entropy: "strong" }), a({ hwKey: "K", entropy: "strong" }), a({ hwKey: "K", entropy: "strong" })];
    const rows = Object.fromEntries(list.map((x, i) => [x.id, i ? { blocked_at: null, excluded_at: "x", fraud_reasons: [] } : voteRow]));
    assert.ok(nextDay(list, rows).decision.reasons.includes("H7"));
  });
});

describe("recalcul : retraits devenus justes", () => {
  it("group_id retiré hors de tout groupe confirmé, exclusion automatique levée, décision humaine intacte", () => {
    // Le 27, avant correctif : un vote honnête et deux réouvertures du même cookie formaient un groupe (C2).
    const v = a({ voterId: "voter-r", hwKey: "R", entropy: "strong", storageKey: "SR", groupId: "ancien" });
    const t = a({ voterId: "voter-r", hwKey: "R", entropy: "strong", seenStorage: ["SR"], status: "blocked", cookieRefusal: true, groupId: "ancien" });
    const auto = a({ hwKey: "R2", entropy: "strong", status: "excluded", autoExcluded: true, groupId: "ancien-2" });
    const human = a({ hwKey: "R3", entropy: "strong", status: "excluded", humanDecision: "excluded", groupId: "ancien-3" });
    const list = [v, t, auto, human];
    const changes = graphChanges(list, buildGroups(DAY, list, OPTS));
    assert.deepEqual(
      changes.map((c) => [c.id, c.exclude, c.restore, c.groupId]),
      [
        [v.id, false, false, null],
        [t.id, false, false, null],
        [auto.id, false, true, null],
      ],
    );
  });
  it("un vote en trop d'un groupe toujours confirmé reste exclu (rien à lever)", () => {
    const list = [1, 2, 3].map(() => a({ hwKey: "Q", entropy: "strong" }));
    const g = buildGroups(DAY, list, OPTS);
    const done = list.map((x, i) => ({ ...x, groupId: g[0].id, ...(i ? { status: "excluded" as const, autoExcluded: true } : {}) }));
    assert.deepEqual(graphChanges(done, buildGroups(DAY, done, OPTS)), []);
  });
});

describe("A18 : le passage automatique ne retire jamais, Recalculer borné par la conservation", () => {
  it("passage automatique : ni levée ni retrait de groupe ; exclusion et regroupement gardés", () => {
    const auto = a({ hwKey: "Z", entropy: "strong", status: "excluded", autoExcluded: true, groupId: "ancien" });
    const list = [1, 2, 3].map(() => a({ hwKey: "Y", entropy: "strong" }));
    const changes = graphChanges([auto, ...list], buildGroups(DAY, [auto, ...list], OPTS));
    assert.ok(changes.some((c) => c.restore) && changes.some((c) => c.exclude));
    const kept = withoutWithdrawals(changes);
    assert.ok(!kept.some((c) => c.restore || c.groupId === null));
    assert.equal(kept.filter((c) => c.exclude).length, 2);
  });
  it("Recalculer : retraits permis jusqu'à 29 jours, refusés à partir de 30 (purge des valeurs de l'IP)", () => {
    assert.equal(withdrawalsAllowed("2026-10-28", "2026-10-28", 30), true);
    assert.equal(withdrawalsAllowed("2026-09-29", "2026-10-28", 30), true);
    assert.equal(withdrawalsAllowed("2026-09-28", "2026-10-28", 30), false);
  });
});

describe("A19 : identifiant de groupe stable", () => {
  it("ancré sur le vote validé le plus ancien : un membre arrivé ensuite ne le change pas", () => {
    const first = a({ hwKey: "S1", entropy: "strong", id: "zzz-premier" });
    const others = [a({ hwKey: "S1", entropy: "strong", id: "aaa-second" }), a({ hwKey: "S1", entropy: "strong", id: "bbb-troisieme" })];
    const id1 = buildGroups(DAY, [first, ...others], OPTS)[0].id;
    assert.equal(id1, `${DAY}:zzz-prem`);
    const later = a({ hwKey: "S1", entropy: "strong", id: "000-arrive-apres" });
    assert.equal(buildGroups(DAY, [later, first, ...others], OPTS)[0].id, id1, "ordre d'entrée et id plus petit sans effet");
  });
  it("sans vote : la tentative ouverte la plus ancienne (created_at), égalité départagée par l'id", () => {
    const t = (id: string, createdMs: number) => a({ id, hwKey: "S2", entropy: "strong", status: "blocked", createdMs, ipClass: "tor" });
    assert.equal(buildGroups(DAY, [t("b-1", 10), t("a-1", 20)], OPTS)[0].id, `${DAY}:b-1`);
    assert.equal(buildGroups(DAY, [t("b-2", 10), t("a-2", 10)], OPTS)[0].id, `${DAY}:a-2`);
  });
});
