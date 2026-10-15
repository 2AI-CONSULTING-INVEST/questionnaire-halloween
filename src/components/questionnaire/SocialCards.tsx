"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import { useSyncExternalStore } from "react";
import { SOCIAL_LINKS } from "@/lib/site";

type Network = keyof typeof SOCIAL_LINKS;
const STORAGE_KEY = "chamas-social-followed";
const CHANGE_EVENT = "hw:social-followed";

/** Sous-titres courts : une seule ligne, de 360 px à 1440 px de large. */
const LABELS: Record<Network, { name: string; invite: string }> = {
  instagram: { name: "Instagram", invite: "Suivez" },
  tiktok: { name: "TikTok", invite: "Suivez" },
};

/** État « abonné » mémorisé sur l'appareil (chaîne brute : instantané stable pour React). */
function readRaw() {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function parseFollowed(raw: string): Partial<Record<Network, boolean>> {
  try {
    return raw ? (JSON.parse(raw) as Partial<Record<Network, boolean>>) : {};
  } catch {
    return {};
  }
}

function writeFollowed(v: Partial<Record<Network, boolean>>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
  } catch {
    /* stockage indisponible : l'état vaut pour cette visite */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/** Logo Instagram (traits blancs sur le dégradé officiel). */
function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.4" cy="6.6" r="1" fill="#fff" stroke="none" />
    </svg>
  );
}

/** Logo TikTok : la note, doublée en cyan et rose pour les bords caractéristiques. */
function TikTokIcon() {
  const note =
    "M16.6 2h-3.2v13.5a2.9 2.9 0 1 1-2.9-2.9c.3 0 .6 0 .9.1V9.4a6.2 6.2 0 1 0 5.2 6.1V8.9a7.4 7.4 0 0 0 4.4 1.4V7.1A4.3 4.3 0 0 1 16.6 2Z";
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden>
      <path d={note} fill="#25f4ee" transform="translate(-1.1 -0.9)" />
      <path d={note} fill="#fe2c55" transform="translate(1.1 0.9)" />
      <path d={note} fill="#fff" />
    </svg>
  );
}

/**
 * Cartes « S'abonner » Instagram / TikTok (modèle : carte horizontale à bordure pointillée, tuile
 * d'icône à gauche, bouton rond à droite). Avant le clic : orange Chamas (citrouille), bouton jaune
 * de la marque ; après le clic, la carte passe en « Abonné » vert menthe, coche (mémorisé sur
 * l'appareil, chaque réseau à part). Pas de points ni de bonus.
 */
const STYLES = {
  // Halloween / Chamas : orange chaud, bordure brun foncé, texte brun sombre (contraste ≥ 7:1).
  todo: {
    card: "border-[#3a1707] bg-[linear-gradient(135deg,#ffa45c_0%,#ff8a3a_55%,#f4711f_100%)] shadow-[0_6px_22px_rgba(0,0,0,0.28)] hover:shadow-[0_10px_28px_rgba(0,0,0,0.34)] day:shadow-[0_6px_18px_rgba(35,29,43,0.16)]",
    title: "text-[#2a1206]",
    subtitle: "text-[#5c260a]",
    button: "border-[#3a1707] bg-brand text-black",
  },
  // Abonné : vert menthe, coche.
  done: {
    card: "border-[#1b2a22] bg-[#e9fbef] shadow-[0_6px_22px_rgba(0,0,0,0.28)] hover:shadow-[0_10px_28px_rgba(0,0,0,0.34)] day:shadow-[0_6px_18px_rgba(35,29,43,0.14)]",
    title: "text-[#1b2a22]",
    subtitle: "text-[#1f9d55]",
    button: "border-[#1b2a22] bg-[#22c55e] text-[#0f1f16]",
  },
};
export function SocialCards({ className = "", delay = 0 }: { className?: string; delay?: number }) {
  const reduce = useReducedMotion();
  // Côté serveur, personne n'est abonné ; l'état de l'appareil s'applique après l'hydratation.
  const followed = parseFollowed(useSyncExternalStore(subscribe, readRaw, () => ""));

  const follow = (network: Network) => writeFollowed({ ...parseFollowed(readRaw()), [network]: true });

  return (
    <div className={`flex w-full max-w-[400px] flex-col gap-3 ${className}`}>
      {(Object.keys(SOCIAL_LINKS) as Network[]).map((network, i) => {
        const done = !!followed[network];
        const { name, invite } = LABELS[network];
        const { handle, url } = SOCIAL_LINKS[network];
        const st = done ? STYLES.done : STYLES.todo;
        return (
          <motion.a
            key={network}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={done ? `Abonné sur ${name} (${handle}), ouvrir la page` : `S'abonner à Chamas Tacos Lille sur ${name} (${handle})`}
            onClick={() => follow(network)}
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: delay + i * 0.12, ease: "easeOut" }}
            className={`group flex min-h-[72px] items-center gap-3 rounded-2xl border-[3px] border-dashed px-3 py-2.5 text-left transition-[transform,box-shadow,background-color,border-color] hover:-translate-y-0.5 focus-visible:outline-offset-4 sm:gap-3.5 sm:px-3.5 ${st.card}`}
          >
            <span
              aria-hidden
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-sm sm:h-12 sm:w-12 ${
                network === "instagram" ? "bg-[linear-gradient(45deg,#f9ce34_0%,#ee2a7b_50%,#6228d7_100%)]" : "bg-black"
              }`}
            >
              {network === "instagram" ? <InstagramIcon /> : <TikTokIcon />}
            </span>
            <span className="min-w-0 flex-1">
              <span className={`block truncate text-[13px] font-extrabold leading-tight sm:text-base ${st.title}`}>
                {done ? `Abonné sur ${name}` : `Abonnez-vous sur ${name}`}
              </span>
              <span className={`mt-0.5 block truncate text-[13px] font-semibold leading-snug ${st.subtitle}`}>{done ? "Merci ! 🎃" : `${invite} ${handle}`}</span>
            </span>
            <span
              aria-hidden
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-[3px] transition-transform group-hover:scale-105 sm:h-11 sm:w-11 ${st.button}`}
            >
              {done ? <Check className="h-5 w-5" strokeWidth={3} /> : <ArrowRight className="h-5 w-5" strokeWidth={3} />}
            </span>
          </motion.a>
        );
      })}
    </div>
  );
}
