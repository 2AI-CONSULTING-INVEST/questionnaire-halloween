# Graph Report - questionnaire-halloween  (2026-10-26)

## Corpus Check
- 171 files · ~367,097 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 28 file(s) not represented in the graph (top: .avif 18, .glb 5, .css 2)

## Summary
- 1510 nodes · 4368 edges · 66 communities (56 shown, 10 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 68 edges (avg confidence: 0.89)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b0f0947d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- getStore
- withBase
- createCrypt
- world.ts
- outdoor.ts
- SupabaseStore
- .mutate
- Store
- props.ts
- complete/route.ts
- site.ts
- CornerRail.tsx
- createWorld
- package.json
- Fonctionnement
- risk.ts
- brand/render.mjs
- participants/page.tsx
- Questionnaire.tsx
- compilerOptions
- react
- 6. Résultats
- pack-models.mjs
- guard.ts
- engine.ts
- dependencies
- clock.ts
- modal-props/render.mjs
- export/route.ts
- raffle-props/render.mjs
- og.mjs
- devDependencies
- core.ts
- redact.ts
- prize-props/render.mjs
- analytics.ts
- scripts
- posters.mjs
- laugh.mjs
- wordmark.mjs
- visits.ts
- AGENTS.md
- db.ts
- CLAUDE.md
- Questionnaire.tsx
- ref_node_assert
- LocalStore
- schema.ts
- antifraude.mjs
- verificateur-scene.md
- ref_node_fs
- three
- Decoration
- fingerprint.ts
- demo.ts
- decorations/route.ts
- SpookyBackdrop.tsx
- SocialCards.tsx
- purge.test.ts
- ResponsePatch
- ResponseRow
- login/layout.tsx
- AdminSession
- vercel.json

## God Nodes (most connected - your core abstractions)
1. `getStore()` - 80 edges
2. `withBase()` - 78 edges
3. `json()` - 67 edges
4. `SupabaseStore` - 65 edges
5. `LocalStore` - 62 edges
6. `requireRole()` - 58 edges
7. `Store` - 57 edges
8. `error()` - 54 edges
9. `next` - 46 edges
10. `react` - 38 edges

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

## Communities (66 total, 10 thin omitted)

### Community 0 - "getStore"
Cohesion: 0.15
Nodes (44): POST(), POST(), GET(), PATCH(), DELETE(), PATCH(), patchSchema, POST() (+36 more)

### Community 1 - "withBase"
Cohesion: 0.05
Nodes (134): lucide-react, radix-ui, react, AdminLogin(), submit(), metadata, AdminDashboard(), logout() (+126 more)

### Community 2 - "createCrypt"
Cohesion: 0.11
Nodes (15): Billboards, BADGE, createCrypt(), placeArm(), redraw(), CRYPT_ORIGIN, CryptArea, drawResults() (+7 more)

### Community 3 - "world.ts"
Cohesion: 0.09
Nodes (32): applyCutGlow(), colGlsl(), CUT_SHINE_ORDER, CutGlow, cutGlowWarmup(), cutGlsl(), CutSpec, f() (+24 more)

### Community 4 - "outdoor.ts"
Cohesion: 0.05
Nodes (49): Décor 3D : trois lieux sur un même parcours, BigJack, BLOOD_EYES, BLOOD_POOLS, CAMERA_Z, CAULDRON_AT, CLEARING, CLEARING_EYES (+41 more)

### Community 5 - "SupabaseStore"
Cohesion: 0.07
Nodes (11): applyResponseFilter(), ConflictError, conflictFields(), filtered(), kindOf(), PgFilter, sameParticipant(), slicePage() (+3 more)

### Community 7 - "Store"
Cohesion: 0.05
Nodes (5): Store, LoginFailure, Participant, Prize, Restaurant

### Community 8 - "props.ts"
Cohesion: 0.11
Nodes (36): Préparation des modèles 3D, createBladeBloodMaterial(), dripGeometry(), merge(), armReaper(), BoneHand, Candy, CANDY_TINTS (+28 more)

### Community 9 - "complete/route.ts"
Cohesion: 0.14
Nodes (32): server-only, GET(), POST(), POST(), GET(), POST(), GET(), serverNow() (+24 more)

### Community 10 - "site.ts"
Cohesion: 0.09
Nodes (28): inter, metadata, viewport, Home(), metadata, revalidate, LanternPost(), LiveResults() (+20 more)

### Community 11 - "CornerRail.tsx"
Cohesion: 0.25
Nodes (16): getSoundPrefs(), isSoundStarted(), loadPrefs(), masterLevel(), onVisibility(), ramp(), serverSoundPrefs(), setPrefs() (+8 more)

### Community 12 - "createWorld"
Cohesion: 0.12
Nodes (31): createBloodScreen(), reset(), splash(), Inj, easeInOut(), flicker(), rand(), smooth() (+23 more)

### Community 13 - "package.json"
Cohesion: 0.12
Nodes (15): eslintConfig, name, private, version, eslint, eslint-config-next, recharts, @supabase/supabase-js (+7 more)

### Community 14 - "Fonctionnement"
Cohesion: 0.09
Nodes (20): 1. Supabase (~5 min), 2. Vercel, API, Compteur de visites (robots écartés), Données et conservation, Démarrage local (sans Supabase), Enregistrement en direct, Espace démo (+12 more)

### Community 15 - "risk.ts"
Cohesion: 0.16
Nodes (18): browserFamily(), DeviceVote, IP_DAILY_MAX_FLAG, IP_DAILY_MAX_LABEL, IP_POINTS_MAX, OWN_SIGNALS, RISK_SIGNAL_ORDER, RISK_SIGNALS (+10 more)

### Community 16 - "brand/render.mjs"
Cohesion: 0.11
Nodes (17): appDir, disc, header, here, out, puppeteer, raw, require (+9 more)

### Community 17 - "participants/page.tsx"
Cohesion: 0.19
Nodes (14): metadata, ParticipantsPage(), PrizeThumb(), revalidate, ParticipantsList(), BatSwarm(), Jumper(), PrizeDecor() (+6 more)

### Community 18 - "Questionnaire.tsx"
Cohesion: 0.07
Nodes (48): zustand, LETTERS, apiFetch(), isDemoMode(), setDemoMode(), ApiError, Props, Questionnaire() (+40 more)

### Community 19 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 20 - "react"
Cohesion: 0.24
Nodes (15): GroupRow(), move(), remove(), Dir, LightboxGroup, MediaLightbox(), SlideVideo(), Viewer() (+7 more)

### Community 21 - "6. Résultats"
Cohesion: 0.06
Nodes (34): 1. Synthèse exécutive, 2. Périmètre et exclusions, 3. Méthodologie et organisation, 4. Outils utilisés, 5. Limites de l'audit, 6. Résultats, 7. Plan d'actions priorisé, 8. Zones non couvertes (+26 more)

### Community 22 - "pack-models.mjs"
Cohesion: 0.13
Nodes (12): io, args, io, paints, roots, hex(), io, KEEP (+4 more)

### Community 23 - "guard.ts"
Cohesion: 0.13
Nodes (24): next, AdminPage(), metadata, geo(), POST(), POST(), DemoPage(), metadata (+16 more)

### Community 24 - "engine.ts"
Cohesion: 0.13
Nodes (29): bats(), birds(), build(), BUS, candle(), clampPan(), crows(), DEFAULT_PREFS (+21 more)

### Community 25 - "dependencies"
Cohesion: 0.13
Nodes (15): dependencies, framer-motion, lucide-react, next, papaparse, radix-ui, react, react-dom (+7 more)

### Community 26 - "clock.ts"
Cohesion: 0.21
Nodes (13): markShown(), NextVoteTimer(), two(), wasShown(), clientNow(), parse(), TEST_CLOCK, TEST_CLOCK_COOKIE (+5 more)

### Community 27 - "modal-props/render.mjs"
Cohesion: 0.18
Nodes (10): crops, here, meta, packsRoot, { PNG }, projectRoot, require, [rootArg, packsArg, outDir] (+2 more)

### Community 28 - "export/route.ts"
Cohesion: 0.21
Nodes (13): papaparse, xlsx, GET, PERSONAL_COLUMNS, POST, STATUS_FILTER, allResponsesRows(), date() (+5 more)

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
Cohesion: 0.20
Nodes (18): BLOOD_COLOR, bloodTexture(), createBloodMaterial(), createDrops(), createPools(), PoolSpec, canvasTexture(), dustTexture() (+10 more)

### Community 33 - "redact.ts"
Cohesion: 0.16
Nodes (24): zod, GET(), querySchema, GET(), querySchema, GET(), GET(), querySchema (+16 more)

### Community 34 - "prize-props/render.mjs"
Cohesion: 0.13
Nodes (13): typescript, here, outDir, packsRoot, { PNG }, projectRoot, puppeteer, require (+5 more)

### Community 35 - "analytics.ts"
Cohesion: 0.16
Nodes (20): GET(), GET(), AnalyticsFilter, count(), dayOf(), dayRange(), DecorationResult, getSummary() (+12 more)

### Community 36 - "scripts"
Cohesion: 0.22
Nodes (9): scripts, build, dev, lint, seed:images, start, test, test:e2e (+1 more)

### Community 37 - "posters.mjs"
Cohesion: 0.14
Nodes (15): Backoffice, args, block(), cssOnly, FORMATS, out, puppeteer, require (+7 more)

### Community 38 - "laugh.mjs"
Cohesion: 0.12
Nodes (12): buf, [dir, root = "."], out, puppeteer, require, server, puppeteer, require (+4 more)

### Community 39 - "wordmark.mjs"
Cohesion: 0.14
Nodes (11): here, out, puppeteer, raw, require, root, server, sharp (+3 more)

### Community 40 - "visits.ts"
Cohesion: 0.19
Nodes (12): Device, BOT_UA_RE, isDuplicateVisit(), summarizeVisits(), VISIT_REJECTIONS, VisitCounts, VisitLike, visitorKey() (+4 more)

### Community 42 - "db.ts"
Cohesion: 0.06
Nodes (37): AdminActionInput, AdminSessionInput, CompleteResult, CONSTRAINT_FIELD, Coordinates, DATA_FILE, DeviceStamp, FILE_NAME_RE (+29 more)

### Community 44 - "Questionnaire.tsx"
Cohesion: 0.16
Nodes (17): framer-motion, AlreadyVoted(), two(), COLORS, Confetti(), makePieces(), Piece, formatPhoneInput() (+9 more)

### Community 45 - "ref_node_assert"
Cohesion: 0.24
Nodes (4): nextConfig, Sécurité, buildCsp(), securityHeaders()

### Community 46 - "LocalStore"
Cohesion: 0.11
Nodes (4): LocalStore, pageLocal(), seed(), visitsSince()

### Community 47 - "schema.ts"
Cohesion: 0.11
Nodes (24): Cobweb(), FIELDS, FormProps, LanternPost(), RaffleConfirmDialog(), RaffleField, RaffleForm(), validateRaffle() (+16 more)

### Community 48 - "antifraude.mjs"
Cohesion: 0.27
Nodes (12): client(), DATA, DECO_A, DECO_B, DEVICE(), login(), main(), ok() (+4 more)

### Community 50 - "verificateur-scene.md"
Cohesion: 0.50
Nodes (3): Ce que tu reçois, Méthode, Verdict

### Community 51 - "ref_node_fs"
Cohesion: 0.25
Nodes (3): io, [srcDir, outDir, name], SRC

### Community 52 - "three"
Cohesion: 0.33
Nodes (11): three, bezier(), Flyer, rand(), startBatSwarm(), frame(), launch(), schedule() (+3 more)

### Community 54 - "fingerprint.ts"
Cohesion: 0.33
Nodes (10): audioRate(), browserName(), canvas(), compute(), deviceSignals(), localVoteDay(), nav(), UaData (+2 more)

### Community 55 - "demo.ts"
Cohesion: 0.14
Nodes (20): react-dom, PublicLayout(), DEMO_RESTART_EVENT, demoFetch(), enterDemoTab(), exitDemoTab(), invalid(), isDemoTab() (+12 more)

### Community 56 - "decorations/route.ts"
Cohesion: 0.31
Nodes (5): directSchema, GET(), bodySchema, MEDIA_LIMITS, MEDIA_TYPES

### Community 57 - "SpookyBackdrop.tsx"
Cohesion: 0.22
Nodes (15): useSceneState, canRun3D(), CSSVars, SpookyBackdrop(), STARS, toggleTheme(), applyAmbience(), setSoundPlace() (+7 more)

### Community 58 - "SocialCards.tsx"
Cohesion: 0.17
Nodes (19): Btn, copy(), noSubscribe(), ShareButtons(), shareUrl(), InstagramIcon(), LABELS, Network (+11 more)

### Community 59 - "purge.test.ts"
Cohesion: 0.27
Nodes (8): LocalData, migrateLocal(), RETENTION_DAYS, NOW, response(), session(), uuid(), visit()

### Community 61 - "ResponseRow"
Cohesion: 0.18
Nodes (3): Page, ResponseRow, Visit

## Knowledge Gaps
- **7 isolated node(s):** `@tailwindcss/turbopack`, `@types/node`, `@types/papaparse`, `@types/react`, `@types/react-dom` (+2 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 486 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `LocalStore` connect `LocalStore` to `getStore`, `SupabaseStore`, `.mutate`, `Store`, `db.ts`, `Decoration`, `ResponsePatch`, `ResponseRow`?**
  _High betweenness centrality (0.060) - this node is a cross-community bridge._
- **What connects `@tailwindcss/turbopack`, `@types/node`, `@types/papaparse` to the rest of the system?**
  _7 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `withBase` be split into smaller, more focused modules?**
  _Cohesion score 0.05087375469541074 - nodes in this community are weakly interconnected._
- **Why does `withBase()` connect `withBase` to `site.ts`, `CornerRail.tsx`, `Questionnaire.tsx`, `Fonctionnement`, `schema.ts`, `participants/page.tsx`, `Questionnaire.tsx`, `react`, `demo.ts`, `engine.ts`, `clock.ts`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **Should `createCrypt` be split into smaller, more focused modules?**
  _Cohesion score 0.10507246376811594 - nodes in this community are weakly interconnected._
- **Why does `next` connect `guard.ts` to `getStore`, `withBase`, `complete/route.ts`, `site.ts`, `CornerRail.tsx`, `Questionnaire.tsx`, `package.json`, `ref_node_assert`, `schema.ts`, `participants/page.tsx`, `react`, `demo.ts`, `decorations/route.ts`, `SpookyBackdrop.tsx`, `SocialCards.tsx`, `login/layout.tsx`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Should `world.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0873015873015873 - nodes in this community are weakly interconnected._