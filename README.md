# 🎃 Vote Halloween Chamas Tacos

Questionnaire de vote façon Typeform, avec enregistrement en direct, décor 3D animé et mini-backoffice.

En ligne sur **https://www.chamas-nord.fr/halloween**. L'app est servie sous `/halloween` (`basePath`, voir `src/lib/base-path.ts`) ; pour l'instant, tout le reste du domaine (racine, anciens liens) y est redirigé (307, temporaire).

- **Questionnaire** `/halloween` : une question par écran, raccourcis clavier (A/B/C, O/N, Entrée), auto-save à chaque réponse, reprise après fermeture d'onglet.
- **Résultats publics** `/halloween/resultats` : classement en direct, sans aucune donnée personnelle.
- **Backoffice** `/halloween/admin` : KPI, résultats, graphiques, participants au tirage (marquer les gagnants), réponses, gestion des photos et des restaurants, exports Excel/CSV, mode sombre, actualisation toutes les 30 s.

Stack : Next.js 16 (App Router) · React 19 · Tailwind CSS 4 · Radix UI · Zustand · Zod · Framer Motion · Three.js · Recharts · Supabase · papaparse + SheetJS.

## Démarrage local (sans Supabase)

```bash
npm install
cp .env.example .env.local   # puis renseignez au minimum ADMIN_PASSWORD et ADMIN_SESSION_SECRET
npm run dev                  # http://localhost:3000
```

Sans variables Supabase, l'app utilise un fichier local `.data/db.json`, pré-rempli avec 6 restaurants et 6 photos de démo (`public/seed`). Ce mode sert au développement : il est refusé sur Vercel.

> Le dossier parent contient un `&` (`2AI CONSULTING & INVEST`), ce qui casse les raccourcis `npx`/`.bin` de npm sous Windows. Les scripts de `package.json` appellent donc Node directement. Utilisez toujours `npm run …`.

| Script | Rôle |
| --- | --- |
| `npm run dev` | Serveur de développement |
| `npm run build` / `npm start` | Build et serveur de production |
| `npm run lint` | ESLint |
| `npm run typecheck` | Génère les types de routes et lance `tsc` |
| `npm run seed:images` | Régénère les images de démo |

## Mise en production

### 1. Supabase (~5 min)

1. Créez un projet sur [supabase.com](https://supabase.com) (région UE, ex. Paris ou Francfort).
2. **SQL Editor** → collez puis exécutez `supabase/schema.sql`. Ce script crée les tables, les index, le trigger `updated_at`, le bucket public `decorations` et la liste des 6 restaurants.
3. **Project settings → API** : notez l'URL du projet et la clé `service_role`.

Le RLS est activé **sans policy** : la clé publique `anon` ne peut rien lire ni écrire. Tout passe par les routes API Next.js, côté serveur, avec la clé `service_role`. Cette clé ne doit jamais être exposée au navigateur (pas de préfixe `NEXT_PUBLIC_`).

### 2. Vercel

1. Poussez le projet sur GitHub, puis importez-le dans Vercel.
2. Ajoutez les variables d'environnement (voir `.env.example`) :

| Variable | Obligatoire | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | URL du projet Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Clé `service_role` (serveur uniquement) |
| `ADMIN_PASSWORD` | ✅ | Mot de passe backoffice en lecture/écriture |
| `ADMIN_SESSION_SECRET` | ✅ | 32+ caractères aléatoires (`openssl rand -hex 32`) |
| `ADMIN_READONLY_PASSWORD` | | Mot de passe en lecture seule |
| `NEXT_PUBLIC_SITE_URL` | | Origine publique, sans `/halloween` : `https://www.chamas-nord.fr` (partages, Open Graph, sitemap ; à défaut, ce domaine en production Vercel) |
| `NEXT_PUBLIC_SOCIAL_URL` / `NEXT_PUBLIC_SOCIAL_LABEL` | | Lien vers le réseau social du tirage en direct (page de remerciement) |
| `NEXT_PUBLIC_VOTE_VIDEO_URL` | | Vidéo optionnelle au-dessus de la question 4 |
| `SUPABASE_STORAGE_BUCKET` | | `decorations` par défaut |

3. Déployez, puis ajoutez le domaine dans **Settings → Domains** : `www.chamas-nord.fr` (principal) et `chamas-nord.fr` (redirigé vers www). Chez OVH (zone DNS) : enregistrement A de `@` vers l'IP indiquée par Vercel, CNAME de `www` vers la cible indiquée par Vercel, en supprimant les A/AAAA/CNAME par défaut d'OVH (laisser MX et TXT).

> Tout chemin interne que Next ne réécrit pas (`fetch`, `<a>` bruts, chargeurs 3D, `src` d'images) doit passer par `withBase()`.
4. Allez sur `/admin` → onglet **Décorations** et ajoutez les photos et vidéos de chaque restaurant (format vertical conseillé, voir « Médias » plus bas).

> Les variables Supabase doivent être présentes **au moment du build** : la page d'accueil est pré-générée, puis régénérée au plus toutes les 60 s et immédiatement après chaque modification faite dans le backoffice.

## Fonctionnement

### Parcours (6 étapes)

| Étape | Question | Obligatoire |
| --- | --- | --- |
| 1 | Q1 · Chamas Tacos préféré (liste avec recherche) | ✅ |
| 1 | Q2 · Période de visite | — |
| 2 | Q3 · Vote : meilleure décoration (une carte par restaurant, photos et vidéos) | ✅ |
| 3 | Q4 · Influence de la décoration | ✅ |
| 4 | Q5 · Commentaire (300 caractères max) | — |
| 5 | Q6 · Tirage au sort : oui/non, puis nom, téléphone FR, email | ✅ si oui |
| 6 | Remerciements, confettis, résultats, partage | |

La question « Qui êtes-vous ? » a été retirée ; la colonne `voter_type` reste en base pour les éventuelles anciennes réponses.

Comme dans le Typeform d'origine, **le vote est validé à la fin de l'étape 4**, avant le tirage au sort. Un votant qui ne laisse pas ses coordonnées est quand même compté. Une fois le vote validé, seuls les champs du tirage restent modifiables.

### Enregistrement en direct

- Choix (radio, liste, image) : envoi immédiat (`PATCH /api/responses/:session/update`).
- Champs texte : envoi 1 s après la dernière frappe, et à la sortie du champ. Seules les valeurs valides sont envoyées.
- En cas d'échec : les réponses restent en file d'attente et sont renvoyées automatiquement (délai progressif, retour du réseau). Un toast prévient l'utilisateur et un indicateur « Enregistré » s'affiche en bas à droite.
- À la fermeture de l'onglet, les réponses en attente partent via `sendBeacon`. Les réponses sont aussi gardées dans le `localStorage` : en rouvrant la page, le votant reprend là où il s'était arrêté.
- Si le vote est déjà fait sur cet appareil, la page de remerciement s'affiche. C'est une protection légère : l'IP et le navigateur sont stockés pour repérer les abus dans l'export.

### Médias des décorations

- Plusieurs photos et vidéos par restaurant. Le **premier** média sert de couverture ; l'ordre se règle avec les flèches du backoffice.
- Le vote porte sur le **restaurant** : supprimer un média reporte ses votes sur un autre média du même restaurant. Le dernier média d'un restaurant déjà voté ne peut pas être supprimé.
- Côté votant : carte verticale (3:4) avec carrousel au doigt, icône ⤢ pour la visionneuse plein écran (glisser, flèches, clavier), lecture vidéo au toucher, bouton « Voter pour… ». Dans la visionneuse, les restaurants s'enchaînent : sur le dernier média, un petit élan et une étiquette annoncent le restaurant suivant (sur le premier, le précédent), et glisser encore fait glisser toute la page vers ce restaurant.
- Une fois un restaurant choisi, les autres cartes sont légèrement grisées ; toucher la coche verte (ou retaper sa lettre au clavier) annule le choix.
- À l'envoi, le navigateur de l'admin prépare les fichiers : photos redressées, réduites à 2048 px et ré-encodées en JPEG (données GPS retirées) ; vidéos vérifiées (lisibles, 50 Mo max) avec une affiche JPEG générée (`<nom>.poster.jpg`). Les fichiers partent **directement** vers Supabase Storage via une URL signée (Vercel limite les requêtes à 4,5 Mo).
- Vidéos conseillées : MP4 H.264, moins de 30 s, 720p, moins de 20 Mo. Les vidéos ne se chargent que si le votant appuie sur lecture (quota de bande passante Supabase : 5 Go/mois en gratuit).

### Décor 3D : trois lieux sur un même parcours

Le décor (Three.js) est monté une seule fois dans `src/app/(public)/layout.tsx` : il persiste entre le questionnaire et la page des résultats. La caméra suit un parcours continu : du cimetière, elle part vers le **centre gauche**, dépasse le poteau-lanterne et découvre la clairière dans une fumée épaisse qui se dissipe (en restant lourde) ; de là, elle repart vers le **centre droit** jusqu'à la crypte et y entre sans s'arrêter.

| Lieu | Quand | Contenu |
| --- | --- | --- |
| Cimetière | Accueil, questions | Tombes, citrouilles, brume, nuées de chauves-souris, yeux dans la pénombre ; logo « CHAMAS TACOS » au premier plan à gauche ; grande lune en 3D dans le ciel ; fantôme flottant près de la crypte ; forêt dense au loin ; la crypte au fond à droite, la clairière devinée à gauche |
| Clairière de la faucheuse (centre gauche, derrière le poteau-lanterne) | Tirage au sort, remerciements | Chaudron rempli de bonbons tout près de la caméra (pas sur le feu), faucheuse animée juste derrière (robe fermée à grandes manches, capuche, grande faux), brume épaisse et stagnante, cadeaux éparpillés à droite, arbres morts et rochers |
| Intérieur de la crypte | `/resultats` | La caméra continue d'avancer pendant que les chauves-souris sortent par la porte. Salle en pierre (pack Dungeon), torches, étagères à bougies, tonneaux ; un grand bras squelette articulé, vu comme dans un jeu (il entre par le bas de l'écran, coude et épaule toujours hors champ), dépoussière le classement en direct (en colonne), qui s'ouvre en grand au clic (modale posée sur une motte de terre garnie de citrouilles, crânes, bougies et pierre tombale, avec un poteau-lanterne planté dedans — rendus des modèles Halloween Bits et Forest Nature ; podium or, argent, bronze) ; table avec chapeaux de sorcière, bougies et grosse citrouille ; badge Chamas Tacos sur un tonneau, cercueil debout ; toiles d'araignée en 3D tendues entre piliers et plafond, araignées suspendues ; la caméra respire largement ; à gauche de la salle, la lumière est constante |

- Fidélité au style KayKit : le décor réutilise au maximum les packs **Halloween Bits**, **Dungeon**, **Forest Nature**, **Skeletons** et les **logos Chamas Tacos 3D** (style KayKit, versions Halloween) (la faucheuse est le « Skeleton Rogue », repeint). Les objets construits dans le code (chaudron, bonbons, cadeaux, chapeaux de sorcière, faux, robe, mains, toiles, araignées) sont peints avec **les atlas de couleurs des packs** (même dégradé vertical par cellule).
- Code : `src/components/scene/` — `world.ts` (rendu, chargement progressif, caméra, lumières, chauves-souris, yeux, fumée), `outdoor.ts` (cimetière, clairière), `crypt.ts` (intérieur et mur du classement), `props.ts` (objets peints avec les atlas), `core.ts` (utilitaires, particules). Préparation des modèles : `scripts/3d/`.
- Chargement progressif : le cimetière (`halloween.glb`) s'affiche d'abord, puis les logos et la clairière (`logos.glb`, `reaper.glb`, `forest.glb`) ; la crypte (`dungeon.glb`) n'est construite qu'au moment d'y aller. Environ 1,4 Mo de modèles au total, compressés Meshopt. La forêt du fond (220 arbres, 110 sur appareil modeste) est instanciée : 4 appels de dessin.
- Performances : matériaux partagés par pack, **nombre fixe de lumières** attribuées aux flammes les plus proches (pas de recompilation de shader), particules instanciées, résolution réduite si le téléphone peine. Environ 130 appels de dessin par image au cimetière, 80 dans la clairière, 45 dans la crypte (mesuré sur mobile). Décor désactivé en mode « économie de données » ou en 2G (ciel seul), allégé en 3G. Sans WebGL, la page des résultats affiche la liste classique.
- Animations réduites (réglage système) : pas de mouvements de caméra ni d'animations, le classement est affiché directement.

### Thème

- Thème **sombre par défaut**. Easter egg : **toucher la lune (objet 3D du ciel) au moins 30 fois, vite** (moins de 0,6 s entre deux tapes ; son halo s'avive à chaque tape) ou taper **« lumos »** au clavier passe en mode jour ; pareil sur le soleil ou **« nox »** pour revenir à la nuit. Le choix est mémorisé sur l'appareil.
- Aucun effet d'agrandissement au survol.

### API

| Méthode | Route | Accès |
| --- | --- | --- |
| POST | `/api/responses/create` | public |
| PATCH/POST | `/api/responses/[session]/update` | public (auto-save) |
| POST | `/api/responses/[session]/complete` | public (validation du vote) |
| POST | `/api/responses/[session]/raffle` | public (validation du tirage) |
| GET / DELETE | `/api/responses/[id]` | admin (lecture / écriture) |
| PATCH | `/api/responses/[id]/winner` | admin (écriture) |
| GET/POST | `/api/responses/export?scope=all\|raffle&format=xlsx\|csv` | admin |
| GET | `/api/analytics/summary` · `by-restaurant` (filtres `from`, `to`, `restaurant`) | admin |
| GET | `/api/results` | public (totaux uniquement) |
| GET/POST/PATCH/DELETE | `/api/decorations`, `/api/restaurants` | lecture publique, écriture admin |
| POST | `/api/decorations/upload` | admin (URL d'envoi signée) |

### Sécurité

- Validation Zod côté client **et** côté serveur. Commentaire limité à 300 caractères, sans `<` ni `>`. Téléphone FR normalisé en `+33…`. Email validé.
- Limitation à 100 requêtes/min par IP (10/min sur la connexion admin). Ce compteur est en mémoire, donc propre à chaque instance serverless : il freine les abus simples mais ne remplace pas un WAF.
- Cookie admin signé HMAC, `httpOnly`, `SameSite=Strict`, `Secure` en production, valable 12 h.
- Les exports neutralisent l'injection de formules Excel.
- En-têtes de sécurité : `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`.

## Notes

- Emojis 3D : [Microsoft Fluent UI Emoji](https://github.com/microsoft/fluentui-emoji) (licence MIT), copiés dans `public/emoji`.
- Modèles 3D : [KayKit Halloween Bits](https://kaylousberg.itch.io/halloween-bits), [Dungeon Remastered](https://kaylousberg.itch.io/kaykit-dungeon-remastered), [Forest Nature](https://kaylousberg.itch.io/kaykit-forest), [Skeletons](https://kaylousberg.itch.io/kaykit-skeletons) par Kay Lousberg (licence CC0). Les modèles utilisés sont regroupés par pack dans `public/3d/` (`halloween.glb`, `dungeon.glb`, `forest.glb`, `reaper.glb`, `logos.glb` ; texture partagée, géométrie quantifiée et compressée Meshopt) avec [glTF-Transform](https://gltf-transform.dev). Le dossier source `KayKit_HalloweenBits_1.0_FREE/` n'est pas versionné.
- Fumée, brume, chauves-souris, yeux, chaudron, bonbons, cadeaux, chapeaux, faux, mains, araignées et toiles sont générés par le code, sans fichier supplémentaire.
