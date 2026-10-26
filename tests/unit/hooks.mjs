import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SRC = new URL("../../src/", import.meta.url);
const EMPTY = new URL("./server-only.mjs", import.meta.url).href;

export async function resolve(specifier, context, next) {
  if (specifier === "server-only") return { url: EMPTY, shortCircuit: true };
  // Le champ « exports » de next ne couvre pas Node ESM : son fichier CommonJS.
  if (specifier === "next/server") return next("next/server.js", context);
  let s = specifier.startsWith("@/") ? new URL(specifier.slice(2), SRC).href : specifier;
  if ((s.startsWith("./") || s.startsWith("../") || s.startsWith("file:")) && !/\.[a-z]+$/i.test(s)) {
    const base = s.startsWith("file:") ? s : new URL(s, context.parentURL).href;
    for (const ext of [".ts", ".tsx"]) if (existsSync(fileURLToPath(base + ext))) return next(base + ext, context);
  }
  return next(s, context);
}
