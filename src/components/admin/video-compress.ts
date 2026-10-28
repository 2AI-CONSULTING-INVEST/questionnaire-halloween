"use client";

import { COMPRESS_TIMEOUT_MS, encodeArgs, parseProbe, shouldCompress, type Probe } from "@/lib/video-plan";

/**
 * Moteur de compression (ffmpeg.wasm, un seul fil : pas de COEP, donc pas de SharedArrayBuffer).
 * Chargé à la demande depuis upload.ts, seulement quand un admin envoie une vidéo.
 * Le cœur (≈ 32 Mo) est servi par le site lui-même : aucun CDN.
 */

export type CompressStep = "analyse" | "compression" | "verification";

export type Encoded =
  | { ok: true; file: Blob; source: Probe; output: Probe }
  | { ok: false; reason: string };

export async function encodeVideo(
  file: File,
  onStep: (step: CompressStep, progress?: number) => void,
  signal?: AbortSignal,
): Promise<Encoded> {
  const timeout = AbortSignal.timeout(COMPRESS_TIMEOUT_MS);
  const abort = signal ? AbortSignal.any([signal, timeout]) : timeout;
  if (abort.aborted) return { ok: false, reason: signal?.aborted ? "compression passée" : "compression trop longue" };
  onStep("analyse");

  const worker = new Worker(new URL("./ffmpeg.worker.ts", import.meta.url), { type: "module" });
  const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  let seq = 0;
  let log = "";
  let onTime: (time: number) => void = () => undefined;
  let stopped = false;
  // Arrêter le worker libère toute sa mémoire (fichiers virtuels compris) et rejette les appels en cours.
  const stop = () => {
    stopped = true;
    worker.terminate();
    for (const p of pending.values()) p.reject(new Error("arrêté"));
    pending.clear();
  };
  abort.addEventListener("abort", stop, { once: true });
  worker.onmessage = ({ data }) => {
    if ("log" in data) log += `${data.log}\n`;
    else if ("time" in data) onTime(data.time);
    else {
      const p = pending.get(data.id);
      pending.delete(data.id);
      if ("error" in data) p?.reject(new Error(data.error));
      else p?.resolve(data.result);
    }
  };
  worker.onerror = () => stop(); // manque de mémoire, cœur introuvable
  const call = <T,>(type: string, args?: unknown, transfer: Transferable[] = []) =>
    new Promise<T>((resolve, reject) => {
      if (stopped) return reject(new Error("arrêté"));
      pending.set(++seq, { resolve: resolve as (v: unknown) => void, reject });
      worker.postMessage({ id: seq, type, args }, transfer);
    });
  const probe = async (path: string) => {
    log = "";
    await call("exec", ["-hide_banner", "-i", path]); // échoue toujours (pas de sortie) : seul le journal compte
    return parseProbe(log);
  };

  const input = `in.${file.name.split(".").pop()?.toLowerCase() || "mp4"}`;
  try {
    await call("load", {
      coreURL: new URL("../../../node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.js", import.meta.url).href,
      wasmURL: new URL("../../../node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.wasm", import.meta.url).href,
    });
    const data = new Uint8Array(await file.arrayBuffer());
    await call("write", { path: input, data }, [data.buffer]);
    const source = await probe(input);
    const plan = shouldCompress(source);
    if (!plan.ok) return plan;

    onStep("compression", 0);
    onTime = (time) => onStep("compression", Math.min(1, Math.max(0, time / 1e6 / source.duration!)));
    const ret = await call<number>("exec", encodeArgs(input, "out.mp4", source));
    if (ret !== 0) return { ok: false, reason: "échec de l'encodage" };
    await call("delete", input);

    onStep("verification");
    const output = await probe("out.mp4");
    const out = await call<Uint8Array<ArrayBuffer>>("read", "out.mp4");
    return { ok: true, file: new Blob([out], { type: "video/mp4" }), source, output };
  } catch {
    if (signal?.aborted) return { ok: false, reason: "compression passée" };
    if (timeout.aborted) return { ok: false, reason: "compression trop longue" };
    return { ok: false, reason: "erreur de compression (mémoire insuffisante ?)" };
  } finally {
    stop();
  }
}
