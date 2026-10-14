import type { MetadataRoute } from "next";
import { BASE_PATH } from "@/lib/base-path";
import { appUrl } from "@/lib/site";

// Servi sous /halloween/robots.txt ; /robots.txt y est redirigé (next.config.ts).
// Pages publiques indexables ; backoffice et API exclus (le backoffice est aussi en noindex).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: [`${BASE_PATH}/admin`, `${BASE_PATH}/api/`] },
    sitemap: appUrl("/sitemap.xml"),
  };
}
