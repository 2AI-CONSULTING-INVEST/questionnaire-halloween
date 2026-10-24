/**
 * Sang sur l'écran (clairière de la faucheuse) : simulation de fluide en champ de hauteur sur le GPU,
 * dans l'esprit de la démo « BloodShader » de NVIDIA. Deux cibles de rendu en ping-pong portent, par
 * texel, l'épaisseur de sang mouillé (R) et le film laissé derrière (G). À chaque pas, l'épaisseur
 * qui dépasse l'adhérence locale (bruitée : les filets serpentent et se forment d'eux-mêmes) coule
 * d'un texel vers le bas, plus vite quand c'est épais : le front mince freine, la masse s'accumule
 * derrière et forme la tête de goutte, qui se détache quand son filet s'amincit sous l'adhérence.
 * Le rendu plein écran dérive les normales du champ de hauteur et éclaire comme un liquide : couleur
 * selon l'épaisseur (rouge aux bords minces, presque noir au centre), reflet spéculaire serré, frange
 * de Fresnel, ombre portée. Rendu par-dessus la scène 3D, dans le même canvas.
 */
import * as THREE from "three";
import { rand } from "./core";

const STEP = 1 / 30;
const INJ = 12;
const SIM_SCALE = 1 / 2; // texels par pixel CSS
const SIM_MAX_W = 800;

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const SIM = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D uState;
uniform vec2 uTx;    // taille d'un texel (uv)
uniform vec2 uAsp;   // (largeur / hauteur, 1) : distances isotropes en uv
uniform float uSeed;
uniform float uBand; // niveau d'épaisseur tenu dans la nappe du haut (0 : plus de source)
uniform float uBandH;
uniform vec4 uInj[${INJ}]; // x, y (uv), rayon (en hauteurs d'écran), épaisseur ajoutée

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
// Adhérence : épaisseur en dessous de laquelle le sang reste collé à la vitre.
float thr(vec2 uv) { return 0.16 + 0.14 * noise(uv * vec2(60.0, 36.0) * uAsp + uSeed); }
// Ce qu'une cellule laisse couler en un pas : l'excédent, d'autant plus vite que c'est épais.
float flow(float h, vec2 uv) { return max(h - thr(uv), 0.0) * min(0.85, 0.25 + 1.2 * h); }
// Répartition bas-gauche / bas / bas-droite selon un bruit lent : les filets serpentent.
vec3 split(vec2 uv) {
  float n = noise(uv * vec2(10.0, 5.0) * uAsp + uSeed * 7.0);
  float l = clamp(0.5 - n, 0.0, 0.5) * 0.3, r = clamp(n - 0.5, 0.0, 0.5) * 0.3;
  return vec3(l, 1.0 - l - r, r);
}
void main() {
  vec4 s = texture2D(uState, vUv);
  float h = s.r, st = s.g;
  float outF = flow(h, vUv);
  float inF = 0.0;
  vec2 up = vUv + vec2(0.0, uTx.y);
  if (up.y < 1.0) {
    inF += flow(texture2D(uState, up).r, up) * split(up).y;
    vec2 ul = up - vec2(uTx.x, 0.0);
    if (ul.x > 0.0) inF += flow(texture2D(uState, ul).r, ul) * split(ul).z;
    vec2 ur = up + vec2(uTx.x, 0.0);
    if (ur.x < 1.0) inF += flow(texture2D(uState, ur).r, ur) * split(ur).x;
  }
  float hn = h - outF + inF;
  // Le passage laisse un film et en perd un peu.
  st = min(1.0, st + outF * 0.5 + hn * 0.003);
  hn -= outF * 0.03;
  // Nappe du haut, bord irrégulier : mouillée partout mais collée (sous l'adhérence), sauf quelques
  // points qui saignent vraiment (pics d'un bruit lent) tant que la source coule (uBand).
  float edge = 1.0 - uBandH * (0.55 + 0.3 * noise(vec2(vUv.x * 9.0, 0.0) + uSeed) + 0.15 * noise(vec2(vUv.x * 31.0, 3.0) + uSeed));
  if (vUv.y > edge) {
    float lvl = max(0.14, uBand * pow(noise(vec2(vUv.x * 8.0, 7.0) + uSeed), 6.0) * 0.9);
    hn = max(hn, lvl);
    st = 1.0;
  }
  for (int i = 0; i < ${INJ}; i++) {
    vec4 j = uInj[i];
    if (j.w <= 0.0) continue;
    float d = length((vUv - j.xy) * uAsp);
    hn += j.w * smoothstep(j.z, j.z * 0.25, d);
  }
  gl_FragColor = vec4(clamp(hn, 0.0, 3.0), st, 0.0, 1.0);
}`;

const DRAW = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D uState;
uniform vec2 uTx;
uniform float uFade;
float H(vec4 s) { return s.r + s.g * 0.08; }
void main() {
  vec4 c = texture2D(uState, vUv);
  vec4 l = texture2D(uState, vUv - vec2(uTx.x, 0.0)), r = texture2D(uState, vUv + vec2(uTx.x, 0.0));
  vec4 d = texture2D(uState, vUv - vec2(0.0, uTx.y)), u = texture2D(uState, vUv + vec2(0.0, uTx.y));
  vec4 s = (c * 2.0 + l + r + d + u) / 6.0; // lissage : bords ronds malgré la grille
  float h = s.r, st = s.g;
  vec3 n = normalize(vec3((H(l) - H(r)) * 2.5, (H(d) - H(u)) * 2.5, 1.0));
  float wet = smoothstep(0.02, 0.10, h);
  float film = smoothstep(0.03, 0.35, st) * 0.8;
  float thick = smoothstep(0.05, 0.8, h);
  vec3 wetCol = mix(vec3(0.56, 0.06, 0.09), vec3(0.14, 0.004, 0.015), thick);
  vec3 filmCol = vec3(0.26, 0.03, 0.04);
  float a = max(wet, film);
  vec3 col = mix(filmCol, wetCol, wet / max(a, 1e-4));
  vec3 L = normalize(vec3(-0.35, 0.7, 0.62));
  vec3 Hh = normalize(L + vec3(0.0, 0.0, 1.0));
  float diff = 0.55 + 0.45 * max(dot(n, L), 0.0);
  float nh = max(dot(n, Hh), 0.0);
  float spec = (pow(nh, 70.0) * 0.9 + pow(nh, 12.0) * 0.12) * wet;
  float fres = pow(1.0 - max(n.z, 0.0), 2.5) * 0.35 * wet;
  col = col * diff + vec3(1.0, 0.85, 0.85) * spec + vec3(0.6, 0.08, 0.1) * fres;
  // Ombre portée en bas à droite (lumière en haut à gauche).
  vec4 so = texture2D(uState, vUv + vec2(-2.0 * uTx.x, 2.5 * uTx.y));
  float sh = smoothstep(0.02, 0.15, so.r + so.g * 0.3) * 0.45 * (1.0 - a);
  gl_FragColor = vec4(col * a * uFade, (a + sh) * uFade); // prémultiplié
}`;

type Inj = { x: number; y: number; r: number; a: number };

export function createBloodScreen(renderer: THREE.WebGLRenderer, reduce: boolean) {
  const ext = renderer.extensions;
  if (!renderer.capabilities.isWebGL2 || !(ext.has("EXT_color_buffer_float") || ext.has("EXT_color_buffer_half_float"))) return null;

  const makeTarget = (w: number, h: number) =>
    new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false });
  let targets = [makeTarget(4, 4), makeTarget(4, 4)];
  let cur = 0;
  let cssW = 1;
  let cssH = 1;
  const injections = Array.from({ length: INJ }, () => new THREE.Vector4());
  const simMat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: SIM,
    uniforms: { uState: { value: null }, uTx: { value: new THREE.Vector2() }, uAsp: { value: new THREE.Vector2(1, 1) }, uSeed: { value: 0 }, uBand: { value: 0 }, uBandH: { value: 0.03 }, uInj: { value: injections } },
    depthTest: false,
    depthWrite: false,
  });
  const drawMat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: DRAW,
    uniforms: { uState: { value: null }, uTx: { value: new THREE.Vector2() }, uFade: { value: 0 } },
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const quad = new THREE.PlaneGeometry(2, 2);
  const simScene = new THREE.Scene().add(new THREE.Mesh(quad, simMat));
  const drawScene = new THREE.Scene().add(new THREE.Mesh(quad, drawMat));
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  let t = 0;
  let acc = 0;
  let fade = 0;
  let arrived = false;
  let pending: { at: number; inj: Inj[] }[] = [];
  let band = 0;

  /** Éclaboussure : cœur épais et étroit (il coulera en un filet), tache irrégulière de lobes minces qui restent collés, gouttelettes projetées. */
  function splash(x: number, y: number, R: number): Inj[] {
    const inj: Inj[] = [{ x, y, r: R * 0.45, a: rand(2.2, 3) }];
    const lobes = 5 + Math.floor(rand(0, 4));
    for (let i = 0; i < lobes; i++) {
      const ang = (i / lobes) * Math.PI * 2 + rand(-0.4, 0.4);
      const d = R * rand(0.35, 1);
      inj.push({ x: x + Math.cos(ang) * d, y: y + Math.sin(ang) * d, r: R * rand(0.3, 0.55), a: 0.13 });
    }
    const n = 3 + Math.floor(rand(0, 4));
    for (let i = 0; i < n; i++) {
      const ang = rand(0, Math.PI * 2);
      const d = R * rand(1.4, 3.2);
      inj.push({ x: x + Math.cos(ang) * d, y: y + Math.sin(ang) * d, r: R * rand(0.1, 0.3), a: rand(0.35, 0.9) });
    }
    return inj;
  }

  function reset() {
    t = 0;
    acc = 0;
    simMat.uniforms.uSeed.value = rand(0, 100);
    for (const rt of targets) {
      renderer.setRenderTarget(rt);
      renderer.clear();
    }
    renderer.setRenderTarget(null);
    // Rayons en hauteurs d'écran (uv isotrope) ; positions en uv (origine en bas à gauche).
    const px = 1 / cssH;
    pending = [];
    let at = 0.6;
    for (let i = 0; i < 7; i++) {
      pending.push({ at, inj: splash(rand(0.05, 0.95), rand(0.35, 0.96), rand(14, 34) * px) });
      at += rand(1.2, 4.5);
    }
    // Trois points de la nappe qui saignent longtemps : longs filets.
    const seeps = Array.from({ length: 3 }, () => ({ x: rand(0.08, 0.92), y: 1 - simMat.uniforms.uBandH.value * 0.5, r: 4 * px, a: 0.012 }));
    pending.push({ at: 0, inj: seeps });
  }

  function step() {
    t += STEP;
    // La source de la nappe coule 40 s, puis se tarit.
    band = t < 40 ? 1 : Math.max(0, 1 - (t - 40) * 0.02);
    simMat.uniforms.uBand.value = band;
    for (const v of injections) v.set(0, 0, 0, 0);
    let k = 0;
    pending = pending.filter((p) => {
      if (p.at > t) return true;
      if (p.at === 0 && t > 70) return false; // les saignements continus s'arrêtent
      for (const j of p.inj) if (k < INJ) injections[k++].set(j.x, j.y, j.r, p.at === 0 ? j.a : j.a);
      return p.at === 0; // les saignements continus restent, les éclaboussures sont consommées
    });
    simMat.uniforms.uState.value = targets[cur].texture;
    renderer.setRenderTarget(targets[1 - cur]);
    renderer.render(simScene, cam);
    renderer.setRenderTarget(null);
    cur = 1 - cur;
  }

  return {
    resize(w: number, h: number) {
      // Les petits changements (barre d'adresse mobile) étirent la simulation au lieu de la relancer.
      const big = Math.abs(w / cssW - 1) > 0.15 || Math.abs(h / cssH - 1) > 0.15;
      cssW = w;
      cssH = h;
      if (!big) return;
      const sw = Math.min(SIM_MAX_W, Math.round(w * SIM_SCALE));
      const sh = Math.round((sw * h) / w);
      for (const rt of targets) rt.dispose();
      targets = [makeTarget(sw, sh), makeTarget(sw, sh)];
      simMat.uniforms.uTx.value.set(1 / sw, 1 / sh);
      drawMat.uniforms.uTx.value.set(1 / sw, 1 / sh);
      simMat.uniforms.uAsp.value.set(w / h, 1);
      simMat.uniforms.uBandH.value = Math.min(0.06, 26 / h);
      if (arrived) {
        reset();
        for (let i = 0; i < 60; i++) step();
      }
    },
    /** À appeler après le rendu de la scène. `k` : proximité de la clairière (0 → 1). */
    frame(dt: number, k: number) {
      if (k > 0.98 && !arrived) {
        arrived = true;
        reset();
        if (reduce) for (let i = 0; i < 240; i++) step();
      } else if (k < 0.5) arrived = false;
      if (!arrived) fade = Math.max(0, fade - dt * 2.5);
      else if (reduce) fade = 1;
      else {
        acc = Math.min(acc + dt, STEP * 4);
        while (acc >= STEP) {
          step();
          acc -= STEP;
        }
        fade = THREE.MathUtils.clamp((t - 1.6) / 1.6, 0, 1);
      }
      if (fade <= 0.001) return;
      drawMat.uniforms.uState.value = targets[cur].texture;
      drawMat.uniforms.uFade.value = fade;
      renderer.autoClear = false;
      renderer.render(drawScene, cam);
      renderer.autoClear = true;
    },
    dispose() {
      for (const rt of targets) rt.dispose();
      simMat.dispose();
      drawMat.dispose();
      quad.dispose();
    },
  };
}
