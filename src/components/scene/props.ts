/**
 * Objets 3D construits dans le code, habillés EXACTEMENT comme les modèles KayKit : mêmes atlas
 * de couleurs (Halloween Bits, Dungeon, Skeletons), même principe de dégradé vertical par
 * cellule (clair en haut, sombre en bas), mêmes matériaux. Formes inspirées des références :
 * chaudron rempli de bonbons, cadeaux à gros nœuds, chapeaux de sorcière, faux, robe de la faucheuse,
 * mains squelettes, toiles et araignées.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createBladeBloodMaterial, dripGeometry } from "./blood";
import { seeded } from "./core";

/** Atlas Halloween Bits (colonne, ligne) — grille 8 × 4 de dégradés verticaux. */
export const CELL = {
  black: [0, 0], charcoal: [1, 0], slate: [2, 0], steel: [3, 0], ice: [4, 0], terracotta: [5, 0], rust: [6, 0], ember: [7, 0],
  orange: [0, 1], gold: [1, 1], cream: [2, 1], peach: [3, 1], bone: [4, 1], tan: [5, 1], stone: [6, 1], mud: [7, 1],
  green: [0, 2], teal: [1, 2], lime: [2, 2], pine: [3, 2], tangerine: [4, 2], pink: [5, 2], red: [6, 2], magenta: [7, 2],
  white: [0, 3], flame: [2, 3],
} as const satisfies Record<string, readonly [number, number]>;

/** Atlas Dungeon (colonne, ligne). */
export const DCELL = {
  slate: [0, 0], steel: [1, 0], terracotta: [2, 0], black: [3, 0], wood: [4, 0], stone: [5, 0], ember: [6, 0], taupe: [7, 0],
  white: [0, 1], tan: [1, 1], blueGrey: [2, 1], violet: [3, 1], magenta: [4, 1], teal: [5, 1], lime: [6, 1], peach: [7, 1],
  mint: [0, 2], green: [1, 2], pink: [2, 2], red: [3, 2], orange: [4, 2], yellow: [5, 2], sky: [6, 2], sunset: [7, 2],
  cream: [0, 3], gold: [1, 3], blue: [2, 3], sea: [3, 3], emerald: [4, 3],
} as const satisfies Record<string, readonly [number, number]>;

export type Cell = keyof typeof CELL;
type CellRef = Cell | readonly [number, number];

/** Convertit les attributs quantifiés (int16 normalisés) en float32 pour pouvoir transformer / fusionner. */
export function toFloat(geo: THREE.BufferGeometry) {
  for (const name of Object.keys(geo.attributes)) {
    const a = geo.getAttribute(name) as THREE.BufferAttribute;
    if (a.array instanceof Float32Array && !a.normalized) continue;
    const out = new Float32Array(a.count * a.itemSize);
    for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = a.getComponent(i, k);
    geo.setAttribute(name, new THREE.BufferAttribute(out, a.itemSize));
  }
  return geo;
}

/**
 * Peint une géométrie avec une cellule d'atlas : u fixe dans la cellule, v selon la hauteur
 * (haut = clair, bas = sombre), comme sur les modèles KayKit.
 */
export function paint(geo: THREE.BufferGeometry, cell: CellRef, range?: { min: number; max: number }, uIn = 0.3) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const [col, row] = typeof cell === "string" ? CELL[cell] : cell;
  const pos = g.attributes.position;
  let min = range?.min ?? Infinity;
  let max = range?.max ?? -Infinity;
  if (!range) {
    for (let i = 0; i < pos.count; i++) {
      min = Math.min(min, pos.getY(i));
      max = Math.max(max, pos.getY(i));
    }
  }
  const uv = new Float32Array(pos.count * 2);
  const u = (col + uIn) / 8;
  for (let i = 0; i < pos.count; i++) {
    const t = max > min ? THREE.MathUtils.clamp((max - pos.getY(i)) / (max - min), 0, 1) : 0.5;
    uv[i * 2] = u;
    uv[i * 2 + 1] = (row * 256 + 14 + t * 228) / 1024;
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return g;
}

/** Place une géométrie (position + rotation + échelle) avant fusion. */
export function placed(geo: THREE.BufferGeometry, pos: [number, number, number], rot: [number, number, number] = [0, 0, 0], scale: [number, number, number] = [1, 1, 1]) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...scale));
  return (geo.index ? geo.toNonIndexed() : geo).applyMatrix4(m);
}

/** Fusionne des géométries peintes (attributs position, normal, uv). */
export function merge(parts: THREE.BufferGeometry[]) {
  const clean = parts.map((p) => {
    const g = p.index ? p.toNonIndexed() : p;
    for (const k of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    return g;
  });
  return mergeGeometries(clean)!;
}

/** Boîte aux arêtes arrondies (l'allure « jouet » des modèles KayKit). */
export function roundedBox(w: number, h: number, d: number, r: number, segments = 2) {
  const s = new THREE.Shape();
  const x = -w / 2 + r;
  const y = -h / 2 + r;
  s.moveTo(x, y);
  s.lineTo(x + w - 2 * r, y);
  s.lineTo(x + w - 2 * r, y + h - 2 * r);
  s.lineTo(x, y + h - 2 * r);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: d - 2 * r, bevelEnabled: true, bevelSize: r, bevelThickness: r, bevelSegments: segments, curveSegments: 2 });
  g.translate(0, 0, -(d - 2 * r) / 2);
  g.computeVertexNormals();
  return g;
}

/** Ruban plat qui suit une courbe (tube aplati) : boucles et pans des nœuds. */
function ribbon(points: [number, number, number][], width: number, thickness: number) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  return new THREE.TubeGeometry(curve, 28, thickness, 8, false).scale(1, 1, width / thickness);
}

// ---------------------------------------------------------------------------
// Main squelette : doigts vers -Y, paume vers +Z. Phalanges articulées.
// ---------------------------------------------------------------------------

const phalanxCache = new Map<number, THREE.BufferGeometry>();
function phalanx(len: number) {
  let g = phalanxCache.get(len);
  if (!g) {
    g = merge([
      paint(new THREE.CylinderGeometry(0.013, 0.016, len, 7).translate(0, -len / 2, 0), "cream", { min: -len, max: 0.02 }),
      paint(new THREE.SphereGeometry(0.02, 8, 6), "cream", { min: -0.02, max: 0.02 }),
      paint(new THREE.SphereGeometry(0.016, 8, 6).translate(0, -len, 0), "cream", { min: -len - 0.02, max: -len + 0.02 }),
    ]);
    phalanxCache.set(len, g);
  }
  return g;
}

export type BoneHand = {
  root: THREE.Group;
  /**
   * curl : 0 main ouverte → 1 poing fermé. spread : écartement des doigts.
   * wave / phase : ondulation des doigts l'un après l'autre (frotter, gratter).
   */
  pose(curl: number, spread?: number, thumb?: number, wave?: number, phase?: number): void;
  /**
   * Poing refermé sur un manche de rayon `radius` (repère de la main). Le manche traverse la paume
   * en diagonale (prise de force) : direction (cos slant, -sin slant, 0), plus près du poignet côté
   * auriculaire. Chaque phalange se plie jusqu'à toucher le manche (contact sans interpénétration,
   * calculé), les doigts légèrement décalés et plus ou moins serrés ; le pouce s'enroule dans
   * l'autre sens. Renvoie un point de l'axe du manche (repère de la main), au milieu du poing.
   */
  grip(radius: number, slant?: number): THREE.Vector3;
};

/** Prise de la faux : hauteur de l'axe du manche (repère de la main, jointures à -0,19) et du pouce. */
const GRIP_Y = -0.18;
const THUMB_Y = -0.08;

export function createBoneHand(mat: THREE.Material, forearm = false): BoneHand {
  const root = new THREE.Group();
  const xs = [-0.05, -0.017, 0.017, 0.05];
  const parts: THREE.BufferGeometry[] = [paint(roundedBox(0.14, 0.06, 0.055, 0.02).translate(0, -0.03, 0), "cream")];
  xs.forEach((x) => parts.push(paint(new THREE.CylinderGeometry(0.013, 0.017, 0.13, 7).rotateZ(x * 0.8).translate(x * 1.1, -0.12, 0), "cream")));
  if (forearm) {
    for (const x of [-0.03, 0.032]) parts.push(paint(new THREE.CylinderGeometry(0.022, 0.03, 0.62, 7).translate(x, 0.31, -0.005), "cream"));
    parts.push(paint(new THREE.SphereGeometry(0.055, 9, 7).scale(1.25, 0.8, 1).translate(0, 0.64, 0), "cream"));
  }
  root.add(new THREE.Mesh(merge(parts), mat));
  const lengths = [0.07, 0.05, 0.036];
  // Auriculaire, annulaire, majeur, index : l'index est du côté du pouce (+x), comme sur une main gauche.
  const scales = [0.82, 1, 1.08, 1];
  const fingers = xs.map((x, f) => {
    const chain: THREE.Group[] = [];
    let parent: THREE.Object3D = root;
    lengths.forEach((len, k) => {
      const pivot = new THREE.Group();
      pivot.position.set(k === 0 ? x * 1.15 : 0, k === 0 ? -0.19 : -lengths[k - 1] * scales[f], 0);
      pivot.add(new THREE.Mesh(phalanx(len * scales[f]), mat));
      parent.add(pivot);
      chain.push(pivot);
      parent = pivot;
    });
    return chain;
  });
  const thumb: THREE.Group[] = [];
  let tp: THREE.Object3D = root;
  [0.06, 0.045, 0.035].forEach((len, k) => {
    const pivot = new THREE.Group();
    if (k === 0) {
      pivot.position.set(0.075, -0.06, 0.02);
      pivot.rotation.set(0, -0.5, 0.75);
    } else pivot.position.set(0, -[0.06, 0.045][k - 1], 0);
    pivot.add(new THREE.Mesh(phalanx(len), mat));
    tp.add(pivot);
    thumb.push(pivot);
    tp = pivot;
  });
  return {
    root,
    pose(curl, spread = 0.1, thumbCurl = curl, wave = 0, phase = 0) {
      fingers.forEach((chain, f) =>
        chain.forEach((p, k) => {
          p.rotation.x = -(curl + wave * Math.sin(phase - f * 0.9)) * [0.9, 1.1, 0.8][k];
          if (k === 0) p.rotation.z = (f - 1.5) * spread;
        }),
      );
      thumb.forEach((p, k) => k > 0 && (p.rotation.x = -thumbCurl * 0.7));
    },
    grip(radius, slant = 0) {
      const dir = new THREE.Vector3(Math.cos(slant), -Math.sin(slant), 0);
      // Le manche repose sur les jointures de la base (sphères de 0,02) et le creux de la paume.
      const center = new THREE.Vector3(0.016, GRIP_Y, radius + 0.0205);
      const inv = new THREE.Matrix4();
      const p = new THREE.Vector3();
      const q = new THREE.Vector3();
      root.updateMatrixWorld(true);
      inv.copy(root.matrixWorld).invert();
      /** Écart entre la surface d'une phalange (os effilé, sphère au bout) et celle du manche. */
      const clearance = (pivot: THREE.Object3D, len: number, endR: number) => {
        pivot.updateWorldMatrix(true, false); // parents compris : leurs rotations viennent peut-être de changer
        const m = inv.clone().multiply(pivot.matrixWorld);
        let min = Infinity;
        for (let i = 1; i <= 12; i++) {
          const t = i / 12;
          p.set(0, -len * t, 0).applyMatrix4(m).sub(center);
          q.copy(p).addScaledVector(dir, -p.dot(dir));
          // Os : 0,013 au départ, 0,016 au bout (cylindre à 7 pans : faces planes à 0,9 × le rayon).
          const boneR = t === 1 ? endR : (0.013 + 0.003 * t) * 0.95;
          min = Math.min(min, q.length() - radius - boneR);
        }
        return min;
      };
      /**
       * Plie une phalange (rotation x = sign × θ, θ de -0,4 à 1,75 rad) jusqu'au contact (écart `gap`) ;
       * sans contact possible, garde la flexion la plus proche du manche.
       */
      const bend = (pivot: THREE.Object3D, len: number, endR: number, sign: number, gap: number) => {
        let prev = -0.4;
        let best = prev;
        let bestD = Infinity;
        for (let th = -0.4; th <= 1.75; th += 0.02) {
          pivot.rotation.x = sign * th;
          const d = clearance(pivot, len, endR);
          if (d < bestD) [bestD, best] = [d, th];
          if (d <= gap) {
            let lo = prev, hi = th;
            for (let k = 0; k < 18; k++) {
              const mid = (lo + hi) / 2;
              pivot.rotation.x = sign * mid;
              if (clearance(pivot, len, endR) > gap) lo = mid;
              else hi = mid;
            }
            pivot.rotation.x = sign * lo;
            return;
          }
          prev = th;
        }
        pivot.rotation.x = sign * best;
      };
      // Doigts : plans presque perpendiculaires au manche (inclinés de 80 % de la diagonale), léger
      // éventail ; serrage un peu différent d'un doigt à l'autre (écart de 0 à 0,6 mm à l'échelle 1).
      const fan = [0.05, 0.02, 0, -0.03];
      const snug = [0.0006, 0.0003, 0.0001, 0.0002];
      fingers.forEach((chain, f) => {
        chain.forEach((piv, k) => {
          piv.rotation.set(0, 0, k === 0 ? -slant * 0.8 + fan[f] : 0);
        });
        chain.forEach((piv, k) => bend(piv, lengths[k] * scales[f], k < 2 ? 0.02 : 0.016, -1, snug[f]));
      });
      // Pouce : part du coin de la paume, côté index, vers l'avant du manche, puis s'enroule
      // dans l'autre sens que les doigts (opposé), pulpe contre le manche.
      // Position et orientation du premier os choisies (recherche exhaustive) pour que les deux
      // phalanges suivantes se posent sur le manche sans le traverser, avec la flexion la plus douce.
      let best = { y: THUMB_Y, x: 0, z: 0, sign: 1 };
      let bestScore = Infinity;
      const solveThumb = (c: typeof best) => {
        thumb[0].position.set(0.09, c.y, 0.03);
        thumb[0].rotation.set(c.x, 0, c.z);
        thumb[1].rotation.set(0, 0, 0);
        thumb[2].rotation.set(0, 0, 0);
        bend(thumb[1], 0.045, 0.02, c.sign, 0.0003);
        bend(thumb[2], 0.035, 0.016, c.sign, 0.0003);
      };
      for (const ty of [THUMB_Y, THUMB_Y - 0.02, THUMB_Y - 0.04])
        for (let tz = -slant - 0.4; tz <= -slant + 0.41; tz += 0.1)
          for (let tx = -1.6; tx <= 0.8; tx += 0.06)
            for (const sign of [1, -1]) {
              const c = { y: ty, x: tx, z: tz, sign };
              solveThumb(c);
              const c0 = clearance(thumb[0], 0.06, 0.02);
              const c1 = clearance(thumb[1], 0.045, 0.02);
              const c2 = clearance(thumb[2], 0.035, 0.016);
              const pen = Math.max(0, -c0) + Math.max(0, -c1) + Math.max(0, -c2);
              // Pouce enroulé : les deux phalanges touchent le manche et se plient chacune un peu.
              const curl = Math.max(0, 0.3 - Math.abs(thumb[1].rotation.x)) + Math.max(0, 0.3 - Math.abs(thumb[2].rotation.x));
              const score = pen * 1000 + Math.abs(c1 - 0.0003) * 50 + Math.abs(c2 - 0.0003) * 100 + curl * 0.2;
              if (score < bestScore) [bestScore, best] = [score, c];
            }
      solveThumb(best);
      return center.clone();
    },
  };
}

/**
 * Bras squelette « de personnage », vu comme dans un jeu (le bras entre par le bas de l'écran) :
 * main droite articulée, poignet (carpes), avant-bras à deux os (radius côté pouce, épais au
 * poignet ; ulna côté auriculaire, épaisse au coude avec l'olécrane qui pointe derrière le coude),
 * coude (condyles de l'humérus) et bras (humérus) jusqu'à l'épaule, hors champ.
 */
export type SkeletonArm = {
  root: THREE.Group;
  /**
   * wrist : poignet ; fingers : direction des doigts ; palm : normale de la paume (vers le mur) ;
   * elbow : coude ; shoulder : épaule (hors champ). Repère du groupe parent.
   */
  place(wrist: THREE.Vector3, fingers: THREE.Vector3, palm: THREE.Vector3, elbow: THREE.Vector3, shoulder: THREE.Vector3): void;
  pose: BoneHand["pose"];
};

/** Os long tourné (longueur 1 le long de +Y, rayon 1) d'après un profil [rayon, hauteur]. */
function longBone(profile: number[][]) {
  return paint(new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), 9), "cream", { min: 1, max: 0 });
}

export function createSkeletonArm(mat: THREE.Material, scale: number): SkeletonArm {
  const root = new THREE.Group();
  const hand = createBoneHand(mat, false);
  // Carpes : deux rangées de petits os entre la paume et l'avant-bras (repère de la main : +y vers le bras).
  const carpals: THREE.BufferGeometry[] = [];
  [-0.042, -0.014, 0.014, 0.042].forEach((x, i) => carpals.push(paint(roundedBox(0.026, 0.024, 0.04, 0.008).translate(x, 0.014 + (i % 2) * 0.004, 0), "cream")));
  [-0.026, 0, 0.026].forEach((x) => carpals.push(paint(roundedBox(0.024, 0.022, 0.038, 0.008).translate(x, 0.04, 0), "cream")));
  hand.root.add(new THREE.Mesh(merge(carpals), mat));
  root.add(hand.root);

  // Os longs, de longueur 1 le long de +Y (du poignet vers le coude, du coude vers l'épaule).
  // Radius : large tête au poignet, diaphyse fine, petite tête en disque au coude.
  const radiusGeo = longBone([[0, 0], [0.85, 0.004], [1.0, 0.03], [0.78, 0.09], [0.5, 0.22], [0.44, 0.6], [0.46, 0.86], [0.66, 0.92], [0.66, 0.97], [0, 1]]);
  // Ulna : fine au poignet (petite tête), qui s'épaissit jusqu'au coude.
  const ulnaGeo = longBone([[0, 0], [0.5, 0.004], [0.6, 0.04], [0.42, 0.12], [0.46, 0.4], [0.62, 0.72], [0.9, 0.92], [1.0, 0.98], [0, 1]]);
  // Humérus : condyles larges au coude, diaphyse fine, tête ronde à l'épaule.
  const humerusGeo = longBone([[0, 0], [0.8, 0.01], [1.0, 0.05], [0.72, 0.12], [0.5, 0.24], [0.44, 0.55], [0.5, 0.82], [0.85, 0.93], [0.9, 0.97], [0, 1]]);
  const bone = (g: THREE.BufferGeometry) => {
    const m = new THREE.Mesh(g, mat);
    m.frustumCulled = false;
    root.add(m);
    return m;
  };
  const radius = bone(radiusGeo);
  const ulna = bone(ulnaGeo);
  const humerus = bone(humerusGeo);
  // Coude : poulie de l'humérus (trochlée + capitulum) le long de l'axe de la charnière,
  // épicondyles saillants à ses deux bouts, olécrane (crochet de l'ulna) derrière le coude.
  const knob = paint(new THREE.SphereGeometry(1, 10, 8), "cream", { min: -1, max: 1 });
  const trochlea = bone(paint(new THREE.CylinderGeometry(1, 1, 1, 10).rotateZ(Math.PI / 2), "cream", { min: -1, max: 1 }));
  const epicondyles = [bone(knob), bone(knob)];
  const olecranon = bone(paint(new THREE.SphereGeometry(1, 10, 8).scale(0.8, 1.25, 0.8), "cream", { min: -1, max: 1 }));
  const shoulderHead = bone(knob);

  const s = scale;
  const R_FORE = 0.05 * s; // rayon de référence des os de l'avant-bras
  const R_HUM = 0.062 * s; // rayon de référence de l'humérus (aux condyles)
  const SEP_WRIST = 0.05 * s;
  const SEP_ELBOW = 0.075 * s;
  const basis = new THREE.Matrix4();
  const x = new THREE.Vector3();
  const y = new THREE.Vector3();
  const z = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const side = new THREE.Vector3();
  const hinge = new THREE.Vector3();
  const back = new THREE.Vector3();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const stretch = (m: THREE.Mesh, from: THREE.Vector3, to: THREE.Vector3, r: number) => {
    m.position.copy(from);
    m.quaternion.setFromUnitVectors(up, b.subVectors(to, from).normalize());
    m.scale.set(r, from.distanceTo(to), r);
  };

  return {
    root,
    place(wrist, fingers, palm, elbow, shoulder) {
      // Main droite : axes du modèle (doigts -y, paume +z), miroir en x (le modèle est une main gauche).
      y.copy(fingers).negate().normalize();
      z.copy(palm).addScaledVector(y, -palm.dot(y)).normalize();
      x.crossVectors(y, z);
      basis.makeBasis(x, y, z);
      hand.root.position.copy(wrist);
      hand.root.quaternion.setFromRotationMatrix(basis);
      hand.root.scale.set(-s, s, s);

      // Avant-bras : du poignet (un peu en retrait, sous les carpes) jusqu'au coude.
      dir.subVectors(elbow, wrist).normalize();
      side.crossVectors(dir, palm).normalize();
      if (side.lengthSq() < 1e-6) side.copy(x);
      const start = wrist.clone().addScaledVector(dir, 0.045 * s);
      // Charnière du coude : perpendiculaire au plan bras / avant-bras ; « back » pointe derrière
      // le coude (à l'opposé du pli), là où ressort l'olécrane.
      a.subVectors(shoulder, elbow).normalize();
      hinge.crossVectors(dir, a);
      if (hinge.lengthSq() < 1e-6) hinge.copy(side);
      hinge.normalize();
      back.addVectors(dir, a).negate();
      if (back.lengthSq() < 1e-6) back.crossVectors(hinge, dir);
      back.normalize();
      // Radius côté pouce (à gauche de la main droite, paume au mur), ulna côté auriculaire.
      // Au coude, les deux os s'emboîtent sous les condyles, un peu en retrait de la charnière.
      const foreEnd = elbow.clone().addScaledVector(dir, 0.04 * s);
      const pair: [THREE.Mesh, number][] = [[radius, -1], [ulna, 1]];
      for (const [m, k] of pair) {
        const from = start.clone().addScaledVector(side, (k * SEP_WRIST) / 2);
        const to = foreEnd.clone().addScaledVector(side, (k * SEP_ELBOW) / 2);
        stretch(m, from, to, R_FORE);
      }
      // Olécrane : derrière le coude, au bout de l'ulna.
      olecranon.position.copy(elbow).addScaledVector(side, SEP_ELBOW / 2).addScaledVector(back, 0.045 * s);
      olecranon.quaternion.setFromUnitVectors(up, dir.clone().negate());
      olecranon.scale.setScalar(0.042 * s);
      // Humérus : des condyles (juste au-dessus de la charnière) jusqu'à l'épaule.
      stretch(humerus, elbow.clone().addScaledVector(a, -0.02 * s), shoulder, R_HUM);
      // Poulie et épicondyles le long de la charnière.
      trochlea.position.copy(elbow);
      trochlea.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), hinge);
      trochlea.scale.set(0.15 * s, 0.045 * s, 0.045 * s);
      epicondyles.forEach((m, i) => {
        m.position.copy(elbow).addScaledVector(hinge, (i ? 1 : -1) * 0.08 * s).addScaledVector(a, 0.03 * s);
        m.scale.setScalar((i ? 0.036 : 0.03) * s);
      });
      shoulderHead.position.copy(shoulder);
      shoulderHead.scale.setScalar(0.09 * s);
    },
    pose: hand.pose,
  };
}

// ---------------------------------------------------------------------------
// Faucheuse : faux (manche, poignée transversale, grande lame) et robe jusqu'au sol.
// ---------------------------------------------------------------------------

/**
 * Faux, centrée sur le manche ; la lame se recourbe au-dessus de la tête (atlas Dungeon).
 * `grip` : hauteur (sur le manche) et taille du poing qui la tient : le manche y est gainé de cuir.
 */
export function createScythe(mat: THREE.Material, length: number, grip?: { y: number; h: number }, blood?: { value: number }) {
  const r = length * 0.017;
  const L = length * 0.55;
  const blade = new THREE.Shape();
  blade.moveTo(0, L * 0.05);
  blade.quadraticCurveTo(L * 0.5, L * 0.22, L * 1.05, -L * 0.3);
  blade.quadraticCurveTo(L * 0.48, -L * 0.02, 0, -L * 0.08);
  blade.closePath();
  const bladeGeo = new THREE.ExtrudeGeometry(blade, { depth: L * 0.025, bevelEnabled: true, bevelSize: L * 0.012, bevelThickness: L * 0.012, bevelSegments: 2, curveSegments: 12 });
  bladeGeo.computeVertexNormals();
  const g = new THREE.Group();
  g.add(
    new THREE.Mesh(
      merge([
        paint(new THREE.CylinderGeometry(r, r * 1.15, length, 8), DCELL.wood),
        // Poignée transversale (comme sur la référence)
        paint(new THREE.CylinderGeometry(r * 0.85, r * 0.85, length * 0.16, 8).rotateZ(Math.PI / 2).translate(0, length * 0.08, 0), DCELL.wood),
        paint(new THREE.CylinderGeometry(r * 1.5, r * 1.5, length * 0.03, 8).translate(length * 0.08, length * 0.08, 0), DCELL.black),
        paint(new THREE.CylinderGeometry(r * 1.6, r * 1.6, length * 0.05, 8).translate(0, length * 0.47, 0), DCELL.black),
        paint(bladeGeo, DCELL.steel).translate(0, length * 0.47, -L * 0.012),
        // Poignée de cuir sous les doigts, cerclée de fer de part et d'autre du poing.
        ...(grip
          ? [
              paint(new THREE.CylinderGeometry(r * 1.12, r * 1.12, grip.h, 8).translate(0, grip.y, 0), DCELL.black),
              ...[1, -1].map((k) => paint(new THREE.CylinderGeometry(r * 1.4, r * 1.4, grip.h * 0.08, 8).translate(0, grip.y + (k * grip.h) / 2, 0), DCELL.steel)),
            ]
          : []),
      ]),
      mat,
    ),
  );
  if (blood) {
    // Lame ensanglantée : fluide animé en shader sur les deux faces du plat (blood.ts), avec, sous le
    // tranchant, une « jupe » dans le plan de la lame où pendent les gouttes (face avant seulement).
    const spine = (t: number) => {
      const u = 1 - t;
      return { x: 2 * u * t * L * 0.5 + t * t * L * 1.05, y: u * u * L * 0.05 + 2 * u * t * L * 0.22 - t * t * L * 0.3 };
    };
    const cut = (t: number) => {
      const u = 1 - t;
      return { x: 2 * u * t * L * 0.48 + t * t * L * 1.05, y: -u * u * L * 0.08 - 2 * u * t * L * 0.02 - t * t * L * 0.3 };
    };
    const skirt = L * 0.32;
    const outline = new THREE.Shape();
    const top = Array.from({ length: 21 }, (_, i) => {
      const t = i / 20;
      const s = spine(t);
      const e = cut(t);
      return { x: s.x + (e.x - s.x) * 0.05, y: s.y + (e.y - s.y) * 0.05 }; // en retrait du biseau
    });
    outline.moveTo(top[0].x, top[0].y);
    top.forEach((q) => outline.lineTo(q.x, q.y));
    for (let i = 20; i >= 0; i--) {
      const e = cut(i / 20);
      outline.lineTo(e.x + (i === 20 ? L * 0.03 : 0), e.y - skirt);
    }
    outline.closePath();
    const flat = new THREE.ShapeGeometry(outline, 1);
    // Le shader lit la position dans le repère de la forme : le placement se fait sur le maillage.
    const back = flat.clone().scale(1, 1, -1);
    for (const [geo, zOff, skirted] of [[flat, L * 0.037 + 0.004, true], [back, -L * 0.012 - 0.004, false]] as const) {
      const m = new THREE.Mesh(geo, createBladeBloodMaterial(L, blood, skirted));
      m.position.set(0, length * 0.47, zOff - L * 0.012);
      m.renderOrder = 2;
      g.add(m);
    }
  }
  return g;
}

/**
 * Mains de la faucheuse : les moufles grises du squelette KayKit (gants du « Rogue ») sont masquées
 * et remplacées par des mains squelette. La gauche est refermée sur le manche de la faux : le manche
 * passe dans le creux des doigts repliés, pouce vers le bas, la main dans le prolongement de
 * l'avant-bras (vue de dessus). La droite pend, doigts à demi repliés.
 * La faux et la main gauche suivent l'os de la main (gestes compris). Repère : celui du modèle,
 * pose de repos déjà appliquée (mixer.update), hauteur du modèle `height`.
 */
export function armReaper(model: THREE.Object3D, scytheMat: THREE.Material, boneMat: THREE.Material, height: number, blood?: { value: number }): THREE.Group | null {
  const K = 1.3; // taille des mains squelette (la main de createBoneHand fait 0,26 de long)
  let scytheOut: THREE.Group | null = null;
  model.updateMatrixWorld(true);
  const local = (name: string) => {
    const o = model.getObjectByName(name);
    return o ? model.worldToLocal(o.getWorldPosition(new THREE.Vector3())) : null;
  };
  // Bras du modèle (moufles, manchettes et sangles du « Rogue ») masqués : les manches de la robe
  // couvrent l'avant-bras jusqu'au poignet, les mains squelette en sortent.
  model.traverse((o) => {
    if (/Arm(Left|Right)/.test(o.name)) o.visible = false;
  });

  const up = new THREE.Vector3(0, 1, 0);
  const basis = (x: THREE.Vector3, y: THREE.Vector3) => {
    const z = new THREE.Vector3().crossVectors(x, y).normalize();
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  };

  // --- Main gauche + faux ---
  const slot = model.getObjectByName("handslotl") ?? model.getObjectByName("handslot.l");
  const wrist = local("handl");
  const wristJoint = local("wristl");
  const elbow = local("lowerarml");
  if (slot && wrist && wristJoint && elbow) {
    // Le manche, vertical, passe dans le poing. L'avant-bras descend vers la main : la main le suit
    // en partie (le poignet reste presque dans son axe) et le manche traverse la paume en diagonale,
    // comme dans une vraie prise de force (au plus 0,4 rad ; le reste en légère inclinaison du poignet).
    const fore = wristJoint.clone().sub(elbow);
    const out = fore.clone().setY(0).normalize();
    const slant = Math.min(0.4, Math.max(0, Math.atan2(-fore.y, Math.hypot(fore.x, fore.z))));
    const y = out.clone().negate(); // repère de la main : +y vers le poignet
    // Pouce vers le bas : de face, on voit le dos de la main et les jointures autour du manche.
    const q = basis(up.clone().negate(), y).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), slant));
    const length = height * 1.3;
    const gripH = 0.2 * K;
    const scythe = (scytheOut = createScythe(scytheMat, length, { y: -height * 0.2, h: gripH }, blood));
    // Poing refermé sur la gaine de cuir (rayon du manche × 1,12, cf. createScythe) ; point de l'axe
    // au milieu de la largeur des doigts et du pouce (x de -0,08 à 0,11 dans le repère de la main).
    const hand = createBoneHand(boneMat);
    const fist = hand.grip((length * 0.017 * 1.12) / K, slant);
    const grip = wrist.clone().add(fist.multiplyScalar(K).applyQuaternion(q));
    const center = grip.clone().addScaledVector(up, height * 0.2); // milieu du manche
    // Axes de la faux = axes du modèle (pose de repos) ; elle est accrochée à l'os de la main.
    const toSlot = slot.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(model.getWorldQuaternion(new THREE.Quaternion()));
    scythe.quaternion.copy(toSlot);
    scythe.position.copy(slot.worldToLocal(model.localToWorld(center.clone())));
    slot.add(scythe);
    hand.root.position.copy(wrist).sub(center);
    hand.root.quaternion.copy(q);
    hand.root.scale.setScalar(K);
    scythe.add(hand.root);
  }

  // --- Main droite : pend au bout du bras, paume vers la cuisse ---
  const handR = model.getObjectByName("handr");
  const wristR = local("handr");
  const jointR = local("wristr");
  if (handR && wristR && jointR) {
    const y = jointR.clone().sub(wristR).normalize(); // vers le poignet
    const toBody = new THREE.Vector3(1, 0, 0);
    const palm = toBody.addScaledVector(y, -toBody.dot(y)).normalize();
    const x = new THREE.Vector3().crossVectors(y, palm);
    const hand = createBoneHand(boneMat);
    hand.pose(0.45, 0.12, 0.3);
    const holder = new THREE.Group();
    holder.position.copy(wristR);
    holder.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, palm));
    hand.root.scale.set(-K, K, K); // main droite : miroir de la main gauche du modèle
    holder.add(hand.root);
    // Accrochée à l'os de la main (repère du modèle → repère de l'os).
    model.add(holder);
    model.updateMatrixWorld(true);
    handR.attach(holder);
  }
  return scytheOut;
}

/**
 * Robe longue qui tombe jusqu'au sol (cache les jambes du squelette KayKit), ourlet déchiré
 * qui ondule. Peinte avec la même cellule que la capuche (atlas Skeletons recoloré).
 */
export function createRobeSkirt(map: THREE.Texture | null, time: { value: number }, top: number, height: number) {
  const mat = new THREE.MeshLambertMaterial({ map, side: THREE.DoubleSide });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.vertexShader =
      "uniform float uTime;\n" +
      shader.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        float h = clamp(-transformed.y / ${height.toFixed(3)}, 0.0, 1.0);
        float ang = atan(transformed.z, transformed.x);
        transformed.x += sin(uTime * 1.6 + ang * 3.0) * 0.035 * h * h;
        transformed.z += cos(uTime * 1.2 + ang * 2.0) * 0.035 * h * h;`,
      );
  };
  mat.customProgramCacheKey = () => `robe-${height.toFixed(3)}`;
  const segs = 16;
  const profile = [
    [top * 0.95, 0.04], [top * 1.08, -height * 0.15], [top * 1.25, -height * 0.45], [top * 1.45, -height * 0.78], [top * 1.6, -height],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const geo = new THREE.LatheGeometry(profile.reverse(), segs);
  // Ourlet déchiré : un pan sur deux remonte un peu.
  const pos = geo.attributes.position;
  const n = profile.length;
  for (let i = 0; i <= segs; i++) {
    const idx = i * n; // premier point du profil inversé = ourlet
    const up = (i % segs) % 2 ? height * 0.12 : 0;
    pos.setY(idx, pos.getY(idx) + up);
  }
  geo.computeVertexNormals();
  return new THREE.Mesh(paint(geo, [2, 2], { min: -height, max: 0.05 }), mat);
}

/**
 * Haut de la robe (référence Focheuse.png) : buste fermé (plus de côtes visibles), à accrocher
 * à l'os `spine`, et grandes manches évasées (os `upperarm` / `lowerarm`) d'où ne sortent
 * que les mains. Même cellule d'atlas que la jupe : la robe est d'un seul tenant.
 */
export function createRobeTop(map: THREE.Texture | null) {
  const mat = new THREE.MeshLambertMaterial({ map, side: THREE.DoubleSide });
  const cell = [2, 2] as const;
  const lathe = (pts: [number, number][], segs: number) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), segs);
  // Buste : des hanches (raccord avec la jupe) aux épaules, col fermé sous la capuche.
  const torsoGeo = lathe([[0.37, -0.22], [0.35, -0.02], [0.33, 0.22], [0.32, 0.4], [0.26, 0.52], [0.15, 0.6], [0.08, 0.63]], 14).scale(1, 1, 0.82);
  torsoGeo.computeVertexNormals();
  const torso = new THREE.Mesh(paint(torsoGeo, cell, { min: -0.6, max: 0.63 }), mat);
  // Manches : haut du bras étroit, avant-bras très évasé (la main sort du « cloche »).
  const upperGeo = lathe([[0.16, 0.27], [0.15, 0.12], [0.14, -0.04]], 10);
  upperGeo.computeVertexNormals();
  const foreGeo = lathe([[0.3, 0.37], [0.24, 0.26], [0.18, 0.1], [0.16, -0.04]], 10);
  // Ourlet de manche déchiré, comme le bas de la robe.
  const fp = foreGeo.attributes.position;
  for (let i = 0; i < fp.count; i++) if (fp.getY(i) > 0.33 && Math.round(Math.atan2(fp.getZ(i), fp.getX(i)) * 1.6) % 2) fp.setY(i, fp.getY(i) - 0.05);
  foreGeo.computeVertexNormals();
  const sleeve = (geo: THREE.BufferGeometry) => new THREE.Mesh(paint(geo, cell, { min: -0.4, max: 0.3 }), mat);
  return { torso, upperSleeve: () => sleeve(upperGeo), foreSleeve: () => sleeve(foreGeo) };
}

// ---------------------------------------------------------------------------
// Chaudron : marmite noire bien ronde, anses, pieds en bois, remplie de bonbons à ras bord
// (rien d'autre dedans : un lit de bonbons emballés sur plusieurs couches, fond sombre).
// Une main squelette en sort de temps en temps, fouille, attrape un bonbon et replonge ; les
// bonbons autour sont bousculés (petite physique : poussée, chute, glissade sur le dôme, culbute).
// ---------------------------------------------------------------------------

/** Teintes des bonbons, prises dans les atlas KayKit (posées sur une cellule claire). */
const CANDY_TINTS = ["#f37b2f", "#9b59d0", "#e2c93f", "#f06a7a", "#2bb5ad", "#d42c3c", "#ffffff"];

/** Hauteur (repère du chaudron) du centre d'un bonbon posé en surface, à la distance d de l'axe : dôme bombé. */
const candySurface = (d: number) => 1.02 + 0.15 * Math.sqrt(Math.max(0, 1 - (d / 0.62) ** 2));
const CANDY_RIM = 0.44; // centres des bonbons : l'ouverture fait 0,53, un bonbon en travers déborde de 0,08
const RIM_TANGENT = 0.3; // au-delà, les bonbons se couchent le long de la paroi (jamais à travers)
const HAND_SCALE = 0.85;
const HAND_RISE = 0.36; // poignet au-dessus de la surface, bras tendu
const HAND_DOWN = -0.78; // poignet enfoui (bout des doigts sous les bonbons)
const LEAN = 0.28; // inclinaison du bras vers la gauche de l'écran (rad)
const ARM_R = 0.16; // rayon d'encombrement de l'avant-bras (+ un demi-bonbon)
const PUSH_R = 0.3; // rayon de la poussée sur les bonbons voisins
const G = 9;

/** Phases du cycle de la main : durée en secondes (l'attente est tirée au sort). */
const HAND_PHASES = [
  ["rise", 1.1],
  ["search", 1.7],
  ["grab", 0.5],
  ["sink", 0.9],
] as const;
type HandPhase = (typeof HAND_PHASES)[number][0] | "hidden";

const easeOut = (t: number) => 1 - (1 - t) ** 3;
const easeIn = (t: number) => t * t * t;

type Candy = {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  rx: number; rz: number; // repos (surface)
  q: THREE.Quaternion;
  s: number;
};

export type Cauldron = { group: THREE.Group; glow: THREE.Vector3; update(t: number, dt: number, camWorld: THREE.Vector3): void };

export function createCauldron(mat: THREE.Material, candyMat: THREE.Material, bloodMat?: THREE.Material, opts = { low: false, animate: true }): Cauldron {
  const group = new THREE.Group();
  const r = seeded(13);
  if (bloodMat) {
    // Sang qui déborde : coulures qui descendent du rebord sur la panse.
    const drips = [0.2, 1.7, 3.4, 5.2].map((a, i) => ({ x: Math.cos(a) * 0.69, y: 1.09, z: Math.sin(a) * 0.69, len: [0.3, 0.2, 0.36, 0.14][i], r: 0.032 }));
    group.add(new THREE.Mesh(dripGeometry(drips), bloodMat));
  }
  const pot = new THREE.LatheGeometry(
    [[0, 0.16], [0.32, 0.18], [0.58, 0.32], [0.72, 0.56], [0.72, 0.82], [0.62, 1.0], [0.58, 1.04], [0.66, 1.07], [0.67, 1.13], [0.57, 1.15], [0.53, 1.02]].map(
      ([x, y]) => new THREE.Vector2(x, y),
    ),
    22,
  );
  pot.computeVertexNormals();
  // Intérieur : cuve sombre (profil parcouru de haut en bas : faces tournées vers l'axe), que l'on
  // devine entre les bonbons, à l'ombre.
  const bowl = new THREE.LatheGeometry([[0.56, 1.05], [0.52, 0.9], [0.4, 0.74], [0.18, 0.62], [0, 0.6]].map(([x, y]) => new THREE.Vector2(x, y)), 22);
  bowl.computeVertexNormals();
  const parts = [
    paint(pot, DCELL.black),
    paint(bowl, DCELL.black, { min: 3, max: 4 }), // bas de la cellule : le plus sombre
    ...[-1, 1].map((s) => paint(placed(new THREE.TorusGeometry(0.15, 0.04, 8, 16), [s * 0.74, 0.86, 0], [0, Math.PI / 2, 0]), DCELL.black)),
    // Pieds : trois bâtons de bois écartés
    ...[0, 1, 2].map((i) => {
      const a = (i / 3) * Math.PI * 2 + 0.3;
      const leg = new THREE.CylinderGeometry(0.045, 0.04, 0.62, 7);
      return paint(placed(leg, [Math.cos(a) * 0.42, 0.22, Math.sin(a) * 0.42], [Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35]), DCELL.wood);
    }),
  ];
  group.add(new THREE.Mesh(merge(parts), mat));

  const wrapped = merge([
    paint(new THREE.SphereGeometry(0.07, 10, 7).scale(1.45, 1, 1), "ice"),
    paint(new THREE.ConeGeometry(0.055, 0.08, 6).rotateZ(Math.PI / 2).translate(0.135, 0, 0), "ice"),
    paint(new THREE.ConeGeometry(0.055, 0.08, 6).rotateZ(-Math.PI / 2).translate(-0.135, 0, 0), "ice"),
  ]);

  // Lit de bonbons : grille hexagonale brouillée par couche (la couche du dessus suit le dôme, les
  // couches du dessous bouchent les trous), plus quelques bonbons tombés au pied du chaudron.
  const spots: { x: number; y: number; z: number; top: boolean; yaw: number; tilt: number }[] = [];
  const tangent = (x: number, z: number) => Math.atan2(z, x) + Math.PI / 2;
  (opts.low ? [0, 0.12] : [0, 0.11, 0.22]).forEach((depth, li) => {
    const step = 0.15;
    const rMax = CANDY_RIM - depth * 0.5;
    let row = 0;
    for (let gz = -rMax; gz <= rMax; gz += step * 0.87, row++) {
      for (let gx = -rMax; gx <= rMax; gx += step) {
        const x = gx + (row % 2) * step * 0.5 + (r() - 0.5) * step * 0.5;
        const z = gz + (r() - 0.5) * step * 0.5;
        const d = Math.hypot(x, z);
        if (d > rMax) continue;
        const near = d > RIM_TANGENT;
        spots.push({ x, y: candySurface(d) - depth, z, top: li === 0, yaw: near ? tangent(x, z) + (r() - 0.5) * 0.5 : r() * 6, tilt: near ? 0.3 : 0.7 });
      }
    }
  });
  const OUT = 14;
  for (let i = 0; i < OUT; i++) {
    const a = -0.6 + r() * 2.2;
    const d = 0.95 + r() * 0.7;
    spots.push({ x: Math.cos(a) * d, y: 0.06, z: Math.sin(a) * d, top: false, yaw: r() * 6, tilt: 0.7 });
  }
  const candies = new THREE.InstancedMesh(wrapped, candyMat, spots.length);
  const tmp = new THREE.Object3D();
  const color = new THREE.Color();
  const dyn: { i: number; c: Candy }[] = [];
  spots.forEach((p, i) => {
    tmp.position.set(p.x, p.y, p.z);
    tmp.rotation.set((r() - 0.5) * p.tilt, p.yaw, (r() - 0.5) * p.tilt); // posés à plat, comme versés
    tmp.scale.setScalar(0.85 + r() * 0.3);
    tmp.updateMatrix();
    candies.setMatrixAt(i, tmp.matrix);
    candies.setColorAt(i, color.set(CANDY_TINTS[Math.floor(r() * CANDY_TINTS.length)]));
    if (p.top) dyn.push({ i, c: { x: p.x, y: p.y, z: p.z, vx: 0, vy: 0, vz: 0, rx: p.x, rz: p.z, q: tmp.quaternion.clone(), s: tmp.scale.x } });
  });
  group.add(candies);

  // --- Main squelette (avec avant-bras), doigts vers le haut, paume vers la caméra ---
  const pivot = new THREE.Group();
  const hand = createBoneHand(candyMat, true); // os « crème » : cellule de l'atlas Halloween Bits
  hand.root.rotation.z = Math.PI; // doigts -y → +y
  hand.root.scale.setScalar(HAND_SCALE);
  hand.root.visible = false;
  pivot.add(hand.root);
  group.add(pivot);

  let phase: HandPhase = "hidden";
  let phaseT = 0;
  let phaseLen = 3;
  let step = -1;
  const spot = new THREE.Vector3();
  let surfaceY = candySurface(0);
  let wristY = HAND_DOWN;
  let handVy = 0;
  let settleUntil = 0; // après un cycle, le lit continue de se tasser un moment
  const local = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const axis = new THREE.Vector3();

  const startCycle = (cam: THREE.Vector3) => {
    // Sort dans la moitié gauche de l'ouverture (vue de la caméra), paume tournée vers elle,
    // bras penché vers la gauche : (dx, dz) pointe vers la caméra, (-dz, dx) vers la gauche de l'écran.
    local.copy(cam);
    group.worldToLocal(local);
    const d = Math.hypot(local.x, local.z) || 1;
    const dx = local.x / d;
    const dz = local.z / d;
    spot.set(dx * 0.08 - dz * 0.1, 0, dz * 0.08 + dx * 0.1);
    surfaceY = candySurface(Math.hypot(spot.x, spot.z));
    // Pivot posé à la surface des bonbons : l'inclinaison tourne autour du point de sortie (le
    // poignet reste dans l'ouverture ; sous la surface, le bras penche dans l'autre sens, invisible).
    pivot.position.set(spot.x, surfaceY, spot.z);
    pivot.rotation.set(0, Math.atan2(dx, dz), LEAN);
    step = 0;
    phase = HAND_PHASES[0][0];
    phaseLen = HAND_PHASES[0][1];
    phaseT = 0;
    hand.root.visible = true;
  };

  const stepHand = (t: number, dt: number, cam: THREE.Vector3) => {
    phaseT += dt;
    if (phase === "hidden") {
      if (phaseT >= phaseLen) startCycle(cam);
      return;
    }
    if (phaseT >= phaseLen) {
      step++;
      if (step >= HAND_PHASES.length) {
        phase = "hidden";
        phaseLen = 6 + Math.random() * 5;
        phaseT = 0;
        hand.root.visible = false;
        handVy = 0;
        settleUntil = t + 16;
        return;
      }
      phase = HAND_PHASES[step][0];
      phaseLen = HAND_PHASES[step][1];
      phaseT = 0;
    }
    const k = Math.min(1, phaseT / phaseLen);
    const prevY = wristY;
    let curl = 1;
    let wave = 0;
    let sway = 0;
    let lean = LEAN;
    if (phase === "rise") {
      // Poing qui force vers le haut, s'ouvre en sortant.
      wristY = surfaceY + HAND_DOWN + (HAND_RISE - HAND_DOWN) * easeOut(k);
      curl = 0.95 - 0.7 * easeOut(Math.max(0, (k - 0.35) / 0.65));
      sway = Math.sin(t * 11) * 0.04 * (1 - k);
    } else if (phase === "search") {
      wristY = surfaceY + HAND_RISE + 0.025 * Math.sin(t * 2.6);
      curl = 0.25 + 0.1 * Math.sin(t * 3);
      wave = 0.4;
      sway = Math.sin(t * 1.7) * 0.28;
      lean = LEAN + 0.1 * Math.sin(t * 1.3);
    } else if (phase === "grab") {
      wristY = surfaceY + HAND_RISE - 0.06 * easeOut(k);
      curl = 0.3 + 0.7 * easeOut(k);
      sway = 0.28 * Math.sin(t * 1.7) * (1 - k);
    } else {
      wristY = surfaceY + HAND_RISE - 0.06 + (HAND_DOWN - HAND_RISE + 0.06) * easeIn(k);
      curl = 1;
      sway = 0.35 * k;
      lean = LEAN + 0.22 * k; // replonge en s'inclinant encore vers la gauche
    }
    handVy = dt > 0 ? (wristY - prevY) / dt : 0;
    hand.root.position.y = wristY - surfaceY;
    hand.root.rotation.y = sway;
    pivot.rotation.z = lean;
    hand.pose(curl, 0.14, curl, wave, t * 9);
  };

  const stepCandies = (dt: number) => {
    const active = phase !== "hidden";
    const hx = spot.x;
    const hz = spot.z;
    const handTop = wristY + 0.62 * HAND_SCALE;
    for (const { i, c } of dyn) {
      let ax = 0;
      let az = 0;
      const dcx = c.x - hx;
      const dcz = c.z - hz;
      const dh = Math.hypot(dcx, dcz) || 1e-3;
      if (active && c.y < handTop + 0.1 && dh < PUSH_R) {
        const kk = 1 - dh / PUSH_R;
        ax += (dcx / dh) * kk * 50;
        az += (dcz / dh) * kk * 50;
        // Bonbons posés sur le poing : un peu soulevés avec lui, puis ils roulent de côté.
        if (handVy > 0) c.vy = Math.max(c.vy, Math.min(1.1, handVy * kk * 0.45));
        if (dh < ARM_R) {
          // Jamais dans l'avant-bras : repoussés hors de la colonne.
          c.x = hx + (dcx / dh) * ARM_R;
          c.z = hz + (dcz / dh) * ARM_R;
          c.vx += (dcx / dh) * 0.4;
          c.vz += (dcz / dh) * 0.4;
        }
        // Le bras replonge : les voisins s'effondrent vers le trou.
        if (phase === "sink" && dh > ARM_R) {
          ax -= (dcx / dh) * kk * 25;
          az -= (dcz / dh) * kk * 25;
        }
      }
      if (!active) {
        // Le lit se tasse doucement vers sa forme de départ (invisible, évite la dérive au fil des cycles).
        const kr = Math.min(1, dt * 0.25);
        c.x += (c.rx - c.x) * kr;
        c.z += (c.rz - c.z) * kr;
      }
      c.vx += ax * dt;
      c.vz += az * dt;
      c.vy -= G * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.z += c.vz * dt;
      // Surface du lit : contact, rebond amorti, frottement, glissade vers le bord du dôme.
      let dc = Math.hypot(c.x, c.z);
      if (dc > CANDY_RIM) {
        c.x *= CANDY_RIM / dc;
        c.z *= CANDY_RIM / dc;
        const vr = (c.vx * c.x + c.vz * c.z) / CANDY_RIM;
        if (vr > 0) {
          c.vx -= (c.x / CANDY_RIM) * vr * 1.2;
          c.vz -= (c.z / CANDY_RIM) * vr * 1.2;
        }
        dc = CANDY_RIM;
      }
      const h = candySurface(dc);
      if (c.y <= h) {
        c.y = h;
        if (c.vy < 0) c.vy = -c.vy * 0.2;
        const fr = Math.max(0, 1 - dt * 6);
        c.vx *= fr;
        c.vz *= fr;
        if (dc > 0.02) {
          const slope = (0.15 * dc) / (0.62 * 0.62) / Math.sqrt(Math.max(0.05, 1 - (dc / 0.62) ** 2));
          c.vx += (c.x / dc) * slope * G * 0.35 * dt;
          c.vz += (c.z / dc) * slope * G * 0.35 * dt;
        }
        const sp = Math.hypot(c.vx, c.vz);
        if (sp < 0.03 && Math.abs(c.vy) < 0.05) c.vx = c.vz = c.vy = 0;
      }
      // Près de la paroi : se couche le long d'elle (un bonbon radial entrerait dans la lèvre).
      if (dc > RIM_TANGENT) c.q.slerp(q.setFromAxisAngle(axis.set(0, 1, 0), tangent(c.x, c.z)), Math.min(1, dt * 4));
      // Contrainte stricte : le bout du bonbon (demi-longueur 0,175 selon son axe x) reste dans l'ouverture (0,53).
      if (dc > 0.2) {
        axis.set(1, 0, 0).applyQuaternion(c.q);
        const reach = 0.175 * c.s * Math.abs((axis.x * c.x + axis.z * c.z) / dc) + 0.07 * c.s;
        const maxC = 0.52 - reach;
        if (dc > maxC) {
          c.x *= maxC / dc;
          c.z *= maxC / dc;
        }
      }
      // Culbute : roule dans le sens où il glisse.
      const sp = Math.hypot(c.vx, c.vz);
      if (sp > 1e-3) {
        axis.set(-c.vz / sp, 0, c.vx / sp);
        c.q.premultiply(q.setFromAxisAngle(axis, (sp * dt) / 0.07));
      }
      tmp.position.set(c.x, c.y, c.z);
      tmp.quaternion.copy(c.q);
      tmp.scale.setScalar(c.s);
      tmp.updateMatrix();
      candies.setMatrixAt(i, tmp.matrix);
    }
    candies.instanceMatrix.needsUpdate = true;
  };

  return {
    group,
    glow: new THREE.Vector3(0, 1.5, 0),
    update(t, dt, cam) {
      if (!opts.animate) return;
      const d = Math.min(dt, 1 / 30);
      stepHand(t, d, cam);
      if (phase !== "hidden" || t < settleUntil) stepCandies(d);
    },
  };
}

// ---------------------------------------------------------------------------
// Cadeaux (références) : boîtes arrondies, ruban, gros nœud à boucles bien rondes.
// ---------------------------------------------------------------------------

export function createGift(mat: THREE.Material, w: number, h: number, d: number, box: readonly [number, number], band: readonly [number, number], bow = 1) {
  const bw = Math.min(w, d) * 0.2;
  const s = Math.min(w, d) * 0.55 * bow;
  const parts = [
    paint(roundedBox(w, h, d, Math.min(w, h, d) * 0.12, 3).translate(0, h / 2, 0), box),
    paint(roundedBox(w + 0.03, h + 0.03, bw, 0.02, 1).translate(0, h / 2, 0), band),
    paint(roundedBox(bw, h + 0.03, d + 0.03, 0.02, 1).translate(0, h / 2, 0), band),
  ];
  // Deux boucles, un nœud central, deux pans
  const loop: [number, number, number][] = [[0, 0, 0], [0.18, 0.2, 0], [0.42, 0.34, 0], [0.62, 0.26, 0], [0.62, 0.08, 0], [0.42, -0.02, 0], [0.16, 0, 0], [0, 0, 0]];
  const loopGeo = ribbon(loop.map(([x, y, z]) => [x * s, y * s, z * s]), bw * 1.05, s * 0.05);
  for (const side of [-1, 1]) {
    parts.push(paint(placed(loopGeo.clone(), [0, h + s * 0.05, 0], [0, side > 0 ? 0.15 : Math.PI - 0.15, 0.12]), band));
    const tail: [number, number, number][] = [[0, 0, 0], [0.12 * s, -0.06 * s, 0.05 * s], [0.22 * s, -0.16 * s, 0.1 * s], [0.3 * s, -0.22 * s, 0.12 * s]];
    parts.push(paint(placed(ribbon(tail, bw * 0.9, s * 0.04), [0, h + s * 0.02, 0], [0, side > 0 ? -0.5 : Math.PI + 0.5, 0]), band));
  }
  parts.push(paint(new THREE.SphereGeometry(s * 0.13, 12, 9).scale(1, 0.8, 1.3).translate(0, h + s * 0.07, 0), band));
  const g = new THREE.Group();
  g.add(new THREE.Mesh(merge(parts), mat));
  return g;
}

// ---------------------------------------------------------------------------
// Chapeau de sorcière (références) : facettes marquées, pointe recourbée, large bord ondulé,
// bande violette et boucle dorée.
// ---------------------------------------------------------------------------

export function createWitchHat(mat: THREE.Material, opts: { height?: number; radius?: number; brim?: number; bend?: number; seed?: number } = {}) {
  const { height = 1, radius = 0.34, brim = 0.78, bend = 0.35, seed = 1 } = opts;
  const rnd = seeded(seed);
  const seg = 9;
  const rings = 9;
  // Cône qui se courbe vers le haut (pointe tombante)
  const verts: number[] = [];
  const ring = (k: number) => {
    const t = k / rings;
    const rad = radius * Math.pow(1 - t, 1.05) * (k === 0 ? 1 : 1 + (rnd() - 0.5) * 0.06);
    const cx = bend * height * Math.pow(t, 2.6);
    const cy = height * t - bend * height * 0.35 * Math.pow(t, 3);
    return Array.from({ length: seg }, (_, j) => {
      const a = (j / seg) * Math.PI * 2;
      return new THREE.Vector3(cx + Math.cos(a) * rad, cy, Math.sin(a) * rad);
    });
  };
  const all = Array.from({ length: rings + 1 }, (_, k) => ring(k));
  for (let k = 0; k < rings; k++)
    for (let j = 0; j < seg; j++) {
      const a = all[k][j], b = all[k][(j + 1) % seg], c = all[k + 1][(j + 1) % seg], d = all[k + 1][j];
      verts.push(...a.toArray(), ...c.toArray(), ...b.toArray(), ...a.toArray(), ...d.toArray(), ...c.toArray());
    }
  const crown = new THREE.BufferGeometry();
  crown.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  crown.computeVertexNormals();

  const brimGeo = new THREE.LatheGeometry(
    [[radius * 0.9, 0.035], [brim * 0.6, 0.02], [brim, -0.035], [brim * 1.01, -0.065], [brim * 0.6, -0.02], [radius * 0.9, -0.005]].map(([x, y]) => new THREE.Vector2(x, y)),
    seg * 2,
  );
  const bp = brimGeo.attributes.position;
  for (let i = 0; i < bp.count; i++) {
    const x = bp.getX(i);
    const z = bp.getZ(i);
    const d = Math.hypot(x, z) / brim;
    bp.setY(i, bp.getY(i) + Math.sin(Math.atan2(z, x) * 3 + seed) * 0.03 * d * d);
  }
  brimGeo.computeVertexNormals();
  const bandGeo = new THREE.CylinderGeometry(radius * 0.88, radius * 1.01, height * 0.14, seg, 1, true).translate(0, height * 0.075, 0);
  const bw = height * 0.13;
  const buckle = [
    roundedBox(bw, bw * 0.22, 0.03, 0.008, 1).translate(0, bw / 2 - bw * 0.11, 0),
    roundedBox(bw, bw * 0.22, 0.03, 0.008, 1).translate(0, -bw / 2 + bw * 0.11, 0),
    roundedBox(bw * 0.22, bw, 0.03, 0.008, 1).translate(bw / 2 - bw * 0.11, 0, 0),
    roundedBox(bw * 0.22, bw, 0.03, 0.008, 1).translate(-bw / 2 + bw * 0.11, 0, 0),
  ].map((g) => paint(g.translate(0, height * 0.075, radius * 0.97), DCELL.gold));
  const g = new THREE.Group();
  g.add(new THREE.Mesh(merge([paint(crown, DCELL.black), paint(brimGeo, DCELL.black), paint(bandGeo, DCELL.violet), ...buckle]), mat));
  return g;
}

// ---------------------------------------------------------------------------
// Toiles d'araignée en 3D : fils fins qui s'affaissent, légère respiration (vertex shader).
// ---------------------------------------------------------------------------

export function webMaterial(map: THREE.Texture | null, time: { value: number }) {
  const m = new THREE.MeshLambertMaterial({ map, transparent: true, opacity: 0.9 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.vertexShader =
      "uniform float uTime;\n" +
      shader.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        float reach = length(transformed.xy);
        transformed.z += sin(uTime * 1.3 + transformed.x * 2.1 + transformed.y * 1.7) * 0.035 * reach;`,
      );
  };
  m.customProgramCacheKey = () => "kaykit-web";
  return m;
}

/**
 * Toile « en quart de cercle » tendue dans un angle : origine au coin, fils vers +X et -Y.
 * Les rayons partent en retrait des deux appuis et la toile se bombe vers +Z : seuls les bouts
 * des fils touchent les supports (jamais une toile plaquée contre un mur).
 */
export function createWebGeometry(size: number, seed = 1) {
  const r = seeded(seed);
  const rays = 7;
  const angles = Array.from({ length: rays }, (_, i) => 0.14 + (i / (rays - 1)) * (Math.PI / 2 - 0.28));
  const thick = size * 0.006;
  const tubes: THREE.BufferGeometry[] = [];
  const thread = (pts: THREE.Vector3[], t = thick) => {
    tubes.push(paint(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), Math.max(4, pts.length * 3), t, 3, false), "ice", { min: -size, max: size }));
  };
  const at = (a: number, d: number, sag = 0) =>
    new THREE.Vector3(Math.cos(a) * d, -Math.sin(a) * d - sag, (r() - 0.5) * size * 0.04 + Math.sin(Math.min(1, d / size) * Math.PI) * size * 0.14);
  const len = angles.map(() => size * (0.88 + r() * 0.2));
  angles.forEach((a, i) => thread([0, 0.33, 0.66, 1].map((k) => at(a, len[i] * k, Math.sin(k * Math.PI) * size * 0.03)), thick * 1.3));
  for (let ring = 1; ring <= 7; ring++) {
    const d = size * (0.12 + ring * 0.11) * (1 + (r() - 0.5) * 0.06);
    for (let i = 0; i < rays - 1; i++) {
      if (d > Math.min(len[i], len[i + 1]) * 0.98 || r() < 0.06) continue;
      const mid = (angles[i] + angles[i + 1]) / 2;
      thread([at(angles[i], d), at(mid, d * 0.9, size * 0.025 * (ring / 7)), at(angles[i + 1], d)]);
    }
  }
  const loose = at(angles[3], len[3] * 0.7);
  thread([loose, loose.clone().add(new THREE.Vector3(size * 0.05, -size * 0.25, 0)), loose.clone().add(new THREE.Vector3(size * 0.02, -size * 0.45, 0))], thick * 0.8);
  return merge(tubes);
}

// ---------------------------------------------------------------------------
// Araignée (corps + 8 pattes articulées), couleurs de l'atlas.
// ---------------------------------------------------------------------------

export type Spider = { root: THREE.Group; update(t: number, moving: number): void };

export function createSpider(mat: THREE.Material, eyeMat: THREE.Material): Spider {
  const root = new THREE.Group();
  root.add(
    new THREE.Mesh(
      merge([
        paint(new THREE.SphereGeometry(0.12, 12, 9).scale(1, 0.85, 1.25).translate(0, 0.02, -0.13), "charcoal"),
        paint(new THREE.SphereGeometry(0.075, 10, 8).translate(0, 0, 0.05), "charcoal"),
        paint(new THREE.SphereGeometry(0.035, 8, 6).scale(1, 0.4, 1.4).translate(0, 0.115, -0.13), "red"),
      ]),
      mat,
    ),
  );
  for (const x of [-0.03, 0.03]) {
    const eye = new THREE.Mesh(paint(new THREE.SphereGeometry(0.015, 6, 5), "red"), eyeMat);
    eye.position.set(x, 0.03, 0.11);
    root.add(eye);
  }
  const upperGeo = paint(new THREE.CylinderGeometry(0.012, 0.016, 0.17, 5).translate(0, 0.085, 0), "charcoal");
  const lowerGeo = paint(new THREE.CylinderGeometry(0.006, 0.012, 0.22, 5).translate(0, 0.11, 0), "charcoal");
  const legs: { upper: THREE.Group; knee: THREE.Group; phase: number }[] = [];
  for (const side of [-1, 1])
    for (let i = 0; i < 4; i++) {
      const hip = new THREE.Group();
      hip.position.set(side * 0.05, 0, 0.06 - i * 0.05);
      hip.rotation.y = side > 0 ? -(0.9 - i * 0.55) : Math.PI + (0.9 - i * 0.55);
      const upper = new THREE.Group();
      upper.rotation.z = -1.0;
      upper.add(new THREE.Mesh(upperGeo, mat));
      const knee = new THREE.Group();
      knee.position.y = 0.17;
      knee.rotation.z = 2.1;
      knee.add(new THREE.Mesh(lowerGeo, mat));
      upper.add(knee);
      hip.add(upper);
      root.add(hip);
      legs.push({ upper, knee, phase: i * 1.3 + (side > 0 ? 0 : 0.65) });
    }
  return {
    root,
    update(t, moving) {
      legs.forEach((l) => {
        const w = Math.sin(t * (moving ? 14 : 3) + l.phase);
        l.upper.rotation.z = -1.0 + w * (moving ? 0.25 : 0.05);
        l.knee.rotation.z = 2.1 + Math.max(0, -w) * (moving ? 0.35 : 0.06);
      });
    },
  };
}

// ---------------------------------------------------------------------------
// Fantôme (drap) : aucun pack fourni n'en contient ; modelé dans le même style (low-poly, atlas
// Halloween Bits), translucide, ourlet qui ondule, yeux et bouche sombres, halo bleuté.
// ---------------------------------------------------------------------------

export type Ghost = { group: THREE.Group; update(t: number): void };

export function createGhost(map: THREE.Texture | null, glowTex: THREE.Texture, time: { value: number }): Ghost {
  const H = 1.6;
  const mat = new THREE.MeshLambertMaterial({ map, transparent: true, opacity: 0.86, emissive: new THREE.Color("#8fa3ff"), emissiveIntensity: 0.22, side: THREE.DoubleSide });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.vertexShader =
      "uniform float uTime;\n" +
      shader.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        float low = clamp(1.0 - transformed.y / ${(H * 0.45).toFixed(3)}, 0.0, 1.0);
        float ang = atan(transformed.z, transformed.x);
        transformed.x += sin(uTime * 2.2 + ang * 5.0) * 0.05 * low;
        transformed.z += cos(uTime * 1.8 + ang * 4.0) * 0.05 * low;
        transformed.y += sin(uTime * 2.6 + ang * 5.0) * 0.04 * low;`,
      );
  };
  mat.customProgramCacheKey = () => "kaykit-ghost";
  // Drap : tête ronde, épaules, s'évase jusqu'à un ourlet en vagues.
  const body = new THREE.LatheGeometry(
    [[0, H], [0.24, H - 0.04], [0.4, H - 0.15], [0.49, H - 0.35], [0.52, H - 0.6], [0.56, 0.6], [0.64, 0.25], [0.72, 0.02]].reverse().map(([x, y]) => new THREE.Vector2(x, y)),
    20,
  );
  const p = body.attributes.position;
  for (let i = 0; i < p.count; i++) {
    if (p.getY(i) > 0.05) continue;
    const a = Math.atan2(p.getZ(i), p.getX(i));
    p.setY(i, p.getY(i) + (Math.sin(a * 5) * 0.5 + 0.5) * 0.14);
  }
  body.computeVertexNormals();
  // Bras : deux pans de drap qui pendent sur les côtés.
  const arms = [-1, 1].map((s) => paint(placed(new THREE.CapsuleGeometry(0.11, 0.32, 4, 8), [s * 0.56, 0.9, 0.05], [0, 0, s * 0.9]), "white", { min: 0.6, max: 1.2 }));
  const group = new THREE.Group();
  const inner = new THREE.Group(); // drap + visage : flottent ensemble
  group.add(inner);
  inner.add(new THREE.Mesh(merge([paint(body, "white", { min: 0, max: H }), ...arms]), mat));
  // Visage
  const dark = new THREE.MeshBasicMaterial({ color: "#140f1c" });
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), dark);
    eye.scale.set(0.8, 1.25, 0.45);
    eye.position.set(s * 0.17, H - 0.42, 0.485); // à fleur du drap (rayon ≈ 0,5 à cette hauteur)
    inner.add(eye);
  }
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), dark);
  mouth.scale.set(0.9, 1.2, 0.4);
  mouth.position.set(0, H - 0.68, 0.535);
  inner.add(mouth);
  // Halo
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: "#9fb4ff", transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.position.y = H * 0.6;
  halo.scale.setScalar(3.2);
  group.add(halo);
  return {
    group,
    update(t) {
      inner.position.y = Math.sin(t * 1.3) * 0.14;
      inner.rotation.z = Math.sin(t * 0.9) * 0.06;
      halo.material.opacity = 0.3 + Math.sin(t * 1.7) * 0.07;
      halo.position.y = H * 0.6 + inner.position.y;
    },
  };
}
