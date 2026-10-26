import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ipFromHeaders } from "../../src/lib/rate-limit";

const headers = (h: Record<string, string>) => (name: string) => h[name] ?? null;

describe("ipFromHeaders (D-02 : adresse IP du client)", () => {
  it("hors Vercel : premier élément de X-Forwarded-For, sinon X-Real-IP", () => {
    assert.equal(ipFromHeaders(headers({ "x-forwarded-for": "10.4.6.6, 10.0.0.1" }), false), "10.4.6.6");
    assert.equal(ipFromHeaders(headers({ "x-real-ip": "2001:db8::1" }), false), "2001:db8::1");
    assert.equal(ipFromHeaders(headers({}), false), null);
  });
  it("X-Forwarded-For mal formé → null (pas le second élément), sauf X-Real-IP valide", () => {
    assert.equal(ipFromHeaders(headers({ "x-forwarded-for": "zz, 10.4.6.6" }), false), null);
    assert.equal(ipFromHeaders(headers({ "x-forwarded-for": "999.1.1.1" }), false), null);
    assert.equal(ipFromHeaders(headers({ "x-forwarded-for": "zz", "x-real-ip": "10.4.6.6" }), false), null);
    assert.equal(ipFromHeaders(headers({ "x-real-ip": "10.4.6.6" }), false), "10.4.6.6");
  });
  it("sur Vercel : X-Real-IP prioritaire, puis x-vercel-forwarded-for, X-Forwarded-For en repli", () => {
    assert.equal(ipFromHeaders(headers({ "x-forwarded-for": "1.1.1.1", "x-vercel-forwarded-for": "2.2.2.2", "x-real-ip": "3.3.3.3" }), true), "3.3.3.3");
    assert.equal(ipFromHeaders(headers({ "x-forwarded-for": "1.1.1.1", "x-vercel-forwarded-for": "2.2.2.2, 9.9.9.9" }), true), "2.2.2.2");
    assert.equal(ipFromHeaders(headers({ "x-forwarded-for": "1.1.1.1" }), true), "1.1.1.1");
    assert.equal(ipFromHeaders(headers({ "x-real-ip": "zz", "x-forwarded-for": "1.1.1.1" }), true), null);
  });
});
