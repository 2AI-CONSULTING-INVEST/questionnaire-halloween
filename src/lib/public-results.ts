import "server-only";
import { loadFiltered, summarize, type Summary } from "./analytics";

/**
 * Résultats publics : aucune donnée personnelle, uniquement les totaux par décoration. Les champs sont
 * recopiés un à un : tout ce que `Summary` gagne par ailleurs (détail des modales du backoffice) reste
 * privé (prouvé par tests/unit/analytics.test.ts).
 */
export function toPublicResults(s: Summary) {
  return {
    total: s.kpis.totalVotes,
    results: s.byDecoration.map(({ id, restaurant_name, image_url, votes, share }) => ({
      id,
      restaurant_name,
      image_url,
      votes,
      share,
    })),
    updatedAt: s.updatedAt,
  };
}

export async function getPublicResults() {
  const { started, completed, decorations } = await loadFiltered({});
  return toPublicResults(summarize(started, completed, decorations));
}

export type PublicResults = ReturnType<typeof toPublicResults>;
