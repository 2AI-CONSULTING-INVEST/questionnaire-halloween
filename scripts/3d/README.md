# Préparation des modèles 3D

Ces scripts ont produit les fichiers de `public/3d/`. Ils ne servent qu'à les regénérer.

Outils nécessaires (à installer à part, ils ne font pas partie du projet) :

```bash
npm i --no-save @gltf-transform/core@4 @gltf-transform/extensions@4 @gltf-transform/functions@4 meshoptimizer@0.22 pngjs@7
```

- `pack-models.mjs <dossier gltf du pack> <sortie.glb> [--paint col,row,#haut,#bas]… <noms des modèles…>` : regroupe les modèles d'un pack KayKit (texture partagée, géométrie quantifiée, compression Meshopt). `--paint` repeint une cellule (col, row) de l'atlas 8×4 par un dégradé vertical, par exemple pour assombrir le feuillage du pack Forest. Utilisé pour `halloween.glb`, `dungeon.glb` et `forest.glb` ; la liste des modèles est celle des noms appelés dans `src/components/scene/`.
- `public/3d/logos.glb` : `pack-models.mjs <dossier gltf du pack ChamasTacos_3D_KayKitStyle> public/3d/logos.glb chamastacos_wordmark_halloween chamastacos_badge_halloween`, puis `half-texture.mjs public/3d/logos.glb` (atlas réduit de 1024 à 512 px, sans perte visible sur des dégradés).
- `public/3d/dungeon_texture.png` est l'atlas du pack Dungeon, copié tel quel : il sert à peindre les objets du code avant que `dungeon.glb` soit chargé.
- `pack-reaper.mjs Skeleton_Rogue.glb public/3d/reaper.glb` : faucheuse à partir du « Skeleton Rogue » du pack [KayKit Skeletons](https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0) (CC0). Capuche et cape repeintes en violet nuit, tunique assombrie ; animations gardées : `Idle`, `Taunt`, `Interact`.
- `modal-props/render.mjs <racine du projet> <dossier des packs dézippés> <sortie>` : rend le décor de la modale du classement — motte de terre garnie d'assets Halloween Bits et Forest Nature, poteau au mât allongé et, à part, sa lanterne (pour qu'elle se balance) — en PNG transparents recadrés en définition ×2 (`public/decor/modal-*.png`), et donne la position de la crête et le cadre de la lanterne dans l'image du poteau (`lamp.inPost`, repris dans `LiveResults.tsx`). Nécessite `puppeteer-core`, `pngjs` et Chrome.
- `strip-badge.mjs <dossier gltf ChamasTacos> <sortie> chamastacos_badge_halloween` : retire du badge les décorations posées à son pied (elles flottaient au-dessus du tonneau), avant `pack-models.mjs`.
- `brand/render.mjs <racine du projet>` : rend le badge rond 3D Chamas Tacos (`logos.glb`), le détoure en disque et écrit `src/app/favicon.ico` (16, 32, 48 px), `src/app/icon.png` (512 px) et `src/app/apple-icon.png` (180 px, fond opaque), plus `brand/out/badge.png`. Nécessite `puppeteer-core`, Chrome et `sharp` (déjà présent avec Next).
- `brand/og.mjs <racine du projet> [--capture http://localhost:3000]` : compose les images d'aperçu des liens partagés (1200 × 630) — fond capturé dans la scène 3D sans l'interface (`brand/out/bg-*.png`), badge, titre, texte — dans `src/app/opengraph-image.jpg` et `src/app/(public)/resultats/opengraph-image.jpg`, avec leurs textes alternatifs. `--capture` refait les fonds depuis le serveur de dev (vérifier ensuite que la crypte est cadrée, panneau encore poussiéreux).
