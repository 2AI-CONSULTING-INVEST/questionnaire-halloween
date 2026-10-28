/**
 * Worker de compression : charge le cœur ffmpeg.wasm et exécute ses commandes hors du fil principal.
 * Remplace la classe de @ffmpeg/ffmpeg, que Turbopack ne sait pas empaqueter (URL de worker dynamique).
 * Messages : { id, type, args } → { id, result } ou { id, error } ; journal { log }, avancement { time }.
 */

type Core = {
  exec(...args: string[]): number;
  ret: number;
  reset(): void;
  setLogger(fn: (d: { message: string }) => void): void;
  setProgress(fn: (d: { time: number }) => void): void;
  FS: { writeFile(path: string, data: Uint8Array): void; readFile(path: string): Uint8Array; unlink(path: string): void };
};

const ctx = self as unknown as {
  onmessage: (e: MessageEvent<{ id: number; type: string; args: unknown }>) => void;
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
};
let core: Core;

ctx.onmessage = async ({ data: { id, type, args } }) => {
  try {
    if (type === "load") {
      const { coreURL, wasmURL } = args as { coreURL: string; wasmURL: string };
      const create = (await import(/* turbopackIgnore: true */ /* webpackIgnore: true */ coreURL)).default;
      // Même procédé que @ffmpeg/ffmpeg : l'adresse du .wasm passe dans le fragment de l'URL du script.
      core = await create({ mainScriptUrlOrBlob: `${coreURL}#${btoa(JSON.stringify({ wasmURL }))}` });
      core.setLogger(({ message }) => ctx.postMessage({ log: message }));
      core.setProgress(({ time }) => ctx.postMessage({ time }));
      return ctx.postMessage({ id, result: true });
    }
    if (type === "exec") {
      core.exec(...(args as string[]));
      const ret = core.ret;
      core.reset();
      return ctx.postMessage({ id, result: ret });
    }
    if (type === "write") {
      const { path, data } = args as { path: string; data: Uint8Array };
      core.FS.writeFile(path, data);
      return ctx.postMessage({ id, result: true });
    }
    if (type === "read") {
      const data = core.FS.readFile(args as string);
      return ctx.postMessage({ id, result: data }, [data.buffer]);
    }
    if (type === "delete") {
      core.FS.unlink(args as string);
      return ctx.postMessage({ id, result: true });
    }
    throw new Error(`message inconnu : ${type}`);
  } catch (err) {
    ctx.postMessage({ id, error: err instanceof Error ? err.message : String(err) });
  }
};
