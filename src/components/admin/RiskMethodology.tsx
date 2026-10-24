"use client";

import { BookOpen, ChevronDown, Cookie, EyeOff, Fingerprint, Gauge, ShieldCheck, Smartphone } from "lucide-react";
import { IP_POINTS_MAX, RISK_SIGNAL_ORDER, RISK_SIGNALS, type RiskSettings } from "@/lib/risk";
import { Badge, Card } from "./ui";

const n = (v: number) => v.toLocaleString("fr-FR");

function Step({ no, icon, title, children }: { no: number; icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <li className="relative pl-12">
      <span className="absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full bg-brand text-sm font-bold text-ink" aria-hidden>
        {no}
      </span>
      <h4 className="flex items-center gap-2 text-sm font-semibold text-ink dark:text-zinc-100">
        <span className="text-muted dark:text-zinc-400" aria-hidden>
          {icon}
        </span>
        {title}
      </h4>
      <div className="mt-1 text-sm leading-relaxed text-muted dark:text-zinc-400">{children}</div>
    </li>
  );
}

function Callout({ tone, title, children }: { tone: "ok" | "warn" | "danger"; title: string; children: React.ReactNode }) {
  const cls = {
    ok: "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40",
    warn: "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40",
    danger: "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40",
  }[tone];
  return (
    <div className={`rounded-xl border p-4 ${cls}`}>
      <p className="text-sm font-semibold text-ink dark:text-zinc-100">{title}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted dark:text-zinc-300">{children}</p>
    </div>
  );
}

/**
 * Méthodologie du score de risque, écrite pour les administrateurs. Les points et les libellés
 * viennent de RISK_SIGNALS (la même table que le calcul) et les seuils des réglages en vigueur :
 * ce qui est affiché est exactement ce qui est appliqué.
 */
export function RiskMethodology({ settings }: { settings: RiskSettings }) {
  const s = RISK_SIGNALS;
  const twins = s.device_voted_today.points + Math.min(IP_POINTS_MAX, s.device_same_ip.points + s.ip_many_votes.points) + s.device_same_decoration.points;
  const cleared = s.device_voted_today.points + s.local_vote_day.points + s.new_cookie_device_voted.points;
  const third = s.device_voted_twice.points + s.new_cookie_device_voted.points + Math.min(IP_POINTS_MAX, s.device_same_ip.points) + s.device_same_decoration.points;
  const verdict = (score: number) => (score >= settings.block_threshold ? "bloqué" : score >= settings.flag_threshold ? "signalé" : "accepté sans signal");

  return (
    <Card title="Comment le score de risque est calculé">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg text-sm text-muted hover:text-ink dark:text-zinc-400 dark:hover:text-zinc-100">
          <span className="inline-flex items-center gap-2">
            <BookOpen className="h-4 w-4" aria-hidden />
            Lire la méthodologie : ce qui est mesuré, combien de points chaque signal vaut, comment la décision est prise, ce qui n&apos;est jamais collecté.
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
        </summary>

        <div className="mt-6 flex flex-col gap-8">
          <ol className="flex flex-col gap-6">
            <Step no={1} icon={<Cookie className="h-4 w-4" />} title="La règle de base : un cookie d'appareil, un vote par jour">
              À l&apos;ouverture du questionnaire, le serveur pose un cookie anonyme sur l&apos;appareil. À la validation, un second vote le même jour (heure de Paris) avec ce
              cookie est refusé. C&apos;est la barrière principale, garantie par la base de données. Le score ci-dessous sert à repérer les appareils qui
              contournent cette règle en effaçant leurs cookies.
            </Step>
            <Step no={2} icon={<Smartphone className="h-4 w-4" />} title="Ce que la page envoie, en arrière-plan">
              Une empreinte technique de l&apos;appareil, calculée dans le navigateur à partir d&apos;attributs courants (navigateur et version, système, langues, fuseau
              horaire, taille et densité d&apos;écran, carte graphique, rendu d&apos;un petit dessin, fréquence audio, préférences d&apos;affichage), puis réduite à un
              condensé. Le serveur n&apos;enregistre qu&apos;une version brouillée de ce condensé (clé secrète) et quelques attributs lisibles : type d&apos;appareil,
              plateforme, navigateur, taille d&apos;écran. La page signale aussi si son stockage local garde la trace d&apos;un vote du jour, si le navigateur est piloté
              par un automate, et le moment du début du questionnaire.
            </Step>
            <Step no={3} icon={<Gauge className="h-4 w-4" />} title="Le score : des signaux qui s'additionnent">
              À la validation, le serveur compare ces éléments à ce qu&apos;il sait déjà (votes du jour par empreinte et par adresse IP, durée du questionnaire,
              cohérence entre ce que la page déclare et ce que la requête montre). Chaque signal présent ajoute ses points ; le total est le score.
            </Step>
            <Step no={4} icon={<ShieldCheck className="h-4 w-4" />} title="La décision">
              Score inférieur à <strong className="text-ink dark:text-zinc-100">{n(settings.flag_threshold)}</strong> : vote accepté, rien à faire. À partir de{" "}
              <strong className="text-ink dark:text-zinc-100">{n(settings.flag_threshold)}</strong> : vote accepté mais <em>signalé</em>, il apparaît dans la liste
              « Votes à examiner » pour que vous décidiez (l&apos;exclure du classement ou non). À partir de{" "}
              <strong className="text-ink dark:text-zinc-100">{n(settings.block_threshold)}</strong> en mode « Blocage » : le vote est refusé, la personne voit le
              message « Vous avez déjà voté aujourd&apos;hui », et la tentative reste visible ici (ligne « Bloqué »). En mode « Observation », rien n&apos;est refusé :
              tout est seulement signalé, ce qui permet de calibrer les seuils sur de vrais votants avant d&apos;activer le blocage.
            </Step>
          </ol>

          <div>
            <h4 className="mb-3 text-sm font-semibold text-ink dark:text-zinc-100">Les signaux et leurs points</h4>
            <div className="-mx-5 overflow-x-auto sm:mx-0">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs font-semibold uppercase text-muted dark:border-zinc-800 dark:text-zinc-400">
                    <th className="px-5 py-2 sm:px-3">Signal</th>
                    <th className="px-3 py-2 text-right">Points</th>
                    <th className="px-3 py-2 sm:pr-0">Pourquoi</th>
                  </tr>
                </thead>
                <tbody>
                  {RISK_SIGNAL_ORDER.map((code) => {
                    const sig = s[code];
                    const tone = sig.points >= 40 ? "danger" : sig.points >= 20 ? "warn" : "neutral";
                    return (
                      <tr key={code} className="border-b border-line align-top last:border-0 odd:bg-gray-50/60 dark:border-zinc-800 dark:odd:bg-zinc-800/30">
                        <td className="px-5 py-2.5 font-medium text-ink sm:px-3 dark:text-zinc-100">{sig.label}</td>
                        <td className="px-3 py-2.5 text-right">
                          <Badge tone={tone}>+{sig.points}</Badge>
                        </td>
                        <td className="px-3 py-2.5 text-muted sm:pr-0 dark:text-zinc-400">{sig.why}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-sm text-muted dark:text-zinc-400">
              Les signaux liés à l&apos;adresse IP (même appareil et même IP, 3 ou 6 votes depuis l&apos;IP) sont plafonnés ensemble à{" "}
              <strong className="text-ink dark:text-zinc-100">{n(IP_POINTS_MAX)} points</strong>, car plusieurs clients d&apos;un même restaurant partagent la même
              connexion Wi-Fi.
            </p>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold text-ink dark:text-zinc-100">Trois cas concrets, avec les seuils actuels</h4>
            <div className="grid gap-3 md:grid-cols-3">
              <Callout tone="ok" title="Une cliente revient voter le lendemain">
                Nouveau jour, même téléphone, même cookie : aucun vote du jour pour cette empreinte, score <strong>0</strong>. Vote {verdict(0)}.
              </Callout>
              <Callout tone="warn" title="Deux téléphones identiques sur le Wi-Fi du restaurant">
                Même empreinte (+{s.device_voted_today.points}), même IP et IP déjà sollicitée (plafonné à {IP_POINTS_MAX}), même décoration (+
                {s.device_same_decoration.points}) : score <strong>{twins}</strong>. Vote {verdict(twins)}, jamais bloqué sur ces seuls éléments.
              </Callout>
              <Callout tone="danger" title="Cookies effacés pour revoter, stockage local conservé">
                Même empreinte (+{s.device_voted_today.points}), trace locale du vote du jour (+{s.local_vote_day.points}), cookie absent (+
                {s.new_cookie_device_voted.points}) : score <strong>{cleared}</strong>. Vote {verdict(cleared)}. Un troisième vote du même appareil, même sans
                trace locale, atteint {third} : {verdict(third)}.
              </Callout>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-line p-4 dark:border-zinc-800">
              <h4 className="flex items-center gap-2 text-sm font-semibold text-ink dark:text-zinc-100">
                <Fingerprint className="h-4 w-4 text-muted" aria-hidden /> Garde-fous pour les votants honnêtes
              </h4>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted dark:text-zinc-400">
                <li>L&apos;adresse IP seule ne peut jamais atteindre le seuil de signalement ({IP_POINTS_MAX} points au plus).</li>
                <li>L&apos;empreinte seule (un vote précédent) ne peut jamais atteindre le seuil de blocage : il faut un second indice fort.</li>
                <li>Une personne ne peut pas faire bloquer quelqu&apos;un d&apos;autre : les seuls signaux qu&apos;elle peut provoquer chez un tiers passent par l&apos;IP, plafonnée.</li>
                <li>Si l&apos;empreinte n&apos;a pas pu être calculée, le vote est accepté sans aucun de ces signaux.</li>
                <li>Chaque blocage est visible ici et réversible (suppression de la ligne, exclusion annulable).</li>
              </ul>
            </div>
            <div className="rounded-xl border border-line p-4 dark:border-zinc-800">
              <h4 className="flex items-center gap-2 text-sm font-semibold text-ink dark:text-zinc-100">
                <EyeOff className="h-4 w-4 text-muted" aria-hidden /> Ce qui n&apos;est jamais collecté
              </h4>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted dark:text-zinc-400">
                <li>Historique de navigation, applications installées ou ouvertes, contacts, photos, presse-papier.</li>
                <li>Position GPS (seule l&apos;adresse IP, déjà enregistrée avec chaque vote, est utilisée).</li>
                <li>Aucune permission n&apos;est demandée au navigateur, aucune fenêtre ne s&apos;affiche au visiteur.</li>
                <li>Les attributs bruts de l&apos;empreinte ne quittent pas le navigateur : seul un condensé brouillé est enregistré, impossible à retourner en données d&apos;origine.</li>
              </ul>
            </div>
          </div>

          <p className="text-sm leading-relaxed text-muted dark:text-zinc-400">
            <strong className="text-ink dark:text-zinc-100">Limites connues.</strong> Un autre appareil, ou un navigateur différent sur le même appareil, a une
            autre empreinte et peut revoter : le score ne le voit pas. Sans compte ni confirmation par téléphone, aucune méthode ne l&apos;empêche totalement ;
            le tirage au sort, lui, reste limité à une participation par personne (email, téléphone et pseudo uniques).
          </p>
        </div>
      </details>
    </Card>
  );
}
