import "server-only";
import { loadFiltered, summarize } from "./analytics";

/** Résultats publics : aucune donnée personnelle, uniquement les totaux par décoration. */
export async function getPublicResults() {
  const { started, completed, decorations } = await loadFiltered({});
  const s = summarize(started, completed, decorations);
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

export type PublicResults = Awaited<ReturnType<typeof getPublicResults>>;
