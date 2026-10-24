/**
 * Sang de la clairière de la faucheuse (scène 2 seulement) : flaques éclaboussées au sol, coulures
 * figées (chaudron) et gouttes qui tombent. Un seul matériau rouge sombre, luisant. Sur la lame de la
 * faux, le sang est un fluide animé en shader (createBladeBloodMaterial). Le sang sur l'écran lui-même
 * est dans bloodScreen.ts.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { canvasTexture, groundHeight, rand, seeded } from "./core";

const merge = (parts: THREE.BufferGeometry[]) => mergeGeometries(parts)!;

export const BLOOD_COLOR = "#4e0509";

/** Sang sombre, à peine émissif (pour ne pas être noir dans l'ombre), très luisant : ce sont les reflets qui font « mouillé ». */
export function createBloodMaterial() {
  return new THREE.MeshPhongMaterial({ color: BLOOD_COLOR, emissive: "#100104", specular: "#b05058", shininess: 110 });
}

/** Éclaboussure : tache principale irrégulière (épaisse et presque noire au centre, plus rouge sur les bords minces), gouttelettes satellites avec traînées. */
export const bloodTexture = () =>
  canvasTexture(256, 256, (ctx, s) => {
    const r = seeded(29);
    const c = s / 2;
    const g = ctx.createRadialGradient(c, c, 0, c, c, s * 0.4);
    g.addColorStop(0, "#2c0206");
    g.addColorStop(0.55, "#4e0509");
    g.addColorStop(1, "#7a0c14");
    ctx.fillStyle = g;
    for (let i = 0; i < 6; i++) {
      const a = r() * Math.PI * 2;
      const d = r() * s * 0.12;
      ctx.beginPath();
      ctx.ellipse(c + Math.cos(a) * d, c + Math.sin(a) * d, s * (0.14 + r() * 0.12), s * (0.1 + r() * 0.12), r() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = ctx.strokeStyle = "#6a0a12";
    for (let i = 0; i < 18; i++) {
      const a = r() * Math.PI * 2;
      const d = s * (0.26 + r() * 0.2);
      const rad = s * (0.008 + r() * 0.022);
      const x = c + Math.cos(a) * d;
      const y = c + Math.sin(a) * d;
      ctx.beginPath();
      ctx.ellipse(x, y, rad * (1.4 + r()), rad, a, 0, Math.PI * 2); // allongée vers l'extérieur
      ctx.fill();
      if (r() < 0.5) {
        ctx.lineWidth = rad * 0.9;
        ctx.beginPath();
        ctx.moveTo(c + Math.cos(a) * d * 0.75, c + Math.sin(a) * d * 0.75);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
    }
  });

export type PoolSpec = { x: number; z: number; r: number; rot: number };

/** Flaques au sol (un seul maillage), épousant le relief ; `layout` les replace quand le repère change. */
export function createPools(mat: THREE.MeshPhongMaterial) {
  const poolMat = mat.clone();
  poolMat.color.set("#ffffff"); // la texture porte la couleur
  // Sang au sol : il a bu la terre, presque mat (seules les coulures et les gouttes restent luisantes).
  poolMat.shininess = 18;
  poolMat.specular.set("#2a0d10");
  poolMat.map = bloodTexture();
  poolMat.transparent = true;
  poolMat.depthWrite = false;
  poolMat.polygonOffset = true;
  poolMat.polygonOffsetFactor = -3;
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), poolMat);
  mesh.renderOrder = 1;
  mesh.frustumCulled = false;
  const v = new THREE.Vector3();
  return {
    mesh,
    layout(specs: PoolSpec[], toWorld: (x: number, z: number, out?: THREE.Vector3) => THREE.Vector3, scale: number) {
      const parts = specs.map((p) => {
        const w = toWorld(p.x, p.z, v);
        const g = new THREE.PlaneGeometry(p.r * 2 * scale, p.r * 2 * scale, 6, 6).rotateX(-Math.PI / 2).rotateY(p.rot).translate(w.x, 0, w.z);
        const pos = g.attributes.position;
        for (let i = 0; i < pos.count; i++) pos.setY(i, groundHeight(pos.getX(i), pos.getZ(i)) + 0.025);
        g.computeVertexNormals();
        return g;
      });
      mesh.geometry.dispose();
      mesh.geometry = merge(parts);
    },
  };
}

/** Coulures figées : goutte allongée qui pend d'un point d'accroche (repère local de l'objet porteur). */
export function dripGeometry(drips: { x: number; y: number; z: number; len: number; r: number }[]) {
  return merge(
    drips.flatMap((d) => [
      new THREE.CylinderGeometry(d.r * 0.5, d.r, d.len, 7).translate(d.x, d.y - d.len / 2, d.z),
      new THREE.SphereGeometry(d.r * 1.25, 8, 6).translate(d.x, d.y - d.len, d.z),
    ]),
  );
}

/** Gouttes qui tombent des sources (points monde) jusqu'au sol, puis repartent après une pause. */
export function createDrops(mat: THREE.Material, count: number) {
  const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 5), mat, count);
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const state = Array.from({ length: count }, () => ({ active: false, wait: rand(0.3, 3), t: 0, x: 0, y0: 0, z: 0 }));
  const dummy = new THREE.Object3D();
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  return {
    mesh,
    update(dt: number, sources: THREE.Vector3[], scale: number) {
      state.forEach((s, i) => {
        if (!s.active) {
          s.wait -= dt;
          if (s.wait > 0 || !sources.length) return mesh.setMatrixAt(i, zero);
          const src = sources[Math.floor(Math.random() * sources.length)];
          Object.assign(s, { active: true, t: 0, x: src.x, y0: src.y, z: src.z });
        }
        s.t += dt;
        const y = s.y0 - 4.9 * s.t * s.t;
        if (y <= groundHeight(s.x, s.z)) {
          s.active = false;
          s.wait = rand(0.6, 3.5);
          return mesh.setMatrixAt(i, zero);
        }
        dummy.position.set(s.x, y, s.z);
        dummy.scale.set(0.02 * scale, (0.034 + s.t * 0.05) * scale, 0.02 * scale);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

/**
 * Fluide animé sur le plat de la lame (repère de la forme de la lame : x le long de la lame, y du
 * tranchant vers le dos). Épaisseur procédurale : nappe qui couvre le tranchant et toute la pointe,
 * filets qui descendent lentement vers le tranchant, ondulation de surface ; sous le tranchant
 * (jupe de la géométrie, face avant seulement), gouttes qui grossissent, pendent et se détachent.
 * Éclairage de liquide : normales dérivées de l'épaisseur, reflet serré, frange de Fresnel ; brouillard de la scène.
 */
export function createBladeBloodMaterial(L: number, time: { value: number }, skirt: boolean) {
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uL: { value: L }, uSkirt: { value: skirt ? 1 : 0 } }]),
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      varying vec2 vP;
      varying vec3 vN, vT, vB, vV;
      void main() {
        vP = position.xy;
        vN = normalize(normalMatrix * normal);
        vT = normalize(normalMatrix * vec3(1.0, 0.0, 0.0));
        vB = normalize(normalMatrix * vec3(0.0, 1.0, 0.0));
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vV = -mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uTime, uL, uSkirt;
      varying vec2 vP;
      varying vec3 vN, vT, vB, vV;
      float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
      }
      float fbm(vec2 p) { return noise(p) * 0.6 + noise(p * 2.1 + 3.7) * 0.3 + noise(p * 4.3 + 1.3) * 0.1; }
      // Tranchant et dos de la lame (mêmes courbes que la forme extrudée), t ≈ x / 1,05 L.
      float yEdge(float t) { float u = 1.0 - t; return (u * u * -0.08 + 2.0 * u * t * -0.02 + t * t * -0.3) * uL; }
      float ySpine(float t) { float u = 1.0 - t; return (u * u * 0.05 + 2.0 * u * t * 0.22 + t * t * -0.3) * uL; }
      float sdSeg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
      float height(vec2 p) {
        float t = clamp(p.x / (1.05 * uL), 0.0, 1.0);
        float ye = yEdge(t), ys = ySpine(t);
        float q = (p.y - ye) / max(ys - ye, 1e-4); // 0 au tranchant, 1 au dos
        float xs = p.x / uL;
        float h = 0.0;
        if (q >= 0.0) {
          float tip = smoothstep(0.72, 0.98, t);
          float w = 0.5 + 0.25 * noise(vec2(xs * 6.0, 1.3)) + tip * 0.8;
          float cov = smoothstep(w, w - 0.35, q);
          float st = smoothstep(0.5, 0.66, fbm(vec2(xs * 7.0, q * 2.5 + uTime * 0.12))) * smoothstep(1.0, 0.35, q);
          float rip = 0.08 * noise(vec2(xs * 18.0, q * 9.0 + uTime * 0.9));
          h = min(1.0, cov * 0.75 + st * 0.6 + cov * rip);
        } else if (uSkirt > 0.5) {
          for (int i = 0; i < 4; i++) {
            float fi = float(i);
            float xi = (0.14 + 0.22 * fi + 0.14 * hash(vec2(fi, 2.0))) * 1.05 * uL;
            float period = 3.5 + 2.5 * hash(vec2(fi, 5.0));
            float ph = fract(uTime / period + hash(vec2(fi, 9.0)));
            vec2 a = vec2(xi, yEdge(clamp(xi / (1.05 * uL), 0.0, 1.0)) + 0.01 * uL);
            float grow = smoothstep(0.0, 0.6, ph);
            float fall = max(0.0, ph - 0.62);
            // Goutte en poire accrochée au tranchant : elle gonfle sur place, s'allonge, puis se détache (petit reste au bord).
            float r = (0.007 + 0.012 * grow) * uL;
            float neck = (0.004 + 0.016 * grow) * uL;
            vec2 c = a - vec2(0.0, neck + r + fall * fall * 14.0 * uL);
            float d = length((p - c) * vec2(1.0, 0.82)) - r;
            d = min(d, fall <= 0.0 ? sdSeg(p, a, c) - r * 0.55 : sdSeg(p, a, a - vec2(0.0, 0.006 * uL)) - 0.004 * uL);
            float dome = clamp(-d / r, 0.0, 1.0);
            h = max(h, 0.6 * sqrt(dome * (2.0 - dome)));
          }
        }
        return h;
      }
      void main() {
        float e = 0.004 * uL;
        float h = height(vP);
        float gx = height(vP + vec2(e, 0.0)) - h, gy = height(vP + vec2(0.0, e)) - h;
        vec3 N0 = normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0);
        vec3 N = normalize(N0 - (vT * gx + vB * gy) * 2.5);
        vec3 V = normalize(vV);
        vec3 Lk = normalize(vec3(-0.35, 0.7, 0.62));
        vec3 Hh = normalize(Lk + V);
        float a = smoothstep(0.04, 0.16, h);
        float thick = smoothstep(0.1, 0.9, h);
        vec3 col = mix(pow(vec3(0.58, 0.07, 0.1), vec3(2.2)), pow(vec3(0.26, 0.01, 0.03), vec3(2.2)), thick);
        float diff = 0.45 + 0.55 * max(dot(N, Lk), 0.0);
        float nh = max(dot(N, Hh), 0.0);
        float spec = pow(nh, 70.0) * 0.9 + pow(nh, 12.0) * 0.12;
        float fres = pow(1.0 - max(dot(N, V), 0.0), 2.5) * 0.35;
        col = col * diff + vec3(1.0, 0.85, 0.85) * spec + pow(vec3(0.6, 0.08, 0.1), vec3(2.2)) * fres;
        gl_FragColor = vec4(col, a);
        #include <fog_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: true,
  });
  mat.uniforms.uTime = time; // partagé (merge clone les valeurs)
  return mat;
}
