import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Vote Halloween Chamas Tacos 🎃",
  description: "Votez pour la meilleure décoration Halloween des restaurants Chamas Tacos et tentez de gagner l'un de nos nombreux lots !",
  openGraph: {
    title: "🎃 Votez pour la meilleure décoration Halloween Chamas Tacos ! 👻",
    description: "Aidez-nous à élire le restaurant avec la meilleure atmosphère effrayante et créative !",
    type: "website",
    locale: "fr_FR",
  },
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
