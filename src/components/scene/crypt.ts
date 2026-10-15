/**
 * Intérieur de la crypte, construit avec le pack KayKit Dungeon (murs, piliers, dalles, plafond,
 * torches, étagères, tonneaux, table) et Halloween Bits (citrouilles, crânes, cercueil).
 * Le classement en direct est peint sur le mur du fond, au-dessus d'une table où reposent des
 * chapeaux de sorcière ; une grande main squelette le dépoussière à l'arrivée.
 */
import * as THREE from "three";
import { Billboards, dustTexture, rand, seeded, smooth } from "./core";
import { applyCutGlow } from "./glow";
import { cloneModel, cutSpecFor, makeFlame } from "./outdoor";
import { createSkeletonArm, createSpider, createWebGeometry, createWitchHat, DCELL, paint, roundedBox, webMaterial } from "./props";
import type { Area, Flame, Frame, Kit, Pose } from "./types";
import { BASE_PATH } from "@/lib/base-path";

export const CRYPT_ORIGIN = new THREE.Vector3(140, 0, 0);

export type ResultsData = {
  total: number;
  results: { id: string; restaurant_name: string; image_url: string; votes: number; share: number }[];
};

export type CryptArea = Area & {
  setResults(data: ResultsData): void;
  /** Remet la poussière (avant d'entrer). */
  resetDust(): void;
  /** La main dépoussière le mur ; onDone à la fin. */
  reveal(onDone: () => void): void;
  entrance(f: Frame): Pose;
  /** Le rayon (depuis la caméra) touche-t-il le panneau du classement ? */
  hitPlaque(ray: THREE.Raycaster): boolean;
};

const ROOM = { w: 12, d: 12, h: 8 };
/** Bas du panneau : au-dessus de la table et des chapeaux. */
const PLAQUE_BOTTOM = 2.0;
const WALL_Z = -ROOM.d / 2;
const PX_PER_UNIT = 230;
/** Tonneau surmonté du badge Chamas Tacos, à gauche du panneau. */
const BADGE = { x: -3.35, z: WALL_Z + 1.55 };

const shortName = (n: string) => n.replace(/^CHAMAS TACOS\s*-\s*/i, "");

/** Panneau vertical (classement en une colonne), sur tous les écrans. */
function plaqueSize() {
  return { w: 3.1, h: 4.1 };
}

// ---------------------------------------------------------------------------
// Dessin du classement
// ---------------------------------------------------------------------------

/** Podium : or, argent, bronze — [clair, moyen, sombre] pour les dégradés. */
const MEDALS = [
  ["#fff6c2", "#f5c542", "#a8740a"],
  ["#ffffff", "#cfd6e0", "#7d8794"],
  ["#ffd2a8", "#d68a4a", "#7a4119"],
];

function drawResults(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  data: ResultsData | null,
  shares: Map<string, number>,
  images: Map<string, HTMLImageElement>,
  font: string,
) {
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "#241d2c");
  bg.addColorStop(1, "#130f19");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  const r = seeded(17);
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = `rgba(255,255,255,${r() * 0.025})`;
    ctx.fillRect(r() * w, r() * h, 2 + r() * 6, 2 + r() * 6);
  }
  // Double filet doré
  const u = Math.min(w, h) / 100;
  ctx.strokeStyle = "rgba(250,204,21,0.6)";
  ctx.lineWidth = u * 0.6;
  ctx.strokeRect(u * 2.2, u * 2.2, w - u * 4.4, h - u * 4.4);
  ctx.lineWidth = u * 0.22;
  ctx.strokeRect(u * 3.6, u * 3.6, w - u * 7.2, h - u * 7.2);

  const pad = u * 7;
  const titleSize = u * 5.2;
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#facc15";
  ctx.font = `800 ${titleSize}px ${font}`;
  (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${u * 0.6}px`;
  ctx.textAlign = "left";
  ctx.fillText("CLASSEMENT", pad, pad + titleSize * 0.6);
  (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = "0px";
  ctx.fillStyle = "#b3abc0";
  ctx.font = `600 ${u * 3.4}px ${font}`;
  ctx.textAlign = "right";
  const total = data?.total ?? 0;
  ctx.fillText(`${total.toLocaleString("fr-FR")} vote${total > 1 ? "s" : ""}`, w - pad, pad + titleSize * 0.6);

  const results = data?.results ?? [];
  const top = pad + titleSize * 1.6;
  if (results.length === 0) {
    ctx.textAlign = "center";
    ctx.fillStyle = "#f5f1e8";
    ctx.font = `600 ${u * 4}px ${font}`;
    ctx.fillText(data ? "Aucun vote pour l'instant" : "…", w / 2, (top + h) / 2);
    return;
  }

  const cols = 1;
  const perCol = Math.ceil(results.length / cols);
  const colW = (w - pad * 2 - (cols - 1) * pad) / cols;
  const rowH = Math.min((h - top - pad) / perCol, colW * 0.34);
  const max = Math.max(...results.map((x) => shares.get(x.id) ?? x.share), 0.0001);

  results.forEach((res, i) => {
    const col = Math.floor(i / perCol);
    const x = pad + col * (colW + pad);
    const y = top + (i % perCol) * rowH;
    const cy = y + rowH / 2;
    // Rang « sportif » (ex æquo = même rang, même médaille) ; podium seulement avec des votes.
    const rank = 1 + results.filter((o) => o.votes > res.votes).length;
    const medal = res.votes > 0 ? MEDALS[rank - 1] : undefined;
    if (medal) {
      const tint = ctx.createLinearGradient(x, 0, x + colW, 0);
      tint.addColorStop(0, medal[1] + "33");
      tint.addColorStop(0.6, medal[1] + "08");
      tint.addColorStop(1, "transparent");
      ctx.fillStyle = tint;
      ctx.strokeStyle = medal[1] + (rank === 1 ? "e6" : "99");
      ctx.lineWidth = u * (rank === 1 ? 0.45 : 0.3);
      ctx.beginPath();
      ctx.roundRect(x - u * 1.2, y + rowH * 0.06, colW + u * 2.4, rowH * 0.88, u * 2);
      ctx.fill();
      ctx.stroke();
    }
    // Médaille
    const mr = rowH * 0.17;
    if (medal) {
      const g = ctx.createRadialGradient(x + mr * 0.7, cy - mr * 0.4, mr * 0.1, x + mr, cy, mr);
      g.addColorStop(0, medal[0]);
      g.addColorStop(0.5, medal[1]);
      g.addColorStop(1, medal[2]);
      ctx.fillStyle = g;
    } else ctx.fillStyle = "#3b3346";
    ctx.beginPath();
    ctx.arc(x + mr, cy, mr, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = medal ? "#1a1420" : "#f5f1e8";
    ctx.textAlign = "center";
    ctx.font = `800 ${mr * 1.1}px ${font}`;
    ctx.fillText(String(rank), x + mr, cy + mr * 0.05);
    // Vignette 3:4
    const th = rowH * 0.74;
    const tw = th * 0.75;
    const tx = x + mr * 2 + u * 2;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(tx, cy - th / 2, tw, th, u * 1.2);
    ctx.clip();
    const img = images.get(res.image_url);
    if (img?.complete && img.naturalWidth) {
      const s = Math.max(tw / img.naturalWidth, th / img.naturalHeight);
      ctx.drawImage(img, tx + (tw - img.naturalWidth * s) / 2, cy - th / 2 + (th - img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s);
    } else {
      ctx.fillStyle = "#2b2433";
      ctx.fillRect(tx, cy - th / 2, tw, th);
    }
    ctx.restore();
    // Nom + votes + barre
    const lx = tx + tw + u * 2.4;
    const lw = x + colW - lx;
    const nameSize = Math.min(rowH * 0.22, u * 5);
    ctx.textAlign = "left";
    ctx.fillStyle = medal ? medal[rank === 1 ? 1 : 0] : "#f5f1e8";
    let name = shortName(res.restaurant_name).toUpperCase();
    // Le nom rétrécit d'abord (jusqu'à 70 %), puis il est abrégé.
    let ns = nameSize;
    ctx.font = `800 ${ns}px ${font}`;
    while (ctx.measureText(name).width > lw * 0.62 && ns > nameSize * 0.7) {
      ns -= 1;
      ctx.font = `800 ${ns}px ${font}`;
    }
    while (ctx.measureText(name).width > lw * 0.62 && name.length > 4) name = name.slice(0, -2) + "…";
    ctx.fillText(name, lx, cy - rowH * 0.13);
    ctx.textAlign = "right";
    ctx.fillStyle = "#b3abc0";
    ctx.font = `600 ${nameSize * 0.78}px ${font}`;
    const share = shares.get(res.id) ?? res.share;
    ctx.fillText(`${(Math.round(res.share * 1000) / 10).toLocaleString("fr-FR")} % · ${res.votes}`, x + colW, cy - rowH * 0.13);
    const by = cy + rowH * 0.14;
    const bh = rowH * 0.11;
    ctx.fillStyle = "#2b2433";
    ctx.beginPath();
    ctx.roundRect(lx, by, lw, bh, bh / 2);
    ctx.fill();
    const bw = Math.max(bh, (share / max) * lw);
    const grad = ctx.createLinearGradient(lx, 0, lx + bw, 0);
    grad.addColorStop(0, medal ? medal[2] : "#6b6178");
    grad.addColorStop(0.6, medal ? medal[1] : "#8d8399");
    grad.addColorStop(1, medal ? medal[0] : "#a59bb2");
    ctx.fillStyle = res.votes > 0 ? grad : "#3b3346";
    ctx.beginPath();
    ctx.roundRect(lx, by, res.votes > 0 ? bw : bh, bh, bh / 2);
    ctx.fill();
  });
}

// ---------------------------------------------------------------------------
// Salle construite avec le pack KayKit Dungeon (murs, piliers, dalles, plafond, torches,
// étagères, tonneaux…) + Halloween Bits (citrouilles, crânes, os, cercueil).
// ---------------------------------------------------------------------------

export function createCrypt(kit: Kit): CryptArea {
  const O = CRYPT_ORIGIN;
  const group = new THREE.Group();
  group.position.copy(O);
  const flames: Flame[] = [];
  const eyeSpots = [new THREE.Vector3(O.x + 4.6, 0.3, 2.4), new THREE.Vector3(O.x - 4.8, 0.32, 1.2), new THREE.Vector3(O.x - 5.0, 0.3, -4.6)];
  const M = kit.modelMat;

  const put = (name: string, x: number, y: number, z: number, ry = 0, s = 1) => {
    const obj = cloneModel(kit, name);
    if (!obj) return null;
    obj.position.set(x, y, z);
    obj.rotation.y = ry;
    obj.scale.setScalar(s);
    group.add(obj);
    return obj;
  };
  const flameAt = (obj: THREE.Object3D | null, local: [number, number, number], tag: Parameters<typeof makeFlame>[2], over: Partial<Flame> = {}) => {
    if (!obj) return null;
    group.updateMatrixWorld(true);
    const f = makeFlame(kit, group, tag, over);
    // Citrouilles-lanternes : découpes émissives au rythme de la flamme (le porteur est le modèle cloné).
    const cut = cutSpecFor(obj.children[0]?.name ?? "");
    if (cut) f.cut = applyCutGlow(kit, obj, cut, !kit.low);
    f.pos.set(...local).applyMatrix4(obj.matrixWorld);
    f.glow.position.copy(group.worldToLocal(f.pos.clone()));
    f.scale = obj.scale.x;
    // Côté gauche de la salle : lumière constante (pas de vacillement).
    if (f.pos.x < group.position.x - 0.5) f.steady = true;
    flames.push(f);
    return f;
  };

  // ----- Murs (2 rangées de 4 m), sol, plafond -----
  const W = ROOM.w / 2;
  const back = [["wall_shelves", "wall", "wall_cracked"], ["wall_cracked", "wall", "wall_arched"]];
  back.forEach((row, r) => row.forEach((name, i) => put(name, -4 + i * 4, r * 4, WALL_Z - 0.5)));
  for (const side of [-1, 1])
    [["wall", "wall_cracked", "wall"], ["wall_arched", "wall", "wall_cracked"]].forEach((row, r) =>
      row.forEach((name, i) => put(name, side * (W + 0.5), r * 4, -4 + i * 4, side * (Math.PI / 2))),
    );
  for (let x = -4; x <= 4; x += 4)
    for (let z = -4; z <= 4; z += 4) {
      put("floor_tile_large", x, 0, z, ((x + z) / 4) % 2 ? Math.PI / 2 : 0);
      const c = put("ceiling_tile", x, ROOM.h, z);
      if (c) c.rotation.x = Math.PI;
    }
  for (const side of [-1, 1]) {
    put("pillar_decorated", side * (W - 0.6), 0, WALL_Z + 0.6, side < 0 ? 0 : Math.PI);
    put("pillar_decorated", side * (W - 0.6), 4, WALL_Z + 0.6, side < 0 ? 0 : Math.PI);
    put("pillar_decorated", side * (W - 0.6), 0, 2, side * (Math.PI / 2));
  }

  // ----- Torches murales (lumière chaude, vacillante) -----
  const torch = (x: number, y: number, z: number, ry: number) =>
    flameAt(put("torch_mounted", x, y, z, ry, 1.2), [0, 0.62, 0.42], "torch", { priority: 2 });
  torch(-W, 2.7, -2, Math.PI / 2);
  torch(W, 2.7, -2, -Math.PI / 2);
  torch(-W, 2.7, 3.6, Math.PI / 2);
  torch(W, 2.7, 3.6, -Math.PI / 2);

  // ----- Mobilier du pack Dungeon -----
  put("banner_thin_red", -W, 3.3, 0.6, Math.PI / 2, 1.1);
  put("banner_thin_red", W, 3.3, 0.6, -Math.PI / 2, 1.1);
  // Tonneau à gauche du panneau, surmonté du badge Chamas Tacos (version Halloween).
  put("barrel_large", BADGE.x, 0, BADGE.z, 0.3, 0.95);
  const badge = cloneModel(kit, "chamastacos_badge_halloween");
  // Dessus du tonneau (2 m × 0,95) : le badge (sans ses décorations au pied, retirées du modèle)
  // y repose, centré, et une seule citrouille est posée devant lui, entièrement sur le couvercle.
  const BARREL_TOP = 2.0 * 0.95;
  if (badge) {
    badge.position.set(BADGE.x, BARREL_TOP, BADGE.z - 0.1);
    badge.rotation.y = 0.32;
    badge.scale.setScalar(1.15);
    group.add(badge);
    flameAt(put("pumpkin_orange_jackolantern", BADGE.x - 0.38, BARREL_TOP, BADGE.z + 0.36, 0.5, 0.4), [0, 0.62, 0.15], "jack", { intensity: 3 });
  }
  put("barrel_small", -W + 1.1, 0, WALL_Z + 3.9, 1.1);
  put("keg", W - 1.4, 0, 3.8, -Math.PI / 2);
  put("chest", W - 1.4, 0, WALL_Z + 2.6, -Math.PI / 2 + 0.3);
  put("crates_stacked", -W + 1.3, 0, 4.2, 0.4);
  put("box_small", W - 1.2, 0, 0.6, 0.7);
  flameAt(put("shelf_small_candles", -2, 2.4, WALL_Z, 0, 1.2), [0, 0.55, 0.25], "wall", { intensity: 2.5, smoke: 0.3 });
  flameAt(put("shelf_small_candles", 2, 2.4, WALL_Z, 0, 1.2), [0, 0.55, 0.25], "wall", { intensity: 2.5, smoke: 0.3 });
  // Cercueil debout contre le mur, à droite de la table (couvercle face à nous).
  const coffin = put("coffin", 3.6, 1.5 * 0.8, WALL_Z + 0.62, -0.18, 0.8);
  if (coffin) coffin.rotation.x = Math.PI / 2 - 0.05;

  // ----- Halloween Bits -----
  flameAt(put("pumpkin_orange_jackolantern", -W + 1.4, 0, -1.2, 0.8, 0.85), [0, 0.62, 0.15], "jack");
  flameAt(put("pumpkin_yellow_jackolantern", W - 1.5, 0, 2.2, -0.9, 0.8), [0, 0.62, 0.15], "jack");
  put("pumpkin_orange_small", -W + 2.1, 0, -0.4, 1, 0.9);
  put("coffin_decorated", -W + 1.4, 0, 1.4, Math.PI / 2);
  put("skull", 1.8, 0, -1.6, -0.6, 0.6);
  put("ribcage", -1.4, 0.3, 2.2, 0.4, 0.9);
  put("bone_A", 1.0, 0.06, 2.6, 1.1);
  put("bone_B", -0.6, 0.06, -1.5, 0.3);
  put("bone_C", 3.0, 0.06, 0.6, -0.7);
  for (const [x, z] of [[-3.6, WALL_Z + 1.1], [3.7, WALL_Z + 1.2]] as const) {
    put("candle", x, 0, z, 0, 1.1);
    put("candle_thin", x + 0.3, 0, z + 0.15, 0, 1);
    flameAt(put("candle_melted", x - 0.25, 0, z + 0.25, 0, 1.1), [0, 0.65, 0], "candle");
  }

  // ----- Table sous le classement : chapeaux de sorcière, bougies, potion, citrouille -----
  const TABLE_Z = WALL_Z + 1.7;
  put("table_long", 0, 0, TABLE_Z, Math.PI / 2);
  const hatBig = createWitchHat(kit.dungeonFlatMat, { height: 1, radius: 0.32, brim: 0.72, bend: 0.4, seed: 2 });
  const hatSmall = createWitchHat(kit.dungeonFlatMat, { height: 0.85, radius: 0.3, brim: 0.62, bend: 0.22, seed: 5 });
  // Posés SUR le plateau (haut à y = 1) : le point le plus bas du bord (qui ondule et tombe vers
  // l'extérieur) touche la table, rien ne passe dessous. Bords entièrement au-dessus du plateau.
  const TABLE_TOP = 1.0;
  const seat = (hat: THREE.Object3D, x: number, z: number, ry: number, scale: number) => {
    hat.rotation.y = ry;
    hat.scale.setScalar(scale);
    hat.position.set(x, 0, z);
    hat.updateMatrixWorld(true);
    const lowest = new THREE.Box3().setFromObject(hat).min.y;
    hat.position.y = TABLE_TOP - lowest + 0.004;
    group.add(hat);
  };
  // Disposition sans contact : chapeaux devant sur les côtés, bougies au fond, citrouille devant au centre.
  seat(hatBig, -1.2, TABLE_Z + 0.25, 0.5, 1.0);
  seat(hatSmall, 1.45, TABLE_Z + 0.3, -0.6, 0.85);
  flameAt(put("candle_lit", -0.35, 1.0, TABLE_Z - 0.5, 0, 0.75), [0, 1.0, 0], "candle", { light: true, intensity: 3.4, distance: 5, priority: 3 });
  flameAt(put("candle_thin_lit", 0.05, 1.0, TABLE_Z - 0.55, 0, 0.7), [0, 1.0, 0], "candle", { light: true, intensity: 2.4, distance: 4.5, priority: 3 });
  // Grosse citrouille du pack (lanterne allumée) : éclaire aussi les chapeaux.
  flameAt(put("pumpkin_orange_jackolantern", 0.35, 1.0, TABLE_Z + 0.3, -0.25, 0.72), [0, 0.62, 0.15], "jack", { priority: 3 });

  // ----- Toiles d'araignée en 3D -----
  const webMat = webMaterial(M.map, kit.time);
  /** Toile entre la face intérieure d'un pilier et le plafond (coin de l'origine = pilier × plafond). */
  const pillarWeb = (side: number, z: number, size: number, seed: number, ry = 0) => {
    const m = new THREE.Mesh(createWebGeometry(size, seed), webMat);
    m.position.set(side * (W - 1.15), ROOM.h - 0.02, z);
    m.rotation.y = ry;
    m.scale.set(-side, 1, 1);
    group.add(m);
  };
  pillarWeb(-1, WALL_Z + 0.6, 2.6, 1);
  pillarWeb(1, WALL_Z + 0.6, 2.2, 2);
  pillarWeb(-1, 2, 1.7, 3, 0);
  pillarWeb(1, 2, 1.5, 4, 0);
  const frameWebs = [1, -1].map((sx, i) => {
    const m = new THREE.Mesh(createWebGeometry(0.95, 5 + i), webMat);
    m.scale.x = sx;
    group.add(m);
    return m;
  });

  // ----- Panneau du classement + cadre -----
  const resultsCanvas = document.createElement("canvas");
  const resultsTex = new THREE.CanvasTexture(resultsCanvas);
  resultsTex.colorSpace = THREE.SRGBColorSpace;
  resultsTex.generateMipmaps = false;
  resultsTex.minFilter = THREE.LinearFilter;
  resultsTex.anisotropy = 4;
  const maskCanvas = document.createElement("canvas");
  const maskTex = new THREE.CanvasTexture(maskCanvas);
  maskTex.generateMipmaps = false;
  maskTex.minFilter = THREE.LinearFilter;
  const dustTex = dustTexture();
  dustTex.wrapS = dustTex.wrapT = THREE.RepeatWrapping;
  const plaqueMat = new THREE.MeshLambertMaterial({ map: resultsTex, emissiveMap: resultsTex, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0.6 });
  plaqueMat.onBeforeCompile = (shader) => {
    shader.uniforms.uDustMask = { value: maskTex };
    shader.uniforms.uDust = { value: dustTex };
    shader.fragmentShader =
      "uniform sampler2D uDustMask;\nuniform sampler2D uDust;\n" +
      shader.fragmentShader
        .replace(
          "#include <map_fragment>",
          `#include <map_fragment>
          float dustA = texture2D(uDustMask, vMapUv).a;
          vec3 dustC = texture2D(uDust, vMapUv * 2.0).rgb;
          diffuseColor.rgb = mix(diffuseColor.rgb, dustC, dustA * 0.96);`,
        )
        .replace(
          "#include <emissivemap_fragment>",
          `#include <emissivemap_fragment>
          totalEmissiveRadiance *= (1.0 - dustA);`,
        );
  };
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), plaqueMat);
  group.add(plaque);
  const frame = [0, 1, 2, 3].map(() => {
    const b = new THREE.Mesh(paint(roundedBox(1, 1, 1, 0.12), DCELL.slate), kit.dungeonMat);
    group.add(b);
    return b;
  });
  const keystone = new THREE.Mesh(paint(roundedBox(0.5, 0.42, 0.24, 0.06), DCELL.steel), kit.dungeonMat);
  group.add(keystone);
  const crest = cloneModel(kit, "skull");
  if (crest) {
    crest.scale.setScalar(0.34);
    group.add(crest);
  }

  // ----- Grande main squelette qui dépoussière -----
  // Bras de personnage vu « en jeu » : il entre par le bas de l'écran, coude et épaule hors champ.
  const HAND_SCALE = 5;
  const arm = createSkeletonArm(M, HAND_SCALE);
  arm.root.visible = false;
  group.add(arm.root);

  // ----- Araignées suspendues -----
  const threadMat = new THREE.MeshBasicMaterial({ color: "#cfc9d6", transparent: true, opacity: 0.45 });
  const spiderEyes = new THREE.MeshBasicMaterial({ map: M.map });
  const hanging = [
    { x: -3.0, z: -3.2, len: 3.4, speed: 0.35, phase: 0 },
    { x: 3.3, z: -1.8, len: 4.2, speed: 0.28, phase: 2 },
    { x: -1.6, z: 1.6, len: 3.0, speed: 0.42, phase: 4 },
  ].map((h) => {
    const s = createSpider(M, spiderEyes);
    s.root.scale.setScalar(1.3);
    const thread = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 1, 3).translate(0, -0.5, 0), threadMat);
    thread.position.set(h.x, ROOM.h, h.z);
    group.add(s.root, thread);
    return { ...h, s, thread, top: ROOM.h };
  });

  // ----- Poussière en suspension dans la lumière des torches -----
  const MOTES = kit.low ? 24 : 50;
  const moteGeo = new THREE.BufferGeometry();
  const motePos = new Float32Array(MOTES * 3);
  const r = seeded(77);
  const motes = Array.from({ length: MOTES }, () => ({ x: (r() - 0.5) * 10, y: 0.5 + r() * 6, z: -5 + r() * 10, s: r() * 10 }));
  moteGeo.setAttribute("position", new THREE.BufferAttribute(motePos, 3).setUsage(THREE.DynamicDrawUsage));
  const motePoints = new THREE.Points(moteGeo, new THREE.PointsMaterial({ map: kit.glowTex, size: 0.06, color: "#ffd9a0", transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }));
  motePoints.frustumCulled = false;
  group.add(motePoints);

  // Nuage de poussière soulevé par la main
  const puffs = new Billboards(28, kit.smokeTex);
  puffs.color.set("#b8ab95");
  puffs.mesh.renderOrder = 2;
  group.add(puffs.mesh);
  const puffState = Array.from({ length: 28 }, () => ({ alive: false, t: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, size: 0, rot: 0 }));
  let nextPuff = 0;

  // ----- État du panneau -----
  const size = plaqueSize();
  const plaqueCY = PLAQUE_BOTTOM + size.h / 2;
  let data: ResultsData | null = null;
  const from = new Map<string, number>();
  let anim = 1;
  const images = new Map<string, HTMLImageElement>();
  let dirty = true;
  const font = getComputedStyle(document.body).fontFamily || "sans-serif";
  void document.fonts?.ready.then(() => (dirty = true));
  let reveal: { t: number; last: THREE.Vector2 | null; done: () => void } | null = null;
  let revealed = false;

  // Panneau, cadre, toiles du cadre (dimensions fixes : panneau vertical sur tous les écrans).
  {
    const z = WALL_Z + 0.06;
    plaque.position.set(0, plaqueCY, z);
    plaque.scale.set(size.w, size.h, 1);
    const t = 0.22;
    const [topB, bottomB, leftB, rightB] = frame;
    topB.scale.set(size.w + t * 2, t, 0.2);
    topB.position.set(0, plaqueCY + size.h / 2 + t / 2, z);
    bottomB.scale.set(size.w + t * 2, t, 0.2);
    bottomB.position.set(0, plaqueCY - size.h / 2 - t / 2, z);
    leftB.scale.set(t, size.h, 0.2);
    leftB.position.set(-size.w / 2 - t / 2, plaqueCY, z);
    rightB.scale.set(t, size.h, 0.2);
    rightB.position.set(size.w / 2 + t / 2, plaqueCY, z);
    keystone.position.set(0, plaqueCY + size.h / 2 + t + 0.12, z + 0.02);
    crest?.position.set(0, plaqueCY + size.h / 2 + t + 0.3, z + 0.05);
    // Devant le cadre (qui dépasse de 0,1) : les fils ne touchent que les angles.
    frameWebs[0].position.set(-size.w / 2 - t * 0.5, plaqueCY + size.h / 2 + t * 0.5, z + 0.24);
    frameWebs[1].position.set(size.w / 2 + t * 0.5, plaqueCY + size.h / 2 + t * 0.5, z + 0.24);
    resultsCanvas.width = Math.round(size.w * PX_PER_UNIT);
    resultsCanvas.height = Math.round(size.h * PX_PER_UNIT);
    maskCanvas.width = 160;
    maskCanvas.height = Math.round((160 * size.h) / size.w);
  }

  function fillDust(alpha: number) {
    const ctx = maskCanvas.getContext("2d")!;
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    if (alpha > 0) {
      ctx.fillStyle = `rgba(0,0,0,${alpha})`;
      ctx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
    }
    maskTex.needsUpdate = true;
  }
  fillDust(1);

  function brush(u: number, v: number) {
    const ctx = maskCanvas.getContext("2d")!;
    ctx.globalCompositeOperation = "destination-out";
    const x = u * maskCanvas.width;
    const y = (1 - v) * maskCanvas.height;
    const rad = maskCanvas.width * 0.17;
    const g = ctx.createRadialGradient(x, y, rad * 0.35, x, y, rad);
    g.addColorStop(0, "rgba(0,0,0,0.9)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    maskTex.needsUpdate = true;
  }

  function redraw() {
    const ctx = resultsCanvas.getContext("2d");
    if (!ctx) return;
    const shares = new Map<string, number>();
    for (const res of data?.results ?? []) {
      const a = from.get(res.id) ?? 0;
      shares.set(res.id, a + (res.share - a) * anim);
    }
    drawResults(ctx, resultsCanvas.width, resultsCanvas.height, data, shares, images, font);
    resultsTex.needsUpdate = true;
  }

  /** Point du trajet de la main (u, v sur le panneau) pour un avancement 0 → 1. */
  function wipePath(s: number) {
    const rows = 4;
    const k = Math.min(rows - 0.0001, s * rows);
    const row = Math.floor(k);
    const q = k - row;
    const dir = row % 2 ? 1 : -1;
    const u = dir > 0 ? -0.05 + q * 1.1 : 1.05 - q * 1.1;
    const v = 0.86 - row * 0.24 + Math.sin(q * Math.PI * 3) * 0.035;
    return { u, v, dir };
  }
  /**
   * Place le bras : paume à plat sur le panneau au point (u, v), doigts vers le haut (penchés dans
   * le sens du geste). Le squelette se tient juste à droite de la caméra : son épaule est hors champ,
   * derrière le bord DROIT de l'écran, à hauteur de poitrine (le bras ne sort pas du sol), calculée
   * depuis la caméra réelle (avec sa respiration). Le coude vient d'une IK à deux os de longueur fixe
   * (avant-bras / bras dans un rapport anatomique) et pend sous le bras tendu, bien visible.
   * `away` (0 → 1) ramène la main hors champ par la droite, `wobble` frotte.
   */
  const camPos = new THREE.Vector3();
  const camRight = new THREE.Vector3();
  const camUp = new THREE.Vector3();
  const camFwd = new THREE.Vector3();
  const palmN = new THREE.Vector3(0, 0, -1);
  const wallN = new THREE.Vector3(0, 0, 1);
  /** Longueurs de l'avant-bras et du bras, fixées à l'entrée de la main (null : à recalculer). */
  let armLen: { fore: number; upper: number } | null = null;
  function placeArm(camera: THREE.Camera, u: number, v: number, away: number, wobble: number) {
    const cam = camera as THREE.PerspectiveCamera;
    cam.updateMatrixWorld();
    camRight.setFromMatrixColumn(cam.matrixWorld, 0).normalize();
    camUp.setFromMatrixColumn(cam.matrixWorld, 1).normalize();
    camFwd.setFromMatrixColumn(cam.matrixWorld, 2).normalize().negate();
    camPos.setFromMatrixPosition(cam.matrixWorld).sub(group.position); // repère de la crypte
    // Épaule : à 45 % de la distance au mur, derrière le bord droit (marge > tête de l'humérus),
    // à mi-hauteur de l'écran.
    const dWall = Math.max(2, (camPos.z - WALL_Z) / Math.max(0.2, -camFwd.z));
    const dS = dWall * 0.45;
    const halfH = dS * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const halfW = halfH * cam.aspect;
    const palmAt = (pu: number, pv: number) => new THREE.Vector3((pu - 0.5) * size.w, plaqueCY + (pv - 0.5) * size.h, WALL_Z + 0.3);
    const palm = palmAt(u, v);
    const shoulder = camPos
      .clone()
      .addScaledVector(camFwd, dS)
      .addScaledVector(camUp, halfH * 0.05)
      .addScaledVector(camRight, halfW + 0.12 * HAND_SCALE);
    if (!armLen) {
      // Bras presque tendu pour atteindre le coin le plus éloigné du trajet ; avant-bras 45 %, bras 55 %.
      let far = 0;
      for (const [pu, pv] of [[-0.05, 0.9], [1.05, 0.9], [-0.05, 0.12], [1.05, 0.12]]) far = Math.max(far, palmAt(pu, pv).addScaledVector(camUp, -0.12 * HAND_SCALE).distanceTo(shoulder));
      armLen = { fore: far * 1.03 * 0.45, upper: far * 1.03 * 0.55 };
    }
    // Doigts : vers le haut, penchés vers le geste (de l'épaule vers la main), un peu vers le mur.
    const reach = new THREE.Vector3(palm.x - shoulder.x, palm.y - shoulder.y, 0).normalize();
    const fingers = new THREE.Vector3(0, 1, 0).multiplyScalar(0.62).addScaledVector(reach, 0.38).normalize();
    fingers.applyAxisAngle(wallN, wobble);
    fingers.z -= 0.14;
    fingers.normalize();
    // Poignet : la paume (centre à 0,12 de la main) se pose sur le point visé.
    const wrist = palm.clone().addScaledVector(fingers, -0.12 * HAND_SCALE);
    if (away > 0) {
      // Sortie / entrée par la droite : le poignet repasse derrière le bord droit, sous l'épaule.
      const aside = shoulder.clone().addScaledVector(camRight, 0.3 * HAND_SCALE).addScaledVector(camUp, -armLen.fore * 0.6);
      wrist.lerp(aside, smooth(0, 1, away));
    }
    // IK à deux os : coude vers la droite et un peu vers le bas (il reste dans l'écran), un peu vers nous.
    const { fore, upper } = armLen;
    const axis = wrist.clone().sub(shoulder);
    const d = THREE.MathUtils.clamp(axis.length(), Math.abs(upper - fore) + 0.01, fore + upper - 0.01);
    axis.normalize();
    const along = (upper * upper - fore * fore + d * d) / (2 * d);
    const out = Math.sqrt(Math.max(0, upper * upper - along * along));
    const pole = camRight.clone().multiplyScalar(0.7).addScaledVector(camUp, -0.55).addScaledVector(camFwd, -0.2);
    pole.addScaledVector(axis, -pole.dot(axis)).normalize();
    const elbow = shoulder.clone().addScaledVector(axis, along).addScaledVector(pole, out);
    arm.place(wrist, fingers, palmN, elbow, shoulder);
  }

  return {
    name: "crypt",
    group,
    flames,
    eyeSpots,
    batHome: new THREE.Vector3(O.x, 6, -2),
    layout() {},
    pose(f) {
      // Cadre le panneau ET la table aux chapeaux, avec un peu de salle autour.
      const tanV = Math.tan(THREE.MathUtils.degToRad(f.fov / 2));
      const bottom = 0.15; // le plateau de la table et ce qu'il porte restent entiers, même quand la caméra respire
      const spanH = PLAQUE_BOTTOM + size.h + 0.75 - bottom;
      const dV = (spanH * 1.25) / 2 / tanV;
      const dH = 4.6 / 2 / (tanV * f.aspect);
      const d = Math.min(ROOM.d - 1.2, Math.max(dV, dH));
      const cy = bottom + spanH / 2;
      const shift = 0.06 * 2 * tanV * d; // sous le titre de la page
      return { pos: new THREE.Vector3(O.x, cy + shift * 0.4, WALL_Z + d), target: new THREE.Vector3(O.x, cy + shift, WALL_Z) };
    },
    hitPlaque(ray) {
      return revealed && group.visible && ray.intersectObject(plaque, false).length > 0;
    },
    entrance() {
      return { pos: new THREE.Vector3(O.x, 2.4, ROOM.d / 2 - 0.2), target: new THREE.Vector3(O.x, plaqueCY - 0.3, WALL_Z) };
    },
    setResults(next) {
      const prev = new Map((data?.results ?? []).map((x) => [x.id, x.share]));
      from.clear();
      for (const res of next.results) from.set(res.id, revealed ? (prev.get(res.id) ?? 0) : res.share);
      data = next;
      anim = revealed && !kit.reduce ? 0 : 1;
      for (const res of next.results) {
        if (images.has(res.image_url)) continue;
        const img = new Image();
        img.decoding = "async";
        img.onload = () => (dirty = true);
        // Médias locaux (/seed, /uploads) : fichier direct, comme `unoptimized` ailleurs (l'optimiseur
        // d'images ignore le basePath et tombe sur la redirection : 500). Les autres : vignette optimisée.
        img.src = res.image_url.startsWith("/") ? `${BASE_PATH}${res.image_url}` : `${BASE_PATH}/_next/image?url=${encodeURIComponent(res.image_url)}&w=128&q=75`;
        images.set(res.image_url, img);
      }
      dirty = true;
    },
    resetDust() {
      revealed = false;
      reveal = null;
      arm.root.visible = false;
      fillDust(1);
    },
    reveal(onDone) {
      if (kit.reduce) {
        fillDust(0);
        revealed = true;
        onDone();
        return;
      }
      reveal = { t: 0, last: null, done: onDone };
      armLen = null;
      arm.root.visible = true;
    },
    update(t, dt, _f, camera) {
      if (anim < 1) {
        anim = Math.min(1, anim + dt / 0.9);
        dirty = true;
      }
      if (dirty) {
        dirty = false;
        redraw();
      }

      // Main qui dépoussière : entrée (0,6 s), 4 passages (3,4 s), sortie (0,7 s).
      if (reveal) {
        reveal.t += dt;
        const T_IN = 0.6;
        const T_WIPE = 3.4;
        const T_OUT = 0.7;
        const start = wipePath(0);
        // Frotter : la main pivote un peu sur la paume, dans le sens du passage.
        let wobble = Math.sin(t * 8) * 0.1;
        if (reveal.t < T_IN) {
          placeArm(camera, start.u, start.v, 1 - smooth(0, 1, reveal.t / T_IN), 0);
        } else if (reveal.t < T_IN + T_WIPE) {
          const p = wipePath((reveal.t - T_IN) / T_WIPE);
          wobble += p.dir * 0.12;
          placeArm(camera, p.u, p.v, 0, wobble);
          const cur = new THREE.Vector2(p.u, p.v);
          const prev = reveal.last ?? cur;
          const steps = Math.ceil(prev.distanceTo(cur) / 0.02) + 1;
          for (let i = 0; i <= steps; i++) brush(prev.x + (cur.x - prev.x) * (i / steps), prev.y + (cur.y - prev.y) * (i / steps));
          reveal.last = cur;
          if (Math.random() < 0.6) {
            const ps = puffState[nextPuff];
            nextPuff = (nextPuff + 1) % puffState.length;
            // La poussière part du bout des doigts, sur le panneau.
            Object.assign(ps, { alive: true, t: 0, x: (p.u - 0.5) * size.w + rand(-0.2, 0.2), y: plaqueCY + (p.v - 0.5) * size.h + rand(-0.3, 0.3), z: WALL_Z + 0.3, vx: rand(-0.4, 0.4) - p.dir * 0.3, vy: rand(-0.5, -0.1), size: rand(0.6, 1.2), rot: rand(0, 6) });
          }
        } else {
          if (!revealed) {
            fillDust(0);
            revealed = true;
          }
          const end = wipePath(0.9999);
          placeArm(camera, end.u, end.v, smooth(0, 1, (reveal.t - T_IN - T_WIPE) / T_OUT), 0);
          if (reveal.t > T_IN + T_WIPE + T_OUT) {
            arm.root.visible = false;
            const done = reveal.done;
            reveal = null;
            done();
          }
        }
        arm.pose(0.18, 0.1, 0.15, 0.12, t * 9);
      }
      puffState.forEach((p, i) => {
        if (!p.alive) return puffs.hide(i);
        p.t += dt;
        if (p.t > 1.4) {
          p.alive = false;
          return puffs.hide(i);
        }
        const k = p.t / 1.4;
        puffs.set(i, p.x + p.vx * p.t, p.y + p.vy * p.t, p.z + 0.4 * k, Math.sin(Math.PI * k) * 0.55, p.rot + k, p.size * (0.6 + k));
      });
      puffs.commit();

      hanging.forEach((h) => {
        const drop = h.len * (0.55 + 0.45 * Math.sin(t * h.speed + h.phase));
        h.s.root.position.set(h.x, h.top - drop, h.z);
        h.s.root.rotation.y = Math.sin(t * 0.3 + h.phase) * 1.2;
        h.thread.scale.y = drop;
        h.s.update(t, Math.abs(Math.cos(t * h.speed + h.phase)) > 0.6 ? 1 : 0);
      });
      motes.forEach((m, i) => {
        motePos.set([m.x + Math.sin(t * 0.2 + m.s) * 0.4, m.y + Math.sin(t * 0.15 + m.s * 2) * 0.3, m.z + Math.cos(t * 0.18 + m.s) * 0.4], i * 3);
      });
      moteGeo.attributes.position.needsUpdate = true;
    },
  };
}
