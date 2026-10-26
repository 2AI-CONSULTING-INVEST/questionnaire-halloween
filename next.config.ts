import type { NextConfig } from "next";
import { BASE_PATH } from "./src/lib/base-path";
import { securityHeaders } from "./src/lib/csp";

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  // L'app vit sous www.chamas-nord.fr/halloween ; le reste du domaine y est renvoyé (voir redirects).
  basePath: BASE_PATH,
  experimental: {
    agentUpgrade: "security",
  },
  async redirects() {
    return [
      // Pour l'instant, tout le domaine mène au vote : la racine, et tout chemin hors de /halloween
      // (robots.txt, favicon.ico, anciens liens /resultats…), sauf /.well-known/* et /security.txt
      // (conventions de sécurité, à servir à la racine). Temporaire (307) : la racine accueillera
      // autre chose plus tard.
      { source: "/", destination: BASE_PATH, basePath: false, permanent: false },
      { source: `/:path((?!${BASE_PATH.slice(1)}(?:/|$)|\\.well-known(?:/|$)|security\\.txt$).+)`, destination: `${BASE_PATH}/:path`, basePath: false, permanent: false },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: supabaseHost
      ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }]
      : [],
  },
  async headers() {
    return [
      {
        // CSP en Report-Only, HSTS, COOP (src/lib/csp.ts ; passage en mode bloquant : README « Sécurité »).
        source: "/:path*",
        headers: securityHeaders(supabaseHost, process.env.NEXT_PUBLIC_VOTE_VIDEO_URL),
      },
      {
        // Modèles 3D (public/3d, non versionnés dans leur nom) : un jour en cache, puis réutilisés
        // pendant une semaine le temps d'être revérifiés en arrière-plan. Pas d'« immutable ».
        source: "/3d/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
      },
    ];
  },
};

export default nextConfig;
