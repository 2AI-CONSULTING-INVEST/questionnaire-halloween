import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Trophy } from "lucide-react";
import { SocialCards } from "@/components/questionnaire/SocialCards";
import { Emoji } from "@/components/questionnaire/ui";
import { getStore } from "@/lib/db";
import { withBase } from "@/lib/base-path";
import { isLocalMedia } from "@/lib/schema";
import { OG_BASE, PARTICIPANTS } from "@/lib/site";
import { ParticipantsList } from "./ParticipantsList";

// Liste régénérée au plus toutes les 60 s, et immédiatement après une inscription ou une
// modification dans le backoffice (revalidatePath). L'image d'aperçu est celle de l'accueil.
export const revalidate = 60;

export const metadata: Metadata = {
  title: PARTICIPANTS.title,
  description: PARTICIPANTS.description,
  // Next ne préfixe pas canonical / og:url par basePath.
  alternates: { canonical: withBase("/participants") },
  openGraph: { ...OG_BASE, url: withBase("/participants"), title: PARTICIPANTS.shareTitle, description: PARTICIPANTS.shareDescription },
  twitter: { card: "summary_large_image", title: PARTICIPANTS.shareTitle, description: PARTICIPANTS.shareDescription },
};

const card = "rounded-2xl border border-edge bg-surface/90 shadow-lg shadow-black/25 backdrop-blur-sm day:shadow-black/10";

export default async function ParticipantsPage() {
  const store = getStore();
  const [participants, prizes] = await Promise.all([store.listParticipants(), store.listPrizes()]);
  // Seuls les pseudos quittent le serveur : jamais d'email ni de téléphone.
  const pseudos = participants.map((p) => ({ id: p.id, pseudo: p.pseudo }));
  const pseudoOf = new Map(pseudos.map((p) => [p.id, p.pseudo]));
  const winners = prizes
    .filter((p) => p.winner_participant_id && pseudoOf.has(p.winner_participant_id))
    .map((p) => ({ prize: p, pseudo: pseudoOf.get(p.winner_participant_id!)! }));
  const count = participants.length;

  return (
    <main className="relative z-10 mx-auto max-w-3xl px-4 pb-24 pt-[max(1rem,env(safe-area-inset-top))] sm:px-8">
      <Link
        href="/"
        className="mt-2 inline-flex min-h-10 items-center gap-1 rounded-full bg-black/40 px-3 text-sm text-white/85 backdrop-blur transition-colors hover:text-white day:bg-white/60 day:text-fg"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> Retour au vote
      </Link>

      <header className="mt-6 text-center sm:mt-8">
        <h1 className="text-3xl leading-tight tracking-tight text-fg [text-shadow:0_2px_24px_rgba(0,0,0,0.45)] sm:text-5xl day:[text-shadow:none]">
          <Emoji name="trophy" size={56} priority className="mr-2 h-[1em] w-[1em]" />
          Tirage au sort Halloween
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-fg-muted sm:text-lg">
          <strong className="text-fg">{count.toLocaleString("fr-FR")}</strong> participant{count > 1 ? "s" : ""} inscrit{count > 1 ? "s" : ""} · le tirage
          sera effectué en direct sur nos réseaux sociaux.
        </p>
      </header>

      {winners.length > 0 && (
        <section aria-labelledby="winners" className="mt-10">
          <h2 id="winners" className="flex items-center justify-center gap-2 text-xl font-extrabold uppercase tracking-wider text-brand sm:text-2xl">
            <Trophy className="h-6 w-6" aria-hidden /> Les gagnants
          </h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {winners.map(({ prize, pseudo }) => (
              <li
                key={prize.id}
                className={`${card} flex items-center gap-4 border-[#f5c542]/70 p-3 ring-1 ring-[#f5c542]/40 shadow-[0_0_28px_rgba(245,197,66,0.18)]`}
              >
                <PrizeThumb url={prize.image_url} name={prize.name} className="h-20 w-20 shrink-0 rounded-xl" sizes="80px" />
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm font-bold uppercase leading-snug text-[#f5c542]">{prize.name}</p>
                  <p className="mt-1 text-base text-fg-muted">
                    <span aria-hidden>🎉</span> Gagné par <span className="font-extrabold text-fg">{pseudo}</span>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="prizes" className="mt-10">
        <h2 id="prizes" className="text-xl font-extrabold text-fg sm:text-2xl">
          Les lots à gagner
        </h2>
        {prizes.length === 0 ? (
          <p className={`${card} mt-4 px-5 py-8 text-center text-base text-fg-muted`}>Les lots seront dévoilés très bientôt 🎁</p>
        ) : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {prizes.map((p) => (
              <li key={p.id} className={`${card} overflow-hidden`}>
                <PrizeThumb url={p.image_url} name={p.name} className="aspect-[4/3] w-full" sizes="(max-width: 640px) calc(100vw - 2rem), (max-width: 1024px) 50vw, 33vw" />
                <div className="p-4">
                  <h3 className="text-base font-bold text-fg">{p.name}</h3>
                  {p.description && <p className="mt-1 text-sm leading-snug text-fg-muted">{p.description}</p>}
                  {p.winner_participant_id && pseudoOf.has(p.winner_participant_id) && (
                    <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-[#f5c542]">Gagné par {pseudoOf.get(p.winner_participant_id)}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="participants" className="mt-10">
        <h2 id="participants" className="text-xl font-extrabold text-fg sm:text-2xl">
          Les participants ({count.toLocaleString("fr-FR")})
        </h2>
        <p className="mt-1 text-sm text-fg-muted">Du plus récent au plus ancien. Seul le pseudonyme est affiché.</p>
        <div className={`${card} mt-4 p-4 sm:p-5`}>
          <ParticipantsList participants={pseudos} />
        </div>
      </section>

      <section className="mt-12 flex flex-col items-center">
        <p className="mb-4 text-sm text-fg-muted">Ne ratez pas le tirage en direct&nbsp;:</p>
        <SocialCards />
      </section>
    </main>
  );
}

/** Vignette d'un lot (image optimisée, chargée à l'approche de l'écran) ou tuile cadeau. */
function PrizeThumb({ url, name, className, sizes }: { url: string | null; name: string; className: string; sizes: string }) {
  return (
    <div className={`relative overflow-hidden bg-surface-2 ${className}`}>
      {url ? (
        <Image src={url} alt={name} fill sizes={sizes} unoptimized={isLocalMedia(url)} className="object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-4xl" aria-hidden>
          🎁
        </span>
      )}
    </div>
  );
}
