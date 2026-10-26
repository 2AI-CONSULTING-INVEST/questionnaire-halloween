import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: appUrl("/"), changeFrequency: "daily", priority: 1 },
    { url: appUrl("/resultats"), changeFrequency: "hourly", priority: 0.8 },
    { url: appUrl("/participants"), changeFrequency: "hourly", priority: 0.7 },
    { url: appUrl("/conditions"), changeFrequency: "monthly", priority: 0.2 },
    { url: appUrl("/confidentialite"), changeFrequency: "monthly", priority: 0.2 },
  ];
}
