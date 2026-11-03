import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { podiumLayout, podiumSlots, placeLabel, slotAt } from "../../src/components/scene/podium";

const e = (id: string, votes: number) => ({ id, restaurant_name: `CHAMAS TACOS - ${id}`, image_url: `/seed/${id}.jpg`, votes, share: votes / 100 });

describe("podium de fin de concours", () => {
  it("les trois premiers avec des votes, du gagnant à la 3e place", () => {
    const slots = podiumSlots([e("A", 40), e("B", 30), e("C", 20), e("D", 10)]);
    assert.deepEqual(slots.map((s) => [s.entry.id, s.rank, s.place]), [["A", 1, 1], ["B", 2, 2], ["C", 3, 3]]);
  });

  it("ordre d'entrée indifférent : trié par votes", () => {
    const slots = podiumSlots([e("C", 20), e("A", 40), e("B", 30)]);
    assert.deepEqual(slots.map((s) => s.entry.id), ["A", "B", "C"]);
  });

  it("ex æquo : même rang (même couronne), places distinctes", () => {
    const slots = podiumSlots([e("A", 30), e("B", 30), e("C", 10)]);
    assert.deepEqual(slots.map((s) => [s.rank, s.place]), [[1, 1], [1, 2], [3, 3]]);
  });

  it("restaurants sans vote : hors du podium", () => {
    assert.deepEqual(podiumSlots([e("A", 5), e("B", 0)]).map((s) => s.entry.id), ["A"]);
    assert.deepEqual(podiumSlots([e("A", 0)]), []);
  });

  it("disposition : 2e à gauche, 1re au centre plus haute, 3e à droite ; tout tient dans le panneau", () => {
    const boxes = podiumLayout(4.1 / 3.1);
    const [first, second, third] = boxes;
    assert.ok(second.card.x < first.card.x && first.card.x < third.card.x);
    assert.ok(first.step.h > second.step.h && second.step.h > third.step.h);
    assert.ok(first.card.y < second.card.y && second.card.y < third.card.y);
    for (const b of boxes) {
      for (const r of [b.card, b.photo, b.step]) assert.ok(r.x >= 0 && r.y >= 0.16 && r.x + r.w <= 1 && r.y + r.h <= 1, `place ${b.place} hors du panneau`);
      assert.ok(b.photo.y + b.photo.h < b.card.y + b.card.h, "le nom tient sous la photo");
      assert.ok(b.card.y + b.card.h <= b.step.y, "la carte repose au-dessus de sa marche");
    }
  });

  it("clic : carte ou marche d'une place ; ailleurs, rien", () => {
    const boxes = podiumLayout(4.1 / 3.1);
    for (const b of boxes) {
      assert.equal(slotAt(boxes, b.card.x + b.card.w / 2, b.card.y + b.card.h / 2), b.place);
      assert.equal(slotAt(boxes, b.step.x + b.step.w / 2, b.step.y + b.step.h / 2), b.place);
    }
    assert.equal(slotAt(boxes, 0.5, 0.05), null, "titre");
    assert.equal(slotAt(boxes, 0.01, 0.5), null, "bord");
  });

  it("libellés de rang", () => {
    assert.equal(placeLabel(1), "1re place");
    assert.equal(placeLabel(3), "3e place");
  });
});
