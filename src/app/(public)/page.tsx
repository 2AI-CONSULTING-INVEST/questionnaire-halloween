import type { Metadata } from "next";
import { ContestOver } from "@/components/contest/ContestOver";
import { Questionnaire } from "@/components/questionnaire/Questionnaire";
import { drawResultsOf, drawWinners, loadContest, winnersVisible } from "@/lib/contest";
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

// Liste des restaurants / décorations / lots : régénérée au plus toutes les 60 s
// (et immédiatement après une modification dans le backoffice).
export const revalidate = 60;

export default async function Home() {
  const store = getStore();
  // Concours terminé (onglet « Concours » du backoffice) : plus de questionnaire, les routes de vote refusent aussi.
  const contest = await loadContest(store);
  if (contest.closed) {
    // Gagnants secrets avant la vidéo : rien n'est même lu ; ensuite, seuls le lot et le pseudo vont au navigateur.
    const [prizes, participants] = winnersVisible(contest) ? await Promise.all([store.listPrizes(), store.listParticipants()]) : [[], []];
    const winners = drawWinners(contest, prizes, participants).map(({ prize, pseudo }) => ({ id: prize.id, name: prize.name, image_url: prize.image_url, pseudo }));
    return <ContestOver results={drawResultsOf(contest)} winners={winners} />;
  }

  // Lots : seulement nom, description et image (jamais le gagnant) pour la confirmation du « Non ».
  const [restaurants, decorations, prizes] = await Promise.all([store.listRestaurants(), store.listDecorations(), store.listPrizes()]);

  return (
    <Questionnaire
      restaurants={restaurants.map((r) => r.name)}
      decorations={decorations}
      prizes={prizes.map((p) => ({ id: p.id, name: p.name, description: p.description, image_url: p.image_url }))}
      social={{
        url: process.env.NEXT_PUBLIC_SOCIAL_URL || null,
        label: process.env.NEXT_PUBLIC_SOCIAL_LABEL || "page",
      }}
      videoUrl={process.env.NEXT_PUBLIC_VOTE_VIDEO_URL || null}
    />
  );
}
