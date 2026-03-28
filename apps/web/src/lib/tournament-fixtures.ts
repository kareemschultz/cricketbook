export interface FixtureSeed {
  team1Id: string
  team2Id: string
  round: number
  phase: "league" | "knockout"
}

type KnockoutResult = "team1" | "team2" | "abandoned" | null

interface KnockoutFixtureLike {
  team1Id: string
  team2Id: string
  round: number
  phase: "league" | "knockout"
  result: KnockoutResult
}

export function isPowerOfTwo(value: number): boolean {
  return value > 0 && (value & (value - 1)) === 0
}

export function generateRoundRobinSeeds(teamIds: string[]): FixtureSeed[] {
  if (teamIds.length < 2) return []

  const working: Array<string | null> = [...teamIds]
  if (working.length % 2 === 1) {
    working.push(null)
  }

  const totalRounds = working.length - 1
  const half = working.length / 2
  const seeds: FixtureSeed[] = []

  for (let round = 0; round < totalRounds; round++) {
    for (let i = 0; i < half; i++) {
      const team1Id = working[i]
      const team2Id = working[working.length - 1 - i]
      if (team1Id && team2Id) {
        seeds.push({
          team1Id,
          team2Id,
          round: round + 1,
          phase: "league",
        })
      }
    }

    const [fixed, ...rest] = working
    rest.unshift(rest.pop() ?? null)
    working.splice(0, working.length, fixed ?? null, ...rest)
  }

  return seeds
}

export function generateInitialKnockoutSeeds(teamIds: string[]): FixtureSeed[] {
  if (teamIds.length < 2) return []
  if (!isPowerOfTwo(teamIds.length)) {
    throw new Error("Knockout tournaments need 2, 4, 8, or 16 teams.")
  }

  const seeds: FixtureSeed[] = []
  for (let i = 0; i < teamIds.length; i += 2) {
    seeds.push({
      team1Id: teamIds[i]!,
      team2Id: teamIds[i + 1]!,
      round: 1,
      phase: "knockout",
    })
  }
  return seeds
}

export function getKnockoutWinnerId(
  fixture: Pick<KnockoutFixtureLike, "team1Id" | "team2Id" | "result">
): string | null {
  if (fixture.result === "team1") return fixture.team1Id
  if (fixture.result === "team2") return fixture.team2Id
  return null
}

export function generateNextKnockoutSeeds(
  fixtures: KnockoutFixtureLike[]
): FixtureSeed[] {
  const knockoutFixtures = fixtures.filter((fixture) => fixture.phase === "knockout")
  if (knockoutFixtures.length === 0) return []

  const currentRound = Math.max(...knockoutFixtures.map((fixture) => fixture.round))
  const currentRoundFixtures = knockoutFixtures.filter(
    (fixture) => fixture.round === currentRound
  )

  if (currentRoundFixtures.some((fixture) => fixture.result === null)) {
    return []
  }
  if (currentRoundFixtures.some((fixture) => fixture.result === "abandoned")) {
    throw new Error("Knockout fixtures cannot advance while a match is abandoned.")
  }

  const winnerIds = currentRoundFixtures
    .map((fixture) => getKnockoutWinnerId(fixture))
    .filter((teamId): teamId is string => !!teamId)

  if (winnerIds.length <= 1) return []
  if (winnerIds.length % 2 !== 0) {
    throw new Error("Knockout winners must pair evenly before generating the next round.")
  }

  return winnerIds.reduce<FixtureSeed[]>((acc, teamId, index, arr) => {
    if (index % 2 === 0) {
      acc.push({
        team1Id: teamId,
        team2Id: arr[index + 1]!,
        round: currentRound + 1,
        phase: "knockout",
      })
    }
    return acc
  }, [])
}
