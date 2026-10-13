/**
 * Décor 3D : un cimetière low-poly (KayKit Halloween Bits, CC0) posé en bas de l'écran,
 * avec brume au sol, fumée qui monte des citrouilles, nuées de chauves-souris et yeux
 * qui s'allument dans la pénombre. Three.js pur (pas de dépendance React) pour garder la
 * main sur les performances mobiles : un seul matériau texturé, peu de lumières, des
 * particules instanciées (un appel de dessin par effet).
 */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { Theme } from "@/lib/theme";

export type GraveyardOptions = {
  theme: Theme;
  reducedMotion: boolean;
  /** "low" : téléphones modestes (moins de particules, de lumières et de pixels). */
  quality: "high" | "low";
};

export type Graveyard = {
  ready: Promise<void>;
  setTheme(theme: Theme): void;
  /** Une nuée de chauves-souris s'envole du cimetière. */
  swarm(size?: number): void;
  dispose(): void;
};

const MODEL_URL = "/3d/halloween.glb";
const CAMERA_Z = 12;

// ---------------------------------------------------------------------------
// Composition. nx = position horizontale normalisée (-1 bord gauche, 1 bord droit) à la
// profondeur z : la scène s'adapte au format de l'écran (téléphone vertical ou écran large).
// ---------------------------------------------------------------------------

type Tag = "jack" | "candle" | "lantern" | "post";
type Placement = { name: string; nx: number; z: number; s?: number; ry?: number; y?: number; shadow?: boolean; tag?: Tag };

const PLACEMENTS: Placement[] = [
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

/** Points sombres où des yeux peuvent s'allumer (nx, hauteur, z). */
const EYE_SPOTS: [number, number, number][] = [
  [-0.18, 5.1, -13.4], // chouette dans l'arbre mort
  [0.3, 1.5, -15.2], // porte de la crypte
  [-0.62, 0.45, -9.0],
  [0.62, 0.45, -9.2],
  [-0.85, 0.5, -6.4],
  [0.95, 0.7, -12],
  [-0.92, 1.3, -16],
  [0.25, 0.35, -6.8],
  [-0.9, 0.35, 0.9],
  [0.78, 0.4, -3.4],
];

type Palette = {
  fog: string; near: number; far: number;
  hemiSky: string; hemiGround: string; hemi: number;
  moon: string; moonI: number;
  ground: string;
  lights: number; glow: number;
  mist: string; mistA: number;
  smoke: string; smokeA: number;
  eyes: number; bat: string; batGlow: string;
};

const PALETTES: Record<Theme, Palette> = {
  dark: {
    fog: "#1a1228", near: 12, far: 44,
    hemiSky: "#7d74b8", hemiGround: "#1a1020", hemi: 0.75,
    moon: "#aebcff", moonI: 0.95,
    ground: "#2a2133",
    lights: 1, glow: 1,
    mist: "#9488b8", mistA: 0.32,
    smoke: "#a49bb8", smokeA: 0.3,
    eyes: 1, bat: "#4a3d60", batGlow: "#241a33",
  },
  light: {
    fog: "#f4e1c9", near: 9, far: 40,
    hemiSky: "#fff4dc", hemiGround: "#b39a72", hemi: 1.7,
    moon: "#fff0d0", moonI: 1.9,
    ground: "#b29c74",
    lights: 0.2, glow: 0.12,
    mist: "#ffffff", mistA: 0.38,
    smoke: "#ffffff", smokeA: 0.22,
    eyes: 0, bat: "#3a3040", batGlow: "#000000",
  },
};

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

/** Relief doux, qui se soulève vers le fond pour dessiner une ligne d'horizon. */
function groundHeight(x: number, z: number) {
  const base = 0.22 * Math.sin(x * 0.35 + 1) * Math.cos(z * 0.3);
  const hills = z < -12 ? (-z - 12) * 0.09 * (0.6 + 0.4 * Math.sin(x * 0.13 + 2)) : 0;
  return base + hills;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
/** Scintillement de flamme (somme de sinus, pas de bruit coûteux). */
const flicker = (t: number, seed: number) =>
  0.82 + 0.1 * Math.sin(t * 9.7 + seed) + 0.06 * Math.sin(t * 23.3 + seed * 2.1) + 0.04 * Math.sin(t * 41 + seed * 3.7);

function canvasTexture(size: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  draw(c.getContext("2d")!, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const glowTexture = () =>
  canvasTexture(64, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.25, "rgba(255,255,255,0.55)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });

/** Volute de fumée : plusieurs bouffées superposées, bords très doux. */
const smokeTexture = () =>
  canvasTexture(128, (ctx, s) => {
    for (let i = 0; i < 14; i++) {
      const x = s / 2 + rand(-s * 0.18, s * 0.18);
      const y = s / 2 + rand(-s * 0.18, s * 0.18);
      const r = rand(s * 0.16, s * 0.32);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, "rgba(255,255,255,0.22)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    }
  });

const shadowTexture = () =>
  canvasTexture(64, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, "rgba(0,0,0,0.6)");
    g.addColorStop(0.6, "rgba(0,0,0,0.25)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });

// ---------------------------------------------------------------------------
// Particules « billboard » instanciées (brume, fumée) : une seule passe de dessin.
// ---------------------------------------------------------------------------

const BILLBOARD_VERT = /* glsl */ `
  attribute vec4 aData; // x: opacité, y: rotation, z: taille
  varying vec2 vUv;
  varying float vAlpha;
  #include <fog_pars_vertex>
  void main() {
    vUv = uv;
    vAlpha = aData.x;
    vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    float c = cos(aData.y), s = sin(aData.y);
    mvPosition.xy += mat2(c, s, -s, c) * position.xy * aData.z;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const BILLBOARD_FRAG = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec2 vUv;
  varying float vAlpha;
  #include <fog_pars_fragment>
  void main() {
    float a = texture2D(uMap, vUv).a * vAlpha * uOpacity;
    if (a < 0.003) discard;
    gl_FragColor = vec4(uColor, a);
    #include <fog_fragment>
  }
`;

class Billboards {
  readonly mesh: THREE.InstancedMesh;
  readonly uniforms: { uMap: { value: THREE.Texture }; uColor: { value: THREE.Color }; uOpacity: { value: number } };
  private data: Float32Array;
  private attr: THREE.InstancedBufferAttribute;
  private m = new THREE.Matrix4();

  constructor(count: number, map: THREE.Texture) {
    const geo = new THREE.PlaneGeometry(1, 1);
    this.data = new Float32Array(count * 4);
    this.attr = new THREE.InstancedBufferAttribute(this.data, 4).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute("aData", this.attr);
    this.uniforms = { uMap: { value: map }, uColor: { value: new THREE.Color() }, uOpacity: { value: 1 } };
    const mat = new THREE.ShaderMaterial({
      vertexShader: BILLBOARD_VERT,
      fragmentShader: BILLBOARD_FRAG,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {}]),
      transparent: true,
      depthWrite: false,
      fog: true,
    });
    Object.assign(mat.uniforms, this.uniforms);
    this.mesh = new THREE.InstancedMesh(geo, mat, count);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  }

  set(i: number, x: number, y: number, z: number, alpha: number, rot: number, size: number) {
    this.m.makeTranslation(x, y, z);
    this.mesh.setMatrixAt(i, this.m);
    this.data.set([alpha, rot, size, 0], i * 4);
  }

  commit() {
    this.mesh.instanceMatrix.needsUpdate = true;
    this.attr.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------
// Chauve-souris : silhouette low-poly, battement d'ailes dans le vertex shader.
// Avant = +Z, ailes le long de X.
// ---------------------------------------------------------------------------

function batGeometry() {
  const v: number[] = [];
  const tri = (a: number[], b: number[], c: number[]) => v.push(...a, ...b, ...c);
  // Aile droite : éventail depuis l'épaule, bord de fuite festonné.
  const R = [0.03, 0, -0.02];
  const wing = [
    [0.03, 0, 0.06], [0.3, 0.01, 0.13], [0.64, 0, 0.02], [0.48, 0, -0.07], [0.5, 0, -0.2],
    [0.33, 0, -0.1], [0.3, 0, -0.24], [0.15, 0, -0.12], [0.03, 0, -0.1],
  ];
  for (const side of [1, -1]) {
    const w = wing.map(([x, y, z]) => [x * side, y, z]);
    const r = [R[0] * side, R[1], R[2]];
    for (let i = 0; i < w.length - 1; i++) tri(r, w[i], w[i + 1]);
    // Oreilles
    tri([0.012 * side, 0.03, 0.13], [0.035 * side, 0.09, 0.11], [0.04 * side, 0.02, 0.1]);
  }
  // Corps : losange allongé.
  const body = [
    [0, 0.04, 0.15], [0.04, 0, 0.02], [0, 0.03, -0.14], [-0.04, 0, 0.02], [0, -0.035, 0.02],
  ];
  const [nose, r1, tail, l1, belly] = body;
  tri(nose, r1, tail); tri(nose, tail, l1); tri(belly, r1, nose); tri(belly, nose, l1);
  tri(belly, tail, r1); tri(belly, l1, tail);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
  geo.computeVertexNormals();
  return geo;
}

type Bat = {
  active: boolean;
  t0: number;
  dur: number;
  p: THREE.Vector3[]; // courbe de Bézier (4 points)
  wobble: number;
  scale: number;
};

// ---------------------------------------------------------------------------
// Yeux : deux amandes lumineuses avec pupille fendue, halo additif.
// ---------------------------------------------------------------------------

const EYES_VERT = /* glsl */ `
  attribute vec4 aEye;   // x: opacité, y: ouverture, z: regard, w: taille
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

export function createGraveyard(canvas: HTMLCanvasElement, opts: GraveyardOptions): Graveyard {
  const low = opts.quality === "low";
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !low, powerPreference: "low-power" });
  let pixelRatio = Math.min(window.devicePixelRatio || 1, low ? 1.25 : 1.75);
  renderer.setPixelRatio(pixelRatio);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 120);
  const palette = structuredClone(PALETTES[opts.theme]);
  let target = PALETTES[opts.theme];

  scene.fog = new THREE.Fog(palette.fog, palette.near, palette.far);
  const hemi = new THREE.HemisphereLight(palette.hemiSky, palette.hemiGround, palette.hemi);
  const moon = new THREE.DirectionalLight(palette.moon, palette.moonI);
  moon.position.set(-8, 12, 6);
  scene.add(hemi, moon);

  // Sol
  const groundGeo = new THREE.PlaneGeometry(140, 70, 70, 35);
  groundGeo.rotateX(-Math.PI / 2);
  groundGeo.translate(0, 0, -20);
  const pos = groundGeo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, groundHeight(x, z));
    // Taches plus sombres / plus claires pour casser l'uniformité.
    const k = 0.82 + 0.18 * Math.sin(x * 0.9 + Math.cos(z * 0.7) * 2) * Math.cos(z * 1.1 - x * 0.3);
    colors.set([k, k, k], i * 3);
  }
  groundGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  groundGeo.computeVertexNormals();
  const groundMat = new THREE.MeshLambertMaterial({ color: palette.ground, vertexColors: true });
  scene.add(new THREE.Mesh(groundGeo, groundMat));

  const glowTex = glowTexture();
  const smokeTex = smokeTexture();
  const shadowTex = shadowTexture();
  const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const shadowGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

  // ----- Objets du cimetière (remplis après chargement du GLB) -----
  type Placed = { p: Placement; obj: THREE.Group; shadow?: THREE.Mesh; width: number };
  const placed: Placed[] = [];
  type Flame = { light?: THREE.PointLight; glow: THREE.Sprite; local: THREE.Vector3; owner: Placed; base: number; glowSize: number; seed: number; smoke: boolean };
  const flames: Flame[] = [];
  let objScale = 1;

  const modelMat = new THREE.MeshLambertMaterial();

  // ----- Brume au sol et fumée -----
  const MIST = low ? 14 : 26;
  const mist = new Billboards(MIST, smokeTex);
  const mistState = Array.from({ length: MIST }, () => ({
    nx: rand(-1.3, 1.3), y: rand(0.15, 1.1), z: rand(-15, 5), speed: rand(0.025, 0.06), size: rand(4.5, 9), rot: rand(0, 6.28), spin: rand(-0.04, 0.04), a: rand(0.5, 1),
  }));
  scene.add(mist.mesh);

  const SMOKE_PER = low ? 4 : 7;
  const SMOKE = SMOKE_PER * 6;
  const smoke = new Billboards(SMOKE, smokeTex);
  const smokeState = Array.from({ length: SMOKE }, (_, i) => ({ emitter: Math.floor(i / SMOKE_PER), offset: Math.random(), life: rand(3.2, 5.5), seed: rand(0, 100) }));
  scene.add(smoke.mesh);

  // ----- Braises -----
  const EMBERS = low ? 0 : 36;
  const emberGeo = new THREE.BufferGeometry();
  const emberPos = new Float32Array(EMBERS * 3);
  const emberCol = new Float32Array(EMBERS * 4);
  emberGeo.setAttribute("position", new THREE.BufferAttribute(emberPos, 3).setUsage(THREE.DynamicDrawUsage));
  emberGeo.setAttribute("color", new THREE.BufferAttribute(emberCol, 4).setUsage(THREE.DynamicDrawUsage));
  const emberMat = new THREE.PointsMaterial({ size: 0.09, map: glowTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const embers = new THREE.Points(emberGeo, emberMat);
  embers.frustumCulled = false;
  const emberState = Array.from({ length: EMBERS }, () => ({ emitter: 0, offset: Math.random(), life: rand(1.8, 3.4), seed: rand(0, 100) }));
  if (EMBERS) scene.add(embers);

  // ----- Chauves-souris -----
  const AMBIENT_BATS = 5;
  const SWARM_BATS = low ? 26 : 48;
  const BATS = AMBIENT_BATS + SWARM_BATS;
  const batGeo = batGeometry();
  const phases = new Float32Array(BATS).map(() => rand(0, 6.28));
  batGeo.setAttribute("aPhase", new THREE.InstancedBufferAttribute(phases, 1));
  const timeUniform = { value: 0 };
  const batMat = new THREE.MeshLambertMaterial({ color: palette.bat, emissive: palette.batGlow, side: THREE.DoubleSide });
  batMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = timeUniform;
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
  const ambient = Array.from({ length: AMBIENT_BATS }, () => ({ r: rand(2.5, 6), speed: rand(0.35, 0.7) * (Math.random() < 0.5 ? -1 : 1), a0: rand(0, 6.28), y: rand(7.5, 11), bob: rand(0, 6.28) }));
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
  const eyesMat = new THREE.ShaderMaterial({ vertexShader: EYES_VERT, fragmentShader: EYES_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const eyes = new THREE.InstancedMesh(eyesGeo, eyesMat, EYES);
  eyes.frustumCulled = false;
  eyes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(eyes);
  const eyeSlots: EyeSlot[] = Array.from({ length: EYES }, (_, i) => ({ spot: -1, phase: "off", t: 0, until: rand(1, 4) + i * 1.5, nextBlink: 0, blinkT: -1, look: 0, lookTarget: 0 }));
  const eyeSpots = EYE_SPOTS.map(() => new THREE.Vector3());

  // ----- Cadrage : s'adapte au format de l'écran -----
  const look = new THREE.Vector3();
  const camBase = new THREE.Vector3();
  let halfTan = 0.36;
  const halfWidthAt = (z: number) => halfTan * camera.aspect * (CAMERA_Z - z);

  function layout() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    const aspect = w / h;
    camera.aspect = aspect;
    camera.fov = aspect < 0.8 ? 52 : aspect < 1.25 ? 46 : 40;
    const half = THREE.MathUtils.degToRad(camera.fov / 2);
    halfTan = Math.tan(half);
    // Premier plan en bas de l'écran, horizon vers les deux tiers.
    const H = 8.5 * Math.tan(0.62 * half);
    camBase.set(0, H + 0.2, CAMERA_Z);
    look.set(0, H + 0.2 + Math.tan(0.32 * half) * CAMERA_Z, 0);
    camera.updateProjectionMatrix();
    objScale = THREE.MathUtils.clamp(aspect * 1.15, 0.55, 1);

    for (const pl of placed) {
      const { p, obj } = pl;
      const x = p.nx * halfWidthAt(p.z) * 0.92;
      const y = groundHeight(x, p.z);
      obj.position.set(x, y + (p.y ?? 0) * objScale, p.z);
      obj.scale.setScalar((p.s ?? 1) * objScale);
      if (pl.shadow) {
        pl.shadow.position.set(x, y + 0.03, p.z);
        pl.shadow.scale.setScalar(pl.width * 1.5 * (p.s ?? 1) * objScale);
      }
    }
    EYE_SPOTS.forEach(([nx, y, z], i) => {
      const x = nx * halfWidthAt(z) * 0.92;
      eyeSpots[i].set(x, groundHeight(x, z) + y * objScale, z);
    });
    if (reduce) render(0);
  }

  // ----- Chargement des modèles -----
  const ready = new GLTFLoader()
    .loadAsync(MODEL_URL)
    .then((gltf) => {
      if (disposed) return;
      let map: THREE.Texture | null = null;
      gltf.scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh && !map) map = (mesh.material as THREE.MeshStandardMaterial).map;
      });
      modelMat.map = map;
      modelMat.needsUpdate = true;
      const templates = new Map(gltf.scene.children.map((c) => [c.name, c]));

      for (const p of PLACEMENTS) {
        const tpl = templates.get(p.name);
        if (!tpl) continue;
        const model = tpl.clone();
        model.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (mesh.isMesh) mesh.material = modelMat;
        });
        // Le nœud garde sa transformation (quantification) : on le place via un groupe parent.
        const obj = new THREE.Group();
        obj.add(model);
        obj.rotation.y = p.ry ?? 0;
        scene.add(obj);
        const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
        const entry: Placed = { p, obj, width: Math.max(size.x, size.z) };
        if (p.shadow) {
          entry.shadow = new THREE.Mesh(shadowGeo, shadowMat);
          scene.add(entry.shadow);
        }
        placed.push(entry);
        if (p.tag) addFlame(entry, p.tag);
      }
      layout();
    })
    .catch((e) => console.warn("Décor 3D indisponible :", e));

  function addFlame(owner: Placed, tag: Tag) {
    const cfg = {
      jack: { local: new THREE.Vector3(0, 0.62, 0.15), intensity: 7, distance: 7, glow: 2.2, smoke: true },
      candle: { local: new THREE.Vector3(0, owner.p.name === "skull_candle" ? 1.3 : 0.85, 0), intensity: 2.2, distance: 3.5, glow: 0.7, smoke: true },
      lantern: { local: new THREE.Vector3(0, 0.55, 0), intensity: 3.5, distance: 5, glow: 1.3, smoke: false },
      post: { local: new THREE.Vector3(0, 2.55, 1.15), intensity: 4, distance: 7, glow: 1.6, smoke: false },
    }[tag];
    const maxLights = low ? 3 : 7;
    const light = flames.filter((f) => f.light).length < maxLights && tag !== "candle" ? new THREE.PointLight("#ff8a2a", cfg.intensity, cfg.distance, 1.6) : undefined;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: tag === "jack" ? "#ff9a3c" : "#ffc266", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    if (light) scene.add(light);
    scene.add(glow);
    flames.push({ light, glow, local: cfg.local, owner, base: cfg.intensity, glowSize: cfg.glow, seed: rand(0, 50), smoke: cfg.smoke });
  }

  const tmp = new THREE.Vector3();
  const flameWorld = (f: Flame, out: THREE.Vector3) => out.copy(f.local).applyMatrix4(f.owner.obj.matrixWorld);

  // ----- Nuée de chauves-souris -----
  function swarm(size = SWARM_BATS) {
    if (reduce) return;
    const now = clock;
    const fromCrypt = Math.random() < 0.5;
    const origin = fromCrypt
      ? new THREE.Vector3(0.42 * halfWidthAt(-20) * 0.92, 5, -17)
      : new THREE.Vector3(-0.18 * halfWidthAt(-14) * 0.92, 6.2 * objScale, -13.5);
    const side = Math.random() < 0.5 ? -1 : 1;
    let launched = 0;
    for (const b of swarmBats) {
      if (b.active || launched >= size) continue;
      launched++;
      const s = Math.random() < 0.82 ? side : -side;
      b.active = true;
      b.t0 = now + launched * 0.035 + rand(0, 0.35);
      b.dur = rand(3.2, 4.6);
      b.p[0].copy(origin).add(tmp.set(rand(-0.8, 0.8), rand(-0.5, 0.5), rand(-0.8, 0.8)));
      b.p[1].copy(origin).add(tmp.set(rand(-3, 3), rand(3.5, 6.5), rand(2, 5)));
      b.p[2].set(s * halfWidthAt(4) * rand(0.1, 0.8), rand(3, 7), rand(3, 6));
      b.p[3].set(s * (halfWidthAt(6) * 1.7 + rand(1, 3)), rand(5, 10), rand(5, 8));
      b.wobble = rand(0, 6.28);
      b.scale = rand(0.7, 1.15);
    }
  }

  // ----- Animation -----
  const dummy = new THREE.Object3D();
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Color();
  const toColor = new THREE.Color();
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  let clock = 0;
  let disposed = false;
  let raf = 0;
  const reduce = opts.reducedMotion;
  let nextSwarm = rand(5, 9);
  let slowFrames = 0;
  let degraded = low;

  const bezier = (p: THREE.Vector3[], t: number, out: THREE.Vector3) => {
    const u = 1 - t;
    return out
      .copy(p[0]).multiplyScalar(u * u * u)
      .addScaledVector(p[1], 3 * u * u * t)
      .addScaledVector(p[2], 3 * u * t * t)
      .addScaledVector(p[3], t * t * t);
  };

  function applyPalette(dt: number) {
    // Transition douce entre la nuit et le jour.
    const k = reduce ? 1 : 1 - Math.exp(-dt * 2.5);
    const from = palette as Record<string, number | string>;
    for (const [key, to] of Object.entries(target)) {
      const cur = from[key];
      from[key] = typeof to === "number" ? (cur as number) + (to - (cur as number)) * k : "#" + c.set(cur as string).lerp(toColor.set(to), k).getHexString();
    }
    const fog = scene.fog as THREE.Fog;
    fog.color.set(palette.fog);
    fog.near = palette.near;
    fog.far = palette.far;
    hemi.color.set(palette.hemiSky);
    hemi.groundColor.set(palette.hemiGround);
    hemi.intensity = palette.hemi;
    moon.color.set(palette.moon);
    moon.intensity = palette.moonI;
    groundMat.color.set(palette.ground);
    batMat.color.set(palette.bat);
    batMat.emissive.set(palette.batGlow);
    mist.uniforms.uColor.value.set(palette.mist);
    mist.uniforms.uOpacity.value = palette.mistA;
    smoke.uniforms.uColor.value.set(palette.smoke);
    smoke.uniforms.uOpacity.value = palette.smokeA;
  }

  function render(dt: number) {
    clock += dt;
    const t = clock;
    timeUniform.value = t;
    applyPalette(dt);

    // Caméra : légère respiration + parallaxe au pointeur.
    pointer.sx += (pointer.x - pointer.sx) * Math.min(1, dt * 2);
    pointer.sy += (pointer.y - pointer.sy) * Math.min(1, dt * 2);
    camera.position.set(camBase.x + pointer.sx * 0.6 + Math.sin(t * 0.13) * 0.15, camBase.y + pointer.sy * 0.25 + Math.sin(t * 0.21) * 0.05, camBase.z);
    camera.lookAt(look);
    scene.updateMatrixWorld();

    // Flammes
    for (const f of flames) {
      const k = flicker(t, f.seed);
      flameWorld(f, tmp);
      if (f.light) {
        f.light.position.copy(tmp);
        f.light.intensity = f.base * k * palette.lights * (f.owner.obj.scale.x);
      }
      f.glow.position.copy(tmp);
      const g = f.glowSize * f.owner.obj.scale.x * (0.9 + 0.15 * k);
      f.glow.scale.set(g, g, 1);
      f.glow.material.opacity = 0.55 * k * palette.glow;
    }

    // Brume : dérive lente vers la droite, rebouclée hors champ.
    mistState.forEach((m, i) => {
      if (!reduce) m.nx += (m.speed * dt * 10) / Math.max(4, halfWidthAt(m.z));
      if (m.nx > 1.3) m.nx = -1.3;
      m.rot += m.spin * dt;
      const edge = smooth(1.3, 1.0, Math.abs(m.nx));
      const x = m.nx * halfWidthAt(m.z);
      mist.set(i, x, groundHeight(x, m.z) + m.y, m.z, m.a * edge * (m.z > 2 ? 0.55 : 1), m.rot, m.size * (m.z > 0 ? 0.7 : 1));
    });
    mist.commit();

    // Fumée qui monte des flammes.
    const emitters = flames.filter((f) => f.smoke);
    smokeState.forEach((s, i) => {
      const f = emitters[s.emitter % Math.max(1, emitters.length)];
      if (!f) return smoke.set(i, 0, -50, 0, 0, 0, 0);
      const life = ((t / s.life + s.offset) % 1 + 1) % 1;
      flameWorld(f, a);
      const scale = f.owner.obj.scale.x;
      const rise = life * 2.4 * scale * (f.owner.p.tag === "candle" ? 0.7 : 1);
      const sway = Math.sin(t * 0.8 + s.seed) * 0.35 * life * scale;
      const size = (0.35 + life * 1.7) * scale * (f.owner.p.tag === "candle" ? 0.6 : 1);
      const alpha = smooth(0, 0.18, life) * (1 - life) * 0.9;
      smoke.set(i, a.x + sway, a.y + 0.25 * scale + rise, a.z + Math.cos(s.seed + t * 0.5) * 0.15 * life, alpha, s.seed + life * 1.2, size);
    });
    smoke.commit();

    // Braises
    if (EMBERS) {
      const jacks = flames.filter((f) => f.owner.p.tag === "jack" || f.owner.p.tag === "candle");
      emberState.forEach((e, i) => {
        const f = jacks[i % Math.max(1, jacks.length)];
        if (!f) return;
        const life = ((t / e.life + e.offset) % 1 + 1) % 1;
        flameWorld(f, a);
        const scale = f.owner.obj.scale.x;
        emberPos.set([a.x + Math.sin(t * 1.7 + e.seed) * 0.3 * life * scale, a.y + 0.2 + life * 2.2 * scale, a.z + Math.cos(t * 1.3 + e.seed) * 0.2 * life], i * 3);
        const al = Math.sin(Math.PI * life) * palette.glow * (0.6 + 0.4 * Math.sin(t * 13 + e.seed));
        emberCol.set([1, 0.55 + 0.3 * Math.sin(e.seed), 0.15, al], i * 4);
      });
      emberGeo.attributes.position.needsUpdate = true;
      emberGeo.attributes.color.needsUpdate = true;
    }

    // Chauves-souris : quelques-unes tournent au-dessus de la crypte…
    const crypt = placed.find((p) => p.p.name === "crypt");
    const cx = crypt ? crypt.obj.position.x : 4;
    ambient.forEach((bat, i) => {
      if (reduce) return bats.setMatrixAt(i, zero);
      const ang = bat.a0 + t * bat.speed;
      a.set(cx + Math.cos(ang) * bat.r, bat.y * objScale + Math.sin(t * 0.9 + bat.bob) * 0.4, -20 + Math.sin(ang) * bat.r * 0.6);
      b.set(cx + Math.cos(ang + 0.05 * Math.sign(bat.speed)) * bat.r, a.y, -20 + Math.sin(ang + 0.05 * Math.sign(bat.speed)) * bat.r * 0.6);
      dummy.position.copy(a);
      dummy.lookAt(b);
      dummy.rotateZ(-0.35 * Math.sign(bat.speed));
      dummy.scale.setScalar(0.9);
      dummy.updateMatrix();
      bats.setMatrixAt(i, dummy.matrix);
    });
    // … et des nuées s'envolent de temps en temps.
    if (!reduce && t > nextSwarm) {
      swarm(Math.round(SWARM_BATS * rand(0.5, 1)));
      nextSwarm = t + rand(16, 28);
    }
    swarmBats.forEach((bat, j) => {
      const i = AMBIENT_BATS + j;
      const u = (t - bat.t0) / bat.dur;
      if (!bat.active || u < 0 || u > 1) {
        if (bat.active && u > 1) bat.active = false;
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

    // Yeux dans la pénombre
    eyeSlots.forEach((e, i) => {
      e.t += dt;
      if (e.phase === "off" && e.t > e.until && palette.eyes > 0.5 && !reduce) {
        const used = new Set(eyeSlots.map((s) => s.spot));
        const free = EYE_SPOTS.map((_, k) => k).filter((k) => !used.has(k));
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
      const spot = e.spot >= 0 ? eyeSpots[e.spot] : null;
      if (!spot) {
        eyeData.set([0, 0, 0, 0], i * 4);
        eyes.setMatrixAt(i, zero);
        return;
      }
      dummy.position.copy(spot);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      eyes.setMatrixAt(i, dummy.matrix);
      const size = 0.032 * camera.position.distanceTo(spot) * Math.max(0.7, objScale);
      eyeData.set([alpha * palette.eyes, open, e.look, size], i * 4);
    });
    eyes.instanceMatrix.needsUpdate = true;
    eyeAttr.needsUpdate = true;

    renderer.render(scene, camera);
  }

  let last = performance.now();
  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
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
    render(dt);
  }

  const onResize = () => layout();
  const onPointer = (e: PointerEvent) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);
  };
  const onLost = (e: Event) => {
    e.preventDefault();
    cancelAnimationFrame(raf);
  };
  window.addEventListener("resize", onResize);
  window.addEventListener("pointermove", onPointer, { passive: true });
  canvas.addEventListener("webglcontextlost", onLost);

  layout();
  if (reduce) {
    void ready.then(() => render(0));
  } else {
    raf = requestAnimationFrame(frame);
  }

  return {
    ready,
    setTheme(theme) {
      target = PALETTES[theme];
      if (reduce) render(0);
    },
    swarm,
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointer);
      canvas.removeEventListener("webglcontextlost", onLost);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
        mats.forEach((mat) => mat.dispose());
      });
      [glowTex, smokeTex, shadowTex, modelMat.map].forEach((tx) => tx?.dispose());
      renderer.dispose();
    },
  };
}
