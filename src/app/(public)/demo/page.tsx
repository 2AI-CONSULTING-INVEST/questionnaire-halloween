import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Questionnaire } from "@/components/questionnaire/Questionnaire";
import { currentRole } from "@/lib/auth";
import { getStore } from "@/lib/db";

/**
 * Espace démo : le vrai questionnaire (mêmes restaurants, mêmes photos, même décor 3D), mais
 * aucun vote ni inscription au tirage n'est envoyé au serveur. Réservé aux comptes du backoffice.
 */
export const metadata: Metadata = {
  title: "Démo du questionnaire",
  robots: { index: false, follow: false },
};

export default async function DemoPage() {
  if (!(await currentRole())) redirect("/admin/login");
  const store = getStore();
  const [restaurants, decorations] = await Promise.all([store.listRestaurants(), store.listDecorations()]);

  return (
    <Questionnaire
      demo
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
