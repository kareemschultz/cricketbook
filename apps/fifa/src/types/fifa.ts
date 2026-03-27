export interface FifaPlayer {
  id: string
  name: string
  colorHex: string
  createdAt: Date
}

export interface FifaMatch {
  id: string
  player1Id: string
  player2Id: string
  player1Score: number
  player2Score: number
  date: Date
  notes?: string
}

export interface PlayerStats {
  playerId: string
  name: string
  colorHex: string
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
  points: number
  form: Array<"W" | "D" | "L">
  winRate: number
}
