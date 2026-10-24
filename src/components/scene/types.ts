import type * as THREE from "three";
import type { Billboards } from "./core";
import type { CutGlow } from "./glow";

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
  /** Sang (clairière de la faucheuse) : rouge sombre, un peu luisant. */
  bloodMat: THREE.MeshPhongMaterial;
  glowTex: THREE.Texture;
  smokeTex: THREE.Texture;
  shadowTex: THREE.Texture;
  time: { value: number };
  /** Intensité des lueurs selon le thème (1 la nuit, presque 0 le jour), suivie par les matériaux émissifs. */
  glowLevel: { value: number };
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
  /** Découpes / vitres émissives de l'objet porteur, au rythme de cette flamme (glow.ts). */
  cut?: CutGlow;
};

/** Yeux dans la pénombre d'un lieu : couleurs, paires visibles à la fois, sourcils méchants (0 à 1), taille, rythme d'apparition. */
export type EyeStyle = { colors: string[]; pairs: number; mean: number; scale: number; haste: number };

export interface Area {
  name: SceneName;
  group: THREE.Group;
  flames: Flame[];
  eyeSpots: THREE.Vector3[];
  /** Style des yeux de la pénombre (défaut : jaunes / orangés, 3 à 4 paires). */
  eyeStyle?: EyeStyle;
  /** Centre autour duquel tournent les chauves-souris. */
  batHome: THREE.Vector3;
  /** Teinte du sol propre à la zone (texture qui porte ses couleurs), suivie par la palette. */
  groundTint?: THREE.Color;
  /** Sursaut de la caméra (décalage monde ajouté après le placement), ex. coup de faux vers l'écran. */
  flinch?: THREE.Vector3;
  layout(f: Frame): void;
  pose(f: Frame): Pose;
  update(t: number, dt: number, f: Frame, camera: THREE.Camera): void;
}
