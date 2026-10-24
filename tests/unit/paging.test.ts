import assert from "node:assert/strict";
import { isIP } from "node:net";
import { describe, it } from "node:test";
import { afterCursor, compareKeys, decodeCursor, encodeCursor, escapeLike, searchKind } from "../../src/lib/paging";

const ID = "9f1c2b3a-4d5e-4f60-8a71-82b3c4d5e6f7";

describe("curseur", () => {
  it("encode puis décode (valeur ISO, id en minuscules)", () => {
    const raw = encodeCursor({ value: "2026-10-23T10:00:00.123456+00:00", id: ID.toUpperCase() });
    assert.match(raw, /^[A-Za-z0-9_-]+$/);
    assert.deepEqual(decodeCursor(raw), { value: "2026-10-23T10:00:00.123456+00:00", id: ID });
  });
  it("la valeur peut contenir « | » (pseudo) : le dernier séparateur tranche", () => {
    assert.deepEqual(decodeCursor(encodeCursor({ value: "a|b", id: ID })), { value: "a|b", id: ID });
  });
  it("refuse : vide, base64 impur, id non uuid, valeur vide / trop longue / guillemet / antislash", () => {
    assert.equal(decodeCursor(null), null);
    assert.equal(decodeCursor(""), null);
    assert.equal(decodeCursor("ab$c"), null);
    assert.equal(decodeCursor(encodeCursor({ value: "x", id: "pas-un-uuid" })), null);
    assert.equal(decodeCursor(encodeCursor({ value: "", id: ID })), null);
    assert.equal(decodeCursor(encodeCursor({ value: "x".repeat(301), id: ID })), null);
    assert.equal(decodeCursor(encodeCursor({ value: 'a"b', id: ID })), null);
    assert.equal(decodeCursor(encodeCursor({ value: "a\\b", id: ID })), null);
    assert.equal(decodeCursor("a".repeat(601)), null);
    assert.equal(decodeCursor(Buffer.from("sans-separateur").toString("base64url")), null);
  });
  it("ordre (valeur, id) et position par rapport au curseur", () => {
    const a = { value: "2026-10-22", id: ID };
    const b = { value: "2026-10-23", id: "00000000-0000-4000-8000-000000000000" };
    const b2 = { value: "2026-10-23", id: "ffffffff-ffff-4fff-8fff-ffffffffffff" };
    assert.ok(compareKeys(a, b) < 0 && compareKeys(b, a) > 0 && compareKeys(b, b2) < 0 && compareKeys(b, b) === 0);
    assert.equal(afterCursor(a, b, "desc"), true);
    assert.equal(afterCursor(a, b, "asc"), false);
    assert.equal(afterCursor(b2, b, "asc"), true);
    assert.equal(afterCursor(b, b, "asc"), false);
  });
});

describe("searchKind", () => {
  const kind = (q: string) => searchKind(q, (s) => isIP(s) !== 0);
  it("IP complète v4 / v6 → ip", () => {
    assert.equal(kind("192.168.1.10"), "ip");
    assert.equal(kind("2a01:e0a:1234::1"), "ip");
    assert.equal(kind("::1"), "ip");
  });
  it("IP incomplète ou invalide → jamais une requête inet", () => {
    assert.equal(kind("999.999.999.999"), "none");
    assert.equal(kind("192.168.1"), "none");
    assert.equal(kind("abc:"), "none");
    assert.equal(kind(":::"), "none");
  });
  it("hexa (3 à 64) → début d'empreinte ; autre → none", () => {
    assert.equal(kind("9f1c"), "device");
    assert.equal(kind("ABC"), "device");
    assert.equal(kind("f".repeat(64)), "device");
    assert.equal(kind("f".repeat(65)), "none");
    assert.equal(kind("xyz"), "none");
    assert.equal(kind("1.2"), "none");
  });
});

describe("escapeLike", () => {
  it("échappe %, _ et \\ ; retire les caractères réservés de PostgREST", () => {
    assert.equal(escapeLike("50%_a\\b"), "50\\%\\_a\\\\b");
    assert.equal(escapeLike('a,b(c)"d\'e*f'), "abcdef");
    assert.equal(escapeLike("jean.dupont@mail.fr"), "jean.dupont@mail.fr");
  });
});
