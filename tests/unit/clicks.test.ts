import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clickSchema, randomRef, REF_RE, summarizeClicks, type Click } from "../../src/lib/clicks";

let n = 0;
const click = (kind: Click["kind"], target: string, ref: string | null, voter_id: string | null): Click => ({
  id: String(++n),
  day: "2026-10-27",
  created_at: `2026-10-27T10:00:${String(n).padStart(2, "0")}.000Z`,
  kind,
  target,
  ref,
  voter_id,
});
const PEOPLE: Record<string, { pseudo: string | null; voted: boolean }> = {
  alice: { pseudo: "Alice59", voted: true },
  bob: { pseudo: null, voted: true },
  carl: { pseudo: "Carl", voted: true },
  dina: { pseudo: null, voted: false },
};
const whoIs = (v: string) => PEOPLE[v] ?? { pseudo: null, voted: false };

describe("summarizeClicks", () => {
  const rows = [
    click("share", "whatsapp", "aaaaaaaaaa", "alice"),
    click("share", "snapchat", "bbbbbbbbbb", "alice"),
    click("share", "copy", "cccccccccc", "bob"),
    click("share", "tiktok", "dddddddddd", null), // partage sans cookie de vote
    click("arrival", "whatsapp", "aaaaaaaaaa", "carl"),
    click("arrival", "whatsapp", "aaaaaaaaaa", "carl"), // même personne, deuxième session : une seule fois
    click("arrival", "snapchat", "bbbbbbbbbb", "dina"),
    click("arrival", "whatsapp", "aaaaaaaaaa", "alice"), // Alice ouvre son propre lien : exclue
    click("arrival", "copy", "zzzzzzzzzz", "eve"), // code inconnu
    click("follow", "instagram", null, "carl"),
    click("follow", "tiktok", null, null),
    click("follow", "tiktok", null, "bob"),
  ];
  const s = summarizeClicks(rows, whoIs);

  it("clics et arrivées par réseau, abonnements par réseau", () => {
    assert.deepEqual(
      s.shares.map((x) => [x.target, x.clicks, x.arrivals]),
      [["whatsapp", 1, 3], ["snapchat", 1, 1], ["instagram", 0, 0], ["tiktok", 1, 0], ["copy", 1, 1]],
    );
    assert.deepEqual(s.follows.map((x) => [x.target, x.clicks]), [["instagram", 1], ["tiktok", 2]]);
  });

  it("qui partage : pseudo, vote, et les personnes ramenées (dédoublonnées, soi-même exclu), les plus efficaces d'abord", () => {
    assert.deepEqual(s.sharers.map((x) => x.voter), ["alice", "bob"]);
    const [alice, bob] = s.sharers;
    assert.equal(alice.pseudo, "Alice59");
    assert.equal(alice.shares, 2);
    assert.deepEqual(alice.targets, ["whatsapp", "snapchat"]);
    assert.deepEqual(alice.brought, [
      { voter: "carl", pseudo: "Carl", voted: true },
      { voter: "dina", pseudo: null, voted: false },
    ]);
    assert.deepEqual([bob.pseudo, bob.shares, bob.brought.length], [null, 1, 0]);
  });

  it("non attribués : partage sans cookie, arrivée au code inconnu", () => {
    assert.equal(s.anonymousShares, 1);
    assert.equal(s.unmatchedArrivals, 1);
  });
});

describe("clickSchema et code de partage", () => {
  it("code aléatoire valide, réseau et code contrôlés, champs inconnus refusés", () => {
    const ref = randomRef();
    assert.match(ref, REF_RE);
    assert.notEqual(randomRef(), ref);
    assert.ok(clickSchema.safeParse({ kind: "share", target: "snapchat", ref }).success);
    assert.ok(clickSchema.safeParse({ kind: "follow", target: "tiktok" }).success);
    assert.ok(!clickSchema.safeParse({ kind: "share", target: "linkedin", ref }).success);
    assert.ok(!clickSchema.safeParse({ kind: "arrival", target: "whatsapp", ref: "COURT" }).success);
    assert.ok(!clickSchema.safeParse({ kind: "follow", target: "whatsapp" }).success);
    assert.ok(!clickSchema.safeParse({ kind: "follow", target: "tiktok", voter: "x" }).success);
  });
});
