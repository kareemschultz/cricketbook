import { create } from "zustand"
import { db } from "@/db/index"
import type { Ball, Match, Innings } from "@/types/cricket"
import { WICKET_DISMISSALS } from "@/types/cricket"
import {
  shouldSwapStrikeAfterBall,
  shouldSwapStrikeEndOfOver,
  isOverComplete,
  getBatsmanRuns,
  getExtraRuns,
  getOversBowledByPlayer,
  computeBowlerEntry,
} from "@/lib/cricket-engine"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScoringState {
  matchId: string | null
  match: Match | null
  currentInningsIndex: number
  onStrikeBatsmanId: string | null
  offStrikeBatsmanId: string | null
  currentBowlerId: string | null
  isFreeHit: boolean
  overBalls: Ball[]
  lastOverBalls: Ball[]      // balls from the most-recently completed over
  lastOverSummary: string
  oversBowledByBowler: Record<string, number>
  isProcessing: boolean
}

interface ScoringActions {
  recordBall: (ball: Ball) => Promise<void>
  undoLastBall: () => Promise<void>
  undoNBalls: (n: number) => Promise<void>
  swapStrike: () => void
  loadMatch: (matchId: string) => Promise<void>
  clearSession: () => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Derive ball summary token for over display (e.g. "0", "1", "4", "6", "W", "wd", "nb") */
function ballToken(ball: Ball): string {
  if (ball.isWicket) return "W"
  if (ball.extraType === "wide") return "wd"
  if (ball.extraType === "noBall") return "nb"
  if (ball.runs === 4) return "4"
  if (ball.runs === 6) return "6"
  if (ball.runs === 0) return "0"
  return String(ball.runs)
}

/** Build a summary string for a completed over, e.g. "0 1 4 W 1 2 = 8" */
function buildOverSummary(balls: Ball[]): string {
  const tokens = balls.map(ballToken).join(" ")
  const total = balls.reduce((sum, b) => sum + b.runs, 0)
  return `${tokens} = ${total}`
}

/** Determine whether a dismissal counts as a wicket in the bowling/batting tallies */
function isCountedWicket(ball: Ball): boolean {
  return (
    ball.isWicket &&
    !!ball.dismissalType &&
    WICKET_DISMISSALS.includes(ball.dismissalType)
  )
}

/**
 * Apply one ball's worth of stat changes directly to a Match (mutates a deep
 * clone that the caller provides). Returns whether the over completed.
 */
function applyBallToMatch(
  match: Match,
  inningsIndex: number,
  ball: Ball
): { overCompleted: boolean; overBalls: Ball[] } {
  const innings: Innings = match.innings[inningsIndex]
  const rules = match.rules

  // 1. Push ball to log
  innings.ballLog.push(ball)

  // 2. Extras breakdown
  const extraDelta = getExtraRuns(ball)
  innings.extras.wide += extraDelta.wide
  innings.extras.noBall += extraDelta.noBall
  innings.extras.bye += extraDelta.bye
  innings.extras.legBye += extraDelta.legBye
  innings.extras.penalty += extraDelta.penalty
  innings.extras.total += extraDelta.total

  // 3. Innings totals
  innings.totalRuns += ball.runs
  if (isCountedWicket(ball)) {
    innings.totalWickets += 1
  }

  // 4. Batsman entry
  const batsmanEntry = innings.battingCard.find(
    (e) => e.playerId === ball.batsmanId
  )
  if (batsmanEntry) {
    const bRuns = getBatsmanRuns(ball)
    batsmanEntry.runs += bRuns
    if (ball.isLegal) {
      batsmanEntry.balls += 1
    }
    if (bRuns === 4) batsmanEntry.fours += 1
    if (bRuns === 6) batsmanEntry.sixes += 1
    if (ball.isLegal && bRuns === 0 && !ball.isWicket) batsmanEntry.dots += 1
    batsmanEntry.strikeRate =
      batsmanEntry.balls > 0
        ? (batsmanEntry.runs / batsmanEntry.balls) * 100
        : 0

    // Striker dismissal
    if (isCountedWicket(ball) && ball.dismissedPlayerId === ball.batsmanId) {
      batsmanEntry.isOut = true
      batsmanEntry.dismissalType = ball.dismissalType
      batsmanEntry.dismissalText = ball.dismissalText ?? ""
    }
  }

  // Non-striker dismissal (e.g. run out at non-striker's end)
  if (
    isCountedWicket(ball) &&
    ball.dismissedPlayerId &&
    ball.dismissedPlayerId !== ball.batsmanId
  ) {
    const nonStrikerEntry = innings.battingCard.find(
      (e) => e.playerId === ball.dismissedPlayerId
    )
    if (nonStrikerEntry) {
      nonStrikerEntry.isOut = true
      nonStrikerEntry.dismissalType = ball.dismissalType
      nonStrikerEntry.dismissalText = ball.dismissalText ?? ""
    }
  }

  // 5. Fall of wicket — record when a counted wicket occurs
  if (isCountedWicket(ball) && ball.dismissedPlayerId) {
    const dismissed = innings.battingCard.find(
      (e) => e.playerId === ball.dismissedPlayerId
    )
    if (dismissed) {
      const legalSoFar = innings.ballLog.filter((b) => b.isLegal).length
      const completedOvers = Math.floor(legalSoFar / rules.ballsPerOver)
      const ballsInOver = legalSoFar % rules.ballsPerOver
      const oversStr =
        ballsInOver === 0
          ? String(completedOvers)
          : `${completedOvers}.${ballsInOver}`
      innings.fallOfWickets.push({
        wicketNumber: innings.totalWickets,
        score: innings.totalRuns,
        overs: oversStr,
        playerId: dismissed.playerId,
        playerName: dismissed.playerName,
        dismissalText: ball.dismissalText ?? "",
      })
    }
  }

  // 6. Bowler entry — recompute from scratch for accuracy
  const bowlerEntryIdx = innings.bowlingCard.findIndex(
    (e) => e.playerId === ball.bowlerId
  )
  if (bowlerEntryIdx !== -1) {
    const existing = innings.bowlingCard[bowlerEntryIdx]
    const recomputed = computeBowlerEntry(
      existing.playerId,
      existing.playerName,
      innings.ballLog,
      rules.ballsPerOver
    )
    innings.bowlingCard[bowlerEntryIdx] = recomputed
  }

  // 7. Check if over is complete
  const overCompleted = isOverComplete(
    innings.ballLog,
    ball.overNumber,
    rules
  )

  // 8. Update innings over counts
  if (ball.isLegal) {
    const legalBalls = innings.ballLog.filter((b) => b.isLegal).length
    innings.totalOvers = Math.floor(legalBalls / rules.ballsPerOver)
    innings.totalBalls = legalBalls % rules.ballsPerOver
    innings.totalLegalDeliveries = legalBalls
  }

  // Return all balls in the current over for display
  const overBalls = innings.ballLog.filter(
    (b) => b.overNumber === ball.overNumber
  )

  return { overCompleted, overBalls }
}

/**
 * Fully re-derive scoring state from the ball log of an innings.
 * Used by undo to rebuild everything from scratch.
 */
function rederiveStateFromInnings(
  innings: Innings,
  rules: { ballsPerOver: number }
): {
  overBalls: Ball[]
  lastOverBalls: Ball[]
  lastOverSummary: string
  oversBowledByBowler: Record<string, number>
  isFreeHit: boolean
} {
  const ballLog = innings.ballLog
  if (ballLog.length === 0) {
    return {
      overBalls: [],
      lastOverBalls: [],
      lastOverSummary: "",
      oversBowledByBowler: {},
      isFreeHit: false,
    }
  }

  const lastBall = ballLog[ballLog.length - 1]
  const isFreeHit = lastBall.nextIsFreeHit

  const lastOverNum = lastBall.overNumber
  const legalInLastOver = ballLog.filter(
    (b) => b.overNumber === lastOverNum && b.isLegal
  ).length
  const lastOverComplete = legalInLastOver >= rules.ballsPerOver

  let overBalls: Ball[]
  let lastOverBalls: Ball[]
  let lastOverSummary = ""

  if (lastOverComplete) {
    const completedBalls = ballLog.filter((b) => b.overNumber === lastOverNum)
    lastOverBalls = completedBalls
    lastOverSummary = completedBalls.length > 0 ? buildOverSummary(completedBalls) : ""
    overBalls = []
  } else {
    overBalls = ballLog.filter((b) => b.overNumber === lastOverNum)
    const completedOverNum = lastOverNum - 1
    if (completedOverNum >= 0) {
      lastOverBalls = ballLog.filter((b) => b.overNumber === completedOverNum)
      lastOverSummary = buildOverSummary(lastOverBalls)
    } else {
      lastOverBalls = []
    }
  }

  const oversBowledByBowler = getOversBowledByPlayer(ballLog, rules.ballsPerOver)

  return { overBalls, lastOverBalls, lastOverSummary, oversBowledByBowler, isFreeHit }
}

/**
 * Rebuild innings stats from scratch from the ball log.
 * Called by undoLastBall to recompute all aggregates.
 */
function rebuildInningsFromBallLog(innings: Innings, ballsPerOver: number): void {
  // Reset all counters
  innings.totalRuns = 0
  innings.totalWickets = 0
  innings.totalOvers = 0
  innings.totalBalls = 0
  innings.totalLegalDeliveries = 0
  innings.extras = { wide: 0, noBall: 0, bye: 0, legBye: 0, penalty: 0, total: 0 }
  innings.fallOfWickets = []

  // Reset batsman entries
  for (const entry of innings.battingCard) {
    entry.runs = 0
    entry.balls = 0
    entry.fours = 0
    entry.sixes = 0
    entry.dots = 0
    entry.strikeRate = 0
    entry.isOut = false
    entry.isRetiredHurt = false
    entry.dismissalType = undefined
    entry.dismissalText = "not out"
  }

  // Reset bowler entries
  for (let i = 0; i < innings.bowlingCard.length; i++) {
    const entry = innings.bowlingCard[i]
    innings.bowlingCard[i] = computeBowlerEntry(
      entry.playerId,
      entry.playerName,
      [], // empty — we'll recompute after
      ballsPerOver
    )
  }

  // Replay every ball in the log (O(n) — running counter avoids indexOf)
  let legalDeliveries = 0
  for (const ball of innings.ballLog) {
    const extraDelta = getExtraRuns(ball)
    innings.extras.wide += extraDelta.wide
    innings.extras.noBall += extraDelta.noBall
    innings.extras.bye += extraDelta.bye
    innings.extras.legBye += extraDelta.legBye
    innings.extras.penalty += extraDelta.penalty
    innings.extras.total += extraDelta.total

    innings.totalRuns += ball.runs
    if (isCountedWicket(ball)) innings.totalWickets += 1

    // Advance legal-delivery counter before FOW so overs string includes this ball
    if (ball.isLegal) legalDeliveries += 1

    const batsmanEntry = innings.battingCard.find(
      (e) => e.playerId === ball.batsmanId
    )
    if (batsmanEntry) {
      const bRuns = getBatsmanRuns(ball)
      batsmanEntry.runs += bRuns
      if (ball.isLegal) batsmanEntry.balls += 1
      if (bRuns === 4) batsmanEntry.fours += 1
      if (bRuns === 6) batsmanEntry.sixes += 1
      if (ball.isLegal && bRuns === 0 && !ball.isWicket) batsmanEntry.dots += 1
      batsmanEntry.strikeRate =
        batsmanEntry.balls > 0
          ? (batsmanEntry.runs / batsmanEntry.balls) * 100
          : 0

      if (isCountedWicket(ball) && ball.dismissedPlayerId === ball.batsmanId) {
        batsmanEntry.isOut = true
        batsmanEntry.dismissalType = ball.dismissalType
        batsmanEntry.dismissalText = ball.dismissalText ?? ""
      }
    }

    // Non-striker dismissal (e.g. run out at non-striker's end)
    if (
      isCountedWicket(ball) &&
      ball.dismissedPlayerId &&
      ball.dismissedPlayerId !== ball.batsmanId
    ) {
      const nonStrikerEntry = innings.battingCard.find(
        (e) => e.playerId === ball.dismissedPlayerId
      )
      if (nonStrikerEntry) {
        nonStrikerEntry.isOut = true
        nonStrikerEntry.dismissalType = ball.dismissalType
        nonStrikerEntry.dismissalText = ball.dismissalText ?? ""
      }
    }

    // Fall of wicket
    if (isCountedWicket(ball) && ball.dismissedPlayerId) {
      const dismissed = innings.battingCard.find(
        (e) => e.playerId === ball.dismissedPlayerId
      )
      if (dismissed) {
        const completedOvers = Math.floor(legalDeliveries / ballsPerOver)
        const rem = legalDeliveries % ballsPerOver
        const oversStr = rem === 0 ? String(completedOvers) : `${completedOvers}.${rem}`
        innings.fallOfWickets.push({
          wicketNumber: innings.totalWickets,
          score: innings.totalRuns,
          overs: oversStr,
          playerId: dismissed.playerId,
          playerName: dismissed.playerName,
          dismissalText: ball.dismissalText ?? "",
        })
      }
    }

    if (ball.isLegal) {
      innings.totalOvers = Math.floor(legalDeliveries / ballsPerOver)
      innings.totalBalls = legalDeliveries % ballsPerOver
      innings.totalLegalDeliveries = legalDeliveries
    }
  }

  // Recompute all bowler entries at the end
  for (let i = 0; i < innings.bowlingCard.length; i++) {
    const entry = innings.bowlingCard[i]
    innings.bowlingCard[i] = computeBowlerEntry(
      entry.playerId,
      entry.playerName,
      innings.ballLog,
      ballsPerOver
    )
  }
}

// ─── Initial state ────────────────────────────────────────────────────────────

const initialState: ScoringState = {
  matchId: null,
  match: null,
  currentInningsIndex: 0,
  onStrikeBatsmanId: null,
  offStrikeBatsmanId: null,
  currentBowlerId: null,
  isFreeHit: false,
  overBalls: [],
  lastOverBalls: [],
  lastOverSummary: "",
  oversBowledByBowler: {},
  isProcessing: false,
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useScoringStore = create<ScoringState & ScoringActions>()(
  (set, get) => ({
    ...initialState,

    // ── recordBall ──────────────────────────────────────────────────────────

    recordBall: async (ball: Ball) => {
      const state = get()
      if (state.isProcessing || !state.match) return

      set({ isProcessing: true })

      try {
        // Deep-clone match to avoid mutating Zustand state directly
        const match: Match = structuredClone(state.match)
        const inningsIndex = state.currentInningsIndex
        const innings = match.innings[inningsIndex]
        const rules = match.rules

        const { overCompleted, overBalls } = applyBallToMatch(
          match,
          inningsIndex,
          ball
        )

        // Update free hit flag
        const isFreeHit = ball.nextIsFreeHit

        // Over management
        let newOverBalls: Ball[]
        let lastOverSummary = state.lastOverSummary
        let newBowlerId = state.currentBowlerId

        let newLastOverBalls = state.lastOverBalls
        if (overCompleted) {
          // Store the balls from the just-completed over for the bowler sheet
          newLastOverBalls = overBalls
          lastOverSummary = buildOverSummary(overBalls)
          newOverBalls = []
          // Bowler needs to change — clear currentBowlerId to force selection
          newBowlerId = null
        } else {
          newOverBalls = overBalls
        }

        // Strike rotation
        let onStrike = state.onStrikeBatsmanId
        let offStrike = state.offStrikeBatsmanId

        const swapForRuns = shouldSwapStrikeAfterBall(ball, rules.wideRuns)
        if (swapForRuns) {
          ;[onStrike, offStrike] = [offStrike, onStrike]
        }
        if (overCompleted && shouldSwapStrikeEndOfOver()) {
          ;[onStrike, offStrike] = [offStrike, onStrike]
        }

        // If batsman is out, onStrike will be null until next batsman is set
        if (
          isCountedWicket(ball) &&
          ball.dismissedPlayerId === state.onStrikeBatsmanId
        ) {
          onStrike = null
        } else if (
          isCountedWicket(ball) &&
          ball.dismissedPlayerId === state.offStrikeBatsmanId
        ) {
          offStrike = null
        }

        // Completed overs per bowler
        const oversBowledByBowler = getOversBowledByPlayer(
          innings.ballLog,
          rules.ballsPerOver
        )

        // Persist to Dexie
        await db.matches.put(match)

        set({
          match,
          currentInningsIndex: inningsIndex,
          onStrikeBatsmanId: onStrike,
          offStrikeBatsmanId: offStrike,
          currentBowlerId: newBowlerId,
          isFreeHit,
          overBalls: newOverBalls,
          lastOverBalls: newLastOverBalls,
          lastOverSummary,
          oversBowledByBowler,
          isProcessing: false,
        })
      } catch (err) {
        set({ isProcessing: false })
        throw err
      }
    },

    // ── undoLastBall ────────────────────────────────────────────────────────

    undoLastBall: async () => {
      const state = get()
      if (state.isProcessing || !state.match) return

      const inningsIndex = state.currentInningsIndex
      const innings = state.match.innings[inningsIndex]

      if (!innings || innings.ballLog.length === 0) return

      set({ isProcessing: true })

      try {
        // Deep-clone and pop last ball
        const match: Match = structuredClone(state.match)
        const targetInnings = match.innings[inningsIndex]
        const poppedBall = targetInnings.ballLog.pop()

        if (!poppedBall) {
          set({ isProcessing: false })
          return
        }

        // Rebuild all stats from the remaining ball log
        rebuildInningsFromBallLog(targetInnings, match.rules.ballsPerOver)

        // Re-derive store display state from the remaining log
        const derived = rederiveStateFromInnings(targetInnings, match.rules)

        // Re-derive strike: the batsman who faced the popped ball is back on strike
        let onStrike = state.onStrikeBatsmanId
        let offStrike = state.offStrikeBatsmanId

        // Reverse the strike swap that was caused by the popped ball
        const wasSwappedForRuns = shouldSwapStrikeAfterBall(poppedBall, match.rules.wideRuns)
        const wasEndOfOver = isOverComplete(
          [...targetInnings.ballLog, poppedBall], // log before pop
          poppedBall.overNumber,
          match.rules
        )

        if (wasEndOfOver && shouldSwapStrikeEndOfOver()) {
          ;[onStrike, offStrike] = [offStrike, onStrike]
        }
        if (wasSwappedForRuns) {
          ;[onStrike, offStrike] = [offStrike, onStrike]
        }

        // If the popped ball was a wicket, restore dismissed batsman
        if (isCountedWicket(poppedBall) && poppedBall.dismissedPlayerId) {
          if (poppedBall.dismissedPlayerId === poppedBall.batsmanId) {
            // Striker was dismissed — restore them on strike
            onStrike = poppedBall.batsmanId
          } else {
            // Non-striker was dismissed (e.g. run out) — restore them off strike
            offStrike = poppedBall.dismissedPlayerId
          }
        }

        // Restore bowler: if the popped ball was the first of a new over
        // the previous bowler needs restoring. Use bowlerId from the popped ball.
        const newBowlerId = poppedBall.bowlerId

        // Persist
        await db.matches.put(match)

        set({
          match,
          onStrikeBatsmanId: onStrike,
          offStrikeBatsmanId: offStrike,
          currentBowlerId: newBowlerId,
          isFreeHit: derived.isFreeHit,
          overBalls: derived.overBalls,
          lastOverBalls: derived.lastOverBalls,
          lastOverSummary: derived.lastOverSummary,
          oversBowledByBowler: derived.oversBowledByBowler,
          isProcessing: false,
        })
      } catch (err) {
        set({ isProcessing: false })
        throw err
      }
    },

    // ── undoNBalls ──────────────────────────────────────────────────────────

    undoNBalls: async (n: number) => {
      for (let i = 0; i < n; i++) {
        await get().undoLastBall()
      }
    },

    // ── swapStrike ──────────────────────────────────────────────────────────

    swapStrike: () => {
      const { onStrikeBatsmanId, offStrikeBatsmanId } = get()
      set({
        onStrikeBatsmanId: offStrikeBatsmanId,
        offStrikeBatsmanId: onStrikeBatsmanId,
      })
    },

    // ── loadMatch ───────────────────────────────────────────────────────────

    loadMatch: async (matchId: string) => {
      const match = await db.matches.get(matchId)
      if (!match) throw new Error(`Match ${matchId} not found in DB`)

      const inningsIndex = match.currentInningsIndex
      const innings = match.innings[inningsIndex]

      // Derive current scoring context from the ball log
      const derived = innings
        ? rederiveStateFromInnings(innings, match.rules)
        : {
            overBalls: [],
            lastOverBalls: [],
            lastOverSummary: "",
            oversBowledByBowler: {},
            isFreeHit: false,
          }

      // Try to infer active batsmen from the batting card
      const activeBatsmen = innings
        ? innings.battingCard.filter((e) => !e.isOut && !e.isRetiredHurt)
        : []

      // The last ball tells us who was on strike
      const ballLog = innings?.ballLog ?? []
      const lastBall = ballLog[ballLog.length - 1]

      let onStrike: string | null = null
      let offStrike: string | null = null
      let currentBowlerId: string | null = lastBall?.bowlerId ?? null

      if (lastBall) {
        // After last ball, determine if strike swapped
        const swapped = shouldSwapStrikeAfterBall(lastBall, match.rules.wideRuns)
        const overDone = isOverComplete(ballLog, lastBall.overNumber, match.rules)

        // Start with who faced the last ball
        let striker: string | null = lastBall.batsmanId
        let nonStriker = activeBatsmen.find((b) => b.playerId !== striker)?.playerId ?? null

        if (swapped) [striker, nonStriker] = [nonStriker ?? striker, striker]
        if (overDone && shouldSwapStrikeEndOfOver()) {
          ;[striker, nonStriker] = [nonStriker ?? striker, striker]
          currentBowlerId = null // Force new bowler selection after over
        }

        // If striker was dismissed on the last ball, they're no longer active —
        // find the real on-strike batter from the active list
        if (striker && !activeBatsmen.find((b) => b.playerId === striker)) {
          striker = activeBatsmen.find((b) => b.playerId !== nonStriker)?.playerId ?? null
        }

        onStrike = striker
        offStrike = nonStriker
      } else if (activeBatsmen.length >= 2) {
        onStrike = activeBatsmen[0].playerId
        offStrike = activeBatsmen[1].playerId
      } else if (activeBatsmen.length === 1) {
        onStrike = activeBatsmen[0].playerId
      }

      set({
        matchId,
        match,
        currentInningsIndex: inningsIndex,
        onStrikeBatsmanId: onStrike,
        offStrikeBatsmanId: offStrike,
        currentBowlerId,
        isFreeHit: derived.isFreeHit,
        overBalls: derived.overBalls,
        lastOverBalls: derived.lastOverBalls,
        lastOverSummary: derived.lastOverSummary,
        oversBowledByBowler: derived.oversBowledByBowler,
        isProcessing: false,
      })
    },

    // ── clearSession ────────────────────────────────────────────────────────

    clearSession: () => {
      set({ ...initialState })
    },
  })
)
