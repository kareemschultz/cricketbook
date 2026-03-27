import type { FifaMatch, FifaPlayer, PlayerStats } from "@/types/fifa"

export function computePlayerStats(
  players: FifaPlayer[],
  matches: FifaMatch[]
): PlayerStats[] {
  const statsMap = new Map<string, Omit<PlayerStats, "form" | "winRate">>()

  // Initialize stats for all players
  for (const player of players) {
    statsMap.set(player.id, {
      playerId: player.id,
      name: player.name,
      colorHex: player.colorHex,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
    })
  }

  // Track match results per player (sorted by date for form calculation)
  const resultsByPlayer = new Map<string, Array<{ date: Date; result: "W" | "D" | "L" }>>()
  for (const player of players) {
    resultsByPlayer.set(player.id, [])
  }

  // Sort matches by date ascending
  const sortedMatches = [...matches].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  for (const match of sortedMatches) {
    const p1 = statsMap.get(match.player1Id)
    const p2 = statsMap.get(match.player2Id)

    if (!p1 || !p2) continue

    const p1Results = resultsByPlayer.get(match.player1Id)!
    const p2Results = resultsByPlayer.get(match.player2Id)!

    p1.played++
    p2.played++
    p1.goalsFor += match.player1Score
    p1.goalsAgainst += match.player2Score
    p2.goalsFor += match.player2Score
    p2.goalsAgainst += match.player1Score

    if (match.player1Score > match.player2Score) {
      // Player 1 wins
      p1.won++
      p1.points += 3
      p2.lost++
      p1Results.push({ date: new Date(match.date), result: "W" })
      p2Results.push({ date: new Date(match.date), result: "L" })
    } else if (match.player1Score < match.player2Score) {
      // Player 2 wins
      p2.won++
      p2.points += 3
      p1.lost++
      p1Results.push({ date: new Date(match.date), result: "L" })
      p2Results.push({ date: new Date(match.date), result: "W" })
    } else {
      // Draw
      p1.drawn++
      p1.points += 1
      p2.drawn++
      p2.points += 1
      p1Results.push({ date: new Date(match.date), result: "D" })
      p2Results.push({ date: new Date(match.date), result: "D" })
    }

    p1.goalDifference = p1.goalsFor - p1.goalsAgainst
    p2.goalDifference = p2.goalsFor - p2.goalsAgainst
  }

  // Build final stats with form and winRate
  const result: PlayerStats[] = []

  for (const player of players) {
    const base = statsMap.get(player.id)
    if (!base) continue

    const results = resultsByPlayer.get(player.id) ?? []
    const form = results.slice(-5).map((r) => r.result) as Array<"W" | "D" | "L">
    const winRate = base.played > 0 ? Math.round((base.won / base.played) * 100) : 0

    result.push({ ...base, form, winRate })
  }

  // Sort by: Points desc, GD desc, GF desc
  result.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference
    return b.goalsFor - a.goalsFor
  })

  return result
}

export interface H2HRecord {
  opponentId: string
  opponentName: string
  opponentColor: string
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
}

export function computeH2H(
  playerId: string,
  players: FifaPlayer[],
  matches: FifaMatch[]
): H2HRecord[] {
  const playerMap = new Map(players.map((p) => [p.id, p]))
  const h2hMap = new Map<string, H2HRecord>()

  for (const match of matches) {
    let opponentId: string | null = null
    let scored = 0
    let conceded = 0
    let result: "W" | "D" | "L"

    if (match.player1Id === playerId) {
      opponentId = match.player2Id
      scored = match.player1Score
      conceded = match.player2Score
    } else if (match.player2Id === playerId) {
      opponentId = match.player1Id
      scored = match.player2Score
      conceded = match.player1Score
    } else {
      continue
    }

    if (scored > conceded) result = "W"
    else if (scored < conceded) result = "L"
    else result = "D"

    const opponent = playerMap.get(opponentId)
    if (!opponent) continue

    if (!h2hMap.has(opponentId)) {
      h2hMap.set(opponentId, {
        opponentId,
        opponentName: opponent.name,
        opponentColor: opponent.colorHex,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
      })
    }

    const record = h2hMap.get(opponentId)!
    record.goalsFor += scored
    record.goalsAgainst += conceded
    if (result === "W") record.won++
    else if (result === "D") record.drawn++
    else record.lost++
  }

  return Array.from(h2hMap.values()).sort((a, b) => a.opponentName.localeCompare(b.opponentName))
}
