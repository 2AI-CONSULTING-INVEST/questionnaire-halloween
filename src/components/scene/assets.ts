/** Fichiers du décor 3D (public/3d), par lieu. Chemins complets : chargés hors de Next (GLTFLoader, preload). */
import { BASE_PATH } from "@/lib/base-path";

export const ASSETS = {
  /** Pack Halloween Bits : utilisé par les trois lieux. */
  halloween: BASE_PATH + "/3d/halloween.glb",
  /** Logos Chamas Tacos 3D style KayKit : wordmark au cimetière, badge dans la crypte. */
  logos: BASE_PATH + "/3d/logos.glb",
  /** Faucheuse : KayKit « Skeleton Rogue » (CC0), capuche repeinte, 3 animations. */
  reaper: BASE_PATH + "/3d/reaper.glb",
  /** Rochers, arbres nus, buissons (KayKit Forest Nature, feuillage assombri). */
  forest: BASE_PATH + "/3d/forest.glb",
  /** Salle de la crypte (KayKit Dungeon) — chargée seulement quand on s'en approche. */
  dungeon: BASE_PATH + "/3d/dungeon.glb",
  /** Atlas Dungeon seul (violet, or, bois…) pour le chaudron, les cadeaux, la faux, les chapeaux. */
  dungeonTexture: BASE_PATH + "/3d/dungeon_texture.png",
} as const;

/** Scène 1 (cimetière complet + logo) : tout doit être là au premier affichage. */
export const SCENE_1_ASSETS = [ASSETS.halloween, ASSETS.logos] as const;
