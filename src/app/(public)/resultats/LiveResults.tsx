"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Expand, Gift, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useEffect, useState } from "react";
import { useSceneState } from "@/components/scene/scene-state";
import { Emoji } from "@/components/questionnaire/ui";
import { Lantern } from "@/components/ui/Lantern";
import type { PublicResults } from "@/lib/public-results";
import { isLocalMedia, shortName } from "@/lib/schema";
import { displayName, tabTitle } from "@/lib/site";
import { withBase } from "@/lib/base-path";

const pct = (v: number) => `${Math.round(v * 1000) / 10}`.replace(".", ",") + " %";

/**
 * Résultats en direct. Avec le décor 3D, le classement est peint sur le mur de la crypte
 * (la liste reste lisible par les lecteurs d'écran) ; un clic sur le panneau l'ouvre en grand.
 * Sans 3D, la liste s'affiche directement.
 */
export function LiveResults({ initial }: { initial: PublicResults }) {
  const [data, setData] = useState(initial);
  const status = useSceneState((s) => s.status);
  const revealed = useSceneState((s) => s.revealed);
  const boardOpen = useSceneState((s) => s.boardOpen);
  const setBoardOpen = useSceneState((s) => s.setBoardOpen);
  const on3D = status === "ready";

  useEffect(() => {
    useSceneState.getState().setResults(data);
  }, [data]);

  // On referme le classement en quittant la page.
  useEffect(() => () => useSceneState.getState().setBoardOpen(false), []);

  // Titre de l'onglet selon l'étape : ouverture de la crypte, puis restaurant en tête (ou égalité).
  const leaders = data.results.filter((r) => r.votes > 0 && r.votes === Math.max(...data.results.map((o) => o.votes)));
  const standing =
    leaders.length === 1
      ? `${displayName(leaders[0].restaurant_name)} en tête (${pct(leaders[0].share)})`
      : leaders.length > 1
        ? `égalité en tête entre ${leaders.map((r) => displayName(r.restaurant_name)).join(" et ")}`
        : "en attente des premiers votes";
  const title = on3D && !revealed ? "Résultats · Ouverture de la crypte…" : `${boardOpen ? "Classement" : "Résultats"} en direct · ${standing}`;
  useEffect(() => {
    document.title = tabTitle(title);
  }, [title]);

  useEffect(() => {
    const id = setInterval(async () => {
      if (document.hidden) return;
      try {
        const res = await fetch(withBase("/api/results"), { cache: "no-store" });
        if (res.ok) setData(await res.json());
      } catch {
        /* nouvel essai au prochain tick */
      }
    }, 15_000);
    return () => clearInterval(id);
  }, []);

  // Statut de la crypte en haut à droite : les languettes du coin descendent sous lui (globals.css).
  useEffect(() => {
    document.documentElement.toggleAttribute("data-hw-topbar", on3D);
    return () => document.documentElement.removeAttribute("data-hw-topbar");
  }, [on3D]);

  return (
    <main className={`relative z-10 mx-auto max-w-3xl px-4 sm:px-8 ${on3D ? "pt-[max(1rem,env(safe-area-inset-top))]" : "pb-40 pt-28 sm:pt-32"}`}>
      <div className={on3D ? "flex items-start justify-between gap-3 pt-2" : ""}>
        <Link
          href="/"
          className={`inline-flex items-center gap-1 text-sm transition-colors ${on3D ? "rounded-full bg-black/40 px-3 py-1.5 text-white/85 backdrop-blur hover:text-white" : "text-fg-muted hover:text-fg"}`}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Retour au vote
        </Link>
        {on3D &&
          (revealed ? (
            <button
              type="button"
              onClick={() => setBoardOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1.5 text-xs text-white/85 backdrop-blur transition-colors hover:text-white"
            >
              <Expand className="h-3.5 w-3.5" aria-hidden /> Voir le classement en grand
            </button>
          ) : (
            <p className="rounded-full bg-black/40 px-3 py-1.5 text-xs text-white/80 backdrop-blur" aria-live="polite">
              Ouverture de la crypte…
            </p>
          ))}
      </div>
      <h1 className={on3D ? "sr-only" : "mt-6 text-3xl tracking-tight text-fg sm:text-5xl"}>
        <Emoji name="trophy" size={48} className="mr-2 h-[1em] w-[1em]" />
        Résultats en direct
      </h1>
      <p className={on3D ? "sr-only" : "mt-3 text-fg-muted"}>
        <strong className="text-fg">{data.total.toLocaleString("fr-FR")}</strong> vote{data.total > 1 ? "s" : ""} · mis à jour
        automatiquement
      </p>

      <Ranking data={data} className={on3D ? "sr-only" : "mt-10"} />

      {/* Lien discret vers le tirage au sort (lots, participants, gagnants). */}
      <p className={on3D ? "fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-0 right-0 z-10 text-center" : "mt-8 text-center"}>
        <Link
          href="/participants"
          className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs transition-colors ${on3D ? "bg-black/40 text-white/80 backdrop-blur hover:text-white" : "text-fg-muted hover:text-fg"}`}
        >
          <Gift className="h-3.5 w-3.5" aria-hidden /> Tirage au sort : lots et participants
        </Link>
      </p>

      {/* Classement en grand, net, au centre de l'écran, sur fond flouté */}
      <Dialog.Root open={on3D && boardOpen} onOpenChange={setBoardOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/55 backdrop-blur-md data-[state=open]:animate-[fade-in_200ms_ease-out]" />
          <Dialog.Content
            aria-describedby={undefined}
            // Plein écran : un clic hors du panneau (sur le fond, la motte, le poteau) referme.
            onClick={(e) => !(e.target as Element).closest("[data-board]") && setBoardOpen(false)}
            className="fixed inset-0 z-50 outline-none data-[state=open]:animate-[fade-in_200ms_ease-out] [--mw:min(1150px,130vw)] [--ridge:calc(var(--mw)*0.15)]"
          >
            {/* Le panneau repose sur la crête de la motte, juste derrière elle (la motte passe devant
                son bord bas). Hauteur limitée pour que le poteau tienne dans l'écran. */}
            <div
              data-board
              className="absolute bottom-[var(--ridge)] left-4 right-16 sm:left-1/2 sm:right-auto sm:w-[calc(100%-2.5rem)] sm:max-w-lg sm:-translate-x-1/2"
            >
              {/* Poteau-lanterne (KayKit) planté dans la motte, à droite : le mât passe derrière le
                  panneau, la lanterne se balance devant, au coin haut droit (deux plans). */}
              <LanternPost className="-z-10" />
              {/* Fermer : au-dessus du panneau, à son coin haut gauche. */}
              <Dialog.Close
                aria-label="Fermer"
                className="absolute bottom-full left-0 z-20 mb-2 flex h-10 w-10 items-center justify-center rounded-full border border-brand/60 bg-surface text-fg shadow-lg shadow-black/60 transition-colors hover:bg-surface-2"
              >
                <X className="h-5 w-5" />
              </Dialog.Close>
              <div className="relative flex h-[calc((100dvh-var(--ridge)-1rem)/1.3)] sm:h-[calc((100dvh-var(--ridge)-1rem)/1.08)] flex-col overflow-hidden rounded-3xl border border-brand/60 bg-surface shadow-2xl shadow-black/70">
                <header className="flex items-center gap-3 border-b border-edge px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <Dialog.Title className="text-lg font-extrabold uppercase tracking-wider text-brand">Classement</Dialog.Title>
                    <p className="text-xs text-fg-muted">
                      {data.total.toLocaleString("fr-FR")} vote{data.total > 1 ? "s" : ""} · mis à jour en direct
                    </p>
                  </div>
                </header>
                <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-10 sm:p-5 sm:pb-12">
                  <Ranking data={data} large />
                </div>
              </div>
              <LanternPost front />
            </div>
            {/* Motte de terre (rendu des assets KayKit Halloween Bits + Forest Nature), au bas-centre
                de l'écran, légèrement enfoncée sous le bord. */}
            <Image
              src={withBase("/decor/modal-mound.png")}
              alt=""
              width={2018}
              height={585}
              unoptimized
              aria-hidden
              priority
              className="pointer-events-none absolute bottom-0 left-1/2 h-auto w-[var(--mw)] max-w-none -translate-x-1/2 translate-y-[22%] select-none drop-shadow-[0_-6px_24px_rgba(0,0,0,0.5)]"
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </main>
  );
}

/**
 * Poteau-lanterne (rendu KayKit, mât allongé) planté dans la motte à droite du panneau.
 * Hauteur liée au panneau : de 6 % au-dessus de lui (24 % sur mobile : la lanterne pend alors
 * au-dessus) jusqu'à 6 % sous son bord (pied planté dans la motte). Mât à 83 % de la largeur.
 * Deux plans : le poteau derrière le panneau ; devant, la lanterne (image à part, accrochée sous le
 * bout du bras) qui se balance, avec son halo et les insectes qui tournent autour.
 */
function LanternPost({ front = false, className = "" }: { front?: boolean; className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute -bottom-[6%] -top-[24%] sm:-top-[6%] right-0 translate-x-[calc(17%+22px)] sm:translate-x-[calc(17%+110px)] ${front ? "z-10" : ""} ${className}`}
    >
      {/* Devant, l'image (invisible) ne sert qu'à donner au plan la taille du poteau. */}
      <Image
        src={withBase("/decor/modal-post.png")}
        alt=""
        unoptimized
        width={695}
        height={3581}
        className={`h-full w-auto max-w-none select-none drop-shadow-[0_8px_18px_rgba(0,0,0,0.55)] ${front ? "invisible" : ""}`}
      />
      {front && <Lantern />}
    </div>
  );
}

/** Podium : or, argent, bronze (bordure, halo, pastille du rang, barre de progression). */
const MEDALS = [
  {
    name: "Or",
    row: "border-[#f5c542] ring-2 ring-[#f5c542]/60 shadow-[0_0_28px_rgba(245,197,66,0.28)] bg-[linear-gradient(100deg,rgba(245,197,66,0.2),rgba(245,197,66,0.04)_55%,transparent)]",
    badge: "bg-[radial-gradient(circle_at_35%_30%,#fff6c2,#f5c542_45%,#a8740a)] text-[#3b2a00] shadow-[0_0_14px_rgba(245,197,66,0.6)]",
    bar: "bg-[linear-gradient(90deg,#b8860b,#f5c542,#fff1a8)]",
    text: "text-[#f5c542]",
  },
  {
    name: "Argent",
    row: "border-[#cfd6e0] ring-1 ring-[#cfd6e0]/50 bg-[linear-gradient(100deg,rgba(207,214,224,0.14),transparent_55%)]",
    badge: "bg-[radial-gradient(circle_at_35%_30%,#ffffff,#cfd6e0_45%,#7d8794)] text-[#20252c] shadow-[0_0_10px_rgba(207,214,224,0.45)]",
    bar: "bg-[linear-gradient(90deg,#7d8794,#cfd6e0,#ffffff)]",
    text: "text-[#dfe5ec]",
  },
  {
    name: "Bronze",
    row: "border-[#d68a4a] ring-1 ring-[#d68a4a]/50 bg-[linear-gradient(100deg,rgba(214,138,74,0.16),transparent_55%)]",
    badge: "bg-[radial-gradient(circle_at_35%_30%,#ffd2a8,#d68a4a_45%,#7a4119)] text-[#2b1406] shadow-[0_0_10px_rgba(214,138,74,0.45)]",
    bar: "bg-[linear-gradient(90deg,#7a4119,#d68a4a,#ffd2a8)]",
    text: "text-[#e9a46b]",
  },
] as const;

function Ranking({ data, className = "", large = false }: { data: PublicResults; className?: string; large?: boolean }) {
  const max = Math.max(1, ...data.results.map((r) => r.votes));
  return (
    <ol className={`flex flex-col gap-3 ${className}`}>
      {data.results.map((r) => {
        // Rang « sportif » : les ex æquo partagent le même rang (et la même médaille).
        const rank = 1 + data.results.filter((o) => o.votes > r.votes).length;
        const medal = r.votes > 0 ? MEDALS[rank - 1] : undefined;
        return (
          <motion.li
            key={r.id}
            layout
            transition={{ duration: 0.4 }}
            className={`flex items-center gap-3 rounded-2xl border bg-surface/90 p-2.5 shadow-lg shadow-black/20 backdrop-blur-sm sm:gap-4 sm:p-3 ${medal ? medal.row : "border-edge"}`}
          >
            <span
              title={medal?.name}
              className={`flex shrink-0 items-center justify-center rounded-full font-extrabold tabular-nums ${large ? "h-9 w-9 text-base" : "h-8 w-8 text-sm"} ${
                medal ? medal.badge : "bg-surface-2 text-fg-muted"
              }`}
            >
              {rank}
            </span>
            <div className={`relative aspect-[3/4] shrink-0 overflow-hidden rounded-lg bg-surface-2 ${large ? "w-16 sm:w-20" : "w-12 sm:w-16"}`}>
              <Image src={r.image_url} alt="" fill sizes={large ? "160px" : "64px"} unoptimized={isLocalMedia(r.image_url)} className="object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className={`truncate text-sm font-bold uppercase ${medal ? medal.text : "text-fg"}`}>{shortName(r.restaurant_name)}</span>
                <span className="shrink-0 text-sm tabular-nums text-fg-muted">
                  {pct(r.share)} · {r.votes}
                </span>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-surface-2">
                <motion.div
                  className={`h-full rounded-full ${medal ? medal.bar : "bg-fg-muted/50"}`}
                  initial={false}
                  animate={{ width: `${(r.votes / max) * 100}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
              </div>
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}
