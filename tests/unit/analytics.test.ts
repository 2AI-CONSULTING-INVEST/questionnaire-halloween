import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { summarize } from "../../src/lib/analytics";
import { toPublicResults } from "../../src/lib/public-results";
import type { Decoration, Participant, ResponseRow } from "../../src/lib/schema";

const DECO: Decoration = { id: "33333333-3333-4333-8333-333333333333", restaurant_name: "CHAMAS TACOS - LILLE FIVES", image_url: "/seed/deco-1.webp", display_order: 0, created_at: "2026-10-01T00:00:00.000Z" };
const DECO_B: Decoration = { id: "44444444-4444-4444-8444-444444444444", restaurant_name: "CHAMAS TACOS - LILLE MOULINS", image_url: "/seed/deco-2.webp", display_order: 1, created_at: "2026-10-01T00:00:00.000Z" };
const PARTICIPANT: Participant = { id: "55555555-5555-4555-8555-555555555555", pseudo: "Élo", pseudo_key: "elo", email: "e@x.fr", phone_number: "+33612345678", created_at: "2026-10-23T10:00:00.000Z", updated_at: "2026-10-23T10:00:00.000Z", deleted_at: null };

let n = 0;
const row = (over: Partial<ResponseRow>): ResponseRow => ({
  id: `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`,
  session_id: `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  selected_restaurant: DECO.restaurant_name,
  selected_decoration_id: DECO.id,
  comment: null,
  wants_raffle: null,
  participant_id: null,
  voter_id: null,
  vote_day: "2026-10-23",
  completed_at: "2026-10-23T10:00:00.000Z",
  created_at: "2026-10-23T09:59:00.000Z",
  updated_at: "2026-10-23T10:00:00.000Z",
  ip_address: null,
  user_agent: null,
  device_hash: null,
  device_info: null,
  risk_score: 0,
  risk_flags: null,
  blocked_at: null,
  excluded_at: null,
  ...over,
});

describe("summarize", () => {
  it("ignore les votes exclus du classement (totaux, résultats par décoration, Q1, courbe)", () => {
    const valid = row({});
    const excluded = row({ excluded_at: "2026-10-23T11:00:00.000Z" });
    const s = summarize([valid, excluded], [valid, excluded], [DECO]);
    assert.equal(s.kpis.totalVotes, 1);
    assert.equal(s.byDecoration[0].votes, 1);
    assert.equal(s.byDecoration[0].share, 1);
    assert.deepEqual(s.byFavorite, [{ name: DECO.restaurant_name, votes: 1 }]);
    assert.deepEqual(s.timeline, [{ date: "2026-10-23", votes: 1 }]);
  });
  it("inachevés = démarrés − validés − bloqués ; les bloqués ne sont jamais comptés", () => {
    const valid = row({});
    const blocked = row({ completed_at: null, blocked_at: "2026-10-23T10:00:00.000Z", risk_score: 95 });
    const incomplete = row({ completed_at: null, vote_day: null });
    const s = summarize([valid, blocked, incomplete], [valid], [DECO]);
    assert.equal(s.kpis.started, 3);
    assert.equal(s.kpis.totalVotes, 1);
    assert.equal(s.kpis.blocked, 1);
    assert.equal(s.kpis.incomplete, 1);
  });

  it("byDecoration : commentaires et inscrits au tirage (participants actifs seulement) par restaurant", () => {
    const a = row({ comment: "Super", participant_id: PARTICIPANT.id });
    const b = row({ participant_id: "66666666-6666-4666-8666-666666666666" }); // participant supprimé : absent de la liste
    const c = row({ selected_decoration_id: DECO_B.id, selected_restaurant: DECO_B.restaurant_name });
    const s = summarize([a, b, c], [a, b, c], [DECO, DECO_B], [PARTICIPANT]);
    assert.deepEqual(s.byDecoration.map((d) => [d.restaurant_name, d.votes, d.comments, d.raffle]), [
      [DECO.restaurant_name, 2, 1, 1],
      [DECO_B.restaurant_name, 1, 0, 0],
    ]);
    assert.equal(s.kpis.raffleParticipants, 1);
  });

  it("byDecorationDaily : par jour (Paris) et par restaurant, jours vides compris", () => {
    const d1 = row({ vote_day: "2026-10-21", completed_at: "2026-10-21T10:00:00.000Z" });
    const d3 = row({ vote_day: "2026-10-23", selected_decoration_id: DECO_B.id });
    const d3b = row({ vote_day: "2026-10-23" });
    const s = summarize([d1, d3, d3b], [d1, d3, d3b], [DECO, DECO_B]);
    assert.deepEqual(s.byDecorationDaily, [
      { date: "2026-10-21", votes: { [DECO.restaurant_name]: 1 } },
      { date: "2026-10-22", votes: {} },
      { date: "2026-10-23", votes: { [DECO_B.restaurant_name]: 1, [DECO.restaurant_name]: 1 } },
    ]);
    assert.deepEqual(
      s.timeline.map((t) => t.votes),
      [1, 0, 2],
    );
  });

  it("favoriteVsVote : tableau croisé préféré (Q1) × voté (Q2), lignes triées par total", () => {
    const loyal = row({});
    const cross1 = row({ selected_restaurant: DECO_B.restaurant_name });
    const cross2 = row({ selected_restaurant: DECO_B.restaurant_name, selected_decoration_id: DECO_B.id });
    const unknown = row({ selected_restaurant: null });
    const s = summarize([loyal, cross1, cross2, unknown], [loyal, cross1, cross2, unknown], [DECO, DECO_B]);
    assert.deepEqual(s.favoriteVsVote, [
      { favorite: DECO_B.restaurant_name, votes: { [DECO.restaurant_name]: 1, [DECO_B.restaurant_name]: 1 } },
      { favorite: DECO.restaurant_name, votes: { [DECO.restaurant_name]: 1 } },
    ]);
  });

  it("byHour : 24 entrées, heure de Paris (UTC+2 en octobre, UTC+1 après le 25)", () => {
    const summer = row({ completed_at: "2026-10-23T22:30:00.000Z", vote_day: "2026-10-24" }); // 00 h 30 à Paris
    const winter = row({ completed_at: "2026-10-30T22:30:00.000Z", vote_day: "2026-10-30" }); // 23 h 30 à Paris
    const noon = row({ completed_at: "2026-10-23T10:05:00.000Z" }); // 12 h 05 à Paris
    const s = summarize([summer, winter, noon], [summer, winter, noon], [DECO]);
    assert.equal(s.byHour.length, 24);
    assert.equal(s.byHour[0].votes, 1);
    assert.equal(s.byHour[23].votes, 1);
    assert.equal(s.byHour[12].votes, 1);
    assert.equal(s.byHour.reduce((a, h) => a + h.votes, 0), 3);
  });

  it("dailyTable : démarrés, validés, inscrits, bloqués par jour (Paris), jours vides à zéro", () => {
    const started = row({ completed_at: null, vote_day: null, created_at: "2026-10-21T23:30:00.000Z" }); // 22 à Paris (01 h 30)
    const valid = row({ vote_day: "2026-10-24", completed_at: "2026-10-24T10:00:00.000Z", created_at: "2026-10-24T09:00:00.000Z", participant_id: PARTICIPANT.id });
    const blocked = row({ completed_at: null, blocked_at: "2026-10-24T10:00:00.000Z", vote_day: "2026-10-24", created_at: "2026-10-24T09:00:00.000Z" });
    const s = summarize([started, valid, blocked], [valid], [DECO], [PARTICIPANT]);
    assert.deepEqual(s.dailyTable, [
      { date: "2026-10-22", started: 1, completed: 0, raffle: 0, blocked: 0 },
      { date: "2026-10-23", started: 0, completed: 0, raffle: 0, blocked: 0 },
      { date: "2026-10-24", started: 2, completed: 1, raffle: 1, blocked: 1 },
    ]);
  });

  it("sans réponse : agrégats vides, byHour à zéro", () => {
    const s = summarize([], [], [DECO]);
    assert.deepEqual(s.timeline, []);
    assert.deepEqual(s.byDecorationDaily, []);
    assert.deepEqual(s.favoriteVsVote, []);
    assert.deepEqual(s.dailyTable, []);
    assert.equal(s.byHour.every((h) => h.votes === 0), true);
  });
});

describe("toPublicResults", () => {
  it("n'expose que total, results (id, restaurant_name, image_url, votes, share) et updatedAt : rien des nouveaux agrégats", () => {
    const r = row({ comment: "x", participant_id: PARTICIPANT.id });
    const s = summarize([r], [r], [DECO, DECO_B], [PARTICIPANT]);
    const pub = toPublicResults(s);
    assert.deepEqual(Object.keys(pub).sort(), ["results", "total", "updatedAt"]);
    for (const d of pub.results) assert.deepEqual(Object.keys(d).sort(), ["id", "image_url", "restaurant_name", "share", "votes"]);
    const text = JSON.stringify(pub);
    for (const key of ["comments", "raffle", "byHour", "dailyTable", "favoriteVsVote", "byDecorationDaily", "kpis", "timeline"]) assert.ok(!text.includes(key), key);
  });
});
