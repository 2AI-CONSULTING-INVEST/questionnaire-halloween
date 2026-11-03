/**
 * Intérieur de la crypte, construit avec le pack KayKit Dungeon (murs, piliers, dalles, plafond,
 * torches, étagères, tonneaux, table) et Halloween Bits (citrouilles, crânes, cercueil).
 * Le classement en direct est peint sur le mur du fond, au-dessus d'une table où reposent des
 * chapeaux de sorcière ; une grande main squelette le dépoussière à l'arrivée.
 * Concours terminé (mode podium) : le panneau devient un podium (2e, 1re, 3e), dévoilé par une
 * cérémonie — un public de mains squelettes applaudit vite en bas de l'écran, 3e place (couronne de
 * bronze), 2e (argent), roulement de tambour, puis le gagnant (couronne d'or, confettis).
 */
import * as THREE from "three";
import { Billboards, dustTexture, rand, seeded, smooth } from "./core";
import { applyCutGlow } from "./glow";
import { cloneModel, cutSpecFor, makeFlame } from "./outdoor";
import { podiumLayout, podiumSlots, REVEAL_ORDER, slotAt, type PodiumSlot, type SlotBox } from "./podium";
import { createClapHandGeometry, createSkeletonArm, createSpider, createWebGeometry, createWitchHat, DCELL, paint, roundedBox, webMaterial } from "./props";
import type { Area, Flame, Frame, Kit, Pose } from "./types";
import type { SoundEvent } from "../sound/engine";
import { BASE_PATH } from "@/lib/base-path";

export const CRYPT_ORIGIN = new THREE.Vector3(140, 0, 0);

export type ResultsData = {
  total: number;
  results: { id: string; restaurant_name: string; image_url: string; votes: number; share: number }[];
};

/** Étapes de la cérémonie : place dévoilée (3, 2, 1), roulement de tambour, fin. */
export type CeremonyStep = 1 | 2 | 3 | "drumroll" | "end";

export type CryptHooks = {
  onSound?: (e: SoundEvent) => void;
  onCeremony?: (step: CeremonyStep) => void;
  /** Mode podium : jouer la cérémonie à ce dévoilement (sinon podium final, directement). */
  shouldPlayCeremony?: () => boolean;
};

export type CryptArea = Area & {
  setResults(data: ResultsData): void;
  /** Concours terminé : podium (et cérémonie) au lieu du classement. */
  setPodium(on: boolean): void;
  /** Remet la poussière (avant d'entrer) ; en mode podium, voile les places. */
  resetDust(): void;
  /** La main dépoussière le mur (ou, en mode podium, la cérémonie se joue) ; onDone à la fin. `force` : cérémonie même déjà vue. */
  reveal(onDone: () => void, force?: boolean): void;
  /** Cérémonie en cours : on passe directement au podium final. */
  skip(): void;
  entrance(f: Frame): Pose;
  /** Le rayon touche-t-il le panneau ? En mode podium, place visée (null : hors des places, rien à ouvrir). */
  hitPlaque(ray: THREE.Raycaster): { place: 1 | 2 | 3 | null } | null;
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

/** Fond du panneau : dégradé sombre, grain, double filet doré. Renvoie l'unité (1 % du petit côté). */
function drawBoardBase(ctx: CanvasRenderingContext2D, w: number, h: number) {
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
  return u;
}

function drawResults(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  data: ResultsData | null,
  shares: Map<string, number>,
  images: Map<string, HTMLImageElement>,
  font: string,
) {
  const u = drawBoardBase(ctx, w, h);

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
// Dessin du podium (concours terminé)
// ---------------------------------------------------------------------------

type Spacing = CanvasRenderingContext2D & { letterSpacing?: string };

/** Image recadrée (cover) dans un rectangle arrondi. */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement | undefined, x: number, y: number, w: number, h: number, r: number) {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.clip();
  if (img?.complete && img.naturalWidth) {
    const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    ctx.drawImage(img, x + (w - img.naturalWidth * s) / 2, y + (h - img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s);
  } else {
    ctx.fillStyle = "#2b2433";
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
}

/** Texte sur une ou deux lignes (coupure aux espaces), police réduite jusqu'à 70 % puis abrégée. */
function fitLines(ctx: CanvasRenderingContext2D, text: string, maxW: number, size: number, font: string, lines = 2) {
  for (let s = size; s >= size * 0.7; s -= 1) {
    ctx.font = `800 ${s}px ${font}`;
    const out: string[] = [];
    let cur = "";
    for (const word of text.split(/\s+/)) {
      const next = cur ? `${cur} ${word}` : word;
      if (ctx.measureText(next).width <= maxW) cur = next;
      else {
        if (cur) out.push(cur);
        cur = word;
      }
    }
    if (cur) out.push(cur);
    if (out.length <= lines && out.every((l) => ctx.measureText(l).width <= maxW)) return { lines: out, size: s };
  }
  const size70 = size * 0.7;
  ctx.font = `800 ${size70}px ${font}`;
  let t = text;
  while (ctx.measureText(t + "…").width > maxW && t.length > 3) t = t.slice(0, -1);
  return { lines: [t + "…"], size: size70 };
}

/**
 * Podium : titre, trois marches (2e à gauche, 1re au centre, 3e à droite) et, au-dessus, la carte de
 * chaque place (photo, nom, votes). `flip` (0 → 1) retourne la carte voilée ; `glow` : éclat au dévoilement.
 */
function drawPodium(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  data: ResultsData | null,
  slots: PodiumSlot[],
  boxes: SlotBox[],
  flip: Record<number, number>,
  glow: Record<number, number>,
  images: Map<string, HTMLImageElement>,
  font: string,
) {
  const u = drawBoardBase(ctx, w, h);
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillStyle = "#facc15";
  ctx.font = `800 ${u * 6.4}px ${font}`;
  (ctx as Spacing).letterSpacing = `${u * 0.8}px`;
  ctx.fillText("PODIUM", w / 2, h * 0.07);
  (ctx as Spacing).letterSpacing = "0px";
  ctx.fillStyle = "#e9e1f2";
  ctx.font = `700 ${u * 3.3}px ${font}`;
  ctx.fillText("Meilleure décoration Halloween", w / 2, h * 0.118);
  ctx.fillStyle = "#b3abc0";
  ctx.font = `600 ${u * 2.7}px ${font}`;
  const total = data?.total ?? 0;
  ctx.fillText(`Concours terminé · ${total.toLocaleString("fr-FR")} vote${total > 1 ? "s" : ""}`, w / 2, h * 0.152);

  if (slots.length === 0) {
    ctx.fillStyle = "#f5f1e8";
    ctx.font = `600 ${u * 4}px ${font}`;
    ctx.fillText(data ? "Aucun vote" : "…", w / 2, h * 0.55);
  }

  for (const box of boxes) {
    const slot = slots.find((s) => s.place === box.place);
    const medal = MEDALS[(slot?.rank ?? box.place) - 1];
    // Marche : pierre sombre, arête supérieure à la couleur de la médaille, grand numéro.
    const sx = box.step.x * w, sy = box.step.y * h, sw = box.step.w * w, sh = box.step.h * h;
    const stone = ctx.createLinearGradient(0, sy, 0, sy + sh);
    stone.addColorStop(0, "#3d3349");
    stone.addColorStop(1, "#1f1927");
    ctx.fillStyle = stone;
    ctx.beginPath();
    ctx.roundRect(sx, sy, sw, sh, [u * 1.2, u * 1.2, 0, 0]);
    ctx.fill();
    ctx.fillStyle = slot ? medal[1] : "#4a4156";
    ctx.fillRect(sx + u, sy, sw - u * 2, u * 0.5);
    const numSize = Math.min(sh * 0.62, u * 9);
    ctx.font = `800 ${numSize}px ${font}`;
    if (slot) {
      const g = ctx.createLinearGradient(0, sy + sh / 2 - numSize / 2, 0, sy + sh / 2 + numSize / 2);
      g.addColorStop(0, medal[0]);
      g.addColorStop(0.55, medal[1]);
      g.addColorStop(1, medal[2]);
      ctx.fillStyle = g;
    } else ctx.fillStyle = "#4a4156";
    ctx.fillText(String(slot?.rank ?? box.place), sx + sw / 2, sy + sh * 0.55);
    if (!slot) continue;

    // Carte : retournement horizontal (voilée → dévoilée), éclat de la médaille autour.
    const f = flip[box.place] ?? 0;
    const shown = f >= 0.5;
    const cx = (box.card.x + box.card.w / 2) * w;
    const x = box.card.x * w, y = box.card.y * h, cw = box.card.w * w, ch = box.card.h * h;
    ctx.save();
    ctx.translate(cx, 0);
    ctx.scale(Math.max(0.02, Math.abs(Math.cos(Math.PI * f))), 1);
    ctx.translate(-cx, 0);
    const halo = shown ? (glow[box.place] ?? 0) : 0;
    if (shown) {
      ctx.shadowColor = medal[1];
      ctx.shadowBlur = u * (slot.place === 1 ? 4 : 2.2) + u * 9 * halo;
    }
    ctx.fillStyle = shown ? "#201a29" : "#18131f";
    ctx.beginPath();
    ctx.roundRect(x, y, cw, ch, u * 1.6);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = u * (shown && slot.place === 1 ? 0.6 : 0.4);
    ctx.strokeStyle = shown ? medal[1] : "#4a4156";
    ctx.stroke();
    const px = box.photo.x * w, py = box.photo.y * h, pw = box.photo.w * w, ph = box.photo.h * h;
    if (!shown) {
      const veil = ctx.createLinearGradient(0, py, 0, py + ph);
      veil.addColorStop(0, "#2a2233");
      veil.addColorStop(1, "#16121c");
      ctx.fillStyle = veil;
      ctx.beginPath();
      ctx.roundRect(px, py, pw, ph, u * 1.1);
      ctx.fill();
      ctx.fillStyle = "#5b5068";
      ctx.font = `800 ${pw * 0.5}px ${font}`;
      ctx.fillText("?", px + pw / 2, py + ph * 0.52);
    } else {
      drawCover(ctx, images.get(slot.entry.image_url), px, py, pw, ph, u * 1.1);
      const name = fitLines(ctx, shortName(slot.entry.restaurant_name).toUpperCase(), cw * 0.9, u * 3.1, font);
      ctx.fillStyle = medal[slot.rank === 1 ? 1 : 0];
      ctx.font = `800 ${name.size}px ${font}`;
      const textTop = py + ph + u * 1.4;
      name.lines.forEach((line, i) => ctx.fillText(line, cx, textTop + name.size * (0.55 + i * 1.08)));
      ctx.fillStyle = "#b3abc0";
      ctx.font = `600 ${u * 2.4}px ${font}`;
      const votes = slot.entry.votes;
      ctx.fillText(`${votes} vote${votes > 1 ? "s" : ""} · ${(Math.round(slot.entry.share * 1000) / 10).toLocaleString("fr-FR")} %`, cx, y + ch - u * 1.8);
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// Salle construite avec le pack KayKit Dungeon (murs, piliers, dalles, plafond, torches,
// étagères, tonneaux…) + Halloween Bits (citrouilles, crânes, os, cercueil).
// ---------------------------------------------------------------------------

export function createCrypt(kit: Kit, hooks: CryptHooks = {}): CryptArea {
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

  // ----- Mode podium : un public de squelettes qui applaudit (bas de l'écran), couronnes, étincelles, confettis -----
  /**
   * Public : beaucoup de paires de mains (main + avant-bras KayKit, une seule géométrie instanciée :
   * un seul appel de dessin, quel que soit le nombre de mains), en trois rangées de profondeur. Chaque
   * paire applaudit vite, à sa propre cadence et avec son propre décalage, comme une vraie foule.
   * Téléphones modestes (kit.low) : moins de paires.
   */
  const CROWD = kit.low ? 10 : 18;
  /** [mains gauches, mains droites] : deux appels de dessin pour tout le public. */
  const crowdMeshes = [false, true].map((right) => {
    const m = new THREE.InstancedMesh(createClapHandGeometry(right), M, CROWD);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false;
    m.visible = false;
    group.add(m);
    return m;
  });
  const showCrowd = (on: boolean) => crowdMeshes.forEach((m) => (m.visible = on));
  const ROWS = [
    { depth: 2.3, scale: 1.3, up: 0 },
    { depth: 3.1, scale: 1.15, up: 0.05 },
    { depth: 4.1, scale: 1.05, up: 0.09 },
  ];
  const crowd = (() => {
    const r = seeded(41);
    const counts = [Math.round(CROWD * 0.28), Math.round(CROWD * 0.34)];
    counts.push(CROWD - counts[0] - counts[1]);
    return counts.flatMap((n, row) =>
      Array.from({ length: n }, (_, j) => ({
        row,
        // Réparties sur la largeur, rangées décalées d'une demi-place, un peu de désordre.
        fx: -0.94 + ((j + (row === 1 ? 0.25 : row === 2 ? 0.75 : 0.5)) * 1.88) / n + (r() - 0.5) * (0.5 / n),
        scale: ROWS[row].scale * (0.9 + r() * 0.2),
        speed: 0.8 + r() * 0.45,
        lag: r(),
        rise: r() * 0.05,
        tilt: (r() - 0.5) * 0.25,
      })),
    );
  })();
  const hm = new THREE.Matrix4();
  const hx = new THREE.Vector3();
  const hy = new THREE.Vector3();
  const hz = new THREE.Vector3();
  const hp = new THREE.Vector3();
  /** Couronne de chaque place ; `drop` : temps écoulé depuis le début de la chute (négatif : attente), null : posée. */
  const crowns = new Map<number, { obj: THREE.Mesh; rank: number; drop: number | null }>();
  const SPARKS = 40;
  const sparks = new Billboards(SPARKS, kit.glowTex, true);
  sparks.mesh.renderOrder = 3;
  group.add(sparks.mesh);
  const sparkState = Array.from({ length: SPARKS }, () => ({ alive: false, t: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, size: 0 }));
  let nextSpark = 0;
  const CONFETTI = kit.low ? 110 : 240;
  const CONFETTI_COLORS = ["#facc15", "#ff7a1a", "#8b5cf6", "#10b981", "#f3e9d2", "#ef4444", "#38bdf8"];
  const confettiMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.07, 0.12), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), CONFETTI);
  confettiMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  confettiMesh.frustumCulled = false;
  confettiMesh.visible = false;
  const confetti = Array.from({ length: CONFETTI }, (_, i) => {
    // Papier sous la lumière des torches : couleurs vives, un peu assombries.
    confettiMesh.setColorAt(i, new THREE.Color(CONFETTI_COLORS[i % CONFETTI_COLORS.length]).multiplyScalar(0.82));
    return { alive: false, rest: false, delay: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, rz: 0, wx: 0, wz: 0, ph: 0 };
  });
  group.add(confettiMesh);
  const cMat = new THREE.Matrix4();
  const cPos = new THREE.Vector3();
  const cQuat = new THREE.Quaternion();
  const cEuler = new THREE.Euler();
  const cOne = new THREE.Vector3(1, 1, 1);
  const cZero = new THREE.Vector3(0, 0, 0);

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

  // ----- Podium (concours terminé) -----
  let podium = false;
  let slots: PodiumSlot[] = [];
  const boxes = podiumLayout(size.h / size.w);
  /** Retournement des cartes (0 voilée → 1 dévoilée), null : pas commencé ; éclat au dévoilement. */
  const flip: Record<number, number> = {};
  const flipping = new Set<number>();
  const glow: Record<number, number> = {};
  /** Cérémonie : temps écoulé, cadence des applaudissements, étapes déjà jouées. */
  let ceremony: {
    t: number;
    phase: number;
    claps: number;
    gap: number;
    fired: Set<string>;
    /** Mains écartées (0) → applaudissements (1). */
    blend: number;
    /** Instants (s) déjà annoncés au son. */
    sounds: Set<string>;
    done: () => void;
  } | null = null;
  /** Instants de la cérémonie (s) : bras qui montent, dévoilements, roulement de tambour, sortie. */
  // Le roulement de tambour (public/son/sfx/drumroll.mp3) dure 4 s et s'achève sur le gagnant.
  const CER = { armsIn: 0.9, at: { 3: 2.4, 2: 5.6, 1: 11.6 } as Record<number, number>, drum: 7.6, clapEnd: 15.4, armsOut: 15.8, end: 16.6 };

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
    if (podium) drawPodium(ctx, resultsCanvas.width, resultsCanvas.height, data, slots, boxes, flip, glow, images, font);
    else drawResults(ctx, resultsCanvas.width, resultsCanvas.height, data, shares, images, font);
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

  // ----- Podium : cartes, couronnes, étincelles, confettis, bras qui applaudissent -----

  /** Point du panneau (fractions, origine en haut à gauche) → repère de la crypte, `dz` devant le panneau. */
  const boardPoint = (fx: number, fy: number, dz = 0) => new THREE.Vector3((fx - 0.5) * size.w, plaqueCY + (0.5 - fy) * size.h, WALL_Z + 0.06 + dz);
  const bounceOut = (x: number) => {
    const n = 7.5625, d = 2.75;
    if (x < 1 / d) return n * x * x;
    if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75;
    if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375;
    return n * (x -= 2.625 / d) * x + 0.984375;
  };

  /**
   * Couronnes 2D (emoji « couronne » Fluent, la famille des emojis du site, recoloré en or / argent /
   * bronze : public/decor/crown-{1,2,3}.svg, scripts/crown-variants.py), rastérisées en 512 px.
   */
  const crownTex = ([1, 2, 3] as const).map((rank) => {
    const c = document.createElement("canvas");
    c.width = c.height = 512;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      c.getContext("2d")?.drawImage(img, 0, 0, 512, 512);
      tex.needsUpdate = true;
    };
    img.src = `${BASE_PATH}/decor/crown-${rank}.svg`;
    return tex;
  });
  const crownGeo = new THREE.PlaneGeometry(1, 1);
  function crownFor(place: number, rank: 1 | 2 | 3) {
    let c = crowns.get(place);
    if (!c) {
      const obj = new THREE.Mesh(crownGeo, new THREE.MeshBasicMaterial({ map: crownTex[rank - 1], transparent: true, depthWrite: false }));
      obj.renderOrder = 4;
      obj.visible = false;
      group.add(obj);
      c = { obj, rank, drop: null };
      crowns.set(place, c);
    } else if (c.rank !== rank) {
      (c.obj.material as THREE.MeshBasicMaterial).map = crownTex[rank - 1];
      c.rank = rank;
    }
    return c;
  }

  /**
   * Couronne posée sur le haut de la carte (le bas de la couronne, à 89 % de l'image, sur le bord de la
   * carte) ; pendant la chute, elle tombe droit et rebondit avant de se poser. Jamais de rotation.
   */
  function placeCrown(place: number) {
    const c = crowns.get(place);
    const box = boxes[place - 1];
    if (!c || !box) return;
    const P = box.card.w * size.w * (place === 1 ? 1.05 : 0.92);
    const base = boardPoint(box.crown.x, box.card.y + 0.008, 0.05);
    let lift = 0;
    if (c.drop !== null) {
      c.obj.visible = c.drop >= 0;
      lift = (1 - bounceOut(THREE.MathUtils.clamp(c.drop / 0.85, 0, 1))) * 1.7;
    } else c.obj.visible = true;
    c.obj.position.set(base.x, base.y + P * 0.39 + lift, base.z);
    c.obj.scale.set(P, P, 1);
  }

  function burstSparks(place: number, color: string, count: number) {
    const box = boxes[place - 1];
    const c = boardPoint(box.card.x + box.card.w / 2, box.card.y + box.card.h * 0.45, 0.3);
    sparks.color.set(color);
    for (let i = 0; i < count; i++) {
      const sp = sparkState[nextSpark];
      nextSpark = (nextSpark + 1) % SPARKS;
      const a = rand(0, Math.PI * 2);
      const v = rand(1.2, 2.6);
      Object.assign(sp, { alive: true, t: 0, x: c.x, y: c.y, z: c.z, vx: Math.cos(a) * v, vy: Math.sin(a) * v + 0.6, vz: rand(0.2, 1), size: rand(0.18, 0.4) });
    }
  }

  function burstConfetti() {
    confettiMesh.visible = true;
    confetti.forEach((c, i) => {
      const kind = i % 3; // 0 : canon gauche, 1 : canon droit, 2 : pluie du plafond
      if (kind < 2) {
        const side = kind === 0 ? -1 : 1;
        Object.assign(c, { delay: rand(0, 0.45), x: side * (size.w / 2 + 0.5), y: PLAQUE_BOTTOM + 0.2, z: WALL_Z + 0.7, vx: -side * rand(0.5, 2.3), vy: rand(4.6, 7.2), vz: rand(0.5, 2.6) });
      } else {
        Object.assign(c, { delay: rand(0.25, 2.8), x: rand(-4.6, 4.6), y: ROOM.h - 0.25, z: rand(WALL_Z + 0.6, WALL_Z + 6), vx: 0, vy: rand(-0.5, 0), vz: 0 });
      }
      Object.assign(c, { alive: true, rest: false, rx: rand(0, 6), ry: rand(0, 6), rz: rand(0, 6), wx: rand(3, 7), wz: rand(2, 6), ph: rand(0, 6) });
    });
  }

  function updateConfetti(t: number, dt: number) {
    if (!confettiMesh.visible) return;
    confetti.forEach((c, i) => {
      if (!c.alive || c.delay > 0) {
        c.delay -= dt;
        cMat.compose(cPos.set(0, -50, 0), cQuat.identity(), cZero);
        confettiMesh.setMatrixAt(i, cMat);
        return;
      }
      if (!c.rest) {
        c.vy = Math.max(c.vy - 5.2 * dt, -1.2); // le papier plane : vitesse de chute limitée
        c.vx *= 1 - 1.3 * dt;
        c.vz *= 1 - 1.3 * dt;
        c.x = THREE.MathUtils.clamp(c.x + (c.vx + Math.sin(t * c.wx + c.ph) * 0.35) * dt, -W + 0.4, W - 0.4);
        c.y += c.vy * dt;
        c.z = THREE.MathUtils.clamp(c.z + (c.vz + Math.cos(t * c.wz + c.ph) * 0.25) * dt, WALL_Z + 0.3, ROOM.d / 2 - 0.4);
        c.rx += dt * c.wx;
        c.rz += dt * c.wz * 0.7;
        if (c.y <= 0.012) {
          // Au sol : à plat, il y reste.
          c.y = 0.012;
          c.rest = true;
          c.rx = -Math.PI / 2;
          c.rz = 0;
        }
      }
      cMat.compose(cPos.set(c.x, c.y, c.z), cQuat.setFromEuler(cEuler.set(c.rx, c.ry, c.rz)), cOne);
      confettiMesh.setMatrixAt(i, cMat);
    });
    confettiMesh.instanceMatrix.needsUpdate = true;
  }

  /** Voile le podium : cartes retournées, couronnes rangées, bras cachés, confettis retirés. */
  function resetPodium() {
    ceremony = null;
    for (const p of [1, 2, 3]) {
      flip[p] = 0;
      glow[p] = 0;
    }
    flipping.clear();
    for (const c of crowns.values()) c.obj.visible = false;
    showCrowd(false);
    for (const sp of sparkState) sp.alive = false;
    confettiMesh.visible = false;
    for (const c of confetti) c.alive = false;
    dirty = true;
  }

  /** Podium final : toutes les places dévoilées, couronnes posées (fin de la cérémonie, ou passée). */
  function finishCeremony() {
    if (ceremony) hooks.onSound?.({ type: "crowd", level: 0 });
    ceremony = null;
    showCrowd(false);
    for (const slot of slots) {
      flip[slot.place] = 1;
      glow[slot.place] = 0;
      crownFor(slot.place, slot.rank).drop = null;
    }
    flipping.clear();
    revealed = true;
    dirty = true;
    hooks.onCeremony?.("end");
  }

  /** Dévoilement d'une place : la carte se retourne, la couronne tombe, fanfare. */
  function revealPlace(place: 1 | 2 | 3) {
    const slot = slots.find((sl) => sl.place === place);
    if (!slot) return;
    flip[place] = 0;
    flipping.add(place);
    crownFor(place, slot.rank).drop = -0.45;
    hooks.onCeremony?.(place);
    hooks.onSound?.({ type: "podium", place });
    if (place === 1) burstConfetti();
  }

  /**
   * Public de mains, vu « en jeu » : chaque paire se tient en bas de l'écran (avant-bras qui sortent
   * du bord), le bout des doigts toujours sous le cadre du panneau ; les deux mains se rejoignent et
   * s'écartent vite. `blend` : 0 mains écartées (roulement), 1 applaudissements ; `lift` : montée ;
   * `shake` : tremblement pendant le roulement. Repère caméra déjà calculé.
   */
  function placeCrowd(cam: THREE.PerspectiveCamera, phase: number, blend: number, lift: number, drum: boolean, t: number) {
    const tanH = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const toBottom = new THREE.Vector3(0, PLAQUE_BOTTOM - 0.3, WALL_Z).sub(camPos);
    const bottomSlope = toBottom.dot(camUp) / Math.max(0.1, toBottom.dot(camFwd));
    crowd.forEach((h, i) => {
      const row = ROWS[h.row];
      const S = h.scale;
      const halfH = row.depth * tanH;
      const halfW = halfH * cam.aspect;
      const up = Math.min(-halfH * (0.82 - row.up - h.rise), bottomSlope * row.depth - 0.24 * S);
      const ph = Math.max(0, phase * h.speed - h.lag);
      const clap = 0.5 - 0.5 * Math.cos(Math.PI * 2 * ph);
      const gap = 1 + (clap - 1) * blend;
      const halfGap = 0.03 * S + gap * Math.min(0.11 * S, halfW * 0.05);
      const shake = drum ? Math.sin(t * 43 + i * 1.7) * 0.008 * S : 0;
      // Doigts vers le haut, penchés vers le mur ; légère inclinaison propre à chaque paire.
      hy.copy(camUp).multiplyScalar(0.9).addScaledVector(camFwd, 0.32).addScaledVector(camRight, h.tilt * 0.3).normalize();
      for (const side of [-1, 1]) {
        // side -1 : main gauche (paume vers la droite) ; +1 : main droite (miroir).
        hp.copy(camPos)
          .addScaledVector(camFwd, row.depth)
          .addScaledVector(camRight, h.fx * halfW + side * halfGap)
          .addScaledVector(camUp, up - (1 - lift) * halfH * 1.2 + shake * side)
          .addScaledVector(hy, -0.11 * S);
        hx.copy(camRight).addScaledVector(hy, -camRight.dot(hy)).normalize();
        hz.crossVectors(hx, hy);
        hm.makeBasis(hx, hy, hz).scale(hz.setScalar(S)).setPosition(hp);
        crowdMeshes[side < 0 ? 0 : 1].setMatrixAt(i, hm);
      }
    });
    for (const m of crowdMeshes) m.instanceMatrix.needsUpdate = true;
  }

  /** Horloge réelle du podium : la cérémonie dure le même temps (sons calés) même si les images ralentissent. */
  let podiumClock = 0;
  function updatePodium(t: number, frameDt: number, camera: THREE.Camera) {
    const now = performance.now();
    const dt = podiumClock ? Math.min(0.25, Math.max(frameDt, (now - podiumClock) / 1000)) : frameDt;
    podiumClock = now;
    // Cartes qui se retournent ; éclat de la médaille à mi-retournement.
    for (const p of [...flipping]) {
      const before = flip[p];
      flip[p] = Math.min(1, before + dt / 0.7);
      const slot = slots.find((sl) => sl.place === p);
      if (before < 0.5 && flip[p] >= 0.5 && slot) {
        glow[p] = 1;
        burstSparks(p, MEDALS[slot.rank - 1][1], p === 1 ? 26 : 16);
      }
      if (flip[p] >= 1) flipping.delete(p);
      dirty = true;
    }
    for (const p of [1, 2, 3]) {
      if (glow[p] > 0 && !flipping.has(p)) {
        glow[p] = Math.max(0, glow[p] - dt / 1.6);
        dirty = true;
      }
    }
    for (const [place, c] of crowns) {
      if (c.drop !== null) {
        c.drop += dt;
        if (c.drop > 0.85) c.drop = null;
      }
      if (slots.some((sl) => sl.place === place) && (flip[place] ?? 0) > 0) placeCrown(place);
      else c.obj.visible = false;
    }
    // Étincelles
    sparkState.forEach((sp, i) => {
      if (!sp.alive) return sparks.hide(i);
      sp.t += dt;
      if (sp.t > 1.1) {
        sp.alive = false;
        return sparks.hide(i);
      }
      sp.vy -= 2.2 * dt;
      const k = sp.t / 1.1;
      sparks.set(i, sp.x + sp.vx * sp.t * 0.6, sp.y + sp.vy * sp.t * 0.5, sp.z + sp.vz * sp.t, (1 - k) * (1 - k), 0, sp.size * (1 - k * 0.5));
    });
    sparks.commit();
    updateConfetti(t, dt);

    if (!ceremony) return;
    const cer = ceremony;
    cer.t += dt;
    const T = cer.t;
    for (const place of REVEAL_ORDER) {
      const key = `p${place}`;
      if (T >= CER.at[place] && !cer.fired.has(key)) {
        cer.fired.add(key);
        revealPlace(place);
      }
    }
    if (T >= CER.drum && !cer.fired.has("drum") && slots.some((sl) => sl.place === 1)) {
      cer.fired.add("drum");
      hooks.onCeremony?.("drumroll");
      hooks.onSound?.({ type: "drumroll" });
      hooks.onSound?.({ type: "crowd", level: 0.15 }); // la foule retient son souffle
    }
    if (T >= CER.armsIn * 0.5 && !cer.sounds.has("in")) {
      cer.sounds.add("in");
      hooks.onSound?.({ type: "crowd", level: 0.35 });
    }
    if (T >= CER.armsOut && !cer.sounds.has("out")) {
      cer.sounds.add("out");
      hooks.onSound?.({ type: "crowd", level: 0 });
    }
    // Cadence vive (≈ 3 à 6 applaudissements par seconde selon les paires), de plus en plus rapide ;
    // pendant le roulement, mains écartées qui tremblent.
    const period = T < CER.at[3] ? 0.26 : T < CER.at[2] ? 0.22 : T < CER.drum ? 0.2 : T < CER.at[1] ? 0 : T < CER.clapEnd ? 0.17 : 0;
    const drum = T >= CER.drum && T < CER.at[1];
    if (period > 0) {
      cer.phase += dt / period;
      cer.blend = Math.min(1, cer.blend + dt * 4);
    } else cer.blend = Math.max(0, cer.blend - dt * 6);
    const lift = T < CER.armsIn ? smooth(0, 1, T / CER.armsIn) : T > CER.armsOut ? 1 - smooth(0, 1, (T - CER.armsOut) / (CER.end - CER.armsOut - 0.05)) : 1;
    const cam = camera as THREE.PerspectiveCamera;
    cam.updateMatrixWorld();
    camRight.setFromMatrixColumn(cam.matrixWorld, 0).normalize();
    camUp.setFromMatrixColumn(cam.matrixWorld, 1).normalize();
    camFwd.setFromMatrixColumn(cam.matrixWorld, 2).normalize().negate();
    camPos.setFromMatrixPosition(cam.matrixWorld).sub(group.position);
    showCrowd(true);
    placeCrowd(cam, cer.phase, cer.blend, lift, drum, t);
    if (T >= CER.end) {
      const done = cer.done;
      finishCeremony();
      done();
    }
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
      if (!revealed || !group.visible) return null;
      const hit = ray.intersectObject(plaque, false)[0];
      if (!hit) return null;
      if (!podium) return { place: null };
      // Carte ou marche d'une place occupée (uv : origine en bas à gauche).
      const place = hit.uv ? slotAt(boxes.filter((b) => slots.some((sl) => sl.place === b.place)), hit.uv.x, 1 - hit.uv.y) : null;
      return place ? { place } : null;
    },
    setPodium(on) {
      if (on === podium) return;
      podium = on;
      if (on) fillDust(0);
      else if (!revealed) fillDust(1);
      dirty = true;
    },
    skip() {
      if (!ceremony) return;
      const done = ceremony.done;
      finishCeremony();
      done();
    },
    entrance() {
      return { pos: new THREE.Vector3(O.x, 2.4, ROOM.d / 2 - 0.2), target: new THREE.Vector3(O.x, plaqueCY - 0.3, WALL_Z) };
    },
    setResults(next) {
      const prev = new Map((data?.results ?? []).map((x) => [x.id, x.share]));
      from.clear();
      for (const res of next.results) from.set(res.id, revealed ? (prev.get(res.id) ?? 0) : res.share);
      data = next;
      slots = podiumSlots(next.results);
      anim = revealed && !kit.reduce ? 0 : 1;
      for (const res of next.results) {
        if (images.has(res.image_url)) continue;
        const img = new Image();
        img.decoding = "async";
        img.onload = () => (dirty = true);
        // Médias locaux (/seed, /uploads) : fichier direct, comme `unoptimized` ailleurs (l'optimiseur
        // d'images ignore le basePath et tombe sur la redirection : 500). Les autres : vignette optimisée.
        img.src = res.image_url.startsWith("/") ? `${BASE_PATH}${res.image_url}` : `${BASE_PATH}/_next/image?url=${encodeURIComponent(res.image_url)}&w=256&q=75`;
        images.set(res.image_url, img);
      }
      dirty = true;
    },
    resetDust() {
      revealed = false;
      reveal = null;
      arm.root.visible = false;
      resetPodium();
      fillDust(podium ? 0 : 1);
    },
    reveal(onDone, force = false) {
      if (podium) {
        if (kit.reduce || !(force || (hooks.shouldPlayCeremony?.() ?? true))) {
          finishCeremony();
          onDone();
          return;
        }
        resetPodium();
        ceremony = { t: 0, phase: 0, claps: 0, gap: 1, fired: new Set(), blend: 0, sounds: new Set(), done: onDone };
        return;
      }
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
      if (podium) updatePodium(t, dt, camera);
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
