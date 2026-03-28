import { describe, it, expect, vi } from "vitest"

// Mock Dexie DB — stats-calculator imports db at module level but computeNRR is pure
vi.mock("@/db/index", () => ({ db: {} }))

import { computeNRR } from "./stats-calculator"

describe("computeNRR", () => {
  it("returns 0 when no overs bowled", () => {
    expect(computeNRR(0, 0, 0, 0)).toBe(0)
    expect(computeNRR(100, 0, 80, 20)).toBe(0)
    expect(computeNRR(100, 20, 80, 0)).toBe(0)
  })

  it("positive NRR when team scores more than they concede per over", () => {
    // 200 in 20 overs (10 rpo) vs 150 in 20 overs (7.5 rpo) → NRR = +2.5
    const nrr = computeNRR(200, 20, 150, 20)
    expect(nrr).toBeCloseTo(2.5, 5)
  })

  it("negative NRR when team concedes more than they score", () => {
    const nrr = computeNRR(150, 20, 200, 20)
    expect(nrr).toBeCloseTo(-2.5, 5)
  })

  it("correctly handles cricket overs notation (19.4 = 19 overs + 4 balls)", () => {
    // 19.4 = 19*6 + 4 = 118 balls = 118/6 true overs
    // 100 in 19.4 overs vs 100 in 20 overs
    // for/true = 100 / (118/6) ≈ 5.0847
    // against/true = 100 / (120/6) = 5.0
    const nrr = computeNRR(100, 19.4, 100, 20)
    expect(nrr).toBeGreaterThan(0)  // scored faster
    expect(nrr).toBeCloseTo(100 / (118 / 6) - 100 / (120 / 6), 4)
  })

  it("NRR of 0 when identical scoring rates", () => {
    expect(computeNRR(120, 20, 120, 20)).toBeCloseTo(0)
    expect(computeNRR(60, 10, 60, 10)).toBeCloseTo(0)
  })

  it("handles all out (fewer overs used) correctly", () => {
    // All out in 18.3 = 18*6+3 = 111 balls
    // 100 in 18.3 overs: rpo = 100 / (111/6) ≈ 5.405
    // Opponent 100 in 20 overs: rpo = 5.0 → NRR ≈ 0.405
    const nrr = computeNRR(100, 18.3, 100, 20)
    const expected = 100 / (111 / 6) - 100 / (120 / 6)
    expect(nrr).toBeCloseTo(expected, 4)
  })

  it("returns 0 when both teams scored 0 runs", () => {
    // 0 rpo on each side → 0/x - 0/x = 0
    expect(computeNRR(0, 5, 0, 5)).toBe(0)
  })

  it("handles large run totals without error", () => {
    // 200 runs off 10 balls — extreme but should not throw
    const nrr = computeNRR(200, 1.4, 10, 20)
    // 1.4 overs = 1*6+4 = 10 balls → rpo = 200/(10/6) = 120
    // 20 overs = 120 balls → rpo = 10/(120/6) ≈ 0.5
    expect(nrr).toBeCloseTo(200 / (10 / 6) - 10 / (120 / 6), 4)
  })

  it("handles a single-ball over (0.1 = 1 ball)", () => {
    // 0.1 overs = 1 ball → oversToBalls = 0*6+1 = 1 ball
    // NRR = 6/(1/6) - 6/(1/6) = 0 (equal rates)
    expect(computeNRR(6, 0.1, 6, 0.1)).toBeCloseTo(0)
  })

  it("returns 0 when overs value is 0.0 (zero balls bowled on one side)", () => {
    // oversAgainst = 0 → oversToBalls returns 0 → function returns 0
    expect(computeNRR(100, 20, 80, 0)).toBe(0)
    // oversFor = 0 same case
    expect(computeNRR(100, 0, 80, 20)).toBe(0)
  })
})
