import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canCompressHere,
  COMPRESSED_TAG,
  decide,
  encodeArgs,
  isAppleMobile,
  parseProbe,
  shouldCompress,
  VIDEO_CRF,
  type Measured,
} from "../../src/lib/video-plan";

// Journaux réels de `ffmpeg -i` (ffmpeg.wasm 5.1.4), sur les vidéos de test 1080x1920.
const SOURCE = `Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'CT VDA - HD AVEC SON.mp4':
  Metadata:
    major_brand     : isom
    minor_version   : 512
    compatible_brands: isomiso2avc1mp41
    creation_time   : 2026-10-23T21:43:06.000000Z
    title           : KS SALADE
    encoder         : Lavf58.76.100
  Duration: 00:00:12.07, start: 0.000000, bitrate: 14896 kb/s
  Stream #0:0[0x1](und): Video: h264 (High) (avc1 / 0x31637661), yuv420p(tv, bt709, progressive), 1080x1920, 14829 kb/s, SAR 1:1 DAR 9:16, 30 fps, 30 tbr, 30k tbn (default)
    Metadata:
      creation_time   : 2026-10-23T21:43:06.000000Z
      handler_name    : Core Media Video
      vendor_id       : [0][0][0][0]
      timecode        : 00:00:00:00
  Stream #0:1[0x2](und): Audio: aac (LC) (mp4a / 0x6134706D), 44100 Hz, stereo, fltp, 63 kb/s (default)
    Metadata:
      creation_time   : 2026-10-23T21:43:06.000000Z
      handler_name    : SoundHandler
  Stream #0:2[0x3](eng): Data: none (tmcd / 0x64636D74), 0 kb/s
At least one output file must be specified`;

// Sortie de la compression (CRF 18, veryfast) de la vidéo ci-dessus.
const OUTPUT = `Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'out-vda.mp4':
  Metadata:
    major_brand     : isom
    minor_version   : 512
    compatible_brands: isomiso2avc1mp41
    encoder         : Lavf59.27.100
    comment         : ${COMPRESSED_TAG}
  Duration: 00:00:12.07, start: 0.000000, bitrate: 9476 kb/s
  Stream #0:0[0x1](und): Video: h264 (High) (avc1 / 0x31637661), yuv420p(tv, bt709, progressive), 1080x1920 [SAR 1:1 DAR 9:16], 9407 kb/s, 30 fps, 30 tbr, 15360 tbn (default)
    Metadata:
      handler_name    : VideoHandler
      vendor_id       : [0][0][0][0]
      encoder         : Lavc59.37.100 libx264
  Stream #0:1[0x2](und): Audio: aac (LC) (mp4a / 0x6134706D), 44100 Hz, stereo, fltp, 63 kb/s (default)
    Metadata:
      handler_name    : SoundHandler
At least one output file must be specified`;

// Même vidéo, son retiré.
const MUTE = `Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'out-mute.mp4':
  Metadata:
    major_brand     : isom
    encoder         : Lavf59.27.100
  Duration: 00:00:12.07, start: 0.000000, bitrate: 14833 kb/s
  Stream #0:0[0x1](und): Video: h264 (High) (avc1 / 0x31637661), yuv420p(tv, bt709, progressive), 1080x1920, 14829 kb/s, SAR 1:1 DAR 9:16, 30 fps, 30 tbr, 30k tbn (default)
    Metadata:
      handler_name    : Core Media Video
      vendor_id       : [0][0][0][0]`;

// Même vidéo, tournée d'un quart de tour (matrice d'affichage, comme les téléphones).
const ROTATED = `Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'out-rot.mp4':
  Duration: 00:00:12.07, start: 0.000000, bitrate: 14897 kb/s
  Stream #0:0[0x1](und): Video: h264 (High) (avc1 / 0x31637661), yuv420p(tv, bt709, progressive), 1080x1920, 14829 kb/s, SAR 1:1 DAR 9:16, 30 fps, 30 tbr, 30k tbn (default)
    Metadata:
      handler_name    : Core Media Video
    Side data:
      displaymatrix: rotation of 90.00 degrees
  Stream #0:1[0x2](und): Audio: aac (LC) (mp4a / 0x6134706D), 44100 Hz, stereo, fltp, 63 kb/s (default)`;

const WEBM = `Input #0, matroska,webm, from 'out-small.webm':
  Metadata:
    ENCODER         : Lavf59.27.100
  Duration: 00:00:01.00, start: 0.000000, bitrate: 450 kb/s
  Stream #0:0: Video: vp8, yuv420p(tv, bt709, progressive), 270x480, SAR 1:1 DAR 9:16, 30 fps, 30 tbr, 1k tbn (default)`;

// Vidéo d'iPhone en HEVC 10 bits HDR (format du journal de ffmpeg pour ce type de fichier).
const IPHONE_HDR = `Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'IMG_0001.MOV':
  Duration: 00:00:09.85, start: 0.000000, bitrate: 11234 kb/s
  Stream #0:0[0x1](und): Video: hevc (Main 10) (hvc1 / 0x31637668), yuv420p10le(tv, bt2020nc/bt2020/arib-std-b67), 1920x1080, 10950 kb/s, 29.98 fps, 30 tbr, 600 tbn (default)
    Side data:
      displaymatrix: rotation of -90.00 degrees
  Stream #0:1[0x2](und): Audio: aac (LC) (mp4a / 0x6134706D), 44100 Hz, stereo, fltp, 177 kb/s (default)`;

const measured = (log: string, bytes: number, patch: Partial<Measured> = {}): Measured => ({
  probe: parseProbe(log),
  bytes,
  displayWidth: 1080,
  displayHeight: 1920,
  playable: true,
  ...patch,
});
const SRC = measured(SOURCE, 22_480_077);
const OUT = measured(OUTPUT, 14_300_159);

describe("parseProbe", () => {
  it("vidéo avec son : conteneur, durée, codec, couleurs, définition, cadence, audio", () => {
    const p = parseProbe(SOURCE);
    assert.equal(p.format, "mov,mp4,m4a,3gp,3g2,mj2");
    assert.equal(p.duration, 12.07);
    assert.equal(p.codec, "h264");
    assert.equal(p.pixFmt, "yuv420p");
    assert.equal(p.color, "tv, bt709, progressive");
    assert.deepEqual([p.width, p.height, p.fps, p.rotation], [1080, 1920, 30, 0]);
    assert.equal(p.audio, "aac");
    assert.equal(p.comment, null);
  });
  it("sortie compressée : définition entre crochets lue, marque de traitement lue", () => {
    const p = parseProbe(OUTPUT);
    assert.deepEqual([p.width, p.height, p.fps], [1080, 1920, 30]);
    assert.equal(p.comment, COMPRESSED_TAG);
  });
  it("sans son : audio absent", () => {
    assert.equal(parseProbe(MUTE).audio, null);
  });
  it("rotation : lue dans la matrice d'affichage", () => {
    assert.equal(parseProbe(ROTATED).rotation, 90);
    assert.equal(parseProbe(IPHONE_HDR).rotation, -90);
  });
  it("HEVC 10 bits HDR et webm", () => {
    const h = parseProbe(IPHONE_HDR);
    assert.deepEqual([h.codec, h.pixFmt, h.fps], ["hevc", "yuv420p10le", 29.98]);
    assert.ok(h.color.includes("arib-std-b67"));
    const w = parseProbe(WEBM);
    assert.deepEqual([w.format, w.codec, w.audio], ["matroska,webm", "vp8", null]);
  });
  it("journal vide : rien d'inventé", () => {
    const p = parseProbe("");
    assert.deepEqual([p.codec, p.width, p.fps, p.duration, p.audio], [null, null, null, null, null]);
  });
});

describe("shouldCompress", () => {
  it("H.264 8 bits SDR en MP4 : oui, avec ou sans son, tourné ou non", () => {
    for (const log of [SOURCE, MUTE, ROTATED]) assert.deepEqual(shouldCompress(parseProbe(log)), { ok: true });
  });
  it("HEVC, webm, 10 bits, HDR, déjà traité : non", () => {
    assert.equal(shouldCompress(parseProbe(IPHONE_HDR)).ok, false);
    assert.equal(shouldCompress(parseProbe(WEBM)).ok, false);
    const src = parseProbe(SOURCE);
    assert.equal(shouldCompress({ ...src, pixFmt: "yuv420p10le" }).ok, false);
    assert.equal(shouldCompress({ ...src, pixFmt: "yuvj420p" }).ok, false);
    assert.equal(shouldCompress({ ...src, color: "tv, bt2020nc/bt2020/smpte2084" }).ok, false);
    assert.deepEqual(shouldCompress(parseProbe(OUTPUT)), { ok: false, reason: "vidéo déjà compressée" });
  });
});

describe("garde de l'appareil et du poids", () => {
  const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
  const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1";
  const IPAD_DESKTOP = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15";
  it("iPhone et iPad (même en mode ordinateur) : non ; Mac sans écran tactile : oui", () => {
    assert.equal(isAppleMobile(IPHONE, 5), true);
    assert.equal(isAppleMobile(IPAD_DESKTOP, 5), true);
    assert.equal(isAppleMobile(IPAD_DESKTOP, 0), false);
    assert.equal(isAppleMobile(CHROME, 0), false);
  });
  it("au-delà de 120 Mo : non", () => {
    assert.deepEqual(canCompressHere(22_480_077, CHROME, 0), { ok: true });
    assert.equal(canCompressHere(121 * 1024 * 1024, CHROME, 0).ok, false);
    assert.equal(canCompressHere(1024, IPHONE, 5).ok, false);
  });
});

describe("encodeArgs", () => {
  it("CRF fixe, aucun filtre, horodatages repris, son copié si AAC, démarrage rapide", () => {
    const args = encodeArgs("in.mp4", "out.mp4", parseProbe(SOURCE));
    const s = args.join(" ");
    assert.ok(s.includes(`-crf ${VIDEO_CRF} `) && s.includes("-preset veryfast") && s.includes("-fps_mode passthrough"));
    assert.ok(s.includes("-c:a copy") && s.includes("-movflags +faststart") && s.includes("-map_metadata -1"));
    assert.ok(!args.includes("-vf") && !args.includes("-r") && !args.includes("-s"));
    assert.equal(args.at(-1), "out.mp4");
  });
  it("son non AAC : AAC 192 kb/s ; pas de son : aucune piste créée", () => {
    const src = parseProbe(SOURCE);
    assert.ok(encodeArgs("i", "o", { ...src, audio: "pcm_s16le" }).join(" ").includes("-c:a aac -b:a 192k"));
    assert.ok(!encodeArgs("i", "o", parseProbe(MUTE)).some((a) => a.startsWith("-c:a")));
  });
});

describe("decide", () => {
  it("cas réel : sortie identique et 36 % plus légère → sortie", () => {
    assert.deepEqual(decide(SRC, OUT), { keep: "output" });
  });
  it("gain insuffisant → original", () => {
    assert.deepEqual(decide(SRC, { ...OUT, bytes: 21_000_000 }), { keep: "original", reason: "gain inférieur à 10 %" });
  });
  it("définition affichée différente → original", () => {
    assert.equal(decide(SRC, { ...OUT, displayWidth: 1920, displayHeight: 1080 }).keep, "original");
  });
  it("cadence différente → original", () => {
    assert.equal(decide(SRC, { ...OUT, probe: { ...OUT.probe, fps: 25 } }).keep, "original");
  });
  it("son perdu → original ; source muette → sortie muette acceptée", () => {
    assert.deepEqual(decide(SRC, { ...OUT, probe: { ...OUT.probe, audio: null } }), { keep: "original", reason: "son perdu" });
    const mute = measured(MUTE, 22_400_000);
    assert.deepEqual(decide(mute, { ...OUT, probe: { ...OUT.probe, audio: null } }), { keep: "output" });
  });
  it("durée hors tolérance → original ; dans la tolérance → sortie", () => {
    assert.equal(decide(SRC, { ...OUT, probe: { ...OUT.probe, duration: 11.9 } }).keep, "original");
    assert.equal(decide(SRC, { ...OUT, probe: { ...OUT.probe, duration: 12.1 } }).keep, "output");
  });
  it("sortie illisible → original", () => {
    assert.deepEqual(decide(SRC, { ...OUT, playable: false }), { keep: "original", reason: "sortie illisible" });
  });
});
