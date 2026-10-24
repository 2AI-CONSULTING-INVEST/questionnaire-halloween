# 🎃 Vote Halloween Chamas Tacos

Questionnaire de vote façon Typeform, avec enregistrement en direct, décor 3D animé et mini-backoffice.

En ligne sur **https://www.chamas-nord.fr/halloween**. L'app est servie sous `/halloween` (`basePath`, voir `src/lib/base-path.ts`) ; pour l'instant, tout le reste du domaine (racine, anciens liens) y est redirigé (307, temporaire).

- **Questionnaire** `/halloween` : une question par écran, raccourcis clavier (A/B/C, O/N, Entrée), auto-save à chaque réponse, reprise après fermeture d'onglet, **un vote par appareil et par jour** (réinitialisé à minuit, heure de Paris).
- **Résultats publics** `/halloween/resultats` : classement en direct, sans aucune donnée personnelle.
- **Tirage au sort** `/halloween/participants` : les lots à gagner, la liste des participants (pseudonymes uniquement, recherche, affichage par paquets) et les gagnants dès qu'ils sont désignés.
- **Backoffice** `/halloween/admin` : KPI, résultats, graphiques, participants au tirage (attribuer les lots, modérer les pseudos ; un clic sur le pseudo ou sur le nombre de votes ouvre un panneau latéral avec la fiche du participant et le détail de chacun de ses votes : date, statut, score de risque, réponses, IP, appareil), lots (photos, descriptions), réponses (filtre « Uniquement les inscrits au tirage », qui s'applique aussi aux exports), gestion des photos et des restaurants, journal des sessions (qui s'est connecté : date, rôle, adresse IP, position approximative déduite de l'IP, appareil ; et toutes les actions de la session), exports Excel/CSV (dont l'export des participants au tirage : pseudo, prénom, nom, email, téléphone, date d'inscription, votes, lot gagné), mode sombre, actualisation toutes les 30 s.

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
| `npm test` | Tests unitaires (`node:test`, sans dépendance) : score de risque, curseurs de pagination, échappement `ilike`, statistiques |
| `npm run test:e2e` | Scénarios anti-fraude et pagination contre un serveur local (`tests/e2e/antifraude.mjs`, en-tête du fichier) |
| `npm run seed:images` | Régénère les images de démo |

## Mise en production

### 1. Supabase (~5 min)

1. Créez un projet sur [supabase.com](https://supabase.com) (région UE, ex. Paris ou Francfort).
2. **SQL Editor** → collez puis exécutez `supabase/schema.sql`. Ce script crée les tables (dont `participants`, `prizes` et `settings`), les index, les triggers `updated_at`, le bucket public `decorations` et la liste des 3 restaurants participants (Lille Fives, Lille Moulins, Villeneuve d'Ascq). Il est **idempotent** : sur une base existante, il ajoute seulement ce qui manque (colonnes anti-fraude de `responses` et `participants.deleted_at` via `alter table … add column if not exists`, tables `settings` et `visits`, contraintes d'unicité des participants remplacées par des index uniques partiels, index) sans toucher aux données ; à relancer à chaque mise à jour, **avant** le déploiement : le code lit `participants.deleted_at` et la table `visits` dès son démarrage (le prérendu de `/participants` au build échoue sinon).
3. **Project settings → API** : notez l'URL du projet et la clé `service_role`.

Le RLS est activé **sans policy** : la clé publique `anon` ne peut rien lire ni écrire. Tout passe par les routes API Next.js, côté serveur, avec la clé `service_role`. Cette clé ne doit jamais être exposée au navigateur (pas de préfixe `NEXT_PUBLIC_`).

#### Repartir d'une base vide (remise à zéro complète)

**Irréversible** : supprime tous les votes, participants, lots, restaurants et décorations. À faire juste avant de déployer, tant qu'il n'y a pas de vrais votes.

1. **SQL Editor** → exécutez `supabase/reset.sql` (supprime les tables et fonctions de l'application).
2. **SQL Editor** → exécutez `supabase/schema.sql` (recrée toute la structure et les 3 restaurants).
3. Facultatif : **Storage → decorations**, supprimez les anciens fichiers (ils ne sont plus référencés).
4. Déployez, puis rajoutez les photos des décorations et les lots dans le backoffice.

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
5. Onglet **Lots** : saisissez les lots à gagner (nom, description, photo). Tant qu'aucun lot n'est renseigné, la page `/halloween/participants` affiche « Les lots seront dévoilés très bientôt ».

> Les variables Supabase doivent être présentes **au moment du build** : la page d'accueil est pré-générée, puis régénérée au plus toutes les 60 s et immédiatement après chaque modification faite dans le backoffice.

## Fonctionnement

### Parcours (5 étapes)

| Étape | Question | Obligatoire |
| --- | --- | --- |
| 1 | Q1 · Chamas Tacos préféré (liste avec recherche) | ✅ |
| 2 | Q2 · Vote : meilleure décoration (une carte par restaurant, photos et vidéos) | ✅ |
| 3 | Q3 · Commentaire (300 caractères max) | — |
| 4 | Q4 · Tirage au sort : oui/non, puis pseudonyme (public), téléphone FR, email, et **modale de vérification** avant l'envoi | ✅ si oui |
| 5 | Remerciements, confettis, résultats, lien vers les participants et les lots, cartes « S'abonner » Instagram / TikTok, partage | |

Comme dans le Typeform d'origine, **le vote est validé à la fin de l'étape 3**, avant le tirage au sort. Un votant qui ne laisse pas ses coordonnées est quand même compté. Une fois le vote validé, seul le choix oui / non du tirage reste modifiable.

### Un vote par jour

- Le serveur pose un cookie d'appareil `hw_voter` (uuid aléatoire, `httpOnly`, `SameSite=Lax`, `Secure` en production, chemin `/halloween`, ≈ 400 jours) à l'ouverture de la session de vote ; il est enregistré dans `responses.voter_id` avec le jour du vote `vote_day` (Europe/Paris).
- À la validation (`POST /api/responses/[session]/complete`), un second vote le même jour est refusé (409 `already_voted_today`) : garanti par l'index unique partiel `(voter_id, vote_day) where completed_at is not null`, y compris en requêtes parallèles. `GET /api/vote-status` indique si l'appareil a déjà voté et l'heure de réouverture.
- Sur l'appareil, l'écran « Vous avez déjà voté aujourd'hui » remplace l'accueil, avec un compte à rebours jusqu'à minuit (heure de Paris) qui rouvre le vote sans recharger. Le lendemain, une nouvelle session démarre (coordonnées du tirage pré-remplies). Si l'inscription au tirage n'a pas été faite après le vote du jour, elle reste possible.
- **Score de risque anti-revote** (`src/lib/risk.ts`, calculé à la validation, avant l'écriture) : le navigateur envoie avec `create` et `complete` un champ `device` (`src/lib/fingerprint.ts`, calculé en arrière-plan, jamais bloquant) : un condensé SHA-256 d'attributs du navigateur (UA ou `userAgentData`, langues, fuseau, écran, WebGL, petit rendu canvas, fréquence audio, préférences d'affichage), quelques attributs grossiers (mobile, plateforme, écran, tactile, `webdriver`) et le jour de vote trouvé dans le stockage local de l'app s'il indique un vote validé. Le serveur n'enregistre que `HMAC-SHA256(secret, condensé)` (`RISK_SECRET`, sinon `ADMIN_SESSION_SECRET`) : le condensé brut n'est jamais stocké ni recalculable. Signaux additionnés : même empreinte déjà validée aujourd'hui (+45, +70 à partir de 2), stockage local « voté aujourd'hui » alors que le cookie n'a pas de vote (+50), cookie absent alors que l'empreinte a voté (+15), même empreinte et même IP (+15), IP à 3 / 6 votes (+10 / +20 ; signaux d'IP plafonnés à 20 ensemble : Wi-Fi partagé des restaurants), même empreinte et même décoration (+10), validation en moins de 6 s / 2 s (+25 / +40), `webdriver` (+40), type d'appareil incohérent avec l'UA (+15), navigateur déclaré (Chrome, Safari, Firefox, Edge, Opera, Samsung Internet) incohérent avec l'UA de la requête (+15). Points et libellés vivent dans `RISK_SIGNALS` (`src/lib/risk.ts`), seule source pour le calcul et pour la méthodologie affichée dans l'onglet Sécurité (étapes, table des signaux, trois cas concrets avec les seuils en vigueur, garde-fous, ce qui n'est jamais collecté, limites). Au-delà du seuil de **signalement** (40) le vote est accepté mais listé dans l'onglet Sécurité ; au-delà du seuil de **blocage** (80, mode « block ») il est refusé avec la même réponse 409 `already_voted_today` (l'écran « déjà voté » s'affiche) et la ligne reste non validée (`blocked_at`), donc jamais comptée. Un votant honnête obtient 0 ; deux téléphones identiques sur le même Wi-Fi sont signalés, pas bloqués ; un tiers ne peut gonfler le score d'autrui que par l'IP (≤ 20). Mode « observe » et seuils réglables depuis le backoffice, sans redéploiement ; chaque blocage est visible et réversible (suppression), et un admin peut exclure un vote du classement (`excluded_at`, réversible).
- Données personnelles : rien de plus que l'IP et le navigateur déjà enregistrés, plus un condensé non réversible de l'appareil et quelques attributs grossiers (mobile, plateforme, taille d'écran). Aucune permission demandée au navigateur, aucune donnée brute d'empreinte envoyée ni stockée.
- Limites, assumées : sans compte, un appareil différent (ou un attaquant qui falsifie son empreinte, ce qui ne réduit que sa propre détection) peut revoter. Le cookie `httpOnly`, la limitation de débit et l'unicité email / téléphone / pseudo du tirage (une seule participation par personne) atténuent les abus ; l'IP seule ne bloque jamais (réseaux partagés des restaurants, 4G).

### Espace démo

`/halloween/demo` (réservé aux comptes du backoffice, lien « Espace démo » dans l'en-tête du backoffice) : le vrai questionnaire, avec les vrais restaurants, photos et décor 3D, mais **rien n'est envoyé au serveur**. Pas de vote compté, pas d'inscription au tirage, pas de cookie « déjà voté ». Les appels de l'API sont simulés dans le navigateur (`src/components/questionnaire/demo.ts`) avec les mêmes validations que les routes, et la session de démo a sa propre clé `localStorage` (elle ne touche pas au vrai vote de l'appareil). La démo est **collante** : `/demo` pose un drapeau dans le `sessionStorage` de l'onglet ; tant qu'il est là, toutes les pages publiques restent en démo (accueil, retour arrière, rechargement…), jusqu'au bouton « Sortir de la démo » ou à la fermeture de l'onglet. Un bandeau « Mode démo · rien n'est enregistré » permet de tout recommencer ou d'en sortir. Seule différence : l'unicité du pseudo, de l'email et du téléphone n'est pas vérifiée (elle demande la base).

### Tirage au sort

- Table `participants` : une personne = un pseudonyme (3 à 24 caractères, unique sans tenir compte de la casse ni des accents), un email et un téléphone uniques, plus un prénom et un nom facultatifs (50 caractères max, jamais affichés publiquement, visibles dans le backoffice et l'export). Les coordonnées ne sont jamais enregistrées en direct pendant la saisie : elles partent à la confirmation dans la modale (minimisation des données) et ne sont gardées que dans le `localStorage` de l'appareil.
- Même personne qui revote un autre jour (pseudo, email **et** téléphone identiques) : sa réponse est reliée à son inscription existante (« Vous êtes déjà inscrit au tirage au sort »). Conflit partiel : refus 409 avec le détail par champ, affiché dans la modale.
- Table `prizes` : un lot a au plus un gagnant, un participant gagne au plus un lot (plusieurs exemplaires = plusieurs lots). Attribution depuis l'onglet **Participants** du backoffice.
- Page publique `/halloween/participants` : gagnants (si un lot est attribué), lots, liste des pseudonymes (jamais d'email ni de téléphone), régénérée au plus toutes les 60 s et après chaque inscription ou modification.
- **Suppression douce** : supprimer un participant depuis le backoffice pose `participants.deleted_at` (la ligne reste) ; il disparaît de la page publique, du tirage, des KPI et des exports, son lot éventuel redevient libre, mais ses votes restent reliés à sa fiche. L'unicité pseudo / email / téléphone ne porte que sur les actifs (index uniques partiels `where deleted_at is null`) : la même personne peut se réinscrire. Un admin peut le **restaurer** (`POST /api/participants/[id]/restore`, journalisé « Restauration : participant ») ; si un actif a pris entre-temps son pseudo, son email ou son téléphone, refus 409 par champ.

### Backoffice

- **Réponses** : sélecteur **Validés / Inachevés / Tous** (défaut Validés) appliqué côté serveur, filtre « inscrits au tirage », colonne « Risque » (score en pastille : orange dès le seuil de signalement, rouge dès le seuil de blocage, signaux au survol), statut (validé / bloqué / exclu / inachevé). Un vote inachevé (`completed_at` et `blocked_at` nuls) affiche la dernière question atteinte (déduite des champs remplis) et sa dernière activité. Les exports CSV / Excel reprennent le filtre courant, en entier.
- **Participants** : recherche (pseudo sans accents, email, téléphone) et tri (pseudo, email, inscription) côté serveur ; nombre de votes validés par personne ; sélecteur **Actifs / Supprimés** (`?deleted=1`) : les supprimés affichent leur date de suppression, un badge « Supprimé » et un bouton **Restaurer** (admin), sans modération ni lot ; la fiche (panneau latéral, votes) reste consultable. Export des supprimés à part (`&deleted=1`, colonne « Supprimé le »).
- **Tableau de bord** : chaque carte graphique (Résultats Q2, Chamas Tacos préféré Q1, Votes dans le temps) a un bouton **Agrandir** qui ouvre une modale plein écran (`ChartDialog`, Échap pour fermer) avec un texte « Comment lire ce graphique », le graphique en grand, des KPI et des tableaux complets : résultats Q2 (leader et écart, votes du jour, part des votants inscrits au tirage ; par restaurant : votes, %, aujourd'hui, meilleur jour, commentaires, inscrits ; évolution par jour et par restaurant), Q1 (restaurant le plus souvent préféré, % des votants fidèles à leur restaurant ; tableau croisé préféré × voté avec totaux ; barres empilées), votes dans le temps (meilleur jour, moyenne, aujourd'hui, heure de pointe ; démarrés / validés par jour, cumul, histogramme par heure de Paris ; tableau par jour avec taux de complétion, inscrits, bloqués). Les agrégats (`byDecorationDaily`, `favoriteVsVote`, `byHour`, `dailyTable`, `comments` / `raffle` par restaurant) viennent de `/api/analytics/summary` (admin) ; `/api/results` et `/resultats` n'exposent rien de plus qu'avant (test unitaire). Palette catégorielle validée clair / sombre (`--viz-s1` à `--viz-s6`).
- **Sécurité** (lecture pour tous, réglages en écriture seulement) : votes validés / signalés / bloqués / exclus du jour (heure de Paris) et depuis le début ; mode `block` / `observe` et seuils (entiers 0–200, signalement < blocage) ; tableau « Votes à examiner » (score ≥ seuil de signalement, bloqués compris : date, score, signaux en clair, IP, appareil, 8 premiers caractères de l'empreinte, Q1, Q2, statut) avec « Exclure du classement » / « Réintégrer » et suppression ; top 10 des IP et des empreintes du jour. Recherche par IP ou début d'empreinte.
- **Pagination** : Réponses, Participants et Sécurité chargent 100 lignes (« 100 sur 1 234 », bouton « Charger 100 de plus »), par curseur `created_at|id` (keyset, index `(created_at desc, id desc)`). Changer un filtre, la recherche ou le tri repart de la première page ; l'actualisation automatique (30 s) recharge les pages déjà affichées sans perdre le filtre ni le défilement. Le tableau de bord passe par `/api/analytics/summary` (KPI « Inachevés » = commencés − validés − bloqués, lien vers l'onglet Réponses filtré) ; l'attribution des lots utilise une liste légère `id, pseudo`.
- Le classement (`/api/results`, `/resultats`, tableau de bord) ignore les votes exclus ; les votes bloqués n'ont pas de `completed_at` et ne sont jamais comptés.

### Journal du backoffice

- À chaque connexion au backoffice, une session est créée (table `admin_sessions`) avec le rôle, l'adresse IP, le navigateur et la position approximative déduite de l'IP par Vercel (ville, région, pays, latitude / longitude ; vides en développement local). L'identifiant de session voyage dans le cookie signé.
- Chaque action est consignée (table `admin_actions`) : connexion, déconnexion, ajouts / modifications / suppressions (lots, participants, réponses, médias, restaurants, envoi de fichier) avec le corps JSON de la requête, et les exports. Les simples lectures (actualisation du tableau de bord) ne sont pas journalisées. Si le journal est indisponible, l'action passe quand même (erreur en console serveur).
- Onglet **Journal** du backoffice (compte en écriture seulement) : sessions du plus récent au plus ancien, lien vers la carte quand la position est connue, actions dépliables.

### Compteur de visites (robots écartés)

- Table `visits` : une ligne par beacon. Côté client, `src/components/VisitBeacon.tsx` (layout public, jamais dans l'espace démo) envoie une fois par onglet et par session de navigation, dans un moment creux, `POST /api/visit` avec la page, la provenance et les signaux d'appareil de `src/lib/fingerprint.ts` (rien de visible, aucune permission, aucune donnée brute).
- Côté serveur (`src/lib/visits.ts`, barrières journalisées dans `visits.rejected`) : agent utilisateur de robot connu ou absent (`ua_bot`), navigateur piloté par un automate (`webdriver`), pas d'empreinte (`no_js_signals` : un robot qui n'exécute pas le JavaScript n'envoie jamais le beacon, celui qui l'imite sans empreinte est écarté), mobile / navigateur déclaré incohérent avec l'UA (`ua_mismatch`). Au-delà de 30 beacons par minute depuis une même adresse IP, les suivants sont ignorés sans être enregistrés (une adresse ne peut pas remplir la table). Une ligne rejetée ne garde que l'IP, l'UA, la raison et le jour. Dédoublonnage : une visite = un beacon accepté, un visiteur unique du jour = une empreinte (sinon un cookie `hw_voter`) distincte ; un même visiteur ne compte qu'une visite par jour et par page.
- Le compteur est une **estimation**, pas un décompte exact : une visite par onglet et par session de navigation, un visiteur unique par empreinte d'appareil et par jour (deux téléphones identiques peuvent se confondre, un même téléphone sur deux navigateurs compte deux fois, un visiteur sans JavaScript n'est pas compté).
- Onglet **Journal**, carte **Visites** : KPI du jour (heure de Paris) et depuis le début (visites, visiteurs uniques, robots écartés), téléphone / ordinateur, top 5 des provenances et des navigateurs, courbe par jour, dernières visites paginées (date, IP, appareil, page, provenance, statut) et l'encart « Comment les robots sont écartés ». Aucune méthode n'est imparable : ce sont plusieurs barrières indépendantes combinées.

### Enregistrement en direct

- Choix (radio, liste, image) : envoi immédiat (`PATCH /api/responses/:session/update`).
- Champs texte : envoi 1 s après la dernière frappe, et à la sortie du champ. Seules les valeurs valides sont envoyées.
- En cas d'échec : les réponses restent en file d'attente et sont renvoyées automatiquement (délai progressif, retour du réseau). Un toast prévient l'utilisateur et un indicateur « Enregistré » s'affiche en bas à droite.
- À la fermeture de l'onglet, les réponses en attente partent via `sendBeacon`. Les réponses sont aussi gardées dans le `localStorage` : en rouvrant la page, le votant reprend là où il s'était arrêté.
- Si le vote du jour est déjà fait sur cet appareil, l'écran « déjà voté » s'affiche (voir « Un vote par jour »). L'IP et le navigateur sont stockés pour repérer les abus dans l'export.

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
| Clairière de la faucheuse (centre gauche, derrière le poteau-lanterne) | Tirage au sort, remerciements, participants | Chaudron tout près de la caméra (pas sur le feu), rempli uniquement de bonbons emballés sur plusieurs couches (fond sombre, pas de tas), d'où une main squelette sort de temps en temps (toutes les 6 à 11 s : elle force vers le haut poing fermé, s'ouvre, fouille, attrape un bonbon et replonge) ; les bonbons du dessus ont une petite physique (poussés par le bras, soulevés par le poing, chute, glissade sur le dôme, culbute, puis le lit se retasse) ; sol de terre battue propre à la clairière (`createClearingGround` : sillons sinueux, mottes, grain, plaques d'herbe, relief en bump map, fondu dans le sol commun sur les bords, teinte quasi neutre pilotée par la palette) ; faucheuse animée juste derrière (robe fermée à grandes manches, capuche, grande faux) qui, en alternance avec la main tendue vers le chaudron, donne un coup de faux vers l'écran (`src/components/scene/swing.ts` : geste calculé par-dessus l'idle, le pack KayKit n'ayant pas d'attaque — armé derrière l'épaule, frappe avec le manche en travers de l'écran et la pointe de la lame vers le visiteur, suite du geste sous l'objectif, retour ; IK à deux os sur le bras gauche, buste et tête qui suivent, sursaut de caméra à l'impact), brume épaisse et stagnante, cadeaux éparpillés à droite, arbres morts et rochers. **Ambiance sanguinolente** (ce lieu seulement, comme sur le flyer) : flaques et éclaboussures au sol (mates : le sang a bu la terre), sang fluide animé en shader sur les deux faces de la lame de la faux (nappe qui ruisselle vers le tranchant, gouttes qui gonflent et se détachent), rebord du chaudron qui dégouline, gouttes qui tombent, yeux de la faucheuse rouge braise en amande couchée au regard mauvais (inclinés vers le nez, bord supérieur coupé par le sourcil, toujours visibles quel que soit l'angle), brume et brouillard rougis à l'approche, yeux rouges aux sourcils méchants plus nombreux dans la pénombre ; sang qui coule sur l'écran (`src/components/scene/bloodScreen.ts`) : simulation de fluide en champ de hauteur sur le GPU, rendue par-dessus la scène dans le même canvas (nappe en haut qui saigne par endroits, éclaboussures dont le cœur coule en filet, gouttes à tête bombée, traînées, reflets et ombre portée), vignette sombre en CSS (`.sky-blood`) |
| Intérieur de la crypte | `/resultats` | La caméra continue d'avancer pendant que les chauves-souris sortent par la porte. Salle en pierre (pack Dungeon), torches, étagères à bougies, tonneaux ; un grand bras squelette articulé, vu comme dans un jeu (il entre par le bas de l'écran, coude et épaule toujours hors champ), dépoussière le classement en direct (en colonne), qui s'ouvre en grand au clic (modale posée sur une motte de terre garnie de citrouilles, crânes, bougies et pierre tombale, avec un poteau-lanterne planté dedans — rendus des modèles Halloween Bits et Forest Nature ; podium or, argent, bronze) ; table avec chapeaux de sorcière, bougies et grosse citrouille ; badge Chamas Tacos sur un tonneau, cercueil debout ; toiles d'araignée en 3D tendues entre piliers et plafond, araignées suspendues ; la caméra respire largement ; à gauche de la salle, la lumière est constante |

- Fidélité au style KayKit : le décor réutilise au maximum les packs **Halloween Bits**, **Dungeon**, **Forest Nature**, **Skeletons** et les **logos Chamas Tacos 3D** (style KayKit, versions Halloween) (la faucheuse est le « Skeleton Rogue », repeint). Les objets construits dans le code (chaudron, bonbons, cadeaux, chapeaux de sorcière, faux, robe, mains, toiles, araignées) sont peints avec **les atlas de couleurs des packs** (même dégradé vertical par cellule).
- Vérification : l'agent `.claude/agents/verificateur-scene.md` (Claude Code) contrôle une modification de décor dans Chrome et dans le code, point par point, et rend un verdict OK / KO ; à lancer après chaque changement de scène.
- Code : `src/components/scene/` — `world.ts` (rendu, chargement progressif, caméra, lumières, chauves-souris, yeux, fumée), `outdoor.ts` (cimetière, clairière), `crypt.ts` (intérieur et mur du classement), `props.ts` (objets peints avec les atlas ; main de la faucheuse refermée sur la faux par un calcul de contact phalange par phalange, manche en diagonale dans la paume), `bats.ts` (chauves-souris), `core.ts` (utilitaires, particules). Préparation des modèles : `scripts/3d/`.
- Chargement progressif : le cimetière (`halloween.glb`) s'affiche d'abord, puis les logos et la clairière (`logos.glb`, `reaper.glb`, `forest.glb`) ; la crypte (`dungeon.glb`) n'est construite qu'au moment d'y aller. Environ 1,4 Mo de modèles au total, compressés Meshopt. La forêt du fond (220 arbres, 110 sur appareil modeste) est instanciée : 4 appels de dessin.
- Performances : matériaux partagés par pack, **nombre fixe de lumières** attribuées aux flammes les plus proches (pas de recompilation de shader), particules instanciées, résolution réduite si le téléphone peine. Environ 130 appels de dessin par image au cimetière, 80 dans la clairière, 45 dans la crypte (mesuré sur mobile). Décor désactivé en mode « économie de données » ou en 2G (ciel seul), allégé en 3G. Sans WebGL, la page des résultats affiche la liste classique.
- Animations réduites (réglage système) : pas de mouvements de caméra ni d'animations, le classement est affiché directement.

### Thème

- Thème **sombre par défaut**. Easter egg : **toucher la lune (objet 3D du ciel) au moins 30 fois, vite** (moins de 0,6 s entre deux tapes ; son halo s'avive à chaque tape) ou taper **« lumos »** au clavier passe en mode jour ; pareil sur le soleil ou **« nox »** pour revenir à la nuit. Le choix est mémorisé sur l'appareil.
- Aucun effet d'agrandissement au survol.

### Son, compte à rebours, partage

- **Son** (`src/components/sound/engine.ts`) : un seul `AudioContext`, créé à la **première interaction** (règles d'autoplay des navigateurs), qui démarre en fondu ; volume par défaut très bas (gain maître 0,15). Musique : seulement des **passages calmes** des deux morceaux, repérés par `scripts/audio/music-segments.mjs` (RMS par fenêtre de 1 s), à niveau égalisé, un passage différent à chaque fois ; entre deux passages, 75 à 180 s sans musique, souvent avec une plage de **silence complet**. Ambiances et bruitages **synthétisés** (aucun fichier) : grillons et chouette la nuit, corbeaux et oiseaux l'après-midi, vent seulement en rafales et en léger souffle pendant les travellings, crypte presque silencieuse (bougie de temps en temps, loup très lointain), nuées de chauves-souris (individus désynchronisés, distance et stéréo simulées). Rire diabolique « MOUAHAHA HA HA HA » une fois par session, quand le classement se dévoile dans la crypte (`public/son/sfx/rire.wav`, voix de synthèse locale de Windows retravaillée hors ligne : `scripts/audio/laugh-voice.ps1` puis `scripts/audio/laugh.mjs`). Onglet masqué : fondu puis pause. Languette transparente en haut à droite : volume et coupure, mémorisés sur l'appareil.
- **Compte à rebours** jusqu'au prochain vote (minuit à Paris) en haut à droite de toutes les pages publiques tant que le vote du jour est fait ; il se replie seul en languette au bout de 6 s.
- **Décor dès l'arrivée** : une image « poster » du rendu exact de la scène d'arrivée (cimetière, clairière ou crypte avant la révélation ; nuit ou jour ; paysage, paysage large ou portrait) s'affiche immédiatement sous le canvas, préchargée en priorité haute, puis le décor 3D la remplace en fondu. Posters et règles CSS : `scripts/3d/posters.mjs` (à relancer si la scène change).
- **« Non » au tirage** : une modale demande confirmation en mettant les lots du backoffice en vitrine (grand visuel entier sur fond flou de la même image, nom en légende, défilement automatique toutes les 3,5 s, vignettes pour choisir) ; « Finalement, je participe » enchaîne sur la saisie. Depuis la question 1, « précédent » ramène à l'accueil (« Reprendre le vote »).
- **Lots à gagner** (`/participants`) : un clic sur une carte l'agrandit en modale (animation partagée de framer-motion), image à gauche et texte à droite (image en haut sur téléphone), carrousel au clavier, aux flèches, aux indicateurs ou au doigt ; pseudo du gagnant sur la carte et dans la modale. Décor : logo long Chamas Tacos (`public/decor/wordmark.png`, `scripts/3d/brand/wordmark.mjs`), grosses citrouilles-lanternes allumées avec, à leur droite, le petit squelette KayKit qui saute de joie, pile de cadeaux avec le badge rond adossé (`public/decor/prize-*.webp`, `scripts/3d/prize-props/render.mjs`), et de temps en temps une nuée de chauves-souris 3D — les mêmes que dans le décor (`src/components/scene/bats.ts`) — qui surgit au loin autour du panneau et fonce vers l'écran (`participants/prize-bats.ts`, canvas derrière le panneau, arrêté et libéré à la fermeture, absent si les animations sont réduites). Un double-clic sur une carte ne referme pas la modale, et une carte se rouvre aussitôt après une fermeture.
- **Thème jour** : surfaces couleur terre / boue (argile, ocre, brun-olive, terre de Sienne), textes brun très sombre lisibles directement sur le décor, sans voile.
- **Partage** : le lien partagé est toujours `https://www.chamas-nord.fr/halloween` en ligne (l'origine locale en développement). LinkedIn, WhatsApp (`api.whatsapp.com/send` : la redirection de `wa.me` abîme les emojis), Instagram, TikTok et le bouton **lien**, qui copie toujours l'adresse puis ouvre la feuille de partage native quand le navigateur la propose ; Instagram et TikTok n'ayant pas de partage web, le lien est copié avec un message d'explication.

### API

| Méthode | Route | Accès |
| --- | --- | --- |
| POST | `/api/responses/create` | public (pose le cookie `hw_voter` ; 409 si déjà voté aujourd'hui) |
| PATCH/POST | `/api/responses/[session]/update` | public (auto-save) |
| POST | `/api/responses/[session]/complete` | public (validation du vote ; 409 `already_voted_today`) |
| POST | `/api/responses/[session]/raffle` | public (inscription au tirage ; 409 par champ en conflit) |
| GET | `/api/vote-status` | public (l'appareil a-t-il voté aujourd'hui, heure de réouverture) |
| GET / DELETE | `/api/responses/[id]` | admin (lecture / écriture) |
| GET | `/api/admin/responses?limit=100&cursor=…&status=completed\|incomplete\|blocked\|excluded\|all&raffle=1&risk=flagged&q=` | admin (lecture) : page `{ rows, nextCursor, total }` |
| GET | `/api/admin/participants?limit=100&cursor=…&q=&sort=pseudo\|email\|date&dir=asc\|desc&deleted=1` · `?light=1` | admin (lecture) : page `{ rows, nextCursor, total }` (actifs, ou supprimés avec `deleted=1`) ou liste `{ id, pseudo }` des actifs |
| GET | `/api/admin/security` | admin (lecture) : réglages, KPI anti-fraude, top 10 IP / empreintes du jour |
| PATCH | `/api/admin/settings` | admin (écriture, journalisé) : `{ mode, flag_threshold, block_threshold }` |
| PATCH | `/api/responses/[id]` `{ excluded: boolean }` | admin (écriture, journalisé) : exclusion du classement |
| GET | `/api/admin/sessions` | admin (journal : sessions et actions) |
| PATCH / DELETE | `/api/participants/[id]` | admin (modération du pseudo, suppression douce) |
| POST | `/api/participants/[id]/restore` | admin (écriture, journalisé) : restaure un supprimé ; 409 par champ en conflit |
| POST | `/api/visit` | public (beacon de visite ; 204 toujours, rejets enregistrés) |
| GET | `/api/admin/visits?limit=100&cursor=…&status=counted\|rejected\|all` · `/api/admin/visits/summary` | admin (lecture) : page de visites, résumé (jour / total, appareils, provenances, navigateurs, par jour) |
| GET | `/api/participants/[id]/votes` | admin (lecture) : tous les votes reliés au participant, avec la décoration |
| GET / POST | `/api/prizes` · PATCH / DELETE `/api/prizes/[id]` | admin (lots, image, gagnant) |
| GET/POST | `/api/responses/export?scope=all\|participants&format=xlsx\|csv` (`&raffle=1` : réponses des seuls inscrits au tirage ; `&status=completed\|incomplete\|all` ; `&deleted=1` : participants supprimés) | admin (lecture seule comprise) |
| GET | `/api/analytics/summary` · `by-restaurant` (filtres `from`, `to`, `restaurant`) | admin |
| GET | `/api/results` | public (totaux uniquement : `total`, `results[id, restaurant_name, image_url, votes, share]`, `updatedAt`) |
| GET/POST/PATCH/DELETE | `/api/decorations`, `/api/restaurants` | lecture publique, écriture admin |
| POST | `/api/decorations/upload` | admin (URL d'envoi signée) |

### Sécurité

- Validation Zod côté client **et** côté serveur. Commentaire limité à 300 caractères, sans `<` ni `>`. Téléphone FR normalisé en `+33…`. Email validé.
- Limitation à 100 requêtes/min par IP (10/min sur la connexion admin). Ce compteur est en mémoire, donc propre à chaque instance serverless : il freine les abus simples mais ne remplace pas un WAF.
- Cookie admin signé HMAC, `httpOnly`, `SameSite=Strict`, `Secure` en production, valable 12 h. Cookie d'appareil `hw_voter` `httpOnly`, `SameSite=Lax`, sans donnée personnelle.
- Anti-fraude : les signaux envoyés par le navigateur (`device`) sont validés par Zod (types stricts, longueurs bornées, clés inconnues refusées) et ne peuvent qu'augmenter le score de la requête qui les porte ; l'empreinte est un HMAC avec secret serveur ; les réglages et le journal ne sortent que par des routes admin ; l'index unique `(voter_id, vote_day)` reste la barrière finale. Les routes paginées valident `limit` (≤ 200), le curseur (base64url, uuid) et échappent les motifs `ilike`.
- Unicité (pseudo, email, téléphone, gagnant d'un lot) garantie par la base : l'erreur `23505` est traduite en champ en conflit d'après le nom de la contrainte, pas de « vérifier puis insérer » seul.
- La page `/halloween/participants` et ses données ne contiennent que des pseudonymes (React échappe le texte ; aucun `dangerouslySetInnerHTML`).
- Les exports neutralisent l'injection de formules Excel.
- En-têtes de sécurité : `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`.

## Notes

- Emojis 3D : [Microsoft Fluent UI Emoji](https://github.com/microsoft/fluentui-emoji) (licence MIT), copiés dans `public/emoji`.
- Modèles 3D : [KayKit Halloween Bits](https://kaylousberg.itch.io/halloween-bits), [Dungeon Remastered](https://kaylousberg.itch.io/kaykit-dungeon-remastered), [Forest Nature](https://kaylousberg.itch.io/kaykit-forest), [Skeletons](https://kaylousberg.itch.io/kaykit-skeletons) par Kay Lousberg (licence CC0). Les modèles utilisés sont regroupés par pack dans `public/3d/` (`halloween.glb`, `dungeon.glb`, `forest.glb`, `reaper.glb`, `logos.glb` ; texture partagée, géométrie quantifiée et compressée Meshopt) avec [glTF-Transform](https://gltf-transform.dev). Le dossier source `KayKit_HalloweenBits_1.0_FREE/` n'est pas versionné.
- Musiques (`public/son`) : « Diabolus », Geoff Harvey — [Purple Planet Music](https://www.purple-planet.com) (gratuite **avec crédit visible et lien** vers purple-planet.com, sinon licence payante ; crédit affiché dans le panneau du son) ; « Background Horror Music », Soundore (licence non retrouvée : à confirmer auprès de l'auteur avant la mise en ligne). Bruitages synthétisés dans le navigateur.
- Fumée, brume, chauves-souris, yeux, chaudron, bonbons, cadeaux, chapeaux, faux, mains, araignées et toiles sont générés par le code, sans fichier supplémentaire.
