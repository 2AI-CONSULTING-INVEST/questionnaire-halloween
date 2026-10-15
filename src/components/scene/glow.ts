/**
 * Lueur des découpes (yeux et bouche des citrouilles-lanternes) et des vitres (lanternes) : une
 * cellule de l'atlas KayKit devient émissive, de couleur chaude, avec le vacillement de la bougie.
 *
 * Deux passes :
 * 1. la passe opaque du modèle (MeshLambert + émissif sur la cellule), voilée par la brume et la
 *    fumée comme le reste de l'objet ;
 * 2. une seconde passe des seules faces de la cellule, rendue APRÈS les nappes de fumée
 *    (billboards : renderOrder 0), qui repose la même couleur par-dessus : la lumière de la
 *    bougie domine la fumée, dont le violet ne figure qu'un faible éclairage ambiant. Sans fumée
 *    devant, les deux passes donnent la même couleur. (Mesuré sur capture : sans cette passe, le
 *    rideau de la clairière délavait les découpes en beige, teinte 17°, saturation 22 %.)
 *
 * Les couleurs sont données en LINÉAIRE : le rendu convertit en sRGB, un (1, 0.55, 0.08) linéaire
 * donnerait un jaune pâle #ffc250. La passe opaque sature à teinte constante (jamais de blanc).
 */
import * as THREE from "three";
import type { Kit } from "./types";

export type CutSpec = {
  /** Cellule de l'atlas : u0, u1, v0, v1 (atlas 8 × 4). */
  cell: [number, number, number, number];
  /** Couleur linéaire des faces vues de biais (bords) et des faces de face (fond). */
  edge: [number, number, number];
  core: [number, number, number];
  /** Émissif de la passe opaque (× vacillement × niveau jour/nuit) : > 1 sature, normalisé à teinte constante. */
  glowMul: number;
  /** Halo additif supplémentaire devant les découpes (bloom simulé), en unités du modèle ; absent : aucun. */
  halo?: { color: string; pos: [number, number, number]; scale: [number, number]; opacity: number };
};

/** Citrouilles-lanternes : cellule « charcoal » (colonne 1 / ligne 0), seules faces sombres du modèle. */
export const JACK_CUT: CutSpec = {
  cell: [0.125, 0.25, 0, 0.25],
  edge: [0.3, 0.03, 0.001], // ≈ #9c3208 en sRGB
  core: [1.0, 0.22, 0.006], // ≈ #ff8314
  glowMul: 2.0,
  halo: { color: "#ff5a00", pos: [0, 0.58, 0.82], scale: [1.1, 0.9], opacity: 0.5 },
};

/** Lanternes (sur pied, suspendue, sur poteau) : vitres et flamme = cellule orange (colonne 2 / ligne 3). */
export const LANTERN_GLASS: CutSpec = {
  cell: [0.25, 0.375, 0.75, 1.0],
  edge: [0.55, 0.16, 0.01], // ≈ #c67420
  core: [1.0, 0.5, 0.06], // ≈ #ffbc46
  glowMul: 1.7,
};

/** Dessiné après la fumée (billboards : renderOrder 0). */
export const CUT_SHINE_ORDER = 5;

/** Uniformes pilotés chaque image (voir world.ts : boucle des flammes). */
export type CutGlow = {
  spec: CutSpec;
  glow: { value: number };
  shine: { value: number };
  halo: THREE.Sprite | null;
};

const cutGlsl = (c: CutSpec["cell"]) => /* glsl */ `step(${f(c[0])}, uv.x) * step(uv.x, ${f(c[1])}) * step(${f(c[2])}, uv.y) * step(uv.y, ${f(c[3])})`;
const colGlsl = (s: CutSpec) => /* glsl */ `mix(vec3(${s.edge.map(f).join(", ")}), vec3(${s.core.map(f).join(", ")}), facing * facing)`;
const f = (n: number) => (Number.isInteger(n) ? n.toFixed(1) : String(n));

/** Matériau du modèle : l'atlas, plus l'émissif de la cellule (passe opaque). */
function glowMaterial(map: THREE.Texture | null, spec: CutSpec, glow: { value: number }) {
  const mat = new THREE.MeshLambertMaterial({ map, fog: false });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uGlow = glow;
    shader.fragmentShader =
      "uniform float uGlow;\n" +
      shader.fragmentShader
        .replace(
          "#include <emissivemap_fragment>",
          `#include <emissivemap_fragment>
        {
          vec2 uv = vMapUv;
          float cut = ${cutGlsl(spec.cell)};
          float facing = clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0);
          totalEmissiveRadiance += ${colGlsl(spec)} * cut * uGlow;
        }`,
        )
        .replace(
          "#include <colorspace_fragment>",
          `// La bougie est tout près des parois : on sature en gardant la teinte (pas de blanc).
        float mx = max(gl_FragColor.r, max(gl_FragColor.g, gl_FragColor.b));
        if (mx > 1.0) gl_FragColor.rgb /= mx;
        #include <colorspace_fragment>`,
        );
  };
  // Clé de cache des programmes : un programme par cellule / couleurs, partagé entre les objets.
  mat.customProgramCacheKey = () => `cutglow:${spec.cell.join(",")}:${spec.edge.join(",")}:${spec.core.join(",")}`;
  return mat;
}

/** Seconde passe : les faces de la cellule seulement, même couleur, fusion normale (opacité uShine). */
function shineMaterial(spec: CutSpec, glow: { value: number }, shine: { value: number }) {
  return new THREE.ShaderMaterial({
    uniforms: { uGlow: glow, uShine: shine },
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalMatrix * normal;
        vV = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uGlow; uniform float uShine;
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main() {
        vec2 uv = vUv;
        if (${cutGlsl(spec.cell)} < 0.5) discard;
        float facing = clamp(abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0);
        vec3 col = ${colGlsl(spec)} * uGlow;
        float mx = max(col.r, max(col.g, col.b));
        if (mx > 1.0) col /= mx;
        gl_FragColor = vec4(col, uShine * mix(0.75, 1.0, facing));
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    fog: false,
  });
}

/**
 * Rend émissive une cellule de l'atlas sur un modèle KayKit cloné (ses maillages reçoivent un
 * matériau à part ; le modèle d'origine n'est pas touché). `shinePass` ajoute la seconde passe
 * (inutile en qualité basse hors clairière : une passe de dessin de moins par objet).
 */
export function applyCutGlow(kit: Kit, obj: THREE.Object3D, spec: CutSpec, shinePass: boolean): CutGlow {
  const glow = { value: 0 };
  const shine = { value: 0 };
  const mat = glowMaterial(kit.modelMat.map, spec, glow);
  const shineMat = shinePass ? shineMaterial(spec, glow, shine) : null;
  const meshes: THREE.Mesh[] = [];
  obj.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
  });
  for (const mesh of meshes) {
    mesh.material = mat;
    if (shineMat) {
      const over = new THREE.Mesh(mesh.geometry, shineMat);
      over.renderOrder = CUT_SHINE_ORDER;
      mesh.add(over); // même transformation que le maillage
    }
  }
  let halo: THREE.Sprite | null = null;
  if (spec.halo) {
    halo = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: kit.glowTex, color: spec.halo.color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
    );
    halo.position.set(...spec.halo.pos);
    halo.scale.set(spec.halo.scale[0], spec.halo.scale[1], 1);
    halo.renderOrder = CUT_SHINE_ORDER;
    obj.add(halo);
  }
  return { spec, glow, shine, halo };
}

/** Mise à jour par image : k = vacillement (0..1), level = niveau jour/nuit des lueurs. */
export function updateCutGlow(c: CutGlow, k: number, level: number) {
  c.glow.value = k * c.spec.glowMul * level;
  c.shine.value = level;
  if (c.halo) c.halo.material.opacity = k * level * (c.spec.halo?.opacity ?? 0);
}

/** Objet de préchauffage : compile les deux programmes avant l'affichage (voir createWorld). */
export function cutGlowWarmup(kit: Kit, geo: THREE.BufferGeometry) {
  const holder = new THREE.Group();
  for (const spec of [JACK_CUT, LANTERN_GLASS]) {
    const mesh = new THREE.Mesh(geo);
    holder.add(mesh);
    applyCutGlow(kit, mesh, spec, true);
  }
  return holder;
}
