/**
 * L'app est servie sous www.chamas-nord.fr/halloween (`basePath` de next.config.ts, figé au build).
 * Next préfixe tout seul <Link>, router, redirect() et les métadonnées, mais pas fetch, les <a> bruts,
 * les chargeurs 3D ni les `src` d'images : ceux-là passent par withBase().
 */
export const BASE_PATH = "/halloween";

export const withBase = (path: string) => `${BASE_PATH}${path}`;
