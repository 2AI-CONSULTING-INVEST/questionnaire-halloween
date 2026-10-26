import assert from "node:assert/strict";
import { describe, it } from "node:test";

const FROZEN = "2030-01-01T00:00:00.000Z";
const req = () => new Request("http://localhost/halloween/api/x", { headers: { cookie: `hw_test_now=${FROZEN}` } });

describe("serverNow (F-08 : horloge de test jamais en production)", () => {
  it("NEXT_PUBLIC_HW_TEST_CLOCK=1 hors production → cookie hw_test_now lu", async () => {
    process.env.NEXT_PUBLIC_HW_TEST_CLOCK = "1";
    delete process.env.VERCEL_ENV;
    const { serverNow, TEST_CLOCK } = await import("../../src/lib/clock");
    assert.equal(TEST_CLOCK, true);
    assert.equal(serverNow(req()), Date.parse(FROZEN));
  });
  it("même build, VERCEL_ENV=production → horloge réelle, cookie ignoré", async () => {
    process.env.NEXT_PUBLIC_HW_TEST_CLOCK = "1";
    process.env.VERCEL_ENV = "production";
    const { serverNow } = await import("../../src/lib/clock");
    const now = serverNow(req());
    assert.ok(Math.abs(now - Date.now()) < 5_000 && now !== Date.parse(FROZEN));
    delete process.env.VERCEL_ENV;
  });
});
