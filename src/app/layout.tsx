import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
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
  themeColor: "#FACC15",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
