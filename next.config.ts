import type { NextConfig } from "next";
import { BASE_PATH } from "./src/lib/base-path";

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  // L'app vit sous www.chamas-nord.fr/halloween ; le reste du domaine y est renvoyé (voir redirects).
  basePath: BASE_PATH,
  async redirects() {
    return [
      // Pour l'instant, tout le domaine mène au vote : la racine, et tout chemin hors de /halloween
      // (robots.txt, favicon.ico, anciens liens /resultats…). Temporaire (307) : la racine
      // accueillera autre chose plus tard.
      { source: "/", destination: BASE_PATH, basePath: false, permanent: false },
      { source: `/:path((?!${BASE_PATH.slice(1)}(?:/|$)).+)`, destination: `${BASE_PATH}/:path`, basePath: false, permanent: false },
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
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
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
