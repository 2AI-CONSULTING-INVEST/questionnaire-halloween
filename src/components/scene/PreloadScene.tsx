"use client";

import { preload } from "react-dom";
import { SCENE_1_ASSETS } from "./assets";

/**
 * Annonce les modèles de la scène 1 (cimetière + logo) dans le <head> dès le HTML, pour qu'ils
 * partent en parallèle du JavaScript. Même mode que le fetch de GLTFLoader (cors, credentials
 * same-origin = crossorigin="anonymous") : un seul téléchargement. Rendu côté serveur (un <link> par
 * fichier) puis rejoué à l'hydratation, où React retrouve le lien existant sans le dupliquer.
 */
export function PreloadScene() {
  for (const url of SCENE_1_ASSETS) preload(url, { as: "fetch", crossOrigin: "anonymous" });
  return null;
}
