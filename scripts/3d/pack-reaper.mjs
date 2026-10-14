// Faucheuse : Skeleton_Rogue (KayKit Skeletons, CC0) — capuche et cape repeintes en violet nuit,
// tunique assombrie, seules les animations utiles sont gardées, géométrie compressée.
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, meshopt, prune, resample } from "@gltf-transform/functions";
import { MeshoptEncoder } from "meshoptimizer";
import { PNG } from "pngjs";

const [src, out] = process.argv.slice(2);
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder });
const doc = await io.read(src);
const root = doc.getRoot();

const KEEP = new Set(["Idle", "Taunt", "Interact"]);
for (const a of root.listAnimations()) {
  if (KEEP.has(a.getName())) continue;
  for (const c of a.listChannels()) c.dispose();
  for (const s of a.listSamplers()) s.dispose(); // les accesseurs orphelins partent au prune()
  a.dispose();
}

// Repeint des cellules de l'atlas (8 colonnes × 4 lignes de dégradés verticaux).
const tex = root.listTextures()[0];
const png = PNG.sync.read(Buffer.from(tex.getImage()));
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
function paint(col, row, top, bottom) {
  const [a, b] = [hex(top), hex(bottom)];
  const cw = png.width / 8, ch = png.height / 4;
  for (let y = row * ch; y < (row + 1) * ch; y++) {
    const t = (y - row * ch) / (ch - 1);
    for (let x = col * cw; x < (col + 1) * cw; x++) {
      const i = (y * png.width + x) * 4;
      // garde le léger reflet vertical de la cellule (bande plus claire)
      const k = (png.data[i] + png.data[i + 1] + png.data[i + 2]) / 3;
      const ref = (() => { const j = (y * png.width + col * cw + 4) * 4; return (png.data[j] + png.data[j + 1] + png.data[j + 2]) / 3; })();
      const boost = ref > 0 ? Math.min(1.35, Math.max(0.8, k / ref)) : 1;
      for (let c = 0; c < 3; c++) png.data[i + c] = Math.min(255, Math.round((a[c] + (b[c] - a[c]) * t) * boost));
    }
  }
}
paint(2, 2, "#4f4d66", "#15141d"); // capuche + cape : ardoise violette, comme les tombes
paint(7, 0, "#3a3846", "#121117"); // tunique
tex.setImage(PNG.sync.write(png));

await doc.transform(resample(), dedup(), prune(), meshopt({ encoder: MeshoptEncoder, level: "medium" }));
await io.write(out, doc);
console.log("animations :", root.listAnimations().map((a) => a.getName()).join(", "));
