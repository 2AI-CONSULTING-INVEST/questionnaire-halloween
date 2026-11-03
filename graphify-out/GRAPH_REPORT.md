# Graph Report - questionnaire-halloween  (2026-11-02)

## Corpus Check
- 234 files · ~445,958 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 28 file(s) not represented in the graph (top: .avif 18, .glb 5, .css 2)

## Summary
- 2044 nodes · 6285 edges · 100 communities (78 shown, 22 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 119 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `cb8d99a9`
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
- raffle/route.ts
- fingerprint.ts
- createWorld
- package.json
- Fonctionnement
- device-memory.ts
- brand/render.mjs
- analytics.ts
- createCrypt
- compilerOptions
- Visit
- 6. Résultats
- pack-models.mjs
- video-plan.ts
- engine.ts
- dependencies
- RiskMethodology.tsx
- modal-props/render.mjs
- zodError
- raffle-props/render.mjs
- og.mjs
- devDependencies
- risk.ts
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
- withBase
- Questionnaire
- verificateur-scene.md
- fraud-server.ts
- three
- crypt.ts
- auth.ts
- replay.test.ts
- AdminDashboard.tsx
- LiveResults.tsx
- ref_node_path
- clock.ts
- site.ts
- DecorationsTab.tsx
- SocialCards.tsx
- Questionnaire.tsx
- vercel.json
- ref_node_assert
- fraud-graph.ts
- clicks.ts
- eslint.config.mjs
- ffmpeg.worker.ts
- GraphChange
- recompute/route.ts
- LocalStore
- demo.ts
- redact.ts
- contest.ts
- paging.ts
- not-found.tsx
- store.ts
- ResponsePatch
- by-restaurant/route.ts
- antifraude.mjs
- purge.test.ts
- participants/page.tsx
- AlreadyVoted.tsx
- (public)/layout.tsx
- export.ts
- systemSession
- crown-variants.py
- ShareButtons.tsx
- ConflictError
- demo/page.tsx
- Decoration
- afterRegistration
- Prize
- Restaurant
- LoginFailure

## God Nodes (most connected - your core abstractions)
1. `getStore()` - 107 edges
2. `withBase()` - 105 edges
3. `json()` - 88 edges
4. `requireRole()` - 78 edges
5. `SupabaseStore` - 75 edges
6. `LocalStore` - 71 edges
7. `Store` - 70 edges
8. `error()` - 67 edges
9. `next` - 56 edges
10. `zodError()` - 48 edges

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

## Communities (100 total, 22 thin omitted)

### Community 0 - "getStore"
Cohesion: 0.12
Nodes (53): GET(), GET(), PATCH(), POST(), POST(), GET(), GET(), POST() (+45 more)

### Community 1 - "admin/ui.tsx"
Cohesion: 0.12
Nodes (39): usePage(), edge(), ParticipantDrawer(), Row(), Vote, Votes(), ParticipantRow(), ParticipantsTab() (+31 more)

### Community 2 - "world.ts"
Cohesion: 0.07
Nodes (36): BLOOD_COLOR, bloodTexture(), createBloodMaterial(), PoolSpec, Billboards, canvasTexture(), dustTexture(), easeInOut() (+28 more)

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
Cohesion: 0.20
Nodes (32): DecorationDetails(), FavoriteDetails(), foldSeries(), Kpis(), nf(), seriesRows(), Stat(), Table() (+24 more)

### Community 8 - "props.ts"
Cohesion: 0.10
Nodes (39): Préparation des modèles 3D, createBladeBloodMaterial(), dripGeometry(), merge(), armReaper(), BoneHand, Candy, CANDY_TINTS (+31 more)

### Community 9 - "fraud-server.ts"
Cohesion: 0.12
Nodes (43): server-only, POST(), countOf(), GET(), GET(), POST(), POST(), RECOGNITION_REASON (+35 more)

### Community 10 - "raffle/route.ts"
Cohesion: 0.29
Nodes (9): POST(), handle(), PATCH, POST, Home(), loadContest(), CONFLICT_MESSAGES, votesClosed() (+1 more)

### Community 11 - "fingerprint.ts"
Cohesion: 0.15
Nodes (30): androidModel(), audioRate(), browserName(), canvas(), compute(), crossBrowserText(), entropyClass(), FONT_BASES (+22 more)

### Community 12 - "createWorld"
Cohesion: 0.16
Nodes (28): frame(), flicker(), smooth(), updateCutGlow(), createGraveyard(), makeMist(), outdoorPose(), createWorld() (+20 more)

### Community 13 - "package.json"
Cohesion: 0.11
Nodes (17): author, contributors, name, private, version, @ffmpeg/core, papaparse, recharts (+9 more)

### Community 14 - "Fonctionnement"
Cohesion: 0.08
Nodes (23): 1. Supabase (~5 min), 2. Vercel, Anti-fraude : un vote par personne et par jour, Aperçus des liens, API, Compteur de visites (robots écartés), Crédits, Données et conservation (+15 more)

### Community 15 - "device-memory.ts"
Cohesion: 0.44
Nodes (9): idb(), lsGet(), lsSet(), markVoteDay(), readTokens(), readVoteDay(), readVoteDaySync(), rememberToken() (+1 more)

### Community 16 - "brand/render.mjs"
Cohesion: 0.11
Nodes (17): appDir, disc, header, here, out, puppeteer, raw, require (+9 more)

### Community 17 - "analytics.ts"
Cohesion: 0.18
Nodes (17): GET(), AnalyticsFilter, count(), dayOf(), dayRange(), DecorationResult, loadFiltered(), summarize() (+9 more)

### Community 18 - "createCrypt"
Cohesion: 0.13
Nodes (19): createBloodScreen(), reset(), splash(), Inj, rand(), createCrypt(), burstConfetti(), burstSparks() (+11 more)

### Community 19 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 21 - "6. Résultats"
Cohesion: 0.06
Nodes (32): 1. Synthèse exécutive, 2. Périmètre et exclusions, 3. Méthodologie et organisation, 4. Outils utilisés, 5. Limites de l'audit, 6. Résultats, 7. Plan d'actions priorisé, 8. Zones non couvertes (+24 more)

### Community 22 - "pack-models.mjs"
Cohesion: 0.12
Nodes (14): io, args, io, paints, roots, hex(), io, KEEP (+6 more)

### Community 23 - "video-plan.ts"
Cohesion: 0.16
Nodes (21): Encoded, encodeVideo(), canCompressHere(), COMPRESS_TIMEOUT_MS, COMPRESSED_TAG, decide(), DURATION_TOLERANCE, encodeArgs() (+13 more)

### Community 24 - "engine.ts"
Cohesion: 0.06
Nodes (82): useSceneState, canRun3D(), CSSVars, SpookyBackdrop(), STARS, toggleTheme(), triggerSwarm(), applyAmbience() (+74 more)

### Community 25 - "dependencies"
Cohesion: 0.12
Nodes (16): dependencies, @ffmpeg/core, framer-motion, lucide-react, next, papaparse, radix-ui, react (+8 more)

### Community 26 - "RiskMethodology.tsx"
Cohesion: 0.15
Nodes (17): BASE, Callout(), earlier(), examples(), n(), OUTCOME_LABEL, RiskMethodology(), Section() (+9 more)

### Community 27 - "modal-props/render.mjs"
Cohesion: 0.18
Nodes (10): crops, here, meta, packsRoot, { PNG }, projectRoot, require, [rootArg, packsArg, outDir] (+2 more)

### Community 28 - "zodError"
Cohesion: 0.16
Nodes (21): zod, GET(), querySchema, GET(), querySchema, GET(), querySchema, GET (+13 more)

### Community 29 - "raffle-props/render.mjs"
Cohesion: 0.18
Nodes (10): here, meta, packsRoot, { PNG }, projectRoot, puppeteer, require, [rootArg, packsArg, outDir] (+2 more)

### Community 30 - "og.mjs"
Cohesion: 0.13
Nodes (12): CARDS, chrome, here, out, puppeteer, require, root, server (+4 more)

### Community 31 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/turbopack, @types/node, @types/papaparse, @types/react (+3 more)

### Community 33 - "risk.ts"
Cohesion: 0.15
Nodes (20): browserMismatch(), chBrands(), chFamily(), DECLARED_ALIASES, DEFAULT_RISK_SETTINGS, IP_DAILY_MAX_FLAG, IP_DAILY_MAX_LABEL, LEGACY_FLAG_LABELS (+12 more)

### Community 34 - "prize-props/render.mjs"
Cohesion: 0.13
Nodes (13): typescript, here, outDir, packsRoot, { PNG }, projectRoot, puppeteer, require (+5 more)

### Community 35 - "risk.ts"
Cohesion: 0.19
Nodes (15): browserFamily(), uaBrowser(), uaIsMobile(), BOT_UA_RE, isDuplicateVisit(), summarizeVisits(), VISIT_REJECTIONS, VisitCounts (+7 more)

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
Cohesion: 0.30
Nodes (11): applyCutGlow(), colGlsl(), CUT_SHINE_ORDER, cutGlowWarmup(), cutGlsl(), CutSpec, f(), glowMaterial() (+3 more)

### Community 40 - "wordmark.mjs"
Cohesion: 0.14
Nodes (10): here, out, puppeteer, raw, require, root, server, sharp (+2 more)

### Community 42 - "db.ts"
Cohesion: 0.05
Nodes (42): AdminActionInput, AdminSessionInput, AttemptKeys, ClickInput, CompleteResult, CONSTRAINT_FIELD, Coordinates, DATA_FILE (+34 more)

### Community 44 - "FraudReview.tsx"
Cohesion: 0.11
Nodes (37): AttemptLine(), device(), DeviceTest, DeviceTestPanel(), run(), ENTROPY, FraudPersons(), toggle() (+29 more)

### Community 45 - "fraud-rules.ts"
Cohesion: 0.14
Nodes (21): arrivalVoted(), crossBrowser(), decide(), Decision, FRAUD_RULES, FraudReason, IpClassName, Recognition (+13 more)

### Community 46 - "schema.ts"
Cohesion: 0.08
Nodes (31): Cobweb(), FIELDS, FormProps, LanternPost(), RaffleConfirmDialog(), RaffleErrors, RaffleField, RaffleForm() (+23 more)

### Community 47 - "withBase"
Cohesion: 0.09
Nodes (28): lucide-react, radix-ui, react, metadata, AdminLogin(), submit(), metadata, metadata (+20 more)

### Community 48 - "Questionnaire"
Cohesion: 0.18
Nodes (17): enterDemoTab(), Questionnaire(), SaveIndicator(), createSession(), discard(), flush(), initSaver(), Listener (+9 more)

### Community 50 - "verificateur-scene.md"
Cohesion: 0.50
Nodes (3): Ce que tu reçois, Méthode, Verdict

### Community 51 - "fraud-server.ts"
Cohesion: 0.13
Nodes (25): F-15 — Secret des empreintes : repli silencieux sur le secret de session puis sur une constante publique, atMs(), decideVote(), GraphRun, primaryLang(), requestSignals, ReviewData, toGraphAttempt() (+17 more)

### Community 52 - "three"
Cohesion: 0.32
Nodes (10): three, bezier(), Flyer, rand(), startBatSwarm(), launch(), schedule(), startPoint() (+2 more)

### Community 53 - "crypt.ts"
Cohesion: 0.14
Nodes (19): zustand, BADGE, CeremonyStep, redraw(), CRYPT_ORIGIN, CryptArea, CryptHooks, drawBoardBase() (+11 more)

### Community 54 - "auth.ts"
Cohesion: 0.12
Nodes (27): F-03 — Sessions du backoffice non révocables côté serveur, F-10 — Connexion admin sans trace dans le journal si un en-tête de géolocalisation est malformé ou la base indisponible, next, decideSchema, geo(), POST(), POST(), ADMIN_COOKIE (+19 more)

### Community 55 - "replay.test.ts"
Cohesion: 0.22
Nodes (9): RelatedAttempt, HwEntropy, entropyOf(), fixture, hwOf(), replay(), result, Row (+1 more)

### Community 56 - "AdminDashboard.tsx"
Cohesion: 0.12
Nodes (35): AdminDashboard(), readTheme(), ClicksCard(), nf(), Who(), CardProps, ContestTab(), FieldErrors (+27 more)

### Community 57 - "LiveResults.tsx"
Cohesion: 0.08
Nodes (52): framer-motion, LiveResults(), MEDALS, pct(), Ranking(), LanternPost(), Mound(), metadata (+44 more)

### Community 59 - "clock.ts"
Cohesion: 0.50
Nodes (5): BlockedVoteDialog(), useCountdown(), syncedNow(), formatWait(), speakWait()

### Community 60 - "site.ts"
Cohesion: 0.15
Nodes (14): inter, metadata, viewport, metadata, revalidate, robots(), sitemap(), BASE_PATH (+6 more)

### Community 61 - "DecorationsTab.tsx"
Cohesion: 0.17
Nodes (25): QueueItem, STEP_LABEL, UploadCard(), start(), asFile(), canvasToBlob(), createPrize(), decodeImage() (+17 more)

### Community 62 - "SocialCards.tsx"
Cohesion: 0.23
Nodes (15): ContestOver(), DrawResults(), hasDrawResults(), InstagramIcon(), LABELS, Network, parseFollowed(), readRaw() (+7 more)

### Community 64 - "Questionnaire.tsx"
Cohesion: 0.12
Nodes (22): COLORS, Confetti(), makePieces(), Piece, LETTERS, ApiError, formatPhoneInput(), Props (+14 more)

### Community 66 - "ref_node_assert"
Cohesion: 0.16
Nodes (9): nextConfig, Sécurité, buildCsp(), securityHeaders(), ResponseFilter, responseMatcher(), localVoteDay(), ipFromHeaders() (+1 more)

### Community 67 - "fraud-graph.ts"
Cohesion: 0.11
Nodes (31): anchorOf(), buildGroups(), canonicalEmail(), components(), conditionsOf(), cookies(), GraphAttempt, graphChanges() (+23 more)

### Community 68 - "clicks.ts"
Cohesion: 0.14
Nodes (17): isDemoTab(), readFlag(), trackClick(), VisitBeacon(), Click, clickSchema, ClicksSummary, FOLLOW_TARGETS (+9 more)

### Community 69 - "eslint.config.mjs"
Cohesion: 0.50
Nodes (3): eslintConfig, eslint, eslint-config-next

### Community 72 - "recompute/route.ts"
Cohesion: 0.24
Nodes (10): GET(), GET(), daySchema, GET(), POST(), summary(), applyGraph(), attemptView() (+2 more)

### Community 73 - "LocalStore"
Cohesion: 0.11
Nodes (4): clicksSince(), LocalStore, visitsSince(), provesFraud()

### Community 74 - "demo.ts"
Cohesion: 0.27
Nodes (11): apiFetch(), DEMO_RESTART_EVENT, demoFetch(), exitDemoTab(), invalid(), readBody(), reply(), subscribeDemoTab() (+3 more)

### Community 75 - "redact.ts"
Cohesion: 0.36
Nodes (9): maskDetails(), maskEmail(), maskIp(), maskName(), maskParticipant(), maskPhone(), redactVisitForViewer(), SENSITIVE_KEYS (+1 more)

### Community 76 - "contest.ts"
Cohesion: 0.24
Nodes (6): Contest, CONTEST_KEY, contestPatchSchema, contestSchema, DEFAULT_CONTEST, DrawResults

### Community 77 - "paging.ts"
Cohesion: 0.24
Nodes (9): groupsByParticipant(), pageLocal(), responseSort(), afterCursor(), compareKeys(), Cursor, encodeCursor(), escapeLike() (+1 more)

### Community 79 - "store.ts"
Cohesion: 0.16
Nodes (14): isDemoMode(), setDemoMode(), Answers, blankSession, emptyAnswers, modeAwareStorage, restartDemo(), Screen (+6 more)

### Community 81 - "by-restaurant/route.ts"
Cohesion: 0.67
Nodes (4): GET(), GET(), getSummary(), parseFilter()

### Community 82 - "antifraude.mjs"
Cohesion: 0.27
Nodes (12): client(), DATA, DECO_A, DECO_B, DEVICE(), login(), main(), ok() (+4 more)

### Community 83 - "purge.test.ts"
Cohesion: 0.23
Nodes (10): LocalData, migrateLocal(), purgeLocal(), RETENTION_DAYS, click(), NOW, response(), session() (+2 more)

### Community 84 - "participants/page.tsx"
Cohesion: 0.27
Nodes (9): metadata, ParticipantsPage(), PrizeThumb(), revalidate, ParticipantsList(), drawResultsOf(), normalizePseudo(), pseudoKey() (+1 more)

### Community 85 - "AlreadyVoted.tsx"
Cohesion: 0.36
Nodes (7): AlreadyVoted(), two(), BlockedHelpTab(), seenToday(), TIPS, Divider(), ThanksActions()

### Community 86 - "(public)/layout.tsx"
Cohesion: 0.33
Nodes (6): react-dom, PublicLayout(), ASSETS, SCENE_1_ASSETS, PreloadScene(), CornerRail()

### Community 87 - "export.ts"
Cohesion: 0.39
Nodes (8): countedVotesByParticipant(), allResponsesRows(), date(), participantsRows(), Row, safe(), isCounted(), voteStatus

### Community 88 - "systemSession"
Cohesion: 0.25
Nodes (3): systemSession(), AdminAction, AdminSession

### Community 90 - "ShareButtons.tsx"
Cohesion: 0.39
Nodes (7): Btn, copy(), noSubscribe(), ShareButtons(), shareUrl(), randomRef(), PROD_ORIGIN

### Community 92 - "demo/page.tsx"
Cohesion: 0.38
Nodes (5): AdminPage(), metadata, DemoPage(), metadata, liveSession()

## Knowledge Gaps
- **9 isolated node(s):** `@ffmpeg/core`, `@tailwindcss/turbopack`, `@types/node`, `@types/papaparse`, `@types/react` (+4 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 601 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **22 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getStore()` connect `getStore` to `SupabaseStore`, `recompute/route.ts`, `fraud-server.ts`, `raffle/route.ts`, `db.ts`, `LocalStore`, `site.ts`, `demo/page.tsx`, `analytics.ts`, `participants/page.tsx`, `auth.ts`, `(public)/layout.tsx`, `LiveResults.tsx`, `zodError`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **What connects `@ffmpeg/core`, `@tailwindcss/turbopack`, `@types/node` to the rest of the system?**
  _9 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `getStore` be split into smaller, more focused modules?**
  _Cohesion score 0.11514253980007405 - nodes in this community are weakly interconnected._
- **Why does `SupabaseStore` connect `SupabaseStore` to `getStore`, `db.ts`, `Store`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **Should `admin/ui.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.12473572938689217 - nodes in this community are weakly interconnected._
- **Why does `LocalStore` connect `LocalStore` to `getStore`, `.mutate`, `.recordRefusal`, `ref_node_assert`, `.isOwnFile`, `Store`, `db.ts`, `paging.ts`, `ConflictError`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **Should `world.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07123034227567067 - nodes in this community are weakly interconnected._