# ScoreFlow — CLAUDE.md

## Project Overview
ScoreFlow (formerly CricketBook) is a **mobile-first live scoring PWA** — client-side only, all data in IndexedDB via Dexie.js. No backend. Deployed to GitHub Pages at `https://kareemschultz.github.io/scoreflow/`.

## Monorepo Structure
```
scoreflow/
├── apps/web/          — Vite + React 19 SPA (main app)
├── packages/ui/       — @workspace/ui shadcn/Maia component library
└── .github/workflows/deploy.yml  — GitHub Actions → GitHub Pages
```

## Tech Stack
| Layer | Tech |
|-------|------|
| Framework | React 19 + Vite 7 + TanStack Router (file-based) |
| UI Library | **shadcn/ui Maia preset** — uses **Base UI** (@base-ui/react), NOT Radix UI |
| CSS | Tailwind CSS v4 (CSS-native config, no tailwind.config.js) |
| Animations | Framer Motion (add: `bun add framer-motion` in apps/web) |
| State | Zustand (live scoring session only) |
| Database | Dexie.js (IndexedDB) + dexie-react-hooks (useLiveQuery) |
| Router | TanStack Router v1 — file-based routes in `apps/web/src/routes/` |
| Package mgr | Bun workspaces |
| PWA | vite-plugin-pwa + workbox |
| Deployment | GitHub Pages via GitHub Actions |

## CRITICAL: Base UI vs Radix
**This project uses Base UI, NOT Radix UI.** Key differences:
- No `asChild` prop — use `render={<Button />}` prop instead
- `onValueChange` in Select gives `string | null` (not just `string`)
- Dexie `db.transaction()` max 5 tables as variadic args — use array form: `db.transaction("rw", [table1, table2, ...], callback)` for 6+ tables
- Dialog/Sheet uses `data-open` attributes, not `data-state`

## Build Commands
```bash
# From apps/web directory:
node ../../node_modules/.bun/vite@*/node_modules/vite/bin/vite.js build
node ../../node_modules/.bun/vite@*/node_modules/vite/bin/vite.js --port 5173   # dev server

# TypeScript check:
node apps/web/node_modules/typescript/bin/tsc --noEmit --project apps/web/tsconfig.app.json
```

## Cricket Engine Rules

**Partnership includes ALL runs, not just batsman runs:**
`getCurrentPartnership` sums `b.runs` for every ball while the pair is at the crease — including wides, byes, leg-byes, and no-ball extras. Individual batsman credit is tracked separately via `getBatsmanRuns`. Do NOT filter `!b.isExtra` when computing partnership totals.

**Import validator uses `isFiniteNumber`, not `typeof x === "number"`:**
`isFiniteNumber` rejects `NaN` and `Infinity`. Always use it when validating numeric fields in `import-validator.ts`.

## Key Architecture Decisions
1. **Event sourcing**: `ballLog` is source of truth; all stats are derived
2. **Zustand only for live scoring** (`stores/scoring.ts`) — everything else via `useLiveQuery`
3. **Base: "/scoreflow/"** in vite.config.ts — required for GitHub Pages subdirectory
4. **dedupe: ["react", "react-dom", "lucide-react"]** in vite resolve — needed because lucide-react is in apps/web/node_modules but also imported from packages/ui
5. **Pure scoring transitions** (`lib/scoring-transitions.ts`) — `applyBallToMatch`, `rebuildInningsFromBallLog`, `rederiveStateFromInnings` are pure functions with no Dexie/Zustand deps. Test them without store mocking. `scoring.ts` only handles Zustand state + Dexie persistence.
6. **ExportPayload type** (`types/export.ts`) — canonical interface for all exports. `EXPORT_TABLE_KEYS` const defines the fixed ordering used for SHA-256 integrity hash. Import mode is `"replace"` (bulkPut) or `"merge"` (bulkAdd skipping existing keys).

## Testing Structure
- `lib/cricket-engine.test.ts` — pure engine function tests (192 tests)
- `lib/import-validator.test.ts` — validation tests, all 17 table types (152 tests)
- `lib/scoring-transitions.test.ts` — pure transition tests (32 tests)
- `stores/scoring.test.ts` — Zustand store integration tests (mocked Dexie)
- `e2e/full-match.spec.ts` — Playwright E2E: teams → new match → both innings → export → clear → reimport
- Run unit tests: `cd apps/web && npx vitest run`
- Run E2E: `cd apps/web && npx playwright test`

## Route Structure
```
/                         — Home (active match card + quick stats)
/new-match                — 5-step match setup wizard
/scoring                  — Live scoring interface
/scorecard/$matchId       — Full scorecard + charts
/history                  — Match history list
/stats                    — Leaderboard tabs
/stats/$playerId          — Player profile
/records                  — All-time records
/teams                    — Team list
/teams/$teamId            — Team roster
/tournaments              — Tournament list
/tournaments/$tournamentId — Tournament overview
/settings                 — Settings + data export/import
```

## Critical Scoring Store Pattern

**All post-`await` state reads in `use-scoring-handlers.ts` MUST use `useScoringStore.getState()`**, not `ctx.*` closure values. The `ctx` object is captured at render time and will be stale after any `await recordBall()` call.

Correct pattern (used in `checkPostBall`, `handleWicketConfirm`, `handleEndMatch`):
```ts
const latestState = useScoringStore.getState()
const latestMatch = latestState.match
const latestIdx = latestState.currentInningsIndex
const latestInnings = latestMatch?.innings[latestIdx]
```

**`isLastInnings` must always use rules, never array length:**
```ts
const totalInnings = (latestMatch.rules.inningsPerSide ?? 1) * 2
const isLastInnings = latestIdx >= totalInnings - 1
// NOT: match.innings.length - 1  ← wrong when first innings ends
```

## Critical: allPlayers useLiveQuery must use null sentinel

```ts
// WRONG — useLiveQuery ?? [] makes loading look like empty list
const allPlayers = useLiveQuery(..., [match?.id]) ?? []
if (allPlayers.length > 0) setShowNewBatsmanSheet(true) // ← never opens during load

// CORRECT
const allPlayers = useLiveQuery(..., [match?.id], null)
const isPlayersLoading = allPlayers === null
const players = allPlayers ?? []
// Pass disabled: isPlayersLoading into NextActionType for the next-action strip
```

**Why:** During Dexie initialization, `useLiveQuery` returns `undefined`. With `?? []`, this looks like an empty players list, blocking the batsman sheet from opening. Using `null` as the default lets us detect the loading state and show "Loading players..." instead of silently blocking.

## Critical Architecture: ScoringLoader Pattern

`scoring.tsx` has a `ScoringLoader` wrapper component that handles cold-start (page refresh, Resume Match):

```tsx
// ScoringLoader — ONLY gate on !match, NEVER on isProcessing
if (!match) return <spinner />   // ← correct
// if (!match || isProcessing)   // ← WRONG: unmounts ScoringPage on every ball tap
return <ScoringPage />
```

**Why:** `recordBall` sets `isProcessing:true` during every DB write. Including `isProcessing` in the gate condition unmounts and remounts `ScoringPage` on every single button tap, resetting all dialog state and making scoring non-functional.

`useLiveQuery` null/undefined sentinel pattern:
```ts
// Pass null as default so we can tell loading apart from "not found"
const liveMatch = useLiveQuery(() => db.matches.where("status").equals("live").first(), [], null)
// null = still loading | undefined = query done, not found | Match = found
if (liveMatch === null) return  // loading — wait
if (!liveMatch) navigate("/")   // not found — go home
```

**Why:** Without the `null` default, `useLiveQuery` returns `undefined` for BOTH "loading" and "not found" — the guard `if (liveMatch === undefined) return` exits early even when the DB has no live match, causing infinite spinner.

**Detail page variant** — when the query function itself returns `null` for not-found (e.g. `if (!player) return null`), test with strict equality:
```ts
const data = useLiveQuery(async () => {
  const player = await db.fifaPlayers.get(playerId)
  if (!player) return null   // ← explicit null = not found
  return { player, ... }
})
// WRONG: if (!data) — catches both undefined (loading) AND null (not found)
if (data === undefined) return <spinner />   // loading
if (data === null) return <p>Not found</p>  // not found
```

## Critical: Innings participant IDs must be persisted

`currentStrikerId`, `currentNonStrikerId`, `currentBowlerId` are stored on the `Innings` object (optional fields) and written to IndexedDB on every ball, batsman selection, and bowler selection. `loadMatch` reads them first — falling back to ball-log derivation only if absent.

```ts
// WRONG — participants only in Zustand; lost on page reload
useScoringStore.setState({ currentBowlerId: playerId })

// CORRECT — persist to innings, then sync Zustand
const updated = structuredClone(match)
updated.innings[idx].currentBowlerId = playerId
await db.matches.put(updated)
useScoringStore.setState({ match: updated, currentBowlerId: playerId })
```

**Why:** Zustand lives only in memory. Without persisting these IDs, any page reload wiped the active batsmen/bowler — users had to re-select every time they resumed a match.

**How to apply:** Whenever `handleNewBatsman`, `handleNewBowler`, or `recordBall` mutates participant state, also write it to the innings record before calling `db.matches.put`. `loadMatch` priority: persisted IDs → ball-log derivation → opener positional fallback.

### loadMatch must NOT touch isProcessing

```ts
// WRONG — isProcessing stuck true if loadMatch throws, permanently breaks canScore:
loadMatch: async (id) => {
  set({ isProcessing: true })  // ← REMOVE THIS
  ...
  set({ ..., isProcessing: false })  // ← REMOVE THIS TOO
}

// CORRECT — loadMatch only sets match/store fields, never isProcessing
loadMatch: async (id) => {
  const match = await db.matches.get(id)
  ...
  set({ matchId, match, onStrikeBatsmanId, ... })  // no isProcessing
}
```

**Why:** `RootLayout` calls `loadMatch` on app startup with no error handling. Any exception after `set({ isProcessing: true })` leaves `isProcessing` permanently `true`. Since `canScore = !!striker && !!bowler && !isProcessing`, all score buttons are permanently disabled. `loadMatch` doesn't need to touch `isProcessing` — `ScoringLoader` gates on `!match`, not `isProcessing`.

## Known Bugs

### Bug 2: Bottom nav overlaps wizard "Next" buttons [LOW]
- **Symptom**: In new-match.tsx wizard, bottom action buttons partially obscured by sticky bottom nav
- **Fix**: Add `pb-20` or `mb-16` to wizard step containers

## Completed Features
- ✅ Cricket engine (pure functions, `lib/cricket-engine.ts`)
- ✅ Zustand scoring store with undo, free hit, over management, `lastOverBalls`, `undoNBalls`
- ✅ Full scoring UI (run buttons, extras, wicket dialog, new batsman/bowler sheets, multi-undo)
- ✅ Match setup wizard (5 steps: teams, format/rules, toss, playing XI, openers)
- ✅ Teams + player CRUD
- ✅ Scorecard with batting/bowling cards, FOW, partnerships, `MatchSummaryCard`
- ✅ SVG charts: Manhattan (dual-innings), Worm (dual-innings), RunRate, WagonWheel
- ✅ Scorecard inline collapsible chart section (both innings side-by-side)
- ✅ **InningsBreakOverlay**: animated full-screen innings transition with score + target
- ✅ **MatchResultOverlay**: animated full-screen celebration with confetti + trophy
- ✅ Stats leaderboard + player profiles
- ✅ Records page
- ✅ Tournament list + overview
- ✅ History, Settings with JSON export/import (versioned schema, all 17 tables)
- ✅ PWA with service worker + workbox precaching
- ✅ iOS PWA meta tags
- ✅ Share scorecard as image (html2canvas) + text copy
- ✅ **Dominoes tracker** (`/dominoes/*`) — match scoring, stats, teams
- ✅ **Trump card game tracker** (`/trump/*`) — match scoring, stats, teams
- ✅ Score tab shows "No active match" CTA instead of silent redirect
- ✅ `allPlayers` useLiveQuery null sentinel + `isPlayersLoading` guard in ScoringPage
- ✅ Bowler hint text when `!currentBowler && innings.ballLog.length > 0`
- ✅ Partnership calculation includes extras (byes, no-balls) — `getCurrentPartnership` no longer filters `!b.isExtra`
- ✅ Import validator covers all 15 DB tables with deep MatchRules validation (17 fields)
- ✅ Import validator rejects NaN/Infinity values and non-positive rule numbers (`isFiniteNumber` helper)
- ✅ `getTopBowlers` query uses `where("format").equals(format)` + in-memory sort (avoids unindexed `orderBy("wickets")`)
- ✅ Innings transition label shows ordinal e.g. "start innings 2/2"
- ✅ Scoring UI "why disabled" helper text (match complete, innings complete, processing, missing striker/bowler)
- ✅ `computeBowlerEntry` single-pass O(n) accumulator (replaced 8+ linear scans)
- ✅ Store decomposed: `scoring.ts` 710→350 lines; pure functions in `lib/scoring-transitions.ts`
- ✅ 232 passing unit tests across 5 test files (cricket-engine, import-validator, scoring-transitions, store, tournament-fixtures)
- ✅ **Full Playwright E2E test** (`e2e/full-match.spec.ts`) — teams → wizard → 1st innings → innings break → 2nd innings → match result → export → clear → reimport roundtrip
- ✅ **`ExportPayload` TypeScript interface** (`types/export.ts`) — canonical schema v3 with 17 tables, `ExportIntegrity`, `ImportMode`, `EXPORT_TABLE_KEYS`
- ✅ **Backup integrity hash** — export computes SHA-256 via `crypto.subtle` over canonical table JSON; import warns (non-blocking) on hash mismatch
- ✅ **Import modes** — `replace` (bulkPut, overwrites) and `merge` (bulkAdd skipping existing IDs) with card selector UI in import dialog
- ✅ FIFA player profile `useLiveQuery` null/undefined fix — "Player not found" message now reachable
- ✅ **Innings participant persistence** — `currentStrikerId`, `currentNonStrikerId`, `currentBowlerId` persisted on `Innings` in IndexedDB; `loadMatch` reads them first, falls back to ball-log derivation (fixes reload/recovery)
- ✅ **Dominoes + Trump tournament system** — full fixture scheduling, standings, champion handling; `dominoTournaments` + `trumpTournaments` tables (Dexie v4); tournament-aware match history filters
- ✅ **`lastManStands` scoring** — `hasRequiredBatters()` allows scoring with 1 batter at final wicket
- ✅ **CI hardening** — lint + typecheck + unit tests + Playwright all gate before GitHub Pages deploy

## Verification Protocol

**Always verify deploys are live before reporting to user:**
```bash
gh run list --limit 1   # check deploy succeeded
curl -sI https://kareemschultz.github.io/scoreflow/ | grep last-modified  # confirm bundle timestamp
```
Bundle last-modified should be within 60s of the gh run completed timestamp. JS is minified — can't grep for code strings in the bundle.

## Pending Enhancements
- [ ] Framer Motion page transitions + score counter animation
- [ ] Demo/mock match data seed for first-time users
- [ ] PartnershipBar and RunRateGraph improvements
- ✅ Tournament fixture scheduling (Dominoes + Trump)
- [ ] Player form chart on stats/$playerId
