import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { BRAND, HOME, OG_BASE, SITE_NAME, siteUrl, tabTitle } from "@/lib/site";
import { BASE_PATH } from "@/lib/base-path";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import "./globals.css";
import "./posters.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });

// Icônes (favicon.ico, icon.png, apple-icon.png) et image d'aperçu (opengraph-image.jpg) : fichiers
// de ce dossier, générés depuis le badge 3D par scripts/3d/brand/.
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { template: `${BRAND} | %s`, default: tabTitle(HOME.title) },
  description: HOME.description,
  applicationName: SITE_NAME,
  keywords: ["Chamas Tacos", "Halloween", "vote", "décoration", "concours", "tirage au sort", "french tacos"],
  openGraph: { ...OG_BASE, title: HOME.shareTitle, description: HOME.shareDescription },
  twitter: { card: "summary_large_image", title: HOME.shareTitle, description: HOME.shareDescription },
  appleWebApp: { title: "Chamas Halloween" },
  // Crédits (balises meta + public/humans.txt), sans affichage sur le site.
  authors: [{ name: "2AI CONSULTING & INVEST" }, { name: "Steeve MOKOKO" }, { name: "ai assistant" }],
  creator: "2AI CONSULTING & INVEST",
  publisher: "Chamas Tacos",
};

export const viewport: Viewport = {
  themeColor: "#0c0a12",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Thème appliqué avant le premier rendu (sombre par défaut, clair si l'easter egg a été trouvé).
const themeScript = `(function(){try{if(localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})==="light")document.documentElement.setAttribute("data-theme","light")}catch(e){}})()`;

// Poster de la scène d'arrivée (posters.css, scripts/3d/posters.mjs) : préchargé en priorité haute,
// le bon d'emblée (page, thème déjà appliqué, format paysage large / paysage / portrait).
const posterScript = `(function(){try{var b=${JSON.stringify(BASE_PATH)},p=location.pathname;if(p.indexOf(b+"/admin")===0)return;var s=p.indexOf(b+"/participants")===0?"reaper":p.indexOf(b+"/resultats")===0?"crypt":"graveyard";var t=document.documentElement.getAttribute("data-theme")==="light"?"light":"dark";var f=matchMedia("(max-aspect-ratio: 3/4)").matches?"port":matchMedia("(min-aspect-ratio: 17/10)").matches?"wide":"land";var l=document.createElement("link");l.rel="preload";l.as="image";l.type="image/avif";l.setAttribute("fetchpriority","high");l.href=b+"/poster/"+s+"-"+t+"-"+f+".avif";document.head.appendChild(l)}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" data-theme="dark" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: posterScript }} />
      </head>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
