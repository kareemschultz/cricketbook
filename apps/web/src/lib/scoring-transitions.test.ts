import { describe, it, expect } from "vitest"
import {
  applyBallToMatch,
  rebuildInningsFromBallLog,
  rederiveStateFromInnings,
  ballToken,
  buildOverSummary,
  isCountedWicket,
} from "./scoring-transitions"
import type { Ball, Innings, Match, MatchRules, BatsmanEntry, BowlerEntry } from "@/types/cricket"

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const RULES: MatchRules = {
  oversPerInnings: 20,
  maxOversPerBowler: 4,
  ballsPerOver: 6,
  maxWickets: 10,
  wideReball: true,
  noBallReball: true,
  wideRuns: 1,
  noBallRuns: 1,
  freeHitOnNoBall: true,
  legByesEnabled: true,
  byesEnabled: true,
  lastManStands: false,
  superOverOnTie: true,
  retiredHurtCanReturn: true,
  penaltyRunsEnabled: true,
  inningsPerSide: 1,
  powerplayEnabled: true,
  powerplayOvers: 6,
}

function makeBall(overrides: Partial<Ball> = {}): Ball {
  return {
    id: `b-${Math.random()}`,
    inningsIndex: 0,
    overNumber: 0,
    ballInOver: 0,
    deliveryNumber: 0,
    batsmanId: "bat1",
    bowlerId: "bowl1",
    runs: 0,
    batsmanRuns: 0,
    extraRuns: 0,
    isExtra: false,
    isLegal: true,
    isWicket: false,
    isFreeHit: false,
    nextIsFreeHit: false,
    isNoBallBatRuns: false,
    powerplay: false,
    timestamp: new Date(),
    ...overrides,
  }
}

function makeBatsmanEntry(playerId: string, position = 1): BatsmanEntry {
  return {
    playerId,
    playerName: playerId,
    position,
    runs: 0,
    balls: 0,
    fours: 0,
    sixes: 0,
    dots: 0,
    strikeRate: 0,
    isOut: false,
    isRetiredHurt: false,
    dismissalText: "not out",
  }
}

function makeBowlerEntry(playerId: string): BowlerEntry {
  return {
    playerId,
    playerName: playerId,
    overs: 0,
    balls: 0,
    maidens: 0,
    runs: 0,
    wickets: 0,
    economy: 0,
    dots: 0,
    wides: 0,
    noBalls: 0,
    legalDeliveries: 0,
  }
}

function makeInnings(overrides: Partial<Innings> = {}): Innings {
  return {
    index: 0,
    battingTeamId: "t1",
    bowlingTeamId: "t2",
    status: "live",
    currentStrikerId: "bat1",
    currentNonStrikerId: "bat2",
    currentBowlerId: "bowl1",
    totalRuns: 0,
    totalWickets: 0,
    totalOvers: 0,
    totalBalls: 0,
    totalLegalDeliveries: 0,
    extras: { wide: 0, noBall: 0, bye: 0, legBye: 0, penalty: 0, total: 0 },
    battingCard: [makeBatsmanEntry("bat1", 1), makeBatsmanEntry("bat2", 2)],
    bowlingCard: [makeBowlerEntry("bowl1")],
    ballLog: [],
    fallOfWickets: [],
    partnerships: [],
    isDeclared: false,
    ...overrides,
  }
}

function makeMatch(innings: Innings[] = [makeInnings()]): Match {
  return {
    id: "match1",
    format: "T20",
    rules: RULES,
    team1Id: "t1",
    team2Id: "t2",
    team1Name: "Team 1",
    team2Name: "Team 2",
    playingXI1: ["bat1", "bat2"],
    playingXI2: ["bowl1"],
    tossWonBy: "t1",
    tossDecision: "bat",
    innings,
    currentInningsIndex: 0,
    date: new Date(),
    status: "live",
    isSuperOver: false,
  }
}

// ─── ballToken ────────────────────────────────────────────────────────────────

describe("ballToken", () => {
  it("returns 'W' for wicket", () => {
    expect(ballToken(makeBall({ isWicket: true, runs: 0 }))).toBe("W")
  })

  it("returns 'wd' for wide", () => {
    expect(ballToken(makeBall({ extraType: "wide", runs: 1 }))).toBe("wd")
  })

  it("returns 'nb' for no-ball", () => {
    expect(ballToken(makeBall({ extraType: "noBall", runs: 1 }))).toBe("nb")
  })

  it("returns '4' for boundary", () => {
    expect(ballToken(makeBall({ runs: 4, batsmanRuns: 4 }))).toBe("4")
  })

  it("returns '6' for six", () => {
    expect(ballToken(makeBall({ runs: 6, batsmanRuns: 6 }))).toBe("6")
  })

  it("returns '0' for dot ball", () => {
    expect(ballToken(makeBall({ runs: 0 }))).toBe("0")
  })

  it("returns string run count for 1-3 runs", () => {
    expect(ballToken(makeBall({ runs: 1, batsmanRuns: 1 }))).toBe("1")
    expect(ballToken(makeBall({ runs: 3, batsmanRuns: 3 }))).toBe("3")
  })
})

// ─── buildOverSummary ─────────────────────────────────────────────────────────

describe("buildOverSummary", () => {
  it("builds summary string with total", () => {
    const balls = [
      makeBall({ runs: 0 }),
      makeBall({ runs: 4, batsmanRuns: 4 }),
      makeBall({ runs: 0 }),
      makeBall({ isWicket: true, runs: 0 }),
      makeBall({ runs: 1, batsmanRuns: 1 }),
      makeBall({ runs: 2, batsmanRuns: 2 }),
    ]
    expect(buildOverSummary(balls)).toBe("0 4 0 W 1 2 = 7")
  })

  it("handles over with all dots", () => {
    const balls = Array.from({ length: 6 }, () => makeBall({ runs: 0 }))
    expect(buildOverSummary(balls)).toBe("0 0 0 0 0 0 = 0")
  })
})

// ─── isCountedWicket ──────────────────────────────────────────────────────────

describe("isCountedWicket", () => {
  it("returns true for bowled", () => {
    expect(isCountedWicket(makeBall({ isWicket: true, dismissalType: "bowled" }))).toBe(true)
  })

  it("returns true for run out (counted in WICKET_DISMISSALS)", () => {
    expect(isCountedWicket(makeBall({ isWicket: true, dismissalType: "runOut" }))).toBe(true)
  })

  it("returns false for retiredHurt (NOT in WICKET_DISMISSALS)", () => {
    expect(isCountedWicket(makeBall({ isWicket: true, dismissalType: "retiredHurt" }))).toBe(false)
  })

  it("returns false when isWicket is false", () => {
    expect(isCountedWicket(makeBall({ isWicket: false, dismissalType: "bowled" }))).toBe(false)
  })
})

// ─── applyBallToMatch ─────────────────────────────────────────────────────────

describe("applyBallToMatch", () => {
  it("increments innings total runs", () => {
    const match = makeMatch()
    const ball = makeBall({ runs: 4, batsmanRuns: 4 })
    applyBallToMatch(match, 0, ball)
    expect(match.innings[0].totalRuns).toBe(4)
  })

  it("increments batsman entry runs and balls", () => {
    const match = makeMatch()
    const ball = makeBall({ batsmanId: "bat1", runs: 3, batsmanRuns: 3, isLegal: true })
    applyBallToMatch(match, 0, ball)
    const entry = match.innings[0].battingCard.find((e) => e.playerId === "bat1")!
    expect(entry.runs).toBe(3)
    expect(entry.balls).toBe(1)
  })

  it("does not increment balls for illegal delivery (wide)", () => {
    const match = makeMatch()
    const ball = makeBall({ runs: 1, batsmanRuns: 0, extraRuns: 1, isExtra: true, extraType: "wide", isLegal: false })
    applyBallToMatch(match, 0, ball)
    const entry = match.innings[0].battingCard.find((e) => e.playerId === "bat1")!
    expect(entry.balls).toBe(0)
    expect(match.innings[0].extras.wide).toBe(1)
  })

  it("increments wickets for counted dismissal", () => {
    const match = makeMatch()
    const ball = makeBall({
      batsmanId: "bat1",
      isWicket: true,
      dismissalType: "bowled",
      dismissedPlayerId: "bat1",
    })
    applyBallToMatch(match, 0, ball)
    expect(match.innings[0].totalWickets).toBe(1)
    const entry = match.innings[0].battingCard.find((e) => e.playerId === "bat1")!
    expect(entry.isOut).toBe(true)
  })

  it("does not increment wickets for retiredHurt", () => {
    const match = makeMatch()
    const ball = makeBall({
      batsmanId: "bat1",
      isWicket: true,
      dismissalType: "retiredHurt",
      dismissedPlayerId: "bat1",
    })
    applyBallToMatch(match, 0, ball)
    expect(match.innings[0].totalWickets).toBe(0)
  })

  it("materializes a missing bowler entry when a ball is recorded", () => {
    const match = makeMatch([makeInnings({ bowlingCard: [] })])
    const ball = makeBall({ bowlerId: "bowl9", runs: 1, batsmanRuns: 1 })

    applyBallToMatch(match, 0, ball)

    expect(match.innings[0].bowlingCard).toHaveLength(1)
    expect(match.innings[0].bowlingCard[0]?.playerId).toBe("bowl9")
    expect(match.innings[0].bowlingCard[0]?.runs).toBe(1)
  })

  it("adds fall of wicket entry with correct score and overs", () => {
    const match = makeMatch()
    // Apply 7 legal balls (1 over + 1 ball) then a wicket
    const prevBalls = Array.from({ length: 7 }, (_, i) =>
      makeBall({ overNumber: i < 6 ? 0 : 1, isLegal: true, deliveryNumber: i, runs: 1, batsmanRuns: 1 })
    )
    match.innings[0].ballLog = prevBalls
    match.innings[0].totalLegalDeliveries = 7
    match.innings[0].totalRuns = 7

    const wicketBall = makeBall({
      overNumber: 1,
      isLegal: true,
      isWicket: true,
      dismissalType: "bowled",
      dismissedPlayerId: "bat1",
      batsmanId: "bat1",
      runs: 0,
      deliveryNumber: 7,
    })
    applyBallToMatch(match, 0, wicketBall)

    const fow = match.innings[0].fallOfWickets[0]
    expect(fow.wicketNumber).toBe(1)
    expect(fow.score).toBe(7)
    expect(fow.overs).toBe("1.2") // 8 legal balls = 1 over + 2 balls
  })

  it("reports overCompleted=true after 6th legal ball", () => {
    const match = makeMatch()
    // Apply 5 balls first
    for (let i = 0; i < 5; i++) {
      const b = makeBall({ overNumber: 0, isLegal: true, deliveryNumber: i })
      applyBallToMatch(match, 0, b)
    }
    // 6th legal ball should complete the over
    const sixth = makeBall({ overNumber: 0, isLegal: true, deliveryNumber: 5 })
    const { overCompleted } = applyBallToMatch(match, 0, sixth)
    expect(overCompleted).toBe(true)
  })

  it("reports overCompleted=false when fewer than 6 legal balls", () => {
    const match = makeMatch()
    const { overCompleted } = applyBallToMatch(match, 0, makeBall({ isLegal: true }))
    expect(overCompleted).toBe(false)
  })

  it("wide does not complete an over", () => {
    const match = makeMatch()
    // 5 legal + 1 wide should NOT complete the over
    for (let i = 0; i < 5; i++) applyBallToMatch(match, 0, makeBall({ overNumber: 0, isLegal: true }))
    const wide = makeBall({ overNumber: 0, isLegal: false, isExtra: true, extraType: "wide" })
    const { overCompleted } = applyBallToMatch(match, 0, wide)
    expect(overCompleted).toBe(false)
  })

  it("updates totalLegalDeliveries incrementally", () => {
    const match = makeMatch()
    applyBallToMatch(match, 0, makeBall({ isLegal: true }))
    applyBallToMatch(match, 0, makeBall({ isLegal: true }))
    applyBallToMatch(match, 0, makeBall({ isLegal: false, extraType: "wide", isExtra: true }))
    expect(match.innings[0].totalLegalDeliveries).toBe(2)
  })
})

// ─── rebuildInningsFromBallLog ────────────────────────────────────────────────

describe("rebuildInningsFromBallLog", () => {
  it("empty log produces all-zero state", () => {
    const innings = makeInnings()
    rebuildInningsFromBallLog(innings, 6)
    expect(innings.totalRuns).toBe(0)
    expect(innings.totalWickets).toBe(0)
    expect(innings.totalLegalDeliveries).toBe(0)
    expect(innings.extras.total).toBe(0)
    expect(innings.fallOfWickets).toHaveLength(0)
  })

  it("rebuild matches applyBallToMatch for same sequence", () => {
    // Build with applyBallToMatch
    const match1 = makeMatch()
    const balls = [
      makeBall({ runs: 4, batsmanRuns: 4, isLegal: true, overNumber: 0 }),
      makeBall({ runs: 1, batsmanRuns: 1, isLegal: true, overNumber: 0 }),
      makeBall({ runs: 0, isLegal: false, isExtra: true, extraType: "wide", batsmanRuns: 0, extraRuns: 1 }),
      makeBall({ runs: 0, isLegal: true, overNumber: 0 }),
    ]
    for (const b of balls) applyBallToMatch(match1, 0, b)

    // Rebuild from ball log
    const innings2 = makeInnings({ ballLog: [...balls] })
    rebuildInningsFromBallLog(innings2, 6)

    expect(innings2.totalRuns).toBe(match1.innings[0].totalRuns)
    expect(innings2.extras.wide).toBe(match1.innings[0].extras.wide)
    expect(innings2.totalWickets).toBe(match1.innings[0].totalWickets)
    expect(innings2.totalLegalDeliveries).toBe(match1.innings[0].totalLegalDeliveries)
  })

  it("rebuild correctly resets and recomputes batsman stats", () => {
    const ball1 = makeBall({ batsmanId: "bat1", runs: 6, batsmanRuns: 6, isLegal: true })
    const ball2 = makeBall({ batsmanId: "bat1", runs: 4, batsmanRuns: 4, isLegal: true })
    const innings = makeInnings({ ballLog: [ball1, ball2] })
    rebuildInningsFromBallLog(innings, 6)
    const bat1 = innings.battingCard.find((e) => e.playerId === "bat1")!
    expect(bat1.runs).toBe(10)
    expect(bat1.balls).toBe(2)
    expect(bat1.sixes).toBe(1)
    expect(bat1.fours).toBe(1)
  })

  it("undo-like scenario: rebuild after popping last ball", () => {
    const balls = [
      makeBall({ runs: 4, batsmanRuns: 4, isLegal: true }),
      makeBall({ runs: 1, batsmanRuns: 1, isLegal: true }),
      makeBall({ runs: 6, batsmanRuns: 6, isLegal: true }),
    ]
    const innings = makeInnings({ ballLog: [...balls] })
    // Simulate undo: pop last ball then rebuild
    innings.ballLog.pop()
    rebuildInningsFromBallLog(innings, 6)
    expect(innings.totalRuns).toBe(5) // 4 + 1, not 11
    expect(innings.totalLegalDeliveries).toBe(2)
  })
})

// ─── rederiveStateFromInnings ─────────────────────────────────────────────────

describe("rederiveStateFromInnings", () => {
  it("empty innings returns all-empty state", () => {
    const innings = makeInnings()
    const state = rederiveStateFromInnings(innings, { ballsPerOver: 6 })
    expect(state.overBalls).toHaveLength(0)
    expect(state.lastOverBalls).toHaveLength(0)
    expect(state.lastOverSummary).toBe("")
    expect(state.oversBowledByBowler).toEqual({})
    expect(state.isFreeHit).toBe(false)
  })

  it("partial over: overBalls = current over balls", () => {
    const balls = [
      makeBall({ overNumber: 0, isLegal: true, nextIsFreeHit: false }),
      makeBall({ overNumber: 0, isLegal: true, nextIsFreeHit: false }),
    ]
    const innings = makeInnings({ ballLog: balls })
    const state = rederiveStateFromInnings(innings, { ballsPerOver: 6 })
    expect(state.overBalls).toHaveLength(2)
    expect(state.lastOverBalls).toHaveLength(0)
  })

  it("completed over: overBalls=[] and lastOverBalls = completed over", () => {
    const balls = Array.from({ length: 6 }, (_, i) =>
      makeBall({ overNumber: 0, isLegal: true, deliveryNumber: i, nextIsFreeHit: false })
    )
    const innings = makeInnings({ ballLog: balls })
    const state = rederiveStateFromInnings(innings, { ballsPerOver: 6 })
    expect(state.overBalls).toHaveLength(0)
    expect(state.lastOverBalls).toHaveLength(6)
    expect(state.lastOverSummary).toMatch(/= 0$/)
  })

  it("isFreeHit reflects last ball's nextIsFreeHit", () => {
    const balls = [
      makeBall({ isLegal: false, extraType: "noBall", nextIsFreeHit: true }),
    ]
    const innings = makeInnings({ ballLog: balls })
    const state = rederiveStateFromInnings(innings, { ballsPerOver: 6 })
    expect(state.isFreeHit).toBe(true)
  })

  it("oversBowledByBowler reflects completed overs", () => {
    const balls = Array.from({ length: 12 }, (_, i) =>
      makeBall({
        bowlerId: i < 6 ? "bowl1" : "bowl2",
        overNumber: i < 6 ? 0 : 1,
        isLegal: true,
        deliveryNumber: i,
      })
    )
    const innings = makeInnings({ ballLog: balls })
    const state = rederiveStateFromInnings(innings, { ballsPerOver: 6 })
    expect(state.oversBowledByBowler["bowl1"]).toBe(1)
    expect(state.oversBowledByBowler["bowl2"]).toBe(1)
  })
})
