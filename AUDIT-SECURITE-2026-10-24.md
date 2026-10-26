# Audit de sécurité — Questionnaire Halloween Chamas Tacos

Date : 24 octobre 2026 · Version auditée : dépôt local, Next.js 16.4.3 (`package.json`), code non committé compris · Classification : confidentiel, usage interne.

## 1. Synthèse exécutive

L'audit a porté sur le code et la configuration du dépôt, par revue statique organisée en cinq lots (architecture, logique métier, API, dépendances, infrastructure) puis une vérification indépendante avec quelques requêtes non destructives sur un serveur local isolé. La production, Vercel et la base Supabase n'ont pas été testés.

Résultat : **21 constats fusionnés**, dont **1 de sévérité élevée**, **5 de sévérité moyenne**, 9 faibles et 6 informatifs. Aucun constat critique sur le code tel qu'il est dans le dépôt ; un point conditionnel (version de Next.js effectivement déployée) peut être critique s'il n'est pas vérifié.

Le constat le plus important (F-01) concerne la finalité même de l'application : un client qui appelle directement la validation du vote, sans cookie d'appareil, sans empreinte et sans ouvrir de session, voit son vote accepté et compté, autant de fois qu'il le souhaite dans la limite du débit. La règle « un vote par jour » et le score anti-fraude reposent sur des éléments que ce client peut simplement omettre. Le correctif est court (exiger que la validation s'appuie sur une session ouverte et sur le cookie posé à l'ouverture) et couvre aussi deux autres constats (F-02, F-18).

Les bonnes pratiques déjà en place sont réelles et nombreuses : clé de service Supabase confinée au serveur, RLS sans policy et droits révoqués pour les clés publiques, jeton admin signé avec comparaison en temps constant et cookie strict, validation zod stricte sur toutes les entrées, requêtes PostgREST protégées, exports neutralisés contre l'injection de formules, aucune ressource tierce chargée par le navigateur, dépendances à jour sans vulnérabilité connue, journalisation des actions admin.

Les cinq moyens sont, par ordre de priorité : requêtes cross-site acceptées par les écritures publiques (F-02), sessions admin non révocables (F-03), rôle « lecture seule » qui exporte toutes les données personnelles (F-04), authentification par mot de passe partagé sans verrouillage durable (F-05), données personnelles sans information des visiteurs ni durée de conservation (F-06).

Cet audit ne permet pas d'affirmer que la plateforme est « sécurisée » : il est statique, limité au dépôt, et plusieurs points dépendent de la configuration réelle de Vercel et de Supabase, non vérifiée.

## 2. Périmètre et exclusions

**Inclus** : l'intégralité du dépôt `questionnaire-halloween` (code applicatif `src/`, routes API, schéma SQL `supabase/`, configuration Next, dépendances `package.json` / `package-lock.json`, scripts de build 3D, tests), ainsi qu'un serveur de test local construit à partir de ce code, avec stockage JSON et identifiants jetables, pour des vérifications non destructives (au plus dix requêtes par scénario).

**Exclus** : le site en production (www.chamas-nord.fr), le projet Vercel (variables, pare-feu, en-têtes ajoutés par la plateforme), le projet Supabase de production (base, bucket, policies de stockage), tout service tiers, le contenu des paquets tiers, le fichier `.env.local` (jamais ouvert) et toute donnée réelle. Aucun test actif, aucun volume, aucun envoi de fichier, aucun brute force, aucune modification de code ou de données réelles.

## 3. Méthodologie et organisation

Six sous-agents aux périmètres disjoints, chacun tenu au même brief (périmètre, interdictions, format) :

1. Architecture et configuration : composants, frontières de confiance, secrets, contrôle d'accès, schéma SQL, journalisation.
2. Code et logique métier : authentification, sessions, autorisations, règle « un vote par jour », score de risque, validation, pagination.
3. API et interfaces : inventaire des 30 routes, erreurs, CORS/CSRF, téléversements, exports, données exposées, cache.
4. Dépendances et chaîne logicielle : versions, avis de sécurité, provenance des paquets, scripts, fichiers ignorés.
5. Infrastructure et déploiement : en-têtes, redirections, cache, stockage, variables, CI/CD, rétention.
6. Vérification indépendante : fusion des doublons, confirmation ou infirmation de chaque constat de sévérité moyenne ou plus, par relecture et par requêtes locales non destructives ; sévérités finales.

Démarche : compréhension de l'architecture et des protections existantes, puis revue statique, puis validation minimale sur l'environnement local isolé, avec sauvegarde et restauration du stockage de test. Chaque constat distingue « vulnérabilité confirmée », « risque potentiel » et « recommandation ».

## 4. Outils utilisés

Lecture de code assistée par le graphe du projet (graphify), `npm audit` (production et développement), `npm ls`, `npm outdated`, `npm view`, consultation de l'API publique d'avis de sécurité du registre npm (noms et versions de paquets seulement), `git check-ignore` / `git ls-files` (lecture), build local sans Supabase, `next start` sur le port 3200 avec stockage JSON, requêtes HTTP par `curl` et `fetch` Node, vérification octet par octet de la restauration du stockage de test.

## 5. Limites de l'audit

- Revue statique : le comportement réel de Vercel (réécriture des en-têtes `x-forwarded-for` et `x-vercel-ip-*`, HSTS automatique, nombre d'instances, pare-feu) n'est pas vérifié ; plusieurs sévérités en dépendent (F-05, F-10, F-11).
- La version de Next.js réellement déployée n'a pas été vérifiée (F-13).
- L'état réel du bucket de stockage et de ses policies n'a pas été vérifié (F-16).
- Les constats faibles et informatifs confirmés par lecture n'ont pas tous été rejoués dynamiquement.
- Le stockage local JSON diffère de PostgreSQL sur certains points (types `inet`, index uniques), ce qui limite la portée des vérifications dynamiques.
- Aucune revue du code des paquets tiers, aucune analyse de la scène 3D au-delà du chargement des ressources.

## 6. Résultats

Sévérités : Critique / Élevée / Moyenne / Faible / Informative. Confiance : Confirmé (lecture ou vérification dynamique), Probable, À vérifier. Les emplacements renvoient aux fichiers du dépôt ; les numéros de ligne sont approximatifs.

### F-01 — Validation du vote sans session ouverte ni cookie : règle « un vote par jour » et score contournables par omission
- **Sévérité** : Élevée. Touche l'intégrité du scrutin, finalité de l'application ; exploitable par un script simple, sans compte.
- **Confiance** : Confirmé (vérification dynamique).
- **Composant** : `src/app/api/responses/[id]/complete/route.ts` (handler POST), `src/lib/voter.ts` (`ensureVoter`), `src/lib/risk.ts` (`scoreRisk`, plafond IP), `src/lib/db.ts` (`completeResponse`, chemin d'insertion de secours).
- **Préconditions et scénario** : aucun compte ni cookie. Un client envoie directement une validation de vote avec un identifiant de session aléatoire, sans cookie d'appareil et sans signaux d'empreinte, sans avoir appelé l'ouverture de session. Sans cookie, un identifiant d'appareil neuf est fabriqué à chaque requête, donc l'index unique « un vote par jour » ne s'applique jamais ; sans empreinte, aucun signal d'appareil ; sans ouverture de session, aucun signal de rapidité ; seuls les signaux d'IP restent, plafonnés sous le seuil de blocage. La ligne est créée par le chemin d'insertion de secours.
- **Élément probant** : trois validations successives avec trois identifiants aléatoires → trois réponses 200 avec un nouveau cookie à chaque fois ; le total public des résultats passe de 361 à 364.
- **Impact** : intégrité (bourrage d'urnes), disponibilité mineure (lignes créées), confiance dans le classement public.
- **Correctif** (priorité 1) : refuser la validation quand la ligne d'ouverture de session n'existe pas ou quand le cookie d'appareil est absent ou ne correspond pas à celui enregistré à l'ouverture ; supprimer ou restreindre l'insertion de secours ; traiter l'absence d'empreinte comme un signal fort ; ajouter un plafond dur par IP et par jour, réglable, distinct du plafond de points. Optionnel : défi anti-robot sur la validation.
- **Vérification** : cas ajouté au script bout en bout « validation sans cookie, sans empreinte, sans ouverture » → 409 ; résultats publics inchangés. **Compensatoire** : surveiller « top IP » dans l'onglet Sécurité et exclure manuellement.

### F-02 — Écritures publiques acceptant des requêtes cross-site « simples »
- **Sévérité** : Moyenne. **Confiance** : Confirmé (dynamique).
- **Composant** : `src/lib/http.ts` (`readJson`, lit le corps quel que soit le `Content-Type`) ; routes `responses/create`, `responses/[id]/update`, `responses/[id]/complete`. Aucun contrôle d'`Origin` ni de `Sec-Fetch-Site`.
- **Scénario** : une page tierce peut déclencher, depuis les navigateurs de ses visiteurs, des requêtes « simples » (corps `text/plain`) vers la validation du vote ; chaque navigateur porte sa propre IP, ce qui contourne les signaux d'IP mieux qu'un script centralisé.
- **Preuve** : validation avec `Content-Type: text/plain`, `Origin` étranger et `Sec-Fetch-Site: cross-site` → 200, vote compté.
- **Impact** : intégrité du scrutin (distribué), pollution de données.
- **Correctif** : dans `readJson`, refuser (415) tout corps dont le `Content-Type` n'est pas `application/json`, ce qui impose la pré-vérification CORS aux navigateurs (elle échoue, faute d'en-têtes CORS) ; refuser `Sec-Fetch-Site: cross-site` sur les écritures ; adapter l'auto-sauvegarde par `sendBeacon` (Blob typé JSON). Le correctif de F-01 neutralise déjà l'essentiel (le cookie `Lax` n'est pas envoyé cross-site). **Vérification** : test unitaire de `readJson` et cas bout en bout.

### F-03 — Sessions du backoffice non révocables côté serveur
- **Sévérité** : Moyenne. **Confiance** : Confirmé (dynamique).
- **Composant** : `src/lib/auth.ts` (`verifyToken` : signature et expiration seulement), `src/app/api/admin/logout/route.ts` (efface le cookie côté client uniquement) ; table `admin_sessions` sans colonne de révocation.
- **Scénario** : un jeton obtenu (poste partagé, journal de proxy, extension) reste valable jusqu'à 12 h après déconnexion et après changement de mot de passe, tant que le secret de session n'est pas renouvelé.
- **Preuve** : connexion, déconnexion (cookie effacé), rejeu de l'ancien cookie sur une route admin → 200.
- **Impact** : confidentialité (données personnelles des participants) et intégrité (écritures admin) pendant la durée résiduelle du jeton.
- **Correctif** : colonne `revoked_at` sur `admin_sessions`, posée à la déconnexion ; `requireRole` vérifie que la session existe et n'est pas révoquée (une lecture indexée) ; bouton « déconnecter cette session » dans le Journal. **Vérification** : rejeu après déconnexion → 401. **Compensatoire** : renouveler le secret de session en cas de doute (déconnecte tout le monde).

### F-04 — Le rôle « lecture seule » accède à toutes les données personnelles, exports compris
- **Sévérité** : Moyenne (conception, pas une faille). **Confiance** : Confirmé (lecture).
- **Composant** : `src/app/api/responses/export/route.ts` (garde `viewer`), `src/lib/export.ts` (colonnes email, téléphone, prénom, nom, adresse IP, navigateur), `GET /api/responses/[id]`, `GET /api/participants/[id]/votes`, listes admin (IP, UA, empreinte).
- **Scénario** : le mot de passe « lecture seule », généralement partagé plus largement, suffit pour télécharger la base complète des participants.
- **Impact** : confidentialité. L'export est journalisé, mais a posteriori.
- **Correctif** : réserver l'export des participants et les colonnes personnelles au rôle `admin`, ou fournir au `viewer` un export sans ces colonnes ; documenter que le mot de passe « lecture seule » est aussi sensible que l'autre. **Vérification** : export avec un cookie viewer → 403.

### F-05 — Authentification par mot de passe partagé, limiteur en mémoire, pas de verrouillage ni de journal des échecs
- **Sévérité** : Moyenne. **Confiance** : Confirmé (lecture) ; effet multi-instance sur Vercel non vérifiable.
- **Composant** : `src/app/api/admin/login/route.ts`, `src/lib/auth.ts` (`roleForPassword`, aucune longueur minimale), `src/lib/rate-limit.ts` (compteur en mémoire par instance, clé sur `x-forwarded-for`).
- **Scénario** : pas d'identifiant, pas de second facteur ; le frein de 10 essais par minute est remis à zéro à chaque démarrage d'instance et réparti entre instances ; les échecs ne sont pas journalisés.
- **Impact** : prise de contrôle du backoffice (données personnelles, suppression de votes, réglages anti-fraude) si le mot de passe est faible.
- **Correctif** : mots de passe longs et aléatoires (24 caractères ou plus) avec contrôle de longueur au démarrage ; compteur d'échecs persistant (table SQL ou KV) avec verrouillage progressif ; journaliser les échecs dans `admin_actions` ; règle de limitation du pare-feu Vercel sur la route de connexion ; à terme, second facteur TOTP. **Compensatoire** : restriction d'accès à `/admin` par liste d'IP ou pare-feu.

### F-06 — Données personnelles sans information des visiteurs, sans durée de conservation ; corps des requêtes admin recopié dans le journal
- **Sévérité** : Moyenne (conformité RGPD/ePrivacy et minimisation, pas une faille technique). **Confiance** : Confirmé (lecture).
- **Composant** : tables `responses` (IP, navigateur, empreinte, attributs d'appareil), `participants` (email, téléphone, prénom, nom), `visits` (IP, navigateur, empreinte), `admin_sessions` (IP et position approximative des administrateurs) ; `src/lib/guard.ts` (`logRequest` copie le corps JSON dans `admin_actions.details`) ; cookie d'appareil de 400 jours (`src/lib/voter.ts`) ; aucune page de confidentialité, aucune purge.
- **Impact** : confidentialité (le volume de données exposées en cas de compromission croît sans limite), juridique.
- **Correctif** : page `/halloween/confidentialite` (responsable, finalités vote / anti-fraude / tirage, données, durées, droits, contact) liée depuis le pied de page et l'étape du tirage ; script `supabase/purge.sql` hebdomadaire ou `pg_cron` (anonymiser IP / navigateur / attributs d'appareil des réponses après 30 jours, supprimer les visites après 90 jours, les sessions admin après 180 jours, les participants après remise des lots) ; masquer email, téléphone, prénom, nom dans `details` du journal ; cookie d'appareil limité à la durée de l'opération (60 jours). **Vérification** : page présente, purge exécutée sur une base de test, comptages à zéro au-delà des durées.

### F-07 — Absence de Content-Security-Policy ; HSTS non posé par l'application
- **Sévérité** : Faible (abaissée : aucune injection trouvée, aucune ressource tierce, et une CSP devrait autoriser les scripts inline de Next). **Confiance** : Confirmé.
- **Composant** : `next.config.ts` (`headers()` : quatre en-têtes présents, pas de CSP ni HSTS) ; deux scripts inline statiques dans `src/app/layout.tsx`.
- **Correctif** : CSP en mode `Report-Only` d'abord, avec `'wasm-unsafe-eval'` (décodeur 3D), l'hôte Supabase pour images, médias et connexions, `frame-ancestors 'none'`, puis bascule en mode bloquant ; `Strict-Transport-Security` explicite ; `Cross-Origin-Opener-Policy: same-origin`. Ne pas ajouter COEP (casserait les images Supabase). **Vérification** : console sans violation sur les pages publiques et le backoffice (envoi de média inclus).

### F-08 — Horloge de test activable au build sans garde de production
- **Sévérité** : Faible (Critique si la variable est présente au build de production). **Confiance** : Confirmé (lecture) ; état de la configuration Vercel non vérifiable.
- **Composant** : `src/lib/clock.ts` (`NEXT_PUBLIC_HW_TEST_CLOCK=1` au build active un cookie qui fixe la date serveur pour tout client).
- **Impact** : contournement total de « un vote par jour » en changeant la date simulée.
- **Correctif** (une ligne) : ignorer l'horloge de test quand `VERCEL_ENV` vaut `production` ; ne jamais définir la variable sur l'environnement Production. **Vérification** : build avec la variable et `VERCEL_ENV=production` → horloge réelle.

### F-09 — Oracle d'inscription au tirage (réponse 409 par champ)
- **Sévérité** : Faible. **Confiance** : Confirmé (dynamique).
- **Composant** : `src/app/api/responses/[id]/raffle/route.ts`, `src/lib/db.ts` (`registerParticipant`, messages par champ).
- **Scénario** : avec une session de vote validée, soumettre une inscription avec un email ou un téléphone à tester révèle, par le champ nommé, si cette personne participe déjà.
- **Correctif** : message générique sans distinguer le champ ; limiteur plus strict sur cette route. **Vérification** : réponse 409 identique quel que soit le champ en conflit.

### F-10 — Connexion admin sans trace dans le journal si un en-tête de géolocalisation est malformé ou la base indisponible
- **Sévérité** : Faible. **Confiance** : Confirmé (dynamique) ; capacité d'un client à imposer cet en-tête derrière Vercel non vérifiée.
- **Composant** : `src/app/api/admin/login/route.ts` (`geo()` : `decodeURIComponent` lève à l'intérieur du bloc qui crée la session ; un identifiant de session aléatoire est alors émis), `src/lib/guard.ts` (journal avalé en cas d'échec).
- **Preuve** : connexion avec un en-tête de ville contenant `%` → 200, cookie posé, session absente de la liste des sessions.
- **Correctif** : protéger `decodeURIComponent` par un `try` ; refuser la connexion (503) ou au minimum journaliser quand la session ne peut pas être créée. **Vérification** : même requête → session présente ou connexion refusée.

### F-11 — Confiance dans `x-forwarded-for` ; valeurs non-IP acceptées
- **Sévérité** : Faible / Informative. **Confiance** : Confirmé en local ; impact en production non vérifiable (Vercel réécrit normalement ces en-têtes).
- **Composant** : `src/lib/rate-limit.ts` (`clientIp`), colonne `ip_address inet`.
- **Scénario** : une valeur non-IP passe le filtre et, sur PostgreSQL, provoque une erreur ponctuelle (500) sur la requête concernée ; hors Vercel, l'en-tête serait falsifiable (limiteur et journal).
- **Correctif** : valider avec `isIP` de `node:net` ; documenter la dépendance à la plateforme.

### F-12 — `Cache-Control` absent sur deux routes admin
- **Sévérité** : Informative. **Confiance** : Confirmé (dynamique), impact minime (réponses authentifiées sans `s-maxage`).
- **Composant** : `GET /api/responses/[id]`, `GET /api/admin/sessions`.
- **Correctif** : `no-store` par défaut dans l'aide `json()`, cache public uniquement sur `results`.

### F-13 — Version de Next.js déployée à confirmer
- **Sévérité** : Informative localement ; Élevée si le déploiement actif a été construit avec Next 16.4.0 ou antérieur. **Confiance** : Confirmé (local) ; production non vérifiable.
- **Composant** : `package.json` (`next` épinglé 16.4.3) ; le build du 23 octobre tournait en 16.4.0, version touchée par deux avis critiques d'exécution de code à distance (optimisation d'images SVG ; fonctions `use cache`) et un avis de déni de service. Atténuants présents : SVG non autorisés à l'optimisation, images distantes restreintes à l'hôte Supabase. `npm audit` : 0 vulnérabilité.
- **Correctif** : vérifier dans Vercel que le déploiement actif est postérieur au passage à 16.4.3, sinon redéployer immédiatement ; suivre les avis (Dependabot ou `npm audit` hebdomadaire). La ligne `experimental.agentUpgrade` est la valeur par défaut, sans effet.

### F-14 — Empoisonnement du score d'appareils identiques
- **Sévérité** : Faible. **Confiance** : Confirmé (lecture).
- **Composant** : `src/lib/risk.ts` (`device_voted_twice` 70 + `device_same_decoration` 10 = 80, seuil de blocage), empreinte choisie par le client.
- **Scénario** : deux votes validés avec un condensé partagé font bloquer ensuite tout appareil identique, sur le même réseau, votant pour la même décoration (déni de vote par modèle d'appareil). Le README affirme à tort qu'un tiers ne peut agir que par l'IP.
- **Correctif** : plafonner les signaux d'empreinte sous le seuil de blocage, ou exiger pour bloquer au moins un signal propre à la requête (rapidité, automate, incohérence) ; corriger le README. **Compensatoire** : mode « observation ».

### F-15 — Secret des empreintes : repli silencieux sur le secret de session puis sur une constante publique
- **Sévérité** : Faible. **Confiance** : Confirmé.
- **Composant** : `src/lib/voter.ts` (`deviceHash`) ; `RISK_SECRET` absent de `.env.example`.
- **Correctif** : réutiliser la fonction de secret de `auth.ts` (erreur explicite en production si absent ou trop court), définir et documenter `RISK_SECRET` distinct.

### F-16 — Bucket de stockage public sans limite de taille ni de type ; contenu de l'envoi direct non vérifié
- **Sévérité** : Faible (admin authentifié ; fichiers servis depuis l'origine Supabase, pas celle du site). **Confiance** : Confirmé (lecture) ; état réel du bucket non vérifié.
- **Composant** : `supabase/schema.sql` (création du bucket sans `file_size_limit` ni `allowed_mime_types`), `src/app/api/decorations/upload/route.ts` (type déclaré seulement), `src/components/admin/upload.ts` (le navigateur fixe le type).
- **Correctif** : `update storage.buckets set file_size_limit = 52428800, allowed_mime_types = array['image/jpeg','image/png','image/webp','image/avif','video/mp4','video/webm'] where id = 'decorations';` dans le schéma ; vérifier l'objet après enregistrement.

### F-17 — Table des visites remplissable par les beacons rejetés
- **Sévérité** : Faible. **Confiance** : Confirmé (lecture).
- **Composant** : `src/app/api/visit/route.ts` (une ligne par beacon rejeté, dans la limite du débit), `src/lib/db.ts` (`listVisits` relit toute la table pour le résumé).
- **Impact** : lenteur de l'onglet Journal, consommation de quota ; pas de perte de données.
- **Correctif** : compteur agrégé par jour et raison (ou dédoublonnage par jour, IP, raison), fenêtre glissante ou agrégation SQL pour le résumé, purge.

### F-18 — Lignes de réponse arbitraires via les routes publiques
- **Sévérité** : Faible. **Confiance** : Confirmé (dynamique, conséquence de F-01).
- **Composant** : `src/lib/db.ts` (insertion de secours dans `updateResponse` et `completeResponse`), `responses/[id]/update`.
- **Correctif** : couvert par le correctif de F-01 ; purge des sessions incomplètes anciennes.

### F-19 — Messages internes relayés au client
- **Sévérité** : Faible (routes admin). **Confiance** : Confirmé.
- **Composant** : `src/app/api/restaurants/route.ts` (message d'erreur PostgreSQL relayé en 409), `src/app/api/decorations/upload/route.ts` (message du stockage relayé), `src/app/api/admin/login/route.ts` (message de configuration manquante).
- **Correctif** : messages fixes, détail en journal serveur.

### F-20 — Cookie admin posé sur tout le domaine
- **Sévérité** : Faible. **Confiance** : Confirmé (dynamique).
- **Composant** : `src/lib/auth.ts` (`cookieOptions.path = "/"`) alors que l'application vit sous `/halloween`.
- **Scénario** : le jeton admin est envoyé à toute ressource de l'hôte, y compris un futur site principal.
- **Correctif** : `path` égal au basePath, comme le cookie d'appareil.

### F-21 — Points informatifs de configuration et de documentation
- **Sévérité** : Informative. **Confiance** : Confirmé.
- `experimental.agentUpgrade: "security"` est la valeur par défaut (sans effet) ; `.env.example` propose un `NEXT_PUBLIC_SITE_URL` sur un domaine tiers ; `RISK_SECRET` et la longueur attendue de `ADMIN_PASSWORD` ne sont pas documentés ; `images.remotePatterns` dépend d'une variable présente au build ; redirections correctes mais `/.well-known/*` et `security.txt` sont redirigés ; aucun contrôle automatique avant déploiement (`vercel.json` avec typecheck et tests recommandé) ; `supabase/migrations/` diverge de `schema.sql` ; `reset.sql` sans garde ni étape de sauvegarde ; outils 3D installés hors `package.json` et serveurs temporaires écoutant sur toutes les interfaces ; `xlsx` installé depuis l'archive de l'éditeur (intégrité épinglée dans le lock, version corrigée, usage en écriture seule ; angle mort : hors `npm audit`, déploiement impossible si l'archive devient indisponible ; vendoriser l'archive ou passer à `exceljs`) ; mises à jour mineures disponibles sans avis de sécurité ; `admin_sessions.role` sans contrainte ; restaurants référencés par nom ; aucun test unitaire sur `auth.ts` / `guard.ts` ; données de test dans `.data/db.json` à supprimer après l'opération.

### Points vérifiés et jugés corrects
Clé de service Supabase confinée aux modules `server-only`, aucune variable sensible exposée au navigateur, `.env.local` et dossiers de données ignorés par Git ; RLS activé sans policy et droits révoqués pour `anon` / `authenticated` sur les neuf tables ; secret de session exigé en production (32 caractères ou plus), jeton HMAC avec comparaison en temps constant, cookie `httpOnly` / `Secure` / `SameSite=Strict` (ce qui couvre aussi le CSRF des routes admin) ; mots de passe comparés en temps constant et jamais journalisés ; toutes les routes d'écriture admin gardées et journalisées, lectures en `viewer` au minimum, routes publiques conformes à la documentation ; idempotence et conditions de course gérées sur la validation du vote et l'inscription au tirage ; schémas zod stricts et bornés, signaux client ne pouvant qu'augmenter le score de la requête qui les porte ; curseurs de pagination, recherche et filtres PostgREST validés et échappés ; noms de fichiers générés côté serveur et vérifiés avant tout accès disque ; exports neutralisés contre l'injection de formules ; résultats publics sans donnée personnelle, mis en cache sans cookie ; aucune ressource tierce chargée à l'exécution (polices auto-hébergées, modèles locaux, images restreintes à l'hôte Supabase) ; `npm audit` sans vulnérabilité, lock complet avec intégrité, une seule source hors registre ; redirections sans boucle ni redirection ouverte ; stockage local refusé sur Vercel.

## 7. Plan d'actions priorisé

**Urgent (avant ou dès la mise à disposition aux clients)**
1. F-01 (+ F-02, F-18) : exiger une session ouverte et le cookie d'appareil correspondant pour valider un vote ; supprimer l'insertion de secours ; refuser les corps non JSON ; cas ajoutés aux tests bout en bout.
2. F-13 : confirmer que le déploiement actif tourne sur Next.js 16.4.3 ; sinon redéployer.
3. F-08 : garde de production sur l'horloge de test (une ligne) et vérification des variables Vercel.
4. F-03 : révocation des sessions admin à la déconnexion.
5. F-05 : mots de passe longs et aléatoires, limitation de débit au niveau du pare-feu Vercel sur la connexion, journalisation des échecs.
6. F-04 : export et colonnes personnelles réservés au rôle `admin`.
7. F-06 : page de confidentialité et durées de conservation (au moins la page, avant l'ouverture au public).

**À planifier (améliorations)**
8. F-07 : CSP en Report-Only puis bloquante, HSTS explicite.
9. F-09, F-10, F-11, F-14, F-15, F-19, F-20 : durcissements courts (messages génériques, `try` sur la géolocalisation, `isIP`, plafond des signaux d'empreinte, secret distinct pour les empreintes, messages d'erreur fixes, portée du cookie admin).
10. F-16, F-17 : limites sur le bucket, agrégation et purge des visites.
11. F-21 : `vercel.json` avec typecheck et tests avant build, garde sur `reset.sql`, documentation des variables, vendorisation de `xlsx`, outils 3D déclarés, mises à jour mineures.

## 8. Zones non couvertes
Configuration réelle de Vercel (variables, pare-feu, en-têtes ajoutés, nombre d'instances), version déployée, projet Supabase de production (bucket, policies, données), comportement de PostgreSQL sur les cas déduits du type de colonne, code des paquets tiers, composants React du backoffice au-delà des extraits, scène 3D, tests sous charge, revue manuelle en navigateur du backoffice.

Ce rapport décrit l'état du dépôt à la date indiquée. Aucune modification de code, de configuration ou de données n'a été faite dans le cadre de l'audit ; seul le dossier de build local `.next/` a été reconstruit.

## 9. Suivi des correctifs

### Lot 1 (urgent) — livré le 26 octobre 2026, vérifié par rejeu indépendant
| Constat | État | Preuve de vérification |
| --- | --- | --- |
| F-01, F-18 | Corrigé | Validation refusée sans session ouverte ou sans le cookie de l'ouverture (409) ; plus d'insertion de secours ; signal « aucune empreinte » (+45) ; plafond journalier par IP réglable (`ip_daily_max`, 60 par défaut) ; rotation de cookie rapide : 5 × 409, total public inchangé ; empreintes aléatoires lentes : refus au plafond ; honnête : 200, score 0 |
| F-02 | Corrigé | Corps non JSON → 415 ; `Sec-Fetch-Site: cross-site` → 403 ; parcours honnête inchangé |
| F-03 | Corrigé | Rejeu du cookie après déconnexion → 401 ; révocation depuis le Journal ; base indisponible → 503 |
| F-04 | Corrigé | Export participants interdit au rôle lecture seule ; IP, navigateur, empreinte, email, téléphone, prénom, nom masqués pour ce rôle sur toutes les routes, top IP compris |
| F-05 | Corrigé | Longueur minimale des mots de passe en production (16) ; échecs journalisés ; verrouillage persistant 10 par IP / 30 global sur 15 min (429), vérifié après redémarrage du serveur |
| F-06 | Corrigé | Page `/confidentialite` (marqueurs `[À compléter]` à renseigner) ; `supabase/purge.sql` et bouton de purge journalisé ; coordonnées masquées dans le journal ; cookie d'appareil 60 jours |
| F-08 | Corrigé | Horloge de test ignorée quand `VERCEL_ENV` vaut `production` (test unitaire) |
| Défauts trouvés en vérification | Corrigés | Refus par score définitif pour la journée (rejeu → 409) ; lecture d'IP durcie (`x-real-ip` sur Vercel, validation `isIP`, clé partagée pour les IP inconnues) |

Limites résiduelles connues : rotation d'adresses IP valides (plafond par IP), comportement de Vercel sur les en-têtes d'IP (hypothèse de plateforme), chemin Supabase relu mais non exécuté. SQL à appliquer avant déploiement : `admin_sessions.revoked_at`, table `login_failures` (dans `schema.sql`, idempotent).

### Lot 2 (améliorations planifiées) — livré le 26 octobre 2026, vérifié par rejeu indépendant
| Constat | État | Preuve de vérification |
| --- | --- | --- |
| F-07 | Corrigé | `Content-Security-Policy-Report-Only` (sans `unsafe-eval`, `frame-ancestors 'none'`, `object-src 'none'`, hôtes Supabase et vidéo ajoutés seulement s'ils sont définis), HSTS 2 ans, COOP `same-origin`, pas de COEP ; présents sur les pages publiques, la connexion admin et l'API ; passage en mode bloquant documenté dans le README |
| F-09 | Corrigé | Conflit d'inscription → 409 générique sans champ (corps identique pour email et téléphone) ; limiteur à 10/min ; même personne qui revote toujours reliée |
| F-10 | Corrigé | En-têtes de géolocalisation malformés → connexion journalisée (valeur brute), plus de session fantôme |
| F-14 | Corrigé (compromis documenté) | Sans signal propre à la requête, score plafonné sous le seuil de blocage, sauf 3e vote du même appareil depuis la même connexion ; un tiers qui aurait voté deux fois depuis le réseau de ses victimes peut encore les faire refuser sur ce réseau (visible, réversible, neutralisé en mode observe) |
| F-15 | Corrigé | Secret des empreintes via la même fonction que le secret de session (longueur minimale, erreur explicite en production), `RISK_SECRET` documenté |
| F-16 | Corrigé (SQL à appliquer) | Limites de taille et de types sur le bucket ; existence de l'objet vérifiée avant enregistrement d'une décoration |
| F-17 | Corrigé | Une ligne rejetée par jour, IP et raison ; relecture des visites bornée à 90 jours et 50 000 lignes |
| F-19 | Corrigé | Messages fixes (restaurant en double, stockage indisponible, configuration manquante) |
| F-20 | Corrigé | Cookie admin limité au chemin `/halloween`, effacé avec le même chemin |
| F-21 | Partiel | Faits : contrôle avant build (`vercel.json`), garde de `reset.sql`, `.env.example`, redirections (`/.well-known`, `security.txt`), `no-store` par défaut (réponses et erreurs), validation interne des identifiants, jeu de caractères des noms, attributs d'appareil minimisés, scripts 3D sur `127.0.0.1`. Écartés (réseau requis, à faire à la main) : vendorisation de `xlsx`, outils 3D épinglés, mises à jour mineures |

SQL à appliquer avant déploiement : `update storage.buckets …` (dans `schema.sql`). Limites résiduelles connues : confirmation d'une inscription par qui connaît déjà les trois coordonnées (F-09), beacons comptés non bornés au-delà du limiteur (F-17), chemins Supabase relus mais non exécutés localement.
