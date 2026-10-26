import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { migrateLocal, purgeLocal, RETENTION_DAYS, type LocalData } from "../../src/lib/db";
import type { ResponseRow } from "../../src/lib/schema";

const NOW = Date.parse("2026-10-24T12:00:00.000Z");
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();

let n = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
const response = (created_at: string): ResponseRow => ({
  id: uuid(), session_id: uuid(), selected_restaurant: null, selected_decoration_id: null, comment: null, wants_raffle: null, participant_id: null,
  voter_id: uuid(), vote_day: "2026-10-01", completed_at: created_at, created_at, updated_at: created_at, ip_address: "1.1.1.1", user_agent: "UA",
  device_hash: "ab".repeat(32), device_info: { mobile: true }, risk_score: 0, risk_flags: null, blocked_at: null, excluded_at: null,
});
const session = (created_at: string) => ({ id: uuid(), role: "admin" as const, ip: "9.9.9.9", user_agent: null, city: null, region: null, country: null, latitude: null, longitude: null, created_at, last_seen_at: created_at, revoked_at: null });
const visit = (created_at: string) => ({ id: uuid(), day: created_at.slice(0, 10), created_at, ip: "1.1.1.1", user_agent: "UA", path: "/", referrer: null, device_hash: null, device_info: null, visitor_id: null, rejected: null });

describe("purgeLocal (F-06 b : conservation)", () => {
  it("IP / UA / appareil des réponses > 30 j effacés, vote et empreinte conservés ; visites > 90 j, sessions (et actions) > 180 j, échecs > 30 j supprimés", () => {
    const old = session(daysAgo(181));
    const recent = session(daysAgo(179));
    const d: LocalData = {
      responses: [response(daysAgo(31)), response(daysAgo(29))],
      restaurants: [], decorations: [], participants: [], prizes: [], settings: {},
      admin_sessions: [old, recent],
      admin_actions: [
        { id: uuid(), session_id: old.id, method: "POST", path: "/x", action: "a", details: null, created_at: old.created_at },
        { id: uuid(), session_id: recent.id, method: "POST", path: "/x", action: "a", details: null, created_at: recent.created_at },
      ],
      visits: [visit(daysAgo(91)), visit(daysAgo(89))],
      login_failures: [{ id: uuid(), ip: "1.1.1.1", created_at: daysAgo(31) }, { id: uuid(), ip: "1.1.1.1", created_at: daysAgo(29) }],
    };
    purgeLocal(d, NOW);
    const [a, b] = d.responses;
    assert.deepEqual([a.ip_address, a.user_agent, a.device_info], [null, null, null]);
    assert.ok(a.completed_at && a.device_hash && a.vote_day, "le vote et l'empreinte HMAC restent");
    assert.deepEqual([b.ip_address, b.user_agent, b.device_info], ["1.1.1.1", "UA", { mobile: true }]);
    assert.deepEqual(d.visits.map((v) => v.created_at), [daysAgo(89)]);
    assert.deepEqual(d.admin_sessions.map((s) => s.id), [recent.id]);
    assert.deepEqual(d.admin_actions.map((x) => x.session_id), [recent.id]);
    assert.deepEqual(d.login_failures.map((f) => f.created_at), [daysAgo(29)]);
    assert.deepEqual(RETENTION_DAYS, { responses: 30, visits: 90, admin_sessions: 180, login_failures: 30 });
  });
  it("idempotente, et un fichier ancien sans login_failures est accepté (migrateLocal)", () => {
    const d = { responses: [response(daysAgo(40))], restaurants: [], decorations: [], participants: [], prizes: [], admin_sessions: [], admin_actions: [], settings: {}, visits: [] } as unknown as LocalData;
    assert.equal(migrateLocal(d), true);
    assert.deepEqual(d.login_failures, []);
    purgeLocal(d, NOW);
    const once = JSON.stringify(d);
    purgeLocal(d, NOW);
    assert.equal(JSON.stringify(d), once);
  });
});
