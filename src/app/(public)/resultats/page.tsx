import type { Metadata } from "next";
import { podiumSlots } from "@/components/scene/podium";
import { loadContest } from "@/lib/contest";
import { getStore } from "@/lib/db";
import { getPublicResults } from "@/lib/public-results";
import { groupDecorations, mediaKind } from "@/lib/schema";
import { withBase } from "@/lib/base-path";
import { OG_BASE, RESULTS } from "@/lib/site";
import { LiveResults } from "./LiveResults";

export const revalidate = 15;

// Image d'aperçu : opengraph-image.jpg de ce dossier. Le titre de l'onglet suit ensuite l'étape
// (ouverture de la crypte, classement, restaurant en tête) : voir LiveResults.
export const metadata: Metadata = {
  title: RESULTS.title,
  description: RESULTS.description,
  // Next ne préfixe pas canonical / og:url par basePath.
  alternates: { canonical: withBase("/resultats") },
  openGraph: { ...OG_BASE, url: withBase("/resultats"), title: RESULTS.shareTitle, description: RESULTS.shareDescription },
  twitter: { card: "summary_large_image", title: RESULTS.shareTitle, description: RESULTS.shareDescription },
};

export default async function ResultsPage() {
  const store = getStore();
  const [initial, contest] = await Promise.all([getPublicResults(), loadContest(store)]);
  if (!contest.closed) return <LiveResults initial={initial} />;
  // Concours terminé : vidéo de chaque restaurant du podium (sa première vidéo, sinon sa première photo).
  const groups = groupDecorations(await store.listDecorations());
  const media: Record<string, string> = {};
  for (const { entry } of podiumSlots(initial.results)) {
    const items = groups.find((g) => g.restaurant_name === entry.restaurant_name)?.items ?? [];
    const pick = items.find((d) => mediaKind(d.image_url) === "video") ?? items[0];
    if (pick) media[entry.restaurant_name] = pick.image_url;
  }
  return <LiveResults initial={initial} closed media={media} />;
}
