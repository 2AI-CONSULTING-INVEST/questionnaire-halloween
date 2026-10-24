import { z } from "zod";

/**
 * Score de risque « revote le même jour », calculé à la validation du vote, avant l'écriture.
 * Fonction pure (testable) : toutes les requêtes sont faites par l'appelant (`riskContext`).
 * Partagé serveur / navigateur (libellés, points, méthodologie de l'onglet Sécurité) : aucun import
 * serveur ici. Les points vivent dans RISK_SIGNALS, seule source pour le calcul ET pour l'explication
 * affichée aux administrateurs : les deux ne peuvent pas diverger.
 */

export type RiskSignal = { label: string; points: number; why: string };

export const RISK_SIGNALS = {
  device_voted_today: {
    label: "Même appareil : 1 vote validé aujourd'hui",
    points: 45,
    why: "L'empreinte de l'appareil (navigateur, écran, carte graphique, langues, fuseau…) a déjà validé un vote aujourd'hui. Deux téléphones strictement identiques peuvent partager une empreinte : ce signal seul ne bloque jamais.",
  },
  device_voted_twice: {
    label: "Même appareil : 2 votes validés ou plus aujourd'hui",
    points: 70,
    why: "Troisième vote de la même empreinte dans la journée. Remplace le signal précédent.",
  },
  local_vote_day: {
    label: "Le stockage local de l'appareil indique déjà un vote aujourd'hui",
    points: 50,
    why: "Le navigateur garde une trace locale du vote du jour. Si elle est présente alors que le cookie n'a pas de vote, les cookies ont été effacés (le stockage local, lui, a été conservé). Un votant honnête ne peut pas se trouver dans ce cas.",
  },
  new_cookie_device_voted: {
    label: "Cookie absent alors que l'appareil a déjà voté aujourd'hui",
    points: 15,
    why: "Le cookie d'appareil posé au début du vote a disparu entre-temps, alors que cette empreinte a déjà voté.",
  },
  device_same_ip: {
    label: "Même appareil et même adresse IP qu'un vote d'aujourd'hui",
    points: 15,
    why: "Renforce le signal d'empreinte quand la connexion est aussi la même. Compté dans le plafond des signaux liés à l'IP.",
  },
  ip_many_votes: {
    label: "Adresse IP : 3 votes validés ou plus aujourd'hui",
    points: 10,
    why: "Plusieurs votes depuis la même connexion. Normal sur le Wi-Fi d'un restaurant : faible poids, plafonné.",
  },
  ip_very_many_votes: {
    label: "Adresse IP : 6 votes validés ou plus aujourd'hui",
    points: 20,
    why: "Beaucoup de votes depuis la même connexion. Remplace le signal précédent ; plafonné.",
  },
  device_same_decoration: {
    label: "Même appareil et même décoration qu'un vote d'aujourd'hui",
    points: 10,
    why: "Un revote vise en général la même décoration.",
  },
  too_fast: {
    label: "Vote validé moins de 6 s après l'ouverture",
    points: 25,
    why: "Trois questions lues et répondues en moins de 6 secondes : plutôt quelqu'un qui connaît déjà le parcours.",
  },
  way_too_fast: {
    label: "Vote validé moins de 2 s après l'ouverture",
    points: 40,
    why: "Impossible à la main. Remplace le signal précédent.",
  },
  webdriver: {
    label: "Navigateur piloté par un automate (webdriver)",
    points: 40,
    why: "Le navigateur déclare être contrôlé par un programme (outil d'automatisation).",
  },
  ua_mismatch: {
    label: "Type d'appareil déclaré incohérent avec l'agent utilisateur",
    points: 15,
    why: "Le navigateur se dit mobile alors que la requête vient d'un ordinateur (ou l'inverse) : signaux falsifiés.",
  },
  browser_mismatch: {
    label: "Navigateur déclaré incohérent avec l'agent utilisateur",
    points: 15,
    why: "Le navigateur annoncé par la page (Chrome, Safari, Firefox…) n'est pas celui que la requête présente au serveur : signaux falsifiés ou outil qui se déguise.",
  },
} as const satisfies Record<string, RiskSignal>;

export type RiskFlag = keyof typeof RISK_SIGNALS;

/** Ordre d'affichage des signaux dans la méthodologie (du plus fort au plus faible). */
export const RISK_SIGNAL_ORDER: RiskFlag[] = [
  "device_voted_twice",
  "device_voted_today",
  "local_vote_day",
  "way_too_fast",
  "webdriver",
  "too_fast",
  "ip_very_many_votes",
  "new_cookie_device_voted",
  "device_same_ip",
  "ua_mismatch",
  "browser_mismatch",
  "ip_many_votes",
  "device_same_decoration",
];

export type RiskSettings = z.infer<typeof riskSettingsSchema>;

export const riskSettingsSchema = z
  .object({
    mode: z.enum(["block", "observe"]),
    flag_threshold: z.number().int().min(0).max(200),
    block_threshold: z.number().int().min(0).max(200),
  })
  .strict()
  .refine((s) => s.flag_threshold < s.block_threshold, { message: "Le seuil de signalement doit être inférieur au seuil de blocage", path: ["flag_threshold"] });

export const DEFAULT_RISK_SETTINGS: RiskSettings = { mode: "block", flag_threshold: 40, block_threshold: 80 };

/** Réglages enregistrés (clé `risk`), ou les valeurs par défaut si absents ou invalides. */
export async function loadRiskSettings(store: { getSetting(key: string): Promise<unknown> }): Promise<RiskSettings> {
  const parsed = riskSettingsSchema.safeParse(await store.getSetting("risk"));
  return parsed.success ? parsed.data : DEFAULT_RISK_SETTINGS;
}

/** Vote validé aujourd'hui par le même appareil (même `device_hash`). */
export type DeviceVote = { voterId: string | null; ip: string | null; decorationId: string | null };

export type RiskInput = {
  /** Votes validés aujourd'hui avec la même empreinte (vide sans empreinte). */
  deviceVotesToday: DeviceVote[];
  /** Nombre de votes validés aujourd'hui depuis la même IP. */
  ipVotesToday: number;
  /** Cookie `hw_voter` absent de la requête. */
  cookieIsNew: boolean;
  voterId: string | null;
  ip: string | null;
  decorationId: string;
  today: string;
  /** `voteDay` lu dans le stockage local de l'appareil (si `voteCompleted`), déclaré par le client. */
  localVoteDay: string | null;
  /** Ouverture de la session → validation ; null si inconnue. */
  durationMs: number | null;
  webdriver: boolean;
  userAgent: string | null;
  /** Ce que la page a déclaré d'elle-même (non fiable : sert aux contrôles de cohérence). */
  declared: { mobile?: boolean; browser?: string };
};

/** Plafond commun des signaux liés à l'IP (Wi-Fi partagé des restaurants) : jamais plus de 20. */
export const IP_POINTS_MAX = 20;

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

/** Famille du navigateur déclaré par la page (« Chrome 130 » → « Chrome »). */
export const browserFamily = (declared: string) => declared.replace(/\s+\d.*$/, "").trim();

export function scoreRisk(input: RiskInput): { score: number; flags: RiskFlag[] } {
  const flags: RiskFlag[] = [];
  let score = 0;
  const add = (flag: RiskFlag) => {
    score += RISK_SIGNALS[flag].points;
    flags.push(flag);
  };
  const n = input.deviceVotesToday.length;
  const sameCookie = (v: DeviceVote) => v.voterId !== null && v.voterId === input.voterId;

  if (n >= 2) add("device_voted_twice");
  else if (n === 1) add("device_voted_today");
  // Le stockage local dit « déjà voté aujourd'hui » mais ce cookie n'a pas de vote : cookies effacés.
  if (input.localVoteDay === input.today && !input.deviceVotesToday.some(sameCookie)) add("local_vote_day");
  if (input.cookieIsNew && n >= 1) add("new_cookie_device_voted");

  let ipPoints = 0;
  const ipFlags: RiskFlag[] = [];
  if (input.ip && input.deviceVotesToday.some((v) => v.ip === input.ip)) {
    ipPoints += RISK_SIGNALS.device_same_ip.points;
    ipFlags.push("device_same_ip");
  }
  if (input.ipVotesToday >= 6) {
    ipPoints += RISK_SIGNALS.ip_very_many_votes.points;
    ipFlags.push("ip_very_many_votes");
  } else if (input.ipVotesToday >= 3) {
    ipPoints += RISK_SIGNALS.ip_many_votes.points;
    ipFlags.push("ip_many_votes");
  }
  score += Math.min(IP_POINTS_MAX, ipPoints);
  flags.push(...ipFlags);

  if (input.deviceVotesToday.some((v) => v.decorationId === input.decorationId)) add("device_same_decoration");
  if (input.durationMs !== null) {
    if (input.durationMs < 2000) add("way_too_fast");
    else if (input.durationMs < 6000) add("too_fast");
  }
  if (input.webdriver) add("webdriver");
  if (input.userAgent && input.declared.mobile !== undefined && input.declared.mobile !== uaIsMobile(input.userAgent)) add("ua_mismatch");
  if (input.userAgent && input.declared.browser) {
    const server = uaBrowser(input.userAgent);
    const client = browserFamily(input.declared.browser);
    if (server !== "Autre" && client !== "Autre" && server !== client) add("browser_mismatch");
  }

  return { score, flags };
}

/** Réponse de GET /api/admin/security (onglet Sécurité). */
export type RiskCounts = { validated: number; flagged: number; blocked: number; excluded: number };
export type TopEntry = { key: string; votes: number; flagged: number };
export type SecuritySummary = { settings: RiskSettings; today: RiskCounts; total: RiskCounts; topIps: TopEntry[]; topDevices: TopEntry[]; toReview: number };

/** Code d'un signal → libellé lisible (code brut si inconnu). */
export const flagLabel = (code: string) => (RISK_SIGNALS as Record<string, RiskSignal>)[code]?.label ?? code;
