import type { Metadata } from "next";
import { getPublicResults } from "@/lib/public-results";
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
  const initial = await getPublicResults();
  return <LiveResults initial={initial} />;
}
