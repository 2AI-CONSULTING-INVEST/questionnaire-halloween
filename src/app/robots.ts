import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// Pages publiques indexables ; backoffice et API exclus (le backoffice est aussi en noindex).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/"] },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
