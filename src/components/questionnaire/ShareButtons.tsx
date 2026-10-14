"use client";

import { BASE_PATH } from "@/lib/base-path";

const TEXT = "🎃 Je viens de voter pour la meilleure décoration Halloween Chamas Tacos ! À votre tour 👻";

/** Lien partagé : la page du vote (www.chamas-nord.fr/halloween). */
function shareUrl() {
  const origin = process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== "undefined" ? window.location.origin : "");
  // Tolère une valeur saisie avec /halloween ou un « / » final.
  return origin.replace(/\/+$/, "").replace(new RegExp(`${BASE_PATH}$`), "") + BASE_PATH;
}

export function ShareButtons() {
  const open = (href: string) => window.open(href, "_blank", "noopener,noreferrer,width=600,height=560");
  const url = encodeURIComponent(shareUrl());
  const text = encodeURIComponent(TEXT);
  const buttons = [
    {
      label: "Partager sur Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      bg: "bg-[#1877F2]",
      icon: <path d="M24 12.07C24 5.41 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.8-4.7 4.54-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.5c-1.5 0-1.96.93-1.96 1.89v2.26h3.32l-.53 3.5h-2.8V24C19.62 23.1 24 18.1 24 12.07" />,
    },
    {
      label: "Partager sur X",
      href: `https://twitter.com/intent/tweet?url=${url}&text=${text}`,
      bg: "bg-black ring-1 ring-white/20",
      icon: <path d="M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.4l-5.8-7.58-6.63 7.58H.48l8.6-9.83L0 1.15h7.59l5.24 6.93 6.07-6.93Zm-1.29 19.5h2.04L6.48 3.24H4.3l13.31 17.41Z" />,
    },
    {
      label: "Partager sur LinkedIn",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
      bg: "bg-[#0A66C2]",
      icon: <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z" />,
    },
  ];
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-sm text-fg-muted">Partagez le vote :</span>
      <div className="flex gap-3">
        {buttons.map((b) => (
          <button
            key={b.label}
            type="button"
            aria-label={b.label}
            title={b.label}
            onClick={() => open(b.href)}
            className={`flex h-11 w-11 items-center justify-center rounded-lg text-white shadow-sm transition-[filter] hover:brightness-110 ${b.bg}`}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
              {b.icon}
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}
