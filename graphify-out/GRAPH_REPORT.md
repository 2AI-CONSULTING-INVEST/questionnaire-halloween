# Graph Report - questionnaire-halloween  (2026-10-28)

## Corpus Check
- 214 files · ~421,558 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 28 file(s) not represented in the graph (top: .avif 18, .glb 5, .css 2)

## Summary
- 1901 nodes · 5731 edges · 78 communities (69 shown, 9 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 116 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `26fe3171`
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
- admin/ui.tsx
- ref_node_assert
- site.ts
- createWorld
- package.json
- Fonctionnement
- demo.ts
- brand/render.mjs
- fraud-server.ts
- Questionnaire.tsx
- compilerOptions
- DecorationsTab.tsx
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
- LocalStore
- withBase
- analytics.ts
- verificateur-scene.md
- fraud-graph.ts
- three
- paging.ts
- next
- schema.ts
- redact.ts
- clicks.ts
- antifraude.mjs
- purge.test.ts
- fingerprint.ts
- SecurityTab.tsx
- ShareButtons.tsx
- AlreadyVoted.tsx
- vercel.json
- ResponseRow
- systemSession
- next
- eslint.config.mjs
- ffmpeg.worker.ts
- device-memory.ts
- ConflictError
- LocalStore
- recompute/route.ts
- Confetti.tsx
- Decoration
- Prize

## God Nodes (most connected - your core abstractions)
1. `getStore()` - 99 edges
2. `withBase()` - 95 edges
3. `json()` - 84 edges
4. `SupabaseStore` - 75 edges
5. `requireRole()` - 74 edges
6. `LocalStore` - 72 edges
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

## Communities (78 total, 9 thin omitted)

### Community 0 - "getStore"
Cohesion: 0.11
Nodes (54): zod, GET(), decideSchema, POST(), POST(), POST(), GET(), PATCH() (+46 more)

### Community 1 - "admin/ui.tsx"
Cohesion: 0.13
Nodes (31): run(), usePage(), edge(), ParticipantDrawer(), Row(), Vote, Votes(), ParticipantRow() (+23 more)

### Community 2 - "world.ts"
Cohesion: 0.06
Nodes (37): zustand, Billboards, easeInOut(), smooth(), BADGE, createCrypt(), placeArm(), redraw() (+29 more)

### Community 3 - "build.mjs"
Cohesion: 0.06
Nodes (47): RFC-5952, decode(), fake, html, out, rows, STATUS, bogons (+39 more)

### Community 4 - "outdoor.ts"
Cohesion: 0.05
Nodes (53): Décor 3D : trois lieux sur un même parcours, createDrops(), createPools(), groundHeight(), BigJack, BLOOD_EYES, BLOOD_POOLS, CAMERA_Z (+45 more)

### Community 5 - "SupabaseStore"
Cohesion: 0.07
Nodes (7): applyResponseFilter(), filtered(), kindOf(), PgFilter, slicePage(), SupabaseStore, violatedConstraint()

### Community 6 - "Empty"
Cohesion: 0.22
Nodes (28): DecorationDetails(), FavoriteDetails(), foldSeries(), Kpis(), nf(), seriesRows(), Stat(), Table() (+20 more)

### Community 7 - "Store"
Cohesion: 0.06
Nodes (5): Store, GraphChange, Participant, ResponsePatch, Restaurant

### Community 8 - "props.ts"
Cohesion: 0.10
Nodes (39): Préparation des modèles 3D, createBladeBloodMaterial(), dripGeometry(), merge(), armReaper(), BoneHand, Candy, CANDY_TINTS (+31 more)

### Community 9 - "admin/ui.tsx"
Cohesion: 0.16
Nodes (15): lucide-react, radix-ui, ChartDialog(), Item, Notifications, readSeen(), Filters, FilterSelect() (+7 more)

### Community 10 - "ref_node_assert"
Cohesion: 0.20
Nodes (6): nextConfig, Sécurité, build(), buildCsp(), securityHeaders(), localVoteDay()

### Community 11 - "site.ts"
Cohesion: 0.10
Nodes (21): inter, metadata, viewport, Home(), metadata, revalidate, metadata, revalidate (+13 more)

### Community 12 - "createWorld"
Cohesion: 0.17
Nodes (26): frame(), flicker(), updateCutGlow(), outdoorPose(), createWorld(), adapt(), applyPalette(), doorSwarm() (+18 more)

### Community 13 - "package.json"
Cohesion: 0.11
Nodes (17): author, contributors, name, private, version, @ffmpeg/core, papaparse, recharts (+9 more)

### Community 14 - "Fonctionnement"
Cohesion: 0.08
Nodes (23): 1. Supabase (~5 min), 2. Vercel, Anti-fraude : un vote par personne et par jour, Aperçus des liens, API, Compteur de visites (robots écartés), Crédits, Données et conservation (+15 more)

### Community 15 - "demo.ts"
Cohesion: 0.27
Nodes (10): DEMO_RESTART_EVENT, demoFetch(), exitDemoTab(), invalid(), readBody(), readFlag(), reply(), clientNow() (+2 more)

### Community 16 - "brand/render.mjs"
Cohesion: 0.11
Nodes (17): appDir, disc, header, here, out, puppeteer, raw, require (+9 more)

### Community 17 - "fraud-server.ts"
Cohesion: 0.10
Nodes (56): server-only, POST(), GET(), GET(), POST(), POST(), RECOGNITION_REASON, POST() (+48 more)

### Community 18 - "Questionnaire.tsx"
Cohesion: 0.07
Nodes (47): LETTERS, apiFetch(), enterDemoTab(), isDemoMode(), setDemoMode(), ApiError, formatPhoneInput(), Props (+39 more)

### Community 19 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 20 - "DecorationsTab.tsx"
Cohesion: 0.25
Nodes (19): DecorationsTab(), GroupRow(), QueueItem, STEP_LABEL, Dir, LightboxGroup, MediaLightbox(), SlideVideo() (+11 more)

### Community 21 - "6. Résultats"
Cohesion: 0.06
Nodes (34): 1. Synthèse exécutive, 2. Périmètre et exclusions, 3. Méthodologie et organisation, 4. Outils utilisés, 5. Limites de l'audit, 6. Résultats, 7. Plan d'actions priorisé, 8. Zones non couvertes (+26 more)

### Community 22 - "pack-models.mjs"
Cohesion: 0.12
Nodes (14): io, args, io, paints, roots, hex(), io, KEEP (+6 more)

### Community 23 - "upload.ts"
Cohesion: 0.09
Nodes (43): start(), asFile(), canvasToBlob(), createPrize(), decodeImage(), drawScaled(), fmtMb(), looksHevc() (+35 more)

### Community 24 - "engine.ts"
Cohesion: 0.05
Nodes (81): react-dom, PublicLayout(), subscribeDemoTab(), ASSETS, SCENE_1_ASSETS, PreloadScene(), useSceneState, canRun3D() (+73 more)

### Community 25 - "dependencies"
Cohesion: 0.12
Nodes (16): dependencies, @ffmpeg/core, framer-motion, lucide-react, next, papaparse, radix-ui, react (+8 more)

### Community 26 - "RiskMethodology.tsx"
Cohesion: 0.19
Nodes (14): BASE, Callout(), earlier(), examples(), n(), OUTCOME_LABEL, RiskMethodology(), Section() (+6 more)

### Community 27 - "modal-props/render.mjs"
Cohesion: 0.18
Nodes (10): crops, here, meta, packsRoot, { PNG }, projectRoot, require, [rootArg, packsArg, outDir] (+2 more)

### Community 28 - "export/route.ts"
Cohesion: 0.25
Nodes (14): GET, handle(), PERSONAL_COLUMNS, POST, STATUS_FILTER, allResponsesRows(), date(), participantsRows() (+6 more)

### Community 29 - "raffle-props/render.mjs"
Cohesion: 0.18
Nodes (10): here, meta, packsRoot, { PNG }, projectRoot, puppeteer, require, [rootArg, packsArg, outDir] (+2 more)

### Community 30 - "og.mjs"
Cohesion: 0.13
Nodes (11): CARDS, chrome, here, out, puppeteer, require, root, server (+3 more)

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
Cohesion: 0.15
Nodes (22): F-01 — Validation du vote sans session ouverte ni cookie : règle « un vote par jour » et score contournables par omission, browserFamily(), browserMismatch(), chBrands(), chFamily(), DECLARED_ALIASES, DEFAULT_RISK_SETTINGS, IP_DAILY_MAX_FLAG (+14 more)

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
Nodes (11): here, out, puppeteer, raw, require, root, server, sharp (+3 more)

### Community 42 - "db.ts"
Cohesion: 0.05
Nodes (40): AdminActionInput, AdminSessionInput, AttemptKeys, ClickInput, CompleteResult, CONSTRAINT_FIELD, Coordinates, DATA_FILE (+32 more)

### Community 44 - "FraudReview.tsx"
Cohesion: 0.15
Nodes (26): AttemptLine(), device(), DeviceTest, ENTROPY, FraudPersons(), toggle(), gap(), GroupsView() (+18 more)

### Community 45 - "fraud-rules.ts"
Cohesion: 0.10
Nodes (26): decide(), Decision, FRAUD_RULE_ORDER, FRAUD_RULES, FraudReason, IpClassName, Recognition, RecognitionFacts (+18 more)

### Community 46 - "LocalStore"
Cohesion: 0.07
Nodes (3): clicksSince(), seed(), visitsSince()

### Community 47 - "withBase"
Cohesion: 0.14
Nodes (34): AdminPage(), metadata, AdminDashboard(), logout(), readTheme(), ClicksCard(), Who(), move() (+26 more)

### Community 48 - "analytics.ts"
Cohesion: 0.16
Nodes (19): GET(), ResultsPage(), AnalyticsFilter, count(), dayOf(), dayRange(), DecorationResult, getSummary() (+11 more)

### Community 50 - "verificateur-scene.md"
Cohesion: 0.50
Nodes (3): Ce que tu reçois, Méthode, Verdict

### Community 51 - "fraud-graph.ts"
Cohesion: 0.10
Nodes (40): anchorOf(), buildGroups(), canonicalEmail(), components(), conditionsOf(), cookies(), GraphAttempt, graphChanges() (+32 more)

### Community 52 - "three"
Cohesion: 0.32
Nodes (10): three, bezier(), Flyer, rand(), startBatSwarm(), launch(), schedule(), startPoint() (+2 more)

### Community 53 - "paging.ts"
Cohesion: 0.24
Nodes (9): countedVotesByParticipant(), groupsByParticipant(), pageLocal(), afterCursor(), compareKeys(), Cursor, encodeCursor(), escapeLike() (+1 more)

### Community 54 - "next"
Cohesion: 0.09
Nodes (40): GET(), GET(), GET(), geo(), POST(), POST(), countOf(), GET() (+32 more)

### Community 55 - "schema.ts"
Cohesion: 0.09
Nodes (28): Cobweb(), FIELDS, FormProps, LanternPost(), RaffleConfirmDialog(), RaffleField, RaffleForm(), validateRaffle() (+20 more)

### Community 56 - "redact.ts"
Cohesion: 0.17
Nodes (19): GET(), querySchema, GET(), querySchema, GET(), querySchema, GET(), decodeCursor() (+11 more)

### Community 57 - "clicks.ts"
Cohesion: 0.16
Nodes (12): nf(), Click, clickSchema, ClicksSummary, FOLLOW_TARGETS, FollowTarget, Person, REF_RE (+4 more)

### Community 58 - "antifraude.mjs"
Cohesion: 0.27
Nodes (12): client(), DATA, DECO_A, DECO_B, DEVICE(), login(), main(), ok() (+4 more)

### Community 59 - "purge.test.ts"
Cohesion: 0.23
Nodes (10): LocalData, migrateLocal(), purgeLocal(), RETENTION_DAYS, click(), NOW, response(), session() (+2 more)

### Community 60 - "fingerprint.ts"
Cohesion: 0.09
Nodes (34): androidModel(), audioRate(), browserName(), canvas(), compute(), entropyClass(), genericRenderer(), hardware() (+26 more)

### Community 61 - "SecurityTab.tsx"
Cohesion: 0.23
Nodes (11): SHOW_GROUP_EVENT, Counts(), SecurityTab(), SettingsForm(), save(), Stat(), SWITCHES, TopList() (+3 more)

### Community 62 - "ShareButtons.tsx"
Cohesion: 0.15
Nodes (23): isDemoTab(), Btn, copy(), noSubscribe(), ShareButtons(), shareUrl(), InstagramIcon(), LABELS (+15 more)

### Community 64 - "AlreadyVoted.tsx"
Cohesion: 0.36
Nodes (7): AlreadyVoted(), two(), BlockedVoteDialog(), useCountdown(), syncedNow(), formatWait(), speakWait()

### Community 66 - "ResponseRow"
Cohesion: 0.13
Nodes (4): afterRegistration(), decideVote(), Page, ResponseRow

### Community 67 - "systemSession"
Cohesion: 0.25
Nodes (3): systemSession(), AdminAction, AdminSession

### Community 68 - "next"
Cohesion: 0.08
Nodes (36): framer-motion, next, react, metadata, AdminLogin(), submit(), metadata, metadata (+28 more)

### Community 69 - "eslint.config.mjs"
Cohesion: 0.50
Nodes (3): eslintConfig, eslint, eslint-config-next

### Community 71 - "device-memory.ts"
Cohesion: 0.38
Nodes (10): idb(), lsGet(), lsSet(), markVoteDay(), readTokens(), readVoteDay(), readVoteDaySync(), rememberToken() (+2 more)

### Community 72 - "ConflictError"
Cohesion: 0.40
Nodes (3): ConflictError, conflictFields(), sameParticipant()

### Community 74 - "recompute/route.ts"
Cohesion: 0.60
Nodes (4): daySchema, GET(), POST(), summary()

### Community 75 - "Confetti.tsx"
Cohesion: 0.50
Nodes (4): COLORS, Confetti(), makePieces(), Piece

## Knowledge Gaps
- **9 isolated node(s):** `@ffmpeg/core`, `@tailwindcss/turbopack`, `@types/node`, `@types/papaparse`, `@types/react` (+4 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 573 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `next` to `getStore`, `admin/ui.tsx`, `ref_node_assert`, `site.ts`, `package.json`, `withBase`, `demo.ts`, `fraud-server.ts`, `fraud-graph.ts`, `DecorationsTab.tsx`, `next`, `schema.ts`, `engine.ts`, `ShareButtons.tsx`?**
  _High betweenness centrality (0.068) - this node is a cross-community bridge._
- **What connects `@ffmpeg/core`, `@tailwindcss/turbopack`, `@types/node` to the rest of the system?**
  _9 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `getStore` be split into smaller, more focused modules?**
  _Cohesion score 0.11459459459459459 - nodes in this community are weakly interconnected._
- **Why does `SupabaseStore` connect `SupabaseStore` to `getStore`, `db.ts`, `Store`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **Should `admin/ui.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.13174603174603175 - nodes in this community are weakly interconnected._
- **Why does `LocalStore` connect `LocalStore` to `getStore`, `Store`, `ConflictError`, `db.ts`, `LocalStore`, `paging.ts`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **Should `world.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0611764705882353 - nodes in this community are weakly interconnected._