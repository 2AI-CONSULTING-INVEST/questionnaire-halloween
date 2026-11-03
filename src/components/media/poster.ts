import { getImageProps } from "next/image";
import { isLocalMedia } from "@/lib/schema";

/**
 * Affiche d'une vidéo passée par l'optimiseur d'images (cache de Vercel, AVIF/WebP) : le stockage
 * Supabase ne l'envoie qu'une fois par taille, au lieu d'une fois par visiteur (egress).
 * `width` : largeur affichée en px CSS ; l'image servie fait le double (écrans denses).
 */
export function optimizedPoster(url: string, width: number) {
  if (isLocalMedia(url)) return url;
  return getImageProps({ src: url, alt: "", width, height: width }).props.src;
}
