// Retire du badge Halloween les décorations posées à ses pieds (crâne, os, bougies, citrouilles) :
// elles débordent du tonneau et flottent. On repère les morceaux indépendants (composantes connexes
// une fois les sommets soudés par position) et on supprime ceux qui sont bas et petits.
import fs from "node:fs";
import path from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";

const [srcDir, outDir, name] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(path.join(srcDir, `${name}.gltf`));
let removed = 0;
let kept = 0;
for (const mesh of doc.getRoot().listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute("POSITION");
    const idx = prim.getIndices();
    const n = pos.getCount();
    // Soudure par position (les arêtes vives dupliquent les sommets).
    const key = new Map();
    const weld = new Int32Array(n);
    const v = [0, 0, 0];
    for (let i = 0; i < n; i++) {
      pos.getElement(i, v);
      const k = v.map((c) => Math.round(c * 1e4)).join(",");
      if (!key.has(k)) key.set(k, i);
      weld[i] = key.get(k);
    }
    const parent = Int32Array.from({ length: n }, (_, i) => i);
    const find = (a) => (parent[a] === a ? a : (parent[a] = find(parent[a])));
    const tri = idx.getArray();
    for (let t = 0; t < tri.length; t += 3) {
      const a = find(weld[tri[t]]), b = find(weld[tri[t + 1]]), c = find(weld[tri[t + 2]]);
      parent[b] = a;
      parent[find(c)] = a;
    }
    // Boîte de chaque composante.
    const boxes = new Map();
    for (let i = 0; i < n; i++) {
      const r = find(weld[i]);
      pos.getElement(i, v);
      const b = boxes.get(r) ?? { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
      for (let k = 0; k < 3; k++) { b.min[k] = Math.min(b.min[k], v[k]); b.max[k] = Math.max(b.max[k], v[k]); }
      boxes.set(r, b);
    }
    // Décor au pied : posé au sol (bas < 0,05), petit (hauteur < 0,6) et devant la plaque (z > 0,12).
    const isFootProp = (b) => b.min[1] < 0.05 && b.max[1] - b.min[1] < 0.6 && b.max[2] > 0.12;
    const drop = new Set([...boxes].filter(([, b]) => isFootProp(b)).map(([r]) => r));
    const out = [];
    for (let t = 0; t < tri.length; t += 3) {
      if (drop.has(find(weld[tri[t]]))) removed++;
      else { out.push(tri[t], tri[t + 1], tri[t + 2]); kept++; }
    }
    idx.setArray(new (tri.constructor)(out));
    console.log(`composantes : ${boxes.size}, retirées : ${drop.size}`);
  }
}
console.log(`triangles gardés ${kept}, retirés ${removed}`);
fs.mkdirSync(outDir, { recursive: true });
await io.write(path.join(outDir, `${name}.gltf`), doc);
