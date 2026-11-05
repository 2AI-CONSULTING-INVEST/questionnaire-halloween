"use client";

import { Play, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useState, type ReactNode } from "react";
import type { DrawResults as Results } from "@/lib/contest";
import { posterOf } from "@/lib/schema";
import { optimizedPoster } from "../media/poster";
import { VideoPlayer } from "../media/VideoPlayer";
import { InstagramIcon, TikTokIcon } from "../questionnaire/SocialCards";

export const hasDrawResults = (r: Results) => !!(r.video_url || r.instagram_url || r.tiktok_url);

const postClass =
  "inline-flex min-h-12 items-center gap-2.5 rounded-full border border-edge bg-surface/85 py-1.5 pl-1.5 pr-5 text-base font-bold text-fg shadow-lg shadow-black/25 backdrop-blur transition-[transform,background-color] hover:-translate-y-0.5 hover:bg-surface";

/**
 * Résultats du tirage (concours terminé) : aperçu vertical façon reel qui ouvre la vidéo dans une modale,
 * liens vers les posts Instagram / TikTok juste dessous. `aside` : affiché après l'aperçu et les liens. La vidéo n'est téléchargée qu'à la lecture (affiche servie par le cache Vercel).
 */
export function DrawResults({ results, aside, className = "" }: { results: Results; aside?: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  if (!hasDrawResults(results)) return null;

  const posts = (results.instagram_url || results.tiktok_url) && (
    <div className={`flex gap-3 ${results.video_url ? "flex-col items-center" : "flex-wrap justify-center"}`}>
      {results.instagram_url && (
        <a href={results.instagram_url} target="_blank" rel="noopener noreferrer" className={postClass}>
          <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-full bg-[linear-gradient(45deg,#f9ce34_0%,#ee2a7b_50%,#6228d7_100%)]">
            <InstagramIcon className="h-5 w-5" />
          </span>
          Le post Instagram
        </a>
      )}
      {results.tiktok_url && (
        <a href={results.tiktok_url} target="_blank" rel="noopener noreferrer" className={postClass}>
          <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-full bg-black">
            <TikTokIcon className="h-5 w-5" />
          </span>
          La vidéo TikTok
        </a>
      )}
    </div>
  );

  return (
    <div className={`flex flex-col items-center gap-4 ${className}`}>
      {results.video_url && (
        <div className="flex w-full flex-col items-center justify-center gap-6 sm:flex-row sm:items-stretch">
          <div className="flex shrink-0 flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="group relative aspect-[9/16] w-[168px] shrink-0 overflow-hidden sm:w-56 rounded-2xl border-2 border-brand bg-[linear-gradient(160deg,#3b1d5e,#120a1c)] text-left text-white shadow-[0_0_30px_rgba(250,204,21,0.25)] transition-shadow hover:shadow-[0_0_44px_rgba(250,204,21,0.45)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/60"
            >
              {/* Affiche seule (cache Vercel) : la vidéo n'est téléchargée qu'à la lecture. Sans affiche : le dégradé du bouton. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={optimizedPoster(posterOf(results.video_url), 320)} alt="" loading="lazy" onError={(e) => (e.currentTarget.hidden = true)} className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
              <span aria-hidden className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.8),transparent_45%)]" />
              <span className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 backdrop-blur-sm transition-transform group-hover:scale-110">
                <Play className="ml-1 h-8 w-8" fill="currentColor" aria-hidden />
              </span>
              <span className="absolute inset-x-3 bottom-3 block text-base font-bold leading-snug">Voir la vidéo du tirage</span>
            </button>
            {posts}
          </div>
          {aside}
        </div>
      )}
      {!results.video_url && posts}
      {results.video_url && (
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-black/92 backdrop-blur-sm data-[state=open]:animate-[fade-in_200ms_ease-out]" />
            <Dialog.Content aria-describedby={undefined} className="fixed inset-0 z-50 flex flex-col overflow-hidden text-white outline-none">
              <header className="flex items-center gap-3 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
                <Dialog.Title className="min-w-0 flex-1 truncate text-base font-semibold uppercase tracking-wide">Tirage au sort Halloween</Dialog.Title>
                <Dialog.Close aria-label="Fermer" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20">
                  <X className="h-6 w-6" />
                </Dialog.Close>
              </header>
              <div className="relative min-h-0 flex-1 px-2 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-16">
                <VideoPlayer src={results.video_url} active={open} label="Vidéo du tirage au sort" />
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </div>
  );
}
