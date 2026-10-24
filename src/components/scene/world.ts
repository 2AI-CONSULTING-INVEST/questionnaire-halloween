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
import { createBloodMaterial } from "./blood";
import { createBloodScreen } from "./bloodScreen";
import { Billboards, easeInOut, flicker, glowTexture, rand, shadowTexture, smokeTexture, smooth } from "./core";
import { cutGlowWarmup, updateCutGlow } from "./glow";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { createCrypt, type CryptArea, type ResultsData } from "./crypt";
import { createGraveyard, createGround, createReaperClearing, outdoorPose, type GraveyardArea } from "./outdoor";
import type { Area, EyeStyle, Flame, Frame, Kit, Pose, SceneName } from "./types";
import { ASSETS } from "./assets";
import { batGeometry, createBatMaterial } from "./bats";

export type { ResultsData } from "./crypt";
export type { SceneName } from "./types";
import type { SoundEvent } from "../sound/engine";

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
  /** Évènements sonores : nuées de chauves-souris, travellings (pas). */
  onSound?: (e: SoundEvent) => void;
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
  // « Plein jour » : jour couvert de fin d'après-midi, brume violette d'Halloween, soleil bas et roux — l'ambiance
  // reste sombre et inquiétante, mais on voit le ciel et le soleil, et les lanternes brillent encore.
  light: {
    fog: "#6c5a86", near: 9, far: 36, hemiSky: "#b3abc4", hemiGround: "#3f332f", hemi: 0.95, sun: "#ffbf80", sunI: 0.95,
    ground: "#6a5c4d", lights: 0.5, glow: 0.45, mist: "#8f7fae", mistA: 0.32, smoke: "#a596bf", smokeA: 0.24, eyes: 0.25, bat: "#2e2733", batGlow: "#000000",
  },
};

// Clairière de la faucheuse : la même nuit, mais le sang est partout — brume et brouillard rougis,
// sol et contre-jour teintés, lueurs un peu plus vives. Fondue avec OUTDOOR selon la distance (bloodK).
const CLEARING: Record<Theme, Palette> = {
  dark: {
    ...OUTDOOR.dark,
    fog: "#1a0a12", near: 10, far: 40, hemiSky: "#6e4458", hemiGround: "#24090f", hemi: 0.62, sun: "#c48c90", sunI: 0.74,
    ground: "#28141e", glow: 0.92, mist: "#8c5868", mistA: 0.34, smoke: "#947080", smokeA: 0.3,
  },
  light: {
    ...OUTDOOR.light,
    fog: "#6e4658", near: 9, far: 36, hemiSky: "#b89aac", hemiGround: "#4a2630", sun: "#ffa878",
    ground: "#684a48", mist: "#9a6a80", mistA: 0.34, smoke: "#a88494",
  },
};

const INDOOR: Record<Theme, Palette> = {
  dark: {
    fog: "#09070d", near: 8, far: 30, hemiSky: "#5d5070", hemiGround: "#160f0c", hemi: 0.3, sun: "#ffa860", sunI: 0.12,
    ground: "#241c2d", lights: 0.9, glow: 0.85, mist: "#8a7eae", mistA: 0, smoke: "#b9af98", smokeA: 0.2, eyes: 1, bat: "#43375a", batGlow: "#1f1630",
  },
  light: {
    fog: "#221b28", near: 10, far: 38, hemiSky: "#b3a7c4", hemiGround: "#3e3028", hemi: 0.9, sun: "#ffcf9a", sunI: 0.5,
    ground: "#241c2d", lights: 0.85, glow: 0.72, mist: "#ffffff", mistA: 0, smoke: "#e8e0d0", smokeA: 0.2, eyes: 0.5, bat: "#3a3040", batGlow: "#000000",
  },
};

type Bat = { active: boolean; t0: number; dur: number; p: THREE.Vector3[]; wobble: number; scale: number };

// ---------------------------------------------------------------------------
// Yeux : deux amandes lumineuses avec pupille fendue, halo additif.
// ---------------------------------------------------------------------------

const EYES_VERT = /* glsl */ `
  attribute vec4 aEye;
  attribute vec3 aColor;
  attribute float aMean;
  varying vec2 vUv;
  varying vec4 vEye;
  varying vec3 vColor;
  varying float vMean;
  void main() {
    vUv = uv;
    vEye = aEye;
    vColor = aColor;
    vMean = aMean;
    vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    mvPosition.xy += position.xy * aEye.w;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const EYES_FRAG = /* glsl */ `
  varying vec2 vUv;
  varying vec4 vEye;
  varying vec3 vColor;
  varying float vMean;
  float eye(vec2 p, float cx, float open, float look, float mean) {
    vec2 q = p - vec2(cx, 0.0);
    float ry = max(0.004, 0.07 * open);
    float d = length(vec2(q.x / 0.12, q.y / ry));
    float shape = 1.0 - smoothstep(0.82, 1.0, d);
    // Sourcil méchant : le haut de l'amande est coupé en biais, bas vers le centre du regard.
    float inner = -sign(cx) * q.x;
    float brow = 0.06 - mean * (0.02 + inner * 0.45) * open;
    shape *= 1.0 - smoothstep(brow - 0.012, brow + 0.012, q.y) * mean;
    float pupil = smoothstep(0.012, 0.03, abs(q.x - look * 0.035)) * 0.65 + 0.35;
    float core = shape * pupil * (1.25 - 0.45 * d);
    float halo = exp(-dot(q, q) * 55.0) * 0.55 * open;
    return core + halo;
  }
  void main() {
    if (vEye.x < 0.002) discard;
    vec2 p = vec2(vUv.x - 0.5, (vUv.y - 0.5) * 0.42);
    float v = eye(p, -0.2, vEye.y, vEye.z, vMean) + eye(p, 0.2, vEye.y, vEye.z, vMean);
    gl_FragColor = vec4(vColor * v * vEye.x, 1.0);
  }
`;

type EyeSlot = { spot: number; phase: "off" | "in" | "on" | "out"; t: number; until: number; nextBlink: number; blinkT: number; look: number; lookTarget: number };
const EYE_COLORS = ["#ffcf3a", "#ff5a2a", "#a6ff4d", "#ffb347"];
const eyeColor3 = new THREE.Color();

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
  // Sang qui coule sur l'écran dans la clairière (null si les cibles flottantes manquent).
  const bloodScreen = createBloodScreen(renderer, reduce);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 160);
  scene.add(camera);
  let theme = opts.theme;
  let indoor = false;
  const palette: Palette = structuredClone(OUTDOOR[theme]);
  // Dehors, la palette vire au sang à mesure que la caméra approche de la clairière (bloodK : 0 → 1).
  let bloodK = 0;
  const mixed: Palette = structuredClone(OUTDOOR[theme]);
  const mixA = new THREE.Color();
  const mixB = new THREE.Color();
  const target = () => {
    if (indoor) return INDOOR[theme];
    if (bloodK <= 0.001) return OUTDOOR[theme];
    const a = OUTDOOR[theme] as Record<string, number | string>;
    const b = CLEARING[theme] as Record<string, number | string>;
    const out = mixed as Record<string, number | string>;
    for (const key of Object.keys(a)) {
      const va = a[key];
      out[key] = typeof va === "number" ? va + ((b[key] as number) - va) * bloodK : "#" + mixA.set(va).lerp(mixB.set(b[key] as string), bloodK).getHexString();
    }
    return mixed;
  };

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
  const bloodMat = createBloodMaterial();
  const kit: Kit = { models: new Map(), modelMat, dungeonMat, dungeonFlatMat, bloodMat, glowTex, smokeTex, shadowTex, time, glowLevel: { value: 1 }, low, reduce, mists: [] };

  const outdoor = new THREE.Group();
  scene.add(outdoor);

  // ----- Préchauffage des shaders : tous les programmes de la scène 1 sont compilés dès maintenant,
  // en parallèle du téléchargement des modèles (les matériaux sont connus ; un atlas 1×1 tient lieu
  // de texture). Au moment de l'affichage, il ne reste rien à compiler : pas de saccade. -----
  const warmTex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  warmTex.colorSpace = THREE.SRGBColorSpace;
  warmTex.needsUpdate = true;
  modelMat.map = warmTex;
  const warm = new THREE.Group();
  warm.position.y = -500;
  const warmGeo = new THREE.BoxGeometry(1, 1, 1);
  warm.add(new THREE.Mesh(warmGeo, modelMat)); // modèles KayKit
  warm.add(new THREE.InstancedMesh(warmGeo, modelMat, 1)); // forêt instanciée
  warm.add(new THREE.Mesh(warmGeo, new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }))); // ombres
  warm.add(new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }))); // halos
  warm.add(new THREE.Mesh(warmGeo, new THREE.MeshLambertMaterial({ map: warmTex, transparent: true, opacity: 0.86, emissive: new THREE.Color("#8fa3ff"), emissiveIntensity: 0.22, side: THREE.DoubleSide }))); // fantôme
  warm.add(new THREE.Mesh(warmGeo, new THREE.MeshBasicMaterial({ color: "#140f1c" }))); // yeux du fantôme
  warm.add(cutGlowWarmup(kit, warmGeo)); // découpes des citrouilles, vitres des lanternes (deux passes)
  scene.add(warm);
  let warmed: Promise<void> | null = null;
  const warmUp = () => {
    warmed ??= renderer
      .compileAsync(scene, camera)
      .catch(() => undefined)
      .then(() => {
        scene.remove(warm);
        warmGeo.dispose();
      });
    return warmed;
  };

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
    // Jour : soleil bas et roux de fin d'après-midi (ciel couvert), toujours bien visible.
    moonMat.color.set(day ? "#ffd166" : "#f4e8c4");
    moonMat.emissive.set(day ? "#ff9a1c" : "#cdbb8a");
    moonMat.emissiveIntensity = day ? 1.0 : 0.62;
    moonHalo.material.color.set(day ? "#ffb24a" : "#fff0c8");
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
  const batMat = createBatMaterial(time, palette.bat, palette.batGlow);
  const bats = new THREE.InstancedMesh(batGeo, batMat, BATS);
  bats.frustumCulled = false;
  bats.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(bats);
  const ambient = Array.from({ length: AMBIENT_BATS }, () => ({ r: rand(2.5, 6), speed: rand(0.35, 0.7) * (Math.random() < 0.5 ? -1 : 1), a0: rand(0, 6.28), y: rand(-1.5, 2), bob: rand(0, 6.28) }));
  const swarmBats: Bat[] = Array.from({ length: SWARM_BATS }, () => ({ active: false, t0: 0, dur: 1, p: [0, 1, 2, 3].map(() => new THREE.Vector3()), wobble: 0, scale: 1 }));

  // ----- Yeux -----
  // Nombre d'instances : assez pour la clairière (la plus peuplée) ; chaque lieu limite ses paires (eyeStyle).
  const EYES = low ? 5 : 8;
  const DEFAULT_EYES: EyeStyle = { colors: EYE_COLORS, pairs: low ? 3 : 4, mean: 0, scale: 1, haste: 1 };
  const eyesGeo = new THREE.PlaneGeometry(1, 0.42);
  const eyeData = new Float32Array(EYES * 4);
  const eyeColor = new Float32Array(EYES * 3);
  const eyeMean = new Float32Array(EYES);
  const eyeAttr = new THREE.InstancedBufferAttribute(eyeData, 4).setUsage(THREE.DynamicDrawUsage);
  const eyeColAttr = new THREE.InstancedBufferAttribute(eyeColor, 3).setUsage(THREE.DynamicDrawUsage);
  const eyeMeanAttr = new THREE.InstancedBufferAttribute(eyeMean, 1).setUsage(THREE.DynamicDrawUsage);
  eyesGeo.setAttribute("aEye", eyeAttr);
  eyesGeo.setAttribute("aColor", eyeColAttr);
  eyesGeo.setAttribute("aMean", eyeMeanAttr);
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
    bloodScreen?.resize(w, h);
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
    if (next === "reaper") void ensureClearing();
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
      walk(true);
      return;
    }

    if (next !== "crypt" && indoor) {
      shots.push(hold(() => from, 0.45, (u) => u, () => {
        setIndoor(false);
        active = dest;
      }));
      shots.push(hold(() => dest.pose(frame), 0.7, (u) => 1 - u));
      walk(false);
      return;
    }

    if (dest === active) return;
    active = dest;
    if (next === "reaper") shots.push(toClearing(from));
    else shots.push(toClearing(from, true));
    walk(false);
  }

  /** Pas pendant le travelling qui vient d'être programmé (durée totale des plans). */
  function walk(indoor: boolean) {
    opts.onSound?.({ type: "travel", dur: shots.reduce((a, s) => a + s.dur, 0), indoor });
  }

  /** Les chauves-souris jaillissent de la porte et passent à côté de la caméra qui entre. */
  function doorSwarm(door: THREE.Vector3, normal: THREE.Vector3) {
    opts.onSound?.({ type: "doorSwarm" });
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
    opts.onSound?.({ type: "swarm", side, dur: 4 });
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
  // 1) cimetière + logo (scène 1) : les deux fichiers sont annoncés dans le <head> et chargés en
  //    parallèle ; on attend les deux, on compile les shaders, puis le décor apparaît d'un bloc ;
  // 2) clairière (faucheuse, forêt, atlas Dungeon), lancée ensuite sans retarder la scène 1 ;
  // 3) crypte (pack Dungeon), seulement quand on se dirige vers les résultats (prioritaire alors).
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
      else if (packMat.map !== src.map) {
        packMat.map = src.map; // remplace l'atlas de préchauffage (même programme : pas de recompilation)
        packMat.needsUpdate = true;
      }
      mesh.material = packMat;
    });
    for (const c of [...gltf.scene.children]) kit.models.set(c.name, c);
  }

  /** Atlas Dungeon seul (chaudron, cadeaux, faux, chapeaux) : demandé avec la clairière ou la crypte. */
  let dungeonTexReady: Promise<void> | null = null;
  function ensureDungeonTex() {
    dungeonTexReady ??= new THREE.TextureLoader().loadAsync(ASSETS.dungeonTexture).then((tex) => {
      tex.flipY = false; // convention glTF, comme les autres atlas
      tex.colorSpace = THREE.SRGBColorSpace;
      for (const m of [dungeonMat, dungeonFlatMat]) {
        m.map = tex;
        m.needsUpdate = true;
      }
    });
    return dungeonTexReady;
  }

  let clearingReady: Promise<void> | null = null;
  function ensureClearing() {
    // Attend aussi le pack Halloween (citrouilles, tombes de la clairière) : les fichiers de la
    // clairière peuvent arriver avant lui, la clairière doit quand même être construite.
    clearingReady ??= Promise.all([
      loader.loadAsync(ASSETS.reaper).catch(() => null),
      loader.loadAsync(ASSETS.forest).catch(() => null),
      ensureDungeonTex().catch(() => null),
      halloween,
    ]).then(([reaperGltf, forest]) => {
      if (disposed) return;
      if (forest) registerPack(forest);
      reaper = createReaperClearing(kit, reaperGltf);
      outdoor.add(reaper.group);
      reaper.layout(frame);
      if (wanted === "reaper" && !shots.length) {
        if (graveyard && active === graveyard && cam.pos.distanceTo(graveyard.pose(frame).pos) < 0.5 && booted) planTo("reaper");
        else if (!booted) active = reaper;
      }
    });
    return clearingReady;
  }

  // Pack Halloween : utilisé par les trois lieux (la crypte en a besoin aussi : citrouilles, crâne,
  // cercueil). Sur /resultats, la crypte est demandée tout de suite : elle attend ce pack.
  const halloween = loader.loadAsync(ASSETS.halloween).then((gltf) => {
    if (!disposed) registerPack(gltf, modelMat);
  });
  // Logos : font partie de la scène 1 (wordmark au cimetière) ; sans eux, le décor s'affiche quand même.
  const logos = loader
    .loadAsync(ASSETS.logos)
    .then((gltf) => {
      if (!disposed) registerPack(gltf);
    })
    .catch((e) => console.warn("Logos indisponibles :", e));

  let dungeonReady: Promise<void> | null = null;
  function ensureDungeon() {
    dungeonReady ??= Promise.all([loader.loadAsync(ASSETS.dungeon), ensureDungeonTex(), logos, halloween]).then(([gltf]) => {
      if (disposed) return;
      registerPack(gltf, dungeonMat);
      crypt = createCrypt(kit);
      scene.add(crypt.group);
      crypt.group.visible = indoor;
      if (pendingResults) crypt.setResults(pendingResults);
      crypt.layout(frame);
      // Au démarrage sur /resultats, on ouvre directement dans la crypte (voir ready) ; ensuite, travelling.
      if (wanted === "crypt" && booted) planTo("crypt");
    }).catch((e) => console.warn("Crypte indisponible :", e));
    return dungeonReady;
  }

  let booted = false;
  const ready = Promise.all([halloween, logos])
    .then(async () => {
      if (disposed) return;
      graveyard = createGraveyard(kit);
      outdoor.add(graveyard.group);
      graveyard.addLogo();
      layout();
      // Rechargement en plein tirage au sort : on attend la clairière pour ouvrir directement dessus.
      // Arrivée sur /resultats : on attend la crypte et on ouvre directement dedans, devant le classement
      // encore poussiéreux (même pose que le poster de la page, voir scripts/3d/posters.mjs).
      if (wanted === "reaper") await ensureClearing();
      if (wanted === "crypt") await ensureDungeon();
      const start = wanted === "reaper" && reaper ? reaper : wanted === "crypt" && crypt ? crypt : graveyard;
      active = start;
      if (start === crypt) setIndoor(true);
      const p = start.pose(frame);
      cam.pos.copy(p.pos);
      cam.target.copy(p.target);
      // Ouverture directe sur la clairière : l'air est déjà rougi (même image que le poster).
      bloodK = start === reaper ? 1 : 0;
      applyPalette(0, true);
      // Shaders déjà compilés pendant le téléchargement (préchauffage) ; on complète ce qui manque.
      try {
        await warmUp();
        scene.updateMatrixWorld();
        await renderer.compileAsync(scene, camera);
      } catch {
        /* compilation anticipée indisponible : les shaders se compileront à la première image */
      }
      booted = true;
      // Le temps de la scène part de zéro à l'affichage : premier rendu identique au poster (t = 0).
      clock = 0;
      if (wanted === "crypt" && active === crypt) {
        crypt.resetDust();
        crypt.reveal(() => opts.onReveal?.());
        void ensureClearing();
      } else if (wanted === "crypt") {
        planTo("crypt");
        // La crypte reste prioritaire : la clairière attend qu'elle soit chargée.
        void (dungeonReady ?? Promise.resolve()).then(() => ensureClearing());
      } else {
        void ensureClearing();
      }
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
    // Sol texturé de la clairière : la texture porte ses couleurs (terre, herbe), la palette ne
    // donne que sa dominante, à luminosité fixe (sinon tout est noir sous ce sol très sombre).
    if (reaper?.groundTint) {
      const c = reaper.groundTint.set(palette.ground);
      c.multiplyScalar(2.6 / (Math.max(c.r, c.g, c.b) || 1)).lerp(tmpColor.setRGB(2.6, 2.6, 2.6), 0.8);
    }
    batMat.color.set(palette.bat);
    batMat.emissive.set(palette.batGlow);
    smoke.color.set(palette.smoke);
    smoke.opacity = palette.smokeA;
    kit.glowLevel.value = palette.glow;
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
    // Le sang de la clairière teinte l'air à l'approche de la caméra (et plus du tout au cimetière).
    bloodK = reaper && !indoor ? 1 - smooth(3, 12, cam.pos.distanceTo(reaper.pose(frame).pos)) : 0;
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
    if (active?.flinch) camera.position.add(active.flinch);
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
      if (f.cut) updateCutGlow(f.cut, k, palette.glow);
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
    const style = spotArea?.eyeStyle ?? DEFAULT_EYES;
    if (spotArea !== eyeArea) {
      eyeArea = spotArea;
      eyeSlots.forEach((e) => Object.assign(e, { phase: "off", spot: -1, t: 0, until: rand(1, 3) / style.haste }));
    }
    let shown = eyeSlots.filter((s) => s.phase !== "off").length;
    eyeSlots.forEach((e, i) => {
      e.t += dt;
      if (e.phase === "off" && e.t > e.until && palette.eyes > 0.3 && !reduce && spots.length && !shots.length && shown < style.pairs) {
        const used = new Set(eyeSlots.map((s) => s.spot));
        const free = spots.map((_, k) => k).filter((k) => !used.has(k));
        if (!free.length) return;
        shown++;
        e.spot = free[Math.floor(Math.random() * free.length)];
        e.phase = "in";
        e.t = 0;
        e.until = rand(2.5, 5.5) * (0.5 + 0.5 / style.haste);
        e.nextBlink = rand(0.8, 2);
        const col = eyeColor3.set(style.colors[Math.floor(Math.random() * style.colors.length)]);
        eyeColor.set([col.r, col.g, col.b], i * 3);
        eyeColAttr.needsUpdate = true;
        eyeMean[i] = style.mean;
        eyeMeanAttr.needsUpdate = true;
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
        if (e.t > 0.6) { e.phase = "off"; e.t = 0; e.until = rand(1.5, 6) / style.haste; e.spot = -1; }
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
      const size = 0.032 * style.scale * camera.position.distanceTo(spot) * Math.max(0.7, frame.objScale);
      eyeData.set([alpha * palette.eyes, open, e.look, size], i * 4);
    });
    eyes.instanceMatrix.needsUpdate = true;
    eyeAttr.needsUpdate = true;

    renderer.render(scene, camera);
    bloodScreen?.frame(dt, indoor ? 0 : bloodK);
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
    // Curseur « main » sur le panneau du classement seulement ; la lune / le soleil (easter egg) ne le trahit pas.
    if (e.pointerType === "mouse") document.documentElement.style.cursor = plaqueAt(e) ? "pointer" : "";
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
      bloodScreen?.dispose();
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
