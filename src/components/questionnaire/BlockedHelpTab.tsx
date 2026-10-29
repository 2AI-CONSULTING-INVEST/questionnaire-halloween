"use client";

import { useEffect, useState } from "react";
import { Dialog } from "radix-ui";
import { Info } from "lucide-react";

const SEEN_KEY = "hw-help-seen";

/** Conseils affichés : ce qui fait reconnaître un appareil comme « déjà voté » alors qu'il ne l'a pas fait. */
const TIPS = [
  { title: "Wi-Fi du restaurant", text: "Déconnectez-vous un instant du Wi-Fi Chamas et passez en 4G ou 5G : plusieurs clients sur le même Wi-Fi peuvent être confondus." },
  { title: "Navigation privée", text: "Ouvrez le site dans une fenêtre normale de votre navigateur, pas en navigation privée." },
  { title: "Navigateur", text: "Utilisez Chrome, Safari, Edge ou Firefox. Évitez Brave et les navigateurs anti-pistage, qui brouillent les informations de votre appareil." },
  { title: "VPN", text: "Désactivez votre VPN ou votre relais de confidentialité s'il est actif." },
  { title: "Un seul appareil", text: "Votez depuis votre propre téléphone, sans changer de navigateur ni effacer les données du site au cours de la journée." },
];

const seenToday = (day: string) => {
  try {
    return localStorage.getItem(SEEN_KEY) === day;
  } catch {
    return true; // stockage indisponible : jamais d'ouverture automatique répétée
  }
};

/**
 * Languette en haut à gauche de l'écran « déjà voté » : note d'information pour la personne qui pense
 * n'avoir pas encore voté aujourd'hui. Elle s'ouvre seule une fois par jour quand l'appareil a été
 * reconnu à l'arrivée (`autoOpen`), sans être passé par le vote ; sinon, un clic l'ouvre.
 */
export function BlockedHelpTab({ autoOpen, day }: { autoOpen: boolean; day: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!autoOpen || seenToday(day)) return;
    const id = setTimeout(() => setOpen(true), 900); // après l'apparition de l'écran
    return () => clearTimeout(id);
  }, [autoOpen, day]);

  const change = (o: boolean) => {
    setOpen(o);
    if (!o) {
      try {
        localStorage.setItem(SEEN_KEY, day);
      } catch {
        /* stockage indisponible */
      }
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={change}>
      <Dialog.Trigger
        className="fixed left-0 top-[calc(1rem+env(safe-area-inset-top))] z-40 flex h-11 items-center gap-1.5 rounded-r-xl border border-l-0 border-edge bg-surface/85 pl-2.5 pr-3 text-sm font-semibold text-fg shadow-md shadow-black/25 backdrop-blur-sm transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/60"
        aria-label="Hé ! Ho ! Mais j'ai pas encore voté... Lire les conseils"
      >
        <Info className="h-5 w-5 shrink-0 text-brand day:text-[#451a03]" aria-hidden />
        <span>Hé&nbsp;! Ho&nbsp;! Mais j&apos;ai pas encore voté...</span>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-[fade-in_200ms_ease-out]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto outline-none data-[state=open]:animate-pop">
          <div className="flex flex-col gap-4 rounded-3xl border border-edge bg-solid p-5 shadow-2xl shadow-black/60 sm:p-6">
            <Dialog.Title className="text-xl leading-snug text-fg sm:text-2xl">Vous n&apos;avez pas encore voté aujourd&apos;hui&nbsp;?</Dialog.Title>
            <Dialog.Description className="text-base leading-relaxed text-fg-muted">
              Pour garantir un vote par personne et par jour, votre appareil a été reconnu comme ayant déjà voté. Si ce n&apos;est pas le cas, voici comment éviter d&apos;être bloqué par erreur.
            </Dialog.Description>
            <ul className="flex flex-col gap-2.5">
              {TIPS.map((t) => (
                <li key={t.title} className="rounded-2xl bg-surface-2 px-4 py-3">
                  <p className="text-sm font-semibold text-fg">{t.title}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-fg-muted">{t.text}</p>
                </li>
              ))}
            </ul>
            <p className="text-sm leading-relaxed text-fg-muted">Puis rouvrez cette page. Si vous avez déjà voté aujourd&apos;hui, rendez-vous demain : le vote rouvre à minuit (heure de Paris).</p>
            <Dialog.Close className="min-h-12 rounded-full border border-edge-strong px-6 text-base font-semibold text-fg transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/60">
              J&apos;ai compris
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
