/**
 * Monde 3D unique partagé par tout le site public. Trois lieux, une seule caméra :
 *  - « graveyard » : le cimetière (accueil + questions) ;
 *  - « reaper »    : la clairière de la faucheuse (tirage au sort + remerciements) ;
 *  - « crypt »     : l'intérieur de la crypte, où le classement apparaît sur le mur.
 * La caméra voyage de l'un à l'autre (travelling, entrée par la porte de la crypte).
 *
 * Performances mobiles : un matériau texturé partagé, un nombre FIXE de lumières (un « pool »
 * attribué aux flammes les plus proches : aucun recompilage de shader), particules
 * instanciées, lieux masqués quand ils ne sont pas visibles, résolution réduite si le
 * téléphone peine.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import type { Theme } from "@/lib/theme";
import { Billboards, easeInOut, flicker, glowTexture, rand, shadowTexture, smokeTexture, smooth } from "./core";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { createCrypt, type CryptArea, type ResultsData } from "./crypt";
import { createGraveyard, createGround, createReaperClearing, outdoorPose, type GraveyardArea } from "./outdoor";
import type { Area, Flame, Frame, Kit, Pose, SceneName } from "./types";

export type { ResultsData } from "./crypt";
export type { SceneName } from "./types";

export type WorldOptions = {
  theme: Theme;
  reducedMotion: boolean;
  /** "low" : téléphones modestes (moins de particules, de lumières et de pixels). */
  quality: "high" | "low";
  /** Passage dedans / dehors (le ciel CSS se masque dans la crypte). */
  onIndoor?: (indoor: boolean) => void;
  /** Le classement vient d'être dévoilé. */
  onReveal?: () => void;
  /** Clic sur le panneau du classement (dans la crypte, une fois dépoussiéré). */
  onPlaqueClick?: () => void;
  /** Tape sur la lune (objet 3D du ciel), avec le point touché à l'écran. */
  onMoonTap?: (point: { x: number; y: number }) => void;
};

export type World = {
  ready: Promise<void>;
  setTheme(theme: Theme): void;
  setScene(scene: SceneName): void;
  /** Une nuée de chauves-souris s'envole du lieu courant. */
  swarm(size?: number): void;
  setResults(data: ResultsData): void;
  /** Easter egg : 0 → 1, la lune s'illumine à mesure des tapes (et sursaute à chaque tape). */
  setMoonCharge(charge: number): void;
  /** Centre de la lune à l'écran (px), ou null si elle n'est pas visible. */
  moonScreenPoint(): { x: number; y: number } | null;
  dispose(): void;
};

const MODEL_URL = "/3d/halloween.glb";
/** Faucheuse : KayKit « Skeleton Rogue » (CC0), capuche repeinte, 3 animations. */
const REAPER_URL = "/3d/reaper.glb";
/** Rochers, arbres nus, buissons (KayKit Forest Nature, feuillage assombri). */
const FOREST_URL = "/3d/forest.glb";
/** Salle de la crypte (KayKit Dungeon) — chargée seulement quand on s'en approche. */
const DUNGEON_URL = "/3d/dungeon.glb";
/** Atlas Dungeon seul (violet, or, bois…) pour le chaudron, les cadeaux, la faux, les chapeaux. */
const DUNGEON_TEX_URL = "/3d/dungeon_texture.png";
/** Logos Chamas Tacos 3D style KayKit (versions Halloween) : wordmark au cimetière, badge dans la crypte. */
const LOGOS_URL = "/3d/logos.glb";

type Palette = {
  fog: string; near: number; far: number;
  hemiSky: string; hemiGround: string; hemi: number;
  sun: string; sunI: number;
  ground: string;
  lights: number; glow: number;
  mist: string; mistA: number;
  smoke: string; smokeA: number;
  eyes: number; bat: string; batGlow: string;
};

const OUTDOOR: Record<Theme, Palette> = {
  dark: {
    fog: "#160f22", near: 12, far: 44, hemiSky: "#6d65a3", hemiGround: "#150d1a", hemi: 0.6, sun: "#9fb0f2", sunI: 0.78,
    ground: "#241c2d", lights: 0.92, glow: 0.88, mist: "#8a7eae", mistA: 0.32, smoke: "#988fac", smokeA: 0.3, eyes: 1, bat: "#43375a", batGlow: "#1f1630",
  },
  light: {
    fog: "#e9d6bf", near: 9, far: 40, hemiSky: "#f3e8d2", hemiGround: "#a48c66", hemi: 1.45, sun: "#f6e6c6", sunI: 1.6,
    ground: "#a8936c", lights: 0.2, glow: 0.12, mist: "#ffffff", mistA: 0.36, smoke: "#ffffff", smokeA: 0.22, eyes: 0, bat: "#3a3040", batGlow: "#000000",
  },
};

const INDOOR: Record<Theme, Palette> = {
  dark: {
    fog: "#09070d", near: 8, far: 30, hemiSky: "#5d5070", hemiGround: "#160f0c", hemi: 0.3, sun: "#ffa860", sunI: 0.12,
    ground: "#241c2d", lights: 0.9, glow: 0.85, mist: "#8a7eae", mistA: 0, smoke: "#b9af98", smokeA: 0.2, eyes: 1, bat: "#43375a", batGlow: "#1f1630",
  },
  light: {
    fog: "#2b2431", near: 10, far: 40, hemiSky: "#c9bcd6", hemiGround: "#4a3a30", hemi: 1.1, sun: "#ffd6a0", sunI: 0.6,
    ground: "#241c2d", lights: 0.85, glow: 0.7, mist: "#ffffff", mistA: 0, smoke: "#e8e0d0", smokeA: 0.2, eyes: 0.4, bat: "#3a3040", batGlow: "#000000",
  },
};

// ---------------------------------------------------------------------------
// Chauves-souris : silhouette low-poly, battement d'ailes dans le vertex shader.
// ---------------------------------------------------------------------------

function batGeometry() {
  const v: number[] = [];
  const tri = (a: number[], b: number[], c: number[]) => v.push(...a, ...b, ...c);
  const R = [0.03, 0, -0.02];
  const wing = [
    [0.03, 0, 0.06], [0.3, 0.01, 0.13], [0.64, 0, 0.02], [0.48, 0, -0.07], [0.5, 0, -0.2],
    [0.33, 0, -0.1], [0.3, 0, -0.24], [0.15, 0, -0.12], [0.03, 0, -0.1],
  ];
  for (const side of [1, -1]) {
    const w = wing.map(([x, y, z]) => [x * side, y, z]);
    const r = [R[0] * side, R[1], R[2]];
    for (let i = 0; i < w.length - 1; i++) tri(r, w[i], w[i + 1]);
    tri([0.012 * side, 0.03, 0.13], [0.035 * side, 0.09, 0.11], [0.04 * side, 0.02, 0.1]);
  }
  const [nose, r1, tail, l1, belly] = [[0, 0.04, 0.15], [0.04, 0, 0.02], [0, 0.03, -0.14], [-0.04, 0, 0.02], [0, -0.035, 0.02]];
  tri(nose, r1, tail); tri(nose, tail, l1); tri(belly, r1, nose); tri(belly, nose, l1); tri(belly, tail, r1); tri(belly, l1, tail);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
  geo.computeVertexNormals();
  return geo;
}

type Bat = { active: boolean; t0: number; dur: number; p: THREE.Vector3[]; wobble: number; scale: number };

// ---------------------------------------------------------------------------
// Yeux : deux amandes lumineuses avec pupille fendue, halo additif.
// ---------------------------------------------------------------------------

const EYES_VERT = /* glsl */ `
  attribute vec4 aEye;
  attribute vec3 aColor;
  varying vec2 vUv;
  varying vec4 vEye;
  varying vec3 vColor;
  void main() {
    vUv = uv;
    vEye = aEye;
    vColor = aColor;
    vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    mvPosition.xy += position.xy * aEye.w;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const EYES_FRAG = /* glsl */ `
  varying vec2 vUv;
  varying vec4 vEye;
  varying vec3 vColor;
  float eye(vec2 p, float cx, float open, float look) {
    vec2 q = p - vec2(cx, 0.0);
    float ry = max(0.004, 0.07 * open);
    float d = length(vec2(q.x / 0.12, q.y / ry));
    float shape = 1.0 - smoothstep(0.82, 1.0, d);
    float pupil = smoothstep(0.012, 0.03, abs(q.x - look * 0.035)) * 0.65 + 0.35;
    float core = shape * pupil * (1.25 - 0.45 * d);
    float halo = exp(-dot(q, q) * 55.0) * 0.55 * open;
    return core + halo;
  }
  void main() {
    if (vEye.x < 0.002) discard;
    vec2 p = vec2(vUv.x - 0.5, (vUv.y - 0.5) * 0.42);
    float v = eye(p, -0.2, vEye.y, vEye.z) + eye(p, 0.2, vEye.y, vEye.z);
    gl_FragColor = vec4(vColor * v * vEye.x, 1.0);
  }
`;

type EyeSlot = { spot: number; phase: "off" | "in" | "on" | "out"; t: number; until: number; nextBlink: number; blinkT: number; look: number; lookTarget: number };
const EYE_COLORS = ["#ffcf3a", "#ff5a2a", "#a6ff4d", "#ffb347"].map((c) => new THREE.Color(c));

// ---------------------------------------------------------------------------
// Plans de caméra (enchaînés les uns après les autres)
// ---------------------------------------------------------------------------

type Shot = {
  dur: number;
  pose(u: number): Pose;
  fade?: (u: number) => number;
  start?: () => void;
  progress?: (u: number) => void;
  end?: () => void;
};

export function createWorld(canvas: HTMLCanvasElement, opts: WorldOptions): World {
  const low = opts.quality === "low";
  const reduce = opts.reducedMotion;
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !low, powerPreference: "low-power" });
  let pixelRatio = Math.min(window.devicePixelRatio || 1, low ? 1.25 : 1.75);
  renderer.setPixelRatio(pixelRatio);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 160);
  scene.add(camera);
  let theme = opts.theme;
  let indoor = false;
  const palette: Palette = structuredClone(OUTDOOR[theme]);
  const target = () => (indoor ? INDOOR : OUTDOOR)[theme];

  scene.fog = new THREE.Fog(palette.fog, palette.near, palette.far);
  const hemi = new THREE.HemisphereLight(palette.hemiSky, palette.hemiGround, palette.hemi);
  const sun = new THREE.DirectionalLight(palette.sun, palette.sunI);
  sun.position.set(-8, 12, 6);
  scene.add(hemi, sun, sun.target);

  // Pool de lumières : nombre constant, attribué chaque image aux flammes les plus proches.
  const POOL = low ? 3 : 6;
  const pool = Array.from({ length: POOL }, () => {
    const l = new THREE.PointLight("#ff8a2a", 0, 6, 1.6);
    scene.add(l);
    return l;
  });

  // Fondu au noir (entrée / sortie de la crypte), attaché à la caméra.
  const fadeMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false });
  const fadeQuad = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), fadeMat);
  fadeQuad.position.z = -0.2;
  fadeQuad.renderOrder = 999;
  fadeQuad.frustumCulled = false;
  camera.add(fadeQuad);

  const time = { value: 0 };
  const glowTex = glowTexture();
  const smokeTex = smokeTexture();
  const shadowTex = shadowTexture();
  const modelMat = new THREE.MeshLambertMaterial();
  const dungeonMat = new THREE.MeshLambertMaterial();
  const dungeonFlatMat = new THREE.MeshLambertMaterial({ flatShading: true });
  const kit: Kit = { models: new Map(), modelMat, dungeonMat, dungeonFlatMat, glowTex, smokeTex, shadowTex, time, low, reduce, mists: [] };

  const outdoor = new THREE.Group();
  scene.add(outdoor);

  // ----- Lune : vrai objet 3D du ciel, très loin en haut à gauche (hors brouillard). Elle reste
  // dans le décor : quand la caméra voyage, elle peut sortir du cadre. En mode jour, c'est le soleil. -----
  const moonGeo = new THREE.IcosahedronGeometry(1, 2);
  {
    // Cratères : taches plus sombres, facettes visibles (style low-poly).
    const g = moonGeo;
    const col = new Float32Array(g.attributes.position.count * 3);
    const v = new THREE.Vector3();
    const craters = [new THREE.Vector3(0.35, 0.45, 0.82), new THREE.Vector3(-0.4, -0.25, 0.88), new THREE.Vector3(0.1, -0.6, 0.79), new THREE.Vector3(-0.7, 0.4, 0.6)].map((c) => c.normalize());
    for (let i = 0; i < g.attributes.position.count; i++) {
      v.fromBufferAttribute(g.attributes.position, i).normalize();
      const dark = Math.max(0, ...craters.map((c, k) => (v.dot(c) > [0.94, 0.95, 0.96, 0.95][k] ? 1 : 0)));
      const k = 1 - dark * 0.22;
      col.set([k, k * 0.98, k * 0.93], i * 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  }
  const moonMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, fog: false });
  const moon = new THREE.Mesh(moonGeo, moonMat);
  const moonHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  moon.add(moonHalo);
  moonHalo.scale.setScalar(4.2);
  outdoor.add(moon);
  let moonCharge = 0;
  let moonPulse = 0;
  const moonBase = new THREE.Vector3();
  let moonRadius = 4;
  function placeMoon() {
    // Position relative au cadrage de la scène 1 : en haut à gauche, à 85 unités de la caméra.
    const p = outdoorPose(frame);
    const dir = p.target.clone().sub(p.pos).normalize();
    const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, dir).normalize();
    const D = 85;
    const halfV = frame.halfTan * D;
    moonBase
      .copy(p.pos)
      .addScaledVector(dir, D)
      .addScaledVector(up, halfV * 0.66)
      .addScaledVector(right, -halfV * frame.aspect * (frame.aspect < 0.8 ? 0.52 : 0.72));
    moonRadius = halfV * (frame.aspect < 0.8 ? 0.12 : 0.165);
  }
  function paintMoon() {
    const day = theme === "light";
    moonMat.color.set(day ? "#ffe07a" : "#f4e8c4");
    moonMat.emissive.set(day ? "#ffb020" : "#cdbb8a");
    moonMat.emissiveIntensity = day ? 0.9 : 0.62;
    moonHalo.material.color.set(day ? "#ffc861" : "#fff0c8");
  }
  paintMoon();
  const ground = createGround(palette);
  outdoor.add(ground.mesh);

  let graveyard: GraveyardArea | null = null;
  let reaper: Area | null = null;
  let crypt: CryptArea | null = null;
  let active: Area | null = null;
  let wanted: SceneName = "graveyard";
  let pendingResults: ResultsData | null = null;

  // ----- Fumée et braises (émises par les flammes du lieu visible) -----
  const SMOKE = low ? 24 : 42;
  const smoke = new Billboards(SMOKE, smokeTex);
  const smokeState = Array.from({ length: SMOKE }, () => ({ offset: Math.random(), life: rand(3.2, 5.5), seed: rand(0, 100) }));
  scene.add(smoke.mesh);

  const EMBERS = low ? 0 : 36;
  const emberGeo = new THREE.BufferGeometry();
  const emberPos = new Float32Array(EMBERS * 3);
  const emberCol = new Float32Array(EMBERS * 4);
  emberGeo.setAttribute("position", new THREE.BufferAttribute(emberPos, 3).setUsage(THREE.DynamicDrawUsage));
  emberGeo.setAttribute("color", new THREE.BufferAttribute(emberCol, 4).setUsage(THREE.DynamicDrawUsage));
  const embers = new THREE.Points(emberGeo, new THREE.PointsMaterial({ size: 0.09, map: glowTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  embers.frustumCulled = false;
  const emberState = Array.from({ length: EMBERS }, () => ({ offset: Math.random(), life: rand(1.8, 3.4), seed: rand(0, 100) }));
  if (EMBERS) scene.add(embers);

  // ----- Chauves-souris -----
  const AMBIENT_BATS = 5;
  const SWARM_BATS = low ? 26 : 48;
  const BATS = AMBIENT_BATS + SWARM_BATS;
  const batGeo = batGeometry();
  batGeo.setAttribute("aPhase", new THREE.InstancedBufferAttribute(new Float32Array(BATS).map(() => rand(0, 6.28)), 1));
  const batMat = new THREE.MeshLambertMaterial({ color: palette.bat, emissive: palette.batGlow, side: THREE.DoubleSide });
  batMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.vertexShader =
      "attribute float aPhase;\nuniform float uTime;\n" +
      shader.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        float flap = sin(uTime * 21.0 + aPhase);
        float ax = abs(transformed.x);
        transformed.y += flap * ax * 0.85;
        transformed.x *= 1.0 - 0.22 * max(flap, 0.0) * step(0.05, ax);`,
      );
  };
  const bats = new THREE.InstancedMesh(batGeo, batMat, BATS);
  bats.frustumCulled = false;
  bats.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(bats);
  const ambient = Array.from({ length: AMBIENT_BATS }, () => ({ r: rand(2.5, 6), speed: rand(0.35, 0.7) * (Math.random() < 0.5 ? -1 : 1), a0: rand(0, 6.28), y: rand(-1.5, 2), bob: rand(0, 6.28) }));
  const swarmBats: Bat[] = Array.from({ length: SWARM_BATS }, () => ({ active: false, t0: 0, dur: 1, p: [0, 1, 2, 3].map(() => new THREE.Vector3()), wobble: 0, scale: 1 }));

  // ----- Yeux -----
  const EYES = low ? 3 : 4;
  const eyesGeo = new THREE.PlaneGeometry(1, 0.42);
  const eyeData = new Float32Array(EYES * 4);
  const eyeColor = new Float32Array(EYES * 3);
  const eyeAttr = new THREE.InstancedBufferAttribute(eyeData, 4).setUsage(THREE.DynamicDrawUsage);
  const eyeColAttr = new THREE.InstancedBufferAttribute(eyeColor, 3).setUsage(THREE.DynamicDrawUsage);
  eyesGeo.setAttribute("aEye", eyeAttr);
  eyesGeo.setAttribute("aColor", eyeColAttr);
  const eyes = new THREE.InstancedMesh(eyesGeo, new THREE.ShaderMaterial({ vertexShader: EYES_VERT, fragmentShader: EYES_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), EYES);
  eyes.frustumCulled = false;
  eyes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(eyes);
  const eyeSlots: EyeSlot[] = Array.from({ length: EYES }, (_, i) => ({ spot: -1, phase: "off", t: 0, until: rand(1, 4) + i * 1.5, nextBlink: 0, blinkT: -1, look: 0, lookTarget: 0 }));

  // ----- Cadrage -----
  const frame: Frame = { aspect: 1, fov: 40, halfTan: 0.36, objScale: 1 };
  function layout() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    frame.aspect = w / h;
    frame.fov = frame.aspect < 0.8 ? 52 : frame.aspect < 1.25 ? 46 : 40;
    frame.halfTan = Math.tan(THREE.MathUtils.degToRad(frame.fov / 2));
    frame.objScale = THREE.MathUtils.clamp(frame.aspect * 1.15, 0.55, 1);
    camera.aspect = frame.aspect;
    camera.fov = frame.fov;
    camera.updateProjectionMatrix();
    for (const a of [graveyard, reaper, crypt]) a?.layout(frame);
    placeMoon();
    // Le fondu couvre tout l'écran quel que soit le format.
    fadeQuad.scale.set(frame.aspect * 2, 2, 1);
    if (reduce) renderFrame(0);
  }

  // ----- Plans de caméra -----
  const cam: Pose = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
  let shots: Shot[] = [];
  let shotT = 0;
  let shotStarted = false;
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };

  const areaOf = (s: SceneName) => (s === "graveyard" ? graveyard : s === "reaper" ? reaper : crypt);

  function setIndoor(v: boolean) {
    if (indoor === v) return;
    indoor = v;
    outdoor.visible = !v;
    if (crypt) crypt.group.visible = v;
    scene.background = v ? new THREE.Color(target().fog) : null;
    applyPalette(0, true);
    opts.onIndoor?.(v);
  }

  /** Accélère au départ puis garde une vitesse constante (on « entre » sans s'arrêter). */
  const easeInConst = (u: number) => {
    const a = 0.28;
    return (u < a ? (u * u) / (2 * a) : u - a / 2) / (1 - a / 2);
  };
  /** Part lancé (vitesse constante) puis ralentit jusqu'à l'arrêt. */
  const easeOutConst = (u: number) => 1 - easeInConst(1 - u);

  /** Plan le long d'une courbe passant par des points (et une courbe de visée), à vitesse réglée. */
  function pathShot(points: THREE.Vector3[], targets: THREE.Vector3[], dur: number, ease: (u: number) => number): Shot & { curve: THREE.CatmullRomCurve3 } {
    const curve = new THREE.CatmullRomCurve3(points, false, "centripetal");
    const aim = new THREE.CatmullRomCurve3(targets, false, "centripetal");
    return { dur, curve, pose: (u) => ({ pos: curve.getPointAt(ease(u)), target: aim.getPointAt(ease(u)) }) };
  }

  function hold(pose: () => Pose, dur: number, fade: (u: number) => number, end?: () => void): Shot {
    return { dur, pose: () => pose(), fade, end };
  }

  /** Trajet 1 ↔ 2 : on avance vers le centre gauche en dépassant le poteau-lanterne. */
  function toClearing(from: Pose, back = false): Shot {
    const gy = graveyard!;
    const to = back ? gy.pose(frame) : reaper!.pose(frame);
    const post = gy.postLantern();
    const side = frame.aspect < 0.8 ? 0.9 : 1.5;
    const pass = new THREE.Vector3(post.x + side, post.y + 1.9, post.z + 0.4);
    const pts = [from.pos.clone(), pass, to.pos];
    const aims = [from.target.clone(), back ? to.target.clone().lerp(from.target, 0.4) : to.target.clone().add(new THREE.Vector3(0, 0.6, 0)), to.target];
    return pathShot(back ? [from.pos.clone(), pass, to.pos] : pts, aims, 4, easeInOut);
  }

  function planTo(next: SceneName) {
    wanted = next;
    if (next !== "graveyard") ensureDungeon();
    if (!graveyard) return;
    if (next === "reaper" && !reaper) return; // la clairière arrive : on s'y rendra dès qu'elle est prête
    if (next === "crypt" && !crypt) return; // la crypte se charge : idem
    const gy = graveyard;
    const from: Pose = { pos: cam.pos.clone(), target: cam.target.clone() };
    shots = [];
    shotT = 0;
    shotStarted = false;
    const dest = areaOf(next)!;

    if (reduce) {
      setIndoor(next === "crypt");
      active = dest;
      if (next === "crypt") {
        crypt!.resetDust();
        crypt!.reveal(() => opts.onReveal?.());
      }
      return;
    }

    if (next === "crypt" && !indoor) {
      // 2 → 3 : vers le centre droit, jusqu'à la porte de la crypte, sans s'arrêter : on entre
      // pendant que les chauves-souris sortent par la porte.
      const cr = crypt!;
      const door = gy.door();
      const s = door.scale;
      const up = new THREE.Vector3(0, 1, 0);
      const approach = door.pos.clone().addScaledVector(door.normal, 6 * s).addScaledVector(up, 0.5 * s);
      const front = door.pos.clone().addScaledVector(door.normal, 0.9 * s);
      const inside = door.pos.clone().addScaledVector(door.normal, -1.4 * s);
      const rise = from.pos.clone().addScaledVector(up, 1.2 * s);
      // On passe devant le grand arbre mort (entre la clairière et la crypte), au-dessus des cadeaux.
      const mid = gy.midTree().add(new THREE.Vector3(0.6, 2.2 * s, 2.8 * s));
      const shot = pathShot(
        [from.pos.clone(), rise, mid, approach, front, inside],
        [from.target.clone(), from.target.clone().lerp(door.pos, 0.3), door.pos.clone().addScaledVector(up, 1.2 * s), door.pos.clone().addScaledVector(up, 0.3 * s), door.pos.clone().addScaledVector(door.normal, -2 * s), door.pos.clone().addScaledVector(door.normal, -5 * s)],
        0,
        easeInConst,
      );
      const len = shot.curve.getLength();
      shot.dur = THREE.MathUtils.clamp(len / 5, 3.2, 6.5);
      // Fraction du trajet où l'on franchit le seuil (pour le fondu au noir).
      const uDoor = 1 - (1.4 * s) / len;
      let swarmed = false;
      shots.push({
        ...shot,
        start: () => cr.resetDust(),
        progress: () => {
          if (!swarmed && cam.pos.distanceTo(door.pos) < 7 * s) {
            swarmed = true;
            doorSwarm(door.pos, door.normal);
          }
        },
        fade: (u) => smooth(uDoor - 0.06, uDoor + 0.02, easeInConst(u)),
        end: () => {
          setIndoor(true);
          active = cr;
        },
      });
      // Dans la crypte : on continue d'avancer (déjà lancé), puis on ralentit face au mur.
      shots.push({
        dur: 2.8,
        pose: (u) => {
          const a = cr.entrance(frame);
          const b = cr.pose(frame);
          const e = easeOutConst(u);
          return { pos: a.pos.lerp(b.pos, e), target: a.target.lerp(b.target, e) };
        },
        fade: (u) => 1 - smooth(0, 0.22, u),
        end: () => cr.reveal(() => opts.onReveal?.()),
      });
      return;
    }

    if (next !== "crypt" && indoor) {
      shots.push(hold(() => from, 0.45, (u) => u, () => {
        setIndoor(false);
        active = dest;
      }));
      shots.push(hold(() => dest.pose(frame), 0.7, (u) => 1 - u));
      return;
    }

    if (dest === active) return;
    active = dest;
    if (next === "reaper") shots.push(toClearing(from));
    else shots.push(toClearing(from, true));
  }

  /** Les chauves-souris jaillissent de la porte et passent à côté de la caméra qui entre. */
  function doorSwarm(door: THREE.Vector3, normal: THREE.Vector3) {
    let n = 0;
    for (const b of swarmBats) {
      if (b.active || n >= SWARM_BATS) continue;
      n++;
      const side = Math.random() < 0.5 ? -1 : 1;
      b.active = true;
      b.t0 = clock + n * 0.025 + rand(0, 0.2);
      b.dur = rand(1.1, 1.8);
      b.p[0].copy(door).add(new THREE.Vector3(rand(-0.5, 0.5), rand(-0.6, 0.6), 0)).addScaledVector(normal, -0.6);
      b.p[1].copy(door).addScaledVector(normal, 2).add(new THREE.Vector3(rand(-1.2, 1.2), rand(0.2, 1.4), 0));
      b.p[2].copy(cam.pos).add(new THREE.Vector3(side * rand(0.8, 2.2), rand(0.3, 1.8), 0)).addScaledVector(normal, 1);
      b.p[3].copy(cam.pos).add(new THREE.Vector3(side * rand(3, 6), rand(1, 3.5), 0)).addScaledVector(normal, 6);
      b.wobble = rand(0, 6.28);
      b.scale = rand(0.6, 1);
    }
  }

  /** Nuée qui part du lieu courant et traverse l'écran. */
  function swarm(size = SWARM_BATS) {
    if (reduce || indoor || !active) return;
    const home = active.batHome;
    const origin = new THREE.Vector3(home.x + rand(-2, 2), home.y * 0.6, home.z + 3);
    const side = Math.random() < 0.5 ? -1 : 1;
    const hw = (z: number) => frame.halfTan * frame.aspect * (cam.pos.z - z);
    let launched = 0;
    for (const b of swarmBats) {
      if (b.active || launched >= size) continue;
      launched++;
      const s = Math.random() < 0.82 ? side : -side;
      b.active = true;
      b.t0 = clock + launched * 0.035 + rand(0, 0.35);
      b.dur = rand(3.2, 4.6);
      b.p[0].copy(origin).add(new THREE.Vector3(rand(-0.8, 0.8), rand(-0.5, 0.5), rand(-0.8, 0.8)));
      b.p[1].copy(origin).add(new THREE.Vector3(rand(-3, 3), rand(3.5, 6.5), rand(2, 5)));
      b.p[2].set(cam.pos.x + s * hw(cam.pos.z - 8) * rand(0.1, 0.8), rand(3, 7), cam.pos.z - rand(6, 9));
      b.p[3].set(cam.pos.x + s * (hw(cam.pos.z - 6) * 1.7 + rand(1, 3)), rand(5, 10), cam.pos.z - rand(3, 6));
      b.wobble = rand(0, 6.28);
      b.scale = rand(0.7, 1.15);
    }
  }

  // ----- Chargement progressif -----
  // 1) cimetière (scène d'origine) ; 2) clairière (faucheuse, forêt, atlas Dungeon) ;
  // 3) crypte (pack Dungeon), seulement quand on se dirige vers les résultats.
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  let disposed = false;

  /** Enregistre les modèles d'un pack ; ils partagent un matériau Lambert avec l'atlas du pack. */
  function registerPack(gltf: GLTF, mat?: THREE.MeshLambertMaterial) {
    let packMat = mat;
    gltf.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const src = mesh.material as THREE.MeshStandardMaterial;
      if (!packMat) packMat = new THREE.MeshLambertMaterial({ map: src.map });
      else if (!packMat.map) {
        packMat.map = src.map;
        packMat.needsUpdate = true;
      }
      mesh.material = packMat;
    });
    for (const c of [...gltf.scene.children]) kit.models.set(c.name, c);
  }

  const dungeonTex = new THREE.TextureLoader().loadAsync(DUNGEON_TEX_URL).then((tex) => {
    tex.flipY = false; // convention glTF, comme les autres atlas
    tex.colorSpace = THREE.SRGBColorSpace;
    for (const m of [dungeonMat, dungeonFlatMat]) {
      m.map = tex;
      m.needsUpdate = true;
    }
  });
  const clearingFiles = Promise.all([loader.loadAsync(REAPER_URL).catch(() => null), loader.loadAsync(FOREST_URL).catch(() => null), dungeonTex.catch(() => null)]);
  let clearingReady: Promise<void> | null = null;
  function ensureClearing() {
    clearingReady ??= clearingFiles.then(([reaperGltf, forest]) => {
      if (disposed || !graveyard) return;
      if (forest) registerPack(forest);
      reaper = createReaperClearing(kit, reaperGltf);
      outdoor.add(reaper.group);
      reaper.layout(frame);
      if (wanted === "reaper" && !shots.length) {
        if (active === graveyard && cam.pos.distanceTo(graveyard.pose(frame).pos) < 0.5 && booted) planTo("reaper");
        else if (!booted) active = reaper;
      }
    });
    return clearingReady;
  }

  /** Logos : chargés juste après le cimetière (le badge de la crypte attend ce chargement). */
  let logosReady: Promise<void> | null = null;
  function ensureLogos() {
    logosReady ??= loader
      .loadAsync(LOGOS_URL)
      .then((gltf) => {
        if (disposed) return;
        registerPack(gltf);
        graveyard?.addLogo();
      })
      .catch((e) => console.warn("Logos indisponibles :", e));
    return logosReady;
  }

  // Pack Halloween : utilisé par les trois lieux (la crypte en a besoin aussi : citrouilles, crâne,
  // cercueil). Sur /resultats, la crypte est demandée tout de suite : elle attend ce pack.
  const halloween = loader.loadAsync(MODEL_URL).then((gltf) => {
    if (!disposed) registerPack(gltf, modelMat);
  });

  let dungeonReady: Promise<void> | null = null;
  function ensureDungeon() {
    dungeonReady ??= Promise.all([loader.loadAsync(DUNGEON_URL), dungeonTex, ensureLogos(), halloween]).then(([gltf]) => {
      if (disposed) return;
      registerPack(gltf, dungeonMat);
      crypt = createCrypt(kit);
      scene.add(crypt.group);
      crypt.group.visible = indoor;
      if (pendingResults) crypt.setResults(pendingResults);
      crypt.layout(frame);
      if (wanted === "crypt") planTo("crypt");
    }).catch((e) => console.warn("Crypte indisponible :", e));
    return dungeonReady;
  }

  let booted = false;
  const ready = halloween
    .then(async () => {
      if (disposed) return;
      graveyard = createGraveyard(kit);
      outdoor.add(graveyard.group);
      graveyard.addLogo(); // si les logos sont déjà là (chargés pour la crypte)
      layout();
      // Rechargement en plein tirage au sort : on attend la clairière pour ouvrir directement dessus.
      void ensureLogos();
      if (wanted === "reaper") await ensureClearing();
      else void ensureClearing();
      const start = wanted === "reaper" && reaper ? reaper : graveyard;
      active = start;
      const p = start.pose(frame);
      cam.pos.copy(p.pos);
      cam.target.copy(p.target);
      booted = true;
      if (wanted === "crypt") planTo("crypt");
    })
    .catch((e) => console.warn("Décor 3D indisponible :", e));

  // ----- Animation -----
  const dummy = new THREE.Object3D();
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const tmpColor = new THREE.Color();
  const toColor = new THREE.Color();
  let clock = 0;
  let raf = 0;
  let nextSwarm = rand(5, 9);
  let slowFrames = 0;
  let eyeArea: Area | null = null;
  let degraded = low;

  const bezier = (p: THREE.Vector3[], t: number, out: THREE.Vector3) => {
    const u = 1 - t;
    return out.copy(p[0]).multiplyScalar(u * u * u).addScaledVector(p[1], 3 * u * u * t).addScaledVector(p[2], 3 * u * t * t).addScaledVector(p[3], t * t * t);
  };

  function applyPalette(dt: number, snap = false) {
    const k = reduce || snap ? 1 : 1 - Math.exp(-dt * 2.5);
    const cur = palette as Record<string, number | string>;
    for (const [key, to] of Object.entries(target())) {
      const v = cur[key];
      cur[key] = typeof to === "number" ? (v as number) + (to - (v as number)) * k : "#" + tmpColor.set(v as string).lerp(toColor.set(to), k).getHexString();
    }
    const fog = scene.fog as THREE.Fog;
    fog.color.set(palette.fog);
    fog.near = palette.near;
    fog.far = palette.far;
    if (scene.background instanceof THREE.Color) scene.background.set(palette.fog);
    hemi.color.set(palette.hemiSky);
    hemi.groundColor.set(palette.hemiGround);
    hemi.intensity = palette.hemi;
    sun.color.set(palette.sun);
    sun.intensity = palette.sunI;
    ground.mat.color.set(palette.ground);
    batMat.color.set(palette.bat);
    batMat.emissive.set(palette.batGlow);
    smoke.color.set(palette.smoke);
    smoke.opacity = palette.smokeA;
    for (const m of kit.mists) {
      m.color.set(palette.mist);
      m.opacity = palette.mistA;
    }
  }

  function visibleAreas(): Area[] {
    if (indoor) return crypt ? [crypt] : [];
    return [graveyard, reaper].filter((x): x is Area => !!x);
  }

  function renderFrame(dt: number) {
    clock += dt;
    const t = clock;
    time.value = t;
    applyPalette(dt);

    // --- Caméra ---
    let fade = 0;
    if (shots.length) {
      const shot = shots[0];
      if (!shotStarted) {
        shotStarted = true;
        shot.start?.();
      }
      shotT += dt;
      const u = Math.min(1, shotT / shot.dur);
      const p = shot.pose(u);
      cam.pos.copy(p.pos);
      cam.target.copy(p.target);
      shot.progress?.(u);
      fade = shot.fade?.(u) ?? 0;
      if (u >= 1) {
        shot.end?.();
        shots.shift();
        shotT = 0;
        shotStarted = false;
      }
    } else if (active) {
      const p = active.pose(frame);
      // Ralliement doux vers la pose du lieu (redimensionnement, etc.)
      const k = reduce ? 1 : Math.min(1, dt * 3);
      cam.pos.lerp(p.pos, k);
      cam.target.lerp(p.target, k);
    }
    pointer.sx += (pointer.x - pointer.sx) * Math.min(1, dt * 2);
    pointer.sy += (pointer.y - pointer.sy) * Math.min(1, dt * 2);
    const sway = shots.length ? 0 : 1;
    // Dans la crypte, la caméra respire largement (gauche / droite, haut / bas, un peu d'avant en arrière),
    // même sans souris (téléphone) ; dehors, simple parallaxe comme dans la scène d'origine.
    const amp = indoor ? { px: 1.1, py: 0.6, dx: 0.85, dy: 0.45, dz: 0.3 } : { px: 0.6, py: 0.25, dx: 0.15, dy: 0.05, dz: 0 };
    camera.position.set(
      cam.pos.x + (pointer.sx * amp.px + Math.sin(t * 0.13) * amp.dx + Math.sin(t * 0.31) * amp.dx * 0.25) * sway,
      cam.pos.y + (pointer.sy * amp.py + Math.sin(t * 0.21) * amp.dy) * sway,
      cam.pos.z + (Math.sin(t * 0.09) - 1) * amp.dz * sway,
    );
    camera.lookAt(cam.target);
    fadeMat.opacity = fade;
    fadeQuad.visible = fade > 0.001;

    // --- Lune ---
    if (outdoor.visible) {
      moonPulse = Math.max(0, moonPulse - dt * 4);
      const pulse = 1 + Math.sin(moonPulse * Math.PI) * 0.06;
      moon.position.copy(moonBase);
      moon.scale.setScalar(moonRadius * pulse);
      moon.rotation.y = t * 0.02;
      moon.rotation.z = 0.3 + Math.sin(moonPulse * 9) * moonPulse * 0.08;
      moonHalo.material.opacity = 0.35 + moonCharge * 0.55;
      moonHalo.scale.setScalar(4.2 + moonCharge * 2.6);
    }

    // --- Lieux ---
    const areas = visibleAreas();
    for (const area of areas) area.update(t, dt, frame, camera);
    scene.updateMatrixWorld();

    // --- Flammes : halos + pool de lumières ---
    const flames: Flame[] = [];
    for (const area of areas) flames.push(...area.flames);
    // Flammes « steady » : intensité moyenne du vacillement, sans variation.
    const flick = (f: Flame) => (f.steady ? 0.84 : flicker(t, f.seed));
    for (const f of flames) {
      const k = flick(f);
      const g = f.glowSize * (0.9 + 0.15 * k) * f.scale;
      f.glow.scale.set(g, g, 1);
      f.glow.material.opacity = 0.55 * k * palette.glow;
    }
    const lit = flames
      .filter((f) => f.light && f.intensity > 0)
      // Distance à la pose de la caméra (sans sa respiration) : l'attribution des lumières ne change
      // pas quand la caméra oscille, donc pas de lumières qui s'allument / s'éteignent.
      .map((f) => ({ f, score: f.pos.distanceTo(cam.pos) - (f.priority ?? 0) * 4 }))
      .sort((x, y) => x.score - y.score);
    pool.forEach((light, i) => {
      const entry = lit[i];
      if (!entry) {
        light.intensity = 0;
        return;
      }
      light.position.copy(entry.f.pos);
      light.color.set(entry.f.color);
      light.distance = entry.f.distance;
      light.intensity = entry.f.intensity * flick(entry.f) * palette.lights * entry.f.scale;
    });

    // --- Fumée ---
    const emitters = flames.filter((f) => f.smoke > 0);
    smokeState.forEach((s, i) => {
      const f = emitters[i % Math.max(1, emitters.length)];
      if (!f) return smoke.hide(i);
      const life = (((t / s.life + s.offset) % 1) + 1) % 1;
      const scale = f.scale * f.smoke;
      const rise = life * 2.4 * f.scale * f.rise;
      const sway = Math.sin(t * 0.8 + s.seed) * 0.35 * life * scale;
      const size = (0.35 + life * 1.7) * scale;
      const alpha = smooth(0, 0.18, life) * (1 - life) * 0.9;
      smoke.set(i, f.pos.x + sway, f.pos.y + 0.2 * scale + rise, f.pos.z + Math.cos(s.seed + t * 0.5) * 0.15 * life, alpha, s.seed + life * 1.2, size);
    });
    smoke.commit();

    // --- Braises ---
    if (EMBERS) {
      const sources = flames.filter((f) => f.embers);
      emberState.forEach((e, i) => {
        const f = sources[i % Math.max(1, sources.length)];
        if (!f) return emberCol.set([0, 0, 0, 0], i * 4);
        const life = (((t / e.life + e.offset) % 1) + 1) % 1;
        const scale = indoor ? 1 : frame.objScale;
        emberPos.set([f.pos.x + Math.sin(t * 1.7 + e.seed) * 0.3 * life * scale, f.pos.y + 0.2 + life * 2.2 * scale, f.pos.z + Math.cos(t * 1.3 + e.seed) * 0.2 * life], i * 3);
        const al = Math.sin(Math.PI * life) * palette.glow * (0.6 + 0.4 * Math.sin(t * 13 + e.seed));
        emberCol.set([1, 0.55 + 0.3 * Math.sin(e.seed), 0.15, al], i * 4);
      });
      emberGeo.attributes.position.needsUpdate = true;
      emberGeo.attributes.color.needsUpdate = true;
    }

    // --- Chauves-souris ---
    const home = !indoor && active ? active.batHome : null;
    ambient.forEach((bat, i) => {
      if (reduce || !home) return bats.setMatrixAt(i, zero);
      const ang = bat.a0 + t * bat.speed;
      const step = 0.05 * Math.sign(bat.speed);
      a.set(home.x + Math.cos(ang) * bat.r, home.y + bat.y + Math.sin(t * 0.9 + bat.bob) * 0.4, home.z + Math.sin(ang) * bat.r * 0.6);
      b.set(home.x + Math.cos(ang + step) * bat.r, a.y, home.z + Math.sin(ang + step) * bat.r * 0.6);
      dummy.position.copy(a);
      dummy.lookAt(b);
      dummy.rotateZ(-0.35 * Math.sign(bat.speed));
      dummy.scale.setScalar(0.9);
      dummy.updateMatrix();
      bats.setMatrixAt(i, dummy.matrix);
    });
    if (!reduce && !indoor && !shots.length && t > nextSwarm) {
      swarm(Math.round(SWARM_BATS * rand(0.5, 1)));
      nextSwarm = t + rand(16, 28);
    }
    swarmBats.forEach((bat, j) => {
      const i = AMBIENT_BATS + j;
      const u = (t - bat.t0) / bat.dur;
      if (!bat.active || u < 0 || u > 1 || indoor) {
        if (bat.active && (u > 1 || indoor)) bat.active = false;
        return bats.setMatrixAt(i, zero);
      }
      bezier(bat.p, u, a);
      bezier(bat.p, Math.min(1, u + 0.01), b);
      a.y += Math.sin(t * 3 + bat.wobble) * 0.25;
      b.y += Math.sin((t + 0.03) * 3 + bat.wobble) * 0.25;
      dummy.position.copy(a);
      dummy.lookAt(b);
      dummy.rotateZ(Math.sin(t * 2 + bat.wobble) * 0.5);
      dummy.scale.setScalar(bat.scale * smooth(0, 0.08, u));
      dummy.updateMatrix();
      bats.setMatrixAt(i, dummy.matrix);
    });
    bats.instanceMatrix.needsUpdate = true;

    // --- Yeux dans la pénombre ---
    const spotArea = indoor ? crypt : active;
    const spots = spotArea?.eyeSpots ?? [];
    if (spotArea !== eyeArea) {
      eyeArea = spotArea;
      eyeSlots.forEach((e) => Object.assign(e, { phase: "off", spot: -1, t: 0, until: rand(1, 3) }));
    }
    eyeSlots.forEach((e, i) => {
      e.t += dt;
      if (e.phase === "off" && e.t > e.until && palette.eyes > 0.3 && !reduce && spots.length && !shots.length) {
        const used = new Set(eyeSlots.map((s) => s.spot));
        const free = spots.map((_, k) => k).filter((k) => !used.has(k));
        e.spot = free[Math.floor(Math.random() * free.length)] ?? 0;
        e.phase = "in";
        e.t = 0;
        e.until = rand(2.5, 5.5);
        e.nextBlink = rand(0.8, 2);
        const col = EYE_COLORS[Math.floor(Math.random() * EYE_COLORS.length)];
        eyeColor.set([col.r, col.g, col.b], i * 3);
        eyeColAttr.needsUpdate = true;
      }
      let alpha = 0;
      let open = 1;
      if (e.phase === "in") {
        alpha = smooth(0, 0.9, e.t);
        open = smooth(0, 0.5, e.t);
        if (e.t > 0.9) { e.phase = "on"; e.t = 0; }
      } else if (e.phase === "on") {
        alpha = 1;
        if (e.t > e.nextBlink) { e.blinkT = 0; e.nextBlink = e.t + rand(1.5, 3); }
        if (e.blinkT >= 0) {
          e.blinkT += dt;
          open = 1 - Math.sin(Math.min(1, e.blinkT / 0.16) * Math.PI);
          if (e.blinkT > 0.16) e.blinkT = -1;
        }
        if (Math.random() < dt * 0.6) e.lookTarget = rand(-1, 1);
        if (e.t > e.until) { e.phase = "out"; e.t = 0; }
      } else if (e.phase === "out") {
        alpha = 1 - smooth(0, 0.6, e.t);
        open = 1 - smooth(0.2, 0.6, e.t);
        if (e.t > 0.6) { e.phase = "off"; e.t = 0; e.until = rand(1.5, 6); e.spot = -1; }
      }
      e.look += (e.lookTarget - e.look) * Math.min(1, dt * 4);
      const spot = e.spot >= 0 ? spots[e.spot] : null;
      if (!spot) {
        eyeData.set([0, 0, 0, 0], i * 4);
        return eyes.setMatrixAt(i, zero);
      }
      dummy.position.copy(spot);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      eyes.setMatrixAt(i, dummy.matrix);
      const size = 0.032 * camera.position.distanceTo(spot) * Math.max(0.7, frame.objScale);
      eyeData.set([alpha * palette.eyes, open, e.look, size], i * 4);
    });
    eyes.instanceMatrix.needsUpdate = true;
    eyeAttr.needsUpdate = true;

    renderer.render(scene, camera);
  }

  let last = performance.now();
  function loop(now: number) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!graveyard) return; // modèles en cours de chargement
    // Téléphone qui peine : on réduit la résolution une fois pour toutes.
    if (!degraded) {
      slowFrames = dt > 1 / 38 ? slowFrames + 1 : Math.max(0, slowFrames - 1);
      if (slowFrames > 90) {
        degraded = true;
        pixelRatio = 1;
        renderer.setPixelRatio(1);
        layout();
      }
    }
    renderFrame(dt);
  }

  const onResize = () => layout();
  const onPointer = (e: PointerEvent) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);
    if (e.pointerType === "mouse") document.documentElement.style.cursor = plaqueAt(e) || moonAt(e) ? "pointer" : "";
  };
  // Clic sur le classement (le décor est sous la page : on écoute la fenêtre, hors liens et boutons).
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const plaqueAt = (e: MouseEvent) => {
    if (!indoor || !crypt || shots.length || (e.target as Element | null)?.closest?.("a, button, input, [role=dialog]")) return false;
    ndc.set((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
    raycaster.setFromCamera(ndc, camera);
    return crypt.hitPlaque(raycaster);
  };
  // Lune : on vise une sphère un peu plus large que l'astre (petite cible lointaine).
  const moonHit = new THREE.Sphere();
  const moonAt = (e: MouseEvent) => {
    if (indoor || !outdoor.visible || (e.target as Element | null)?.closest?.("a, button, input, textarea, label, [role=dialog], [role=radio], [role=radiogroup]")) return false;
    ndc.set((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
    raycaster.setFromCamera(ndc, camera);
    moonHit.set(moon.position, moonRadius * 1.25);
    return raycaster.ray.intersectsSphere(moonHit);
  };
  const onClick = (e: MouseEvent) => {
    if (moonAt(e)) {
      moonPulse = 1;
      opts.onMoonTap?.({ x: e.clientX, y: e.clientY });
      return;
    }
    if (plaqueAt(e)) opts.onPlaqueClick?.();
  };
  const onLost = (e: Event) => {
    e.preventDefault();
    cancelAnimationFrame(raf);
  };
  window.addEventListener("resize", onResize);
  window.addEventListener("pointermove", onPointer, { passive: true });
  window.addEventListener("click", onClick);
  canvas.addEventListener("webglcontextlost", onLost);
  layout();

  // Mouvement réduit : pas de boucle continue, une image à chaque changement.
  let reducedTimer = 0;
  if (reduce) {
    void ready.then(() => renderFrame(0));
    reducedTimer = window.setInterval(() => {
      if (crypt && indoor) renderFrame(0.1); // le classement peut changer
    }, 1000);
  } else {
    raf = requestAnimationFrame(loop);
  }

  return {
    ready,
    setTheme(next) {
      theme = next;
      paintMoon();
      if (reduce) renderFrame(0);
    },
    setScene(next) {
      if (next === wanted && (shots.length || active === areaOf(next))) return;
      planTo(next);
      if (reduce) renderFrame(0);
    },
    swarm,
    setMoonCharge(charge) {
      moonCharge = THREE.MathUtils.clamp(charge, 0, 1);
    },
    moonScreenPoint() {
      if (indoor) return null;
      const p = moon.position.clone().project(camera);
      if (Math.abs(p.x) > 1 || Math.abs(p.y) > 1 || p.z > 1) return null;
      return { x: ((p.x + 1) / 2) * window.innerWidth, y: ((1 - p.y) / 2) * window.innerHeight };
    },
    setResults(data) {
      pendingResults = data;
      crypt?.setResults(data);
      if (reduce && indoor) renderFrame(0);
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      window.clearInterval(reducedTimer);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("click", onClick);
      document.documentElement.style.cursor = "";
      canvas.removeEventListener("webglcontextlost", onLost);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
        mats.forEach((mat) => {
          for (const v of Object.values(mat)) if (v instanceof THREE.Texture) v.dispose();
          mat.dispose();
        });
      });
      [glowTex, smokeTex, shadowTex, modelMat.map].forEach((tx) => tx?.dispose());
      renderer.dispose();
    },
  };
}
