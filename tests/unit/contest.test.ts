import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { contestPatchSchema, DEFAULT_CONTEST, drawPublished, drawWinners, loadContest, winnersVisible } from "../../src/lib/contest";

describe("fin du concours", () => {
  it("gagnants : secrets une fois le concours terminé, tant que la vidéo du tirage n'est pas en ligne", () => {
    const video_url = "https://x.supabase.co/storage/v1/object/public/decorations/a.mp4";
    assert.equal(winnersVisible({ closed: true, video_url: null }), false);
    assert.equal(winnersVisible({ closed: true, video_url }), true);
    assert.equal(winnersVisible({ closed: false, video_url: null }), true); // comportement d'origine, concours ouvert
    assert.equal(drawPublished({ video_url: null }), false);
    assert.equal(drawPublished({ video_url }), true);
  });

  it("gagnants du tirage : aucun avant la vidéo, ensuite le lot et le pseudo des lots attribués", () => {
    const prizes = [{ id: "a", winner_participant_id: "p1" }, { id: "b", winner_participant_id: null }, { id: "c", winner_participant_id: "supprimé" }];
    const people = [{ id: "p1", pseudo: "Bissi" }];
    assert.deepEqual(drawWinners({ closed: true, video_url: null }, prizes, people), []);
    assert.deepEqual(drawWinners({ closed: true, video_url: "/uploads/a.mp4" }, prizes, people), [{ prize: prizes[0], pseudo: "Bissi" }]);
  });

  it("réglage absent ou illisible : concours ouvert", async () => {
    assert.deepEqual(await loadContest({ getSetting: async () => null }), DEFAULT_CONTEST);
    assert.deepEqual(await loadContest({ getSetting: async () => ({ closed: "oui" }) }), DEFAULT_CONTEST);
  });

  it("réglage enregistré : relu tel quel", async () => {
    const saved = { closed: true, closed_at: "2026-11-02T10:00:00.000Z", instagram_url: "https://www.instagram.com/p/abc/", tiktok_url: null, video_url: null };
    assert.deepEqual(await loadContest({ getSetting: async () => saved }), saved);
  });

  it("liens des posts : https et bon réseau seulement", () => {
    const ok = (v: unknown) => contestPatchSchema.safeParse(v).success;
    assert.ok(ok({ instagram_url: "https://www.instagram.com/p/abc/" }));
    assert.ok(ok({ instagram_url: "https://instagram.com/reel/abc" }));
    assert.ok(ok({ tiktok_url: "https://www.tiktok.com/@chamastacos_lille/video/123" }));
    assert.ok(ok({ tiktok_url: "https://vm.tiktok.com/ZM123/" }));
    assert.ok(!ok({ instagram_url: "http://www.instagram.com/p/abc/" }), "http refusé");
    assert.ok(!ok({ instagram_url: "https://www.tiktok.com/@x" }), "mauvais réseau");
    assert.ok(!ok({ instagram_url: "https://evilinstagram.com/p/abc" }), "faux domaine");
    assert.ok(!ok({ tiktok_url: "javascript:alert(1)" }));
    assert.ok(!ok({ closed: true, extra: 1 }), "champ inconnu");
  });

  it("lien vide : effacé (null)", () => {
    const parsed = contestPatchSchema.parse({ instagram_url: "", tiktok_url: "  " });
    assert.equal(parsed.instagram_url, null);
    assert.equal(parsed.tiktok_url, null);
  });
});

describe("vidéo du tirage", () => {
  it("URL Supabase absolue ou chemin du stockage local acceptés (le fichier est vérifié par la route)", () => {
    assert.ok(contestPatchSchema.safeParse({ video_url: "https://x.supabase.co/storage/v1/object/public/decorations/a.mp4" }).success);
    assert.ok(contestPatchSchema.safeParse({ video_url: "/uploads/e533f7c9-ab32-43c9-8f18-120ebdb757c9.webm" }).success);
    assert.ok(contestPatchSchema.safeParse({ video_url: null }).success);
  });
});
