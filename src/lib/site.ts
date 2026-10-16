/**
 * Identité du site pour les onglets et les aperçus de liens (Open Graph, X, WhatsApp…).
 * Tous les titres d'onglet commencent par « CHAMAS | », suivi de la page ou de l'étape en cours.
 */
import { BASE_PATH } from "./base-path";

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
  shareDescription: "Quel restaurant Chamas Tacos a La décoration d'Halloween la plus effrayante ? Le classement se met à jour en temps réel.",
};

export const PARTICIPANTS = {
  title: "Tirage au sort Halloween : participants et lots",
  description:
    "Les lots à gagner au tirage au sort Halloween Chamas Tacos, la liste des participants inscrits et les gagnants dès qu'ils sont tirés au sort.",
  shareTitle: "🎁 Tirage au sort Halloween Chamas Tacos : les lots et les participants",
  shareDescription: "Découvrez les lots à gagner et la liste des participants au tirage au sort Halloween de Chamas Tacos.",
};

/** Pages Chamas Tacos Lille sur les réseaux sociaux (cartes « S'abonner »). */
export const SOCIAL_LINKS = {
  instagram: { handle: "@chamastacos_lille", url: "https://www.instagram.com/chamastacos_lille/" },
  tiktok: { handle: "@chamastacos_lille", url: "https://www.tiktok.com/@chamastacos_lille" },
} as const;

/** Domaine de production. */
export const PROD_ORIGIN = "https://www.chamas-nord.fr";

/**
 * Origine publique, sans chemin (liens absolus des aperçus, sitemap) : NEXT_PUBLIC_SITE_URL, sinon
 * le domaine de production sur Vercel (les images d'aperçu ne doivent jamais pointer vers localhost),
 * l'URL du déploiement pour les prévisualisations, et localhost en local.
 * Tolère une valeur saisie avec /halloween ou un « / » final.
 */
export function siteUrl() {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/+$/, "").replace(new RegExp(`${BASE_PATH}$`), "");
  if (process.env.VERCEL_ENV === "production") return PROD_ORIGIN;
  return process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000";
}

/** Adresse publique du vote : www.chamas-nord.fr/halloween. */
export const appUrl = (path = "") => `${siteUrl()}${BASE_PATH}${path}`;

/** « CHAMAS TACOS - LILLE MOULINS » → « Lille Moulins ». */
export const displayName = (restaurant: string) =>
  restaurant
    .replace(/^CHAMAS TACOS\s*-\s*/i, "")
    .toLowerCase()
    .replace(/(^|[\s-])\p{L}/gu, (m) => m.toUpperCase());
