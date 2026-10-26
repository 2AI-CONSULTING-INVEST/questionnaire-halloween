# Graph Report - questionnaire-halloween  (2026-10-26)

## Corpus Check
- 172 files · ~368,942 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 28 file(s) not represented in the graph (top: .avif 18, .glb 5, .css 2)

## Summary
- 1520 nodes · 4391 edges · 68 communities (58 shown, 10 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 68 edges (avg confidence: 0.89)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ea7a9178`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- getStore
- admin/ui.tsx
- world.ts
- glow.ts
- outdoor.ts
- SupabaseStore
- Empty
- Store
- props.ts
- Card
- site.ts
- withBase
- createWorld
- package.json
- Fonctionnement
- risk.ts
- brand/render.mjs
- complete/route.ts
- Questionnaire.tsx
- compilerOptions
- react
- 6. Résultats
- pack-models.mjs
- upload.ts
- engine.ts
- dependencies
- Questionnaire
- modal-props/render.mjs
- export/route.ts
- raffle-props/render.mjs
- og.mjs
- devDependencies
- core.ts
- rand
- prize-props/render.mjs
- analytics.ts
- scripts
- posters.mjs
- laugh.mjs
- world.ts
- AdminDashboard.tsx
- AGENTS.md
- db.ts
- CLAUDE.md
- Questionnaire.tsx
- http.ts
- LocalStore
- schema.ts
- guard.ts
- verificateur-scene.md
- ref_node_fs
- three
- auth.ts
- demo.ts
- redact.ts
- LiveResults.tsx
- antifraude.mjs
- purge.test.ts
- VisitsCard.tsx
- clock.ts
- login/layout.tsx
- Decoration
- vercel.json
- ResponsePatch
- AdminSession

## God Nodes (most connected - your core abstractions)
1. `getStore()` - 80 edges
2. `withBase()` - 79 edges
3. `json()` - 67 edges
4. `SupabaseStore` - 65 edges
5. `LocalStore` - 62 edges
6. `requireRole()` - 58 edges
7. `Store` - 57 edges
8. `error()` - 54 edges
9. `next` - 47 edges
10. `createWorld()` - 40 edges

## Surprising Connections (you probably didn't know these)
- `F-05 — Authentification par mot de passe partagé, limiteur en mémoire, pas de verrouillage ni de journal des échecs` --references--> `roleForPassword()`  [INFERRED]
  AUDIT-SECURITE-2026-10-24.md → src/lib/auth.ts
- `2. Vercel` --references--> `withBase()`  [INFERRED]
  README.md → src/lib/base-path.ts
- `F-06 — Données personnelles sans information des visiteurs, sans durée de conservation ; corps des requêtes admin recopié dans le journal` --references--> `logRequest()`  [INFERRED]
  AUDIT-SECURITE-2026-10-24.md → src/lib/guard.ts
- `Journal du backoffice` --references--> `requireRole()`  [INFERRED]
  README.md → src/lib/guard.ts
- `F-12 — `Cache-Control` absent sur deux routes admin` --references--> `json()`  [INFERRED]
  AUDIT-SECURITE-2026-10-24.md → src/lib/http.ts

## Import Cycles
- None detected.

## Communities (68 total, 10 thin omitted)

### Community 0 - "getStore"
Cohesion: 0.15
Nodes (46): POST(), GET(), POST(), GET(), PATCH(), GET(), DELETE(), PATCH() (+38 more)

### Community 1 - "admin/ui.tsx"
Cohesion: 0.16
Nodes (35): usePage(), edge(), ParticipantDrawer(), Row(), Vote, Votes(), ParticipantRow(), ParticipantsTab() (+27 more)

### Community 2 - "world.ts"
Cohesion: 0.11
Nodes (16): Billboards, smooth(), BADGE, createCrypt(), placeArm(), redraw(), CRYPT_ORIGIN, CryptArea (+8 more)

### Community 3 - "glow.ts"
Cohesion: 0.30
Nodes (11): applyCutGlow(), colGlsl(), CUT_SHINE_ORDER, cutGlowWarmup(), cutGlsl(), CutSpec, f(), glowMaterial() (+3 more)

### Community 4 - "outdoor.ts"
Cohesion: 0.05
Nodes (56): BLOOD_COLOR, bloodTexture(), createBloodMaterial(), createDrops(), createPools(), PoolSpec, groundHeight(), BigJack (+48 more)

### Community 5 - "SupabaseStore"
Cohesion: 0.07
Nodes (11): applyResponseFilter(), ConflictError, conflictFields(), filtered(), kindOf(), PgFilter, sameParticipant(), slicePage() (+3 more)

### Community 6 - "Empty"
Cohesion: 0.20
Nodes (31): DecorationDetails(), FavoriteDetails(), foldSeries(), Kpis(), nf(), seriesRows(), Stat(), Table() (+23 more)

### Community 7 - "Store"
Cohesion: 0.05
Nodes (7): Store, Page, LoginFailure, Participant, Prize, Restaurant, Visit

### Community 8 - "props.ts"
Cohesion: 0.11
Nodes (36): Préparation des modèles 3D, createBladeBloodMaterial(), dripGeometry(), merge(), armReaper(), BoneHand, Candy, CANDY_TINTS (+28 more)

### Community 9 - "Card"
Cohesion: 0.31
Nodes (11): NewPrizeCard(), submit(), patchPrize(), PrizeRow(), PrizesTab(), Callout(), n(), RiskMethodology() (+3 more)

### Community 10 - "site.ts"
Cohesion: 0.05
Nodes (49): react-dom, inter, metadata, viewport, Home(), metadata, revalidate, metadata (+41 more)

### Community 11 - "withBase"
Cohesion: 0.16
Nodes (20): AdminLogin(), submit(), BatSwarm(), Jumper(), PrizeDecor(), GalleryPrize, PrizeImage(), PrizesGallery() (+12 more)

### Community 12 - "createWorld"
Cohesion: 0.18
Nodes (25): frame(), flicker(), updateCutGlow(), outdoorPose(), createWorld(), adapt(), applyPalette(), doorSwarm() (+17 more)

### Community 13 - "package.json"
Cohesion: 0.11
Nodes (17): eslintConfig, author, contributors, name, private, version, eslint, eslint-config-next (+9 more)

### Community 14 - "Fonctionnement"
Cohesion: 0.09
Nodes (21): 1. Supabase (~5 min), 2. Vercel, API, Compteur de visites (robots écartés), Crédits, Données et conservation, Démarrage local (sans Supabase), Enregistrement en direct (+13 more)

### Community 15 - "risk.ts"
Cohesion: 0.06
Nodes (44): nextConfig, Sécurité, buildCsp(), securityHeaders(), audioRate(), browserName(), canvas(), compute() (+36 more)

### Community 16 - "brand/render.mjs"
Cohesion: 0.11
Nodes (17): appDir, disc, header, here, out, puppeteer, raw, require (+9 more)

### Community 17 - "complete/route.ts"
Cohesion: 0.13
Nodes (32): GET(), GET(), POST(), POST(), GET(), POST(), GET(), serverNow() (+24 more)

### Community 18 - "Questionnaire.tsx"
Cohesion: 0.15
Nodes (15): isDemoMode(), setDemoMode(), Answers, blankSession, emptyAnswers, modeAwareStorage, restartDemo(), Screen (+7 more)

### Community 19 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 20 - "react"
Cohesion: 0.24
Nodes (19): radix-ui, DecorationsTab(), GroupRow(), QueueItem, Dir, LightboxGroup, MediaLightbox(), SlideVideo() (+11 more)

### Community 21 - "6. Résultats"
Cohesion: 0.06
Nodes (34): 1. Synthèse exécutive, 2. Périmètre et exclusions, 3. Méthodologie et organisation, 4. Outils utilisés, 5. Limites de l'audit, 6. Résultats, 7. Plan d'actions priorisé, 8. Zones non couvertes (+26 more)

### Community 22 - "pack-models.mjs"
Cohesion: 0.14
Nodes (12): io, args, io, paints, roots, hex(), io, KEEP (+4 more)

### Community 23 - "upload.ts"
Cohesion: 0.22
Nodes (20): UploadCard(), start(), asFile(), canvasToBlob(), createPrize(), decodeImage(), drawScaled(), fmtMb() (+12 more)

### Community 24 - "engine.ts"
Cohesion: 0.07
Nodes (69): canRun3D(), CSSVars, SpookyBackdrop(), STARS, toggleTheme(), applyAmbience(), bats(), birds() (+61 more)

### Community 25 - "dependencies"
Cohesion: 0.13
Nodes (15): dependencies, framer-motion, lucide-react, next, papaparse, radix-ui, react, react-dom (+7 more)

### Community 26 - "Questionnaire"
Cohesion: 0.18
Nodes (17): apiFetch(), Questionnaire(), SaveIndicator(), createSession(), discard(), flush(), initSaver(), Listener (+9 more)

### Community 27 - "modal-props/render.mjs"
Cohesion: 0.18
Nodes (10): crops, here, meta, packsRoot, { PNG }, projectRoot, require, [rootArg, packsArg, outDir] (+2 more)

### Community 28 - "export/route.ts"
Cohesion: 0.23
Nodes (14): papaparse, xlsx, GET, handle(), PERSONAL_COLUMNS, POST, STATUS_FILTER, allResponsesRows() (+6 more)

### Community 29 - "raffle-props/render.mjs"
Cohesion: 0.13
Nodes (11): here, meta, packsRoot, { PNG }, projectRoot, puppeteer, require, [rootArg, packsArg, outDir] (+3 more)

### Community 30 - "og.mjs"
Cohesion: 0.13
Nodes (12): CARDS, chrome, here, out, puppeteer, require, root, server (+4 more)

### Community 31 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/turbopack, @types/node, @types/papaparse, @types/react (+3 more)

### Community 32 - "core.ts"
Cohesion: 0.27
Nodes (13): Décor 3D : trois lieux sur un même parcours, canvasTexture(), dustTexture(), glowTexture(), seeded(), shadowTexture(), smokeTexture(), stoneTexture() (+5 more)

### Community 33 - "rand"
Cohesion: 0.48
Nodes (5): createBloodScreen(), reset(), splash(), Inj, rand()

### Community 34 - "prize-props/render.mjs"
Cohesion: 0.13
Nodes (13): typescript, here, outDir, packsRoot, { PNG }, projectRoot, puppeteer, require (+5 more)

### Community 35 - "analytics.ts"
Cohesion: 0.17
Nodes (17): ResultsPage(), AnalyticsFilter, count(), dayOf(), dayRange(), DecorationResult, loadFiltered(), summarize() (+9 more)

### Community 36 - "scripts"
Cohesion: 0.22
Nodes (9): scripts, build, dev, lint, seed:images, start, test, test:e2e (+1 more)

### Community 37 - "posters.mjs"
Cohesion: 0.14
Nodes (15): Backoffice, args, block(), cssOnly, FORMATS, out, puppeteer, require (+7 more)

### Community 38 - "laugh.mjs"
Cohesion: 0.10
Nodes (15): here, out, puppeteer, raw, require, root, server, sharp (+7 more)

### Community 39 - "world.ts"
Cohesion: 0.10
Nodes (21): easeInOut(), CutGlow, GraveyardArea, Area, EyeStyle, Flame, Frame, Kit (+13 more)

### Community 40 - "AdminDashboard.tsx"
Cohesion: 0.14
Nodes (12): lucide-react, react, metadata, metadata, readTheme(), Filters, lastStep(), ResponsesStatus (+4 more)

### Community 42 - "db.ts"
Cohesion: 0.07
Nodes (37): AdminActionInput, AdminSessionInput, CompleteResult, CONSTRAINT_FIELD, Coordinates, DATA_FILE, DeviceStamp, FILE_NAME_RE (+29 more)

### Community 44 - "Questionnaire.tsx"
Cohesion: 0.15
Nodes (16): framer-motion, COLORS, Confetti(), makePieces(), Piece, formatPhoneInput(), renderScreen(), normalize() (+8 more)

### Community 45 - "http.ts"
Cohesion: 0.17
Nodes (10): next, server-only, zod, querySchema, patchSchema, directSchema, bodySchema, restaurantSchema (+2 more)

### Community 46 - "LocalStore"
Cohesion: 0.11
Nodes (4): LocalStore, pageLocal(), seed(), visitsSince()

### Community 47 - "schema.ts"
Cohesion: 0.08
Nodes (35): ApiError, Props, SCREEN_OF_FIELD, STEP_TITLE, variants, VOTE_FIELDS, Cobweb(), FIELDS (+27 more)

### Community 48 - "guard.ts"
Cohesion: 0.16
Nodes (15): AdminPage(), metadata, GET(), GET(), DemoPage(), metadata, getSummary(), parseFilter() (+7 more)

### Community 50 - "verificateur-scene.md"
Cohesion: 0.50
Nodes (3): Ce que tu reçois, Méthode, Verdict

### Community 51 - "ref_node_fs"
Cohesion: 0.18
Nodes (8): io, [srcDir, outDir, name], puppeteer, require, result, root, server, TRACKS

### Community 52 - "three"
Cohesion: 0.32
Nodes (10): three, bezier(), Flyer, rand(), startBatSwarm(), launch(), schedule(), startPoint() (+2 more)

### Community 54 - "auth.ts"
Cohesion: 0.22
Nodes (16): F-03 — Sessions du backoffice non révocables côté serveur, geo(), POST(), POST(), ADMIN_COOKIE, cookieOptions, createToken(), currentSession() (+8 more)

### Community 55 - "demo.ts"
Cohesion: 0.19
Nodes (17): PublicLayout(), DEMO_RESTART_EVENT, demoFetch(), enterDemoTab(), exitDemoTab(), invalid(), isDemoTab(), readBody() (+9 more)

### Community 56 - "redact.ts"
Cohesion: 0.24
Nodes (13): GET(), querySchema, querySchema, decodeCursor(), PAGE_MAX, PAGE_SIZE, maskEmail(), maskIp() (+5 more)

### Community 57 - "LiveResults.tsx"
Cohesion: 0.21
Nodes (13): zustand, LanternPost(), LiveResults(), MEDALS, pct(), Ranking(), ResultsData, SceneState (+5 more)

### Community 58 - "antifraude.mjs"
Cohesion: 0.27
Nodes (12): client(), DATA, DECO_A, DECO_B, DEVICE(), login(), main(), ok() (+4 more)

### Community 59 - "purge.test.ts"
Cohesion: 0.21
Nodes (9): LocalData, migrateLocal(), purgeLocal(), RETENTION_DAYS, NOW, response(), session(), uuid() (+1 more)

### Community 60 - "VisitsCard.tsx"
Cohesion: 0.33
Nodes (10): device(), Journal, place(), SessionsTab(), Counts(), nf(), Stat(), TopList() (+2 more)

### Community 61 - "clock.ts"
Cohesion: 0.36
Nodes (7): AlreadyVoted(), two(), Emoji(), clientNow(), parse(), TEST_CLOCK_COOKIE, TEST_CLOCK_STORAGE_KEY

## Knowledge Gaps
- **7 isolated node(s):** `@tailwindcss/turbopack`, `@types/node`, `@types/papaparse`, `@types/react`, `@types/react-dom` (+2 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 492 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `withBase()` connect `withBase` to `admin/ui.tsx`, `Empty`, `AdminDashboard.tsx`, `Card`, `site.ts`, `Questionnaire.tsx`, `Fonctionnement`, `schema.ts`, `react`, `demo.ts`, `upload.ts`, `engine.ts`, `LiveResults.tsx`, `Questionnaire`, `VisitsCard.tsx`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **What connects `@tailwindcss/turbopack`, `@types/node`, `@types/papaparse` to the rest of the system?**
  _7 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `world.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10666666666666667 - nodes in this community are weakly interconnected._
- **Why does `next` connect `http.ts` to `getStore`, `Empty`, `AdminDashboard.tsx`, `Card`, `site.ts`, `withBase`, `Questionnaire.tsx`, `package.json`, `risk.ts`, `guard.ts`, `complete/route.ts`, `schema.ts`, `react`, `auth.ts`, `demo.ts`, `engine.ts`, `LiveResults.tsx`, `login/layout.tsx`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **Should `outdoor.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05310734463276836 - nodes in this community are weakly interconnected._
- **Why does `LocalStore` connect `LocalStore` to `getStore`, `Decoration`, `ResponsePatch`, `SupabaseStore`, `Store`, `db.ts`, `.mutate`, `purge.test.ts`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **Should `SupabaseStore` be split into smaller, more focused modules?**
  _Cohesion score 0.06944444444444445 - nodes in this community are weakly interconnected._