# Graph Report - questionnaire-halloween  (2026-10-16)

## Corpus Check
- 123 files · ~194,404 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 28 file(s) not represented in the graph (top: .avif 18, .glb 5, .css 2)

## Summary
- 1097 nodes · 2990 edges · 55 communities (45 shown, 10 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 34 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `6c916ad6`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- db.ts
- withBase
- schema.ts
- world.ts
- outdoor.ts
- SupabaseStore
- LocalStore
- Store
- props.ts
- Questionnaire.tsx
- site.ts
- questionnaire/ui.tsx
- createWorld
- package.json
- Fonctionnement
- Participant
- brand/render.mjs
- framer-motion
- Questionnaire
- compilerOptions
- DecorationsTab.tsx
- glow.ts
- pack-models.mjs
- SocialCards.tsx
- engine.ts
- dependencies
- demo.ts
- modal-props/render.mjs
- export.ts
- raffle-props/render.mjs
- og.mjs
- devDependencies
- core.ts
- PrizesTab.tsx
- prize-props/render.mjs
- crypt.ts
- scripts
- posters.mjs
- laugh.mjs
- withBase
- LiveResults.tsx
- AGENTS.md
- OverviewTab.tsx
- CLAUDE.md
- analytics.ts
- wordmark.mjs
- clock.ts
- three
- resultats/page.tsx
- Billboards
- ref_node_fs
- ResponsePatch
- login/layout.tsx
- RestaurantCombobox.tsx

## God Nodes (most connected - your core abstractions)
1. `withBase()` - 62 edges
2. `getStore()` - 52 edges
3. `json()` - 47 edges
4. `next` - 43 edges
5. `SupabaseStore` - 43 edges
6. `LocalStore` - 39 edges
7. `error()` - 38 edges
8. `Questionnaire()` - 36 edges
9. `createWorld()` - 36 edges
10. `requireRole()` - 36 edges

## Surprising Connections (you probably didn't know these)
- `2. Vercel` --references--> `withBase()`  [INFERRED]
  README.md → src/lib/base-path.ts
- `Préparation des modèles 3D` --references--> `createGift()`  [INFERRED]
  scripts/3d/README.md → src/components/scene/props.ts
- `move()` --calls--> `withBase()`  [EXTRACTED]
  src/components/admin/DecorationsTab.tsx → src/lib/base-path.ts
- `remove()` --calls--> `withBase()`  [EXTRACTED]
  src/components/admin/DecorationsTab.tsx → src/lib/base-path.ts
- `Questionnaire()` --indirect_call--> `subscribeDemoTab()`  [INFERRED]
  src/components/questionnaire/Questionnaire.tsx → src/components/questionnaire/demo.ts

## Import Cycles
- None detected.

## Communities (55 total, 10 thin omitted)

### Community 0 - "db.ts"
Cohesion: 0.06
Nodes (104): next, server-only, zod, AdminPage(), metadata, POST(), GET(), GET() (+96 more)

### Community 1 - "withBase"
Cohesion: 0.23
Nodes (21): react, AdminDashboard(), readTheme(), ParticipantRow(), ParticipantsTab(), request(), Sort, SortBtn() (+13 more)

### Community 2 - "schema.ts"
Cohesion: 0.08
Nodes (29): lucide-react, metadata, ParticipantsPage(), PrizeThumb(), revalidate, ParticipantsList(), FIELDS, FormProps (+21 more)

### Community 3 - "world.ts"
Cohesion: 0.12
Nodes (17): easeInOut(), CutGlow, GraveyardArea, Area, Flame, Frame, Kit, Pose (+9 more)

### Community 4 - "outdoor.ts"
Cohesion: 0.08
Nodes (33): groundHeight(), BigJack, CAMERA_Z, CAULDRON_AT, CLEARING, CLEARING_EYES, createFarForest(), createGraveyard() (+25 more)

### Community 7 - "Store"
Cohesion: 0.07
Nodes (4): Store, Decoration, Prize, Restaurant

### Community 8 - "props.ts"
Cohesion: 0.14
Nodes (30): Préparation des modèles 3D, createReaperClearing(), armReaper(), BoneHand, CANDY_TINTS, Cauldron, Cell, CellRef (+22 more)

### Community 9 - "Questionnaire.tsx"
Cohesion: 0.11
Nodes (25): isDemoMode(), setDemoMode(), ApiError, IMPACT_OPTIONS, PERIOD_OPTIONS, Props, SCREEN_OF_FIELD, STEP_TITLE (+17 more)

### Community 10 - "site.ts"
Cohesion: 0.11
Nodes (18): nextConfig, inter, metadata, viewport, Home(), metadata, revalidate, robots() (+10 more)

### Community 11 - "questionnaire/ui.tsx"
Cohesion: 0.42
Nodes (8): formatPhoneInput(), renderScreen(), ChoicePill(), Emoji(), EmojiName, KeyBadge(), pillClass(), QuestionHeader()

### Community 12 - "createWorld"
Cohesion: 0.20
Nodes (24): frame(), flicker(), rand(), updateCutGlow(), outdoorPose(), createWorld(), applyPalette(), doorSwarm() (+16 more)

### Community 13 - "package.json"
Cohesion: 0.12
Nodes (15): eslintConfig, name, private, version, eslint, eslint-config-next, recharts, @supabase/supabase-js (+7 more)

### Community 14 - "Fonctionnement"
Cohesion: 0.10
Nodes (20): 1. Supabase (~5 min), 2. Vercel, API, Base déjà en service : migration « tirage au sort et vote quotidien », Décor 3D : trois lieux sur un même parcours, Démarrage local (sans Supabase), Enregistrement en direct, Espace démo (+12 more)

### Community 15 - "Participant"
Cohesion: 0.16
Nodes (5): ConflictError, sameParticipant(), violatedConstraint(), Participant, participantInput

### Community 16 - "brand/render.mjs"
Cohesion: 0.11
Nodes (17): appDir, disc, header, here, out, puppeteer, raw, require (+9 more)

### Community 17 - "framer-motion"
Cohesion: 0.40
Nodes (5): framer-motion, COLORS, Confetti(), makePieces(), Piece

### Community 18 - "Questionnaire"
Cohesion: 0.15
Nodes (19): apiFetch(), Questionnaire(), SaveIndicator(), createSession(), discard(), flush(), initSaver(), Listener (+11 more)

### Community 19 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 20 - "DecorationsTab.tsx"
Cohesion: 0.18
Nodes (21): DecorationsTab(), GroupRow(), move(), remove(), QueueItem, UploadCard(), start(), prepareMedia() (+13 more)

### Community 21 - "glow.ts"
Cohesion: 0.30
Nodes (11): applyCutGlow(), colGlsl(), CUT_SHINE_ORDER, cutGlowWarmup(), cutGlsl(), CutSpec, f(), glowMaterial() (+3 more)

### Community 22 - "pack-models.mjs"
Cohesion: 0.13
Nodes (12): io, args, io, paints, roots, hex(), io, KEEP (+4 more)

### Community 23 - "SocialCards.tsx"
Cohesion: 0.17
Nodes (19): Btn, copy(), noSubscribe(), ShareButtons(), shareUrl(), InstagramIcon(), LABELS, Network (+11 more)

### Community 24 - "engine.ts"
Cohesion: 0.06
Nodes (74): react-dom, PublicLayout(), ASSETS, SCENE_1_ASSETS, PreloadScene(), canRun3D(), CSSVars, SpookyBackdrop() (+66 more)

### Community 25 - "dependencies"
Cohesion: 0.13
Nodes (15): dependencies, framer-motion, lucide-react, next, papaparse, radix-ui, react, react-dom (+7 more)

### Community 26 - "demo.ts"
Cohesion: 0.24
Nodes (13): DEMO_RESTART_EVENT, demoFetch(), enterDemoTab(), exitDemoTab(), invalid(), isDemoTab(), readBody(), readFlag() (+5 more)

### Community 27 - "modal-props/render.mjs"
Cohesion: 0.18
Nodes (10): crops, here, meta, packsRoot, { PNG }, projectRoot, require, [rootArg, packsArg, outDir] (+2 more)

### Community 28 - "export.ts"
Cohesion: 0.24
Nodes (14): papaparse, xlsx, GET, handle(), POST, allResponsesRows(), date(), participantsRows() (+6 more)

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
Cohesion: 0.44
Nodes (9): canvasTexture(), dustTexture(), glowTexture(), seeded(), shadowTexture(), smokeTexture(), stoneTexture(), tileTexture() (+1 more)

### Community 33 - "PrizesTab.tsx"
Cohesion: 0.18
Nodes (24): NewPrizeCard(), submit(), patchPrize(), PrizeRow(), PrizesTab(), asFile(), canvasToBlob(), createPrize() (+16 more)

### Community 34 - "prize-props/render.mjs"
Cohesion: 0.13
Nodes (13): typescript, here, outDir, packsRoot, { PNG }, projectRoot, puppeteer, require (+5 more)

### Community 35 - "crypt.ts"
Cohesion: 0.13
Nodes (19): smooth(), BADGE, createCrypt(), placeArm(), redraw(), CRYPT_ORIGIN, CryptArea, drawResults() (+11 more)

### Community 36 - "scripts"
Cohesion: 0.29
Nodes (7): scripts, build, dev, lint, seed:images, start, typecheck

### Community 37 - "posters.mjs"
Cohesion: 0.15
Nodes (14): args, block(), cssOnly, FORMATS, out, puppeteer, require, root (+6 more)

### Community 38 - "laugh.mjs"
Cohesion: 0.13
Nodes (12): buf, [dir, root = "."], out, puppeteer, require, server, puppeteer, require (+4 more)

### Community 39 - "withBase"
Cohesion: 0.16
Nodes (21): radix-ui, AdminLogin(), submit(), BatSwarm(), Jumper(), PrizeDecor(), GalleryPrize, PrizeImage() (+13 more)

### Community 40 - "LiveResults.tsx"
Cohesion: 0.24
Nodes (12): zustand, LanternPost(), LiveResults(), MEDALS, pct(), Ranking(), ResultsData, SceneState (+4 more)

### Community 42 - "OverviewTab.tsx"
Cohesion: 0.30
Nodes (13): axis, ChartTooltip(), FavoriteBarChart(), ImpactBars(), tick, TimelineChart(), Filters, FilterSelect() (+5 more)

### Community 44 - "analytics.ts"
Cohesion: 0.29
Nodes (10): GET(), GET(), AnalyticsFilter, DecorationResult, fillDays(), getSummary(), parseFilter(), summarize() (+2 more)

### Community 45 - "wordmark.mjs"
Cohesion: 0.18
Nodes (9): here, out, puppeteer, raw, require, root, server, sharp (+1 more)

### Community 46 - "clock.ts"
Cohesion: 0.33
Nodes (7): AlreadyVoted(), two(), clientNow(), parse(), TEST_CLOCK, TEST_CLOCK_COOKIE, TEST_CLOCK_STORAGE_KEY

### Community 47 - "three"
Cohesion: 0.32
Nodes (10): three, bezier(), Flyer, rand(), startBatSwarm(), launch(), schedule(), startPoint() (+2 more)

### Community 48 - "resultats/page.tsx"
Cohesion: 0.31
Nodes (7): metadata, ResultsPage(), revalidate, loadFiltered(), getPublicResults(), PublicResults, RESULTS

## Knowledge Gaps
- **7 isolated node(s):** `@tailwindcss/turbopack`, `@types/node`, `@types/papaparse`, `@types/react`, `@types/react-dom` (+2 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 379 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `withBase()` connect `withBase` to `withBase`, `schema.ts`, `PrizesTab.tsx`, `LiveResults.tsx`, `Questionnaire.tsx`, `OverviewTab.tsx`, `questionnaire/ui.tsx`, `Fonctionnement`, `resultats/page.tsx`, `Questionnaire`, `DecorationsTab.tsx`, `engine.ts`, `demo.ts`?**
  _High betweenness centrality (0.097) - this node is a cross-community bridge._
- **What connects `@tailwindcss/turbopack`, `@types/node`, `@types/papaparse` to the rest of the system?**
  _7 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `db.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.058817025981205084 - nodes in this community are weakly interconnected._
- **Why does `next` connect `db.ts` to `withBase`, `schema.ts`, `PrizesTab.tsx`, `withBase`, `LiveResults.tsx`, `site.ts`, `OverviewTab.tsx`, `questionnaire/ui.tsx`, `package.json`, `resultats/page.tsx`, `DecorationsTab.tsx`, `login/layout.tsx`, `SocialCards.tsx`, `engine.ts`, `demo.ts`?**
  _High betweenness centrality (0.094) - this node is a cross-community bridge._
- **Should `schema.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08403361344537816 - nodes in this community are weakly interconnected._
- **Why does `SupabaseStore` connect `SupabaseStore` to `db.ts`, `Participant`, `Store`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **Should `world.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11688311688311688 - nodes in this community are weakly interconnected._