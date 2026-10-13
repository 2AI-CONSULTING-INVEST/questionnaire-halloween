"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { SpookyBackdrop } from "@/components/scene/SpookyBackdrop";
import { Emoji } from "@/components/questionnaire/ui";
import type { PublicResults } from "@/lib/public-results";
import { shortName } from "@/lib/schema";

const pct = (v: number) => `${Math.round(v * 1000) / 10}`.replace(".", ",") + " %";

export function LiveResults({ initial }: { initial: PublicResults }) {
  const [data, setData] = useState(initial);

  useEffect(() => {
    const id = setInterval(async () => {
      if (document.hidden) return;
      try {
        const res = await fetch("/api/results", { cache: "no-store" });
        if (res.ok) setData(await res.json());
      } catch {
        /* nouvel essai au prochain tick */
      }
    }, 15_000);
    return () => clearInterval(id);
  }, []);

  const max = Math.max(1, ...data.results.map((r) => r.votes));

  return (
    <div className="relative min-h-dvh">
      <SpookyBackdrop />
      <main className="relative z-10 mx-auto max-w-3xl px-4 pb-40 pt-28 sm:px-8 sm:pt-32">
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-fg-muted transition-colors hover:text-fg">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Retour au vote
        </Link>
        <h1 className="mt-6 text-3xl tracking-tight text-fg sm:text-5xl">
          <Emoji name="trophy" size={48} className="mr-2 h-[1em] w-[1em]" />
          Résultats en direct
        </h1>
        <p className="mt-3 text-fg-muted">
          <strong className="text-fg">{data.total.toLocaleString("fr-FR")}</strong> vote{data.total > 1 ? "s" : ""} · mis à jour
          automatiquement
        </p>

        <ol className="mt-10 flex flex-col gap-3">
          {data.results.map((r, i) => (
            <motion.li
              key={r.id}
              layout
              transition={{ duration: 0.4 }}
              className={`flex items-center gap-3 rounded-2xl border bg-surface/90 p-2.5 shadow-lg shadow-black/20 backdrop-blur-sm sm:gap-4 sm:p-3 ${
                i === 0 && r.votes > 0 ? "border-brand ring-2 ring-brand" : "border-edge"
              }`}
            >
              <span className="w-6 shrink-0 text-center text-lg font-bold text-fg">{i + 1}</span>
              <div className="relative aspect-[3/4] w-12 shrink-0 overflow-hidden rounded-lg bg-surface-2 sm:w-16">
                <Image src={r.image_url} alt="" fill sizes="64px" className="object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-bold uppercase text-fg">{shortName(r.restaurant_name)}</span>
                  <span className="shrink-0 text-sm tabular-nums text-fg-muted">
                    {pct(r.share)} · {r.votes}
                  </span>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-surface-2">
                  <motion.div
                    className="h-full rounded-full bg-brand"
                    initial={false}
                    animate={{ width: `${(r.votes / max) * 100}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                </div>
              </div>
            </motion.li>
          ))}
        </ol>
      </main>
    </div>
  );
}
