import type { Metadata } from "next";
import { Questionnaire } from "@/components/questionnaire/Questionnaire";
import { getStore } from "@/lib/db";
import { BASE_PATH } from "@/lib/base-path";
import { HOME } from "@/lib/site";

// Titre complet (« CHAMAS | … ») : ensuite le questionnaire l'adapte à l'étape en cours.
export const metadata: Metadata = {
  title: HOME.title,
  description: HOME.description,
  // Next ne préfixe pas canonical / og:url par basePath.
  alternates: { canonical: BASE_PATH },
};

// Liste des restaurants / décorations : régénérée au plus toutes les 60 s
// (et immédiatement après une modification dans le backoffice).
export const revalidate = 60;

export default async function Home() {
  const store = getStore();
  const [restaurants, decorations] = await Promise.all([store.listRestaurants(), store.listDecorations()]);

  return (
    <Questionnaire
      restaurants={restaurants.map((r) => r.name)}
      decorations={decorations}
      social={{
        url: process.env.NEXT_PUBLIC_SOCIAL_URL || null,
        label: process.env.NEXT_PUBLIC_SOCIAL_LABEL || "page",
      }}
      videoUrl={process.env.NEXT_PUBLIC_VOTE_VIDEO_URL || null}
    />
  );
}
