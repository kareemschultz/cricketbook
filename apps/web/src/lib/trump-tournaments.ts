import { nanoid } from "nanoid"
import type {
  TrumpMatch,
  TrumpTeam,
  TrumpTournament,
  TrumpTournamentFixture,
  TrumpTournamentFormat,
  TrumpTournamentStanding,
} from "@/types/trump"
import {
  generateInitialKnockoutSeeds,
  generateNextKnockoutSeeds,
  generateRoundRobinSeeds,
  getKnockoutWinnerId,
} from "@/lib/tournament-fixtures"

export function createTrumpTournamentFixtures(
  tournamentId: string,
  format: TrumpTournamentFormat,
  teamIds: string[]
): TrumpTournamentFixture[] {
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

export function computeTrumpTournamentStandings(
  tournament: TrumpTournament,
  teams: TrumpTeam[],
  matches: TrumpMatch[]
): TrumpTournamentStanding[] {
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
      scoreFor: 0,
      scoreAgainst: 0,
      pointDiff: 0,
      allFours: 0,
      hangJacks: 0,
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
      team1.scoreFor += match.team1Score
      team1.scoreAgainst += match.team2Score
      team2.scoreFor += match.team2Score
      team2.scoreAgainst += match.team1Score

      for (const hand of match.hands) {
        const team1Points = [hand.highTeamId, hand.lowTeamId, hand.jackTeamId, hand.gameTeamId]
          .filter((teamId) => teamId === match.team1Id).length
        const team2Points = [hand.highTeamId, hand.lowTeamId, hand.jackTeamId, hand.gameTeamId]
          .filter((teamId) => teamId === match.team2Id).length

        if (team1Points === 4) team1.allFours++
        if (team2Points === 4) team2.allFours++
        if (hand.hangJack && hand.hangJackTeamId === match.team1Id) team1.hangJacks++
        if (hand.hangJack && hand.hangJackTeamId === match.team2Id) team2.hangJacks++
      }
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
    standing.pointDiff = standing.scoreFor - standing.scoreAgainst
  }

  return standings.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.pointDiff !== a.pointDiff) return b.pointDiff - a.pointDiff
    if (b.scoreFor !== a.scoreFor) return b.scoreFor - a.scoreFor
    return a.teamName.localeCompare(b.teamName)
  })
}

export function getCompletedTrumpChampionId(
  tournament: TrumpTournament,
  teams: TrumpTeam[],
  matches: TrumpMatch[]
): string | undefined {
  if (tournament.format === "ROUND_ROBIN") {
    return computeTrumpTournamentStandings(tournament, teams, matches)[0]?.teamId
  }

  const knockoutFixtures = tournament.fixtures.filter((fixture) => fixture.phase === "knockout")
  const lastFixture = knockoutFixtures.sort((a, b) => b.round - a.round)[0]
  return lastFixture ? getKnockoutWinnerId(lastFixture) ?? undefined : undefined
}

export function buildTrumpTournamentUpdateFromMatch({
  tournament,
  fixtureId,
  match,
  teams,
  matches,
}: {
  tournament: TrumpTournament
  fixtureId: string
  match: TrumpMatch
  teams: TrumpTeam[]
  matches: TrumpMatch[]
}): Pick<TrumpTournament, "fixtures" | "status" | "championTeamId" | "completedAt"> {
  const fixture = tournament.fixtures.find((candidate) => candidate.id === fixtureId)
  if (!fixture) {
    throw new Error("Tournament fixture was not found.")
  }

  const fixtureResult: TrumpTournamentFixture["result"] =
    match.winnerId === match.team1Id ? "team1" : "team2"

  const updatedFixtures: TrumpTournamentFixture[] = tournament.fixtures.map((candidate) =>
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
  let status: TrumpTournament["status"] = "live"
  let championTeamId: string | undefined
  let completedAt: Date | undefined

  if (tournament.format === "ROUND_ROBIN") {
    if (updatedFixtures.length > 0 && updatedFixtures.every((candidate) => candidate.result !== null)) {
      status = "completed"
      championTeamId = getCompletedTrumpChampionId(
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
        championTeamId = getCompletedTrumpChampionId(
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
