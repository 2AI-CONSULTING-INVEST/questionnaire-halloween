"use client";

import type { z } from "zod";
import { isDemoTab } from "@/components/questionnaire/demo";
import { withBase } from "@/lib/base-path";
import type { clickSchema } from "@/lib/clicks";

/** Enregistre un clic (partage, arrivée par lien partagé, abonnement) sans bloquer la page. Jamais en démo. */
export function trackClick(click: z.input<typeof clickSchema>) {
  if (isDemoTab()) return;
  void fetch(withBase("/api/click"), {
    method: "POST",
    keepalive: true, // part même si le clic ouvre un autre site dans l'onglet
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(click),
  }).catch(() => undefined);
}
