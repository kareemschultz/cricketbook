import { describe, it, expect } from "vitest"
import {
  formatOvers,
  parsedOvers,
  isLegalDelivery,
  isOverComplete,
  getBatsmanRuns,
  getBowlerRuns,
  shouldSwapStrikeAfterBall,
  isMaidenOver,
  canBowl,
  getRemainingBalls,
  getRequiredRunRate,
  getCurrentRunRate,
  getCurrentPartnership,
  buildDismissalText,
  isTied,
  isInningsComplete,
  computeBowlerEntry,
  getExtraRuns,
  getOversBowledByPlayer,
  createBall,
  buildResultString,
  isInPowerplay,
  getTarget,
  shouldSwapStrikeEndOfOver,
} from "./cricket-engine"
import type { Ball, Innings, MatchRules } from "@/types/cricket"
import type { BallInput } from "./cricket-engine"

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_RULES: MatchRules = {
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
    id: "test-id",
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

// ─── formatOvers ──────────────────────────────────────────────────────────────

describe("formatOvers", () => {
  it("returns whole number for complete overs", () => {
    expect(formatOvers(6)).toBe("1")   // 6 balls = 1 over
    expect(formatOvers(12)).toBe("2")  // 12 balls = 2 overs
    expect(formatOvers(36)).toBe("6")  // 36 balls = 6 overs
    expect(formatOvers(0)).toBe("0")
  })

  it("returns over.ball notation for partial overs", () => {
    expect(formatOvers(7)).toBe("1.1")
    expect(formatOvers(10)).toBe("1.4")
    expect(formatOvers(98)).toBe("16.2")
  })

  it("respects custom ballsPerOver", () => {
    expect(formatOvers(8, 8)).toBe("1")
    expect(formatOvers(9, 8)).toBe("1.1")
  })
})

// ─── parsedOvers ──────────────────────────────────────────────────────────────

describe("parsedOvers", () => {
  it("parses whole over strings", () => {
    expect(parsedOvers("6")).toBe(36)
    expect(parsedOvers("20")).toBe(120)
    expect(parsedOvers("0")).toBe(0)
  })

  it("parses over.ball notation", () => {
    expect(parsedOvers("16.3")).toBe(99)  // 16*6+3
    expect(parsedOvers("1.1")).toBe(7)
    expect(parsedOvers("0.4")).toBe(4)
  })

  it("handles NaN/invalid gracefully", () => {
    expect(parsedOvers("")).toBe(0)
    expect(parsedOvers("abc")).toBe(0)
    expect(parsedOvers("abc.def")).toBe(0)
  })

  it("is inverse of formatOvers for round-trip", () => {
    for (const balls of [0, 1, 7, 35, 36, 99, 120]) {
      expect(parsedOvers(formatOvers(balls))).toBe(balls)
    }
  })
})

// ─── isLegalDelivery ──────────────────────────────────────────────────────────

describe("isLegalDelivery", () => {
  it("normal delivery is legal", () => {
    const ball = makeBall({ isExtra: false })
    expect(isLegalDelivery(ball, BASE_RULES)).toBe(true)
  })

  it("wide is NOT legal when wideReball=true", () => {
    const ball = makeBall({ isExtra: true, extraType: "wide", isLegal: false })
    expect(isLegalDelivery(ball, BASE_RULES)).toBe(false)
  })

  it("wide IS legal when wideReball=false", () => {
    const rules = { ...BASE_RULES, wideReball: false }
    const ball = makeBall({ isExtra: true, extraType: "wide", isLegal: true })
    expect(isLegalDelivery(ball, rules)).toBe(true)
  })

  it("no-ball is NOT legal when noBallReball=true", () => {
    const ball = makeBall({ isExtra: true, extraType: "noBall", isLegal: false })
    expect(isLegalDelivery(ball, BASE_RULES)).toBe(false)
  })

  it("bye is legal", () => {
    const ball = makeBall({ isExtra: true, extraType: "bye", isLegal: true })
    expect(isLegalDelivery(ball, BASE_RULES)).toBe(true)
  })

  it("leg bye is legal", () => {
    const ball = makeBall({ isExtra: true, extraType: "legBye", isLegal: true })
    expect(isLegalDelivery(ball, BASE_RULES)).toBe(true)
  })
})

// ─── isOverComplete ───────────────────────────────────────────────────────────

describe("isOverComplete", () => {
  it("returns false with fewer than 6 legal balls", () => {
    const log = Array.from({ length: 5 }, (_, i) =>
      makeBall({ overNumber: 0, isLegal: true, deliveryNumber: i })
    )
    expect(isOverComplete(log, 0, BASE_RULES)).toBe(false)
  })

  it("returns true with exactly 6 legal balls", () => {
    const log = Array.from({ length: 6 }, (_, i) =>
      makeBall({ overNumber: 0, isLegal: true, deliveryNumber: i })
    )
    expect(isOverComplete(log, 0, BASE_RULES)).toBe(true)
  })

  it("ignores illegal deliveries (wides) when counting", () => {
    const legal = Array.from({ length: 6 }, (_, i) =>
      makeBall({ overNumber: 0, isLegal: true, deliveryNumber: i })
    )
    const wide = makeBall({ overNumber: 0, isLegal: false, extraType: "wide", deliveryNumber: 6 })
    expect(isOverComplete([...legal, wide], 0, BASE_RULES)).toBe(true)
  })

  it("does not count balls from other overs", () => {
    const log = Array.from({ length: 6 }, (_, i) =>
      makeBall({ overNumber: 1, isLegal: true, deliveryNumber: i })
    )
    expect(isOverComplete(log, 0, BASE_RULES)).toBe(false)
  })
})

// ─── getBatsmanRuns / getBowlerRuns ───────────────────────────────────────────

describe("getBatsmanRuns", () => {
  it("returns batsmanRuns for normal delivery", () => {
    const ball = makeBall({ batsmanRuns: 4, runs: 4 })
    expect(getBatsmanRuns(ball)).toBe(4)
  })

  it("returns 0 for bye", () => {
    const ball = makeBall({ isExtra: true, extraType: "bye", batsmanRuns: 0, runs: 2 })
    expect(getBatsmanRuns(ball)).toBe(0)
  })

  it("returns 0 for leg bye", () => {
    const ball = makeBall({ isExtra: true, extraType: "legBye", batsmanRuns: 0, runs: 1 })
    expect(getBatsmanRuns(ball)).toBe(0)
  })

  it("returns 0 for wide", () => {
    const ball = makeBall({ isExtra: true, extraType: "wide", batsmanRuns: 0, runs: 1 })
    expect(getBatsmanRuns(ball)).toBe(0)
  })
})

describe("getBowlerRuns", () => {
  it("returns full runs for normal delivery", () => {
    const ball = makeBall({ runs: 4, batsmanRuns: 4 })
    expect(getBowlerRuns(ball)).toBe(4)
  })

  it("returns 0 for bye (not charged to bowler)", () => {
    const ball = makeBall({ isExtra: true, extraType: "bye", runs: 2, batsmanRuns: 0 })
    expect(getBowlerRuns(ball)).toBe(0)
  })

  it("returns 0 for leg bye (not charged to bowler)", () => {
    const ball = makeBall({ isExtra: true, extraType: "legBye", runs: 2, batsmanRuns: 0 })
    expect(getBowlerRuns(ball)).toBe(0)
  })

  it("returns runs for wide (charged to bowler)", () => {
    const ball = makeBall({ isExtra: true, extraType: "wide", runs: 1, batsmanRuns: 0 })
    expect(getBowlerRuns(ball)).toBe(1)
  })

  it("returns runs for no-ball (charged to bowler)", () => {
    const ball = makeBall({ isExtra: true, extraType: "noBall", runs: 1, batsmanRuns: 0 })
    expect(getBowlerRuns(ball)).toBe(1)
  })
})

// ─── shouldSwapStrikeAfterBall ────────────────────────────────────────────────

describe("shouldSwapStrikeAfterBall", () => {
  it("swaps for odd bat runs (1)", () => {
    expect(shouldSwapStrikeAfterBall(makeBall({ batsmanRuns: 1, runs: 1 }))).toBe(true)
  })

  it("swaps for odd bat runs (3)", () => {
    expect(shouldSwapStrikeAfterBall(makeBall({ batsmanRuns: 3, runs: 3 }))).toBe(true)
  })

  it("does NOT swap for even bat runs (0)", () => {
    expect(shouldSwapStrikeAfterBall(makeBall({ batsmanRuns: 0, runs: 0 }))).toBe(false)
  })

  it("does NOT swap for even bat runs (4)", () => {
    expect(shouldSwapStrikeAfterBall(makeBall({ batsmanRuns: 4, runs: 4 }))).toBe(false)
  })

  // ── Byes ───────────────────────────────────────────────────────────────────

  it("swaps for 1 bye (batters physically ran 1)", () => {
    const bye = makeBall({ isExtra: true, extraType: "bye", extraRuns: 1, batsmanRuns: 0, runs: 1 })
    expect(shouldSwapStrikeAfterBall(bye)).toBe(true)
  })

  it("does NOT swap for 2 byes (even running)", () => {
    const bye = makeBall({ isExtra: true, extraType: "bye", extraRuns: 2, batsmanRuns: 0, runs: 2 })
    expect(shouldSwapStrikeAfterBall(bye)).toBe(false)
  })

  it("swaps for 3 leg byes", () => {
    const lb = makeBall({ isExtra: true, extraType: "legBye", extraRuns: 3, batsmanRuns: 0, runs: 3 })
    expect(shouldSwapStrikeAfterBall(lb)).toBe(true)
  })

  // ── Wides ──────────────────────────────────────────────────────────────────

  it("does NOT swap for plain wide (penalty=1, no running, extraRuns=1)", () => {
    const wide = makeBall({ isExtra: true, extraType: "wide", extraRuns: 1, batsmanRuns: 0, runs: 1 })
    expect(shouldSwapStrikeAfterBall(wide, 1)).toBe(false)
  })

  it("swaps for wide + 1 extra run (extraRuns=2, 1 physical run)", () => {
    const wide = makeBall({ isExtra: true, extraType: "wide", extraRuns: 2, batsmanRuns: 0, runs: 2 })
    expect(shouldSwapStrikeAfterBall(wide, 1)).toBe(true)
  })

  it("does NOT swap for wide + 2 extra runs (extraRuns=3, 2 physical runs = even)", () => {
    const wide = makeBall({ isExtra: true, extraType: "wide", extraRuns: 3, batsmanRuns: 0, runs: 3 })
    expect(shouldSwapStrikeAfterBall(wide, 1)).toBe(false)
  })

  // ── No-balls ────────────────────────────────────────────────────────────────

  it("swaps for no-ball with 1 bat run", () => {
    const nb = makeBall({ isExtra: true, extraType: "noBall", batsmanRuns: 1, extraRuns: 1, runs: 2 })
    expect(shouldSwapStrikeAfterBall(nb)).toBe(true)
  })

  it("does NOT swap for no-ball with 0 bat runs", () => {
    const nb = makeBall({ isExtra: true, extraType: "noBall", batsmanRuns: 0, extraRuns: 1, runs: 1 })
    expect(shouldSwapStrikeAfterBall(nb)).toBe(false)
  })
})

// ─── isMaidenOver ─────────────────────────────────────────────────────────────

describe("isMaidenOver", () => {
  it("returns true for 6 dot balls", () => {
    const balls = Array.from({ length: 6 }, () => makeBall({ runs: 0, batsmanRuns: 0 }))
    expect(isMaidenOver(balls)).toBe(true)
  })

  it("returns false if any runs scored", () => {
    const balls = [
      ...Array.from({ length: 5 }, () => makeBall({ runs: 0 })),
      makeBall({ runs: 1, batsmanRuns: 1 }),
    ]
    expect(isMaidenOver(balls)).toBe(false)
  })

  it("returns false if wide included (not all legal)", () => {
    const balls = [
      ...Array.from({ length: 6 }, () => makeBall({ runs: 0, isLegal: true })),
      makeBall({ isExtra: true, extraType: "wide", runs: 1, isLegal: false }),
    ]
    expect(isMaidenOver(balls)).toBe(false)
  })
})

// ─── canBowl ──────────────────────────────────────────────────────────────────

describe("canBowl", () => {
  it("prevents consecutive bowling", () => {
    expect(canBowl("bowl1", "bowl1", {}, BASE_RULES)).toBe(false)
  })

  it("allows a different bowler", () => {
    expect(canBowl("bowl2", "bowl1", {}, BASE_RULES)).toBe(true)
  })

  it("blocks bowler at max overs", () => {
    expect(canBowl("bowl2", "bowl1", { bowl2: 4 }, BASE_RULES)).toBe(false)
  })

  it("allows bowler just under max overs", () => {
    expect(canBowl("bowl2", "bowl1", { bowl2: 3 }, BASE_RULES)).toBe(true)
  })

  it("allows unlimited when maxOversPerBowler is null", () => {
    const rules = { ...BASE_RULES, maxOversPerBowler: null }
    expect(canBowl("bowl2", "bowl1", { bowl2: 100 }, rules)).toBe(true)
  })
})

// ─── getRemainingBalls ────────────────────────────────────────────────────────

describe("getRemainingBalls", () => {
  const makeInnings = (legalBalls: number) => ({
    ballLog: Array.from({ length: legalBalls }, () => makeBall({ isLegal: true })),
  } as any)

  it("returns null for unlimited overs (Test)", () => {
    const rules = { ...BASE_RULES, oversPerInnings: null }
    expect(getRemainingBalls(makeInnings(0), rules)).toBeNull()
  })

  it("returns full ball count at start of innings", () => {
    expect(getRemainingBalls(makeInnings(0), BASE_RULES)).toBe(120) // 20*6
  })

  it("decrements as balls are bowled", () => {
    expect(getRemainingBalls(makeInnings(10), BASE_RULES)).toBe(110)
  })

  it("clamps to 0 (never negative)", () => {
    expect(getRemainingBalls(makeInnings(121), BASE_RULES)).toBe(0)
  })
})

// ─── getRequiredRunRate ───────────────────────────────────────────────────────

describe("getRequiredRunRate", () => {
  it("returns Infinity when no balls remaining", () => {
    expect(getRequiredRunRate(50, 0)).toBe(Infinity)
  })

  it("calculates correct RRR", () => {
    // 60 runs needed from 12 balls = 5 runs/ball × 6 = 30 RRR
    expect(getRequiredRunRate(60, 12)).toBe(30)
  })

  it("handles exactly achievable target", () => {
    // 6 runs needed from 6 balls = 1 per ball = 6 RRR
    expect(getRequiredRunRate(6, 6)).toBe(6)
  })
})

// ─── getCurrentRunRate ────────────────────────────────────────────────────────

describe("getCurrentRunRate", () => {
  it("returns 0 when no balls bowled yet", () => {
    expect(getCurrentRunRate(0, 0)).toBe(0)
  })

  it("calculates CRR correctly", () => {
    // 36 runs from 12 balls = 3 per ball × 6 = 18 CRR
    expect(getCurrentRunRate(36, 12)).toBe(18)
  })

  it("works with 6-ball over", () => {
    expect(getCurrentRunRate(6, 6)).toBe(6)
  })
})

// ─── buildDismissalText ───────────────────────────────────────────────────────

describe("buildDismissalText", () => {
  it("bowled format", () => {
    expect(buildDismissalText("bowled", "Jones")).toBe("b Jones")
  })

  it("caught format with fielder", () => {
    expect(buildDismissalText("caught", "Jones", "Smith")).toBe("c Smith b Jones")
  })

  it("caught with unknown fielder", () => {
    expect(buildDismissalText("caught", "Jones")).toBe("c ? b Jones")
  })

  it("caught and bowled", () => {
    expect(buildDismissalText("caughtAndBowled", "Jones")).toBe("c & b Jones")
  })

  it("lbw format", () => {
    expect(buildDismissalText("lbw", "Jones")).toBe("lbw b Jones")
  })

  it("stumped with keeper", () => {
    expect(buildDismissalText("stumped", "Jones", "Patel")).toBe("st Patel b Jones")
  })

  it("run out without fielder", () => {
    expect(buildDismissalText("runOut", "Jones")).toBe("run out")
  })

  it("run out with fielder", () => {
    expect(buildDismissalText("runOut", "Jones", "Smith")).toBe("run out (Smith)")
  })

  it("retired hurt", () => {
    expect(buildDismissalText("retiredHurt", "Jones")).toBe("retired hurt")
  })
})

// ─── isTied ───────────────────────────────────────────────────────────────────

describe("isTied", () => {
  it("returns true when scores are equal", () => {
    expect(isTied(142, 142)).toBe(true)
  })

  it("returns false when scores differ", () => {
    expect(isTied(142, 143)).toBe(false)
    expect(isTied(0, 1)).toBe(false)
  })
})

// ─── getCurrentPartnership ───────────────────────────────────────────────────

describe("getCurrentPartnership", () => {
  it("includes extras in partnership runs", () => {
    const ballLog = [
      makeBall({ batsmanId: "bat1", runs: 1, batsmanRuns: 1 }),
      makeBall({ batsmanId: "bat2", runs: 2, batsmanRuns: 2 }),
      makeBall({
        batsmanId: "bat1",
        runs: 1,
        batsmanRuns: 0,
        extraRuns: 1,
        isExtra: true,
        extraType: "bye",
      }),
      makeBall({
        batsmanId: "bat2",
        runs: 2,
        batsmanRuns: 1,
        extraRuns: 1,
        isExtra: true,
        extraType: "noBall",
        isLegal: false,
      }),
    ]

    const p = getCurrentPartnership(ballLog, "bat1", "bat2", 0, 6)

    expect(p.runs).toBe(6)
    expect(p.batsman1Runs).toBe(1)
    expect(p.batsman2Runs).toBe(3)
    expect(p.balls).toBe(3)
  })
})

// ─── isInningsComplete ────────────────────────────────────────────────────────

function makeInnings(overrides: Partial<Innings> = {}): Innings {
  return {
    index: 0,
    battingTeamId: "t1",
    bowlingTeamId: "t2",
    status: "live",
    totalRuns: 0,
    totalWickets: 0,
    totalOvers: 0,
    totalBalls: 0,
    totalLegalDeliveries: 0,
    extras: { wide: 0, noBall: 0, bye: 0, legBye: 0, penalty: 0, total: 0 },
    battingCard: [],
    bowlingCard: [],
    fallOfWickets: [],
    partnerships: [],
    ballLog: [],
    isDeclared: false,
    ...overrides,
  }
}

describe("isInningsComplete", () => {
  it("returns true when innings is declared", () => {
    const innings = makeInnings({ isDeclared: true })
    expect(isInningsComplete(innings, BASE_RULES)).toBe(true)
  })

  it("returns true when target is reached (chase won)", () => {
    // target of 150, batting team has 150 — exactly equal = won
    const innings = makeInnings({ target: 150, totalRuns: 150 })
    expect(isInningsComplete(innings, BASE_RULES)).toBe(true)
  })

  it("returns true when target is exceeded (chase won)", () => {
    const innings = makeInnings({ target: 150, totalRuns: 151 })
    expect(isInningsComplete(innings, BASE_RULES)).toBe(true)
  })

  it("returns false when target is set but not yet reached", () => {
    const innings = makeInnings({ target: 150, totalRuns: 149 })
    expect(isInningsComplete(innings, BASE_RULES)).toBe(false)
  })

  it("returns true when all wickets fallen (maxWickets reached)", () => {
    // BASE_RULES.maxWickets = 10
    const innings = makeInnings({ totalWickets: 10 })
    expect(isInningsComplete(innings, BASE_RULES)).toBe(true)
  })

  it("returns false when wickets fallen but maxWickets not reached", () => {
    // Let's ensure 2 active batsmen so it stays live
    const innings2 = makeInnings({
      totalWickets: 8,
      battingCard: [
        { playerId: "b1", playerName: "B1", runs: 0, balls: 0, fours: 0, sixes: 0, dots: 0, isOut: false, isRetiredHurt: false, strikeRate: 0, position: 1, dismissalText: "not out" },
        { playerId: "b2", playerName: "B2", runs: 0, balls: 0, fours: 0, sixes: 0, dots: 0, isOut: false, isRetiredHurt: false, strikeRate: 0, position: 2, dismissalText: "not out" },
      ],
    })
    expect(isInningsComplete(innings2, BASE_RULES)).toBe(false)
  })

  it("returns true for T20-style overs completion (20 overs bowled)", () => {
    // 20 overs × 6 balls = 120 legal balls
    const legalBalls = Array.from({ length: 120 }, (_, i) =>
      makeBall({ overNumber: Math.floor(i / 6), isLegal: true, deliveryNumber: i })
    )
    const innings = makeInnings({ ballLog: legalBalls })
    expect(isInningsComplete(innings, BASE_RULES)).toBe(true)
  })

  it("returns false when overs are not yet complete", () => {
    // Only 119 of 120 balls bowled
    const legalBalls = Array.from({ length: 119 }, (_, i) =>
      makeBall({ overNumber: Math.floor(i / 6), isLegal: true, deliveryNumber: i })
    )
    const innings = makeInnings({ ballLog: legalBalls })
    expect(isInningsComplete(innings, BASE_RULES)).toBe(false)
  })

  it("returns false when no completion condition is met (innings still live)", () => {
    const innings = makeInnings({
      totalRuns: 50,
      totalWickets: 3,
      battingCard: [
        { playerId: "b1", playerName: "B1", runs: 30, balls: 20, fours: 2, sixes: 0, dots: 5, isOut: false, isRetiredHurt: false, strikeRate: 150, position: 1, dismissalText: "not out" },
        { playerId: "b2", playerName: "B2", runs: 20, balls: 15, fours: 1, sixes: 0, dots: 4, isOut: false, isRetiredHurt: false, strikeRate: 133, position: 2, dismissalText: "not out" },
      ],
      ballLog: Array.from({ length: 30 }, (_, i) =>
        makeBall({ overNumber: Math.floor(i / 6), isLegal: true, deliveryNumber: i })
      ),
    })
    expect(isInningsComplete(innings, BASE_RULES)).toBe(false)
  })

  it("returns false for unlimited-overs match (Test) even when many balls bowled", () => {
    const testRules: MatchRules = { ...BASE_RULES, oversPerInnings: null }
    const manyBalls = Array.from({ length: 300 }, (_, i) =>
      makeBall({ overNumber: Math.floor(i / 6), isLegal: true, deliveryNumber: i })
    )
    const innings = makeInnings({ totalWickets: 5, ballLog: manyBalls })
    // 5 wickets and no over limit — not complete
    expect(isInningsComplete(innings, testRules)).toBe(false)
  })
})

// ─── getTarget ────────────────────────────────────────────────────────────────

describe("getTarget", () => {
  it("returns first innings runs + 1", () => {
    const innings = makeInnings({ totalRuns: 180 })
    expect(getTarget(innings)).toBe(181)
  })

  it("returns 1 for a duck innings (0 runs)", () => {
    const innings = makeInnings({ totalRuns: 0 })
    expect(getTarget(innings)).toBe(1)
  })
})

// ─── shouldSwapStrikeEndOfOver ────────────────────────────────────────────────

describe("shouldSwapStrikeEndOfOver", () => {
  it("always returns true", () => {
    expect(shouldSwapStrikeEndOfOver()).toBe(true)
  })
})

// ─── getExtraRuns ─────────────────────────────────────────────────────────────

describe("getExtraRuns", () => {
  it("returns all-zero breakdown for a normal delivery", () => {
    const ball = makeBall({ isExtra: false, runs: 4, batsmanRuns: 4 })
    const result = getExtraRuns(ball)
    expect(result).toEqual({ wide: 0, noBall: 0, bye: 0, legBye: 0, penalty: 0, total: 0 })
  })

  it("maps wide correctly", () => {
    const ball = makeBall({ isExtra: true, extraType: "wide", extraRuns: 1, runs: 1 })
    const result = getExtraRuns(ball)
    expect(result).toEqual({ wide: 1, noBall: 0, bye: 0, legBye: 0, penalty: 0, total: 1 })
  })

  it("maps no-ball correctly", () => {
    const ball = makeBall({ isExtra: true, extraType: "noBall", extraRuns: 1, runs: 1 })
    const result = getExtraRuns(ball)
    expect(result).toEqual({ wide: 0, noBall: 1, bye: 0, legBye: 0, penalty: 0, total: 1 })
  })

  it("maps bye correctly", () => {
    const ball = makeBall({ isExtra: true, extraType: "bye", extraRuns: 4, runs: 4 })
    const result = getExtraRuns(ball)
    expect(result).toEqual({ wide: 0, noBall: 0, bye: 4, legBye: 0, penalty: 0, total: 4 })
  })

  it("maps leg bye correctly", () => {
    const ball = makeBall({ isExtra: true, extraType: "legBye", extraRuns: 2, runs: 2 })
    const result = getExtraRuns(ball)
    expect(result).toEqual({ wide: 0, noBall: 0, bye: 0, legBye: 2, penalty: 0, total: 2 })
  })

  it("maps penalty (batting side) correctly", () => {
    const ball = makeBall({ isExtra: true, extraType: "penaltyBatting", extraRuns: 5, runs: 5 })
    const result = getExtraRuns(ball)
    expect(result).toEqual({ wide: 0, noBall: 0, bye: 0, legBye: 0, penalty: 5, total: 5 })
  })

  it("maps penalty (bowling side) correctly", () => {
    const ball = makeBall({ isExtra: true, extraType: "penaltyBowling", extraRuns: 5, runs: 5 })
    const result = getExtraRuns(ball)
    expect(result).toEqual({ wide: 0, noBall: 0, bye: 0, legBye: 0, penalty: 5, total: 5 })
  })
})

// ─── getOversBowledByPlayer ───────────────────────────────────────────────────

describe("getOversBowledByPlayer", () => {
  it("returns empty object for empty log", () => {
    expect(getOversBowledByPlayer([], 6)).toEqual({})
  })

  it("counts one completed over for a bowler with 6 legal balls", () => {
    const log = Array.from({ length: 6 }, (_, i) =>
      makeBall({ bowlerId: "bowl1", overNumber: 0, isLegal: true, deliveryNumber: i })
    )
    expect(getOversBowledByPlayer(log, 6)).toEqual({ bowl1: 1 })
  })

  it("does not count a partial over (0 completed overs)", () => {
    const log = Array.from({ length: 5 }, (_, i) =>
      makeBall({ bowlerId: "bowl1", overNumber: 0, isLegal: true, deliveryNumber: i })
    )
    // bowl1 is present but with 0 completed overs
    expect(getOversBowledByPlayer(log, 6)).toEqual({ bowl1: 0 })
  })

  it("counts multiple overs across two bowlers correctly", () => {
    const bowl1Balls = Array.from({ length: 12 }, (_, i) =>
      makeBall({ bowlerId: "bowl1", overNumber: i < 6 ? 0 : 2, isLegal: true, deliveryNumber: i })
    )
    const bowl2Balls = Array.from({ length: 6 }, (_, i) =>
      makeBall({ bowlerId: "bowl2", overNumber: 1, isLegal: true, deliveryNumber: i })
    )
    const result = getOversBowledByPlayer([...bowl1Balls, ...bowl2Balls], 6)
    expect(result).toEqual({ bowl1: 2, bowl2: 1 })
  })

  it("ignores illegal deliveries (wides/no-balls) when counting overs", () => {
    // 6 legal + 2 wides = bowl1 has 1 completed over
    const legal = Array.from({ length: 6 }, (_, i) =>
      makeBall({ bowlerId: "bowl1", overNumber: 0, isLegal: true, deliveryNumber: i })
    )
    const wides = [
      makeBall({ bowlerId: "bowl1", overNumber: 0, isLegal: false, extraType: "wide", deliveryNumber: 6 }),
      makeBall({ bowlerId: "bowl1", overNumber: 0, isLegal: false, extraType: "wide", deliveryNumber: 7 }),
    ]
    expect(getOversBowledByPlayer([...legal, ...wides], 6)).toEqual({ bowl1: 1 })
  })
})

// ─── isInPowerplay ─────────────────────────────────────────────────────────────

describe("isInPowerplay", () => {
  it("returns true for over 0 (inside powerplay)", () => {
    expect(isInPowerplay(0, BASE_RULES)).toBe(true) // BASE_RULES.powerplayOvers = 6
  })

  it("returns true for over 5 (last powerplay over)", () => {
    expect(isInPowerplay(5, BASE_RULES)).toBe(true)
  })

  it("returns false for over 6 (first non-powerplay over)", () => {
    expect(isInPowerplay(6, BASE_RULES)).toBe(false)
  })

  it("returns false for over 10 (well outside powerplay)", () => {
    expect(isInPowerplay(10, BASE_RULES)).toBe(false)
  })

  it("returns false when powerplay is disabled", () => {
    const rules = { ...BASE_RULES, powerplayEnabled: false }
    expect(isInPowerplay(0, rules)).toBe(false)
  })
})

// ─── buildResultString ────────────────────────────────────────────────────────

describe("buildResultString", () => {
  it("won by runs (batting first wins)", () => {
    const result = buildResultString("Team A", "Team B", true, 185, 172, 3, 0, 6)
    expect(result).toBe("Team A won by 13 runs")
  })

  it("singular 'run' when margin is 1", () => {
    const result = buildResultString("Team A", "Team B", true, 150, 149, 3, 0, 6)
    expect(result).toBe("Team A won by 1 run")
  })

  it("won by wickets (chasing team wins)", () => {
    const result = buildResultString("Team B", "Team A", false, 173, 185, 5, 12, 6)
    expect(result).toBe("Team B won by 5 wickets (2 ov remaining)")
  })

  it("singular 'wicket' when margin is 1", () => {
    const result = buildResultString("Team B", "Team A", false, 186, 185, 1, 0, 6)
    expect(result).toBe("Team B won by 1 wicket")
  })

  it("no 'ov remaining' text when last ball wins", () => {
    // remainingBalls = 0 means won off the last ball
    const result = buildResultString("Team B", "Team A", false, 186, 185, 3, 0, 6)
    expect(result).toBe("Team B won by 3 wickets")
  })

  it("fractional overs remaining shown correctly", () => {
    // 7 balls remaining = 1.1 overs
    const result = buildResultString("Team B", "Team A", false, 186, 185, 3, 7, 6)
    expect(result).toBe("Team B won by 3 wickets (1.1 ov remaining)")
  })
})

// ─── createBall ───────────────────────────────────────────────────────────────

function makeBallInput(overrides: Partial<BallInput> = {}): BallInput {
  return {
    inningsIndex: 0,
    overNumber: 0,
    deliveryNumber: 0,
    batsmanId: "bat1",
    bowlerId: "bowl1",
    runs: 0,
    batsmanRuns: 0,
    isExtra: false,
    extraRuns: 0,
    isWicket: false,
    isFreeHit: false,
    nextIsFreeHit: false,
    isNoBallBatRuns: false,
    powerplay: false,
    rules: BASE_RULES,
    ballLog: [],
    ...overrides,
  }
}

describe("createBall", () => {
  it("normal delivery is legal", () => {
    const ball = createBall(makeBallInput({ isExtra: false, runs: 4, batsmanRuns: 4 }))
    expect(ball.isLegal).toBe(true)
    expect(ball.runs).toBe(4)
    expect(ball.batsmanRuns).toBe(4)
  })

  it("wide with wideReball=true is not legal", () => {
    const ball = createBall(makeBallInput({
      isExtra: true, extraType: "wide", extraRuns: 1, runs: 1,
      rules: { ...BASE_RULES, wideReball: true },
    }))
    expect(ball.isLegal).toBe(false)
  })

  it("bye is legal", () => {
    const ball = createBall(makeBallInput({
      isExtra: true, extraType: "bye", extraRuns: 2, runs: 2,
    }))
    expect(ball.isLegal).toBe(true)
  })

  it("ballInOver counts legal deliveries in same over only", () => {
    // Two prior legal balls in over 0, so ballInOver should be 2
    const priorBalls = [
      makeBall({ overNumber: 0, isLegal: true, deliveryNumber: 0 }),
      makeBall({ overNumber: 0, isLegal: true, deliveryNumber: 1 }),
      makeBall({ overNumber: 0, isLegal: false, extraType: "wide", deliveryNumber: 2 }), // wide doesn't count
    ]
    const ball = createBall(makeBallInput({ overNumber: 0, deliveryNumber: 3, ballLog: priorBalls }))
    expect(ball.ballInOver).toBe(2)
  })

  it("ballInOver resets for a new over", () => {
    // All prior balls are in over 0
    const priorBalls = Array.from({ length: 6 }, (_, i) =>
      makeBall({ overNumber: 0, isLegal: true, deliveryNumber: i })
    )
    const ball = createBall(makeBallInput({ overNumber: 1, deliveryNumber: 6, ballLog: priorBalls }))
    expect(ball.ballInOver).toBe(0)
  })

  it("generates a unique id", () => {
    const ball1 = createBall(makeBallInput())
    const ball2 = createBall(makeBallInput())
    expect(ball1.id).not.toBe(ball2.id)
  })
})

// ─── computeBowlerEntry ───────────────────────────────────────────────────────

describe("computeBowlerEntry", () => {
  it("returns zeroed entry for bowler with no balls", () => {
    const entry = computeBowlerEntry("bowl1", "Alice", [], 6)
    expect(entry.overs).toBe(0)
    expect(entry.balls).toBe(0)
    expect(entry.maidens).toBe(0)
    expect(entry.runs).toBe(0)
    expect(entry.wickets).toBe(0)
    expect(entry.economy).toBe(0)
    expect(entry.dots).toBe(0)
    expect(entry.wides).toBe(0)
    expect(entry.noBalls).toBe(0)
  })

  it("counts 6 dot balls as 1 completed over and 1 maiden", () => {
    const log = Array.from({ length: 6 }, (_, i) =>
      makeBall({ bowlerId: "bowl1", overNumber: 0, isLegal: true, runs: 0, deliveryNumber: i })
    )
    const entry = computeBowlerEntry("bowl1", "Alice", log, 6)
    expect(entry.overs).toBe(1)
    expect(entry.balls).toBe(0)
    expect(entry.maidens).toBe(1)
    expect(entry.runs).toBe(0)
    expect(entry.dots).toBe(6)
  })

  it("wides and no-balls count against bowler runs but not legal delivery count", () => {
    const legal = Array.from({ length: 6 }, (_, i) =>
      makeBall({ bowlerId: "bowl1", overNumber: 0, isLegal: true, runs: 0, deliveryNumber: i })
    )
    const wide = makeBall({
      bowlerId: "bowl1", overNumber: 0, isLegal: false,
      extraType: "wide", runs: 1, batsmanRuns: 0, extraRuns: 1, isExtra: true, deliveryNumber: 6,
    })
    const entry = computeBowlerEntry("bowl1", "Alice", [...legal, wide], 6)
    expect(entry.wides).toBe(1)
    expect(entry.runs).toBe(1) // wide counted against bowler
    expect(entry.overs).toBe(1)
    expect(entry.maidens).toBe(0) // wide means not maiden
  })

  it("byes do NOT count against bowler runs", () => {
    const log = Array.from({ length: 6 }, (_, i) =>
      makeBall({
        bowlerId: "bowl1", overNumber: 0, isLegal: true, deliveryNumber: i,
        runs: 1, batsmanRuns: 0, extraRuns: 1, isExtra: true, extraType: "bye",
      })
    )
    const entry = computeBowlerEntry("bowl1", "Alice", log, 6)
    expect(entry.runs).toBe(0) // byes don't count
    expect(entry.maidens).toBe(1) // bye maiden still counts
  })

  it("counts wickets only for BOWLER_CREDITED dismissal types", () => {
    const bowled = makeBall({ bowlerId: "bowl1", overNumber: 0, isLegal: true, isWicket: true, dismissalType: "bowled" })
    const caught = makeBall({ bowlerId: "bowl1", overNumber: 0, isLegal: true, isWicket: true, dismissalType: "caught" })
    const runOut = makeBall({ bowlerId: "bowl1", overNumber: 0, isLegal: true, isWicket: true, dismissalType: "runOut" })
    const entry = computeBowlerEntry("bowl1", "Alice", [bowled, caught, runOut], 6)
    expect(entry.wickets).toBe(2) // run out doesn't credit bowler
  })

  it("computes economy correctly for a partial over", () => {
    // 2 runs from 3 legal balls → economy = (2/3)*6 = 4.0
    const log = [
      makeBall({ bowlerId: "bowl1", overNumber: 0, isLegal: true, runs: 2, batsmanRuns: 2 }),
      makeBall({ bowlerId: "bowl1", overNumber: 0, isLegal: true, runs: 0 }),
      makeBall({ bowlerId: "bowl1", overNumber: 0, isLegal: true, runs: 0 }),
    ]
    const entry = computeBowlerEntry("bowl1", "Alice", log, 6)
    expect(entry.overs).toBe(0)
    expect(entry.balls).toBe(3)
    expect(entry.economy).toBeCloseTo(4.0)
  })

  it("only counts balls from matching bowler", () => {
    const bowl1Balls = Array.from({ length: 6 }, (_, i) =>
      makeBall({ bowlerId: "bowl1", overNumber: 0, isLegal: true, runs: 1, deliveryNumber: i })
    )
    const bowl2Balls = Array.from({ length: 6 }, (_, i) =>
      makeBall({ bowlerId: "bowl2", overNumber: 1, isLegal: true, runs: 4, deliveryNumber: i })
    )
    const entry = computeBowlerEntry("bowl1", "Alice", [...bowl1Balls, ...bowl2Balls], 6)
    expect(entry.runs).toBe(6)
    expect(entry.overs).toBe(1)
  })

  it("multi-over correctly computes overs + balls remainder", () => {
    // 14 legal balls = 2 overs + 2 balls
    const log = Array.from({ length: 14 }, (_, i) =>
      makeBall({ bowlerId: "bowl1", overNumber: Math.floor(i / 6), isLegal: true, deliveryNumber: i })
    )
    const entry = computeBowlerEntry("bowl1", "Alice", log, 6)
    expect(entry.overs).toBe(2)
    expect(entry.balls).toBe(2)
  })
})
