import { browserFamily, uaBrowser, uaIsMobile } from "./risk";
import type { Device, Visit } from "./schema";

/**
 * Compteur de visites avec rejet des robots. Fonctions pures, partagées serveur / navigateur
 * (libellés de l'onglet Journal) : aucun import serveur ici. Aucune méthode n'est imparable ;
 * plusieurs barrières indépendantes se combinent (voir VISIT_REJECTIONS, affichées aux admins).
 */

/** « bot » seulement en mot entier ou suivi de « / ; ) » (Googlebot/2.1, AhrefsBot)) : pas « Cubot X20 » (téléphone). */
export const BOT_UA_RE = /\bbot\b|bot\/|bot;|bot\)|crawl|spider|slurp|headless|phantom|lighthouse|pagespeed|facebookexternalhit|whatsapp|telegram|discord|skype|slack|preview|curl|wget|python|go-http|okhttp|node-fetch|axios|httpclient/i;

/** Raisons de rejet (colonne `visits.rejected`) et leur explication, en français simple. */
export const VISIT_REJECTIONS = {
  ua_bot: { label: "Robot déclaré", why: "Le navigateur se présente comme un robot connu (Google, Facebook, WhatsApp, curl…) ou ne se présente pas du tout." },
  webdriver: { label: "Navigateur automatisé", why: "Le navigateur déclare être piloté par un programme (outil d'automatisation)." },
  no_js_signals: { label: "Sans JavaScript", why: "Le beacon n'est envoyé que par la page une fois son JavaScript exécuté, avec une empreinte d'appareil : un robot qui ne l'exécute pas n'envoie rien, et celui qui imite l'appel sans calculer l'empreinte est écarté." },
  ua_mismatch: { label: "Appareil incohérent", why: "Ce que la page déclare d'elle-même (mobile ou non, navigateur) ne correspond pas à ce que la requête présente au serveur : signaux falsifiés." },
} as const;

export type VisitRejection = keyof typeof VISIT_REJECTIONS;

export const rejectionLabel = (code: string) => (VISIT_REJECTIONS as Record<string, { label: string }>)[code]?.label ?? code;

/** Décision de rejet d'un beacon : la raison, ou null si la visite est comptée. */
export function visitRejection(userAgent: string | null, device: Device | undefined): VisitRejection | null {
  if (!userAgent || BOT_UA_RE.test(userAgent)) return "ua_bot";
  if (device?.webdriver) return "webdriver";
  if (!device?.hash) return "no_js_signals";
  if (device.mobile !== undefined && device.mobile !== uaIsMobile(userAgent)) return "ua_mismatch";
  if (device.browser) {
    const server = uaBrowser(userAgent);
    const client = browserFamily(device.browser);
    if (server !== "Autre" && client !== "Autre" && server !== client) return "ua_mismatch";
  }
  return null;
}

/** Hôte du referrer (≤ 120 caractères), ou null s'il est absent, invalide ou interne. */
export function referrerHost(referrer: string | undefined, ownHost: string | null): string | null {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).host.toLowerCase();
    return host && host !== ownHost ? host.slice(0, 120) : null;
  } catch {
    return null;
  }
}

export type VisitCounts = { visits: number; unique: number; rejected: number };
export type VisitTop = { key: string; count: number };
/** Réponse de GET /api/admin/visits/summary (onglet Journal). */
export type VisitsSummary = {
  today: VisitCounts;
  total: VisitCounts;
  devices: { mobile: number; desktop: number };
  referrers: VisitTop[];
  browsers: VisitTop[];
  daily: { date: string; visits: number; unique: number }[];
};

/** Clé d'un visiteur : son empreinte, sinon son cookie de vote ; null = impossible à dédoublonner. */
export const visitorKey = (v: Pick<Visit, "device_hash" | "visitor_id">) => v.device_hash ?? v.visitor_id;

type VisitLike = Pick<Visit, "day" | "ip" | "path" | "rejected" | "device_hash" | "visitor_id">;
/**
 * Dédoublonnage des beacons (même règle dans les deux stores) : une visite comptée par (jour, page,
 * visiteur) ; une ligne rejetée par (jour, IP, raison), pour que les robots ne remplissent pas la table.
 */
export function isDuplicateVisit(existing: VisitLike, incoming: VisitLike): boolean {
  if (existing.day !== incoming.day) return false;
  if (incoming.rejected) return existing.rejected === incoming.rejected && existing.ip === incoming.ip;
  const key = visitorKey(incoming);
  return key !== null && !existing.rejected && existing.path === incoming.path && visitorKey(existing) === key;
}

/** Agrégats du compteur de visites, à partir de toutes les lignes (comptées et rejetées). */
export function summarizeVisits(rows: Visit[], today: string): VisitsSummary {
  const counted = rows.filter((v) => !v.rejected);
  const counts = (list: Visit[]): VisitCounts => ({
    visits: list.filter((v) => !v.rejected).length,
    unique: new Set(list.filter((v) => !v.rejected).map((v) => `${v.day}|${visitorKey(v) ?? v.id}`)).size,
    rejected: list.filter((v) => v.rejected).length,
  });
  const top = (key: (v: Visit) => string | null | undefined) => {
    const m = new Map<string, number>();
    for (const v of counted) {
      const k = key(v);
      if (k) m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()]
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
      .slice(0, 5);
  };
  const perDay = new Map<string, { visits: number; keys: Set<string> }>();
  for (const v of counted) {
    const d = perDay.get(v.day) ?? { visits: 0, keys: new Set<string>() };
    d.visits += 1;
    d.keys.add(visitorKey(v) ?? v.id);
    perDay.set(v.day, d);
  }
  return {
    today: counts(rows.filter((v) => v.day === today)),
    total: counts(rows),
    devices: { mobile: counted.filter((v) => v.device_info?.mobile === true).length, desktop: counted.filter((v) => v.device_info?.mobile === false).length },
    referrers: top((v) => v.referrer),
    browsers: top((v) => (v.device_info?.browser ? browserFamily(v.device_info.browser) : v.user_agent ? uaBrowser(v.user_agent) : null)),
    daily: [...perDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, d]) => ({ date, visits: d.visits, unique: d.keys.size })),
  };
}
