import { z } from "zod";

/**
 * Score de risque de la requête, calculé à la validation du vote, avant l'écriture.
 * Fonction pure (testable). Partagé serveur / navigateur (libellés, points, méthodologie de l'onglet
 * Sécurité) : aucun import serveur ici. Les points vivent dans RISK_SIGNALS, seule source pour le
 * calcul ET pour l'explication affichée aux administrateurs : les deux ne peuvent pas diverger.
 *
 * Le score ne garde que les signaux propres à la requête. Les preuves d'appareil, de stockage et
 * d'IP passent par les règles B1 à B3 et H1 à H9 (src/lib/fraud-rules.ts) et par le moteur de
 * groupes (src/lib/fraud-graph.ts) : une même preuve ne compte jamais deux fois.
 */

export type RiskSignal = { label: string; points: number; why: string };

export const RISK_SIGNALS = {
  no_device: {
    label: "Aucune empreinte d'appareil envoyée",
    points: 45,
    why: "La page envoie toujours une empreinte ; son absence signifie un appel direct à l'API ou un navigateur sans WebCrypto (très rare).",
  },
  way_too_fast: {
    label: "Vote validé moins de 2 s après l'ouverture",
    points: 40,
    why: "Impossible à la main. Remplace le signal suivant.",
  },
  webdriver: {
    label: "Navigateur piloté par un automate (webdriver)",
    points: 40,
    why: "Le navigateur déclare être contrôlé par un programme (outil d'automatisation).",
  },
  too_fast: {
    label: "Vote validé moins de 6 s après l'ouverture",
    points: 25,
    why: "Trois questions lues et répondues en moins de 6 secondes : plutôt quelqu'un qui connaît déjà le parcours.",
  },
  ua_mismatch: {
    label: "Type d'appareil déclaré incohérent avec l'agent utilisateur",
    points: 15,
    why: "Le navigateur se dit mobile alors que la requête vient d'un ordinateur (ou l'inverse) : signaux falsifiés.",
  },
  browser_mismatch: {
    label: "Navigateur déclaré incohérent avec l'agent utilisateur",
    points: 15,
    why: "Le navigateur annoncé par la page (Chrome, Safari, Firefox…) n'est ni celui de l'agent utilisateur ni celui des en-têtes Sec-CH-UA : signaux falsifiés ou outil qui se déguise. Brave se présente comme Chrome, et Samsung Internet se déclare « Samsung Browser » : ils ne sont pas signalés.",
  },
} as const satisfies Record<string, RiskSignal>;

export type RiskFlag = keyof typeof RISK_SIGNALS;

/** Ordre d'affichage des signaux dans la méthodologie (du plus fort au plus faible). */
export const RISK_SIGNAL_ORDER: RiskFlag[] = ["no_device", "way_too_fast", "webdriver", "too_fast", "ua_mismatch", "browser_mismatch"];

/** Signaux des versions précédentes, encore présents sur les anciennes lignes : libellés seulement, plus aucun point. */
export const LEGACY_FLAG_LABELS: Record<string, string> = {
  device_voted_today: "Même appareil : 1 vote validé aujourd'hui (ancien calcul)",
  device_voted_twice: "Même appareil : 2 votes validés ou plus aujourd'hui (ancien calcul)",
  local_vote_day: "Le stockage local indiquait déjà un vote aujourd'hui (ancien calcul)",
  new_cookie_device_voted: "Cookie absent alors que l'appareil avait déjà voté (ancien calcul)",
  device_same_ip: "Même appareil et même adresse IP (ancien calcul)",
  ip_many_votes: "Adresse IP : 3 votes validés ou plus (ancien calcul)",
  ip_very_many_votes: "Adresse IP : 6 votes validés ou plus (ancien calcul)",
  device_same_decoration: "Même appareil et même décoration (ancien calcul)",
};

/**
 * Plafond dur de votes validés par adresse IP et par jour (réglage `ip_daily_max`, 0 = désactivé) :
 * pas des points, une règle appliquée à la validation ; le code apparaît dans `risk_flags`.
 */
export const IP_DAILY_MAX_FLAG = "ip_daily_max";
export const IP_DAILY_MAX_LABEL = "Plafond de votes par adresse IP atteint";

export type RiskSettings = z.infer<typeof riskSettingsSchema>;

/**
 * Réglages de l'onglet Sécurité. Chaque nouvelle clé a un `.default` : les réglages déjà enregistrés
 * (sans ces clés) restent valides et prennent les valeurs par défaut de la méthodologie.
 */
export const riskSettingsSchema = z
  .object({
    mode: z.enum(["block", "observe"]),
    flag_threshold: z.number().int().min(0).max(200),
    block_threshold: z.number().int().min(0).max(200),
    /** Votes validés max. par IP et par jour (0 = sans limite). */
    ip_daily_max: z.number().int().min(0).max(1000).default(60),
    /** B2 : refuser une clé hw forte déjà vue aujourd'hui (sinon H4 : mise en attente). */
    b2_strong_key: z.boolean().default(true),
    /** H2 : IP Tor ou hébergeur. */
    h2_anonymous_ip: z.boolean().default(true),
    /** H3 : pays de l'IP connu et différent de FR. */
    h3_foreign_country: z.boolean().default(true),
    /** H4 : clé forte déjà vue, quand B2 est désactivé. */
    h4_strong_seen: z.boolean().default(true),
    /** H5 : clé faible déjà vue depuis le même réseau. */
    h5_weak_network: z.boolean().default(true),
    /** H6 : navigation privée et clé déjà vue. */
    h6_private_seen: z.boolean().default(true),
    /** H7 : récidive d'une clé forte ou d'un participant d'un groupe confirmé un jour précédent. */
    h7_recidivism: z.boolean().default(true),
    /** H9 : clé faible, même ville, même décoration, peu après une tentative du jour. */
    h9_weak_nearby: z.boolean().default(true),
    h9_minutes: z.number().int().min(1).max(120).default(10),
    /** C2 : nombre de cookies distincts reliés par une clé forte qui confirme un groupe. */
    c2_min_attempts: z.number().int().min(2).max(20).default(3),
  })
  .strict()
  .refine((s) => s.flag_threshold < s.block_threshold, { message: "Le seuil de signalement doit être inférieur au seuil de blocage", path: ["flag_threshold"] });

export const DEFAULT_RISK_SETTINGS: RiskSettings = riskSettingsSchema.parse({ mode: "block", flag_threshold: 40, block_threshold: 80, ip_daily_max: 60 });

/** Réglages enregistrés (clé `risk`), ou les valeurs par défaut si absents ou invalides. */
export async function loadRiskSettings(store: { getSetting(key: string): Promise<unknown> }): Promise<RiskSettings> {
  const parsed = riskSettingsSchema.safeParse(await store.getSetting("risk"));
  return parsed.success ? parsed.data : DEFAULT_RISK_SETTINGS;
}

export type RiskInput = {
  /** Aucune empreinte (`device_hash` null) : appel direct à l'API. */
  noDevice: boolean;
  /** Ouverture de la session → validation ; null si inconnue. */
  durationMs: number | null;
  webdriver: boolean;
  userAgent: string | null;
  /** En-tête Sec-CH-UA de la requête (navigateurs Chromium), s'il existe. */
  secChUa?: string | null;
  /** Ce que la page a déclaré d'elle-même (non fiable : sert aux contrôles de cohérence). */
  declared: { mobile?: boolean; browser?: string };
};

/** UA « mobile » selon le serveur (Android sans « Mobile » = tablette, comme `userAgentData.mobile`). */
export const uaIsMobile = (ua: string) => /Mobile|iPhone|iPod/i.test(ua);

/** Famille de navigateur d'après l'agent utilisateur (l'ordre compte : Edge et Opera se disent aussi Chrome, Chrome se dit Safari). */
export function uaBrowser(ua: string): string {
  if (/Edg(e|A|iOS)?\//i.test(ua)) return "Edge";
  if (/OPR\/|Opera/i.test(ua)) return "Opera";
  if (/SamsungBrowser\//i.test(ua)) return "Samsung Internet";
  if (/FxiOS\/|Firefox\//i.test(ua)) return "Firefox";
  if (/CriOS\/|Chrome\/|Chromium\//i.test(ua)) return "Chrome";
  if (/Safari\//i.test(ua) && /Version\//i.test(ua)) return "Safari";
  return "Autre";
}

/** Noms de marque déclarés par la page qui désignent la même famille que l'agent utilisateur. */
const DECLARED_ALIASES: Record<string, string> = { "Samsung Browser": "Samsung Internet" };

/** Famille du navigateur déclaré par la page (« Chrome 130 » → « Chrome », « Samsung Browser 30.0 » → « Samsung Internet »). */
export const browserFamily = (declared: string) => {
  const family = declared.replace(/\s+\d.*$/, "").trim();
  return DECLARED_ALIASES[family] ?? family;
};

/** Navigateurs Chromium dont l'agent utilisateur est celui de Chrome : seuls les en-têtes Sec-CH-UA les distinguent. */
const LOOKS_LIKE_CHROME = new Set(["Brave"]);

/** Marques de l'en-tête Sec-CH-UA (`"Brave";v="156", "Chromium";v="156", "Not=A?Brand";v="24"`), sans les marques factices. */
export function chBrands(header: string | null | undefined): string[] {
  if (!header) return [];
  return [...header.matchAll(/"([^"]+)";\s*v="\d+[^"]*"/g)].map((m) => m[1]).filter((b) => !/Not.?A.?Brand|^Chromium$/i.test(b));
}

/** Famille d'une marque Sec-CH-UA (« Google Chrome » → « Chrome », « Microsoft Edge » → « Edge »). */
const chFamily = (brand: string) => browserFamily(brand.replace(/^Google |^Microsoft /, "").replace(/^Opera.*$/, "Opera"));

/** Le navigateur déclaré par la page est-il incohérent avec ce que la requête présente (agent utilisateur, puis Sec-CH-UA) ? */
export function browserMismatch(declared: string, userAgent: string, secChUa?: string | null): boolean {
  const client = browserFamily(declared);
  const server = uaBrowser(userAgent);
  const brands = chBrands(secChUa);
  // Sec-CH-UA présent : la marque déclarée doit y figurer (c'est ce que lit la page elle-même).
  if (brands.length && client !== "Autre" && !brands.some((b) => chFamily(b) === client)) return true;
  if (server === "Autre" || client === "Autre" || server === client) return false;
  return !(server === "Chrome" && LOOKS_LIKE_CHROME.has(client));
}

export function scoreRisk(input: RiskInput): { score: number; flags: RiskFlag[] } {
  const flags: RiskFlag[] = [];
  let score = 0;
  const add = (flag: RiskFlag) => {
    score += RISK_SIGNALS[flag].points;
    flags.push(flag);
  };
  if (input.noDevice) add("no_device");
  if (input.durationMs !== null) {
    if (input.durationMs < 2000) add("way_too_fast");
    else if (input.durationMs < 6000) add("too_fast");
  }
  if (input.webdriver) add("webdriver");
  if (input.userAgent && input.declared.mobile !== undefined && input.declared.mobile !== uaIsMobile(input.userAgent)) add("ua_mismatch");
  if (input.userAgent && input.declared.browser && browserMismatch(input.declared.browser, input.userAgent, input.secChUa)) add("browser_mismatch");
  return { score, flags };
}

/** Code d'un signal → libellé lisible (code brut si inconnu). */
export const flagLabel = (code: string) =>
  code === IP_DAILY_MAX_FLAG ? IP_DAILY_MAX_LABEL : ((RISK_SIGNALS as Record<string, RiskSignal>)[code]?.label ?? LEGACY_FLAG_LABELS[code] ?? code);

/** Réponse de GET /api/admin/security (onglet Sécurité). */
export type RiskCounts = { counted: number; held: number; blocked: number; autoExcluded: number; adminExcluded: number };
export type TopEntry = { key: string; votes: number; held: number };
export type SecuritySummary = { settings: RiskSettings; today: RiskCounts; total: RiskCounts; topIps: TopEntry[]; topDevices: TopEntry[]; pending: number; highPriority: number };
