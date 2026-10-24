"use client";

import { Maximize2, X } from "lucide-react";
import { Dialog } from "radix-ui";
import type { ReactNode } from "react";
import { Button } from "./ui";

/**
 * Coque commune des graphiques agrandis : bouton « Agrandir » sur la carte, modale plein écran
 * (en-tête fixe : titre, « comment lire », Fermer / Échap ; contenu défilant). Le contenu n'est monté
 * qu'à l'ouverture. `viz-root` : les variables de couleur des graphiques, hors du tableau de bord (portail).
 */
export function ChartDialog({ title, howToRead, children }: { title: string; howToRead: string; children: ReactNode }) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <Button variant="ghost" className="!min-h-8" aria-label={`Agrandir : ${title}`}>
          <Maximize2 className="h-4 w-4" aria-hidden /> Agrandir
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="viz-root fixed inset-0 z-50 flex flex-col bg-canvas text-ink outline-none dark:bg-zinc-950 dark:text-zinc-100">
          <header className="flex items-start gap-4 border-b border-line bg-white px-4 py-4 sm:px-8 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-lg font-bold leading-tight text-ink dark:text-zinc-100">{title}</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted dark:text-zinc-400">
                <span className="font-semibold text-ink dark:text-zinc-200">Comment lire ce graphique&nbsp;:</span> {howToRead}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="secondary" className="!min-h-9 shrink-0" aria-label="Fermer (Échap)">
                <X className="h-4 w-4" aria-hidden /> Fermer
              </Button>
            </Dialog.Close>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8">
            <div className="mx-auto flex max-w-7xl flex-col gap-6">{children}</div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
