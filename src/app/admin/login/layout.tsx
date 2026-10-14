import type { Metadata } from "next";
import type { ReactNode } from "react";

// La page de connexion est un composant client : son titre est déclaré ici.
export const metadata: Metadata = {
  title: "Connexion au backoffice",
  robots: { index: false, follow: false },
};

export default function AdminLoginLayout({ children }: { children: ReactNode }) {
  return children;
}
