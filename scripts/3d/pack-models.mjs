// Regroupe des modèles KayKit dans un seul GLB (texture partagée, géométrie quantifiée + Meshopt).
// Option --paint col,row,#haut,#bas : repeint une cellule de l'atlas (ex. assombrir le feuillage).
import path from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, mergeDocuments, meshopt, prune, quantize, unpartition } from "@gltf-transform/functions";
import { MeshoptEncoder } from "meshoptimizer";
import { PNG } from "pngjs";

const args = process.argv.slice(2);
const paints = [];
for (let i = args.indexOf("--paint"); i >= 0; i = args.indexOf("--paint")) paints.push(args.splice(i, 2)[1].split(","));
const [src, out, ...names] = args;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder });
const doc = await io.read(path.join(src, `${names[0]}.gltf`));
const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
for (const name of names.slice(1)) {
  const other = await io.read(path.join(src, `${name}.gltf`));
  const map = mergeDocuments(doc, other);
  for (const s of other.getRoot().listScenes()) {
    const merged = map.get(s);
    for (const n of merged.listChildren()) scene.addChild(n);
    merged.dispose();
  }
}
const roots = scene.listChildren();
if (roots.length !== names.length) throw new Error(`nœuds ${roots.length} ≠ modèles ${names.length}`);
roots.forEach((n, i) => n.setName(names[i]));
await doc.transform(dedup(), prune());
if (paints.length) {
  const tex = doc.getRoot().listTextures()[0];
  const png = PNG.sync.read(Buffer.from(tex.getImage()));
  const hex = (h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
  for (const [col, row, top, bottom] of paints) {
    const [a, b] = [hex(top), hex(bottom)];
    const cw = png.width / 8, ch = png.height / 4;
    for (let y = row * ch; y < (+row + 1) * ch; y++) {
      const t = (y - row * ch) / (ch - 1);
      for (let x = col * cw; x < (+col + 1) * cw; x++) {
        const i = (y * png.width + x) * 4;
        for (let c = 0; c < 3; c++) png.data[i + c] = Math.round(a[c] + (b[c] - a[c]) * t);
      }
    }
  }
  tex.setImage(PNG.sync.write(png));
}
await doc.transform(quantize(), unpartition(), meshopt({ encoder: MeshoptEncoder, level: "medium" }));
console.log("textures:", doc.getRoot().listTextures().length, "| modèles:", names.length);
await io.write(out, doc);
