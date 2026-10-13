# 🎃 Vote Halloween Chamas Tacos

Questionnaire de vote façon Typeform, avec enregistrement en direct, décor 3D animé et mini-backoffice.

- **Questionnaire** `/` : une question par écran, raccourcis clavier (A/B/C, O/N, Entrée), auto-save à chaque réponse, reprise après fermeture d'onglet.
- **Résultats publics** `/resultats` : classement en direct, sans aucune donnée personnelle.
- **Backoffice** `/admin` : KPI, résultats, graphiques, participants au tirage (marquer les gagnants), réponses, gestion des photos et des restaurants, exports Excel/CSV, mode sombre, actualisation toutes les 30 s.

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
| `NEXT_PUBLIC_SITE_URL` | | URL publique, utilisée pour les partages et l'Open Graph |
| `NEXT_PUBLIC_SOCIAL_URL` / `NEXT_PUBLIC_SOCIAL_LABEL` | | Lien vers le réseau social du tirage en direct (page de remerciement) |
| `NEXT_PUBLIC_VOTE_VIDEO_URL` | | Vidéo optionnelle au-dessus de la question 4 |
| `SUPABASE_STORAGE_BUCKET` | | `decorations` par défaut |

3. Déployez, puis ajoutez votre domaine dans **Settings → Domains**.
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
- Côté votant : carte verticale (3:4) avec carrousel au doigt, icône ⤢ pour la visionneuse plein écran (glisser, flèches, clavier), lecture vidéo au toucher, bouton « Voter pour… ».
- À l'envoi, le navigateur de l'admin prépare les fichiers : photos redressées, réduites à 2048 px et ré-encodées en JPEG (données GPS retirées) ; vidéos vérifiées (lisibles, 50 Mo max) avec une affiche JPEG générée (`<nom>.poster.jpg`). Les fichiers partent **directement** vers Supabase Storage via une URL signée (Vercel limite les requêtes à 4,5 Mo).
- Vidéos conseillées : MP4 H.264, moins de 30 s, 720p, moins de 20 Mo. Les vidéos ne se chargent que si le votant appuie sur lecture (quota de bande passante Supabase : 5 Go/mois en gratuit).

### Décor et thème

- Décor 3D (Three.js) chargé après l'affichage : cimetière low-poly, brume, fumée, braises, nuées de chauves-souris (au démarrage du vote, à la validation, puis de temps en temps), yeux qui s'allument dans la pénombre. Qualité réduite automatiquement sur les téléphones modestes ; décor figé si l'utilisateur a choisi de réduire les animations ; ciel seul sans WebGL.
- Thème **sombre par défaut**. Easter egg : **toucher 3 fois la lune** (en haut à gauche) ou taper **« lumos »** au clavier passe en mode jour ; 3 fois le soleil ou **« nox »** ramène la nuit. Le choix est mémorisé sur l'appareil.
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
- Modèles 3D : [KayKit Halloween Bits](https://kaylousberg.itch.io/halloween-bits) par Kay Lousberg (licence CC0). Les modèles utilisés sont regroupés dans `public/3d/halloween.glb` (un seul fichier, une texture partagée, géométrie quantifiée, ~400 Ko) avec [glTF-Transform](https://gltf-transform.dev) (`mergeDocuments`, `dedup`, `prune`, `quantize`). Le dossier source `KayKit_HalloweenBits_1.0_FREE/` n'est pas versionné.
- Fumée, brume, chauves-souris et yeux sont procéduraux (shaders), sans fichier supplémentaire.
