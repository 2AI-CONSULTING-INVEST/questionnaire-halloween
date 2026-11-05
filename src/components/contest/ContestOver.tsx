"use client";

import Link from "next/link";
import { useEffect } from "react";
import { drawPublished, type DrawResults as Results } from "@/lib/contest";
import { setNextVote } from "@/lib/next-vote";
import { Emoji } from "../questionnaire/ui";
import { SocialCards } from "../questionnaire/SocialCards";
import { DrawResults, hasDrawResults } from "./DrawResults";
import { WinnersPreview, type Winner } from "./WinnersPreview";

/**
 * Accueil une fois le concours terminé (backoffice, onglet « Concours ») : décor de la clairière
 * de la faucheuse (SpookyBackdrop), « LE CHAMAS GAGNANT EST... » vers la crypte, résultats du tirage.
 */
export function ContestOver({ results, winners }: { results: Results; winners: Winner[] }) {
  const published = drawPublished(results);
  // Plus de vote : plus de compte à rebours « prochain vote » mémorisé sur l'appareil.
  useEffect(() => setNextVote(null, false), []);

  return (
    <main className="relative z-10 flex min-h-dvh flex-1 items-center px-4 py-24 sm:px-6 md:px-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center text-center">
        <div className="w-full rounded-3xl bg-page/55 px-3 py-5 backdrop-blur-sm sm:bg-transparent sm:p-0 sm:backdrop-blur-none day:bg-transparent day:backdrop-blur-none">
          <h1 className="text-4xl leading-[1.15] tracking-tight text-fg [text-shadow:0_2px_24px_rgba(0,0,0,0.45)] sm:text-6xl day:[text-shadow:none]">
            <Emoji name="pumpkin" size={64} priority className="mr-3 h-[1em] w-[1em]" />
            Le concours est{" "}
            {/* Le fantôme ne passe jamais seul à la ligne. */}
            <span className="whitespace-nowrap">
              terminé&nbsp;!
              <Emoji name="ghost" size={64} priority className="ml-3 h-[1em] w-[1em]" />
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-fg-muted sm:text-xl">
            Merci à toutes et à tous pour vos votes et votre participation&nbsp;!{" "}
            {published
              ? "Le tirage au sort a été effectué : découvrez la vidéo et les gagnants !"
              : "Le tirage au sort va être effectué. Rendez-vous sur nos réseaux sociaux : la vidéo y sera publiée !"}
          </p>
        </div>

        <Link
          href="/resultats"
          className="mt-8 inline-flex min-h-12 items-center rounded-full bg-brand px-7 py-2 text-center text-lg font-bold tracking-wide text-black shadow-[0_0_30px_rgba(250,204,21,0.35)] transition-[filter,box-shadow] hover:brightness-105 hover:shadow-[0_0_44px_rgba(250,204,21,0.5)] active:brightness-95 sm:min-h-16 sm:px-10 sm:text-2xl"
        >
          LE CHAMAS GAGNANT EST...
        </Link>

        {hasDrawResults(results) && <DrawResults results={results} aside={winners.length > 0 && <WinnersPreview winners={winners} />} className="mt-8" />}
        {!published && <SocialCards className="mt-8" />}

        {/* Avec des gagnants, leur carte mène déjà à cette page. */}
        {winners.length === 0 && (
          <Link href="/participants" className="mt-6 inline-flex min-h-11 items-center text-base font-semibold text-fg underline decoration-brand decoration-2 underline-offset-4 hover:text-brand">
            Les lots et les participants du tirage
          </Link>
        )}
      </div>
    </main>
  );
}
