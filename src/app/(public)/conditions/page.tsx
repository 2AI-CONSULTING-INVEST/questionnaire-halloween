import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { withBase } from "@/lib/base-path";

export const metadata: Metadata = {
  title: "Conditions d'utilisation",
  description: "Règles du vote Halloween Chamas Tacos et du tirage au sort : participation, lots, désignation des gagnants, responsabilités.",
  alternates: { canonical: withBase("/conditions") },
};

const card = "rounded-2xl border border-edge bg-surface/90 p-5 shadow-lg shadow-black/25 backdrop-blur-sm day:shadow-black/10 sm:p-7";
const h2 = "text-lg font-semibold text-fg";
const p = "mt-2 text-sm leading-relaxed text-fg-muted";
const ul = "mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-fg-muted";

/** Conditions d'utilisation du vote et règlement du tirage au sort, acceptées à la confirmation de l'inscription. Statique. */
export default function TermsPage() {
  return (
    <main className="relative z-10 mx-auto max-w-3xl px-4 pb-16 pt-[max(1rem,env(safe-area-inset-top))] sm:px-8">
      <Link
        href="/"
        className="mt-2 inline-flex min-h-10 items-center gap-1 rounded-full bg-black/40 px-3 text-sm text-white/85 backdrop-blur transition-colors hover:text-white day:bg-surface/75 day:text-fg"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> Retour au vote
      </Link>

      <header className="mt-6 sm:mt-8">
        <h1 className="text-3xl leading-tight tracking-tight text-fg [text-shadow:0_2px_24px_rgba(0,0,0,0.45)] sm:text-4xl day:[text-shadow:none]">
          Conditions d&apos;utilisation
        </h1>
        <p className="mt-3 text-base text-fg-muted">Les règles du vote Halloween Chamas Tacos et de son tirage au sort.</p>
      </header>

      <div className="mt-6 flex flex-col gap-4">
        <section className={card}>
          <h2 className={h2}>1. Organisateur</h2>
          <p className={p}>
            Le vote et le tirage au sort sont organisés par CT VILLENEUVE (SIREN 938&nbsp;771&nbsp;375), 1 rue Trudaine, 59650 Villeneuve-d&apos;Ascq, France, pour les
            restaurants Chamas Tacos participants. Contact&nbsp;: restos.gestion@gmail.com.
          </p>
        </section>

        <section className={card}>
          <h2 className={h2}>2. Objet</h2>
          <p className={p}>
            Ce site permet d&apos;élire le restaurant Chamas Tacos le mieux décoré pour Halloween et, pour qui le souhaite, de participer à un tirage au sort gratuit,
            sans obligation d&apos;achat. L&apos;utilisation du site vaut acceptation des présentes conditions.
          </p>
        </section>

        <section className={card}>
          <h2 className={h2}>3. Le vote</h2>
          <ul className={ul}>
            <li>Le vote est ouvert pendant la période annoncée par l&apos;organisateur, dans les restaurants et sur ses réseaux.</li>
            <li>Un seul vote par appareil et par jour (heure de Paris). Le vote est compté dès sa validation, avant le tirage au sort.</li>
            <li>
              Les votes répétés, automatisés ou obtenus par un procédé déloyal sont détectés et peuvent être refusés ou exclus du classement, sans préavis.
            </li>
            <li>Le classement est publié sur le site. L&apos;organisateur arrête le résultat final à la clôture du vote.</li>
          </ul>
        </section>

        <section className={card}>
          <h2 className={h2}>4. Le tirage au sort</h2>
          <ul className={ul}>
            <li>Participation gratuite, réservée aux personnes physiques majeures résidant en France. Une seule participation par personne.</li>
            <li>
              L&apos;inscription demande un pseudonyme, une adresse email et un numéro de téléphone exacts&nbsp;; prénom et nom sont facultatifs. Une inscription
              avec des coordonnées inexactes, incomplètes ou appartenant à un tiers peut être écartée.
            </li>
            <li>
              Le pseudonyme est affiché publiquement sur la page du tirage. L&apos;organisateur peut modifier ou retirer un pseudonyme injurieux, trompeur ou
              contraire à la loi.
            </li>
            <li>Les lots à gagner sont présentés sur la page du tirage. Ils ne sont ni échangeables, ni remboursables, ni convertibles en argent.</li>
            <li>
              Les gagnants sont désignés par tirage au sort parmi les inscrits, à la date annoncée par l&apos;organisateur, puis contactés par téléphone ou par
              email. Un gagnant qui ne répond pas dans les 15 jours suivant le premier contact perd le bénéfice de son lot, qui peut être réattribué.
            </li>
            <li>Les salariés des restaurants participants et de l&apos;organisateur ne peuvent pas gagner de lot.</li>
          </ul>
        </section>

        <section className={card}>
          <h2 className={h2}>5. Données personnelles</h2>
          <p className={p}>
            Les coordonnées servent uniquement au tirage au sort et à contacter les gagnants&nbsp;; elles ne sont jamais publiées. Les données collectées, leurs
            durées de conservation et vos droits sont détaillés dans la{" "}
            <Link href="/confidentialite" className="underline underline-offset-2 hover:text-fg">
              politique de confidentialité
            </Link>
            .
          </p>
        </section>

        <section className={card}>
          <h2 className={h2}>6. Responsabilité</h2>
          <p className={p}>
            L&apos;organisateur peut suspendre, modifier ou annuler le vote ou le tirage au sort en cas de fraude, de problème technique ou de force majeure, sans
            que sa responsabilité puisse être engagée. Il ne répond pas des indisponibilités du site, du réseau ou des appareils des participants.
          </p>
        </section>

        <section className={card}>
          <h2 className={h2}>7. Droit applicable</h2>
          <p className={p}>
            Les présentes conditions sont soumises au droit français. Toute question ou réclamation s&apos;adresse d&apos;abord au contact ci-dessus.
          </p>
        </section>
      </div>
    </main>
  );
}
