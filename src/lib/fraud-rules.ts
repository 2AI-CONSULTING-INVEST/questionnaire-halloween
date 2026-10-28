import type { RiskSettings } from "./risk";
import type { HwEntropy } from "./schema";

/**
 * Règles anti-fraude appliquées à l'arrivée, à l'ouverture et à la validation d'un vote.
 * Fonctions pures (testées sans base) et partagées avec le navigateur : les libellés et
 * explications de FRAUD_RULES servent aussi à la méthodologie de l'onglet Sécurité.
 *
 * Quatre issues : compté ; en attente (enregistré, jamais compté sans décision humaine) ; bloqué
 * (refus visible, réservé aux cas sûrs) ; exclu après coup par le moteur de groupes (fraud-graph.ts).
 * La première règle qui s'applique décide de l'issue ; toutes celles qui s'appliquent sont enregistrées.
 */

export type IpClassName = "normal" | "tor" | "hosting" | "relay" | "unknown";
export const isAnonymousIp = (c: string | null | undefined) => c === "tor" || c === "hosting";

type Rule = { kind: "block" | "hold" | "info"; label: string; why: string; setting?: keyof RiskSettings };

export const FRAUD_RULES = {
  cookie: {
    kind: "block",
    label: "Cookie de vote : ce navigateur a déjà une tentative aujourd'hui",
    why: "La règle de base : un vote par appareil et par jour. Le cookie hw_voter (60 jours) survit à la fermeture du navigateur et au redémarrage du téléphone.",
  },
  B1: {
    kind: "block",
    label: "Jeton retrouvé dans le stockage de l'appareil",
    why: "Le stockage de l'appareil (localStorage, IndexedDB) contient le jeton d'une tentative d'aujourd'hui alors que le cookie a disparu : cookies effacés, stockage conservé. Un votant honnête ne peut pas se trouver dans ce cas.",
  },
  B2: {
    kind: "block",
    label: "Clé matérielle forte déjà vue aujourd'hui, avec un second indice",
    why: "Sans cookie ni jeton, la clé matérielle forte (Android, ordinateur : modèle, écran, carte graphique, langues…) a déjà une tentative aujourd'hui, et un second indice relie les deux : navigation privée, même réseau IP, même ville peu après, ou jeton du stockage en commun. Sans second indice (deux Android identiques), le vote est mis en attente (H4), jamais refusé.",
    setting: "b2_strong_key",
  },
  B3: {
    kind: "block",
    label: "Score de risque au seuil de blocage",
    why: "Automate déclaré, validation impossible à la main, absence d'empreinte : voir les signaux du score ci-dessous.",
  },
  ip_daily_max: {
    kind: "block",
    label: "Plafond de votes par adresse IP atteint",
    why: "Plafond dur de votes validés par connexion et par jour (réglage), pour les scripts qui ne prennent même pas la peine de changer d'IP.",
  },
  H1: {
    kind: "hold",
    label: "Clé forte d'un groupe confirmé aujourd'hui",
    why: "L'appareil appartient déjà à un groupe de votes confirmé comme frauduleux aujourd'hui.",
  },
  H2: {
    kind: "hold",
    label: "Adresse IP de sortie Tor ou d'hébergeur (VPN, centre de données)",
    why: "Personne ne vote depuis un centre de données par hasard. iCloud Private Relay et les opérateurs français ne sont jamais classés hébergeurs.",
    setting: "h2_anonymous_ip",
  },
  H3: {
    kind: "hold",
    label: "Adresse IP hors de France",
    why: "Le règlement réserve la participation aux personnes résidant en France. Pays inconnu : aucun effet.",
    setting: "h3_foreign_country",
  },
  H4: {
    kind: "hold",
    label: "Clé forte déjà vue aujourd'hui, sans second indice (ou B2 désactivé)",
    why: "La clé forte a déjà une tentative aujourd'hui, mais rien d'autre ne relie les deux (réseau, ville, navigation privée, jeton) : deux appareils identiques restent possibles, le vote attend une décision humaine. S'applique toujours quand B2 est activé ; le réglage ne vaut que lorsque B2 est désactivé.",
    setting: "h4_strong_seen",
  },
  H5: {
    kind: "hold",
    label: "Clé faible déjà vue aujourd'hui depuis le même réseau",
    why: "iPhone ou iPad identique, même adresse IPv4 exacte (jamais le /24 : les opérateurs mobiles partagent leurs plages) ou même préfixe /64 en IPv6. Un ami sur le même Wi-Fi avec le même modèle laisse la même trace : jamais bloqué.",
    setting: "h5_weak_network",
  },
  H6: {
    kind: "hold",
    label: "Navigation privée et clé déjà vue aujourd'hui",
    why: "La navigation privée efface cookie et stockage à chaque fois : combinée à une clé déjà vue, c'est la signature d'un revote.",
    setting: "h6_private_seen",
  },
  H7: {
    kind: "hold",
    label: "Récidive : groupe confirmé un jour précédent",
    why: "La clé forte (ou le participant) appartenait à un groupe confirmé un autre jour. Jamais pour une clé faible.",
    setting: "h7_recidivism",
  },
  H8: {
    kind: "hold",
    label: "Score de risque au seuil de signalement",
    why: "Tout vote signalé attend une décision humaine : il n'existe plus de vote signalé mais compté.",
  },
  H9: {
    kind: "hold",
    label: "Clé faible, même ville, même décoration, peu après",
    why: "Le cas « un vote, puis un autre quelques minutes après » sur iPhone. Priorité haute dans la file de revue.",
    setting: "h9_weak_nearby",
  },
  tz_mismatch: {
    kind: "info",
    label: "Fuseau du navigateur différent du fuseau de l'IP",
    why: "Indice seulement (VPN, voyage, réglage manuel) : aucun effet sur l'issue.",
  },
  lang_mismatch: {
    kind: "info",
    label: "Langue du navigateur différente de l'en-tête Accept-Language",
    why: "Indice seulement : aucun effet sur l'issue.",
  },
} as const satisfies Record<string, Rule>;

export type FraudReason = keyof typeof FRAUD_RULES;
export const FRAUD_RULE_ORDER = Object.keys(FRAUD_RULES) as FraudReason[];
export const reasonLabel = (code: string) => (FRAUD_RULES as Record<string, Rule>)[code]?.label ?? code;

/** Tentative du jour déjà enregistrée (comptée, en attente ou exclue), vue par les règles. */
export type RelatedAttempt = {
  id: string;
  voterId: string | null;
  atMs: number;
  hwKey: string | null;
  entropy: HwEntropy | null;
  storageKey: string | null;
  ipNet: string | null;
  ipClass: string | null;
  city: string | null;
  decorationId: string | null;
  groupId: string | null;
};

/** Ce que la requête en cours apporte (signaux du navigateur vérifiés, signaux du serveur). */
export type RequestFacts = {
  stage: "arrival" | "create" | "complete";
  nowMs: number;
  voterId: string | null;
  /** HMAC des jetons retrouvés dans le stockage de l'appareil. */
  storageKeys: string[];
  hwKey: string | null;
  entropy: HwEntropy | null;
  privateMode: boolean | null;
  ipNet: string | null;
  ipClass: IpClassName;
  country: string | null;
  city: string | null;
  decorationId: string | null;
  /** Score de risque de la requête (validation seulement) et plafond par IP atteint. */
  score: number;
  ipCapped: boolean;
  /** Récidive (H7) : clé forte d'un groupe confirmé un jour précédent. */
  recidivism: boolean;
  tzMismatch: boolean;
  langMismatch: boolean;
};

export type Recognition = "cookie" | "storage" | "hw" | null;

type RecognitionFacts = Pick<RequestFacts, "voterId" | "storageKeys" | "hwKey" | "entropy" | "privateMode" | "ipNet" | "city" | "nowMs">;

/**
 * Seule fonction de reconnaissance d'un appareil qui a déjà une tentative aujourd'hui, partagée par
 * l'arrivée (vote-status), l'ouverture (create) et la validation (complete) : cookie, puis jeton du
 * stockage, puis clé hw forte avec un second indice (si B2 est activé). Une clé forte seule ne reconnaît
 * pas (deux Android identiques) : la session s'ouvre, la validation la met en attente (H4). Une clé
 * faible (iPhone, iPad) ne reconnaît jamais.
 */
export function recognize(f: RecognitionFacts, related: RelatedAttempt[], settings: Pick<RiskSettings, "b2_strong_key" | "h9_minutes">): Recognition {
  if (f.voterId && related.some((a) => a.voterId === f.voterId)) return "cookie";
  if (f.storageKeys.length && related.some((a) => a.storageKey && f.storageKeys.includes(a.storageKey))) return "storage";
  if (settings.b2_strong_key && strongWithClue(f, sameStrong(f, related), settings.h9_minutes)) return "hw";
  return null;
}

const sameStrong = (f: Pick<RequestFacts, "hwKey" | "entropy">, related: RelatedAttempt[]) =>
  f.entropy === "strong" && f.hwKey ? related.filter((a) => a.entropy === "strong" && a.hwKey === f.hwKey) : [];

/**
 * Second indice qui relie la tentative à une tentative de même clé forte : navigation privée détectée,
 * même réseau IP, même ville à `minutes` près, ou jeton du stockage en commun. Sans lui, la clé forte seule
 * ne refuse pas (B2) : elle met en attente (H4).
 */
export function strongWithClue(f: Pick<RequestFacts, "privateMode" | "ipNet" | "city" | "storageKeys" | "nowMs">, strongSeen: RelatedAttempt[], minutes: number): boolean {
  if (!strongSeen.length) return false;
  if (f.privateMode === true) return true;
  return strongSeen.some(
    (a) =>
      (!!f.ipNet && a.ipNet === f.ipNet) ||
      (!!f.city && a.city === f.city && Math.abs(f.nowMs - a.atMs) <= minutes * 60_000) ||
      (!!a.storageKey && f.storageKeys.includes(a.storageKey)),
  );
}
const sameKey = (f: Pick<RequestFacts, "hwKey" | "entropy">, related: RelatedAttempt[]) =>
  f.hwKey && (f.entropy === "strong" || f.entropy === "weak") ? related.filter((a) => a.hwKey === f.hwKey && a.entropy === f.entropy) : [];

/** Temps écoulé depuis la dernière tentative reliée (même cookie, jeton, clé hw, réseau ou ville avec la même clé), en ms ; null si aucune. */
export function sinceLinked(f: RequestFacts, related: RelatedAttempt[]): number | null {
  const linked = related.filter(
    (a) =>
      (f.voterId && a.voterId === f.voterId) ||
      (a.storageKey && f.storageKeys.includes(a.storageKey)) ||
      (f.hwKey && a.hwKey === f.hwKey) ||
      (f.ipNet && a.ipNet === f.ipNet),
  );
  if (!linked.length) return null;
  return Math.max(0, f.nowMs - Math.max(...linked.map((a) => a.atMs)));
}

export type Decision = {
  outcome: "counted" | "held" | "blocked";
  /** Issue qu'aurait eue le vote sans le mode observation (null si identique). */
  observed: "held" | "blocked" | null;
  reasons: FraudReason[];
  priority: boolean;
  recognized: Recognition;
};

/**
 * Décision pour une requête. Arrivée et ouverture : seules les règles de refus par reconnaissance
 * (cookie, B1, B2) s'appliquent. Validation : toutes. Mode observation : rien n'est retenu ni
 * bloqué (sauf la règle du cookie, qui est la règle de base), l'issue évitée est rendue dans `observed`.
 */
export function decide(f: RequestFacts, related: RelatedAttempt[], settings: RiskSettings): Decision {
  const reasons: FraudReason[] = [];
  const recognized = recognize(f, related, settings);
  if (recognized === "cookie") reasons.push("cookie");
  if (recognized === "storage" || (f.storageKeys.length && related.some((a) => a.storageKey && f.storageKeys.includes(a.storageKey)))) reasons.push("B1");
  const strongSeen = sameStrong(f, related);
  const strongClue = strongWithClue(f, strongSeen, settings.h9_minutes);
  if (strongSeen.length && settings.b2_strong_key && strongClue) reasons.push("B2");

  let priority = false;
  if (f.stage === "complete") {
    if (f.score >= settings.block_threshold) reasons.push("B3");
    if (f.ipCapped) reasons.push("ip_daily_max");
    if (strongSeen.some((a) => a.groupId)) reasons.push("H1");
    if (settings.h2_anonymous_ip && isAnonymousIp(f.ipClass)) reasons.push("H2");
    if (settings.h3_foreign_country && f.country && f.country !== "FR") reasons.push("H3");
    // B2 activé sans second indice : attente, jamais refus ; B2 désactivé : selon le réglage de H4.
    if (strongSeen.length && (settings.b2_strong_key ? !strongClue : settings.h4_strong_seen)) reasons.push("H4");
    const windowMs = settings.h9_minutes * 60_000;
    if (settings.h5_weak_network && f.entropy === "weak" && f.ipNet) {
      const net = sameKey(f, related).filter((a) => a.ipNet === f.ipNet);
      if (net.length) {
        reasons.push("H5");
        if (net.some((a) => f.nowMs - a.atMs < windowMs)) priority = true;
      }
    }
    if (settings.h6_private_seen && f.privateMode === true && sameKey(f, related).length) reasons.push("H6");
    if (settings.h7_recidivism && f.entropy === "strong" && f.recidivism) reasons.push("H7");
    if (f.score >= settings.flag_threshold && f.score < settings.block_threshold) reasons.push("H8");
    if (
      settings.h9_weak_nearby &&
      f.entropy === "weak" &&
      f.city &&
      f.decorationId &&
      sameKey(f, related).some((a) => a.city === f.city && a.decorationId === f.decorationId && f.nowMs - a.atMs < windowMs)
    ) {
      reasons.push("H9");
      priority = true;
    }
    if (f.tzMismatch) reasons.push("tz_mismatch");
    if (f.langMismatch) reasons.push("lang_mismatch");
  }

  const wouldBe = reasons.some((r) => FRAUD_RULES[r].kind === "block") ? "blocked" : reasons.some((r) => FRAUD_RULES[r].kind === "hold") ? "held" : "counted";
  if (settings.mode === "observe" && wouldBe !== "counted" && !reasons.includes("cookie")) {
    return { outcome: "counted", observed: wouldBe, reasons, priority, recognized };
  }
  return { outcome: wouldBe, observed: null, reasons, priority: wouldBe === "held" && priority, recognized };
}

/**
 * Repli d'une validation parallèle de la même clé forte, déjà comptée (index unique
 * `responses_hw_counted_unique`), quand la décision relue ne tranche pas : attente (H4), jamais un refus
 * sans second indice. Mode observation : le vote reste compté comme `decide` l'a rendu, seule l'issue
 * évitée est notée (elle sort le vote de l'index, qui ne garde que les votes sans issue évitée).
 */
export function strongConflict(d: Pick<Decision, "outcome" | "observed" | "reasons">, settings: Pick<RiskSettings, "mode">): Pick<Decision, "outcome" | "observed" | "reasons"> {
  const reasons: FraudReason[] = d.reasons.includes("H4") ? d.reasons : [...d.reasons, "H4"];
  if (settings.mode === "observe") return { outcome: d.outcome, observed: d.observed ?? "held", reasons };
  return { outcome: "held", observed: null, reasons };
}
