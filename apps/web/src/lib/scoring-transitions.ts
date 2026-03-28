import type { Ball, Match, Innings } from "@/types/cricket"
import { WICKET_DISMISSALS } from "@/types/cricket"
import {
  getBatsmanRuns,
  getExtraRuns,
  getOversBowledByPlayer,
  computeBowlerEntry,
} from "@/lib/cricket-engine"

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Derive ball summary token for over display (e.g. "0", "1", "4", "6", "W", "wd", "nb") */
export function ballToken(ball: Ball): string {
  if (ball.isWicket) return "W"
  if (ball.extraType === "wide") return "wd"
  if (ball.extraType === "noBall") return "nb"
  if (ball.runs === 4) return "4"
  if (ball.runs === 6) return "6"
  if (ball.runs === 0) return "0"
  return String(ball.runs)
}

/** Build a summary string for a completed over, e.g. "0 1 4 W 1 2 = 8" */
export function buildOverSummary(balls: Ball[]): string {
  const tokens = balls.map(ballToken).join(" ")
  const total = balls.reduce((sum, b) => sum + b.runs, 0)
  return `${tokens} = ${total}`
}

/** Determine whether a dismissal counts as a wicket in the bowling/batting tallies */
export function isCountedWicket(ball: Ball): boolean {
  return (
    ball.isWicket &&
    !!ball.dismissalType &&
    WICKET_DISMISSALS.includes(ball.dismissalType)
  )
}

// ─── Pure transition functions ────────────────────────────────────────────────

/**
 * Apply one ball's worth of stat changes directly to a Match (mutates a deep
 * clone that the caller provides). Returns whether the over completed.
 */
export function applyBallToMatch(
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

  // 5. Fall of wicket — use incremental legal-ball count instead of full scan
  // Compute running legal-delivery count from the already-maintained counter
  const legalSoFar = (innings.totalLegalDeliveries ?? 0) + (ball.isLegal ? 1 : 0)

  if (isCountedWicket(ball) && ball.dismissedPlayerId) {
    const dismissed = innings.battingCard.find(
      (e) => e.playerId === ball.dismissedPlayerId
    )
    if (dismissed) {
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
  } else {
    innings.bowlingCard.push(
      computeBowlerEntry(
        ball.bowlerId,
        ball.bowlerId,
        innings.ballLog,
        rules.ballsPerOver
      )
    )
  }

  // 7. Check if over is complete — count legal balls in this over from tail of log
  //    instead of scanning the entire ball log
  let legalInCurrentOver = 0
  for (let i = innings.ballLog.length - 1; i >= 0; i--) {
    const b = innings.ballLog[i]
    if (b.overNumber !== ball.overNumber) break
    if (b.isLegal) legalInCurrentOver++
  }
  const overCompleted = legalInCurrentOver >= rules.ballsPerOver

  // 8. Update innings over counts incrementally
  if (ball.isLegal) {
    innings.totalOvers = Math.floor(legalSoFar / rules.ballsPerOver)
    innings.totalBalls = legalSoFar % rules.ballsPerOver
    innings.totalLegalDeliveries = legalSoFar
  }

  // Return balls in the current over — scan only the tail of the log
  const overBalls: Ball[] = []
  for (let i = innings.ballLog.length - 1; i >= 0; i--) {
    if (innings.ballLog[i].overNumber !== ball.overNumber) break
    overBalls.push(innings.ballLog[i])
  }
  overBalls.reverse()

  return { overCompleted, overBalls }
}

/**
 * Fully re-derive scoring state from the ball log of an innings.
 * Used by undo to rebuild everything from scratch.
 */
export function rederiveStateFromInnings(
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
export function rebuildInningsFromBallLog(innings: Innings, ballsPerOver: number): void {
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

  const existingBowlerNames = new Map(
    innings.bowlingCard.map((entry) => [entry.playerId, entry.playerName])
  )
  innings.bowlingCard = [...new Set(innings.ballLog.map((ball) => ball.bowlerId))].map(
    (playerId) =>
      computeBowlerEntry(
        playerId,
        existingBowlerNames.get(playerId) ?? playerId,
        innings.ballLog,
        ballsPerOver
      )
  )
}
