import type * as THREE from "three";
import type { Billboards } from "./core";

export type SceneName = "graveyard" | "reaper" | "crypt";

export type Pose = { pos: THREE.Vector3; target: THREE.Vector3 };

/** Format de l'écran : tout le décor se recompose selon le ratio (téléphone vertical ou écran large). */
export type Frame = { aspect: number; fov: number; halfTan: number; objScale: number };

export type Kit = {
  /** Modèles KayKit par nom ; chaque modèle garde le matériau (atlas) de son pack. */
  models: Map<string, THREE.Object3D>;
  /** Atlas Halloween Bits. */
  modelMat: THREE.MeshLambertMaterial;
  /** Atlas Dungeon (violet, or, bois, noir…), pour les objets construits dans le code. */
  dungeonMat: THREE.MeshLambertMaterial;
  /** Même atlas, facettes marquées (chapeaux de sorcière façon papier plié). */
  dungeonFlatMat: THREE.MeshLambertMaterial;
  glowTex: THREE.Texture;
  smokeTex: THREE.Texture;
  shadowTex: THREE.Texture;
  time: { value: number };
  low: boolean;
  reduce: boolean;
  /** Nappes de brume (couleur / opacité pilotées par le thème). */
  mists: Billboards[];
};

/** Point lumineux : halo + éventuellement une des lumières du « pool » quand il est proche de la caméra. */
export type Flame = {
  pos: THREE.Vector3;
  color: string;
  intensity: number;
  distance: number;
  seed: number;
  glow: THREE.Sprite;
  glowSize: number;
  /** Échelle de l'objet porteur (halo, lumière et fumée suivent sa taille). */
  scale: number;
  /** false : halo seulement (bougies), comme dans la scène d'origine. */
  light: boolean;
  /** Bonus de priorité pour garder une lumière (ex. bougies qui éclairent le mur). */
  priority?: number;
  /** Flamme sans vacillement (lumière constante), ex. le côté gauche de la crypte. */
  steady?: boolean;
  /** Taille de la fumée qui s'en échappe (0 : aucune) et vitesse de montée. */
  smoke: number;
  rise: number;
  embers: boolean;
};

export interface Area {
  name: SceneName;
  group: THREE.Group;
  flames: Flame[];
  eyeSpots: THREE.Vector3[];
  /** Centre autour duquel tournent les chauves-souris. */
  batHome: THREE.Vector3;
  layout(f: Frame): void;
  pose(f: Frame): Pose;
  update(t: number, dt: number, f: Frame, camera: THREE.Camera): void;
}
