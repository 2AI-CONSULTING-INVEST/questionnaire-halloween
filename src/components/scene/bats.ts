/**
 * Chauves-souris du monde 3D : silhouette low-poly et battement d'ailes dans le vertex shader
 * (attribut d'instance `aPhase`). Partagées par le décor 3D (world.ts) et la nuée de la modale des
 * lots (/participants), pour qu'elles soient identiques.
 */
import * as THREE from "three";

export function batGeometry() {
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

/** Matériau des chauves-souris : battement des ailes (21 rad/s, décalé par `aPhase`) piloté par `time`. */
export function createBatMaterial(time: { value: number }, color: THREE.ColorRepresentation, emissive: THREE.ColorRepresentation) {
  const mat = new THREE.MeshLambertMaterial({ color, emissive, side: THREE.DoubleSide });
  mat.onBeforeCompile = (shader) => {
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
  return mat;
}
