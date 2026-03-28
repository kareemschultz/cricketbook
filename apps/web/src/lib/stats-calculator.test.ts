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
})
