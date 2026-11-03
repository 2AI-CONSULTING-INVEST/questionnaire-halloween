import { withBase } from "@/lib/base-path";

/**
 * Habillage des trois places du podium (légendes de la cérémonie, modale vidéo) : or, argent,
 * bronze. Mêmes teintes que le panneau de la crypte (crypt.ts, MEDALS) et le classement.
 * Couronnes : emoji « couronne » Fluent (famille des emojis du site) recoloré, en SVG (scripts/crown-variants.py).
 */
export const MEDAL_THEME = {
  1: {
    crown: withBase("/decor/crown-1.svg"),
    text: "text-[#f5c542]",
    pill: "bg-[linear-gradient(135deg,#fff6c2,#f5c542_45%,#a8740a)] text-[#3b2a00]",
    border: "border-[#f5c542]",
    glow: "shadow-[0_0_70px_rgba(245,197,66,0.42)]",
    tint: "bg-[radial-gradient(ellipse_at_top,rgba(245,197,66,0.24),transparent_62%)]",
    halo: "rgba(245,197,66,0.5)",
    particle: "#ffe58a",
  },
  2: {
    crown: withBase("/decor/crown-2.svg"),
    text: "text-[#e3e9f0]",
    pill: "bg-[linear-gradient(135deg,#ffffff,#cfd6e0_45%,#7d8794)] text-[#20252c]",
    border: "border-[#cfd6e0]",
    glow: "shadow-[0_0_60px_rgba(207,214,224,0.32)]",
    tint: "bg-[radial-gradient(ellipse_at_top,rgba(207,214,224,0.18),transparent_62%)]",
    halo: "rgba(207,214,224,0.42)",
    particle: "#e8eef6",
  },
  3: {
    crown: withBase("/decor/crown-3.svg"),
    text: "text-[#eaa66d]",
    pill: "bg-[linear-gradient(135deg,#ffd2a8,#d68a4a_45%,#7a4119)] text-[#2b1406]",
    border: "border-[#d68a4a]",
    glow: "shadow-[0_0_60px_rgba(214,138,74,0.34)]",
    tint: "bg-[radial-gradient(ellipse_at_top,rgba(214,138,74,0.2),transparent_62%)]",
    halo: "rgba(214,138,74,0.45)",
    particle: "#ffb26b",
  },
} as const;

export const pctLabel = (v: number) => `${Math.round(v * 1000) / 10}`.replace(".", ",") + " %";
