"use client";

import { Play, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useState } from "react";
import type { DrawResults as Results } from "@/lib/contest";
import { SlideVideo } from "../media/MediaLightbox";
import { InstagramIcon, TikTokIcon } from "../questionnaire/SocialCards";

export const hasDrawResults = (r: Results) => !!(r.video_url || r.instagram_url || r.tiktok_url);

const postClass =
  "inline-flex min-h-12 items-center gap-2.5 rounded-full border border-edge bg-surface/85 py-1.5 pl-1.5 pr-5 text-base font-bold text-fg shadow-lg shadow-black/25 backdrop-blur transition-[transform,background-color] hover:-translate-y-0.5 hover:bg-surface";

/**
 * Résultats du tirage (concours terminé) : vidéo du tirage dans une modale, liens vers les posts
 * Instagram / TikTok. La vidéo n'est téléchargée qu'à la lecture (affiche servie par le cache Vercel).
 */
export function DrawResults({ results, className = "" }: { results: Results; className?: string }) {
  const [open, setOpen] = useState(false);
  if (!hasDrawResults(results)) return null;

  return (
    <div className={`flex flex-col items-center gap-4 ${className}`}>
      {results.video_url && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex min-h-14 items-center gap-3 rounded-full border-2 border-brand bg-black/55 py-2 pl-2 pr-7 text-lg font-bold text-fg shadow-[0_0_30px_rgba(250,204,21,0.25)] backdrop-blur transition-[box-shadow,background-color] hover:bg-black/70 hover:shadow-[0_0_44px_rgba(250,204,21,0.4)] day:bg-surface/85 sm:text-xl"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-black">
            <Play className="ml-0.5 h-5 w-5" fill="currentColor" aria-hidden />
          </span>
          Voir la vidéo du tirage
        </button>
      )}
      {(results.instagram_url || results.tiktok_url) && (
        <div className="flex flex-wrap justify-center gap-3">
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
      )}

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
                <SlideVideo src={results.video_url} active={open} />
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </div>
  );
}
