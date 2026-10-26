/**
 * Son du site public : un seul module, un seul AudioContext (créé à la première interaction, règles
 * d'autoplay des navigateurs), quatre bus : maître → (musique, ambiance, effets).
 *
 * - Musique : deux morceaux (public/son) lus par HTMLAudioElement + MediaElementSource, chargés
 *   seulement après l'interaction (preload="none"). On n'en joue que des passages calmes, repérés
 *   par analyse (scripts/audio/music-segments.mjs : RMS par fenêtre de 1 s), à niveau égalisé, un
 *   passage différent à chaque fois en alternant les morceaux, avec fondus de 4 s et 5 s. Entre
 *   deux passages, 75 à 180 s sans musique ; deux fois sur trois, une plage de silence complet
 *   (25 à 50 s : l'ambiance s'efface, aucun évènement).
 * - Ambiances et effets synthétisés (bruit filtré, oscillateurs, enveloppes, panoramique) : aucun
 *   fichier, aucune licence. Dehors la nuit : grillons, chouette rare ; dehors le jour : corbeaux,
 *   oiseaux lointains ; vent seulement par rafales douces (≈ 20 % du temps) et en léger souffle
 *   pendant les travellings (pas de bruit de pas) ; loup lointain rare. Crypte : presque le silence, un crépitement de
 *   bougie de temps en temps, le loup très lointain et très rare. Fondus enchaînés (3 s).
 * - Effets : chauves-souris (nuée de 7 à 10 individus qui approche, passe et s'éloigne ; nuée : 1 fois
 *   sur 3, sortie de la crypte : à chaque fois) ; rire diabolique au dévoilement du classement (une
 *   fois par session, public/son/sfx/rire.wav). La musique baisse un peu pendant un effet ; jamais plus de trois
 *   couches audibles, les évènements rares attendent leur tour.
 * - Volume par défaut très bas (gain maître 0,15), mémorisé avec la coupure (localStorage).
 * - Onglet masqué : fondu à zéro puis pause ; reprise en fondu au retour.
 * Chaque voix éphémère est déconnectée à sa fin (compteur `voices` pour les tests).
 */
import { withBase } from "@/lib/base-path";
import { TEST_CLOCK } from "@/lib/clock";

export type Place = "outdoor" | "crypt";
export type SoundEvent =
  /** Nuée qui traverse l'écran vers `side` (-1 gauche, 1 droite) pendant `dur` secondes. */
  | { type: "swarm"; side: number; dur: number }
  /** Les chauves-souris jaillissent de la porte de la crypte quand la caméra y entre. */
  | { type: "doorSwarm" }
  /** Le classement vient d'être dévoilé dans la crypte (rire diabolique, une fois par session). */
  | { type: "reveal" }
  /** Travelling d'un lieu à l'autre (`dur` secondes), vers la crypte ou dehors. */
  | { type: "travel"; dur: number; indoor: boolean };

export type SoundPrefs = { volume: number; muted: boolean };

const PREFS_KEY = "chamas-sound";
const DEFAULT_PREFS: SoundPrefs = { volume: 0.5, muted: false };
/** Courbe du volume (quadratique) : le réglage par défaut (0,5) donne un gain maître de 0,15, le maximum 0,6. */
const MASTER_MAX = 0.3;
const BUS = { music: 0.5, amb: 0.75, sfx: 0.8 };
const TRACKS = ["/son/geoff-harvey-diabolus.mp3", "/son/soundore-background-horror.mp3"];
/**
 * Passages calmes retenus par scripts/audio/music-segments.mjs (en secondes) ; gain : égalise leur
 * niveau autour de −36 dBFS RMS (Soundore est mixé environ 12 dB plus fort que Diabolus).
 */
const MUSIC_SEGMENTS = [
  { track: 0, start: 2, end: 22, gain: 1 }, // Diabolus, RMS moyen −38,6 dBFS
  { track: 0, start: 63, end: 83, gain: 0.92 }, // Diabolus, −35,3
  { track: 1, start: 2, end: 22, gain: 0.38 }, // Soundore, −27,6
  { track: 1, start: 34, end: 54, gain: 0.2 }, // Soundore, −22,2
  { track: 1, start: 56, end: 76, gain: 0.16 }, // Soundore, −20,0
];

const rand = (a: number, b: number) => a + Math.random() * (b - a);

// ---------------------------------------------------------------------------
// Préférences (volume, coupure) : mémorisées, observables par le panneau du son.
// ---------------------------------------------------------------------------

let prefs: SoundPrefs = DEFAULT_PREFS;
let prefsLoaded = false;
const listeners = new Set<() => void>();

function loadPrefs() {
  if (prefsLoaded || typeof window === "undefined") return;
  prefsLoaded = true;
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "null") as Partial<SoundPrefs> | null;
    if (raw && typeof raw.volume === "number" && raw.volume >= 0 && raw.volume <= 1) prefs = { volume: raw.volume, muted: !!raw.muted };
  } catch {
    /* stockage indisponible : réglages par défaut */
  }
}

export function getSoundPrefs(): SoundPrefs {
  loadPrefs();
  return prefs;
}
export const serverSoundPrefs = () => DEFAULT_PREFS;
export function subscribeSound(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
function setPrefs(next: SoundPrefs) {
  prefs = next;
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  } catch {
    /* le réglage vaut pour cette visite */
  }
  listeners.forEach((fn) => fn());
}

// ---------------------------------------------------------------------------
// Graphe audio.
// ---------------------------------------------------------------------------

type Engine = {
  ctx: AudioContext;
  master: GainNode;
  music: GainNode;
  duck: GainNode;
  amb: GainNode;
  sfx: GainNode;
  /** Réverbération commune (chauves-souris lointaines, rire de la crypte). */
  verb: ConvolverNode;
  noise: AudioBuffer;
  groups: { wind: GainNode; crickets: GainNode };
  windFilter: BiquadFilterNode;
  windPan: StereoPannerNode;
  crickets: { env: GainNode; next: number }[];
  tracks: ({ el: HTMLAudioElement; gain: GainNode } | null)[];
  meters: Record<"master" | "music" | "amb" | "sfx", AnalyserNode> | null;
  /** Tests : bus d'effets (chauves-souris, rire) analysé en sortie, gauche et droite séparées. */
  sfxLR: [AnalyserNode, AnalyserNode] | null;
};

let eng: Engine | null = null;
let started = false;
let ctxCount = 0;
let voices = 0;
let place: Place = "outdoor";
let theme: "dark" | "light" = "dark";
let hidden = false;
/** Vidéos en cours de lecture (cartes, visionneuse) : le site se tait tant qu'il y en a une. */
let held = 0;
/** Fin du dernier effet (temps du contexte) : les évènements rares attendent qu'il soit fini. */
let busyUntil = 0;
/** Morceau en cours (index de TRACKS), -1 sinon. */
let curTrack = -1;
/** Fin de la rafale de vent en cours (temps du contexte). */
let windUntil = 0;
const next = { owl: 0, wolf: 0, crows: 0, birds: 0, candle: 0, gust: 0 };

/** Rampe douce depuis la valeur courante (aucune coupure sèche). */
function ramp(p: AudioParam, value: number, seconds: number, at?: number) {
  const ctx = eng!.ctx;
  const t = at ?? ctx.currentTime;
  p.cancelScheduledValues(t);
  p.setValueAtTime(p.value, t);
  p.linearRampToValueAtTime(value, t + seconds);
}

const masterLevel = () => (prefs.muted || held > 0 ? 0 : MASTER_MAX * prefs.volume * prefs.volume * 2);

function build(): Engine {
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AC();
  ctxCount++;
  const gain = (v: number, to?: AudioNode) => {
    const g = ctx.createGain();
    g.gain.value = v;
    if (to) g.connect(to);
    return g;
  };
  // Limiteur de sécurité : aucune saturation, même si plusieurs sons se cumulent.
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -6;
  limiter.knee.value = 6;
  limiter.ratio.value = 12;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.25;
  limiter.connect(ctx.destination);
  const master = gain(0, limiter);
  const duck = gain(1, master);
  const musicBus = gain(BUS.music, duck);
  const amb = gain(BUS.amb, master);
  const sfx = gain(BUS.sfx, master);
  // Réverbération : réponse impulsionnelle synthétique (bruit décroissant de 1,8 s, canaux décorrélés).
  const verb = ctx.createConvolver();
  const ir = ctx.createBuffer(2, Math.round(ctx.sampleRate * 1.8), ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp((-i / ctx.sampleRate) * 3);
  }
  verb.buffer = ir;
  verb.connect(gain(0.5, master));

  const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const loopNoise = () => {
    const s = ctx.createBufferSource();
    s.buffer = noise;
    s.loop = true;
    s.loopStart = Math.random();
    s.start();
    return s;
  };

  // Vent : bruit assombri (passe-bas, proche d'un bruit brun) puis passe-bande large et bas, muet
  // hors des rafales (voir gust). Pas d'aigus sifflants : un souffle feutré.
  const groups = { wind: gain(0, amb), crickets: gain(0, amb) };
  const windTone = ctx.createBiquadFilter();
  windTone.type = "lowpass";
  windTone.frequency.value = 700;
  windTone.Q.value = 0.3;
  const windFilter = ctx.createBiquadFilter();
  windFilter.type = "bandpass";
  windFilter.frequency.value = 320;
  windFilter.Q.value = 0.45;
  const windPan = ctx.createStereoPanner();
  loopNoise().connect(windTone).connect(windFilter);
  windFilter.connect(windPan);
  windPan.connect(gain(0.24, groups.wind));

  // Grillons : deux oscillateurs aigus, enveloppes de « cri » programmées à l'avance.
  const crickets = [
    [4350, -0.55],
    [4720, 0.6],
  ].map(([f, pan]) => {
    const o = ctx.createOscillator();
    o.frequency.value = f;
    const env = gain(0);
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    o.connect(env).connect(p).connect(groups.crickets);
    o.start();
    return { env, next: 0 };
  });

  let meters: Engine["meters"] = null;
  let sfxLR: Engine["sfxLR"] = null;
  if (TEST_CLOCK) {
    const tap = (n: AudioNode) => {
      const a = ctx.createAnalyser();
      a.fftSize = 2048;
      n.connect(a);
      return a;
    };
    meters = { master: tap(limiter), music: tap(musicBus), amb: tap(amb), sfx: tap(sfx) };
    const split = ctx.createChannelSplitter(2);
    sfx.connect(split);
    sfxLR = [0, 1].map((c) => {
      const a = ctx.createAnalyser();
      a.fftSize = 2048;
      split.connect(a, c);
      return a;
    }) as [AnalyserNode, AnalyserNode];
  }
  return { ctx, master, music: musicBus, duck, amb, sfx, verb, noise, groups, windFilter, windPan, crickets, tracks: [null, null], meters, sfxLR };
}

/** Voix éphémère : tous ses nœuds sont déconnectés à la fin de sa source (plus la traîne d'écho). */
function voice(nodes: AudioNode[], src: AudioScheduledSourceNode, tail = 0) {
  voices++;
  src.onended = () =>
    setTimeout(() => {
      nodes.forEach((n) => n.disconnect());
      voices--;
    }, tail * 1000);
}

/** La musique baisse un peu le temps d'un effet. */
function duckFor(seconds: number) {
  const { ctx, duck } = eng!;
  const t = ctx.currentTime;
  busyUntil = Math.max(busyUntil, t + seconds);
  duck.gain.cancelScheduledValues(t);
  duck.gain.setTargetAtTime(0.6, t, 0.15);
  duck.gain.setTargetAtTime(1, t + seconds, 0.6);
}

// ---------------------------------------------------------------------------
// Effets et évènements synthétisés.
// ---------------------------------------------------------------------------

function noiseSource(at: number, dur: number) {
  const { ctx, noise } = eng!;
  const s = ctx.createBufferSource();
  s.buffer = noise;
  s.loop = true;
  s.loopStart = Math.random();
  s.start(at);
  s.stop(at + dur);
  return s;
}

const clampPan = (v: number) => Math.max(-1, Math.min(1, v));

/**
 * Chauves-souris : une nuée de 7 à 10 individus. Chacun a ses battements d'ailes (bruit passe-bande
 * modulé à son propre rythme) et ses petits cris aigus désynchronisés (glissandos très courts, hauteurs
 * variées). La nuée arrive de loin (passe-bas fermé, niveau bas, beaucoup de réverbération), passe au
 * plus près à \`closest\` (fraction de la durée), puis s'éloigne. Panoramique de chaque individu le long
 * de la trajectoire, décalé d'un individu à l'autre (stéréo décorrélée).
 */
function bats(fromPan: number, toPan: number, dur: number, level: number, closest = 0.5) {
  const { ctx, sfx, verb } = eng!;
  const t = ctx.currentTime + 0.05;
  const tc = t + dur * closest;
  const end = t + dur;
  // Distance commune : passe-bas qui s'ouvre, niveau qui monte, réverbération qui diminue.
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.Q.value = 0.5;
  lp.frequency.setValueAtTime(1200, t);
  lp.frequency.exponentialRampToValueAtTime(11000, tc);
  lp.frequency.exponentialRampToValueAtTime(2200, end);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(level, tc);
  g.gain.exponentialRampToValueAtTime(0.0001, end);
  const send = ctx.createGain();
  send.gain.setValueAtTime(0.6, t);
  send.gain.linearRampToValueAtTime(0.12, tc);
  send.gain.linearRampToValueAtTime(0.5, end);
  lp.connect(g);
  g.connect(sfx);
  g.connect(send).connect(verb);
  const nodes: AudioNode[] = [lp, g, send];
  const n = Math.round(rand(7, 10));
  for (let i = 0; i < n; i++) {
    const t0 = t + rand(0, dur * 0.15);
    const t1 = end - rand(0, dur * 0.15);
    const off = rand(-0.35, 0.35);
    const pan = ctx.createStereoPanner();
    pan.pan.setValueAtTime(clampPan(fromPan + off), t0);
    pan.pan.linearRampToValueAtTime(clampPan(toPan + off * 0.6), t1);
    pan.connect(lp);
    // Ailes : froissement (bruit passe-bande), amplitude modulée au rythme de l'individu.
    const src = noiseSource(t0, t1 - t0);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = rand(1800, 4200);
    bp.Q.value = rand(1.2, 2.5);
    const wing = ctx.createGain();
    wing.gain.value = 0.5;
    const lfo = ctx.createOscillator();
    lfo.type = "triangle";
    lfo.frequency.value = rand(8, 14);
    const depth = ctx.createGain();
    depth.gain.value = 0.5;
    lfo.connect(depth).connect(wing.gain);
    const wEnv = ctx.createGain();
    const wl = rand(0.25, 0.5);
    wEnv.gain.setValueAtTime(0, t0);
    wEnv.gain.linearRampToValueAtTime(wl, t0 + 0.15);
    wEnv.gain.setValueAtTime(wl, t1 - 0.15);
    wEnv.gain.linearRampToValueAtTime(0, t1);
    src.connect(bp).connect(wing).connect(wEnv).connect(pan);
    lfo.start(t0);
    lfo.stop(t1);
    // Cris : glissandos descendants de 12 à 30 ms, à intervalles irréguliers.
    const osc = ctx.createOscillator();
    const cEnv = ctx.createGain();
    cEnv.gain.value = 0;
    for (let c = t0 + rand(0, 0.2); c < t1 - 0.05; c += rand(0.06, 0.28)) {
      const f0 = rand(4500, 9000);
      osc.frequency.setValueAtTime(f0, c);
      osc.frequency.exponentialRampToValueAtTime(f0 * rand(0.55, 0.75), c + rand(0.012, 0.03));
      cEnv.gain.setValueAtTime(0, c);
      cEnv.gain.linearRampToValueAtTime(rand(0.08, 0.22), c + 0.003);
      cEnv.gain.linearRampToValueAtTime(0, c + 0.03);
    }
    osc.connect(cEnv).connect(pan);
    osc.start(t0);
    osc.stop(t1);
    nodes.push(pan, src, bp, wing, lfo, depth, wEnv, osc, cEnv);
  }
  // Une seule voix pour toute la nuée : tout est déconnecté après la traîne de réverbération.
  const done = ctx.createConstantSource();
  done.start(t);
  done.stop(end + 0.05);
  voice([...nodes, done], done, 1.5);
  duckFor(dur);
}

/** Rire diabolique (public/son/sfx/rire.wav, voir scripts/audio/laugh.mjs) : chargé après l'interaction. */
let laughBuf: AudioBuffer | null = null;
let laughLoading = false;
function loadLaugh() {
  if (!eng || laughLoading) return;
  laughLoading = true;
  const ctx = eng.ctx;
  void fetch(withBase("/son/sfx/rire.wav"))
    .then((r) => r.arrayBuffer())
    .then((b) => ctx.decodeAudioData(b))
    .then((b) => (laughBuf = b))
    .catch(() => (laughLoading = false));
}
/** Une seule fois par session (au dévoilement du classement dans la crypte), niveau bas. */
function laugh() {
  if (!eng || !laughBuf) return;
  try {
    if (sessionStorage.getItem("hw-laugh")) return;
    sessionStorage.setItem("hw-laugh", "1");
  } catch {
    /* sans sessionStorage : il peut revenir à la prochaine visite de la crypte */
  }
  const { ctx, sfx, verb } = eng;
  const src = ctx.createBufferSource();
  src.buffer = laughBuf;
  const g = ctx.createGain();
  g.gain.value = 0.5;
  const send = ctx.createGain();
  send.gain.value = 0.15;
  src.connect(g).connect(sfx);
  g.connect(send).connect(verb);
  src.start(ctx.currentTime + 0.3);
  voice([src, g, send], src, 1.5);
  duckFor(laughBuf.duration + 0.5);
}

/** Hurlement de loup lointain : glissando montant puis tenu, vibrato, filtré par la distance, écho. */
function wolf(far: boolean) {
  const { ctx, amb } = eng!;
  const t = ctx.currentTime + 0.05;
  const o = ctx.createOscillator();
  o.type = "sawtooth";
  const base = rand(260, 300);
  o.frequency.setValueAtTime(base, t);
  o.frequency.linearRampToValueAtTime(base * 1.85, t + 0.9);
  o.frequency.linearRampToValueAtTime(base * 1.7, t + 2.6);
  o.frequency.linearRampToValueAtTime(base * 1.15, t + 3.7);
  const vib = ctx.createOscillator();
  vib.frequency.value = 5.2;
  const vibD = ctx.createGain();
  vibD.gain.value = 5;
  vib.connect(vibD).connect(o.frequency);
  const formant = ctx.createBiquadFilter();
  formant.type = "bandpass";
  formant.frequency.value = 750;
  formant.Q.value = 1.4;
  const dist = ctx.createBiquadFilter();
  dist.type = "lowpass";
  dist.frequency.value = far ? 650 : 1300;
  const env = ctx.createGain();
  const peak = far ? 0.07 : 0.13;
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(peak, t + 0.7);
  env.gain.setValueAtTime(peak * 0.9, t + 2.8);
  env.gain.linearRampToValueAtTime(0, t + 3.9);
  const pan = ctx.createStereoPanner();
  pan.pan.value = rand(-0.7, 0.7);
  const dl = ctx.createDelay(1);
  dl.delayTime.value = 0.34;
  const fb = ctx.createGain();
  fb.gain.value = 0.35;
  o.connect(formant).connect(dist).connect(env).connect(pan).connect(amb);
  pan.connect(dl).connect(fb).connect(dl);
  fb.connect(amb);
  o.start(t);
  o.stop(t + 4);
  vib.start(t);
  vib.stop(t + 4);
  voice([o, vib, vibD, formant, dist, env, pan, dl, fb], o, 2.5);
  busyUntil = Math.max(busyUntil, t + 4.5);
}

/** Chouette : deux hululements graves et doux. */
function owl() {
  const { ctx, amb } = eng!;
  const t = ctx.currentTime + 0.05;
  const o = ctx.createOscillator();
  const env = ctx.createGain();
  env.gain.value = 0;
  for (const [s, len] of [
    [0, 0.32],
    [0.55, 0.7],
  ]) {
    o.frequency.setValueAtTime(400, t + s);
    o.frequency.linearRampToValueAtTime(345, t + s + len);
    env.gain.setValueAtTime(0, t + s);
    env.gain.linearRampToValueAtTime(0.09, t + s + 0.06);
    env.gain.linearRampToValueAtTime(0, t + s + len);
  }
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 1100;
  const pan = ctx.createStereoPanner();
  pan.pan.value = rand(-0.6, 0.6);
  o.connect(lp).connect(env).connect(pan).connect(amb);
  o.start(t);
  o.stop(t + 1.4);
  voice([o, env, lp, pan], o);
  busyUntil = Math.max(busyUntil, t + 1.6);
}

/** Corbeaux : deux ou trois croassements rauques, au loin. */
function crows() {
  const { ctx, amb } = eng!;
  const t = ctx.currentTime + 0.05;
  const o = ctx.createOscillator();
  o.type = "sawtooth";
  const env = ctx.createGain();
  env.gain.value = 0;
  const n = Math.round(rand(2, 3));
  for (let i = 0; i < n; i++) {
    const s = t + i * rand(0.35, 0.5);
    o.frequency.setValueAtTime(rand(560, 640), s);
    o.frequency.exponentialRampToValueAtTime(rand(380, 440), s + 0.2);
    env.gain.setValueAtTime(0, s);
    env.gain.linearRampToValueAtTime(0.05, s + 0.02);
    env.gain.linearRampToValueAtTime(0, s + 0.22);
  }
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 1150;
  bp.Q.value = 1.3;
  const pan = ctx.createStereoPanner();
  pan.pan.value = rand(-0.8, 0.8);
  o.connect(bp).connect(env).connect(pan).connect(amb);
  o.start(t);
  o.stop(t + n * 0.5 + 0.3);
  voice([o, env, bp, pan], o);
  busyUntil = Math.max(busyUntil, t + n * 0.5 + 0.3);
}

/** Petits oiseaux lointains : quelques pépiements très discrets. */
function birds() {
  const { ctx, amb } = eng!;
  const t = ctx.currentTime + 0.05;
  const o = ctx.createOscillator();
  const env = ctx.createGain();
  env.gain.value = 0;
  const n = Math.round(rand(3, 5));
  for (let i = 0; i < n; i++) {
    const s = t + i * rand(0.12, 0.2);
    o.frequency.setValueAtTime(rand(2900, 3400), s);
    o.frequency.exponentialRampToValueAtTime(rand(3900, 4600), s + 0.07);
    env.gain.setValueAtTime(0, s);
    env.gain.linearRampToValueAtTime(0.018, s + 0.01);
    env.gain.linearRampToValueAtTime(0, s + 0.08);
  }
  const pan = ctx.createStereoPanner();
  pan.pan.value = rand(-0.9, 0.9);
  o.connect(env).connect(pan).connect(amb);
  o.start(t);
  o.stop(t + n * 0.2 + 0.2);
  voice([o, env, pan], o);
}

/** Bougie (crypte) : quelques crépitements très discrets, de temps en temps (pas de nappe continue). */
function candle() {
  const { ctx, amb } = eng!;
  const t = ctx.currentTime + 0.05;
  const dur = rand(0.8, 1.8);
  const src = noiseSource(t, dur);
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 1800;
  const env = ctx.createGain();
  env.gain.value = 0;
  const pops = Math.round(rand(3, 7));
  for (let i = 0; i < pops; i++) {
    const p = t + rand(0, dur - 0.05);
    env.gain.setValueAtTime(0, p);
    env.gain.linearRampToValueAtTime(rand(0.015, 0.05), p + 0.003);
    env.gain.linearRampToValueAtTime(0, p + rand(0.01, 0.025));
  }
  const pan = ctx.createStereoPanner();
  pan.pan.value = rand(-0.3, 0.3);
  src.connect(hp).connect(env).connect(pan).connect(amb);
  voice([src, hp, env, pan], src);
}

/** Rafale de vent : montée et descente progressives (aucune coupure), filtre et panoramique qui bougent. */
function gust(dur: number, peak: number) {
  const { ctx, groups, windFilter, windPan } = eng!;
  const t = ctx.currentTime;
  const g = groups.wind.gain;
  g.cancelScheduledValues(t);
  g.setValueAtTime(g.value, t);
  // Enveloppe en cloche découpée en « respirations » : le souffle enfle et retombe plusieurs fois,
  // avec des courbes exponentielles douces (setTargetAtTime), et la couleur du bruit suit.
  const steps = Math.max(3, Math.round(dur / 2));
  const step = dur / steps;
  for (let i = 1; i < steps; i++) {
    const swell = Math.sin((Math.PI * i) / steps);
    const at = t + step * (i - 1);
    g.setTargetAtTime(peak * swell * rand(0.65, 1), at, step / 2.5);
    windFilter.frequency.setTargetAtTime(220 + swell * rand(120, 260), at, step / 2);
  }
  g.setTargetAtTime(0, t + step * (steps - 1), step / 2.5);
  windPan.pan.setTargetAtTime(rand(-0.4, 0.4), t, dur * 0.4);
  windUntil = t + dur + step;
}

// ---------------------------------------------------------------------------
// Ambiances, musique, silences : boucle de programmation (toutes les 250 ms).
// ---------------------------------------------------------------------------

/**
 * Plan musical : plages de musique et silences alternés, plages de silence complet (« hush »).
 * Fonction pure (temps et hasard en paramètres) : elle pilote le son et la simulation des tests.
 */
type Plan = { phase: "music" | "silence"; until: number; lastTrack: number; seg: number; hushFrom: number; hushTo: number; hushed: boolean };
const newPlan = (now: number, rnd: () => number): Plan => ({ phase: "silence", until: now + 4 + rnd() * 6, lastTrack: -1, seg: -1, hushFrom: Infinity, hushTo: -Infinity, hushed: false });
function planStep(p: Plan, now: number, rnd: () => number) {
  const out: { play?: number; stop?: boolean; hush?: boolean } = {};
  if (now >= p.until) {
    if (p.phase === "silence") {
      // Un passage de l'autre morceau, jamais le même que la fois précédente.
      const pool = MUSIC_SEGMENTS.map((_, i) => i).filter((i) => MUSIC_SEGMENTS[i].track !== p.lastTrack && i !== p.seg);
      const i = pool[Math.floor(rnd() * pool.length)];
      const seg = MUSIC_SEGMENTS[i];
      Object.assign(p, { phase: "music", until: now + seg.end - seg.start, lastTrack: seg.track, seg: i });
      out.play = i;
    } else {
      const len = 75 + rnd() * 105;
      Object.assign(p, { phase: "silence", until: now + len });
      out.stop = true;
      if (rnd() < 0.65) {
        p.hushFrom = now + 8 + rnd() * Math.max(0, len - 60);
        p.hushTo = p.hushFrom + 25 + rnd() * 25;
      }
    }
  }
  const hush = p.phase === "silence" && now >= p.hushFrom && now < p.hushTo;
  if (hush !== p.hushed) {
    p.hushed = hush;
    out.hush = hush;
  }
  return out;
}
let plan: Plan | null = null;

function applyAmbience(seconds = 3) {
  if (!eng) return;
  const out = place === "outdoor";
  const night = theme === "dark";
  // Le vent ne souffle qu'en rafales (gust) ; il se tait en entrant dans la crypte.
  if (!out) ramp(eng.groups.wind.gain, 0, seconds);
  ramp(eng.groups.crickets.gain, out && night ? 0.3 : 0, seconds);
  // Prochains évènements rares, selon le nouveau lieu.
  const now = eng.ctx.currentTime;
  next.owl = now + rand(30, 70);
  next.wolf = now + (out ? rand(60, 150) : rand(300, 600));
  next.crows = now + rand(12, 30);
  next.birds = now + rand(4, 10);
  next.candle = now + rand(15, 40);
  next.gust = now + rand(15, 45);
}

/** Joue un passage retenu : départ au début du passage, fondu d'entrée 4 s, de sortie 5 s. */
function playSegment(i: number) {
  const e = eng!;
  const seg = MUSIC_SEGMENTS[i];
  let tr = e.tracks[seg.track];
  if (!tr) {
    const el = new Audio();
    el.preload = "none";
    el.src = withBase(TRACKS[seg.track]);
    const gain = e.ctx.createGain();
    gain.gain.value = 0;
    e.ctx.createMediaElementSource(el).connect(gain).connect(e.music);
    tr = e.tracks[seg.track] = { el, gain };
  }
  curTrack = seg.track;
  tr.el.currentTime = seg.start;
  void tr.el.play().catch(() => undefined);
  const t = e.ctx.currentTime;
  const len = seg.end - seg.start;
  const g = tr.gain.gain;
  g.cancelScheduledValues(t);
  g.setValueAtTime(0, t);
  g.linearRampToValueAtTime(seg.gain, t + 4);
  g.setValueAtTime(seg.gain, t + len - 5);
  g.linearRampToValueAtTime(0, t + len);
}

/** Fin du passage : le fondu de sortie est terminé, le lecteur s'arrête. */
function stopTrack() {
  const tr = curTrack >= 0 ? eng!.tracks[curTrack] : null;
  curTrack = -1;
  if (tr) {
    ramp(tr.gain.gain, 0, 0.2);
    setTimeout(() => tr.el.pause(), 250);
  }
}

function tick() {
  if (!eng || !plan || hidden) return;
  const { ctx } = eng;
  const now = ctx.currentTime;
  const out = place === "outdoor";
  const night = theme === "dark";

  const step = planStep(plan, now, Math.random);
  if (step.stop) stopTrack();
  if (step.play !== undefined) playSegment(step.play);
  // Silence complet : l'ambiance s'efface (3 s) et revient de même.
  if (step.hush !== undefined) ramp(eng.amb.gain, step.hush ? 0 : BUS.amb, 3);

  // Grillons (la nuit dehors) : cris de 3 impulsions, programmés 1,5 s à l'avance.
  if (out && night) {
    for (const c of eng.crickets) {
      c.next = Math.max(c.next, now + 0.05);
      while (c.next < now + 1.5) {
        for (let k = 0; k < 3; k++) {
          const s = c.next + k * 0.034;
          c.env.gain.setValueAtTime(0, s);
          c.env.gain.linearRampToValueAtTime(0.12, s + 0.005);
          c.env.gain.linearRampToValueAtTime(0, s + 0.022);
        }
        c.next += rand(0.75, 1.35);
      }
    }
  }
  // Évènements rares, un à la fois (jamais pendant un effet ni pendant un silence complet).
  const free = now > busyUntil && !plan.hushed;
  if (now >= next.wolf) {
    if (free) wolf(!out);
    next.wolf = now + (free ? (out ? rand(100, 200) * (night ? 1 : 1.6) : rand(300, 600)) : 8);
  }
  if (out && night && now >= next.owl) {
    if (free) owl();
    next.owl = now + (free ? rand(45, 110) : 6);
  }
  if (out && !night && now >= next.crows) {
    if (free) crows();
    next.crows = now + (free ? rand(20, 50) : 6);
  }
  if (out && !night && now >= next.birds) {
    if (free) birds();
    next.birds = now + rand(6, 15);
  }
  if (!out && now >= next.candle) {
    if (free) candle();
    next.candle = now + (free ? rand(25, 60) : 6);
  }
  // Rafales de vent douces, dehors : 6 à 12 s toutes les 35 à 80 s (≈ 20 % du temps).
  if (out && now >= next.gust) {
    if (free && now > windUntil) gust(rand(8, 14), rand(0.3, 0.5));
    next.gust = now + (free ? rand(35, 80) : 6);
  }
}

// ---------------------------------------------------------------------------
// API publique.
// ---------------------------------------------------------------------------

/** Première interaction (clic, toucher, touche) : crée le contexte et démarre en fondu, sauf si coupé. */
export function unlockSound() {
  loadPrefs();
  if (started || prefs.muted || typeof window === "undefined") return;
  started = true;
  eng = build();
  void eng.ctx.resume();
  ramp(eng.master.gain, masterLevel(), 2.5);
  applyAmbience(2.5);
  plan = newPlan(eng.ctx.currentTime, Math.random);
  if (place === "crypt") loadLaugh();
  setInterval(tick, 250);
  listeners.forEach((fn) => fn());
}

export const isSoundStarted = () => started;

export function setSoundVolume(volume: number) {
  setPrefs({ ...getSoundPrefs(), volume: Math.min(1, Math.max(0, volume)) });
  if (eng) ramp(eng.master.gain, masterLevel(), 0.2);
}

export function setSoundMuted(muted: boolean) {
  setPrefs({ ...getSoundPrefs(), muted });
  if (!muted && !started) return unlockSound(); // le clic sur « Remettre le son » est une interaction
  if (eng) ramp(eng.master.gain, masterLevel(), muted ? 0.4 : 1.2);
}

/** Une vidéo démarre (`true`) ou s'arrête (`false`) : musique, ambiance et effets s'effacent, puis reviennent. */
export function holdSound(on: boolean) {
  held = Math.max(0, held + (on ? 1 : -1));
  if (eng) ramp(eng.master.gain, masterLevel(), on ? 0.3 : 1.5);
}

export function setSoundPlace(p: Place) {
  if (p === place) return;
  place = p;
  applyAmbience();
  if (p === "crypt") loadLaugh(); // préchargé dès l'entrée dans la crypte (après l'interaction)
}

export function setSoundTheme(t: "dark" | "light") {
  if (t === theme) return;
  theme = t;
  applyAmbience();
}

/** Évènements du décor 3D (world.ts → SpookyBackdrop). */
export function soundEvent(e: SoundEvent) {
  if (!eng || hidden || prefs.muted || held > 0) return;
  if (e.type === "swarm") {
    // Nuée qui traverse : de loin d'un côté, au plus près au milieu, puis s'éloigne de l'autre côté.
    if (Math.random() < 0.3) bats(-e.side * 0.8, e.side * 0.9, Math.max(3, Math.min(e.dur + 1, 5)), 0.11, 0.5);
  } else if (e.type === "doorSwarm") {
    // Sortie de la crypte : elles jaillissent devant la caméra et filent sur un côté.
    const side = Math.random() < 0.5 ? -1 : 1;
    bats(0, side * 0.9, 2.2, 0.14, 0.4);
  } else if (e.type === "reveal") {
    laugh();
  } else if (eng.ctx.currentTime > windUntil) {
    // Travelling : un léger souffle de vent pendant le trajet, en fondu (plus de bruit de pas).
    gust(Math.max(4, e.dur), 0.22);
  }
}

/** Onglet masqué : fondu à zéro puis pause ; au retour, reprise en fondu. */
function onVisibility() {
  if (!eng) return;
  const e = eng;
  hidden = document.visibilityState === "hidden";
  const tr = curTrack >= 0 ? e.tracks[curTrack] : null;
  if (hidden) {
    ramp(e.master.gain, 0, 0.5);
    setTimeout(() => {
      if (!hidden) return;
      tr?.el.pause();
      void e.ctx.suspend();
    }, 600);
  } else {
    void e.ctx.resume().then(() => {
      if (tr && curTrack >= 0) void tr.el.play().catch(() => undefined);
      ramp(e.master.gain, masterLevel(), 1.5);
    });
  }
}
if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisibility);

// Mesures pour les tests (build de test seulement : NEXT_PUBLIC_HW_TEST_CLOCK=1).
if (TEST_CLOCK && typeof window !== "undefined") {
  (window as unknown as { __hwSound: unknown }).__hwSound = {
    state: () => ({ started, ctxCount, voices, place, theme, held, musicPlaying: plan?.phase === "music", hushed: plan?.hushed ?? false, wind: eng?.groups.wind.gain.value ?? null, master: eng?.master.gain.value ?? null, ctxState: eng?.ctx.state ?? null }),
    /** RMS et crête (dBFS) de chaque bus pendant `seconds` secondes. */
    measure: (seconds: number) =>
      new Promise((resolve) => {
        if (!eng?.meters) return resolve(null);
        const m = eng.meters;
        const acc = Object.fromEntries(Object.keys(m).map((k) => [k, { sum: 0, n: 0, peak: 0, frames: 0, loud: 0 }])) as Record<string, { sum: number; n: number; peak: number; frames: number; loud: number }>;
        const buf = new Float32Array(2048);
        const id = setInterval(() => {
          for (const [k, a] of Object.entries(m)) {
            a.getFloatTimeDomainData(buf);
            const s = acc[k];
            let fs = 0;
            for (const v of buf) {
              fs += v * v;
              s.peak = Math.max(s.peak, Math.abs(v));
            }
            s.sum += fs;
            s.n += buf.length;
            // Trame « audible » : RMS > −60 dBFS.
            s.frames++;
            if (Math.sqrt(fs / buf.length) > 0.001) s.loud++;
          }
        }, 46);
        setTimeout(() => {
          clearInterval(id);
          const db = (v: number) => (v > 0 ? +(20 * Math.log10(v)).toFixed(1) : -Infinity);
          resolve(Object.fromEntries(Object.entries(acc).map(([k, s]) => [k, { rms: db(Math.sqrt(s.sum / Math.max(1, s.n))), peak: db(s.peak), audible: +(s.loud / Math.max(1, s.frames)).toFixed(3) }])));
        }, seconds * 1000);
      }),
    /** Forcer la musique maintenant (pour la mesurer sans attendre sa plage). */
    musicNow: () => {
      if (plan && plan.phase === "silence") plan.until = 0;
    },
    /** Plan musical simulé sur `seconds` secondes (temps virtuel) : part de musique, de silence complet. */
    simulate: (seconds = 600) => {
      const p = newPlan(0, Math.random);
      let musicS = 0;
      let hushS = 0;
      const played: number[] = [];
      for (let t = 0; t < seconds; t += 0.25) {
        const st = planStep(p, t, Math.random);
        if (st.play !== undefined) played.push(st.play);
        if (p.phase === "music") musicS += 0.25;
        if (p.hushed) hushS += 0.25;
      }
      const name = (i: number) => `${MUSIC_SEGMENTS[i].track === 0 ? "Diabolus" : "Soundore"} ${MUSIC_SEGMENTS[i].start}–${MUSIC_SEGMENTS[i].end} s`;
      return { seconds, musicS, silenceS: seconds - musicS, hushS, played: played.map(name) };
    },
    event: soundEvent,
    /** Bus d'effets pendant `seconds` s : RMS gauche / droite, corrélation G/D, centroïde et bandes (dBFS). */
    analyzeSfx: (seconds: number) =>
      new Promise((resolve) => {
        if (!eng?.sfxLR) return resolve(null);
        const [aL, aR] = eng.sfxLR;
        const L = new Float32Array(2048), R = new Float32Array(2048), F = new Float32Array(1024);
        let sl = 0, sr = 0, slr = 0, n = 0, peak = 0, cw = 0, cs = 0;
        const bands = [0, 0, 0, 0];
        const edges = [1000, 4000, 8000];
        const hz = eng.ctx.sampleRate / 2048;
        const id = setInterval(() => {
          aL.getFloatTimeDomainData(L);
          aR.getFloatTimeDomainData(R);
          for (let i = 0; i < L.length; i++) {
            sl += L[i] * L[i];
            sr += R[i] * R[i];
            slr += L[i] * R[i];
            peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
          }
          n += L.length;
          aL.getFloatFrequencyData(F);
          F.forEach((db, k) => {
            const p = Math.pow(10, db / 10);
            const f = k * hz;
            cw += p * f;
            cs += p;
            bands[f < edges[0] ? 0 : f < edges[1] ? 1 : f < edges[2] ? 2 : 3] += p;
          });
        }, 46);
        setTimeout(() => {
          clearInterval(id);
          const db = (v: number) => (v > 0 ? +(10 * Math.log10(v)).toFixed(1) : -Infinity);
          const tot = bands.reduce((a, b) => a + b, 0) || 1;
          resolve({
            rmsL: db(sl / Math.max(1, n)),
            rmsR: db(sr / Math.max(1, n)),
            peak: peak > 0 ? +(20 * Math.log10(peak)).toFixed(1) : -Infinity,
            corrLR: +(slr / Math.sqrt(sl * sr || 1)).toFixed(2),
            centroidHz: Math.round(cw / (cs || 1)),
            bands: { "<1k": +(bands[0] / tot).toFixed(2), "1-4k": +(bands[1] / tot).toFixed(2), "4-8k": +(bands[2] / tot).toFixed(2), ">8k": +(bands[3] / tot).toFixed(2) },
          });
        }, seconds * 1000);
      }),
  };
}
