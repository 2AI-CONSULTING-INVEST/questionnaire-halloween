import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { BRAND, HOME, OG_BASE, SITE_NAME, siteUrl, tabTitle } from "@/lib/site";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import "./globals.css";

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
};

export const viewport: Viewport = {
  themeColor: "#0c0a12",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Thème appliqué avant le premier rendu (sombre par défaut, clair si l'easter egg a été trouvé).
const themeScript = `(function(){try{if(localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})==="light")document.documentElement.setAttribute("data-theme","light")}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" data-theme="dark" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
