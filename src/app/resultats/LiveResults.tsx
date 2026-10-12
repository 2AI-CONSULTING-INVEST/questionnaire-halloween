"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { HalloweenDecor } from "@/components/HalloweenDecor";
import { Emoji } from "@/components/questionnaire/ui";
import type { PublicResults } from "@/lib/public-results";

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
      <HalloweenDecor />
      <main className="relative z-10 mx-auto max-w-3xl px-4 py-16 sm:px-8">
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-ink">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Retour au vote
        </Link>
        <h1 className="mt-6 text-3xl tracking-tight text-ink sm:text-5xl">
          <Emoji name="trophy" size={48} className="mr-2 h-[1em] w-[1em]" />
          Résultats en direct
        </h1>
        <p className="mt-3 text-gray-600">
          <strong className="text-ink">{data.total.toLocaleString("fr-FR")}</strong> vote{data.total > 1 ? "s" : ""} · mis à jour
          automatiquement
        </p>

        <ol className="mt-10 flex flex-col gap-4">
          {data.results.map((r, i) => (
            <motion.li
              key={r.id}
              layout
              transition={{ duration: 0.4 }}
              className={`flex items-center gap-4 rounded-xl border bg-white p-3 shadow-sm ${i === 0 && r.votes > 0 ? "border-brand ring-2 ring-brand" : "border-line"}`}
            >
              <span className="w-6 text-center text-lg font-bold text-ink">{i + 1}</span>
              <div className="relative hidden aspect-video w-28 shrink-0 overflow-hidden rounded-md bg-gray-100 sm:block">
                <Image src={r.image_url} alt="" fill sizes="112px" className="object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-semibold uppercase text-ink">{r.restaurant_name}</span>
                  <span className="shrink-0 text-sm tabular-nums text-gray-600">
                    {pct(r.share)} · {r.votes}
                  </span>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-gray-100">
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
