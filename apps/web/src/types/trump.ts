// ─── Trump / All Fours Types ─────────────────────────────────────────────────

export interface TrumpPlayer {
  id: string
  name: string
  colorHex: string
  createdAt: Date
}

export interface TrumpTeam {
  id: string
  name: string
  player1Id: string
  player2Id: string
  colorHex: string
  createdAt: Date
}

export type TrumpSuit = "hearts" | "diamonds" | "clubs" | "spades"

export interface TrumpMatch {
  id: string
  date: Date
  targetScore: number // typically 14
  team1Id: string
  team2Id: string
  /** Hand-by-hand log */
  hands: TrumpHand[]
  /** Running scores */
  team1Score: number
  team2Score: number
  winnerId: string | null
  status: "live" | "completed" | "abandoned"
  tournamentId?: string
  tournamentFixtureId?: string
  notes?: string
}

export interface TrumpHand {
  handNumber: number
  trumpSuit: TrumpSuit
  dealerTeamId: string
  /** Begging phase outcome */
  begged: boolean
  kicked: boolean
  gaveOne: boolean
  /** The four points — which team won each (null if not in play) */
  highTeamId: string | null
  lowTeamId: string | null
  jackTeamId: string | null
  gameTeamId: string | null
  /** Bonus */
  hangJack: boolean
  hangJackTeamId: string | null
  /** Points scored by each team this hand */
  team1Points: number
  team2Points: number
}

// ─── Computed Stats ──────────────────────────────────────────────────────────

export interface TrumpPlayerStats {
  playerId: string
  name: string
  colorHex: string
  matchesPlayed: number
  matchesWon: number
  matchesLost: number
  winRate: number
  handsPlayed: number
  totalPoints: number
  pointsPerHand: number
  highsWon: number
  lowsWon: number
  jacksWon: number
  gamesWon: number
  hangJacks: number
  allFours: number // sweeps (won all 4 points in a hand)
  cockGamesWon: number // won when score was 13-13
  form: Array<"W" | "L">
  currentStreak: number
  bestStreak: number
}

export interface TrumpTeamStats {
  teamId: string
  name: string
  colorHex: string
  player1Name: string
  player2Name: string
  matchesPlayed: number
  matchesWon: number
  matchesLost: number
  winRate: number
  handsPlayed: number
  totalPoints: number
  pointsPerHand: number
  highsWon: number
  lowsWon: number
  jacksWon: number
  gamesWon: number
  hangJacks: number
  allFours: number
  cockGamesWon: number
  shutouts: number // 14-0 wins
  form: Array<"W" | "L">
  currentStreak: number
  bestStreak: number
}

export interface TrumpH2HRecord {
  opponentId: string
  opponentName: string
  opponentColor: string
  won: number
  lost: number
  pointsFor: number
  pointsAgainst: number
}

// ─── Tournaments ─────────────────────────────────────────────────────────────

export type TrumpTournamentFormat = "ROUND_ROBIN" | "KNOCKOUT"
export type TrumpTournamentStatus = "upcoming" | "live" | "completed"
export type TrumpTournamentFixtureResult = "team1" | "team2" | "abandoned" | null
export type TrumpTournamentPhase = "league" | "knockout"

export interface TrumpTournamentFixture {
  id: string
  tournamentId: string
  matchId?: string
  team1Id: string
  team2Id: string
  round: number
  phase: TrumpTournamentPhase
  scheduledDate?: Date
  result: TrumpTournamentFixtureResult
  pointsTeam1?: number
  pointsTeam2?: number
}

export interface TrumpTournament {
  id: string
  name: string
  format: TrumpTournamentFormat
  teamIds: string[]
  fixtures: TrumpTournamentFixture[]
  status: TrumpTournamentStatus
  pointsPerWin: number
  pointsPerAbandoned: number
  championTeamId?: string
  createdAt: Date
  completedAt?: Date
}

export interface TrumpTournamentStanding {
  teamId: string
  teamName: string
  colorHex: string
  played: number
  won: number
  lost: number
  abandoned: number
  points: number
  scoreFor: number
  scoreAgainst: number
  pointDiff: number
  allFours: number
  hangJacks: number
}
