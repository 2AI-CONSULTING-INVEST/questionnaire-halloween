import Link from "next/link";
import type { ReactNode } from "react";
import { PreloadScene } from "@/components/scene/PreloadScene";
import { SpookyBackdrop } from "@/components/scene/SpookyBackdrop";
import { CornerRail } from "@/components/ui/CornerRail";
import { DemoBar } from "@/components/ui/DemoBar";
import { VisitBeacon } from "@/components/VisitBeacon";

/**
 * Pages publiques (questionnaire, résultats, participants) : le décor 3D est monté ici, une seule
 * fois, pour que la caméra puisse voyager d'une page à l'autre sans recharger la scène. Les
 * languettes du coin haut-droit (compte à rebours du prochain vote, son) y sont aussi, avec le bandeau de l'espace démo.
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PreloadScene />
      <SpookyBackdrop />
      {children}
      <footer className="relative z-10 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-center text-xs text-fg-muted">
        <Link href="/conditions" className="underline-offset-2 hover:text-fg hover:underline">
          Conditions d&apos;utilisation
        </Link>
        {" · "}
        <Link href="/confidentialite" className="underline-offset-2 hover:text-fg hover:underline">
          Confidentialité
        </Link>
      </footer>
      <CornerRail />
      <DemoBar />
      <VisitBeacon />
    </>
  );
}
