import type { Metadata } from "next";
import { getPublicResults } from "@/lib/public-results";
import { LiveResults } from "./LiveResults";

export const revalidate = 15;

export const metadata: Metadata = {
  title: "Résultats en direct — Halloween Chamas Tacos 🎃",
};

export default async function ResultsPage() {
  const initial = await getPublicResults();
  return <LiveResults initial={initial} />;
}
