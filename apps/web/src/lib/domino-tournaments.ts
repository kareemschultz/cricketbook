import { nanoid } from "nanoid"
import type {
  DominoMatch,
  DominoTeam,
  DominoTournament,
  DominoTournamentFixture,
  DominoTournamentFormat,
  DominoTournamentStanding,
} from "@/types/dominoes"
import {
  generateInitialKnockoutSeeds,
  generateNextKnockoutSeeds,
  generateRoundRobinSeeds,
  getKnockoutWinnerId,
} from "@/lib/tournament-fixtures"

export function createDominoTournamentFixtures(
  tournamentId: string,
  format: DominoTournamentFormat,
  teamIds: string[]
): DominoTournamentFixture[] {
  const seeds = format === "ROUND_ROBIN"
    ? generateRoundRobinSeeds(teamIds)
    : generateInitialKnockoutSeeds(teamIds)

  return seeds.map((seed) => ({
    id: nanoid(),
    tournamentId,
    team1Id: seed.team1Id,
    team2Id: seed.team2Id,
    round: seed.round,
    phase: seed.phase,
    result: null,
  }))
}

export function computeDominoTournamentStandings(
  tournament: DominoTournament,
  teams: DominoTeam[],
  matches: DominoMatch[]
): DominoTournamentStanding[] {
  const teamMap = new Map(teams.map((team) => [team.id, team]))
  const matchMap = new Map(matches.map((match) => [match.id, match]))

  const standings = tournament.teamIds.map((teamId) => {
    const team = teamMap.get(teamId)
    return {
      teamId,
      teamName: team?.name ?? "Unknown",
      colorHex: team?.colorHex ?? "#6b7280",
      played: 0,
      won: 0,
      lost: 0,
      abandoned: 0,
      points: 0,
      handsWon: 0,
      handsLost: 0,
      handDiff: 0,
      matchPointsFor: 0,
      matchPointsAgainst: 0,
      sixLoves: 0,
    }
  })

  const standingMap = new Map(standings.map((standing) => [standing.teamId, standing]))

  for (const fixture of tournament.fixtures) {
    const team1 = standingMap.get(fixture.team1Id)
    const team2 = standingMap.get(fixture.team2Id)
    if (!team1 || !team2 || fixture.result === null) continue

    team1.played++
    team2.played++

    const match = fixture.matchId ? matchMap.get(fixture.matchId) : undefined
    if (match) {
      team1.handsWon += match.team1Score
      team1.handsLost += match.team2Score
      team1.matchPointsFor += match.team1Score
      team1.matchPointsAgainst += match.team2Score
      team2.handsWon += match.team2Score
      team2.handsLost += match.team1Score
      team2.matchPointsFor += match.team2Score
      team2.matchPointsAgainst += match.team1Score

      if (fixture.result === "team1" && match.team2Score === 0) team1.sixLoves++
      if (fixture.result === "team2" && match.team1Score === 0) team2.sixLoves++
    }

    if (fixture.result === "abandoned") {
      team1.abandoned++
      team2.abandoned++
      team1.points += tournament.pointsPerAbandoned
      team2.points += tournament.pointsPerAbandoned
      continue
    }

    const winner = fixture.result === "team1" ? team1 : team2
    const loser = fixture.result === "team1" ? team2 : team1
    winner.won++
    loser.lost++
    winner.points += tournament.pointsPerWin
  }

  for (const standing of standings) {
    standing.handDiff = standing.handsWon - standing.handsLost
  }

  return standings.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.handDiff !== a.handDiff) return b.handDiff - a.handDiff
    if (b.handsWon !== a.handsWon) return b.handsWon - a.handsWon
    return a.teamName.localeCompare(b.teamName)
  })
}

export function getCompletedDominoChampionId(
  tournament: DominoTournament,
  teams: DominoTeam[],
  matches: DominoMatch[]
): string | undefined {
  if (tournament.format === "ROUND_ROBIN") {
    return computeDominoTournamentStandings(tournament, teams, matches)[0]?.teamId
  }

  const knockoutFixtures = tournament.fixtures.filter((fixture) => fixture.phase === "knockout")
  const lastFixture = knockoutFixtures.sort((a, b) => b.round - a.round)[0]
  return lastFixture ? getKnockoutWinnerId(lastFixture) ?? undefined : undefined
}

export function buildDominoTournamentUpdateFromMatch({
  tournament,
  fixtureId,
  match,
  teams,
  matches,
}: {
  tournament: DominoTournament
  fixtureId: string
  match: DominoMatch
  teams: DominoTeam[]
  matches: DominoMatch[]
}): Pick<DominoTournament, "fixtures" | "status" | "championTeamId" | "completedAt"> {
  const fixture = tournament.fixtures.find((candidate) => candidate.id === fixtureId)
  if (!fixture) {
    throw new Error("Tournament fixture was not found.")
  }

  const fixtureResult: DominoTournamentFixture["result"] =
    match.winnerId === match.team1Id ? "team1" : "team2"

  const updatedFixtures: DominoTournamentFixture[] = tournament.fixtures.map((candidate) =>
    candidate.id === fixtureId
      ? {
          ...candidate,
          matchId: match.id,
          result: fixtureResult,
          pointsTeam1: match.team1Score,
          pointsTeam2: match.team2Score,
        }
      : candidate
  )

  let nextFixtures = updatedFixtures
  let status: DominoTournament["status"] = "live"
  let championTeamId: string | undefined
  let completedAt: Date | undefined

  if (tournament.format === "ROUND_ROBIN") {
    if (updatedFixtures.length > 0 && updatedFixtures.every((candidate) => candidate.result !== null)) {
      status = "completed"
      championTeamId = getCompletedDominoChampionId(
        {
          ...tournament,
          fixtures: updatedFixtures,
        },
        teams,
        matches
      )
      completedAt = new Date()
    }
  } else {
    const upcomingRoundSeeds = generateNextKnockoutSeeds(updatedFixtures)
    if (upcomingRoundSeeds.length > 0) {
      nextFixtures = [
        ...updatedFixtures,
        ...upcomingRoundSeeds.map((seed) => ({
          id: nanoid(),
          tournamentId: tournament.id,
          team1Id: seed.team1Id,
          team2Id: seed.team2Id,
          round: seed.round,
          phase: seed.phase,
          result: null,
        })),
      ]
    } else {
      const knockoutFixtures = updatedFixtures.filter((candidate) => candidate.phase === "knockout")
      const currentRound = Math.max(...knockoutFixtures.map((candidate) => candidate.round))
      const currentRoundFixtures = knockoutFixtures.filter((candidate) => candidate.round === currentRound)

      if (
        currentRoundFixtures.length === 1 &&
        currentRoundFixtures[0]?.result !== null &&
        currentRoundFixtures[0]?.result !== "abandoned"
      ) {
        status = "completed"
        championTeamId = getCompletedDominoChampionId(
          {
            ...tournament,
            fixtures: updatedFixtures,
          },
          teams,
          matches
        )
        completedAt = new Date()
      }
    }
  }

  return {
    fixtures: nextFixtures,
    status,
    championTeamId,
    completedAt,
  }
}
