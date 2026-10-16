/**
 * Nuée de chauves-souris de la modale des lots : les MÊMES que celles du décor 3D (géométrie et
 * battement d'ailes de src/components/scene/bats.ts, couleurs de la palette du monde), dans un
 * petit canvas Three.js derrière le panneau. De temps en temps (une première peu après l'ouverture,
 * puis toutes les 8 à 20 s), une nuée apparaît au loin dans une zone libre autour du panneau, toute
 * petite, puis fonce vers l'écran en grossissant (perspective, accélération), se disperse et sort du
 * cadre ; trajectoires tirées au hasard à chaque passage. Entre deux nuées, aucune image n'est
 * calculée. `stop()` arrête tout et libère les ressources WebGL.
 */
import * as THREE from "three";
import { batGeometry, createBatMaterial } from "@/components/scene/bats";

const MAX = 22;
const FOV = 45;
const rand = (a: number, b: number) => a + Math.random() * (b - a);

type Flyer = { p: THREE.Vector3[]; t0: number; dur: number; wobble: number; scale: number; pitch: number };

/** Point d'une courbe de Bézier cubique. */
function bezier(p: THREE.Vector3[], t: number, out: THREE.Vector3) {
  const u = 1 - t;
  return out
    .copy(p[0]).multiplyScalar(u * u * u)
    .addScaledVector(p[1], 3 * u * u * t)
    .addScaledVector(p[2], 3 * u * t * t)
    .addScaledVector(p[3], t * t * t);
}

export function startBatSwarm(canvas: HTMLCanvasElement, panel: () => HTMLElement | null) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 200);
  // Lumière plus franche que dans le décor : ici elles passent sur le fond sombre et flouté de la modale.
  scene.add(new THREE.HemisphereLight("#d8cff0", "#3a2a40", 1.7));
  const key = new THREE.DirectionalLight("#fff1dc", 0.6);
  key.position.set(-2, 4, 3);
  scene.add(key);
  // Lueur chaude par en dessous (les citrouilles de la modale).
  const warm = new THREE.DirectionalLight("#ff9a3c", 1.5);
  warm.position.set(1, -3, 2);
  scene.add(warm);

  const time = { value: 0 };
  const geo = batGeometry();
  geo.setAttribute("aPhase", new THREE.InstancedBufferAttribute(new Float32Array(MAX).map(() => rand(0, 6.28)), 1));
  const mat = createBatMaterial(time, "#43375a", "#1f1630");
  const bats = new THREE.InstancedMesh(geo, mat, MAX);
  bats.frustumCulled = false;
  bats.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(bats);

  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const dummy = new THREE.Object3D();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  let flyers: Flyer[] = [];
  let raf = 0;
  let timer = 0;
  let clock = 0;
  let last = 0;
  let w = 1;
  let h = 1;

  const resize = () => {
    w = window.innerWidth;
    h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener("resize", resize);

  const halfH = (z: number) => Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * -z;
  /** Point du monde, à la profondeur z, qui se projette en (sx, sy) (coordonnées normalisées -1..1). */
  const at = (sx: number, sy: number, z: number) => new THREE.Vector3(sx * halfH(z) * camera.aspect, sy * halfH(z), z);

  /** Zone de départ : une marge libre autour du panneau (fond flouté), choisie au prorata de sa surface. */
  function startPoint(): [number, number] {
    const r = panel()?.getBoundingClientRect();
    const zones: [number, number, number, number][] = r
      ? [
          [0, 0, w, r.top - 24], // au-dessus
          [0, r.bottom + 24, w, h], // en dessous
          [0, 0, r.left - 24, h], // à gauche
          [r.right + 24, 0, w, h], // à droite
        ].filter(([x0, y0, x1, y1]) => x1 - x0 > 40 && y1 - y0 > 40) as [number, number, number, number][]
      : [[0, 0, w, h * 0.4]];
    if (!zones.length) zones.push([0, 0, w, Math.max(48, h * 0.12)]);
    const area = zones.map(([x0, y0, x1, y1]) => (x1 - x0) * (y1 - y0));
    let pick = Math.random() * area.reduce((s, v) => s + v, 0);
    let zone = zones[0];
    for (let i = 0; i < zones.length; i++) if ((pick -= area[i]) <= 0) { zone = zones[i]; break; }
    const [x0, y0, x1, y1] = zone;
    const px = rand(x0 + 12, x1 - 12);
    const py = rand(y0 + 12, y1 - 12);
    return [(px / w) * 2 - 1, 1 - (py / h) * 2];
  }

  function launch() {
    const dark = document.documentElement.dataset.theme !== "light";
    mat.color.set(dark ? "#43375a" : "#2e2733");
    mat.emissive.set(dark ? "#1f1630" : "#000000");
    const [sx, sy] = startPoint();
    const n = Math.round(rand(w < 640 ? 8 : 11, w < 640 ? 13 : MAX));
    // Sortie : vers le bord le plus proche du point de départ (elles s'écartent en approchant).
    const ex = Math.sign(sx || rand(-1, 1)) || 1;
    const ey = sy > 0.2 ? 1 : sy < -0.2 ? -1 : rand(-0.4, 0.8);
    const z0 = -rand(55, 75);
    flyers = Array.from({ length: n }, (_, i) => {
      const spread0 = 0.06;
      const start = at(sx + rand(-spread0, spread0), sy + rand(-spread0, spread0), z0 + rand(-6, 6));
      const mid1 = at(sx * rand(0.6, 1) + rand(-0.15, 0.15), sy * rand(0.6, 1) + rand(-0.15, 0.15), z0 * rand(0.55, 0.7));
      const mid2 = at(sx * rand(0.4, 1.2) + ex * rand(0, 0.5), sy * rand(0.4, 1.2) + ey * rand(0, 0.4), z0 * rand(0.2, 0.32));
      // Fin hors champ, près de l'écran : dispersion de la nuée.
      const end = at(ex * rand(1.3, 2.1), ey * rand(0.4, 1.6) + rand(-0.6, 0.6), -rand(5, 9));
      return { p: [start, mid1, mid2, end], t0: clock + i * rand(0.03, 0.09) + rand(0, 0.35), dur: rand(2.6, 4), wobble: rand(0, 6.28), scale: rand(1.1, 1.6), pitch: rand(0.8, 1.15) };
    });
    canvas.dataset.swarm = "active";
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function frame(now: number) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    clock += dt;
    time.value = clock;
    let alive = 0;
    flyers.forEach((f, i) => {
      const u = (clock - f.t0) / f.dur;
      if (u < 0 || u > 1) {
        if (u < 0) alive++;
        return bats.setMatrixAt(i, zero);
      }
      alive++;
      // Accélération en approchant de l'écran.
      const e = Math.pow(u, 1.6);
      bezier(f.p, e, a);
      bezier(f.p, Math.min(1, e + 0.01), b);
      a.y += Math.sin(clock * 3 + f.wobble) * 0.2;
      b.y += Math.sin((clock + 0.03) * 3 + f.wobble) * 0.2;
      dummy.position.copy(a);
      dummy.lookAt(b);
      // Elles foncent vers l'écran : vues de face, les ailes seraient de profil (un simple trait).
      // Le nez se relève (elles remontent au-dessus de la caméra) : on voit le ventre et les ailes
      // déployées, la silhouette des chauves-souris du décor.
      dummy.rotateX(-f.pitch);
      dummy.rotateZ(Math.sin(clock * 2 + f.wobble) * 0.5);
      dummy.scale.setScalar(f.scale * Math.min(1, u * 12));
      dummy.updateMatrix();
      bats.setMatrixAt(i, dummy.matrix);
    });
    for (let i = flyers.length; i < MAX; i++) bats.setMatrixAt(i, zero);
    bats.instanceMatrix.needsUpdate = true;
    renderer.render(scene, camera);
    if (alive) raf = requestAnimationFrame(frame);
    else {
      // Nuée passée : canvas vidé, plus aucune image jusqu'à la suivante.
      raf = 0;
      flyers = [];
      renderer.clear();
      canvas.dataset.swarm = "idle";
      schedule(rand(8000, 20000));
    }
  }

  function schedule(ms: number) {
    timer = window.setTimeout(() => (document.hidden ? schedule(4000) : launch()), ms);
  }
  canvas.dataset.swarm = "idle";
  renderer.compile(scene, camera); // shaders prêts avant la première nuée (pas d'à-coup à son arrivée)
  schedule(500);

  return function stop() {
    window.clearTimeout(timer);
    if (raf) cancelAnimationFrame(raf);
    window.removeEventListener("resize", resize);
    geo.dispose();
    mat.dispose();
    bats.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  };
}
