import type { ReactNode } from "react";
import { PreloadScene } from "@/components/scene/PreloadScene";
import { SpookyBackdrop } from "@/components/scene/SpookyBackdrop";

/**
 * Pages publiques (questionnaire, résultats, participants) : le décor 3D est monté ici, une seule
 * fois, pour que la caméra puisse voyager d'une page à l'autre sans recharger la scène.
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PreloadScene />
      <SpookyBackdrop />
      {children}
    </>
  );
}
