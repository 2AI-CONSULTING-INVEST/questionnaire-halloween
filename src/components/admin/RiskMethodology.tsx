"use client";

import { BookOpen, ChevronDown, EyeOff, Fingerprint, Network, ShieldCheck } from "lucide-react";
import { GROUP_CONDITIONS, LINK_KINDS } from "@/lib/fraud-graph";
import { decide, FRAUD_RULE_ORDER, FRAUD_RULES, type RelatedAttempt, type RequestFacts } from "@/lib/fraud-rules";
import { RISK_SIGNAL_ORDER, RISK_SIGNALS, scoreRisk, type RiskSettings } from "@/lib/risk";
import { Badge, Card } from "./ui";

const n = (v: number) => v.toLocaleString("fr-FR");

const OUTCOME_LABEL = { counted: "compté", held: "en attente", blocked: "bloqué" } as const;

/** Faits d'une validation honnête, que chaque exemple modifie : les exemples passent par le vrai calcul (`decide`). */
const BASE: RequestFacts = {
  stage: "complete",
  nowMs: Date.parse("2026-10-27T18:00:00Z"),
  voterId: "11111111-1111-4111-8111-111111111111",
  storageKeys: [],
  hwKey: "k1",
  entropy: "strong",
  privateMode: false,
  ipNet: "203.0.113.10",
  ipClass: "normal",
  country: "FR",
  city: "Lille",
  decorationId: "d1",
  score: 0,
  ipCapped: false,
  recidivism: false,
  tzMismatch: false,
  langMismatch: false,
};
const earlier = (patch: Partial<RelatedAttempt>): RelatedAttempt => ({
  id: "a0",
  voterId: "22222222-2222-4222-8222-222222222222",
  atMs: BASE.nowMs - 5 * 60_000,
  hwKey: "k1",
  entropy: "strong",
  storageKey: null,
  ipNet: "198.51.100.7",
  ipClass: "normal",
  city: "Lille",
  decorationId: "d1",
  groupId: null,
  ...patch,
});

function examples(settings: RiskSettings) {
  const tooFast = scoreRisk({ noDevice: false, durationMs: 4000, webdriver: false, userAgent: null, declared: {} }).score;
  const cases: { title: string; tone: "ok" | "warn" | "danger"; text: string; facts: RequestFacts; related: RelatedAttempt[] }[] = [
    { title: "Une cliente revient voter le lendemain", tone: "ok", text: "Nouveau jour, même téléphone : aucune tentative aujourd'hui.", facts: BASE, related: [] },
    {
      title: "Android en navigation privée, deuxième vote",
      tone: "danger",
      text: "Cookie et stockage vides, mais la clé matérielle forte a déjà une tentative aujourd'hui.",
      facts: { ...BASE, privateMode: true, ipNet: "192.0.2.44" },
      related: [earlier({})],
    },
    {
      title: "Deux Android identiques, autre réseau, autre ville",
      tone: "warn",
      text: "Même modèle, même clé forte, mais aucun second indice : le vote attend une décision humaine, il n'est pas refusé.",
      facts: { ...BASE, ipNet: "192.0.2.45", city: "Roubaix" },
      related: [earlier({})],
    },
    {
      title: "Deux iPhone identiques sur le même Wi-Fi",
      tone: "warn",
      text: "Même modèle, mêmes réglages, même adresse IP : un ami à la même table laisse la même trace. Jamais bloqué.",
      facts: { ...BASE, entropy: "weak", city: null },
      related: [earlier({ entropy: "weak", ipNet: BASE.ipNet, city: null })],
    },
    {
      title: "Quatre iPhone identiques, quatre réseaux mobiles",
      tone: "ok",
      text: "QR code scanné en restaurant, villes déduites différentes : aucun lien, chacun est compté.",
      facts: { ...BASE, entropy: "weak", city: "Villeneuve-d'Ascq" },
      related: [earlier({ entropy: "weak", city: "Roubaix" }), earlier({ id: "a1", entropy: "weak", city: "Lens" })],
    },
    {
      title: "Sortie Tor ou VPN d'hébergeur",
      tone: "warn",
      text: "Personne ne vote depuis un centre de données par hasard : le vote attend une décision.",
      facts: { ...BASE, ipClass: "tor" },
      related: [],
    },
    {
      title: `Validation en ${n(4)} s`,
      tone: "warn",
      text: `Signal « trop rapide » : score ${tooFast} (signalement à ${settings.flag_threshold}, blocage à ${settings.block_threshold}).`,
      facts: { ...BASE, score: tooFast },
      related: [],
    },
  ];
  return cases.map((c) => ({ ...c, decision: decide(c.facts, c.related, settings) }));
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
      <div className="mt-1 text-sm leading-relaxed text-muted dark:text-zinc-300">{children}</div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink dark:text-zinc-100">
        <span className="text-muted dark:text-zinc-400" aria-hidden>
          {icon}
        </span>
        {title}
      </h4>
      {children}
    </div>
  );
}

const cell = "px-3 py-2.5 align-top";

/**
 * Méthodologie anti-fraude, écrite pour les administrateurs et générée depuis les mêmes constantes que
 * le calcul (FRAUD_RULES, RISK_SIGNALS, LINK_KINDS, GROUP_CONDITIONS) et les réglages en vigueur. Les
 * exemples passent par le vrai code : ce qui est affiché est exactement ce qui est appliqué.
 */
export function RiskMethodology({ settings }: { settings: RiskSettings }) {
  const on = (key?: keyof RiskSettings) => !key || settings[key] !== false;
  return (
    <Card title="Méthodologie anti-fraude">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-ink dark:text-zinc-100">
          <span className="inline-flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-muted" aria-hidden /> Comment un vote est compté, mis en attente, bloqué ou exclu
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="mt-4 flex flex-col gap-6">
          <Section icon={<ShieldCheck className="h-4 w-4" />} title="Quatre issues">
            <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted dark:text-zinc-400">
              <li>
                <strong className="text-ink dark:text-zinc-100">Compté</strong> : le vote entre dans le classement.
              </li>
              <li>
                <strong className="text-ink dark:text-zinc-100">En attente</strong> : enregistré, absent du classement et de tous les décomptes, visible dans « Votes
                suspects en attente ». Le votant voit le remerciement normal : aucun indice. Seul un admin le fait compter, avec la double validation.
              </li>
              <li>
                <strong className="text-ink dark:text-zinc-100">Bloqué</strong> : refus visible, la modale « Votre vote est bloqué » s&apos;ouvre, même texte pour tous les
                motifs. Réservé aux cas sûrs, listés dans « Votes frauduleux ».
              </li>
              <li>
                <strong className="text-ink dark:text-zinc-100">Exclu automatiquement</strong> : après coup, quand le moteur de groupes confirme qu&apos;une série de
                votes vient de la même personne. Réversible, journalisé.
              </li>
            </ul>
            <p className="mt-2 text-sm text-muted dark:text-zinc-400">
              Mode actuel : <strong className="text-ink dark:text-zinc-100">{settings.mode === "block" ? "Blocage" : "Observation"}</strong>
              {settings.mode === "observe" && " : rien n'est retenu, bloqué ni exclu (sauf le cookie, règle de base) ; la décision évitée reste visible."}
            </p>
          </Section>

          <Section icon={<ShieldCheck className="h-4 w-4" />} title="Règles, dans l'ordre d'évaluation">
            <p className="mb-2 text-sm text-muted dark:text-zinc-400">La première règle qui s&apos;applique décide ; toutes celles qui s&apos;appliquent sont enregistrées.</p>
            <div className="-mx-5 overflow-x-auto sm:mx-0">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs font-semibold text-muted dark:border-zinc-800 dark:text-zinc-400">
                    <th className={cell}>Règle</th>
                    <th className={cell}>Issue</th>
                    <th className={cell}>Pourquoi</th>
                  </tr>
                </thead>
                <tbody>
                  {FRAUD_RULE_ORDER.map((code) => {
                    const r = FRAUD_RULES[code] as { kind: "block" | "hold" | "info"; label: string; why: string; setting?: keyof RiskSettings };
                    const active = on(r.setting) || (code === "H4" && settings.b2_strong_key); // H4 : toujours actif avec B2 (clé forte sans second indice)
                    return (
                      <tr key={code} className={`border-b border-line last:border-0 dark:border-zinc-800 ${active ? "" : "opacity-60"}`}>
                        <td className={`${cell} font-medium text-ink dark:text-zinc-100`}>
                          <span className="font-mono text-xs text-muted">{code}</span> {r.label}
                          {!active && <span className="ml-1 text-xs text-muted">(désactivée)</span>}
                        </td>
                        <td className={cell}>
                          <Badge tone={r.kind === "block" ? "danger" : r.kind === "hold" ? "warn" : "neutral"}>{r.kind === "block" ? "Bloqué" : r.kind === "hold" ? "En attente" : "Indice"}</Badge>
                        </td>
                        <td className={`${cell} text-muted dark:text-zinc-400`}>
                          {r.why}
                          {code === "H9" && ` Délai réglé : ${settings.h9_minutes} min.`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Section>

          <Section icon={<Fingerprint className="h-4 w-4" />} title="Score de risque de la requête">
            <p className="mb-2 text-sm text-muted dark:text-zinc-400">
              Seuls les signaux propres à la requête comptent. À partir de <strong className="text-ink dark:text-zinc-100">{settings.flag_threshold}</strong> le vote est en
              attente (H8), à partir de <strong className="text-ink dark:text-zinc-100">{settings.block_threshold}</strong> il est bloqué (B3). Les preuves d&apos;appareil,
              de stockage et d&apos;IP passent par les règles ci-dessus : une même preuve ne compte jamais deux fois.
            </p>
            <ul className="divide-y divide-line text-sm dark:divide-zinc-800">
              {RISK_SIGNAL_ORDER.map((code) => (
                <li key={code} className="flex items-start justify-between gap-3 py-1.5">
                  <span className="text-ink dark:text-zinc-200">{RISK_SIGNALS[code].label}</span>
                  <Badge tone={RISK_SIGNALS[code].points >= 40 ? "danger" : "warn"}>+{RISK_SIGNALS[code].points}</Badge>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-sm text-muted dark:text-zinc-400">
              Plafond dur par adresse IP :{" "}
              {settings.ip_daily_max > 0 ? <strong className="text-ink dark:text-zinc-100">{n(settings.ip_daily_max)} votes validés par jour</strong> : "désactivé"}.
            </p>
          </Section>

          <Section icon={<Network className="h-4 w-4" />} title="Moteur de groupes (après coup)">
            <p className="mb-2 text-sm text-muted dark:text-zinc-400">
              Après chaque validation et chaque inscription au tirage, les tentatives du jour sont reliées. Une clé faible seule (iPhone, iPad) ne relie jamais rien.
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted dark:text-zinc-400">
              {Object.values(LINK_KINDS).map((l) => (
                <li key={l.label}>
                  {l.label}
                  {l.suspectOnly && " (lien suspect : ne confirme jamais un groupe)"}
                </li>
              ))}
            </ul>
            <p className="mb-1 mt-3 text-sm font-semibold text-ink dark:text-zinc-100">Un groupe est confirmé si :</p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted dark:text-zinc-400">
              {Object.entries(GROUP_CONDITIONS).map(([k, v]) => (
                <li key={k}>
                  <span className="font-mono text-xs">{k}</span> {v}
                  {k === "C2" && ` (seuil réglé : ${settings.c2_min_attempts})`}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-sm text-muted dark:text-zinc-400">
              Groupe confirmé : la tentative la plus ancienne garde son statut, les autres votes sont exclus automatiquement. Groupe suspect : rien n&apos;est exclu, les
              votes en trop restent en attente. Le moteur ne fait jamais compter un vote, et ne touche plus à un vote décidé par un admin.
            </p>
          </Section>

          <Section icon={<ShieldCheck className="h-4 w-4" />} title="Cas concrets, calculés avec les réglages actuels">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {examples(settings).map((c) => (
                <Callout key={c.title} tone={c.decision.outcome === "counted" ? "ok" : c.decision.outcome === "held" ? "warn" : "danger"} title={c.title}>
                  {c.text} Résultat : <strong>{OUTCOME_LABEL[c.decision.outcome]}</strong>
                  {c.decision.observed && ` (sans le mode observation : ${OUTCOME_LABEL[c.decision.observed]})`}
                  {c.decision.reasons.length > 0 && ` (règles : ${c.decision.reasons.join(", ")})`}.
                </Callout>
              ))}
            </div>
          </Section>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-line p-4 dark:border-zinc-800">
              <h4 className="flex items-center gap-2 text-sm font-semibold text-ink dark:text-zinc-100">
                <Fingerprint className="h-4 w-4 text-muted" aria-hidden /> Reconnaissance à l&apos;arrivée
              </h4>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted dark:text-zinc-400">
                <li>Dans l&apos;ordre : cookie (60 jours), jetons du stockage (localStorage, IndexedDB), puis clé matérielle forte avec un second indice (règle B2) ; une clé forte seule ne verrouille pas, la validation met en attente (H4).</li>
                <li>Cookie et stockage survivent à la fermeture du navigateur, au redémarrage du téléphone et au vidage du cache seul.</li>
                <li>Après effacement des données du site, ou en navigation privée, seule la clé forte reconnaît l&apos;appareil (Android, ordinateur).</li>
                <li>iPhone et iPad ne sont jamais verrouillés à l&apos;arrivée sur une simple ressemblance : leur vote suivant suit H5, H6 et H9.</li>
              </ul>
            </div>
            <div className="rounded-xl border border-line p-4 dark:border-zinc-800">
              <h4 className="flex items-center gap-2 text-sm font-semibold text-ink dark:text-zinc-100">
                <EyeOff className="h-4 w-4 text-muted" aria-hidden /> Limites, écrites honnêtement
              </h4>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted dark:text-zinc-400">
                <li>Une page web ne lit ni l&apos;adresse MAC, ni l&apos;IMEI, ni le numéro de série, ni l&apos;identifiant publicitaire. Rien ne survit à la navigation privée.</li>
                <li>Deux iPhone du même modèle, même version d&apos;iOS et mêmes réglages sont indiscernables pour une page web.</li>
                <li>La position est celle déduite de l&apos;IP : précise à la ville, parfois fausse sur les réseaux mobiles, incapable de distinguer deux voisins.</li>
                <li>Deux Android identiques (même modèle, même version, même langue) partagent la clé forte : sans second indice, le second vote est mis en attente (H4), pas refusé ; avec un second indice (même réseau, même ville peu après, navigation privée), il est refusé (B2). Recommandation : démarrer en mode observation et mesurer le nombre de cookies distincts par clé et par jour avant d&apos;appliquer.</li>
                <li>Un script qui n&apos;envoie pas le modèle Android obtient une clé faible et échappe à B2 et H4, comme un agent utilisateur falsifié.</li>
                <li>Un ordinateur au rendu graphique logiciel (machine virtuelle, bureau à distance) est traité comme fort : deux postes identiques peuvent se heurter à H4, ou à B2 avec un second indice.</li>
                <li>Un script qui invente une clé différente à chaque vote échappe aux règles de clé : le score, la classe d&apos;IP et le plafond par IP restent les garde-fous.</li>
                <li>L&apos;agent utilisateur décide de la classe d&apos;entropie : un script qui change d&apos;agent utilisateur en même temps (iPhone ou Firefox annoncé, classe « faible ») obtient une clé faible, qui ne relie que par le réseau, l&apos;anonymat de l&apos;IP ou la position.</li>
                <li>Navigation privée : sur Chrome, un Android dont la mémoire est presque pleine peut être pris à tort pour une navigation privée (le signal ne compte qu&apos;avec une clé déjà vue, H6, ou dans C4).</li>
                <li>Aucune permission n&apos;est demandée, aucune position GPS n&apos;est lue : seules des empreintes non réversibles (HMAC) sont conservées.</li>
              </ul>
            </div>
          </div>
        </div>
      </details>
    </Card>
  );
}
