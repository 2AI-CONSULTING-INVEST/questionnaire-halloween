import { ArrowRight, Trophy } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { isLocalMedia } from "@/lib/schema";

export type Winner = { id: string; name: string; image_url: string | null; pseudo: string };

/** Flou progressif : chaque couche, plus floue, ne couvre que la suite de la précédente (rayon en px, début et fin du masque en %). */
const BLUR_LAYERS = [
  [1, 0, 30],
  [3, 15, 50],
  [6, 35, 70],
  [12, 55, 100],
] as const;

/** Accueil : début de la liste des gagnants ; le reste est sur la page du tirage, dans le carrousel des lots. */
export function WinnersPreview({ winners }: { winners: Winner[] }) {
  return (
    <Link
      href="/participants#prizes"
      className="flex w-full max-w-sm flex-col rounded-2xl border border-[#f5c542]/70 bg-surface/90 p-4 text-left shadow-[0_0_28px_rgba(245,197,66,0.18)] backdrop-blur-sm transition-shadow hover:shadow-[0_0_40px_rgba(245,197,66,0.35)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/60"
    >
      <span className="flex items-center gap-2 text-base font-bold uppercase leading-snug tracking-wide text-[#f5c542] day:text-[#4a2600]">
        <Trophy className="h-5 w-5 shrink-0" aria-hidden /> Les lots et les gagnants du tirage au sort
      </span>
      {/* Grand écran : sans hauteur propre, la liste prend celle de la colonne vidéo. */}
      <span className={`relative my-3 flex flex-col gap-3 overflow-hidden ${winners.length > 2 ? "h-52 sm:h-auto sm:min-h-0 sm:grow sm:basis-0" : ""}`}>
        {winners.map((w) => (
          <span key={w.id} className="flex shrink-0 items-center gap-3">
            <span className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-2 text-3xl">
              {w.image_url ? <Image src={w.image_url} alt="" fill sizes="56px" unoptimized={isLocalMedia(w.image_url)} className="object-cover" /> : <span aria-hidden>🎁</span>}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-base font-extrabold text-fg">{w.pseudo}</span>
              <span className="block truncate text-sm text-fg-muted">{w.name}</span>
            </span>
          </span>
        ))}
        {winners.length > 2 && (
          <span aria-hidden className="absolute inset-x-0 bottom-0 h-28">
            {BLUR_LAYERS.map(([px, from, to]) => {
              const mask = `linear-gradient(to bottom, transparent ${from}%, black ${to}%)`;
              return <span key={px} className="absolute inset-0" style={{ backdropFilter: `blur(${px}px)`, WebkitBackdropFilter: `blur(${px}px)`, maskImage: mask, WebkitMaskImage: mask }} />;
            })}
            <span className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-surface" />
          </span>
        )}
      </span>
      <span className="inline-flex items-center gap-1.5 text-base font-bold text-fg underline decoration-brand decoration-2 underline-offset-4">
        Voir {winners.length > 1 ? `les ${winners.length} gagnants` : "le gagnant"} et les lots <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
      </span>
    </Link>
  );
}
