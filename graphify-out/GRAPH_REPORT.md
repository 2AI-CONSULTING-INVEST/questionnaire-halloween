# Graph Report - questionnaire-halloween  (2026-11-05)

## Corpus Check
- 236 files · ~448,502 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 28 file(s) not represented in the graph (top: .avif 18, .glb 5, .css 2)

## Summary
- 2057 nodes · 6342 edges · 88 communities (76 shown, 12 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 119 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `08ef652a`
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
- parisDay
- DecorationGallery.tsx
- fingerprint.ts
- createWorld
- package.json
- Fonctionnement
- device-memory.ts
- brand/render.mjs
- analytics.ts
- createCrypt
- compilerOptions
- security/route.ts
- 6. Résultats
- pack-models.mjs
- video-plan.ts
- engine.ts
- dependencies
- RiskMethodology.tsx
- modal-props/render.mjs
- unlockSound
- raffle-props/render.mjs
- og.mjs
- devDependencies
- LocalStore
- risk.ts
- prize-props/render.mjs
- CornerRail.tsx
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
- http.ts
- auth.ts
- replay.test.ts
- AdminDashboard.tsx
- LiveResults.tsx
- ref_node_path
- SpookyBackdrop.tsx
- site.ts
- upload.ts
- SocialCards.tsx
- questionnaire/ui.tsx
- vercel.json
- ref_node_test
- fraud-graph.ts
- fraud-graph.test.ts
- eslint.config.mjs
- ffmpeg.worker.ts
- soundEvent
- core.ts
- ResponsePatch
- demo.ts
- BlockedVoteDialog.tsx
- participants/page.tsx
- responseMatcher
- not-found.tsx
- store.ts
- Confetti.tsx
- assets.ts
- antifraude.mjs
- purge.test.ts
- login/layout.tsx
- GraphChange
- crown-variants.py
- ConflictError

## God Nodes (most connected - your core abstractions)
1. `getStore()` - 107 edges
2. `withBase()` - 105 edges
3. `json()` - 88 edges
4. `requireRole()` - 78 edges
5. `SupabaseStore` - 75 edges
6. `LocalStore` - 71 edges
7. `Store` - 70 edges
8. `error()` - 67 edges
9. `next` - 57 edges
10. `react` - 48 edges

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

## Communities (88 total, 12 thin omitted)

### Community 0 - "getStore"
Cohesion: 0.11
Nodes (60): GET(), GET(), PATCH(), POST(), POST(), GET(), POST(), POST() (+52 more)

### Community 1 - "admin/ui.tsx"
Cohesion: 0.12
Nodes (39): usePage(), edge(), ParticipantDrawer(), Row(), Vote, Votes(), ParticipantRow(), ParticipantsTab() (+31 more)

### Community 2 - "world.ts"
Cohesion: 0.06
Nodes (42): zustand, Billboards, easeInOut(), BADGE, CeremonyStep, redraw(), CRYPT_ORIGIN, CryptArea (+34 more)

### Community 3 - "build.mjs"
Cohesion: 0.06
Nodes (47): RFC-5952, decode(), fake, html, out, rows, STATUS, bogons (+39 more)

### Community 4 - "outdoor.ts"
Cohesion: 0.05
Nodes (55): Décor 3D : trois lieux sur un même parcours, createDrops(), createPools(), groundHeight(), BigJack, BLOOD_EYES, BLOOD_POOLS, CAMERA_Z (+47 more)

### Community 5 - "SupabaseStore"
Cohesion: 0.07
Nodes (7): applyResponseFilter(), filtered(), kindOf(), PgFilter, slicePage(), SupabaseStore, violatedConstraint()

### Community 6 - "Empty"
Cohesion: 0.20
Nodes (32): DecorationDetails(), FavoriteDetails(), foldSeries(), Kpis(), nf(), seriesRows(), Stat(), Table() (+24 more)

### Community 7 - "Store"
Cohesion: 0.04
Nodes (10): afterRegistration(), Store, systemSession(), Page, AdminAction, AdminSession, Decoration, Prize (+2 more)

### Community 8 - "props.ts"
Cohesion: 0.10
Nodes (40): Préparation des modèles 3D, createBladeBloodMaterial(), dripGeometry(), merge(), armReaper(), BoneHand, Candy, CANDY_TINTS (+32 more)

### Community 9 - "parisDay"
Cohesion: 0.11
Nodes (54): POST(), GET(), daySchema, GET(), POST(), summary(), GET(), POST() (+46 more)

### Community 10 - "DecorationGallery.tsx"
Cohesion: 0.24
Nodes (15): DrawResults(), Dir, LightboxGroup, MediaLightbox(), Viewer(), optimizedPoster(), clock(), Slider() (+7 more)

### Community 11 - "fingerprint.ts"
Cohesion: 0.09
Nodes (43): papaparse, xlsx, GET, PERSONAL_COLUMNS, POST, RESPONSE_STATUSES, allResponsesRows(), date() (+35 more)

### Community 12 - "createWorld"
Cohesion: 0.17
Nodes (26): frame(), flicker(), updateCutGlow(), outdoorPose(), createWorld(), adapt(), applyPalette(), doorSwarm() (+18 more)

### Community 13 - "package.json"
Cohesion: 0.12
Nodes (15): author, contributors, name, private, version, @ffmpeg/core, recharts, @supabase/supabase-js (+7 more)

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
Nodes (17): AnalyticsFilter, count(), dayOf(), dayRange(), DecorationResult, loadFiltered(), summarize(), parisHour() (+9 more)

### Community 18 - "createCrypt"
Cohesion: 0.14
Nodes (19): createBloodScreen(), reset(), splash(), Inj, rand(), smooth(), createCrypt(), burstConfetti() (+11 more)

### Community 19 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 20 - "security/route.ts"
Cohesion: 0.12
Nodes (26): zod, querySchema, GET(), querySchema, countOf(), GET(), querySchema, GET() (+18 more)

### Community 21 - "6. Résultats"
Cohesion: 0.06
Nodes (34): 1. Synthèse exécutive, 2. Périmètre et exclusions, 3. Méthodologie et organisation, 4. Outils utilisés, 5. Limites de l'audit, 6. Résultats, 7. Plan d'actions priorisé, 8. Zones non couvertes (+26 more)

### Community 22 - "pack-models.mjs"
Cohesion: 0.12
Nodes (14): io, args, io, paints, roots, hex(), io, KEEP (+6 more)

### Community 23 - "video-plan.ts"
Cohesion: 0.16
Nodes (20): Encoded, encodeVideo(), canCompressHere(), COMPRESS_TIMEOUT_MS, COMPRESSED_TAG, DURATION_TOLERANCE, encodeArgs(), FPS_TOLERANCE (+12 more)

### Community 24 - "engine.ts"
Cohesion: 0.12
Nodes (29): bats(), birds(), BUS, candle(), CEREMONY_FILES, CeremonySample, clampPan(), crows() (+21 more)

### Community 25 - "dependencies"
Cohesion: 0.12
Nodes (16): dependencies, @ffmpeg/core, framer-motion, lucide-react, next, papaparse, radix-ui, react (+8 more)

### Community 26 - "RiskMethodology.tsx"
Cohesion: 0.17
Nodes (15): BASE, Callout(), earlier(), examples(), n(), OUTCOME_LABEL, RiskMethodology(), Section() (+7 more)

### Community 27 - "modal-props/render.mjs"
Cohesion: 0.18
Nodes (10): crops, here, meta, packsRoot, { PNG }, projectRoot, require, [rootArg, packsArg, outDir] (+2 more)

### Community 28 - "unlockSound"
Cohesion: 0.17
Nodes (20): Sécurité, applyAmbience(), bindVideoVolume(), build(), getShownVolume(), getSoundPrefs(), getVideoVolume(), holdSound() (+12 more)

### Community 29 - "raffle-props/render.mjs"
Cohesion: 0.18
Nodes (10): here, meta, packsRoot, { PNG }, projectRoot, puppeteer, require, [rootArg, packsArg, outDir] (+2 more)

### Community 30 - "og.mjs"
Cohesion: 0.13
Nodes (12): CARDS, chrome, here, out, puppeteer, require, root, server (+4 more)

### Community 31 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/turbopack, @types/node, @types/papaparse, @types/react (+3 more)

### Community 32 - "LocalStore"
Cohesion: 0.06
Nodes (4): humanPatch(), LocalStore, refusalRow(), seed()

### Community 33 - "risk.ts"
Cohesion: 0.08
Nodes (38): F-01 — Validation du vote sans session ouverte ni cookie : règle « un vote par jour » et score contournables par omission, browserFamily(), browserMismatch(), chBrands(), chFamily(), DECLARED_ALIASES, IP_DAILY_MAX_FLAG, IP_DAILY_MAX_LABEL (+30 more)

### Community 34 - "prize-props/render.mjs"
Cohesion: 0.13
Nodes (13): typescript, here, outDir, packsRoot, { PNG }, projectRoot, puppeteer, require (+5 more)

### Community 35 - "CornerRail.tsx"
Cohesion: 0.21
Nodes (17): PublicLayout(), subscribeDemoTab(), PreloadScene(), isSoundStarted(), isVideoPlaying(), serverSoundPrefs(), subscribeSound(), CornerRail() (+9 more)

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
Nodes (49): AdminActionInput, AdminSessionInput, AttemptKeys, ClickInput, clicksSince(), CompleteResult, CONSTRAINT_FIELD, Coordinates (+41 more)

### Community 44 - "FraudReview.tsx"
Cohesion: 0.11
Nodes (36): AttemptLine(), device(), DeviceTest, DeviceTestPanel(), run(), ENTROPY, FraudPersons(), toggle() (+28 more)

### Community 45 - "fraud-rules.ts"
Cohesion: 0.14
Nodes (20): crossBrowser(), decide(), Decision, FRAUD_RULE_ORDER, FraudReason, IpClassName, Recognition, RecognitionFacts (+12 more)

### Community 46 - "schema.ts"
Cohesion: 0.08
Nodes (31): Cobweb(), FIELDS, FormProps, LanternPost(), RaffleConfirmDialog(), RaffleErrors, RaffleField, RaffleForm() (+23 more)

### Community 47 - "withBase"
Cohesion: 0.09
Nodes (29): lucide-react, radix-ui, react, AdminLogin(), submit(), metadata, metadata, BatSwarm() (+21 more)

### Community 48 - "Questionnaire"
Cohesion: 0.16
Nodes (19): DemoPage(), metadata, apiFetch(), Questionnaire(), SaveIndicator(), createSession(), discard(), flush() (+11 more)

### Community 50 - "verificateur-scene.md"
Cohesion: 0.50
Nodes (3): Ce que tu reçois, Méthode, Verdict

### Community 51 - "fraud-server.ts"
Cohesion: 0.19
Nodes (14): FraudStamp, isWithdrawal(), withoutWithdrawals(), atMs(), decideVote(), GraphRun, primaryLang(), ReviewData (+6 more)

### Community 52 - "three"
Cohesion: 0.32
Nodes (10): three, bezier(), Flyer, rand(), startBatSwarm(), launch(), schedule(), startPoint() (+2 more)

### Community 53 - "http.ts"
Cohesion: 0.15
Nodes (11): server-only, decideSchema, GET(), GET(), GET(), getSummary(), parseFilter(), Bucket (+3 more)

### Community 54 - "auth.ts"
Cohesion: 0.12
Nodes (30): GET(), GET(), GET(), geo(), POST(), POST(), ADMIN_COOKIE, cookieOptions (+22 more)

### Community 55 - "replay.test.ts"
Cohesion: 0.24
Nodes (8): HwEntropy, entropyOf(), fixture, hwOf(), replay(), result, Row, Sim

### Community 56 - "AdminDashboard.tsx"
Cohesion: 0.11
Nodes (35): AdminPage(), metadata, AdminDashboard(), readTheme(), CardProps, ContestTab(), FieldErrors, patchContest() (+27 more)

### Community 57 - "LiveResults.tsx"
Cohesion: 0.15
Nodes (26): framer-motion, next, LiveResults(), MEDALS, pct(), Ranking(), LanternPost(), Mound() (+18 more)

### Community 59 - "SpookyBackdrop.tsx"
Cohesion: 0.23
Nodes (14): useSceneState, canRun3D(), CSSVars, SpookyBackdrop(), STARS, toggleTheme(), preloadCeremonySounds(), setSoundPlace() (+6 more)

### Community 60 - "site.ts"
Cohesion: 0.13
Nodes (16): inter, metadata, viewport, metadata, revalidate, robots(), sitemap(), BASE_PATH (+8 more)

### Community 61 - "upload.ts"
Cohesion: 0.16
Nodes (28): start(), NewPrizeCard(), submit(), patchPrize(), PrizeRow(), PrizesTab(), asFile(), canvasToBlob() (+20 more)

### Community 62 - "SocialCards.tsx"
Cohesion: 0.09
Nodes (35): isDemoTab(), Btn, copy(), noSubscribe(), ShareButtons(), shareUrl(), InstagramIcon(), LABELS (+27 more)

### Community 64 - "questionnaire/ui.tsx"
Cohesion: 0.18
Nodes (16): AlreadyVoted(), two(), BlockedHelpTab(), seenToday(), formatPhoneInput(), renderScreen(), normalize(), RestaurantCombobox() (+8 more)

### Community 66 - "ref_node_test"
Cohesion: 0.13
Nodes (12): nextConfig, Box, COLUMN_OF, inside(), PodiumEntry, PodiumSlot, REVEAL_ORDER, slotAt() (+4 more)

### Community 67 - "fraud-graph.ts"
Cohesion: 0.22
Nodes (15): anchorOf(), buildGroups(), canonicalEmail(), components(), conditionsOf(), cookies(), Group, GroupCondition (+7 more)

### Community 68 - "fraud-graph.test.ts"
Cohesion: 0.17
Nodes (14): GraphAttempt, graphChanges(), GraphOptions, withdrawalsAllowed(), FraudList, FraudPerson, fraudPersons(), isFraud() (+6 more)

### Community 69 - "eslint.config.mjs"
Cohesion: 0.50
Nodes (3): eslintConfig, eslint, eslint-config-next

### Community 71 - "soundEvent"
Cohesion: 0.35
Nodes (11): ceremonyMuted(), crowd(), duckFor(), laugh(), playSample(), podiumCheer(), sample(), soundEvent (+3 more)

### Community 72 - "core.ts"
Cohesion: 0.28
Nodes (13): BLOOD_COLOR, bloodTexture(), createBloodMaterial(), PoolSpec, canvasTexture(), dustTexture(), glowTexture(), seeded() (+5 more)

### Community 74 - "demo.ts"
Cohesion: 0.19
Nodes (14): DEMO_RESTART_EVENT, demoFetch(), enterDemoTab(), exitDemoTab(), invalid(), readBody(), readFlag(), reply() (+6 more)

### Community 75 - "BlockedVoteDialog.tsx"
Cohesion: 0.50
Nodes (5): BlockedVoteDialog(), useCountdown(), syncedNow(), formatWait(), speakWait()

### Community 76 - "participants/page.tsx"
Cohesion: 0.12
Nodes (25): Home(), metadata, revalidate, metadata, ParticipantsPage(), revalidate, ParticipantsList(), ContestOver() (+17 more)

### Community 77 - "responseMatcher"
Cohesion: 0.33
Nodes (6): parisMidnight(), parisOffset(), completedBounds(), ResponseFilter, responseMatcher(), keep()

### Community 79 - "store.ts"
Cohesion: 0.12
Nodes (21): isDemoMode(), setDemoMode(), ApiError, Props, SCREEN_OF_FIELD, STEP_TITLE, variants, VOTE_FIELDS (+13 more)

### Community 80 - "Confetti.tsx"
Cohesion: 0.50
Nodes (4): COLORS, Confetti(), makePieces(), Piece

### Community 81 - "assets.ts"
Cohesion: 0.50
Nodes (3): react-dom, ASSETS, SCENE_1_ASSETS

### Community 82 - "antifraude.mjs"
Cohesion: 0.27
Nodes (12): client(), DATA, DECO_A, DECO_B, DEVICE(), login(), main(), ok() (+4 more)

### Community 83 - "purge.test.ts"
Cohesion: 0.21
Nodes (10): LocalData, migrateLocal(), purgeLocal(), RETENTION_DAYS, click(), NOW, response(), session() (+2 more)

### Community 91 - "ConflictError"
Cohesion: 0.16
Nodes (5): ConflictError, conflictFields(), sameParticipant(), Participant, participantInput

## Knowledge Gaps
- **9 isolated node(s):** `@ffmpeg/core`, `@tailwindcss/turbopack`, `@types/node`, `@types/papaparse`, `@types/react` (+4 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 603 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `LocalStore` connect `LocalStore` to `getStore`, `Store`, `ResponsePatch`, `db.ts`, `purge.test.ts`, `GraphChange`, `ConflictError`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **What connects `@ffmpeg/core`, `@tailwindcss/turbopack`, `@types/node` to the rest of the system?**
  _9 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `getStore` be split into smaller, more focused modules?**
  _Cohesion score 0.11139240506329114 - nodes in this community are weakly interconnected._
- **Why does `getStore()` connect `getStore` to `LocalStore`, `CornerRail.tsx`, `SupabaseStore`, `parisDay`, `db.ts`, `fingerprint.ts`, `participants/page.tsx`, `Questionnaire`, `analytics.ts`, `security/route.ts`, `http.ts`, `auth.ts`, `LiveResults.tsx`, `site.ts`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Should `admin/ui.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.1202020202020202 - nodes in this community are weakly interconnected._
- **Why does `SupabaseStore` connect `SupabaseStore` to `getStore`, `db.ts`, `Store`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **Should `world.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.057329462989840346 - nodes in this community are weakly interconnected._