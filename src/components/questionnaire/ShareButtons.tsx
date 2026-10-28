"use client";

import { Check, Link2 } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { trackClick } from "@/components/track-click";
import { BASE_PATH } from "@/lib/base-path";
import { randomRef, type ShareTarget } from "@/lib/clicks";
import { PROD_ORIGIN, SITE_NAME } from "@/lib/site";
import { InstagramIcon, TikTokIcon } from "./SocialCards";

/** Emojis anciens et universels (Unicode 6.0, sans séquence ZWJ ni sélecteur de variante) : 🎃 U+1F383, 👻 U+1F47B. */
const TEXT = "🎃 Je viens de voter pour la meilleure décoration Halloween Chamas Tacos ! À votre tour 👻";
const COPIED = "Lien copié ✓";

/**
 * Lien partagé : www.chamas-nord.fr/halloween en ligne (les aperçus Open Graph y sont), l'origine
 * locale en développement et pendant les tests (localhost, réseau local). Suivi du partage : réseau
 * (`via`) et code aléatoire du partage (`r`), qui relie les arrivées au votant qui a partagé.
 */
function shareUrl(via: ShareTarget, ref: string) {
  const local = typeof window !== "undefined" && /^(localhost|127.|[::1]|192.168.|10.)/.test(window.location.hostname);
  return `${local ? window.location.origin : PROD_ORIGIN}${BASE_PATH}?via=${via}&r=${ref}`;
}

/** Copie dans le presse-papiers ; repli (zone de texte + execCommand) si l'API est indisponible. */
async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {}
    area.remove();
    return ok;
  }
}

const noSubscribe = () => () => {};

type Btn = { key: ShareTarget; label: string; bg: string; icon?: React.ReactNode; onClick: (link: string) => void };

/**
 * Partage du vote : WhatsApp, Snapchat, Instagram, TikTok et le lien. Chaque clic est enregistré
 * (src/lib/clicks.ts) avec le code mis dans son lien. Le bouton « lien » copie
 * toujours l'adresse (retour « Lien copié ✓ » annoncé aux lecteurs d'écran), puis ouvre la feuille
 * de partage native quand le navigateur la propose (annulée : le lien reste copié). Instagram et
 * TikTok n'ont pas de partage web : le lien est copié avec un message, puis la feuille native
 * s'ouvre (ou Instagram / TikTok dans un onglet).
 */
export function ShareButtons() {
  // navigator.share n'existe qu'au navigateur : faux au rendu serveur, lu à l'hydratation.
  const canShare = useSyncExternalStore(noSubscribe, () => typeof navigator.share === "function", () => false);
  const [status, setStatus] = useState("");
  // Le message s'efface après 6 s.
  useEffect(() => {
    if (!status) return;
    const id = setTimeout(() => setStatus(""), 6000);
    return () => clearTimeout(id);
  }, [status]);

  const open = (href: string) => window.open(href, "_blank", "noopener,noreferrer,width=600,height=560");
  const nativeShare = async (link: string) => {
    try {
      await navigator.share({ title: SITE_NAME, text: TEXT, url: link });
    } catch {
      /* annulée par l'utilisateur ou refusée : le lien reste copié */
    }
  };
  const copyThen = async (link: string, ok: string, fallback: string, then: () => unknown) => {
    const done = await copy(link);
    setStatus(done ? ok : `${fallback} : ${link}`);
    await then();
  };
  const viaApp = (link: string, app: string, home: string) =>
    copyThen(link, `Lien copié : collez-le dans votre story ou en message sur ${app}`, `Copiez ce lien pour le partager sur ${app}`, () =>
      canShare ? nativeShare(link) : open(home),
    );

  const buttons: Btn[] = [
    {
      key: "whatsapp",
      label: "Partager sur WhatsApp",
      bg: "bg-[#25D366] text-white",
      icon: <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.47-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.18-1.41-.08-.13-.27-.2-.57-.35m-5.42 7.4h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88 2.64 0 5.12 1.03 6.99 2.9a9.83 9.83 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.88 9.88m8.41-18.3A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.34 11.89-11.89a11.82 11.82 0 0 0-3.48-8.41Z" />,
      // api.whatsapp.com directement : la redirection de wa.me ré-encode le texte et casse les emojis.
      onClick: (link) => open(`https://api.whatsapp.com/send?text=${encodeURIComponent(`${TEXT} ${link}`)}`),
    },
    {
      key: "snapchat",
      label: "Partager sur Snapchat",
      bg: "bg-[#FFFC00] text-black",
      icon: <path d="M12.21.79c.99 0 4.35.28 5.93 3.82.53 1.2.4 3.22.3 4.85v.06l-.03.51c.08.05.2.09.4.09.3-.02.66-.12 1.03-.3.17-.09.35-.1.47-.1.18 0 .36.03.51.09.45.15.73.48.73.84.02.45-.39.84-1.21 1.17l-.35.12c-.45.13-1.14.36-1.33.81-.09.22-.06.52.12.87l.02.01c.06.14 1.52 3.48 4.79 4.02.25.04.43.27.42.51 0 .07-.02.15-.05.22-.24.57-1.27.99-3.15 1.27-.06.09-.12.38-.16.57-.03.18-.07.36-.13.55-.08.27-.27.41-.56.41h-.03c-.13 0-.31-.03-.54-.08-.36-.07-.76-.13-1.27-.13-.3 0-.6.01-.91.07-.6.1-1.12.46-1.72.88-.85.6-1.83 1.29-3.3 1.29h-.33c-1.47 0-2.43-.68-3.28-1.29-.6-.42-1.1-.78-1.7-.88a5.6 5.6 0 0 0-.93-.07c-.54 0-.96.09-1.27.15-.21.04-.39.07-.54.07-.37 0-.52-.22-.58-.42l-.14-.57c-.04-.18-.1-.49-.16-.57-1.92-.22-2.95-.64-3.19-1.23a.6.6 0 0 1-.05-.22c-.02-.24.16-.47.42-.51 3.26-.54 4.73-3.88 4.79-4.02l.02-.03c.18-.35.22-.65.12-.87-.2-.43-.89-.66-1.33-.81l-.35-.12c-1.1-.43-1.26-.93-1.2-1.27.09-.48.68-.8 1.17-.8.15 0 .27.03.38.08.42.19.79.3 1.1.3.24 0 .39-.06.47-.11l-.05-.57c-.1-1.62-.22-3.65.31-4.84C7.39 1.08 10.74.81 11.73.81l.42-.02h.06Z" />,
      // Lien de partage web de Snapchat : ouvre l'appli sur téléphone, avec la page en pièce jointe.
      onClick: (link) => open(`https://www.snapchat.com/scan?attachmentUrl=${encodeURIComponent(link)}`),
    },
    {
      key: "instagram",
      label: "Partager sur Instagram (copie le lien)",
      bg: "bg-[radial-gradient(circle_at_30%_107%,#fdf497_0%,#fd5949_45%,#d6249f_60%,#285AEB_90%)] text-white",
      onClick: (link) => void viaApp(link, "Instagram", "https://www.instagram.com/"),
    },
    {
      key: "tiktok",
      label: "Partager sur TikTok (copie le lien)",
      bg: "bg-black text-white ring-1 ring-white/20",
      onClick: (link) => void viaApp(link, "TikTok", "https://www.tiktok.com/"),
    },
    {
      key: "copy",
      label: canShare ? "Copier et partager le lien" : "Copier le lien",
      bg: "bg-surface-2 text-fg ring-1 ring-edge-strong",
      onClick: (link) => void copyThen(link, COPIED, "Copiez ce lien", () => canShare && nativeShare(link)),
    },
  ];
  const glyph = (b: Btn) => {
    if (b.key === "instagram") return <InstagramIcon className="h-6 w-6" />;
    if (b.key === "tiktok") return <TikTokIcon className="h-6 w-6" />;
    if (b.key === "copy") return status === COPIED ? <Check className="h-5 w-5" aria-hidden /> : <Link2 className="h-5 w-5" aria-hidden />;
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
        {b.icon}
      </svg>
    );
  };

  return (
    <div className="flex w-full flex-col items-center gap-2.5">
      <div className="flex flex-wrap justify-center gap-2.5">
        {buttons.map((b) => (
          <button
            key={b.key}
            type="button"
            aria-label={b.label}
            title={b.label}
            data-share={b.key}
            onClick={() => {
              const ref = randomRef();
              trackClick({ kind: "share", target: b.key, ref });
              b.onClick(shareUrl(b.key, ref));
            }}
            className={`flex h-11 w-11 items-center justify-center rounded-lg shadow-sm transition-[filter] hover:brightness-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/60 focus-visible:ring-offset-2 focus-visible:ring-offset-page ${b.bg}`}
          >
            {glyph(b)}
          </button>
        ))}
      </div>
      <p aria-live="polite" role="status" className={`min-h-5 max-w-xs text-center text-sm font-medium ${status ? "text-fg" : "text-transparent"}`}>
        {status}
      </p>
    </div>
  );
}
