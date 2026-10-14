/**
 * Identité du site pour les onglets et les aperçus de liens (Open Graph, X, WhatsApp…).
 * Tous les titres d'onglet commencent par « CHAMAS | », suivi de la page ou de l'étape en cours.
 */
export const BRAND = "CHAMAS";
export const tabTitle = (page: string) => `${BRAND} | ${page}`;

export const SITE_NAME = "Vote Halloween Chamas Tacos";

/** Base commune des aperçus : une page qui redéfinit openGraph remplace tout l'objet du layout. */
export const OG_BASE = { type: "website", locale: "fr_FR", siteName: "Chamas Tacos" } as const;

export const HOME = {
  title: "Halloween : votez pour la meilleure déco de restaurant",
  description:
    "Halloween chez Chamas Tacos : votez en 2 minutes pour le restaurant le mieux décoré et tentez de gagner l'un de nos nombreux lots au tirage au sort.",
  /** Titre et texte des aperçus de lien (plus accrocheurs que ceux de l'onglet). */
  shareTitle: "🎃 Votez pour la déco Halloween la plus effrayante de Chamas Tacos !",
  shareDescription:
    "Élisez le restaurant Chamas Tacos le mieux décoré pour Halloween : un vote en 2 minutes, et un tirage au sort pour gagner l'un de nos nombreux lots.",
};

export const RESULTS = {
  title: "Résultats en direct du vote Halloween",
  description:
    "Classement en direct du vote Halloween Chamas Tacos : découvrez quel restaurant a la décoration la plus effrayante, mis à jour en temps réel.",
  shareTitle: "🏆 Résultats en direct du vote Halloween Chamas Tacos",
  shareDescription: "Quel restaurant Chamas Tacos a la décoration Halloween la plus effrayante ? Le classement se met à jour en temps réel.",
};

/**
 * URL publique (liens absolus des aperçus). Sans NEXT_PUBLIC_SITE_URL, on prend l'URL de production
 * Vercel : sinon les images d'aperçu pointeraient vers localhost une fois en ligne.
 */
export function siteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  return vercel ? `https://${vercel}` : "http://localhost:3000";
}

/** « CHAMAS TACOS - LILLE MOULINS » → « Lille Moulins ». */
export const displayName = (restaurant: string) =>
  restaurant
    .replace(/^CHAMAS TACOS\s*-\s*/i, "")
    .toLowerCase()
    .replace(/(^|[\s-])\p{L}/gu, (m) => m.toUpperCase());
