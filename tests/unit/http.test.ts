import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readJson } from "../../src/lib/http";

const post = (headers: Record<string, string>, body = '{"a":1}') => new Request("http://localhost/halloween/api/x", { method: "POST", headers, body });

describe("readJson (F-02 : requêtes cross-site « simples »)", () => {
  it("corps JSON avec Content-Type application/json → objet", async () => {
    assert.deepEqual(await readJson(post({ "Content-Type": "application/json" })), { a: 1 });
    assert.deepEqual(await readJson(post({ "Content-Type": "application/json; charset=utf-8" })), { a: 1 });
  });
  it("sans Content-Type JSON (text/plain, absent) → réponse 415", async () => {
    for (const headers of [{ "Content-Type": "text/plain" }, {}] as Record<string, string>[]) {
      const r = await readJson(post(headers));
      assert.ok(r instanceof Response && r.status === 415, JSON.stringify(headers));
    }
  });
  it("Sec-Fetch-Site: cross-site → réponse 403, même avec un Content-Type JSON", async () => {
    const r = await readJson(post({ "Content-Type": "application/json", "Sec-Fetch-Site": "cross-site" }));
    assert.ok(r instanceof Response && r.status === 403);
    const same = await readJson(post({ "Content-Type": "application/json", "Sec-Fetch-Site": "same-origin" }));
    assert.deepEqual(same, { a: 1 });
  });
  it("JSON illisible → undefined (la validation zod répond 422)", async () => {
    assert.equal(await readJson(post({ "Content-Type": "application/json" }, "{oops")), undefined);
  });
});
