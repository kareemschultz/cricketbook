# ScoreFlow

A mobile-first PWA for tracking live cricket matches, stats, and tournaments — plus Dominoes, Trump/All Fours, and FIFA trackers for your friend group. All data lives on your device via IndexedDB. No backend, no account required.

**Live:** https://kareemschultz.github.io/scoreflow/

---

## Games

### Cricket
- **Live scoring** — ball-by-ball with extras (wide, no-ball, bye, leg-bye), wickets, free hits, last-man-stands, and multi-ball undo
- **Match setup wizard** — 5-step flow: teams → format/rules → toss → playing XI → openers
- **Custom rules** — overs, bowler limits, balls per over, wide/NB re-ball, free hit on no-ball, last man stands, super over, and more
- **Scorecard** — batting/bowling cards, fall of wickets, partnerships, extras breakdown
- **Charts** — Manhattan, Worm, and Run Rate graphs (SVG, interactive hover tooltips, dual-innings)
- **Stats** — top scorers, wicket takers, best average, economy; format filters; player career profiles
- **Records** — all-time bests: highest score, best figures, most runs, highest partnership
- **Tournaments** — round-robin fixtures, standings with NRR, champion tracking
- **Teams & rosters** — create teams, add/edit/bulk-import players with roles and batting hand

### Dominoes
- Record match results with configurable target scores and scoring mode (hands or points)
- Team-based (2v2 pairs)
- Match history with tournament vs casual filters
- **Tournament system** — round-robin fixtures, standings, champion handling

### Trump / All Fours
- Score Trump card game matches with configurable target scores
- Team-based (2v2 pairs)
- Match history with tournament vs casual filters
- **Tournament system** — round-robin fixtures, standings, champion handling

### FIFA
- Track FIFA match results between friends (1v1)
- Leaderboard with W/D/L, win rate, and points
- Player profiles with match history and head-to-head records

---

## App

- **PWA** — install to home screen on iOS and Android, works fully offline
- **Dark mode** — optimized for outdoor/field use
- **Framer Motion animations** — innings break overlay, match result celebration, confetti
- **Share scorecard** — export as image (html2canvas) or copy as text
- **Data backup** — export all 17 tables as versioned JSON with SHA-256 integrity hash; re-import with replace or merge mode

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | React 19 + Vite 7 |
| Routing | TanStack Router v1 (file-based) |
| UI | shadcn/ui — Maia preset (Base UI, not Radix) |
| CSS | Tailwind CSS v4 (CSS-native config) |
| Animations | Framer Motion |
| State | Zustand (live scoring session only) |
| Database | Dexie.js v4 (IndexedDB) + dexie-react-hooks |
| Package manager | Bun workspaces |
| PWA | vite-plugin-pwa + Workbox |
| Deployment | GitHub Pages via GitHub Actions |

---

## Monorepo Structure

```
scoreflow/
├── apps/web/
│   └── src/
│       ├── routes/            # TanStack file-based routes
│       │   ├── scoring.tsx    # Live scoring interface
│       │   ├── dominoes/      # Dominoes matches + tournaments
│       │   ├── trump/         # Trump matches + tournaments
│       │   └── fifa/          # FIFA matches + leaderboard
│       ├── components/        # Scoring, scorecard, charts, overlays
│       ├── db/                # Dexie schema (v4, 17 tables)
│       ├── lib/               # Cricket engine, tournament fixtures, helpers
│       ├── stores/            # Zustand scoring session store
│       └── types/             # TypeScript types + ExportPayload
└── packages/
    └── ui/                    # @workspace/ui — shared shadcn/Base UI components
```

---

## Routes

| Path | Page |
|------|------|
| `/` | Home — active match card + recent matches |
| `/new-match` | 5-step match setup wizard |
| `/scoring` | Live scoring interface |
| `/scorecard/$matchId` | Full scorecard with charts |
| `/history` | Match history |
| `/stats` | Leaderboard tabs |
| `/stats/$playerId` | Player career profile |
| `/records` | All-time records |
| `/teams` | Team list |
| `/teams/$teamId` | Team roster |
| `/tournaments` | Cricket tournament list |
| `/tournaments/$tournamentId` | Cricket tournament overview |
| `/settings` | Export/import, app info |
| `/fifa` | FIFA leaderboard |
| `/fifa/players/$playerId` | FIFA player profile |
| `/fifa/matches` | FIFA match history |
| `/dominoes` | Dominoes hub |
| `/dominoes/matches` | Dominoes match history (tournament filter) |
| `/dominoes/matches/new` | Record a Dominoes match |
| `/dominoes/tournaments` | Dominoes tournament list |
| `/dominoes/tournaments/$tournamentId` | Dominoes tournament detail |
| `/trump` | Trump/All Fours hub |
| `/trump/matches` | Trump match history (tournament filter) |
| `/trump/matches/new` | Record a Trump match |
| `/trump/tournaments` | Trump tournament list |
| `/trump/tournaments/$tournamentId` | Trump tournament detail |

---

## Development

**Prerequisites:** [Bun](https://bun.sh) installed.

```bash
# Install dependencies
bun install

# Dev server (from apps/web)
npx vite --port 5173

# Unit tests (232 tests across 5 files)
cd apps/web && npx vitest run

# E2E tests
cd apps/web && npx playwright test

# TypeScript check
node apps/web/node_modules/typescript/bin/tsc --noEmit --project apps/web/tsconfig.app.json

# Build
cd apps/web && npx vite build
```

---

## CI / CD

`.github/workflows/deploy.yml` runs before every deploy to `main`:

1. `bun audit` — dependency vulnerability gate
2. `bun run lint` — ESLint
3. `bun run typecheck` — TypeScript
4. `bun run test` — 232 unit tests (Vitest)
5. `bunx playwright test` — full E2E browser test (teams → match → innings → result → export/import)
6. `bun run build` — production build
7. Deploy to GitHub Pages

---

## Data Architecture

- **Event sourcing** — `ballLog` is the source of truth; all cricket stats are derived
- **Zustand** — only for the live scoring session (`stores/scoring.ts`); everything else via `useLiveQuery`
- **No backend** — all data in the browser's IndexedDB. Settings → Export backs up all 17 tables as JSON
- **Export schema v3** — `ExportPayload` type in `types/export.ts`; SHA-256 integrity hash; `replace` or `merge` import modes
- **Innings persistence** — `currentStrikerId`, `currentNonStrikerId`, `currentBowlerId` are persisted on the `Innings` object so match state survives page reloads
- **Bundle splitting** — Vite `manualChunks` splits react / router / storage / motion / icons / dates / html2canvas into separate cached chunks; html2canvas is lazy-loaded

### DB tables (Dexie v4, 17 total)

| Module | Tables |
|--------|--------|
| Cricket | `teams`, `players`, `matches`, `tournaments`, `battingStats`, `bowlingStats` |
| FIFA | `fifaPlayers`, `fifaMatches` |
| Dominoes | `dominoPlayers`, `dominoTeams`, `dominoMatches`, `dominoTournaments` |
| Trump | `trumpPlayers`, `trumpTeams`, `trumpMatches`, `trumpTournaments` |
| App | `settings` |

---

## Cricket Rules Engine

`src/lib/cricket-engine.ts` — pure functions, no side effects:

- `isLegalDelivery(ball)` — wides and no-balls are not legal deliveries
- `isOverComplete(balls, rules)` — counts legal deliveries vs `ballsPerOver`
- `shouldSwapStrike(ball)` — odd run totals or end-of-over strike rotation
- `isMaidenOver(balls)` — all legal deliveries, zero batting runs
- `computeBowlerEntry(ballLog, bowlerId, rules)` — single-pass O(n) accumulator
- `getCurrentPartnership(ballLog, bat1, bat2)` — includes all extras (byes, wides) while pair is at crease
- `isInningsComplete(innings, rules)` — all out, overs done, or declared

---

## Known Issues

- Bottom nav overlaps wizard "Next" buttons on very small screens (`pb-20` fix pending)

---

## Contributing

Personal project. Open an issue with the match scenario if you find a bug.
