import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getShownVolume, getSoundPrefs, getVideoVolume, holdSound, isVideoPlaying, setSoundVolume } from "../../src/components/sound/engine";

// Un seul scénario, dans l'ordre : le moteur garde son état (préférences, vidéos en cours) d'un appel à l'autre.
describe("volume des vidéos", () => {
  it("70 % au moins, réglage retenu pendant une vidéo, musique du site inchangée", () => {
    setSoundVolume(0.3);
    assert.equal(getVideoVolume(), 0.7, "site à 30 % : la vidéo monte à 70 %");

    holdSound(true);
    assert.equal(isVideoPlaying(), true);
    assert.equal(getShownVolume(), 0.7, "le panneau montre le volume de la vidéo");
    setSoundVolume(0.4); // le votant baisse pendant la lecture
    assert.equal(getVideoVolume(), 0.4);
    assert.equal(getSoundPrefs().volume, 0.3, "la musique du site garde son réglage");
    holdSound(false);

    assert.equal(getShownVolume(), 0.3, "après la vidéo, le panneau revient au volume du site");
    setSoundVolume(0.1); // réglage du site hors vidéo
    assert.equal(getVideoVolume(), 0.4, "les vidéos suivantes gardent le réglage choisi, sans remonter à 70 %");

    holdSound(true);
    setSoundVolume(0.9);
    holdSound(false);
    assert.equal(getVideoVolume(), 0.9, "le votant peut aussi monter");
  });

  it("site déjà au-dessus de 70 % : la vidéo suit le site tant que rien n'a été choisi pour elle", async () => {
    const { getVideoVolume: fresh, setSoundVolume: set } = await import(`../../src/components/sound/engine.ts?neuf=${Date.now()}`);
    set(0.85);
    assert.equal(fresh(), 0.85);
  });
});
