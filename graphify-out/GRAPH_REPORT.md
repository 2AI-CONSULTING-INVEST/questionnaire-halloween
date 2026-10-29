# Graph Report - questionnaire-halloween  (2026-10-29)

## Corpus Check
- 218 files · ~425,265 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 28 file(s) not represented in the graph (top: .avif 18, .glb 5, .css 2)

## Summary
- 1938 nodes · 5858 edges · 86 communities (77 shown, 9 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 118 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ed32cf76`
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
- login/route.ts
- brand/render.mjs
- store.ts
- crypt.ts
- compilerOptions
- VisitsCard.tsx
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
- Questionnaire.tsx
- verificateur-scene.md
- fraud-server.ts
- three
- Questionnaire.tsx
- guard.ts
- base-path.ts
- by-restaurant/route.ts
- clicks.ts
- ref_node_path
- clock.ts
- site.ts
- Card
- ShareButtons.tsx
- LiveResults.tsx
- vercel.json
- responses/route.ts
- fraud-graph.ts
- replay.test.ts
- eslint.config.mjs
- ffmpeg.worker.ts
- device-memory.ts
- responseMatcher
- LocalStore
- demo.ts
- redact.ts
- .mutate
- fraud-review.ts
- not-found.tsx
- systemSession
- isCounted
- export.ts
- Decoration
- resultats/page.tsx
- clientNow
- personClusters

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

## Communities (86 total, 9 thin omitted)

### Community 0 - "getStore"
Cohesion: 0.13
Nodes (54): next, GET(), POST(), GET(), POST(), GET(), POST(), GET() (+46 more)

### Community 1 - "admin/ui.tsx"
Cohesion: 0.15
Nodes (29): usePage(), edge(), ParticipantDrawer(), Row(), Vote, Votes(), ParticipantRow(), ParticipantsTab() (+21 more)

### Community 2 - "world.ts"
Cohesion: 0.08
Nodes (23): Billboards, easeInOut(), CutGlow, GraveyardArea, Area, EyeStyle, Flame, Frame (+15 more)

### Community 3 - "build.mjs"
Cohesion: 0.06
Nodes (47): RFC-5952, decode(), fake, html, out, rows, STATUS, bogons (+39 more)

### Community 4 - "outdoor.ts"
Cohesion: 0.05
Nodes (52): Décor 3D : trois lieux sur un même parcours, createDrops(), createPools(), groundHeight(), BigJack, BLOOD_EYES, BLOOD_POOLS, CAMERA_Z (+44 more)

### Community 5 - "SupabaseStore"
Cohesion: 0.06
Nodes (12): applyResponseFilter(), ConflictError, conflictFields(), filtered(), kindOf(), PgFilter, sameParticipant(), slicePage() (+4 more)

### Community 6 - "Empty"
Cohesion: 0.23
Nodes (28): DecorationDetails(), FavoriteDetails(), foldSeries(), Kpis(), nf(), seriesRows(), Stat(), Table() (+20 more)

### Community 7 - "Store"
Cohesion: 0.05
Nodes (8): afterRegistration(), Store, Page, LoginFailure, Prize, ResponseRow, Restaurant, Visit

### Community 8 - "props.ts"
Cohesion: 0.11
Nodes (36): Préparation des modèles 3D, createBladeBloodMaterial(), dripGeometry(), merge(), armReaper(), BoneHand, Candy, CANDY_TINTS (+28 more)

### Community 9 - "fraud-server.ts"
Cohesion: 0.10
Nodes (56): server-only, decideSchema, POST(), countOf(), GET(), GET(), POST(), POST() (+48 more)

### Community 10 - "antifraude.mjs"
Cohesion: 0.27
Nodes (12): client(), DATA, DECO_A, DECO_B, DEVICE(), login(), main(), ok() (+4 more)

### Community 11 - "fingerprint.ts"
Cohesion: 0.09
Nodes (45): AnalyticsFilter, count(), dayOf(), dayRange(), DecorationResult, loadFiltered(), summarize(), parisHour() (+37 more)

### Community 12 - "createWorld"
Cohesion: 0.17
Nodes (26): frame(), flicker(), updateCutGlow(), outdoorPose(), createWorld(), adapt(), applyPalette(), doorSwarm() (+18 more)

### Community 13 - "package.json"
Cohesion: 0.12
Nodes (15): author, contributors, name, private, version, @ffmpeg/core, recharts, @supabase/supabase-js (+7 more)

### Community 14 - "Fonctionnement"
Cohesion: 0.08
Nodes (22): 1. Supabase (~5 min), 2. Vercel, Aperçus des liens, API, Compteur de visites (robots écartés), Crédits, Données et conservation, Démarrage local (sans Supabase) (+14 more)

### Community 15 - "login/route.ts"
Cohesion: 0.18
Nodes (13): geo(), POST(), createToken(), isSecondPassword(), readonlyPassword(), roleForPassword(), IpGeo, readGeo() (+5 more)

### Community 16 - "brand/render.mjs"
Cohesion: 0.11
Nodes (17): appDir, disc, header, here, out, puppeteer, raw, require (+9 more)

### Community 17 - "store.ts"
Cohesion: 0.15
Nodes (15): isDemoMode(), setDemoMode(), Answers, blankSession, emptyAnswers, modeAwareStorage, restartDemo(), Screen (+7 more)

### Community 18 - "crypt.ts"
Cohesion: 0.13
Nodes (19): smooth(), BADGE, createCrypt(), placeArm(), redraw(), CRYPT_ORIGIN, CryptArea, drawResults() (+11 more)

### Community 19 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 20 - "VisitsCard.tsx"
Cohesion: 0.27
Nodes (14): ClicksCard(), nf(), Who(), device(), place(), SessionsTab(), Badge(), deviceLabel() (+6 more)

### Community 21 - "6. Résultats"
Cohesion: 0.06
Nodes (31): 1. Synthèse exécutive, 2. Périmètre et exclusions, 3. Méthodologie et organisation, 4. Outils utilisés, 5. Limites de l'audit, 6. Résultats, 7. Plan d'actions priorisé, 8. Zones non couvertes (+23 more)

### Community 22 - "pack-models.mjs"
Cohesion: 0.12
Nodes (14): io, args, io, paints, roots, hex(), io, KEEP (+6 more)

### Community 23 - "upload.ts"
Cohesion: 0.09
Nodes (44): start(), asFile(), canvasToBlob(), createPrize(), decodeImage(), drawScaled(), fmtMb(), looksHevc() (+36 more)

### Community 24 - "engine.ts"
Cohesion: 0.05
Nodes (87): react-dom, PublicLayout(), Dir, LightboxGroup, MediaLightbox(), SlideVideo(), Viewer(), DecorationCard() (+79 more)

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
Cohesion: 0.08
Nodes (37): F-01 — Validation du vote sans session ouverte ni cookie : règle « un vote par jour » et score contournables par omission, browserFamily(), browserMismatch(), chBrands(), chFamily(), DECLARED_ALIASES, IP_DAILY_MAX_FLAG, IP_DAILY_MAX_LABEL (+29 more)

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
Nodes (41): bodySchema, parisMidnight(), parisOffset(), AdminActionInput, AdminSessionInput, AttemptKeys, ClickInput, completedBounds() (+33 more)

### Community 44 - "FraudReview.tsx"
Cohesion: 0.10
Nodes (44): logout(), move(), remove(), AttemptLine(), device(), DeviceTest, DeviceTestPanel(), run() (+36 more)

### Community 45 - "fraud-rules.ts"
Cohesion: 0.14
Nodes (20): crossBrowser(), decide(), Decision, FRAUD_RULE_ORDER, FraudReason, IpClassName, Recognition, RecognitionFacts (+12 more)

### Community 46 - "schema.ts"
Cohesion: 0.07
Nodes (35): ParticipantsList(), Cobweb(), FIELDS, FormProps, LanternPost(), RaffleConfirmDialog(), RaffleErrors, RaffleField (+27 more)

### Community 47 - "AdminDashboard.tsx"
Cohesion: 0.12
Nodes (19): lucide-react, radix-ui, metadata, readTheme(), ChartDialog(), FraudNotifications(), Item, Notifications (+11 more)

### Community 48 - "Questionnaire.tsx"
Cohesion: 0.13
Nodes (22): framer-motion, COLORS, Confetti(), makePieces(), Piece, ApiError, formatPhoneInput(), Props (+14 more)

### Community 50 - "verificateur-scene.md"
Cohesion: 0.50
Nodes (3): Ce que tu reçois, Méthode, Verdict

### Community 51 - "fraud-server.ts"
Cohesion: 0.20
Nodes (14): FraudStamp, Group, atMs(), decideVote(), GraphRun, primaryLang(), ReviewData, toGraphAttempt() (+6 more)

### Community 52 - "three"
Cohesion: 0.32
Nodes (10): three, bezier(), Flyer, rand(), startBatSwarm(), launch(), schedule(), startPoint() (+2 more)

### Community 53 - "Questionnaire.tsx"
Cohesion: 0.18
Nodes (18): apiFetch(), enterDemoTab(), Questionnaire(), SaveIndicator(), createSession(), discard(), flush(), initSaver() (+10 more)

### Community 54 - "guard.ts"
Cohesion: 0.10
Nodes (34): F-03 — Sessions du backoffice non révocables côté serveur, AdminPage(), metadata, GET(), GET(), GET(), daySchema, GET() (+26 more)

### Community 55 - "base-path.ts"
Cohesion: 0.10
Nodes (20): react, metadata, AdminLogin(), submit(), metadata, metadata, ParticipantsPage(), PrizeThumb() (+12 more)

### Community 56 - "by-restaurant/route.ts"
Cohesion: 0.67
Nodes (4): GET(), GET(), getSummary(), parseFilter()

### Community 57 - "clicks.ts"
Cohesion: 0.15
Nodes (12): Click, clickSchema, ClicksSummary, FOLLOW_TARGETS, FollowTarget, Person, REF_RE, SHARE_TARGETS (+4 more)

### Community 59 - "clock.ts"
Cohesion: 0.26
Nodes (10): AlreadyVoted(), two(), BlockedHelpTab(), seenToday(), TIPS, BlockedVoteDialog(), useCountdown(), syncedNow() (+2 more)

### Community 60 - "site.ts"
Cohesion: 0.13
Nodes (16): inter, metadata, viewport, Home(), metadata, revalidate, robots(), sitemap() (+8 more)

### Community 61 - "Card"
Cohesion: 0.26
Nodes (18): AdminDashboard(), DecorationsTab(), GroupRow(), QueueItem, STEP_LABEL, UploadCard(), NewPrizeCard(), submit() (+10 more)

### Community 62 - "ShareButtons.tsx"
Cohesion: 0.18
Nodes (19): Btn, copy(), noSubscribe(), ShareButtons(), shareUrl(), InstagramIcon(), LABELS, Network (+11 more)

### Community 64 - "LiveResults.tsx"
Cohesion: 0.24
Nodes (12): zustand, LanternPost(), LiveResults(), MEDALS, pct(), Ranking(), ResultsData, SceneState (+4 more)

### Community 66 - "responses/route.ts"
Cohesion: 0.33
Nodes (7): zod, querySchema, querySchema, querySchema, decodeCursor(), PAGE_MAX, PAGE_SIZE

### Community 67 - "fraud-graph.ts"
Cohesion: 0.19
Nodes (17): anchorOf(), buildGroups(), canonicalEmail(), conditionsOf(), cookies(), graphChanges(), GroupCondition, isWithdrawal() (+9 more)

### Community 68 - "replay.test.ts"
Cohesion: 0.22
Nodes (9): GraphAttempt, HwEntropy, entropyOf(), fixture, hwOf(), replay(), result, Row (+1 more)

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
Cohesion: 0.33
Nodes (10): DEMO_RESTART_EVENT, demoFetch(), exitDemoTab(), invalid(), isDemoTab(), readBody(), readFlag(), reply() (+2 more)

### Community 75 - "redact.ts"
Cohesion: 0.07
Nodes (32): F-07 — Absence de Content-Security-Policy ; HSTS non posé par l'application, nextConfig, Sécurité, buildCsp(), securityHeaders(), LocalData, migrateLocal(), pageLocal() (+24 more)

### Community 76 - ".mutate"
Cohesion: 0.07
Nodes (4): humanPatch(), purgeLocal(), refusalRow(), GraphChange

### Community 77 - "fraud-review.ts"
Cohesion: 0.22
Nodes (9): GraphOptions, FraudList, FraudPerson, fraudPersons(), isFraud(), pendingAttempts(), PendingList, PersonDetail (+1 more)

### Community 79 - "systemSession"
Cohesion: 0.25
Nodes (3): systemSession(), AdminAction, AdminSession

### Community 80 - "isCounted"
Cohesion: 0.17
Nodes (6): Anti-fraude : un vote par personne et par jour, countedVotesByParticipant(), groupsByParticipant(), voteColumns(), isCounted(), ResponsePatch

### Community 81 - "export.ts"
Cohesion: 0.39
Nodes (7): papaparse, xlsx, allResponsesRows(), date(), participantsRows(), Row, safe()

### Community 83 - "resultats/page.tsx"
Cohesion: 0.33
Nodes (5): metadata, ResultsPage(), revalidate, OG_BASE, RESULTS

### Community 84 - "clientNow"
Cohesion: 0.70
Nodes (4): clientNow(), KEY(), readNextVote(), setNextVote()

### Community 85 - "personClusters"
Cohesion: 0.90
Nodes (3): components(), personClusters(), UnionFind

## Knowledge Gaps
- **9 isolated node(s):** `@ffmpeg/core`, `@tailwindcss/turbopack`, `@types/node`, `@types/papaparse`, `@types/react` (+4 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 576 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `LocalStore` connect `LocalStore` to `getStore`, `risk.ts`, `SupabaseStore`, `Store`, `responseMatcher`, `db.ts`, `.mutate`, `isCounted`, `Decoration`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **What connects `@ffmpeg/core`, `@tailwindcss/turbopack`, `@types/node` to the rest of the system?**
  _9 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `getStore` be split into smaller, more focused modules?**
  _Cohesion score 0.12796780684104628 - nodes in this community are weakly interconnected._
- **Why does `next` connect `getStore` to `LiveResults.tsx`, `fraud-server.ts`, `demo.ts`, `redact.ts`, `package.json`, `not-found.tsx`, `login/route.ts`, `AdminDashboard.tsx`, `schema.ts`, `Questionnaire.tsx`, `resultats/page.tsx`, `fraud-server.ts`, `guard.ts`, `base-path.ts`, `engine.ts`, `site.ts`, `Card`, `ShareButtons.tsx`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **Should `admin/ui.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.14616755793226383 - nodes in this community are weakly interconnected._
- **Why does `SupabaseStore` connect `SupabaseStore` to `getStore`, `db.ts`, `Store`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Should `world.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07862903225806452 - nodes in this community are weakly interconnected._