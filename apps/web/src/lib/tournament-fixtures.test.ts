import { describe, expect, it } from "vitest"
import {
  generateNextKnockoutSeeds,
  generateRoundRobinSeeds,
} from "@/lib/tournament-fixtures"
import { buildDominoTournamentUpdateFromMatch } from "@/lib/domino-tournaments"
import { buildTrumpTournamentUpdateFromMatch } from "@/lib/trump-tournaments"
import type { DominoMatch, DominoTeam, DominoTournament } from "@/types/dominoes"
import type { TrumpMatch, TrumpTeam, TrumpTournament } from "@/types/trump"

describe("tournament fixtures", () => {
  it("creates every round-robin pairing once for an odd team count", () => {
    const seeds = generateRoundRobinSeeds(["a", "b", "c"])

    expect(seeds).toHaveLength(3)
    expect(
      new Set(seeds.map((seed) => [seed.team1Id, seed.team2Id].sort().join("-")))
    ).toEqual(new Set(["a-b", "a-c", "b-c"]))
  })

  it("creates the next knockout round once all matches in a round are complete", () => {
    const seeds = generateNextKnockoutSeeds([
      { team1Id: "a", team2Id: "b", round: 1, phase: "knockout", result: "team1" },
      { team1Id: "c", team2Id: "d", round: 1, phase: "knockout", result: "team2" },
    ])

    expect(seeds).toEqual([
      { team1Id: "a", team2Id: "d", round: 2, phase: "knockout" },
    ])
  })
})

describe("tournament progression", () => {
  it("completes a domino round-robin tournament and records the champion", () => {
    const teams: DominoTeam[] = [
      { id: "team-a", name: "Team A", player1Id: "p1", player2Id: "p2", colorHex: "#111111", createdAt: new Date() },
      { id: "team-b", name: "Team B", player1Id: "p3", player2Id: "p4", colorHex: "#222222", createdAt: new Date() },
    ]
    const tournament: DominoTournament = {
      id: "domino-cup",
      name: "Domino Cup",
      format: "ROUND_ROBIN",
      teamIds: ["team-a", "team-b"],
      fixtures: [
        {
          id: "fixture-1",
          tournamentId: "domino-cup",
          team1Id: "team-a",
          team2Id: "team-b",
          round: 1,
          phase: "league",
          result: null,
        },
      ],
      status: "live",
      pointsPerWin: 2,
      pointsPerAbandoned: 1,
      createdAt: new Date(),
    }
    const match: DominoMatch = {
      id: "match-1",
      date: new Date(),
      scoringMode: "hands",
      targetHands: 6,
      targetPoints: 100,
      team1Id: "team-a",
      team2Id: "team-b",
      hands: [],
      team1Score: 6,
      team2Score: 3,
      winnerId: "team-a",
      status: "completed",
      tournamentId: "domino-cup",
      tournamentFixtureId: "fixture-1",
    }

    const update = buildDominoTournamentUpdateFromMatch({
      tournament,
      fixtureId: "fixture-1",
      match,
      teams,
      matches: [match],
    })

    expect(update.status).toBe("completed")
    expect(update.championTeamId).toBe("team-a")
    expect(update.fixtures[0]).toMatchObject({
      matchId: "match-1",
      result: "team1",
      pointsTeam1: 6,
      pointsTeam2: 3,
    })
    expect(update.completedAt).toBeInstanceOf(Date)
  })

  it("advances a trump knockout tournament into the next round", () => {
    const teams: TrumpTeam[] = [
      { id: "team-a", name: "Team A", player1Id: "p1", player2Id: "p2", colorHex: "#111111", createdAt: new Date() },
      { id: "team-b", name: "Team B", player1Id: "p3", player2Id: "p4", colorHex: "#222222", createdAt: new Date() },
      { id: "team-c", name: "Team C", player1Id: "p5", player2Id: "p6", colorHex: "#333333", createdAt: new Date() },
      { id: "team-d", name: "Team D", player1Id: "p7", player2Id: "p8", colorHex: "#444444", createdAt: new Date() },
    ]
    const tournament: TrumpTournament = {
      id: "trump-cup",
      name: "Trump Cup",
      format: "KNOCKOUT",
      teamIds: ["team-a", "team-b", "team-c", "team-d"],
      fixtures: [
        {
          id: "semi-1",
          tournamentId: "trump-cup",
          team1Id: "team-a",
          team2Id: "team-b",
          round: 1,
          phase: "knockout",
          result: "team1",
        },
        {
          id: "semi-2",
          tournamentId: "trump-cup",
          team1Id: "team-c",
          team2Id: "team-d",
          round: 1,
          phase: "knockout",
          result: null,
        },
      ],
      status: "live",
      pointsPerWin: 2,
      pointsPerAbandoned: 1,
      createdAt: new Date(),
    }
    const match: TrumpMatch = {
      id: "match-2",
      date: new Date(),
      targetScore: 14,
      team1Id: "team-c",
      team2Id: "team-d",
      hands: [],
      team1Score: 9,
      team2Score: 14,
      winnerId: "team-d",
      status: "completed",
      tournamentId: "trump-cup",
      tournamentFixtureId: "semi-2",
    }

    const update = buildTrumpTournamentUpdateFromMatch({
      tournament,
      fixtureId: "semi-2",
      match,
      teams,
      matches: [match],
    })

    expect(update.status).toBe("live")
    expect(update.championTeamId).toBeUndefined()
    expect(update.fixtures).toHaveLength(3)
    expect(update.fixtures[2]).toMatchObject({
      team1Id: "team-a",
      team2Id: "team-d",
      round: 2,
      phase: "knockout",
      result: null,
    })
  })
})
