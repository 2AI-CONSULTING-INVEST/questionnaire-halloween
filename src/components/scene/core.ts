/** Outils partagés du décor 3D : aléatoire, textures générées, particules instanciées. */
import * as THREE from "three";

export const rand = (a: number, b: number) => a + Math.random() * (b - a);

export const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Scintillement de flamme (somme de sinus, pas de bruit coûteux). */
export const flicker = (t: number, seed: number) =>
  0.82 + 0.1 * Math.sin(t * 9.7 + seed) + 0.06 * Math.sin(t * 23.3 + seed * 2.1) + 0.04 * Math.sin(t * 41 + seed * 3.7);

/** Pseudo-aléatoire reproductible (même décor à chaque visite). */
export function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

/** Relief doux, qui se soulève vers le fond pour dessiner une ligne d'horizon (identique à la scène d'origine). */
export function groundHeight(x: number, z: number) {
  const base = 0.22 * Math.sin(x * 0.35 + 1) * Math.cos(z * 0.3);
  const hills = z < -12 ? (-z - 12) * 0.09 * (0.6 + 0.4 * Math.sin(x * 0.13 + 2)) : 0;
  return base + hills;
}

export function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, srgb = true) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!, w, h);
  const tex = new THREE.CanvasTexture(c);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export const glowTexture = () =>
  canvasTexture(64, 64, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.25, "rgba(255,255,255,0.55)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });

/** Volute de fumée : plusieurs bouffées superposées, bords très doux. */
export const smokeTexture = () =>
  canvasTexture(128, 128, (ctx, s) => {
    const r = seeded(11);
    for (let i = 0; i < 14; i++) {
      const x = s / 2 + (r() - 0.5) * s * 0.36;
      const y = s / 2 + (r() - 0.5) * s * 0.36;
      const rad = s * (0.16 + r() * 0.16);
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, "rgba(255,255,255,0.22)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    }
  });

export const shadowTexture = () =>
  canvasTexture(64, 64, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, "rgba(0,0,0,0.6)");
    g.addColorStop(0.6, "rgba(0,0,0,0.25)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });

/** Toile d'araignée dessinée (rayons + spirale), coin en haut à gauche de la texture. */
export const webTexture = () =>
  canvasTexture(256, 256, (ctx, s) => {
    ctx.strokeStyle = "rgba(235,235,245,0.75)";
    ctx.lineWidth = 1.4;
    const rays = 9;
    const angles = Array.from({ length: rays }, (_, i) => (i / (rays - 1)) * (Math.PI / 2));
    for (const a of angles) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * s * 1.05, Math.sin(a) * s * 1.05);
      ctx.stroke();
    }
    ctx.lineWidth = 1;
    for (let r = 18; r < s; r += 17 + r * 0.06) {
      ctx.beginPath();
      angles.forEach((a, i) => {
        const sag = i > 0 ? 0.92 : 1; // fils légèrement détendus entre les rayons
        const rr = r * (i % 2 ? sag : 1);
        const x = Math.cos(a) * rr;
        const y = Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.quadraticCurveTo(Math.cos(a - 0.1) * rr * 0.93, Math.sin(a - 0.1) * rr * 0.93, x, y);
      });
      ctx.stroke();
    }
  });

/** Pierres taillées (murs de la crypte). */
export const stoneTexture = (tone = [70, 64, 82]) =>
  canvasTexture(512, 512, (ctx, s) => {
    const r = seeded(5);
    ctx.fillStyle = "#1a1620";
    ctx.fillRect(0, 0, s, s);
    const rowH = s / 8;
    for (let row = 0; row < 8; row++) {
      let x = row % 2 ? -rowH * 0.8 : 0;
      while (x < s) {
        const w = rowH * (1.3 + r() * 1.1);
        const k = 0.75 + r() * 0.35;
        ctx.fillStyle = `rgb(${tone[0] * k},${tone[1] * k},${tone[2] * k})`;
        ctx.beginPath();
        ctx.roundRect(x + 3, row * rowH + 3, w - 6, rowH - 6, 6);
        ctx.fill();
        // Petites taches pour la matière
        for (let i = 0; i < 6; i++) {
          ctx.fillStyle = `rgba(0,0,0,${0.05 + r() * 0.08})`;
          ctx.beginPath();
          ctx.arc(x + r() * w, row * rowH + r() * rowH, 2 + r() * 7, 0, Math.PI * 2);
          ctx.fill();
        }
        x += w;
      }
    }
  });

/** Dalles du sol. */
export const tileTexture = () =>
  canvasTexture(512, 512, (ctx, s) => {
    const r = seeded(9);
    ctx.fillStyle = "#15111a";
    ctx.fillRect(0, 0, s, s);
    const n = 4;
    const t = s / n;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const k = 0.7 + r() * 0.35;
        ctx.fillStyle = `rgb(${62 * k},${56 * k},${70 * k})`;
        ctx.beginPath();
        ctx.roundRect(i * t + 4, j * t + 4, t - 8, t - 8, 8);
        ctx.fill();
      }
  });

/** Poussière du mur (avant le coup de main du squelette). */
export const dustTexture = () =>
  canvasTexture(256, 256, (ctx, s) => {
    const r = seeded(3);
    ctx.fillStyle = "#6f6658";
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 900; i++) {
      const k = r();
      ctx.fillStyle = `rgba(${k > 0.5 ? 150 : 60},${k > 0.5 ? 140 : 54},${k > 0.5 ? 120 : 48},${0.12 + r() * 0.2})`;
      ctx.beginPath();
      ctx.arc(r() * s, r() * s, 1 + r() * 6, 0, Math.PI * 2);
      ctx.fill();
    }
  });

// ---------------------------------------------------------------------------
// Particules « billboard » instanciées (brume, fumée, poussière) : une passe de dessin.
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

export class Billboards {
  readonly mesh: THREE.InstancedMesh;
  readonly color: THREE.Color;
  private uniforms: { uMap: { value: THREE.Texture }; uColor: { value: THREE.Color }; uOpacity: { value: number } };
  private data: Float32Array;
  private attr: THREE.InstancedBufferAttribute;
  private m = new THREE.Matrix4();

  constructor(count: number, map: THREE.Texture, additive = false) {
    const geo = new THREE.PlaneGeometry(1, 1);
    this.data = new Float32Array(count * 4);
    this.attr = new THREE.InstancedBufferAttribute(this.data, 4).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute("aData", this.attr);
    this.color = new THREE.Color();
    this.uniforms = { uMap: { value: map }, uColor: { value: this.color }, uOpacity: { value: 1 } };
    const mat = new THREE.ShaderMaterial({
      vertexShader: BILLBOARD_VERT,
      fragmentShader: BILLBOARD_FRAG,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {}]),
      transparent: true,
      depthWrite: false,
      fog: true,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    Object.assign(mat.uniforms, this.uniforms);
    this.mesh = new THREE.InstancedMesh(geo, mat, count);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  }

  set opacity(v: number) {
    this.uniforms.uOpacity.value = v;
  }

  set(i: number, x: number, y: number, z: number, alpha: number, rot: number, size: number) {
    this.m.makeTranslation(x, y, z);
    this.mesh.setMatrixAt(i, this.m);
    this.data[i * 4] = alpha;
    this.data[i * 4 + 1] = rot;
    this.data[i * 4 + 2] = size;
  }

  hide(i: number) {
    this.data[i * 4] = 0;
  }

  commit() {
    this.mesh.instanceMatrix.needsUpdate = true;
    this.attr.needsUpdate = true;
  }
}
