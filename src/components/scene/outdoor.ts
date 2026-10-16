/**
 * Extérieur.
 *  1. Le cimetière (accueil + questions) : strictement la scène d'origine (même composition,
 *     mêmes lumières, même brume). La crypte est au fond à droite.
 *  2. La clairière de la faucheuse (tirage au sort + remerciements) : au loin, au centre gauche,
 *     derrière le poteau-lanterne, voilée d'une fumée épaisse qui se dissipe quand on arrive.
 *  3. La crypte (résultats) : on y entre par la porte, au fond à droite.
 *
 * Les objets sont placés en coordonnées normalisées (nx : -1 bord gauche, 1 bord droit, à une
 * profondeur donnée) pour que la composition tienne sur un téléphone vertical comme sur un grand écran.
 */
import * as THREE from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";
import { Billboards, flicker, groundHeight, rand, seeded, smooth } from "./core";
import { applyCutGlow, CUT_SHINE_ORDER, JACK_CUT, LANTERN_GLASS } from "./glow";
import { armReaper, createCauldron, createGhost, createGift, createRobeSkirt, createRobeTop, DCELL, merge, toFloat } from "./props";
import type { Area, Flame, Frame, Kit, Pose } from "./types";

export const CAMERA_Z = 12;

type Tag = "jack" | "candle" | "lantern" | "post";
export type Placement = { name: string; nx: number; z: number; s?: number; ry?: number; y?: number; shadow?: boolean; tag?: Tag };
type Placed = { p: Placement; obj: THREE.Group; shadow?: THREE.Mesh; width: number; flames: { flame: Flame; local: THREE.Vector3 }[] };

/** Cadrage de la scène d'origine : premier plan en bas de l'écran, horizon vers les deux tiers. */
export function outdoorPose(f: Frame): Pose {
  const half = THREE.MathUtils.degToRad(f.fov / 2);
  const H = 8.5 * Math.tan(0.62 * half) + 0.2;
  return {
    pos: new THREE.Vector3(0, H, CAMERA_Z),
    target: new THREE.Vector3(0, H + Math.tan(0.32 * half) * CAMERA_Z, 0),
  };
}

/** Demi-largeur visible depuis la caméra de départ, à la profondeur z. */
export const halfWidthAt = (f: Frame, z: number) => f.halfTan * f.aspect * (CAMERA_Z - z);

/** Réglages des flammes, identiques à la scène d'origine (les bougies n'ont qu'un halo). */
const FLAME_CFG: Record<Tag, { local: [number, number, number]; intensity: number; distance: number; glow: number; smoke: number; rise: number; light: boolean; color: string }> = {
  jack: { local: [0, 0.62, 0.15], intensity: 7, distance: 7, glow: 2.2, smoke: 1, rise: 1, light: true, color: "#ff8a2a" },
  candle: { local: [0, 0.85, 0], intensity: 2.2, distance: 3.5, glow: 0.7, smoke: 0.6, rise: 0.7, light: false, color: "#ffb347" },
  lantern: { local: [0, 0.55, 0], intensity: 3.5, distance: 5, glow: 1.3, smoke: 0, rise: 1, light: true, color: "#ff8a2a" },
  post: { local: [0, 2.55, 1.15], intensity: 4, distance: 7, glow: 1.6, smoke: 0, rise: 1, light: true, color: "#ff8a2a" },
};

export function makeFlame(kit: Kit, parent: THREE.Object3D, tag: Tag | "torch" | "wall" | "potion", overrides: Partial<Flame> = {}): Flame {
  const base =
    tag === "torch"
      ? { intensity: 5, distance: 8, glow: 1.3, smoke: 0.5, rise: 0.8, light: true, color: "#ff9a3c" }
      : tag === "wall"
        ? { intensity: 4.5, distance: 7, glow: 0.9, smoke: 0.5, rise: 0.7, light: true, color: "#ffb04a" }
        : tag === "potion"
          ? { intensity: 2, distance: 5, glow: 0, smoke: 0, rise: 1, light: true, color: "#ffd2a6" }
          : FLAME_CFG[tag];
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: kit.glowTex, color: tag === "jack" ? "#ff9a3c" : "#ffc266", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
  );
  parent.add(glow);
  return {
    pos: new THREE.Vector3(),
    color: base.color,
    intensity: base.intensity,
    distance: base.distance,
    seed: rand(0, 50),
    glow,
    glowSize: base.glow,
    scale: 1,
    light: base.light,
    smoke: base.smoke,
    rise: base.rise,
    embers: tag === "jack" || tag === "candle",
    ...overrides,
  };
}

/** Cellule émissive d'un modèle : citrouilles à visage (jamais les citrouilles pleines), lanternes. */
export function cutSpecFor(name: string) {
  if (/jackolantern/.test(name)) return JACK_CUT;
  if (/lantern/.test(name)) return LANTERN_GLASS;
  return null;
}

/** Instancie un modèle KayKit (il garde le matériau / l'atlas de son pack, sauf si mat est donné). */
export function cloneModel(kit: Kit, name: string, mat?: THREE.Material) {
  const tpl = kit.models.get(name);
  if (!tpl) return null;
  const model = tpl.clone();
  if (mat)
    model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) mesh.material = mat;
    });
  const holder = new THREE.Group();
  holder.add(model);
  return holder;
}

function placeAll(kit: Kit, group: THREE.Group, list: Placement[], flames: Flame[]) {
  const shadowMat = new THREE.MeshBasicMaterial({ map: kit.shadowTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const shadowGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const out: Placed[] = [];
  for (const p of list) {
    const obj = cloneModel(kit, p.name);
    if (!obj) continue;
    obj.rotation.y = p.ry ?? 0;
    group.add(obj);
    const size = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());
    const entry: Placed = { p, obj, width: Math.max(size.x, size.z), flames: [] };
    if (p.shadow) {
      entry.shadow = new THREE.Mesh(shadowGeo, shadowMat);
      group.add(entry.shadow);
    }
    if (p.tag) {
      const flame = makeFlame(kit, group, p.tag);
      const local = new THREE.Vector3(...FLAME_CFG[p.tag].local);
      if (p.name === "skull_candle") local.y = 1.3;
      // Découpes des citrouilles-lanternes et vitres des lanternes : émissives, au rythme de la flamme.
      const cut = cutSpecFor(p.name);
      if (cut) flame.cut = applyCutGlow(kit, obj, cut, !kit.low);
      entry.flames.push({ flame, local });
      flames.push(flame);
    }
    out.push(entry);
  }
  return out;
}

/** Pose d'un objet : position au sol, échelle, et mise à jour de ses flammes. */
function setPlaced(pl: Placed, x: number, z: number, scale: number, yOffset = 0) {
  const y = groundHeight(x, z);
  pl.obj.position.set(x, y + yOffset, z);
  pl.obj.scale.setScalar(scale);
  pl.obj.updateMatrixWorld(true);
  if (pl.shadow) {
    pl.shadow.position.set(x, y + 0.03, z);
    pl.shadow.scale.setScalar(pl.width * 1.5 * scale);
  }
  for (const { flame, local } of pl.flames) {
    flame.pos.copy(local).applyMatrix4(pl.obj.matrixWorld);
    flame.glow.position.copy(flame.pos);
    flame.scale = scale;
  }
}

/** Brume au sol (scène d'origine), rebouclée hors champ. */
function makeMist(kit: Kit, group: THREE.Group) {
  const n = kit.low ? 14 : 26;
  const mist = new Billboards(n, kit.smokeTex);
  group.add(mist.mesh);
  kit.mists.push(mist);
  const state = Array.from({ length: n }, () => ({
    nx: rand(-1.3, 1.3), y: rand(0.15, 1.1), z: rand(-15, 5), speed: rand(0.025, 0.06), size: rand(4.5, 9), rot: rand(0, 6.28), spin: rand(-0.04, 0.04), a: rand(0.5, 1),
  }));
  return {
    update(dt: number, f: Frame, moving: boolean) {
      state.forEach((m, i) => {
        if (moving) m.nx += (m.speed * dt * 10) / Math.max(4, halfWidthAt(f, m.z));
        if (m.nx > 1.3) m.nx = -1.3;
        m.rot += m.spin * dt;
        const edge = smooth(1.3, 1.0, Math.abs(m.nx));
        const x = m.nx * halfWidthAt(f, m.z);
        mist.set(i, x, groundHeight(x, m.z) + m.y, m.z, m.a * edge * (m.z > 2 ? 0.55 : 1), m.rot, m.size * (m.z > 0 ? 0.7 : 1));
      });
      mist.commit();
    },
  };
}

function eyeSpotsFrom(list: [number, number, number][], f: Frame, out: THREE.Vector3[]) {
  list.forEach(([nx, y, z], i) => {
    const x = nx * halfWidthAt(f, z) * 0.92;
    (out[i] ??= new THREE.Vector3()).set(x, groundHeight(x, z) + y * f.objScale, z);
  });
}

// ---------------------------------------------------------------------------
// Sol (scène d'origine)
// ---------------------------------------------------------------------------

export function createGround(palette: { ground: string }) {
  const geo = new THREE.PlaneGeometry(140, 70, 70, 35);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, -20);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, groundHeight(x, z));
    const k = 0.82 + 0.18 * Math.sin(x * 0.9 + Math.cos(z * 0.7) * 2) * Math.cos(z * 1.1 - x * 0.3);
    colors.set([k, k, k], i * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ color: palette.ground, vertexColors: true });
  return { mesh: new THREE.Mesh(geo, mat), mat };
}

// ---------------------------------------------------------------------------
// Forêt du fond : des centaines d'arbres KayKit, un InstancedMesh par modèle (quelques appels
// de dessin seulement), noyés dans le brouillard derrière le cimetière et la clairière.
// ---------------------------------------------------------------------------

/** Géométrie d'un modèle (tous ses maillages, dans le repère du modèle), prête à instancier. */
function modelGeometry(kit: Kit, name: string) {
  const tpl = kit.models.get(name);
  if (!tpl) return null;
  tpl.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(tpl.matrixWorld).invert();
  const parts: THREE.BufferGeometry[] = [];
  let mat: THREE.Material | null = null;
  tpl.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    mat ??= m.material as THREE.Material;
    parts.push(toFloat(m.geometry.clone()).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld)));
  });
  return parts.length && mat ? { geo: merge(parts), mat: mat as THREE.Material } : null;
}

const FAR_TREES = ["tree_pine_orange_medium", "tree_pine_yellow_small", "tree_dead_large", "tree_dead_medium"];

function createFarForest(kit: Kit, group: THREE.Group) {
  const rnd = seeded(77);
  const total = kit.low ? 110 : 220;
  // Positions normalisées (nx, z) tirées une fois, dans la zone où le brouillard laisse encore
  // deviner les silhouettes (z de -21 à -36), et sur les bords plus près. On laisse dégagées
  // la crypte (au fond à droite) et la clairière (centre gauche).
  const spots: { nx: number; z: number; s: number; ry: number; type: number }[] = [];
  while (spots.length < total) {
    const edge = rnd() < 0.22;
    const nx = edge ? (rnd() < 0.5 ? -1 : 1) * (0.95 + rnd() * 0.4) : rnd() * 2.7 - 1.35;
    const z = edge ? -10 - rnd() * 14 : -21 - Math.pow(rnd(), 0.7) * 15;
    const s = 1.1 + rnd() * 0.9;
    const ry = rnd() * Math.PI * 2;
    const type = Math.floor(rnd() * FAR_TREES.length);
    if (Math.abs(nx - 0.42) < 0.32 && z > -25.5) continue; // crypte
    if (Math.abs(nx + 0.42) < 0.4 && z > -23) continue; // clairière de la faucheuse
    spots.push({ nx, z, s, ry, type });
  }
  const meshes = FAR_TREES.map((name, type) => {
    const src = modelGeometry(kit, name);
    if (!src) return null;
    const mine = spots.filter((p) => p.type === type);
    const mesh = new THREE.InstancedMesh(src.geo, src.mat, mine.length);
    mesh.frustumCulled = false; // l'étendue de la forêt dépasse la boîte du modèle de base
    group.add(mesh);
    return { mesh, mine };
  });
  const tmp = new THREE.Object3D();
  return {
    layout(f: Frame) {
      for (const m of meshes) {
        if (!m) continue;
        m.mine.forEach((p, i) => {
          const x = p.nx * halfWidthAt(f, p.z);
          tmp.position.set(x, groundHeight(x, p.z) - 0.1, p.z);
          tmp.rotation.set(0, p.ry, 0);
          tmp.scale.setScalar(p.s * f.objScale);
          tmp.updateMatrix();
          m.mesh.setMatrixAt(i, tmp.matrix);
        });
        m.mesh.instanceMatrix.needsUpdate = true;
      }
    },
  };
}

// ---------------------------------------------------------------------------
// 1. Cimetière — composition identique à la scène d'origine
// ---------------------------------------------------------------------------

const GRAVEYARD: Placement[] = [
  // Fond : crypte et arbres, noyés dans le brouillard (silhouettes).
  { name: "crypt", nx: 0.42, z: -20, ry: -0.5 },
  { name: "tree_pine_orange_medium", nx: -0.62, z: -17, s: 1.25, ry: 0.3 },
  { name: "tree_pine_yellow_small", nx: 0.98, z: -15, s: 1.2 },
  { name: "tree_dead_large", nx: -0.18, z: -14, s: 1.35, ry: 0.8 },
  { name: "tree_dead_large", nx: 0.78, z: -22, s: 1.7, ry: -1.2 },
  { name: "tree_pine_orange_medium", nx: -1.0, z: -23, s: 1.6, ry: 1.5 },
  { name: "tree_pine_yellow_small", nx: 0.1, z: -24, s: 1.3 },
  { name: "tree_dead_medium", nx: -0.88, z: -11, s: 1.2, ry: 2 },
  // Milieu : tombes, lanterne sur poteau, cercueil.
  { name: "post_lantern", nx: -0.62, z: -6, ry: 0.3, tag: "post" },
  { name: "gravestone", nx: -0.5, z: -4.5, ry: 0.25, shadow: true },
  { name: "grave_A", nx: 0.52, z: -5.2, ry: -0.35, shadow: true },
  { name: "coffin_decorated", nx: 0.2, z: -5.6, ry: 1.2, shadow: true },
  { name: "gravemarker_A", nx: -0.28, z: -3, ry: -0.2, shadow: true },
  { name: "gravemarker_B", nx: 0.3, z: -2.4, ry: 0.4, shadow: true },
  { name: "gravestone", nx: 0.82, z: -1.5, ry: -0.6, shadow: true },
  { name: "gravemarker_A", nx: -0.75, z: -2, ry: 0.5, shadow: true },
  { name: "tree_dead_small", nx: 0.97, z: -0.5, s: 1.1, ry: -0.4 },
  // Premier plan : deux grappes sur les côtés (le centre reste dégagé pour le texte).
  { name: "pumpkin_orange_jackolantern", nx: -0.8, z: 3.4, s: 0.78, ry: 0.45, shadow: true, tag: "jack" },
  { name: "pumpkin_orange", nx: -0.98, z: 1.6, s: 0.8, ry: 0.2, shadow: true },
  { name: "pumpkin_orange_small", nx: -0.6, z: 4.4, s: 0.8, ry: 1, shadow: true },
  { name: "skull_candle", nx: -0.56, z: 2.2, s: 0.7, ry: 0.4, shadow: true, tag: "candle" },
  { name: "candle_melted", nx: -0.42, z: 3.4, s: 0.7, shadow: true, tag: "candle" },
  { name: "pumpkin_yellow_jackolantern", nx: 0.78, z: 2.8, s: 0.78, ry: -0.5, shadow: true, tag: "jack" },
  { name: "pumpkin_yellow_small", nx: 0.58, z: 4.2, s: 0.8, ry: 0.3, shadow: true },
  { name: "pumpkin_orange_small", nx: 0.95, z: 4.1, s: 0.75, shadow: true },
  { name: "candle_triple", nx: 0.5, z: 2, s: 0.75, shadow: true, tag: "candle" },
  { name: "lantern_standing", nx: 0.97, z: 1.1, s: 0.8, shadow: true, tag: "lantern" },
  { name: "skull", nx: 0.4, z: 4.7, ry: -0.5, s: 0.55, shadow: true },
  { name: "bone_A", nx: -0.2, z: 5.2, ry: 0.7, s: 0.7, y: 0.06 },
];

/** Points sombres où des yeux peuvent s'allumer (nx, hauteur, z) — scène d'origine. */
const GRAVEYARD_EYES: [number, number, number][] = [
  [-0.18, 5.1, -13.4], [0.3, 1.5, -15.2], [-0.62, 0.45, -9.0], [0.62, 0.45, -9.2], [-0.85, 0.5, -6.4],
  [0.95, 0.7, -12], [-0.92, 1.3, -16], [0.25, 0.35, -6.8], [-0.9, 0.35, 0.9], [0.78, 0.4, -3.4],
];

/** Fantôme : à droite de la crypte (nx 0,42, z -20), un peu devant, loin du chemin de la porte. */
const GHOST_SPOT = { nx: 0.7, z: -18, y: 0.7, s: 1.25 };

/** Logo « CHAMAS TACOS » (wordmark) : tout près, à gauche du centre, devant les tombes et derrière les bougies. */
const LOGO_SPOT = { nx: -0.42, z: -1.2, s: 1.5, ry: 0.22 };

/** Porte de la crypte, en coordonnées locales du modèle (face avant = +Z). */
const DOOR_LOCAL = new THREE.Vector3(0, 1.5, 3.2);

export type GraveyardArea = Area & {
  door(): { pos: THREE.Vector3; normal: THREE.Vector3; scale: number };
  /** Lanterne sur poteau : la caméra la dépasse en allant vers la clairière. */
  postLantern(): THREE.Vector3;
  /** Grand arbre mort entre la clairière et la crypte (à contourner par devant). */
  midTree(): THREE.Vector3;
  /** Pose le logo Chamas Tacos (wordmark Halloween) dans le cimetière, une fois le pack chargé. */
  addLogo(): void;
};

export function createGraveyard(kit: Kit): GraveyardArea {
  const group = new THREE.Group();
  const flames: Flame[] = [];
  const placed = placeAll(kit, group, GRAVEYARD, flames);
  const crypt = placed.find((p) => p.p.name === "crypt")!;
  const post = placed.find((p) => p.p.name === "post_lantern")!;
  const midTree = placed.find((p) => p.p.name === "tree_dead_large" && p.p.z === -14)!;
  const mist = makeMist(kit, group);
  const forest = createFarForest(kit, group);
  const ghost = createGhost(kit.modelMat.map, kit.glowTex, kit.time);
  group.add(ghost.group);
  let logo: THREE.Object3D | null = null;
  let frameNow: Frame | null = null;
  const placeLogo = (f: Frame) => {
    if (!logo) return;
    // Au premier plan à gauche, près des citrouilles et des bougies : bien visible sans gêner le texte.
    const z = LOGO_SPOT.z;
    const x = LOGO_SPOT.nx * halfWidthAt(f, z) * 0.92;
    logo.position.set(x, groundHeight(x, z) - 0.04, z);
    logo.scale.setScalar(LOGO_SPOT.s * f.objScale);
  };
  const eyeSpots: THREE.Vector3[] = [];
  const batHome = new THREE.Vector3();
  return {
    name: "graveyard",
    group,
    flames,
    eyeSpots,
    batHome,
    layout(f) {
      frameNow = f;
      forest.layout(f);
      {
        // Fantôme qui flotte à droite de la crypte, tourné vers la caméra.
        const x = GHOST_SPOT.nx * halfWidthAt(f, GHOST_SPOT.z) * 0.92;
        ghost.group.position.set(x, groundHeight(x, GHOST_SPOT.z) + GHOST_SPOT.y * f.objScale, GHOST_SPOT.z);
        ghost.group.scale.setScalar(GHOST_SPOT.s * f.objScale);
        ghost.group.rotation.y = Math.atan2(-x, CAMERA_Z - GHOST_SPOT.z) - 0.25;
      }
      placeLogo(f);
      for (const pl of placed) {
        const { p } = pl;
        setPlaced(pl, p.nx * halfWidthAt(f, p.z) * 0.92, p.z, (p.s ?? 1) * f.objScale, (p.y ?? 0) * f.objScale);
      }
      eyeSpotsFrom(GRAVEYARD_EYES, f, eyeSpots);
      batHome.set(crypt.obj.position.x, 9 * f.objScale, -20);
    },
    pose: outdoorPose,
    update(t, dt, f) {
      mist.update(dt, f, !kit.reduce);
      if (!kit.reduce) ghost.update(t);
    },
    door() {
      return {
        pos: crypt.obj.localToWorld(DOOR_LOCAL.clone()),
        normal: new THREE.Vector3(0, 0, 1).applyQuaternion(crypt.obj.quaternion),
        scale: crypt.obj.scale.x,
      };
    },
    postLantern: () => post.obj.position.clone(),
    midTree: () => midTree.obj.position.clone(),
    addLogo() {
      if (logo) return;
      logo = cloneModel(kit, "chamastacos_wordmark_halloween");
      if (!logo) return;
      logo.rotation.y = LOGO_SPOT.ry;
      group.add(logo);
      if (frameNow) placeLogo(frameNow);
    },
  };
}

// ---------------------------------------------------------------------------
// 2. Clairière de la faucheuse — au loin, au centre gauche, derrière le poteau-lanterne.
// Repère local : x vers la droite de la caméra, z vers la caméra, origine au pied de la faucheuse.
// ---------------------------------------------------------------------------

type Local = {
  name: string;
  x: number;
  z: number;
  s?: number;
  ry?: number;
  tag?: Tag;
  shadow?: boolean;
  /** Socle de la grosse citrouille. */
  pedestal?: boolean;
  /** Position x en format portrait (sinon x, resserré comme le reste de la clairière). */
  px?: number;
  /** Profondeur z en format portrait (sinon z). */
  pz?: number;
};

/** Décor KayKit de la clairière (Halloween Bits, Forest Nature). */
const CLEARING: Local[] = [
  // Arbres morts et rochers qui ferment la clairière
  { name: "Tree_Bare_2_A_Color1", x: -3.5, z: -3.8, s: 1.3, ry: 0.6 },
  { name: "Tree_Bare_1_A_Color1", x: 4.4, z: -7.2, s: 1.5, ry: 2.1 },
  // Rocher de gauche : gros bloc bas (à demi enterré), en retrait, socle de la grosse citrouille-lanterne.
  { name: "Rock_3_E_Color1", x: -1.7, z: -3.0, s: 1.4, ry: 0.9, shadow: true, pedestal: true, px: -0.8, pz: -1.4 },
  { name: "Rock_3_E_Color1", x: 0.5, z: -3.9, s: 1.2, ry: 1.2 },
  { name: "Rock_1_A_Color1", x: 3.7, z: 1.2, s: 1.0, ry: 2.4 },
  { name: "Rock_3_A_Color1", x: -1.2, z: 1.7, s: 0.8, ry: 0.8 },
  { name: "Bush_2_C_Color1", x: -3.4, z: -0.9, s: 1.1 }, // sur le côté : ne cache pas la grosse citrouille
  { name: "Bush_2_C_Color1", x: 3.2, z: -3.3, s: 0.9, ry: 1.4 },
  { name: "Grass_2_B_Color1", x: -0.9, z: 0.9, s: 1.2 },
  { name: "Grass_2_B_Color1", x: 1.6, z: 0.6, s: 1.1, ry: 1 },
  { name: "Grass_1_A_Color1", x: -1.5, z: 0.3, s: 1.3, ry: 2 },
  { name: "Grass_1_A_Color1", x: 0.2, z: -1.6, s: 1.2 },
  { name: "Bush_1_A_Color1", x: 2.6, z: 1.1, s: 2 },
  // Tombes et lueurs
  { name: "gravemarker_B", x: -0.55, z: -2.9, ry: 0.3, shadow: true },
  { name: "grave_B", x: 1.0, z: -4.8, ry: -0.2, shadow: true },
  { name: "candle_triple", x: -1.35, z: 0.7, s: 0.7, tag: "candle", shadow: true },
  { name: "skull_candle", x: -1.75, z: -1.0, s: 0.6, ry: 0.5, tag: "candle", shadow: true },
  // Citrouilles près des cadeaux (comme sur les références)
  { name: "pumpkin_orange_jackolantern", x: 2.95, z: 0.35, s: 0.62, ry: -0.5, tag: "jack", shadow: true },
  { name: "pumpkin_yellow_jackolantern", x: 1.35, z: -1.5, s: 0.55, ry: 0.3, tag: "jack", shadow: true },
  { name: "pumpkin_orange_small", x: 1.85, z: 2.0, s: 0.8, shadow: true },
  { name: "pumpkin_yellow_small", x: 3.3, z: -1.2, s: 0.8, ry: 0.7, shadow: true },
];

type GiftSpec = { x: number; z: number; w: number; h: number; d: number; box: readonly [number, number]; band: readonly [number, number]; ry: number };
/** Cadeaux éparpillés sur la droite (orange / ruban brun, jaune et violet / ruban noir). */
const GIFTS: GiftSpec[] = [
  { x: 1.55, z: 0.55, w: 0.55, h: 0.48, d: 0.55, box: DCELL.ember, band: DCELL.wood, ry: 0.4 },
  { x: 2.25, z: -0.75, w: 0.85, h: 0.95, d: 0.8, box: DCELL.ember, band: DCELL.wood, ry: -0.3 },
  { x: 2.0, z: -2.3, w: 0.7, h: 0.85, d: 0.7, box: DCELL.orange, band: DCELL.black, ry: 0.5 },
  { x: 3.2, z: -2.0, w: 0.75, h: 0.6, d: 0.75, box: DCELL.violet, band: DCELL.black, ry: -0.6 },
  { x: 0.95, z: -2.9, w: 0.5, h: 0.45, d: 0.5, box: DCELL.violet, band: DCELL.black, ry: 0.9 },
  { x: 3.9, z: -3.6, w: 0.9, h: 0.8, d: 0.85, box: DCELL.orange, band: DCELL.black, ry: 0.2 },
  { x: 2.6, z: 1.6, w: 0.45, h: 0.4, d: 0.45, box: DCELL.violet, band: DCELL.black, ry: -0.2 },
];

/** Faucheuse et chaudron (repère local de la clairière) ; cadeaux décalés d'autant vers la droite. */
const REAPER_AT = [1.05, -0.25] as const;
const CAULDRON_AT = [1.0, 1.35] as const;
const GIFTS_SHIFT = 0.45;

const CLEARING_EYES: [number, number][] = [[-2.4, -3.2], [3.6, -4.2], [-3.2, -0.8], [0.6, -5.2], [2.7, -5.6]];

// ---------------------------------------------------------------------------
// Très grosse citrouille-lanterne, posée sur le rocher de gauche, éclairée de l'intérieur.
// ---------------------------------------------------------------------------

/** Échelle de la grosse citrouille : 1,7 m de large pour 1,5 m de haut (les autres font 0,55 à 0,8). */
const BIG_JACK_SCALE = 1.15;
const JACK_FLAME_LOCAL = new THREE.Vector3(...FLAME_CFG.jack.local);

type BigJack = { obj: THREE.Group; flame: Flame };

/**
 * Modèle KayKit `pumpkin_orange_jackolantern` dont les découpes sont émissives (glow.ts : même
 * recette que toutes les citrouilles-lanternes, seconde passe après la fumée toujours active ici,
 * la clairière baignant dans son rideau). La lumière réelle (éclairage du rocher et du sol) vient du
 * pool de lumières, via la flamme « jack », plus forte et prioritaire pour cette grosse citrouille.
 */
function createBigJack(kit: Kit, group: THREE.Group, flames: Flame[]): BigJack | null {
  const obj = cloneModel(kit, "pumpkin_orange_jackolantern");
  if (!obj) return null;
  group.add(obj);
  const flame = makeFlame(kit, group, "jack", { intensity: 9, distance: 11, glowSize: 2.0, priority: 2, color: "#ff7a1a" });
  flame.cut = applyCutGlow(kit, obj, JACK_CUT, true);
  flames.push(flame);
  return { obj, flame };
}

const downRay = new THREE.Raycaster();
/** Point du sommet d'un objet (visée verticale au centre de sa boîte), pour y poser quelque chose. */
function topOf(obj: THREE.Object3D) {
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  const c = box.getCenter(new THREE.Vector3());
  downRay.set(new THREE.Vector3(c.x, box.max.y + 1, c.z), new THREE.Vector3(0, -1, 0));
  const hit = downRay.intersectObject(obj, true)[0];
  return hit ? hit.point.clone() : new THREE.Vector3(c.x, box.max.y, c.z);
}

/** Yeux de la faucheuse : cœur (linéaire, blanc bleuté) et halos [couleur, taille × hauteur, opacité, un par œil]. */
const EYE_CORE: [number, number, number] = [0.78, 0.93, 1.0];
const EYE_HALOS: [string, number, number, boolean][] = [
  ["#e6faff", 0.1, 0.9, true],
  ["#4fcbff", 0.26, 0.75, true],
  ["#1a7dff", 0.8, 0.32, false],
];

export function createReaperClearing(kit: Kit, reaperGltf: GLTF | null): Area {
  const group = new THREE.Group();
  const flames: Flame[] = [];
  const eyeSpots: THREE.Vector3[] = [];
  const batHome = new THREE.Vector3();
  const shadowMat = new THREE.MeshBasicMaterial({ map: kit.shadowTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const shadowGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

  // Décor KayKit
  const items = CLEARING.map((l) => {
    const pl = placeAll(kit, group, [{ name: l.name, nx: 0, z: 0, ry: l.ry, shadow: l.shadow, tag: l.tag }], flames)[0];
    return pl ? { l, pl } : null;
  }).filter((x): x is { l: Local; pl: Placed } => !!x);

  // --- Très grosse citrouille-lanterne sur le rocher de gauche ---
  const rock = items.find((i) => i.l.pedestal)?.pl ?? null;
  const bigJack = createBigJack(kit, group, flames);

  // --- Faucheuse : squelette KayKit à capuche, robe longue jusqu'au sol, faux ---
  const reaper = new THREE.Group();
  group.add(reaper);
  const reaperShadow = new THREE.Mesh(shadowGeo, shadowMat);
  group.add(reaperShadow);
  let mixer: THREE.AnimationMixer | null = null;
  let idle: THREE.AnimationAction | null = null;
  const gestures: THREE.AnimationAction[] = [];
  let modelHeight = 2.3;
  let eyeHalos: THREE.Sprite[] = [];
  let eyeMat: THREE.MeshBasicMaterial | null = null;
  if (reaperGltf) {
    const model = cloneSkinned(reaperGltf.scene);
    // Yeux : lueur spectrale froide — cœur blanc bleuté glacé (couleur linéaire), hors brume,
    // dessinés APRÈS les nappes de fumée (transparents, renderOrder CUT_SHINE_ORDER, comme les
    // découpes des citrouilles de glow.ts) pour ne pas être délavés ; vacillement en update.
    const eyeBasic = (eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(...EYE_CORE), fog: false, transparent: true }));
    let map: THREE.Texture | null = null;
    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const src = m.material as THREE.MeshStandardMaterial;
      map ??= src.map;
      m.material = /Eyes/i.test(m.name) ? eyeBasic : new THREE.MeshLambertMaterial({ map: src.map });
      m.frustumCulled = false;
      if (m.material === eyeBasic) m.renderOrder = CUT_SHINE_ORDER;
      // La robe tombe jusqu'au sol et le buste est fermé (pas de tunique percée sur les côtes).
      if (/Leg|Body/i.test(m.name)) m.visible = false;
    });
    reaper.add(model);
    modelHeight = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()).y;
    mixer = new THREE.AnimationMixer(model);
    const clip = (n: string) => reaperGltf.animations.find((a) => a.name === n);
    const idleClip = clip("Idle");
    if (idleClip) (idle = mixer.clipAction(idleClip)).play();
    for (const n of ["Taunt", "Interact"]) {
      const c = clip(n);
      if (!c) continue;
      const a = mixer.clipAction(c);
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = true;
      gestures.push(a);
    }
    mixer.addEventListener("finished", () => {
      idle?.reset().fadeIn(0.35).play();
      gestures.forEach((g) => g.fadeOut(0.35));
    });
    mixer.update(0.01);
    model.updateMatrixWorld(true);
    // Robe longue accrochée au bassin, jusqu'au sol.
    const hips = model.getObjectByName("hips");
    if (hips) {
      const hipY = hips.getWorldPosition(new THREE.Vector3()).y;
      const skirt = createRobeSkirt(map, kit.time, 0.36, hipY + 0.02);
      skirt.position.y = 0.04;
      hips.add(skirt);
    }
    // Buste et grandes manches de la robe (seuls le crâne et les mains dépassent).
    const top = createRobeTop(map);
    model.getObjectByName("spine")?.add(top.torso);
    for (const side of ["l", "r"]) {
      model.getObjectByName(`upperarm${side}`)?.add(top.upperSleeve());
      model.getObjectByName(`lowerarm${side}`)?.add(top.foreSleeve());
    }
    // Lueur des yeux, accrochée à la tête.
    const head = model.getObjectByName("head");
    const eyes = model.getObjectByName("Skeleton_Rogue_Eyes");
    if (head && eyes) {
      const box = new THREE.Box3().setFromObject(eyes);
      const c = box.getCenter(new THREE.Vector3());
      // Centre de chaque pupille (pose de repos, face à +Z) : mesuré sur capture à 0,44 × la largeur du maillage.
      const dx = (box.max.x - box.min.x) * 0.44;
      // Halos additifs, sans test de profondeur (la lueur « émane » des orbites, par-dessus le crâne) :
      // sur chaque œil un éclat blanc glacé et un halo cyan, puis un grand voile bleu commun.
      eyeHalos = EYE_HALOS.flatMap(([color, size, , perEye]) =>
        (perEye ? [-dx, dx] : [0]).map((x) => {
          const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: kit.glowTex, color, transparent: true, opacity: 0, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, fog: false }));
          sp.position.copy(head.worldToLocal(c.clone().add(new THREE.Vector3(x, 0, 0))));
          sp.scale.setScalar(modelHeight * size);
          sp.renderOrder = CUT_SHINE_ORDER;
          sp.userData.opacity = EYE_HALOS.find((h) => h[0] === color)![2];
          head.add(sp);
          return sp;
        }),
      );
    }
    // Mains squelette (à la place des moufles) ; la gauche serre la faux, tenue droite.
    armReaper(model, kit.dungeonMat, kit.modelMat, modelHeight);
  }
  let nextGesture = 2;
  let gestureIndex = 0;

  // --- Chaudron (juste devant la caméra) ---
  const cauldron = createCauldron(kit.dungeonMat, kit.modelMat);
  group.add(cauldron.group);
  const cauldronShadow = new THREE.Mesh(shadowGeo, shadowMat);
  group.add(cauldronShadow);
  // Lueur chaude (bougies voisines) qui éclaire les bonbons et le visage de la faucheuse.
  const potion = makeFlame(kit, group, "potion", { priority: 3 });
  potion.glow.visible = false;
  flames.push(potion);

  // --- Cadeaux ---
  const gifts = GIFTS.map((g) => {
    const mesh = createGift(kit.dungeonMat, g.w, g.h, g.d, g.box, g.band);
    group.add(mesh);
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    group.add(shadow);
    return { g, mesh, shadow };
  });

  // --- Fumée épaisse autour de la faucheuse (nappe basse) ---
  const SWIRL = kit.low ? 16 : 30;
  const swirl = new Billboards(SWIRL, kit.smokeTex);
  group.add(swirl.mesh);
  kit.mists.push(swirl);
  const swirlState = Array.from({ length: SWIRL }, (_, i) => ({ a0: (i / SWIRL) * Math.PI * 2, offset: Math.random(), life: rand(10, 16), speed: rand(0.03, 0.07), r: rand(0.7, 1.4) }));

  // --- Rideau de fumée : la clairière apparaît dans une fumée épaisse qui se dissipe à
  // l'arrivée de la caméra, mais reste lourde et stagnante ensuite. ---
  const VEIL = kit.low ? 16 : 30;
  const veil = new Billboards(VEIL, kit.smokeTex);
  group.add(veil.mesh);
  kit.mists.push(veil);
  const veilState = Array.from({ length: VEIL }, () => ({ x: rand(-3.5, 4.5), z: rand(-1.5, 6.5), y: rand(0.3, 2.2), size: rand(3.4, 6), rot: rand(0, 6.28), spin: rand(-0.012, 0.012), drift: rand(0, 6.28), a: rand(0.6, 1) }));
  let veilDensity = 1.85;

  // --- Repère local de la clairière ---
  const anchor = new THREE.Vector3();
  const yaw = -0.18; // tournée un peu vers la droite (vers la crypte)
  let sx = 1;
  const camLocal = new THREE.Vector3();
  const toWorld = (x: number, z: number, out = new THREE.Vector3()) => {
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const lx = x * sx;
    out.set(anchor.x + lx * c + z * s, 0, anchor.z - lx * s + z * c);
    out.y = groundHeight(out.x, out.z);
    return out;
  };
  let reaperSize = 1.4;
  const tmp = new THREE.Vector3();

  return {
    name: "reaper",
    group,
    flames,
    eyeSpots,
    batHome,
    layout(f) {
      const portrait = f.aspect < 0.8;
      const az = -15;
      anchor.set((portrait ? -0.45 : -0.42) * halfWidthAt(f, az) * 0.92, 0, az);
      sx = portrait ? 0.6 : 1;
      // Distance de la caméra : faucheuse + chaudron cadrés de près, sur tous les formats.
      camLocal.set(0.3 * sx, 1.55, Math.max(3.3, 1.2 / (f.halfTan * f.aspect)));
      const s = portrait ? 0.85 : 1;

      for (const { l, pl } of items) {
        // px : position portrait donnée en unités locales réelles (toWorld resserre x par sx).
        toWorld(portrait && l.px !== undefined ? l.px / sx : l.x, portrait && l.pz !== undefined ? l.pz : l.z, tmp);
        pl.obj.rotation.y = (l.ry ?? 0) + yaw;
        setPlaced(pl, tmp.x, tmp.z, (l.s ?? 1) * s);
      }
      const camW = toWorld(camLocal.x, camLocal.z);
      if (bigJack) {
        // Posée au sommet du rocher (visée verticale sur sa surface, légèrement enfoncée : pas de
        // lévitation), tournée vers la caméra, de trois quarts.
        const seat = rock ? topOf(rock.obj) : toWorld(-1.7, -3.0);
        const scale = BIG_JACK_SCALE * s;
        bigJack.obj.position.set(seat.x, seat.y - 0.04 * scale, seat.z);
        bigJack.obj.scale.setScalar(scale);
        bigJack.obj.rotation.y = Math.atan2(camW.x - seat.x, camW.z - seat.z) - 0.22;
        bigJack.obj.updateMatrixWorld(true);
        bigJack.flame.pos.copy(JACK_FLAME_LOCAL).applyMatrix4(bigJack.obj.matrixWorld);
        bigJack.flame.glow.position.copy(bigJack.flame.pos);
        bigJack.flame.scale = scale;
      }
      // Faucheuse juste derrière le chaudron, à droite de l'axe de la caméra : sur ordinateur, les
      // choix de réponse (à gauche du centre) ne la cachent pas.
      toWorld(REAPER_AT[0], REAPER_AT[1], tmp);
      reaper.position.copy(tmp);
      reaperSize = 1.45 * s;
      reaper.scale.setScalar(reaperSize / modelHeight);
      const cauldronW = toWorld(CAULDRON_AT[0], CAULDRON_AT[1]);
      const toCauldron = Math.atan2(cauldronW.x - tmp.x, cauldronW.z - tmp.z);
      const toCamera = Math.atan2(camW.x - tmp.x, camW.z - tmp.z);
      reaper.rotation.y = toCauldron * 0.4 + toCamera * 0.6;
      reaperShadow.position.set(tmp.x, tmp.y + 0.03, tmp.z);
      reaperShadow.scale.setScalar(reaperSize * 1.1);

      cauldron.group.position.copy(cauldronW);
      cauldron.group.rotation.y = yaw + 0.4;
      cauldron.group.scale.setScalar(0.62 * s);
      cauldron.group.updateMatrixWorld(true);
      cauldronShadow.position.set(cauldronW.x, cauldronW.y + 0.03, cauldronW.z);
      cauldronShadow.scale.setScalar(1.5 * s);
      potion.pos.copy(cauldron.glow).applyMatrix4(cauldron.group.matrixWorld);
      potion.scale = s;

      gifts.forEach(({ g, mesh, shadow }) => {
        toWorld(g.x + GIFTS_SHIFT, g.z, tmp);
        mesh.position.copy(tmp);
        mesh.rotation.y = g.ry + yaw;
        mesh.scale.setScalar(s);
        shadow.position.set(tmp.x, tmp.y + 0.03, tmp.z);
        shadow.scale.setScalar(Math.max(g.w, g.d) * 1.6 * s);
      });
      CLEARING_EYES.forEach(([x, z], i) => {
        (eyeSpots[i] ??= new THREE.Vector3()).copy(toWorld(x, z)).add(new THREE.Vector3(0, 0.5, 0));
      });
      batHome.set(anchor.x, 8, anchor.z - 6);
    },
    pose() {
      const pos = toWorld(camLocal.x, camLocal.z);
      pos.y = groundHeight(anchor.x, anchor.z) + camLocal.y;
      return { pos, target: toWorld(0.15 * sx, -1.6).add(new THREE.Vector3(0, 0.75, 0)) };
    },
    update(t, dt, f, camera) {
      if (mixer && !kit.reduce) {
        mixer.update(dt);
        // Toutes les ~7 s : « venez vous servir » (Taunt) ou main tendue vers le chaudron (Interact).
        if (t > nextGesture && gestures.length) {
          const g = gestures[gestureIndex++ % gestures.length];
          idle?.fadeOut(0.3);
          g.reset().fadeIn(0.3).play();
          nextGesture = t + 7;
        }
      }
      cauldron.update(t);
      // Lueur des yeux : léger vacillement spectral, atténuée de jour mais toujours visible.
      if (eyeMat && eyeHalos.length) {
        const k = kit.reduce ? 0.9 : 0.8 + 0.2 * flicker(t * 0.6, 4.2);
        const level = Math.max(0.45, kit.glowLevel.value);
        eyeMat.color.setRGB(...EYE_CORE).multiplyScalar(0.75 + 0.25 * k);
        eyeHalos.forEach((h) => (h.material.opacity = (h.userData.opacity as number) * k * level));
      }

      const base = reaper.position;
      swirlState.forEach((s, i) => {
        const life = (((t / s.life + s.offset) % 1) + 1) % 1;
        const a = s.a0 + t * s.speed + life * 0.3;
        const rad = (s.r + life * 0.4) * reaperSize;
        swirl.set(i, base.x + Math.cos(a) * rad, base.y + 0.1 + life * reaperSize * 0.25, base.z + Math.sin(a) * rad * 0.8, Math.sin(Math.PI * life) * 2.2, a, (1.1 + life * 1.2) * reaperSize);
      });
      swirl.commit();

      // Le rideau se dissipe quand la caméra arrive (sans disparaître : la fumée reste lourde).
      // En portrait la caméra est plus loin et la nappe resserrée : plus légère, sinon tout se noie.
      const dist = camera.position.distanceTo(anchor);
      const veilBase = f.aspect < 0.8 ? 0.55 : 0.85;
      const target = kit.reduce ? veilBase : veilBase + 1.0 * smooth(4.5, 11, dist);
      veilDensity += (target - veilDensity) * Math.min(1, dt * 0.9);
      veilState.forEach((v, i) => {
        v.rot += v.spin * dt;
        toWorld(v.x + Math.sin(t * 0.04 + v.drift) * 0.18, v.z + Math.cos(t * 0.03 + v.drift) * 0.12, tmp); // nappe presque immobile
        const near = smooth(0.8, 3, camera.position.distanceTo(tmp)); // pas de nappe collée à l'objectif
        veil.set(i, tmp.x, tmp.y + v.y, tmp.z, v.a * veilDensity * near * 1.6, v.rot, v.size);
      });
      veil.commit();
    },
  };
}
