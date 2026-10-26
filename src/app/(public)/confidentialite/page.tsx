import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { withBase } from "@/lib/base-path";

export const metadata: Metadata = {
  title: "Confidentialité",
  description: "Données collectées par le vote Halloween Chamas Tacos, finalités, durées de conservation, cookies et droits.",
  alternates: { canonical: withBase("/confidentialite") },
};

const card = "rounded-2xl border border-edge bg-surface/90 p-5 shadow-lg shadow-black/25 backdrop-blur-sm day:shadow-black/10 sm:p-7";
const h2 = "text-lg font-semibold text-fg";
const p = "mt-2 text-sm leading-relaxed text-fg-muted";
const ul = "mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-fg-muted";

/** Information des visiteurs (RGPD) : données, finalités, durées (supabase/purge.sql), droits, cookies. Statique. */
export default function PrivacyPage() {
  return (
    <main className="relative z-10 mx-auto max-w-3xl px-4 pb-16 pt-[max(1rem,env(safe-area-inset-top))] sm:px-8">
      <Link
        href="/"
        className="mt-2 inline-flex min-h-10 items-center gap-1 rounded-full bg-black/40 px-3 text-sm text-white/85 backdrop-blur transition-colors hover:text-white day:bg-surface/75 day:text-fg"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> Retour au vote
      </Link>

      <header className="mt-6 sm:mt-8">
        <h1 className="text-3xl leading-tight tracking-tight text-fg [text-shadow:0_2px_24px_rgba(0,0,0,0.45)] sm:text-4xl day:[text-shadow:none]">Confidentialité</h1>
        <p className="mt-3 text-base text-fg-muted">Ce que le vote Halloween Chamas Tacos enregistre, pourquoi, combien de temps, et vos droits.</p>
      </header>

      <div className="mt-6 flex flex-col gap-4">
        <section className={card}>
          <h2 className={h2}>Responsable du traitement</h2>
          <p className={p}>
            Chamas Tacos — CT VILLENEUVE (SIREN 938&nbsp;771&nbsp;375), 1 rue Trudaine, 59650 Villeneuve-d&apos;Ascq, France. Contact&nbsp;: restos.gestion@gmail.com. Le site est hébergé par Vercel et les
            données sont stockées chez Supabase (Union européenne).
          </p>
        </section>

        <section className={card}>
          <h2 className={h2}>Finalités</h2>
          <ul className={ul}>
            <li>
              <strong className="text-fg">Vote</strong>&nbsp;: compter un vote par appareil et par jour pour la meilleure décoration.
            </li>
            <li>
              <strong className="text-fg">Anti-fraude</strong>&nbsp;: détecter les votes répétés (empreinte d&apos;appareil non réversible, adresse IP, score de risque).
            </li>
            <li>
              <strong className="text-fg">Tirage au sort</strong>&nbsp;: contacter le gagnant, garantir une participation par personne.
            </li>
            <li>
              <strong className="text-fg">Statistiques de visite</strong>&nbsp;: compter les visites du site, robots écartés, sans suivi individuel.
            </li>
          </ul>
        </section>

        <section className={card}>
          <h2 className={h2}>Données collectées</h2>
          <ul className={ul}>
            <li>
              <strong className="text-fg">Vote</strong> (table des réponses)&nbsp;: restaurant préféré, décoration choisie, commentaire facultatif, choix du tirage, jour du vote, dates
              de création et de validation, identifiant aléatoire de l&apos;appareil (cookie), adresse IP, navigateur (agent utilisateur), empreinte d&apos;appareil
              (condensé HMAC non réversible), attributs grossiers de l&apos;appareil (téléphone ou ordinateur, plateforme, taille d&apos;écran, tactile, navigateur), score et
              signaux de risque.
            </li>
            <li>
              <strong className="text-fg">Tirage au sort</strong> (table des participants)&nbsp;: pseudonyme (affiché publiquement), prénom et nom facultatifs, adresse email,
              numéro de téléphone, date d&apos;inscription. Email, téléphone, prénom et nom ne sont jamais publiés.
            </li>
            <li>
              <strong className="text-fg">Visites</strong>&nbsp;: jour, page, site de provenance (nom de domaine seulement), adresse IP, navigateur, empreinte et attributs grossiers
              de l&apos;appareil.
            </li>
            <li>
              <strong className="text-fg">Backoffice</strong> (équipe Chamas Tacos)&nbsp;: adresse IP, navigateur, position approximative déduite de l&apos;IP et journal des actions
              de chaque connexion&nbsp;; adresse IP des tentatives de connexion échouées.
            </li>
          </ul>
          <p className={p}>
            Rien d&apos;autre&nbsp;: aucune permission n&apos;est demandée au navigateur (position, contacts, photos…), aucune donnée brute d&apos;empreinte n&apos;est envoyée ni
            stockée, aucun service tiers de suivi ou de publicité n&apos;est chargé.
          </p>
        </section>

        <section className={card}>
          <h2 className={h2}>Durées de conservation</h2>
          <ul className={ul}>
            <li>Adresse IP, navigateur et attributs d&apos;appareil des votes&nbsp;: effacés 30 jours après le vote.</li>
            <li>Visites&nbsp;: supprimées après 90 jours.</li>
            <li>Journal du backoffice&nbsp;: supprimé après 180 jours&nbsp;; tentatives de connexion échouées&nbsp;: après 30 jours.</li>
            <li>Votes (sans IP ni navigateur) et participants au tirage&nbsp;: jusqu&apos;à la fin de l&apos;opération et la remise des lots.</li>
          </ul>
        </section>

        <section className={card}>
          <h2 className={h2}>Vos droits</h2>
          <p className={p}>
            Vous pouvez demander l&apos;accès, la rectification ou la suppression de vos données (par exemple votre inscription au tirage) en écrivant au contact ci-dessus.
            Vous pouvez aussi saisir la CNIL (cnil.fr).
          </p>
        </section>

        <section className={card}>
          <h2 className={h2}>Cookies</h2>
          <ul className={ul}>
            <li>
              <code className="text-fg">hw_voter</code>&nbsp;: identifiant aléatoire de l&apos;appareil, posé à l&apos;ouverture du vote, nécessaire à la règle « un vote par jour »
              (60 jours, jamais lu par un script, aucune donnée personnelle).
            </li>
            <li>
              <code className="text-fg">chamas_admin</code>&nbsp;: session du backoffice, réservée à l&apos;équipe Chamas Tacos (12 heures).
            </li>
          </ul>
          <p className={p}>
            Le navigateur garde aussi vos réponses en cours dans son stockage local, sur votre appareil seulement. Aucun cookie tiers, aucune mesure d&apos;audience
            externe.
          </p>
        </section>
      </div>
    </main>
  );
}
