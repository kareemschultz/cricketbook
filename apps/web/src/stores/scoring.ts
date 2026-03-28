import { create } from "zustand"
import { db } from "@/db/index"
import type { Ball, Match } from "@/types/cricket"
import {
  shouldSwapStrikeAfterBall,
  shouldSwapStrikeEndOfOver,
  isOverComplete,
  getOversBowledByPlayer,
} from "@/lib/cricket-engine"
import {
  applyBallToMatch,
  rebuildInningsFromBallLog,
  rederiveStateFromInnings,
  buildOverSummary,
  isCountedWicket,
} from "@/lib/scoring-transitions"

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
      if (!match) {
        throw new Error(`Match ${matchId} not found in DB`)
      }

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
      })
    },

    // ── clearSession ────────────────────────────────────────────────────────

    clearSession: () => {
      set({ ...initialState })
    },
  })
)
