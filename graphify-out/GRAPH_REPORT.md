# Graph Report - questionnaire-halloween  (2026-10-28)

## Corpus Check
- 217 files · ~430,121 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 28 file(s) not represented in the graph (top: .avif 18, .glb 5, .css 2)

## Summary
- 1934 nodes · 5848 edges · 84 communities (73 shown, 11 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 118 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `6769c34f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- getStore
- admin/ui.tsx
- world.ts
- build.mjs
- outdoor.ts
- SupabaseStore
- Empty
- Store
- props.ts
- fraud-server.ts
- antifraude.mjs
- fingerprint.ts
- createWorld
- package.json
- Fonctionnement
- ResponseRow
- brand/render.mjs
- store.ts
- createCrypt
- compilerOptions
- ref_node_assert
- 6. Résultats
- pack-models.mjs
- upload.ts
- engine.ts
- dependencies
- RiskMethodology.tsx
- modal-props/render.mjs
- export/route.ts
- raffle-props/render.mjs
- og.mjs
- devDependencies
- core.ts
- rand
- prize-props/render.mjs
- risk.ts
- scripts
- posters.mjs
- laugh.mjs
- glow.ts
- wordmark.mjs
- AGENTS.md
- db.ts
- CLAUDE.md
- FraudReview.tsx
- fraud-rules.ts
- schema.ts
- AdminDashboard.tsx
- framer-motion
- verificateur-scene.md
- Audit de sécurité — Questionnaire Halloween Chamas Tacos
- three
- Questionnaire.tsx
- next
- withBase
- getStore
- clicks.ts
- ref_node_path
- clock.ts
- analytics.ts
- Card
- ShareButtons.tsx
- login/layout.tsx
- vercel.json
- visits.ts
- fraud-graph.ts
- replay.test.ts
- eslint.config.mjs
- ffmpeg.worker.ts
- device-memory.ts
- responseMatcher
- LocalStore
- demo.ts
- purge.test.ts
- .mutate
- redact.ts
- not-found.tsx
- Sécurité
- isCounted
- export.ts
- Decoration
- PrizesTab.tsx

## God Nodes (most connected - your core abstractions)
1. `getStore()` - 99 edges
2. `withBase()` - 95 edges
3. `json()` - 84 edges
4. `SupabaseStore` - 75 edges
5. `requireRole()` - 74 edges
6. `LocalStore` - 71 edges
7. `Store` - 70 edges
8. `error()` - 63 edges
9. `next` - 51 edges
10. `zodError()` - 46 edges

## Surprising Connections (you probably didn't know these)
- `Compteur de visites (robots écartés)` --references--> `VisitBeacon()`  [INFERRED]
  README.md → src/components/VisitBeacon.tsx
- `F-05 — Authentification par mot de passe partagé, limiteur en mémoire, pas de verrouillage ni de journal des échecs` --references--> `roleForPassword()`  [INFERRED]
  AUDIT-SECURITE-2026-10-24.md → src/lib/auth.ts
- `2. Vercel` --references--> `withBase()`  [INFERRED]
  README.md → src/lib/base-path.ts
- `Verrouillage à l'arrivée` --references--> `recognize()`  [INFERRED]
  README.md → src/lib/fraud-rules.ts
- `F-06 — Données personnelles sans information des visiteurs, sans durée de conservation ; corps des requêtes admin recopié dans le journal` --references--> `logRequest()`  [INFERRED]
  AUDIT-SECURITE-2026-10-24.md → src/lib/guard.ts

## Import Cycles
- None detected.

## Communities (84 total, 11 thin omitted)

### Community 0 - "getStore"
Cohesion: 0.14
Nodes (35): next, zod, decideSchema, POST(), PATCH(), patchSchema, directSchema, bodySchema (+27 more)

### Community 1 - "admin/ui.tsx"
Cohesion: 0.13
Nodes (40): usePage(), edge(), ParticipantDrawer(), Row(), Vote, Votes(), ParticipantRow(), ParticipantsTab() (+32 more)

### Community 2 - "world.ts"
Cohesion: 0.08
Nodes (30): zustand, easeInOut(), BADGE, redraw(), CRYPT_ORIGIN, CryptArea, drawResults(), MEDALS (+22 more)

### Community 3 - "build.mjs"
Cohesion: 0.06
Nodes (47): RFC-5952, decode(), fake, html, out, rows, STATUS, bogons (+39 more)

### Community 4 - "outdoor.ts"
Cohesion: 0.05
Nodes (55): Décor 3D : trois lieux sur un même parcours, createDrops(), createPools(), groundHeight(), BigJack, BLOOD_EYES, BLOOD_POOLS, CAMERA_Z (+47 more)

### Community 5 - "SupabaseStore"
Cohesion: 0.07
Nodes (10): applyResponseFilter(), ConflictError, conflictFields(), filtered(), kindOf(), PgFilter, sameParticipant(), slicePage() (+2 more)

### Community 6 - "Empty"
Cohesion: 0.20
Nodes (31): DecorationDetails(), FavoriteDetails(), foldSeries(), Kpis(), nf(), seriesRows(), Stat(), Table() (+23 more)

### Community 7 - "Store"
Cohesion: 0.05
Nodes (9): afterRegistration(), Store, systemSession(), AdminAction, AdminSession, LoginFailure, Participant, Prize (+1 more)

### Community 8 - "props.ts"
Cohesion: 0.10
Nodes (39): Préparation des modèles 3D, createBladeBloodMaterial(), dripGeometry(), merge(), armReaper(), BoneHand, Candy, CANDY_TINTS (+31 more)

### Community 9 - "fraud-server.ts"
Cohesion: 0.07
Nodes (70): F-15 — Secret des empreintes : repli silencieux sur le secret de session puis sur une constante publique, POST(), daySchema, GET(), POST(), summary(), GET(), POST() (+62 more)

### Community 10 - "antifraude.mjs"
Cohesion: 0.27
Nodes (12): client(), DATA, DECO_A, DECO_B, DEVICE(), login(), main(), ok() (+4 more)

### Community 11 - "fingerprint.ts"
Cohesion: 0.14
Nodes (30): androidModel(), audioRate(), browserName(), canvas(), compute(), crossBrowserText(), entropyClass(), FONT_BASES (+22 more)

### Community 12 - "createWorld"
Cohesion: 0.17
Nodes (26): frame(), flicker(), updateCutGlow(), outdoorPose(), createWorld(), adapt(), applyPalette(), doorSwarm() (+18 more)

### Community 13 - "package.json"
Cohesion: 0.12
Nodes (15): author, contributors, name, private, version, @ffmpeg/core, recharts, @supabase/supabase-js (+7 more)

### Community 14 - "Fonctionnement"
Cohesion: 0.08
Nodes (22): 1. Supabase (~5 min), 2. Vercel, Aperçus des liens, API, Compteur de visites (robots écartés), Crédits, Données et conservation, Démarrage local (sans Supabase) (+14 more)

### Community 15 - "ResponseRow"
Cohesion: 0.15
Nodes (4): refusalRow(), Page, ResponseRow, Visit

### Community 16 - "brand/render.mjs"
Cohesion: 0.11
Nodes (17): appDir, disc, header, here, out, puppeteer, raw, require (+9 more)

### Community 17 - "store.ts"
Cohesion: 0.15
Nodes (15): isDemoMode(), setDemoMode(), Answers, blankSession, emptyAnswers, modeAwareStorage, restartDemo(), Screen (+7 more)

### Community 18 - "createCrypt"
Cohesion: 0.15
Nodes (6): Billboards, smooth(), createCrypt(), placeArm(), plaqueSize(), webMaterial()

### Community 19 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 21 - "6. Résultats"
Cohesion: 0.10
Nodes (20): 6. Résultats, F-01 — Validation du vote sans session ouverte ni cookie : règle « un vote par jour » et score contournables par omission, F-02 — Écritures publiques acceptant des requêtes cross-site « simples », F-04 — Le rôle « lecture seule » accède à toutes les données personnelles, exports compris, F-05 — Authentification par mot de passe partagé, limiteur en mémoire, pas de verrouillage ni de journal des échecs, F-06 — Données personnelles sans information des visiteurs, sans durée de conservation ; corps des requêtes admin recopié dans le journal, F-08 — Horloge de test activable au build sans garde de production, F-09 — Oracle d'inscription au tirage (réponse 409 par champ) (+12 more)

### Community 22 - "pack-models.mjs"
Cohesion: 0.12
Nodes (14): io, args, io, paints, roots, hex(), io, KEEP (+6 more)

### Community 23 - "upload.ts"
Cohesion: 0.09
Nodes (43): start(), asFile(), canvasToBlob(), createPrize(), decodeImage(), drawScaled(), fmtMb(), looksHevc() (+35 more)

### Community 24 - "engine.ts"
Cohesion: 0.06
Nodes (80): react-dom, PublicLayout(), subscribeDemoTab(), ASSETS, SCENE_1_ASSETS, PreloadScene(), useSceneState, canRun3D() (+72 more)

### Community 25 - "dependencies"
Cohesion: 0.12
Nodes (16): dependencies, @ffmpeg/core, framer-motion, lucide-react, next, papaparse, radix-ui, react (+8 more)

### Community 26 - "RiskMethodology.tsx"
Cohesion: 0.17
Nodes (15): BASE, Callout(), earlier(), examples(), n(), OUTCOME_LABEL, RiskMethodology(), Section() (+7 more)

### Community 27 - "modal-props/render.mjs"
Cohesion: 0.18
Nodes (10): crops, here, meta, packsRoot, { PNG }, projectRoot, require, [rootArg, packsArg, outDir] (+2 more)

### Community 28 - "export/route.ts"
Cohesion: 0.32
Nodes (7): GET, handle(), PERSONAL_COLUMNS, POST, RESPONSE_STATUSES, toCsv(), toXlsx()

### Community 29 - "raffle-props/render.mjs"
Cohesion: 0.18
Nodes (10): here, meta, packsRoot, { PNG }, projectRoot, puppeteer, require, [rootArg, packsArg, outDir] (+2 more)

### Community 30 - "og.mjs"
Cohesion: 0.13
Nodes (12): CARDS, chrome, here, out, puppeteer, require, root, server (+4 more)

### Community 31 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/turbopack, @types/node, @types/papaparse, @types/react (+3 more)

### Community 32 - "core.ts"
Cohesion: 0.28
Nodes (13): BLOOD_COLOR, bloodTexture(), createBloodMaterial(), PoolSpec, canvasTexture(), dustTexture(), glowTexture(), seeded() (+5 more)

### Community 33 - "rand"
Cohesion: 0.48
Nodes (5): createBloodScreen(), reset(), splash(), Inj, rand()

### Community 34 - "prize-props/render.mjs"
Cohesion: 0.13
Nodes (13): typescript, here, outDir, packsRoot, { PNG }, projectRoot, puppeteer, require (+5 more)

### Community 35 - "risk.ts"
Cohesion: 0.14
Nodes (24): browserFamily(), browserMismatch(), chBrands(), chFamily(), DECLARED_ALIASES, DEFAULT_RISK_SETTINGS, IP_DAILY_MAX_FLAG, IP_DAILY_MAX_LABEL (+16 more)

### Community 36 - "scripts"
Cohesion: 0.22
Nodes (9): scripts, build, dev, lint, seed:images, start, test, test:e2e (+1 more)

### Community 37 - "posters.mjs"
Cohesion: 0.15
Nodes (14): args, block(), cssOnly, FORMATS, out, puppeteer, require, root (+6 more)

### Community 38 - "laugh.mjs"
Cohesion: 0.12
Nodes (12): buf, [dir, root = "."], out, puppeteer, require, server, puppeteer, require (+4 more)

### Community 39 - "glow.ts"
Cohesion: 0.27
Nodes (12): applyCutGlow(), colGlsl(), CUT_SHINE_ORDER, CutGlow, cutGlowWarmup(), cutGlsl(), CutSpec, f() (+4 more)

### Community 40 - "wordmark.mjs"
Cohesion: 0.14
Nodes (10): here, out, puppeteer, raw, require, root, server, sharp (+2 more)

### Community 42 - "db.ts"
Cohesion: 0.05
Nodes (49): querySchema, querySchema, querySchema, AdminActionInput, AdminSessionInput, AttemptKeys, ClickInput, CompleteResult (+41 more)

### Community 44 - "FraudReview.tsx"
Cohesion: 0.11
Nodes (36): AttemptLine(), device(), DeviceTest, DeviceTestPanel(), run(), ENTROPY, FraudPersons(), toggle() (+28 more)

### Community 45 - "fraud-rules.ts"
Cohesion: 0.14
Nodes (20): crossBrowser(), decide(), Decision, FRAUD_RULE_ORDER, FraudReason, IpClassName, Recognition, RecognitionFacts (+12 more)

### Community 46 - "schema.ts"
Cohesion: 0.08
Nodes (28): FIELDS, FormProps, RaffleErrors, RaffleField, RaffleForm(), RaffleValues, validateRaffle(), COMMENT_MAX (+20 more)

### Community 47 - "AdminDashboard.tsx"
Cohesion: 0.14
Nodes (19): AdminDashboard(), logout(), readTheme(), ClicksCard(), nf(), Who(), FraudNotifications(), Item (+11 more)

### Community 48 - "framer-motion"
Cohesion: 0.40
Nodes (5): framer-motion, COLORS, Confetti(), makePieces(), Piece

### Community 50 - "verificateur-scene.md"
Cohesion: 0.50
Nodes (3): Ce que tu reçois, Méthode, Verdict

### Community 51 - "Audit de sécurité — Questionnaire Halloween Chamas Tacos"
Cohesion: 0.17
Nodes (11): 1. Synthèse exécutive, 2. Périmètre et exclusions, 3. Méthodologie et organisation, 4. Outils utilisés, 5. Limites de l'audit, 7. Plan d'actions priorisé, 8. Zones non couvertes, 9. Suivi des correctifs (+3 more)

### Community 52 - "three"
Cohesion: 0.32
Nodes (10): three, bezier(), Flyer, rand(), startBatSwarm(), launch(), schedule(), startPoint() (+2 more)

### Community 53 - "Questionnaire.tsx"
Cohesion: 0.11
Nodes (32): apiFetch(), enterDemoTab(), ApiError, formatPhoneInput(), Props, Questionnaire(), renderScreen(), SaveIndicator() (+24 more)

### Community 54 - "next"
Cohesion: 0.09
Nodes (32): F-03 — Sessions du backoffice non révocables côté serveur, server-only, AdminPage(), metadata, geo(), POST(), DemoPage(), metadata (+24 more)

### Community 55 - "withBase"
Cohesion: 0.09
Nodes (35): lucide-react, radix-ui, react, AdminLogin(), submit(), metadata, metadata, metadata (+27 more)

### Community 56 - "getStore"
Cohesion: 0.13
Nodes (38): GET(), GET(), GET(), GET(), GET(), POST(), GET(), POST() (+30 more)

### Community 57 - "clicks.ts"
Cohesion: 0.15
Nodes (16): isDemoTab(), trackClick(), VisitBeacon(), Click, clickSchema, ClicksSummary, FOLLOW_TARGETS, FollowTarget (+8 more)

### Community 59 - "clock.ts"
Cohesion: 0.20
Nodes (13): AlreadyVoted(), two(), BlockedVoteDialog(), useCountdown(), clientNow(), parse(), syncedNow(), syncServerClock() (+5 more)

### Community 60 - "analytics.ts"
Cohesion: 0.06
Nodes (48): GET(), inter, metadata, viewport, Home(), metadata, revalidate, LanternPost() (+40 more)

### Community 61 - "Card"
Cohesion: 0.21
Nodes (20): DecorationsTab(), QueueItem, STEP_LABEL, UploadCard(), Card(), Dir, LightboxGroup, MediaLightbox() (+12 more)

### Community 62 - "ShareButtons.tsx"
Cohesion: 0.17
Nodes (20): Btn, copy(), noSubscribe(), ShareButtons(), shareUrl(), InstagramIcon(), LABELS, Network (+12 more)

### Community 66 - "visits.ts"
Cohesion: 0.19
Nodes (12): BOT_UA_RE, isDuplicateVisit(), summarizeVisits(), VISIT_REJECTIONS, VisitCounts, VisitLike, visitorKey(), VisitsSummary (+4 more)

### Community 67 - "fraud-graph.ts"
Cohesion: 0.11
Nodes (32): anchorOf(), buildGroups(), canonicalEmail(), components(), conditionsOf(), cookies(), GraphAttempt, graphChanges() (+24 more)

### Community 68 - "replay.test.ts"
Cohesion: 0.24
Nodes (8): HwEntropy, entropyOf(), fixture, hwOf(), replay(), result, Row, Sim

### Community 69 - "eslint.config.mjs"
Cohesion: 0.50
Nodes (3): eslintConfig, eslint, eslint-config-next

### Community 71 - "device-memory.ts"
Cohesion: 0.44
Nodes (9): idb(), lsGet(), lsSet(), markVoteDay(), readTokens(), readVoteDay(), readVoteDaySync(), rememberToken() (+1 more)

### Community 72 - "responseMatcher"
Cohesion: 0.40
Nodes (4): ResponseFilter, responseMatcher(), responseSort(), keep()

### Community 73 - "LocalStore"
Cohesion: 0.10
Nodes (4): clicksSince(), LocalStore, seed(), visitsSince()

### Community 74 - "demo.ts"
Cohesion: 0.29
Nodes (9): DEMO_RESTART_EVENT, demoFetch(), exitDemoTab(), invalid(), readBody(), readFlag(), reply(), raffleSchema (+1 more)

### Community 75 - "purge.test.ts"
Cohesion: 0.25
Nodes (9): LocalData, migrateLocal(), RETENTION_DAYS, click(), NOW, response(), session(), uuid() (+1 more)

### Community 76 - ".mutate"
Cohesion: 0.08
Nodes (3): humanPatch(), purgeLocal(), GraphChange

### Community 77 - "redact.ts"
Cohesion: 0.36
Nodes (9): maskDetails(), maskEmail(), maskIp(), maskName(), maskParticipant(), maskPhone(), redactVisitForViewer(), SENSITIVE_KEYS (+1 more)

### Community 79 - "Sécurité"
Cohesion: 0.36
Nodes (6): nextConfig, Sécurité, build(), buildCsp(), securityHeaders(), localVoteDay()

### Community 80 - "isCounted"
Cohesion: 0.17
Nodes (6): Anti-fraude : un vote par personne et par jour, countedVotesByParticipant(), groupsByParticipant(), voteColumns(), isCounted(), ResponsePatch

### Community 81 - "export.ts"
Cohesion: 0.39
Nodes (7): papaparse, xlsx, allResponsesRows(), date(), participantsRows(), Row, safe()

### Community 83 - "PrizesTab.tsx"
Cohesion: 0.57
Nodes (6): NewPrizeCard(), submit(), patchPrize(), PrizeRow(), PrizesTab(), prepareImageOnly()

## Knowledge Gaps
- **9 isolated node(s):** `@ffmpeg/core`, `@tailwindcss/turbopack`, `@types/node`, `@types/papaparse`, `@types/react` (+4 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 575 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `LocalStore` connect `LocalStore` to `SupabaseStore`, `Store`, `responseMatcher`, `db.ts`, `.mutate`, `ResponseRow`, `isCounted`, `Decoration`, `getStore`?**
  _High betweenness centrality (0.065) - this node is a cross-community bridge._
- **What connects `@ffmpeg/core`, `@tailwindcss/turbopack`, `@types/node` to the rest of the system?**
  _9 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `getStore` be split into smaller, more focused modules?**
  _Cohesion score 0.1380392156862745 - nodes in this community are weakly interconnected._
- **Why does `next` connect `getStore` to `login/layout.tsx`, `Empty`, `fraud-server.ts`, `demo.ts`, `package.json`, `not-found.tsx`, `Sécurité`, `AdminDashboard.tsx`, `schema.ts`, `PrizesTab.tsx`, `next`, `withBase`, `engine.ts`, `analytics.ts`, `Card`, `ShareButtons.tsx`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **Should `admin/ui.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.12854609929078015 - nodes in this community are weakly interconnected._
- **Why does `SupabaseStore` connect `SupabaseStore` to `getStore`, `db.ts`, `Store`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **Should `world.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08253968253968254 - nodes in this community are weakly interconnected._