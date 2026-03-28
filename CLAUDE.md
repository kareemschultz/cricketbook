# ScoreFlow — CLAUDE.md

## Project Overview
ScoreFlow (formerly CricketBook) is a **mobile-first live scoring PWA** — client-side only, all data in IndexedDB via Dexie.js. No backend. Deployed to GitHub Pages at `https://kareemschultz.github.io/cricketbook/`.

## Monorepo Structure
```
cricketbook/
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

## Key Architecture Decisions
1. **Event sourcing**: `ballLog` is source of truth; all stats are derived
2. **Zustand only for live scoring** (`stores/scoring.ts`) — everything else via `useLiveQuery`
3. **Base: "/cricketbook/"** in vite.config.ts — required for GitHub Pages subdirectory
4. **dedupe: ["react", "react-dom", "lucide-react"]** in vite resolve — needed because lucide-react is in apps/web/node_modules but also imported from packages/ui

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

## Known Bugs (Found via E2E Testing — 2026-03-27)

### Bug 1: NewBatsmanSheet may not open after wicket [MEDIUM]
- **Symptom**: After recording a wicket, the bottom sheet to select next batsman sometimes doesn't visually appear
- **Location**: `apps/web/src/routes/scoring.tsx` line 394-396, `components/scoring/NewBatsmanSheet.tsx`
- **Root cause**: Possible: `availableBatsmen` is empty if `allPlayers` useLiveQuery hasn't loaded; OR Base UI Sheet portal timing
- **Fix approach**: Add `onOpenChange` to Sheet for controlled mode; ensure `allPlayers` is loaded before showing sheet

### Bug 2: Bottom nav overlaps wizard "Next" buttons [LOW]
- **Symptom**: In new-match.tsx wizard, bottom action buttons are partially obscured by sticky bottom nav
- **Fix**: Add `pb-20` or `mb-16` to wizard step containers to clear nav bar

### Bug 3: "Tap New Over to select a bowler" hint persists when bowler IS set [LOW]
- **Location**: `apps/web/src/routes/scoring.tsx` line 690
- **Fix**: The BowlerCard fallback text shows when `!currentBowler` but the hint text is stale

## Completed Features
All phases from the implementation plan are built:
- ✅ Cricket engine (pure functions, `lib/cricket-engine.ts`)
- ✅ Zustand scoring store with undo, free hit, over management
- ✅ Full scoring UI (run buttons, extras, wicket dialog, new batsman/bowler sheets)
- ✅ Match setup wizard (5 steps: teams, format/rules, toss, playing XI, openers)
- ✅ Teams + player CRUD
- ✅ Scorecard with batting/bowling cards, FOW, partnerships
- ✅ SVG charts: Manhattan, Worm, RunRate, WagonWheel
- ✅ Stats leaderboard + player profiles
- ✅ Records page
- ✅ Tournament list + overview
- ✅ History, Settings with JSON export/import
- ✅ PWA with service worker + workbox precaching
- ✅ iOS PWA meta tags (apple-mobile-web-app-capable, status-bar-style, touch-icon)

## Pending Enhancements
- [ ] Framer Motion animations (page transitions, score counter, boundary flash)
- [ ] Demo/mock match data seed for first-time users
- [ ] PartnershipBar and RunRateGraph improvements
- [ ] Share scorecard as image (html2canvas integration)
- [ ] Tournament fixture scheduling
- [ ] Player form chart on stats/$playerId
