# Graph Report - questionnaire-halloween  (2026-10-23)

## Corpus Check
- 157 files · ~350,178 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 28 file(s) not represented in the graph (top: .avif 18, .glb 5, .css 2)

## Summary
- 1403 nodes · 4080 edges · 65 communities (53 shown, 12 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 45 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1a7ff02f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- getStore
- withBase
- crypt.ts
- world.ts
- outdoor.ts
- SupabaseStore
- Decoration
- Store
- props.ts
- complete/route.ts
- next
- glow.ts
- createWorld
- package.json
- Fonctionnement
- risk.ts
- brand/render.mjs
- participants/page.tsx
- Questionnaire.tsx
- compilerOptions
- react
- SocialCards.tsx
- pack-models.mjs
- auth.ts
- engine.ts
- dependencies
- rand
- modal-props/render.mjs
- export.ts
- raffle-props/render.mjs
- og.mjs
- devDependencies
- core.ts
- CornerRail.tsx
- prize-props/render.mjs
- analytics.ts
- scripts
- posters.mjs
- laugh.mjs
- antifraude.mjs
- schema.ts
- AGENTS.md
- db.ts
- CLAUDE.md
- questionnaire/ui.tsx
- wordmark.mjs
- LocalStore
- SpookyBackdrop.tsx
- zodError
- verificateur-scene.md
- ref_node_fs
- three
- ResponsePatch
- AdminSession
- demo.ts
- http.ts
- Visit
- NextVoteTimer
- assets.ts
- eslint.config.mjs
- Prize
- Participant
- Restaurant

## God Nodes (most connected - your core abstractions)
1. `withBase()` - 75 edges
2. `getStore()` - 75 edges
3. `json()` - 62 edges
4. `SupabaseStore` - 58 edges
5. `LocalStore` - 55 edges
6. `requireRole()` - 52 edges
7. `Store` - 50 edges
8. `error()` - 49 edges
9. `next` - 44 edges
10. `react` - 38 edges

## Surprising Connections (you probably didn't know these)
- `2. Vercel` --references--> `withBase()`  [INFERRED]
  README.md → src/lib/base-path.ts
- `Backoffice` --references--> `ChartDialog()`  [INFERRED]
  README.md → src/components/admin/ChartDialog.tsx
- `Décor 3D : trois lieux sur un même parcours` --references--> `createClearingGround()`  [INFERRED]
  README.md → src/components/scene/outdoor.ts
- `Préparation des modèles 3D` --references--> `createGift()`  [INFERRED]
  scripts/3d/README.md → src/components/scene/props.ts
- `Backoffice` --references--> `block()`  [INFERRED]
  README.md → scripts/3d/posters.mjs

## Import Cycles
- None detected.

## Communities (65 total, 12 thin omitted)

### Community 0 - "getStore"
Cohesion: 0.17
Nodes (38): GET(), PATCH(), DELETE(), PATCH(), patchSchema, POST(), POST(), POST() (+30 more)

### Community 1 - "withBase"
Cohesion: 0.05
Nodes (125): AdminDashboard(), logout(), readTheme(), DecorationDetails(), FavoriteDetails(), foldSeries(), Kpis(), nf() (+117 more)

### Community 2 - "crypt.ts"
Cohesion: 0.13
Nodes (12): Billboards, smooth(), createCrypt(), placeArm(), plaqueSize(), cloneModel(), createBigJack(), cutSpecFor() (+4 more)

### Community 3 - "world.ts"
Cohesion: 0.08
Nodes (32): createBloodMaterial(), easeInOut(), BADGE, redraw(), CRYPT_ORIGIN, CryptArea, drawResults(), MEDALS (+24 more)

### Community 4 - "outdoor.ts"
Cohesion: 0.05
Nodes (51): Décor 3D : trois lieux sur un même parcours, BLOOD_COLOR, bloodTexture(), createDrops(), createPools(), PoolSpec, groundHeight(), BigJack (+43 more)

### Community 5 - "SupabaseStore"
Cohesion: 0.08
Nodes (10): applyResponseFilter(), conflictFields(), filtered(), kindOf(), PgFilter, sameParticipant(), slicePage(), SupabaseStore (+2 more)

### Community 8 - "props.ts"
Cohesion: 0.11
Nodes (38): Préparation des modèles 3D, createBladeBloodMaterial(), dripGeometry(), merge(), armReaper(), BoneHand, Candy, CANDY_TINTS (+30 more)

### Community 9 - "complete/route.ts"
Cohesion: 0.14
Nodes (34): GET(), GET(), POST(), POST(), handle(), PATCH, POST, POST() (+26 more)

### Community 10 - "next"
Cohesion: 0.10
Nodes (28): nextConfig, next, inter, metadata, viewport, LanternPost(), LiveResults(), MEDALS (+20 more)

### Community 11 - "glow.ts"
Cohesion: 0.30
Nodes (11): applyCutGlow(), colGlsl(), CUT_SHINE_ORDER, cutGlowWarmup(), cutGlsl(), CutSpec, f(), glowMaterial() (+3 more)

### Community 12 - "createWorld"
Cohesion: 0.20
Nodes (23): frame(), flicker(), updateCutGlow(), outdoorPose(), createWorld(), applyPalette(), doorSwarm(), ensureClearing() (+15 more)

### Community 13 - "package.json"
Cohesion: 0.15
Nodes (12): name, private, version, recharts, @supabase/supabase-js, tailwindcss, @tailwindcss/turbopack, @types/node (+4 more)

### Community 14 - "Fonctionnement"
Cohesion: 0.10
Nodes (21): 1. Supabase (~5 min), 2. Vercel, API, Compteur de visites (robots écartés), Démarrage local (sans Supabase), Enregistrement en direct, Espace démo, Fonctionnement (+13 more)

### Community 15 - "risk.ts"
Cohesion: 0.08
Nodes (39): Callout(), Step(), audioRate(), browserName(), canvas(), compute(), deviceSignals(), localVoteDay() (+31 more)

### Community 16 - "brand/render.mjs"
Cohesion: 0.11
Nodes (17): appDir, disc, header, here, out, puppeteer, raw, require (+9 more)

### Community 17 - "participants/page.tsx"
Cohesion: 0.25
Nodes (12): metadata, ParticipantsPage(), PrizeThumb(), revalidate, BatSwarm(), Jumper(), PrizeDecor(), GalleryPrize (+4 more)

### Community 18 - "Questionnaire.tsx"
Cohesion: 0.08
Nodes (39): Home(), metadata, revalidate, apiFetch(), isDemoMode(), setDemoMode(), ApiError, Props (+31 more)

### Community 19 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 20 - "react"
Cohesion: 0.15
Nodes (20): lucide-react, radix-ui, react, metadata, QueueItem, Dir, LightboxGroup, MediaLightbox() (+12 more)

### Community 21 - "SocialCards.tsx"
Cohesion: 0.17
Nodes (19): Btn, copy(), noSubscribe(), ShareButtons(), shareUrl(), InstagramIcon(), LABELS, Network (+11 more)

### Community 22 - "pack-models.mjs"
Cohesion: 0.13
Nodes (12): io, args, io, paints, roots, hex(), io, KEEP (+4 more)

### Community 23 - "auth.ts"
Cohesion: 0.16
Nodes (19): AdminPage(), metadata, geo(), POST(), POST(), DemoPage(), metadata, ADMIN_COOKIE (+11 more)

### Community 24 - "engine.ts"
Cohesion: 0.15
Nodes (27): bats(), birds(), BUS, candle(), clampPan(), crows(), DEFAULT_PREFS, duckFor() (+19 more)

### Community 25 - "dependencies"
Cohesion: 0.13
Nodes (15): dependencies, framer-motion, lucide-react, next, papaparse, radix-ui, react, react-dom (+7 more)

### Community 26 - "rand"
Cohesion: 0.48
Nodes (5): createBloodScreen(), reset(), splash(), Inj, rand()

### Community 27 - "modal-props/render.mjs"
Cohesion: 0.18
Nodes (10): crops, here, meta, packsRoot, { PNG }, projectRoot, require, [rootArg, packsArg, outDir] (+2 more)

### Community 28 - "export.ts"
Cohesion: 0.25
Nodes (13): papaparse, xlsx, GET, handle(), POST, STATUS_FILTER, allResponsesRows(), date() (+5 more)

### Community 29 - "raffle-props/render.mjs"
Cohesion: 0.18
Nodes (10): here, meta, packsRoot, { PNG }, projectRoot, puppeteer, require, [rootArg, packsArg, outDir] (+2 more)

### Community 30 - "og.mjs"
Cohesion: 0.18
Nodes (10): CARDS, chrome, here, out, puppeteer, require, root, server (+2 more)

### Community 31 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/turbopack, @types/node, @types/papaparse, @types/react (+3 more)

### Community 32 - "core.ts"
Cohesion: 0.44
Nodes (9): canvasTexture(), dustTexture(), glowTexture(), seeded(), shadowTexture(), smokeTexture(), stoneTexture(), tileTexture() (+1 more)

### Community 33 - "CornerRail.tsx"
Cohesion: 0.19
Nodes (19): build(), getSoundPrefs(), isSoundStarted(), loadLaugh(), loadPrefs(), masterLevel(), newPlan(), onVisibility() (+11 more)

### Community 34 - "prize-props/render.mjs"
Cohesion: 0.13
Nodes (13): typescript, here, outDir, packsRoot, { PNG }, projectRoot, puppeteer, require (+5 more)

### Community 35 - "analytics.ts"
Cohesion: 0.16
Nodes (18): GET(), n(), AnalyticsFilter, count(), dayOf(), dayRange(), DecorationResult, loadFiltered() (+10 more)

### Community 36 - "scripts"
Cohesion: 0.22
Nodes (9): scripts, build, dev, lint, seed:images, start, test, test:e2e (+1 more)

### Community 37 - "posters.mjs"
Cohesion: 0.14
Nodes (15): Backoffice, args, block(), cssOnly, FORMATS, out, puppeteer, require (+7 more)

### Community 38 - "laugh.mjs"
Cohesion: 0.12
Nodes (12): buf, [dir, root = "."], out, puppeteer, require, server, puppeteer, require (+4 more)

### Community 39 - "antifraude.mjs"
Cohesion: 0.27
Nodes (12): client(), DATA, DECO_A, DECO_B, DEVICE(), login(), main(), ok() (+4 more)

### Community 40 - "schema.ts"
Cohesion: 0.08
Nodes (32): ParticipantsList(), Cobweb(), FIELDS, FormProps, LanternPost(), RaffleConfirmDialog(), RaffleErrors, RaffleField (+24 more)

### Community 42 - "db.ts"
Cohesion: 0.06
Nodes (39): AdminActionInput, AdminSessionInput, CompleteResult, CONFLICT_MESSAGES, CONSTRAINT_FIELD, Coordinates, DATA_FILE, DeviceStamp (+31 more)

### Community 44 - "questionnaire/ui.tsx"
Cohesion: 0.14
Nodes (18): framer-motion, AdminLogin(), submit(), AlreadyVoted(), two(), COLORS, Confetti(), makePieces() (+10 more)

### Community 45 - "wordmark.mjs"
Cohesion: 0.14
Nodes (11): here, out, puppeteer, raw, require, root, server, sharp (+3 more)

### Community 46 - "LocalStore"
Cohesion: 0.07
Nodes (4): LocalStore, migrateLocal(), pageLocal(), seed()

### Community 47 - "SpookyBackdrop.tsx"
Cohesion: 0.16
Nodes (19): zustand, SceneState, useSceneState, canRun3D(), CSSVars, SpookyBackdrop(), STARS, toggleTheme() (+11 more)

### Community 48 - "zodError"
Cohesion: 0.30
Nodes (11): zod, GET(), querySchema, GET(), querySchema, GET(), querySchema, zodError() (+3 more)

### Community 50 - "verificateur-scene.md"
Cohesion: 0.50
Nodes (3): Ce que tu reçois, Méthode, Verdict

### Community 51 - "ref_node_fs"
Cohesion: 0.25
Nodes (3): io, [srcDir, outDir, name], SRC

### Community 52 - "three"
Cohesion: 0.32
Nodes (10): three, bezier(), Flyer, rand(), startBatSwarm(), launch(), schedule(), startPoint() (+2 more)

### Community 55 - "demo.ts"
Cohesion: 0.19
Nodes (17): PublicLayout(), DEMO_RESTART_EVENT, demoFetch(), enterDemoTab(), exitDemoTab(), invalid(), isDemoTab(), readBody() (+9 more)

### Community 56 - "http.ts"
Cohesion: 0.14
Nodes (16): server-only, GET(), GET(), directSchema, GET(), bodySchema, getSummary(), parseFilter() (+8 more)

### Community 58 - "NextVoteTimer"
Cohesion: 0.33
Nodes (9): markShown(), NextVoteTimer(), two(), wasShown(), clientNow(), KEY(), readNextVote(), setNextVote() (+1 more)

### Community 59 - "assets.ts"
Cohesion: 0.50
Nodes (3): react-dom, ASSETS, SCENE_1_ASSETS

### Community 60 - "eslint.config.mjs"
Cohesion: 0.50
Nodes (3): eslintConfig, eslint, eslint-config-next

## Knowledge Gaps
- **7 isolated node(s):** `@tailwindcss/turbopack`, `@types/node`, `@types/papaparse`, `@types/react`, `@types/react-dom` (+2 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 449 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `withBase()` connect `withBase` to `CornerRail.tsx`, `schema.ts`, `next`, `questionnaire/ui.tsx`, `Fonctionnement`, `participants/page.tsx`, `Questionnaire.tsx`, `react`, `demo.ts`, `engine.ts`, `NextVoteTimer`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._
- **What connects `@tailwindcss/turbopack`, `@types/node`, `@types/papaparse` to the rest of the system?**
  _7 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `withBase` be split into smaller, more focused modules?**
  _Cohesion score 0.053854059609455295 - nodes in this community are weakly interconnected._
- **Why does `next` connect `next` to `getStore`, `withBase`, `CornerRail.tsx`, `schema.ts`, `complete/route.ts`, `questionnaire/ui.tsx`, `package.json`, `SpookyBackdrop.tsx`, `participants/page.tsx`, `Questionnaire.tsx`, `react`, `SocialCards.tsx`, `demo.ts`, `auth.ts`, `http.ts`?**
  _High betweenness centrality (0.060) - this node is a cross-community bridge._
- **Should `crypt.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12631578947368421 - nodes in this community are weakly interconnected._
- **Why does `LocalStore` connect `LocalStore` to `getStore`, `db.ts`, `SupabaseStore`, `Store`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **Should `world.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07539118065433854 - nodes in this community are weakly interconnected._