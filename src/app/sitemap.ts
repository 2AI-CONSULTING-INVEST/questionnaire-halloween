import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: appUrl("/"), changeFrequency: "daily", priority: 1 },
    { url: appUrl("/resultats"), changeFrequency: "hourly", priority: 0.8 },
  ];
}
