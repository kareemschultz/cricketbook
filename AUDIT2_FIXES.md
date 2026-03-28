# CricketBook — Audit 2 Fix Tracker

This doc tracks all issues from the second Codex audit so context is preserved across conversation compactions.

## PR Status
- **PR #2** (Add import guardrails) — open, NOT merged. Import validation was already implemented in settings.tsx during a prior session. PR #2 adds mostly the same thing; it can be closed as superseded.

## Issues Fixed in THIS Session

### ✅ 1. Strike rotation — law-correct for all extras
**File:** `apps/web/src/lib/cricket-engine.ts`
**Bug:** `shouldSwapStrikeAfterBall` always returned `false` for wides, and used `batsmanRuns` (=0) for byes/leg-byes, meaning 1 bye never caused a strike swap.
**Law:** Odd completed runs cause strike to change. For byes/leg-byes that's `extraRuns`. For wides the physical running = `extraRuns − wideRunPenalty`. For no-balls and normal deliveries it's `batsmanRuns`.
**Fix:** Rewrote function to switch on `extraType`. Now accepts optional `wideRunPenalty` (defaults to 1). Call sites in the store pass `rules.wideRuns`.

### ✅ 2. Chase completion missing from isInningsComplete
**File:** `apps/web/src/lib/cricket-engine.ts`
**Bug:** `isInningsComplete` never checked if the batting team reached the target. Match-end dialog would not auto-trigger when target was hit.
**Fix:** Added `if (innings.target !== undefined && innings.totalRuns >= innings.target) return true` as the first check (before wickets/overs).

### ✅ 3. Blank stat records bulkPut'd to DB
**File:** `apps/web/src/lib/stats-calculator.ts`
**Bug:** All player IDs were pre-seeded into `battingUpdates`/`bowlingUpdates` maps with blank records (empty `playerId`/`playerName`). Players who never actually batted/bowled still had their blank record written to Dexie.
**Fix:** Added `touchedBattingIds` and `touchedBowlingIds` Sets. Only IDs in those sets are included in the final `bulkPut`.

### ✅ 4. Reload striker inference wrong after wicket
**File:** `apps/web/src/stores/scoring.ts → loadMatch`
**Bug:** `loadMatch` started with `striker = lastBall.batsmanId`. If the last ball was a wicket dismissing that batter, they'd be set as `onStrikeBatsmanId` even though they're out.
**Fix:** After computing striker/swap, check if `striker` is actually in `activeBatsmen`. If dismissed, fall back to the first active batter who isn't the non-striker.

### ✅ 5. Undo doesn't restore non-striker runout
**File:** `apps/web/src/stores/scoring.ts → undoLastBall`
**Bug:** Undo wicket restore only handled `dismissedPlayerId === batsmanId` (striker dismissal). Non-striker runout left `offStrike = null` permanently.
**Fix:** Added `else` branch: if `dismissedPlayerId !== poppedBall.batsmanId`, restore that player as `offStrike`.

### ✅ 6. Non-striker dismissal not marked in batting card
**File:** `apps/web/src/stores/scoring.ts → applyBallToMatch` + `rebuildInningsFromBallLog`
**Bug:** Batting card only set `isOut = true` when `dismissedPlayerId === batsmanId`. Non-striker runout left the non-striker's `isOut = false`.
**Fix:** Added a separate lookup for `dismissedPlayerId` to mark their card entry as out when they differ from `batsmanId`.

### ✅ 7. DB writes not awaited in selection handlers
**File:** `apps/web/src/hooks/use-scoring-handlers.ts`
**Bug:** `handleNewBowlerSelect` and `handleNewBatsmanSelect` called `db.matches.put(updated)` without `await`. On a slow write or navigation race the store and DB could diverge.
**Fix:** Made both handlers `async`, added `await` before `db.matches.put`.

### ✅ 8. Overs displayed without balls in stats tables
**File:** `apps/web/src/routes/stats/index.tsx`
**Bug:** `s.overs.toFixed(0)` hid the partial-over balls component (e.g. 4.3 showed as "4").
**Fix:** Replaced with `s.balls > 0 ? \`${s.overs}.${s.balls}\` : \`${s.overs}\`` in both BestWicketsTable and BestEconomyTable.

## Issues NOT Fixed (Intentionally deferred)

| Issue | Reason deferred |
|---|---|
| NRR 19.6 silent clamping | Minor data-quality concern, not a runtime bug |
| Scoring hot-path O(n) filter scans | Performance optimization, not correctness |
| Full Zod schema validation on import | Large scope; existing guards cover realistic cases |
| Import large-backup override mechanism | UX feature, not a bug |
| Deterministic reducer for strike/innings | Major refactor; fix applied at function level |

## Test Coverage Added

- Tests updated for new `shouldSwapStrikeAfterBall` behavior:
  - 1 bye → swap
  - 3 leg-byes → swap
  - 2 byes → no swap
  - plain wide (extraRuns=1) → no swap
  - wide with 1 run running (extraRuns=2) → swap
  - wide with 2 runs running (extraRuns=3) → no swap
  - 1 no-ball bat run → swap
- Test for `isInningsComplete` with target reached

## Files Modified
- `apps/web/src/lib/cricket-engine.ts`
- `apps/web/src/lib/cricket-engine.test.ts`
- `apps/web/src/stores/scoring.ts`
- `apps/web/src/lib/stats-calculator.ts`
- `apps/web/src/hooks/use-scoring-handlers.ts`
- `apps/web/src/routes/stats/index.tsx`
