"use client";

import { Loader2, Maximize, Minimize, Pause, Play, RotateCcw, Volume2, VolumeX, VideoOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { bindVideoVolume, holdSound } from "@/components/sound/engine";
import { posterOf } from "@/lib/schema";
import { optimizedPoster } from "./poster";

const clock = (s: number) => {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};

const HIDE_AFTER_MS = 2500;
const barButton = "flex h-9 w-9 shrink-0 @xs:h-10 @xs:w-10 items-center justify-center rounded-full text-white transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-brand";

/** Piste jaune du site, posée sous un vrai curseur natif invisible (clavier, lecteurs d'écran, tactile). */
function Slider({ label, value, max, step, text, buffered, disabled, onChange, className = "" }: { label: string; value: number; max: number; step: number; text: string; buffered?: number; disabled?: boolean; onChange: (v: number) => void; className?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className={`group/slider relative flex h-6 items-center ${className}`}>
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/25 transition-[height] group-hover/slider:h-2">
        {buffered !== undefined && max > 0 && <div className="absolute inset-y-0 left-0 bg-white/35" style={{ width: `${Math.min(100, (buffered / max) * 100)}%` }} />}
        <div className="absolute inset-y-0 left-0 bg-brand" style={{ width: `${pct}%` }} />
      </div>
      <span aria-hidden className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 rounded-full bg-brand shadow-[0_0_10px_rgba(250,204,21,0.7)]" style={{ left: `${pct}%` }} />
      {/* touch-none : glisser sur le curseur ne fait pas défiler la galerie qui contient la vidéo. */}
      <input
        type="range"
        aria-label={label}
        aria-valuetext={text}
        min={0}
        max={max || 1}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="absolute inset-0 h-full w-full cursor-pointer touch-none opacity-0 disabled:cursor-default"
      />
    </div>
  );
}

/**
 * Lecteur vidéo du site : mêmes commandes partout, aux couleurs du site. Son cadre prend exactement
 * le format de la vidéo et tient dans l'espace disponible : le parent impose la taille, ou `maxHeight`
 * limite la hauteur quand la page défile. `poster={null}` : pas d'affiche (vidéo hors de notre stockage).
 * Avec preload="none", rien n'est téléchargé avant la lecture (egress) : l'affiche donne le format.
 */
export function VideoPlayer({
  src,
  active = true,
  poster,
  preload = "none",
  maxHeight,
  label = "Vidéo",
  onAspect,
}: {
  src: string;
  active?: boolean;
  poster?: string | null;
  preload?: "none" | "metadata";
  maxHeight?: string;
  label?: string;
  onAspect?: (ratio: number) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const pointer = useRef("mouse");
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const holding = useRef(false);
  const [aspect, setAspect] = useState(16 / 9);
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [controls, setControls] = useState(true);

  const posterUrl = poster === undefined ? optimizedPoster(posterOf(src), 540) : poster;

  const hold = (on: boolean) => {
    if (holding.current === on) return;
    holding.current = on;
    holdSound(on);
  };
  const applyAspect = useCallback(
    (w: number, h: number) => {
      if (!w || !h) return;
      setAspect(w / h);
      onAspect?.(w / h);
    },
    [onAspect],
  );

  useEffect(() => {
    if (!active) video.current?.pause();
  }, [active]);
  useEffect(() => () => hold(false), []);
  useEffect(() => () => clearTimeout(hideTimer.current), []);
  useEffect(() => (video.current ? bindVideoVolume(video.current) : undefined), [failed]);

  useEffect(() => {
    if (!posterUrl) return;
    const img = new Image();
    img.onload = () => {
      // Le format réel de la vidéo, une fois connu, a priorité sur celui de l'affiche.
      if (!video.current?.videoWidth) applyAspect(img.naturalWidth, img.naturalHeight);
    };
    img.src = posterUrl;
    return () => {
      img.onload = null;
    };
  }, [posterUrl, applyAspect]);

  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement && document.fullscreenElement === box.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  /** Commandes visibles, puis masquées après un moment sans geste pendant la lecture. */
  const reveal = () => {
    setControls(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (!video.current?.paused) setControls(false);
    }, HIDE_AFTER_MS);
  };

  const togglePlay = () => {
    const v = video.current;
    if (!v) return;
    if (v.paused) {
      setStarted(true);
      box.current?.focus({ preventScroll: true }); // le gros bouton disparaît : le clavier reste sur le lecteur
      void v.play().catch((e: Error) => {
        // Lecture refusée par le navigateur (geste requis, économie d'énergie) : la vidéo reste lisible au prochain appui.
        if (e.name !== "NotAllowedError" && e.name !== "AbortError") setFailed(true);
      });
    } else v.pause();
  };
  const seek = (s: number) => {
    const v = video.current;
    if (!v || !duration) return;
    v.currentTime = Math.max(0, Math.min(duration, s));
    setTime(v.currentTime);
    setEnded(false);
  };
  const toggleMute = () => {
    if (video.current) video.current.muted = !video.current.muted;
  };
  const changeVolume = (value: number) => {
    const v = video.current;
    if (!v) return;
    v.volume = value;
    v.muted = value === 0;
  };
  const toggleFullscreen = () => {
    const v = video.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (document.fullscreenElement) void document.exitFullscreen();
    else if (box.current?.requestFullscreen) void box.current.requestFullscreen();
    else v?.webkitEnterFullscreen?.(); // iPhone : seul le plein écran natif de la vidéo existe
  };

  const onSurface = () => {
    // Au doigt, un premier appui montre les commandes ; à la souris, il lance ou met en pause.
    if (pointer.current !== "mouse" && started && !controls) return reveal();
    togglePlay();
    reveal();
  };
  const onKey = (e: KeyboardEvent) => {
    const onControl = (e.target as HTMLElement).tagName === "BUTTON" || (e.target as HTMLElement).tagName === "INPUT";
    let handled = true;
    if (e.key === " " || e.key === "k") {
      if (e.key === " " && (e.target as HTMLElement).tagName === "BUTTON") return;
      togglePlay();
    } else if (e.key === "m") toggleMute();
    else if (e.key === "f") toggleFullscreen();
    else if (e.key === "ArrowLeft" && !onControl) seek(time - 5);
    else if (e.key === "ArrowRight" && !onControl) seek(time + 5);
    else handled = false;
    if (handled) {
      e.preventDefault();
      e.stopPropagation(); // ne pas changer de média dans la galerie autour
      reveal();
    }
  };

  const frame = maxHeight ? "w-full [container-type:inline-size]" : "h-full w-full items-center [container-type:size]";

  if (failed) {
    return (
      <div className={`flex justify-center ${frame}`}>
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-8 text-center text-white/70">
          <VideoOff className="h-10 w-10" aria-hidden />
          <p>Cette vidéo ne peut pas être lue sur cet appareil.</p>
        </div>
      </div>
    );
  }

  const visible = controls || !playing;

  return (
    <div className={`flex justify-center ${frame}`}>
      <div
        ref={box}
        role="group"
        aria-label={label}
        tabIndex={0}
        onKeyDown={onKey}
        onPointerDown={(e: PointerEvent) => (pointer.current = e.pointerType)}
        onPointerMove={(e: PointerEvent) => e.pointerType === "mouse" && reveal()}
        className={`@container relative overflow-hidden rounded-xl bg-black outline-none focus-visible:ring-2 focus-visible:ring-brand ${playing && !visible ? "cursor-none" : ""}`}
        style={{ aspectRatio: aspect, width: `min(100cqw, calc(${maxHeight ?? "100cqh"} * ${aspect}))` }}
      >
        <video
          ref={video}
          src={src}
          poster={posterUrl ?? undefined}
          playsInline
          preload={preload}
          onClick={onSurface}
          onError={() => setFailed(true)}
          onLoadedMetadata={(e) => {
            applyAspect(e.currentTarget.videoWidth, e.currentTarget.videoHeight);
            setDuration(e.currentTarget.duration);
          }}
          onDurationChange={(e) => setDuration(e.currentTarget.duration)}
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          onProgress={(e) => {
            const b = e.currentTarget.buffered;
            if (b.length) setBuffered(b.end(b.length - 1));
          }}
          onPlay={() => {
            setStarted(true);
            setPlaying(true);
            setEnded(false);
            hold(true);
            reveal();
          }}
          onPause={() => {
            setPlaying(false);
            setControls(true);
            hold(false);
          }}
          onEnded={() => {
            setPlaying(false);
            setEnded(true);
            setControls(true);
            hold(false);
          }}
          onWaiting={() => setWaiting(true)}
          onPlaying={() => setWaiting(false)}
          onCanPlay={() => setWaiting(false)}
          onVolumeChange={(e) => {
            setMuted(e.currentTarget.muted);
            setVolume(e.currentTarget.volume);
          }}
          className="block h-full w-full object-contain"
        />

        {waiting && playing && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-14 w-14 animate-spin text-brand" aria-hidden />
          </span>
        )}

        {!playing && !waiting && (
          <button type="button" aria-label={ended ? "Revoir la vidéo" : "Lire la vidéo"} onClick={togglePlay} className="absolute inset-0 flex items-center justify-center outline-none [&:focus-visible>span]:ring-4 [&:focus-visible>span]:ring-white">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand text-black shadow-[0_0_40px_rgba(250,204,21,0.45)] transition-transform hover:scale-105 @md:h-20 @md:w-20">
              {ended ? <RotateCcw className="h-8 w-8" /> : <Play className="ml-1 h-8 w-8 @md:h-9 @md:w-9" fill="currentColor" />}
            </span>
          </button>
        )}

        {started && (
          <div
            className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent px-2 pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-8 transition-opacity duration-200 @md:px-3 pointer-events-none ${visible ? "opacity-100 [&>*]:pointer-events-auto" : "opacity-0"}`}
          >
            <Slider label="Position dans la vidéo" value={time} max={duration} step={0.1} text={`${clock(time)} sur ${clock(duration)}`} buffered={buffered} disabled={!duration} onChange={seek} className="mx-1" />
            <div className="flex items-center gap-0.5">
              <button type="button" aria-label={playing ? "Pause" : ended ? "Revoir la vidéo" : "Lecture"} onClick={togglePlay} className={barButton}>
                {playing ? <Pause className="h-5 w-5" fill="currentColor" /> : ended ? <RotateCcw className="h-5 w-5" /> : <Play className="h-5 w-5" fill="currentColor" />}
              </button>
              <button type="button" aria-label={muted ? "Remettre le son" : "Couper le son"} onClick={toggleMute} className={`${barButton} @max-[7.5rem]:hidden`}>
                {muted || volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </button>
              <Slider label="Volume" value={muted ? 0 : volume} max={1} step={0.05} text={`${Math.round((muted ? 0 : volume) * 100)} %`} onChange={changeVolume} className="mr-2 hidden w-20 @sm:flex" />
              <span className="ml-1 whitespace-nowrap text-xs font-medium tabular-nums text-white/90 @max-[12rem]:hidden @md:text-sm">
                {clock(time)}
                <span className="text-white/60 @max-[17rem]:hidden"> / {clock(duration)}</span>
              </span>
              <button type="button" aria-label={fullscreen ? "Quitter le plein écran" : "Plein écran"} onClick={toggleFullscreen} className={`${barButton} ml-auto`}>
                {fullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
