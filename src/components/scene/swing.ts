/**
 * Coup de faux de la faucheuse vers l'écran (scène 2). Le pack KayKit gratuit n'a pas d'animation
 * d'attaque : le geste est calculé ici, par-dessus l'animation « Idle » du mixer, sur le bras gauche
 * (qui tient la faux), le buste et la tête. Bras : IK à deux os (épaule → coude → main) vers une
 * trajectoire de la main ; orientation de la main choisie pour pointer le manche (et donc la lame,
 * à son bout) là où on veut ; fondu avec la pose du mixer par un poids 0 → 1 → 0.
 *
 * Phases : armé (main haute derrière l'épaule, lame en arrière), frappe (main lancée devant, manche
 * vers la caméra : la lame fond sur le visiteur), suite du geste (en bas à gauche), retour à l'idle.
 * À l'instant de la frappe, `flinch` donne un recul de caméra (sursaut du visiteur), à ajouter à la
 * position de la caméra.
 */
import * as THREE from "three";

/**
 * Image clé : temps (s), main (droite, haut, avant) depuis l'épaule en unités du modèle, manche
 * (direction « haut du manche »), lame (direction de sa pointe depuis le haut du manche),
 * inclinaison du buste (rad), poids du geste. Repère : droite / haut de l'écran, vers la caméra.
 */
type V3 = [number, number, number];
type Key = { t: number; h: V3; up: V3; side: V3; lean: number; w: number };
const KEYS: Key[] = [
  { t: 0, h: [0.12, -0.5, 0.1], up: [0, 1, 0], side: [-1, 0, 0], lean: 0, w: 0 },
  // Armé : main haute à droite, manche dressé en arrière, lame derrière la tête.
  { t: 0.55, h: [0.35, 0.4, -0.25], up: [0.4, 0.85, -0.3], side: [-0.3, 0.2, -0.9], lean: -0.15, w: 1 },
  // Frappe : main lancée devant, manche en travers de l'écran (haut vers la gauche, bout vers la
  // caméra), lame de trois quarts, pointe vers le visiteur.
  { t: 0.82, h: [-0.05, 0.08, 0.52], up: [-0.55, 0.55, 0.63], side: [0.4, 0.05, 0.9], lean: 0.45, w: 1 },
  // Suite : le geste continue en bas à gauche, la lame passe sous l'objectif.
  { t: 1.05, h: [-0.33, -0.22, 0.32], up: [-0.55, -0.35, 0.75], side: [-0.2, -0.75, 0.6], lean: 0.35, w: 1 },
  { t: 2.0, h: [0.12, -0.5, 0.1], up: [0, 1, 0], side: [-1, 0, 0], lean: 0, w: 0 }, // retour
];
const HIT_T = 0.8; // instant où la lame « atteint » la caméra
const EASE: ((u: number) => number)[] = [
  (u) => u * u * (3 - 2 * u), // armé : doux
  (u) => u * u * u, // frappe : accélère jusqu'au bout
  (u) => 1 - (1 - u) ** 2, // suite : freine
  (u) => u * u * (3 - 2 * u), // retour : doux
];
const L1 = 0.242; // humérus (unités du modèle)
const L2 = 0.334; // avant-bras + main (poignet raide pendant le geste)

export type ScytheSwing = {
  /** Durée totale du geste (s). */
  length: number;
  active(): boolean;
  start(): void;
  /** Après `mixer.update` : applique le geste (si en cours) et met `flinch` à jour. */
  update(dt: number, camera: THREE.Camera): void;
  /** Recul de caméra (repère monde), nul hors frappe. */
  flinch: THREE.Vector3;
};

export function createScytheSwing(model: THREE.Object3D, scythe: THREE.Object3D): ScytheSwing | null {
  const bone = (n: string) => model.getObjectByName(n.replace(".", "")) ?? model.getObjectByName(n);
  const chest = bone("chest");
  const upper = bone("upperarm.l");
  const lower = bone("lowerarm.l");
  const wrist = bone("wrist.l");
  const hand = bone("hand.l");
  const head = bone("head");
  const slot = scythe.parent;
  if (!chest || !upper || !lower || !wrist || !hand || !head || slot !== bone("handslot.l")) return null;

  // La faux est accrochée à l'emplacement d'arme (enfant de la main, animé par le mixer) : haut du
  // manche = +Y de la faux, lame = +X. Leur direction dans le repère de la main se recalcule à chaque
  // image (l'emplacement bouge un peu avec l'idle).
  const upH = new THREE.Vector3();
  const sideH = new THREE.Vector3();
  const qSlot = new THREE.Quaternion();
  const handBasisInv = new THREE.Matrix4();
  // Buste, tête et poignet : pistes constantes dans « Idle », donc le mixer ne les réécrit pas à
  // chaque image (il n'écrit que ce qui change). On part toujours de leur pose de base, restaurée
  // à la fin du geste, sinon la rotation s'accumulerait image après image.
  const baseChest = chest.quaternion.clone();
  const baseHead = head.quaternion.clone();
  const baseWrist = wrist.quaternion.clone();

  const flinch = new THREE.Vector3();
  let T = -1;
  let hitT = -1;
  // Tampons
  const S = new THREE.Vector3();
  const F = new THREE.Vector3();
  const R = new THREE.Vector3();
  const U = new THREE.Vector3(0, 1, 0);
  const H = new THREE.Vector3();
  const E = new THREE.Vector3();
  const P = new THREE.Vector3();
  const d = new THREE.Vector3();
  const perp = new THREE.Vector3();
  const upW = new THREE.Vector3();
  const sideW = new THREE.Vector3();
  const x = new THREE.Vector3();
  const y = new THREE.Vector3();
  const z = new THREE.Vector3();
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const qParent = new THREE.Quaternion();
  const qWorld = new THREE.Quaternion();
  const qLocal = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const pos = new THREE.Vector3();

  /** Quaternion monde qui envoie +Y de l'os sur `dir`, roulis fixé par `pole` (coude). */
  const aim = (dir: THREE.Vector3, pole: THREE.Vector3, out: THREE.Quaternion) => {
    y.copy(dir).normalize();
    x.crossVectors(y, pole).normalize();
    if (x.lengthSq() < 1e-6) x.set(1, 0, 0);
    z.crossVectors(x, y);
    return out.setFromRotationMatrix(m.makeBasis(x, y, z));
  };
  /** Os : rotation monde voulue → rotation locale (parent déjà à jour), fondue avec la pose du mixer. */
  const setBone = (b: THREE.Object3D, world: THREE.Quaternion, w: number) => {
    b.parent!.matrixWorld.decompose(pos, qParent, scale);
    qLocal.copy(qParent.invert()).multiply(world);
    b.quaternion.slerp(qLocal, w);
    b.updateMatrixWorld(true);
  };

  const lerp3 = (a: V3, b: V3, u: number, out: THREE.Vector3) =>
    out.set(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u);
  const hOff = new THREE.Vector3();
  const uOff = new THREE.Vector3();
  const sOff = new THREE.Vector3();

  return {
    length: KEYS[KEYS.length - 1].t,
    flinch,
    active: () => T >= 0,
    start() {
      T = 0;
    },
    update(dt, camera) {
      // Recul de caméra : coup sec vers l'arrière et vers le bas, qui s'amortit.
      if (hitT >= 0) {
        hitT += dt;
        const env = hitT < 0.08 ? hitT / 0.08 : Math.exp(-(hitT - 0.08) * 7);
        flinch.copy(F).multiplyScalar(0.14 * env).addScaledVector(U, -0.06 * env);
        if (hitT > 1.2) {
          hitT = -1;
          flinch.set(0, 0, 0);
        }
      }
      if (T < 0) return;
      const prev = T;
      T += dt;
      if (prev < HIT_T && T >= HIT_T) hitT = 0;
      if (T >= KEYS[KEYS.length - 1].t) {
        T = -1;
        chest.quaternion.copy(baseChest);
        head.quaternion.copy(baseHead);
        wrist.quaternion.copy(baseWrist);
        return;
      }
      let i = 0;
      while (i < KEYS.length - 2 && T >= KEYS[i + 1].t) i++;
      const a = KEYS[i];
      const b = KEYS[i + 1];
      const u = EASE[i]((T - a.t) / (b.t - a.t));
      const w = a.w + (b.w - a.w) * u;
      const lean = a.lean + (b.lean - a.lean) * u;
      lerp3(a.h, b.h, u, hOff);
      lerp3(a.up, b.up, u, uOff).normalize();
      lerp3(a.side, b.side, u, sOff);

      // Repère du geste (monde) : F vers la caméra (horizontal), R à droite de l'écran, U en haut.
      model.updateMatrixWorld(true);
      upper.getWorldPosition(S);
      F.subVectors(camera.position, S).setY(0).normalize();
      R.crossVectors(U, F).normalize();
      const sc = model.getWorldScale(scale).y;

      // Buste penché (autour de son X local = axe des épaules) et tête qui suit.
      chest.quaternion.copy(baseChest).multiply(q.setFromAxisAngle(x.set(1, 0, 0), lean * w));
      head.quaternion.copy(baseHead).multiply(q.setFromAxisAngle(x.set(1, 0, 0), 0.6 * lean * w));
      wrist.quaternion.copy(baseWrist);
      model.updateMatrixWorld(true);
      upper.getWorldPosition(S); // l'épaule a bougé avec le buste

      // Main visée et coude (IK à deux os, coude tiré vers l'arrière-bas-extérieur).
      const reach = Math.min(hOff.length(), (L1 + L2) * 0.995);
      H.copy(S).addScaledVector(R, hOff.x * sc).addScaledVector(U, hOff.y * sc).addScaledVector(F, hOff.z * sc);
      d.subVectors(H, S);
      const D = Math.min(d.length() / sc, reach) || 1e-3;
      d.normalize();
      const cosA = THREE.MathUtils.clamp((L1 * L1 + D * D - L2 * L2) / (2 * L1 * D), -1, 1);
      const sinA = Math.sqrt(1 - cosA * cosA);
      P.copy(S).addScaledVector(R, 0.5 * sc).addScaledVector(U, -0.3 * sc).addScaledVector(F, -0.3 * sc);
      perp.subVectors(P, S);
      perp.addScaledVector(d, -perp.dot(d)).normalize();
      E.copy(S).addScaledVector(d, L1 * cosA * sc).addScaledVector(perp, L1 * sinA * sc);
      H.copy(S).addScaledVector(d, D * sc);

      aim(d.subVectors(E, S), perp, qWorld);
      setBone(upper, qWorld, w);
      aim(d.subVectors(H, E), perp, qWorld);
      setBone(lower, qWorld, w);
      setBone(wrist, qWorld, w); // poignet dans l'axe de l'avant-bras

      // Main : haut du manche vers `uOff`, lame vers `sOff` (rendue perpendiculaire au manche).
      qSlot.copy(slot.quaternion).multiply(scythe.quaternion);
      upH.set(0, 1, 0).applyQuaternion(qSlot);
      sideH.set(1, 0, 0).applyQuaternion(qSlot);
      handBasisInv.makeBasis(sideH, upH, z.crossVectors(sideH, upH)).invert();
      upW.copy(R).multiplyScalar(uOff.x).addScaledVector(U, uOff.y).addScaledVector(F, uOff.z).normalize();
      sideW.copy(R).multiplyScalar(sOff.x).addScaledVector(U, sOff.y).addScaledVector(F, sOff.z);
      sideW.addScaledVector(upW, -sideW.dot(upW)).normalize();
      if (sideW.lengthSq() < 1e-6) sideW.copy(F);
      z.crossVectors(sideW, upW);
      qWorld.setFromRotationMatrix(m.makeBasis(sideW, upW, z).multiply(handBasisInv));
      setBone(hand, qWorld, w);
    },
  };
}
