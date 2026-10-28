import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { responseMatcher, type ResponseFilter } from "../../src/lib/db";
import type { ResponseRow } from "../../src/lib/schema";

let n = 0;
const row = (over: Partial<ResponseRow> = {}): ResponseRow => {
  n += 1;
  const at = "2026-10-27T12:00:00.000Z";
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    session_id: `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    selected_restaurant: null, selected_decoration_id: null, comment: null, wants_raffle: null, participant_id: null, voter_id: null,
    vote_day: "2026-10-27", completed_at: at, created_at: at, updated_at: at, ip_address: null, user_agent: null,
    device_hash: null, device_info: null, risk_score: 0, risk_flags: null, blocked_at: null, excluded_at: null,
    ...over,
  };
};
const keep = (f: ResponseFilter, rows: ResponseRow[]) => rows.filter(responseMatcher(f)).map((r) => r.id);

describe("responseMatcher (onglet Votes : store JSON et exports)", () => {
  const counted = row();
  const held = row({ held_at: "2026-10-27T12:01:00.000Z", fraud_reasons: ["H1"] });
  const excluded = row({ excluded_at: "2026-10-27T12:02:00.000Z", exclusion_source: "admin", human_decision: "excluded" });
  const autoExcluded = row({ excluded_at: "2026-10-27T12:02:00.000Z", exclusion_source: "auto" });
  const incomplete = row({ completed_at: null, vote_day: null });
  const blocked = row({ completed_at: null, vote_day: null, blocked_at: "2026-10-27T12:03:00.000Z", fraud_reasons: ["cookie"] });
  const all = [counted, held, excluded, autoExcluded, incomplete, blocked];

  it("« validated » : tout vote validé (compté, en attente, exclu à la main ou par le moteur), sans les incomplets ni les bloqués", () => {
    assert.deepEqual(keep({ status: "validated" }, all), [counted.id, held.id, excluded.id, autoExcluded.id]);
  });

  it("les autres statuts gardent leur sens : « completed » = comptés seulement, « all » = tout", () => {
    assert.deepEqual(keep({ status: "completed" }, all), [counted.id]);
    assert.deepEqual(keep({ status: "held" }, all), [held.id]);
    assert.deepEqual(keep({ status: "blocked" }, all), [blocked.id]);
    assert.equal(keep({ status: "all" }, all).length, all.length);
  });

  it("score non nul : score > 0 ou au moins une règle anti-fraude (null et [] = aucune)", () => {
    const scored = row({ risk_score: 25 });
    const ruled = row({ fraud_reasons: ["H3"] });
    const clean = row();
    const emptyRules = row({ fraud_reasons: [] });
    assert.deepEqual(keep({ status: "validated", risky: true }, [scored, ruled, clean, emptyRules]), [scored.id, ruled.id]);
    assert.deepEqual(keep({ status: "validated", risky: false }, [clean, emptyRules]), [clean.id, emptyRules.id]);
  });

  it("du / au : jours de validation à Paris, inclus (27 octobre 23 h 30 UTC = 28 octobre à Paris)", () => {
    const late = row({ completed_at: "2026-10-27T23:30:00.000Z" });
    const noon = row({ completed_at: "2026-10-27T12:00:00.000Z" });
    assert.deepEqual(keep({ status: "validated", from: "2026-10-28", to: "2026-10-28" }, [late, noon]), [late.id]);
    assert.deepEqual(keep({ status: "validated", to: "2026-10-27" }, [late, noon]), [noon.id]);
    assert.deepEqual(keep({ status: "validated", from: "2026-10-27" }, [late, noon]), [late.id, noon.id]);
    assert.deepEqual(keep({ status: "all", from: "2026-10-01" }, [row({ completed_at: null })]), [], "sans completed_at : hors de toute plage");
  });

  it("se combine avec les inscrits au tirage et le seuil de signalement, comme avant", () => {
    const enrolled = row({ participant_id: "p1", risk_score: 50 });
    const anonymous = row({ risk_score: 50 });
    assert.deepEqual(keep({ status: "validated", raffle: true, flaggedFrom: 40 }, [enrolled, anonymous, counted]), [enrolled.id]);
  });
});
