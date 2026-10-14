// Réduit de moitié la texture d'un GLB (moyenne 2×2) : les atlas KayKit sont des dégradés.
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";
import { PNG } from "pngjs";
await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });
const doc = await io.read(process.argv[2]);
for (const tex of doc.getRoot().listTextures()) {
  const src = PNG.sync.read(Buffer.from(tex.getImage()));
  const w = src.width >> 1, h = src.height >> 1;
  const dst = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < 4; c++) {
    let s = 0; for (const [dx, dy] of [[0,0],[1,0],[0,1],[1,1]]) s += src.data[((2*y+dy) * src.width + 2*x+dx) * 4 + c];
    dst.data[(y * w + x) * 4 + c] = Math.round(s / 4);
  }
  console.log("texture", src.width, "→", w, "octets avant", tex.getImage().byteLength);
  tex.setImage(PNG.sync.write(dst, { colorType: 2 }));
  console.log("après", tex.getImage().byteLength);
}
await io.write(process.argv[3] ?? process.argv[2], doc);
