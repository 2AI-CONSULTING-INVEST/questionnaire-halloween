"use client";

import { useEffect } from "react";
import { isDemoTab } from "@/components/questionnaire/demo";
import { trackClick } from "@/components/track-click";
import { withBase } from "@/lib/base-path";
import { REF_RE, SHARE_TARGETS, type ShareTarget } from "@/lib/clicks";
import { deviceSignals } from "@/lib/fingerprint";

const SENT_KEY = "hw-visit";

/**
 * Compteur de visites : une fois par onglet et par session de navigation (sessionStorage), après le
 * chargement et dans un moment creux, la page envoie `POST /api/visit` avec sa route, sa provenance
 * et les signaux d'appareil (src/lib/fingerprint.ts). Rien de visible, aucune permission. Jamais en démo.
 * Arrivée par un lien partagé (`?via=<réseau>&r=<code>`, voir ShareButtons) : enregistrée à part, une fois par session.
 */
export function VisitBeacon() {
  useEffect(() => {
    try {
      if (isDemoTab() || sessionStorage.getItem(SENT_KEY)) return;
      sessionStorage.setItem(SENT_KEY, "1");
    } catch {
      return; // sans sessionStorage (navigation privée stricte), pas de beacon plutôt qu'un beacon à chaque page
    }
    const send = async () => {
      const { hash, mobile, platform, browser, screen, touch, webdriver } = await deviceSignals();
      await fetch(withBase("/api/visit"), {
        method: "POST",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: window.location.pathname, referrer: document.referrer || undefined, device: { hash, mobile, platform, browser, screen, touch, webdriver } }),
      });
    };
    const params = new URLSearchParams(window.location.search);
    const via = params.get("via") as ShareTarget | null;
    const ref = params.get("r");
    if (via && SHARE_TARGETS.includes(via) && ref && REF_RE.test(ref)) trackClick({ kind: "arrival", target: via, ref });
    const run = () => send().catch(() => undefined);
    if ("requestIdleCallback" in window) window.requestIdleCallback(run, { timeout: 3000 });
    else setTimeout(run, 1500);
  }, []);
  return null;
}
