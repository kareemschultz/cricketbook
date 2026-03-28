import { db } from "@/db/index"
import type {
  Team,
  Player,
  Match,
  Ball,
  BatsmanEntry,
  BowlerEntry,
  FallOfWicket,
  Innings,
} from "@/types/cricket"
import { DEFAULT_RULES } from "@/types/cricket"
import { updatePlayerStatsFromMatch } from "@/lib/stats-calculator"

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

function mkPlayer(name: string, teamId: string): Player {
  return {
    id: uid(),
    name,
    teamId,
    role: "batsman",
    battingStyle: "right",
    createdAt: new Date("2026-01-01"),
  }
}

function mkBall(
  overrides: Partial<Ball> & Pick<Ball, "inningsIndex" | "overNumber" | "batsmanId" | "bowlerId">
): Ball {
  return {
    id: uid(),
    ballInOver: 0,
    deliveryNumber: 0,
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
    timestamp: new Date("2026-01-15"),
    ...overrides,
  }
}

export async function seedDemoMatch(): Promise<string | null> {
  // Check if demo data already exists
  const existing = await db.teams.where("name").equals("Royals").first()
  if (existing) return null

  // ── Teams ──────────────────────────────────────────────────────────────────
  const royalsId = uid()
  const warriorsId = uid()

  const royals: Team = {
    id: royalsId,
    name: "Royals",
    shortName: "ROY",
    colorHex: "#3b82f6",
    createdAt: new Date("2026-01-01"),
  }
  const warriors: Team = {
    id: warriorsId,
    name: "Warriors",
    shortName: "WAR",
    colorHex: "#f59e0b",
    createdAt: new Date("2026-01-01"),
  }

  // ── Players — Royals ───────────────────────────────────────────────────────
  const royalsPlayers: Player[] = [
    mkPlayer("Dwayne Fletcher",  royalsId),
    mkPlayer("Marcus Brathwaite", royalsId),
    mkPlayer("Andre Ramsaran",   royalsId),
    mkPlayer("Rohan Persad",     royalsId),
    mkPlayer("Keon Charles",     royalsId),
    mkPlayer("Fabian St. Hill",  royalsId),
    mkPlayer("Tyrone Baptiste",  royalsId),
    mkPlayer("Jerome Walcott",   royalsId),
    mkPlayer("Clive Hooper",     royalsId),
    mkPlayer("Ravi Seepersad",   royalsId),
    mkPlayer("Vikram Narine",    royalsId),
  ]

  // ── Players — Warriors ─────────────────────────────────────────────────────
  const warriorsPlayers: Player[] = [
    mkPlayer("Sanjay Ramkhelawan", warriorsId),
    mkPlayer("Darren Phillip",     warriorsId),
    mkPlayer("Curtis Julien",      warriorsId),
    mkPlayer("Anil Beharry",       warriorsId),
    mkPlayer("Shane Cummins",      warriorsId),
    mkPlayer("Devon Mohammed",     warriorsId),
    mkPlayer("Ricardo King",       warriorsId),
    mkPlayer("Omari Pascal",       warriorsId),
    mkPlayer("Dexter Griffith",    warriorsId),
    mkPlayer("Patrick Boodoo",     warriorsId),
    mkPlayer("Lester Ramoutar",    warriorsId),
  ]

  const rp = royalsPlayers
  const wp = warriorsPlayers

  // ── Match ID ───────────────────────────────────────────────────────────────
  const matchId = uid()
  const rules = DEFAULT_RULES.T20

  // ── Ball Log helpers ───────────────────────────────────────────────────────
  // We'll create 2 overs (12 balls) of ball-by-ball data per innings
  // Innings 1 (Royals bat): 167/6 in 20 overs
  // Innings 2 (Warriors bat): 142/8 in 20 overs

  // Innings 1 ball log: over 0 and over 1
  const i1balls: Ball[] = []
  const bowlerId_w1 = wp[0].id // Sanjay
  const bowlerId_w2 = wp[1].id // Darren

  // Over 0 bowled by Sanjay: 1,4,0,1,6,2 → 14 runs
  const over0runs = [1, 4, 0, 1, 6, 2]
  over0runs.forEach((r, idx) => {
    i1balls.push(mkBall({
      inningsIndex: 0,
      overNumber: 0,
      ballInOver: idx,
      deliveryNumber: idx,
      batsmanId: rp[0].id,
      bowlerId: bowlerId_w1,
      runs: r,
      batsmanRuns: r,
      isLegal: true,
      powerplay: true,
    }))
  })

  // Over 1 bowled by Darren: 0,2,W,1,4,1 → 8 runs, 1 wicket (rp[0] out bowled)
  const over1data: Array<{ runs: number; isW: boolean; batsman: string }> = [
    { runs: 0, isW: false, batsman: rp[0].id },
    { runs: 2, isW: false, batsman: rp[0].id },
    { runs: 0, isW: true,  batsman: rp[0].id },
    { runs: 1, isW: false, batsman: rp[1].id },
    { runs: 4, isW: false, batsman: rp[1].id },
    { runs: 1, isW: false, batsman: rp[1].id },
  ]
  over1data.forEach((d, idx) => {
    const ball = mkBall({
      inningsIndex: 0,
      overNumber: 1,
      ballInOver: idx,
      deliveryNumber: 6 + idx,
      batsmanId: d.batsman,
      bowlerId: bowlerId_w2,
      runs: d.runs,
      batsmanRuns: d.runs,
      isLegal: true,
      powerplay: true,
    })
    if (d.isW) {
      ball.isWicket = true
      ball.dismissalType = "bowled"
      ball.dismissedPlayerId = rp[0].id
      ball.dismissalText = `b ${wp[1].name}`
      ball.runs = 0
      ball.batsmanRuns = 0
    }
    i1balls.push(ball)
  })

  // ── Innings 1 batting card ────────────────────────────────────────────────
  const innings1BattingCard: BatsmanEntry[] = [
    { playerId: rp[0].id, playerName: rp[0].name, position: 1, runs: 28, balls: 22, fours: 3, sixes: 1, dots: 8, strikeRate: 127.27, isOut: true, isRetiredHurt: false, dismissalType: "bowled", dismissalText: `b ${wp[1].name}` },
    { playerId: rp[1].id, playerName: rp[1].name, position: 2, runs: 45, balls: 32, fours: 4, sixes: 2, dots: 9, strikeRate: 140.63, isOut: true, isRetiredHurt: false, dismissalType: "caught", dismissalText: `c ${wp[3].name} b ${wp[0].name}` },
    { playerId: rp[2].id, playerName: rp[2].name, position: 3, runs: 38, balls: 29, fours: 3, sixes: 1, dots: 10, strikeRate: 131.03, isOut: true, isRetiredHurt: false, dismissalType: "lbw", dismissalText: `lbw b ${wp[2].name}` },
    { playerId: rp[3].id, playerName: rp[3].name, position: 4, runs: 22, balls: 18, fours: 2, sixes: 0, dots: 7, strikeRate: 122.22, isOut: true, isRetiredHurt: false, dismissalType: "runOut", dismissalText: `run out (${wp[5].name})` },
    { playerId: rp[4].id, playerName: rp[4].name, position: 5, runs: 15, balls: 11, fours: 1, sixes: 1, dots: 4, strikeRate: 136.36, isOut: true, isRetiredHurt: false, dismissalType: "caught", dismissalText: `c ${wp[6].name} b ${wp[1].name}` },
    { playerId: rp[5].id, playerName: rp[5].name, position: 6, runs: 12, balls: 9,  fours: 1, sixes: 0, dots: 4, strikeRate: 133.33, isOut: true, isRetiredHurt: false, dismissalType: "stumped", dismissalText: `st ${wp[7].name} b ${wp[4].name}` },
    { playerId: rp[6].id, playerName: rp[6].name, position: 7, runs: 7,  balls: 6,  fours: 0, sixes: 0, dots: 3, strikeRate: 116.67, isOut: false, isRetiredHurt: false, dismissalText: "not out" },
  ]

  // ── Innings 1 bowling card ─────────────────────────────────────────────────
  const innings1BowlingCard: BowlerEntry[] = [
    { playerId: wp[0].id, playerName: wp[0].name, overs: 4, balls: 0, maidens: 0, runs: 38, wickets: 1, economy: 9.5,  dots: 8,  wides: 2, noBalls: 0, legalDeliveries: 24 },
    { playerId: wp[1].id, playerName: wp[1].name, overs: 4, balls: 0, maidens: 0, runs: 32, wickets: 2, economy: 8.0,  dots: 10, wides: 1, noBalls: 0, legalDeliveries: 24 },
    { playerId: wp[2].id, playerName: wp[2].name, overs: 4, balls: 0, maidens: 1, runs: 28, wickets: 1, economy: 7.0,  dots: 12, wides: 0, noBalls: 0, legalDeliveries: 24 },
    { playerId: wp[3].id, playerName: wp[3].name, overs: 4, balls: 0, maidens: 0, runs: 35, wickets: 1, economy: 8.75, dots: 7,  wides: 3, noBalls: 1, legalDeliveries: 24 },
    { playerId: wp[4].id, playerName: wp[4].name, overs: 4, balls: 0, maidens: 0, runs: 34, wickets: 1, economy: 8.5,  dots: 9,  wides: 1, noBalls: 0, legalDeliveries: 24 },
  ]

  // ── Innings 1 fall of wickets ──────────────────────────────────────────────
  const innings1FOW: FallOfWicket[] = [
    { wicketNumber: 1, score: 46,  overs: "7.3",  playerId: rp[0].id, playerName: rp[0].name, dismissalText: innings1BattingCard[0].dismissalText },
    { wicketNumber: 2, score: 89,  overs: "12.1", playerId: rp[1].id, playerName: rp[1].name, dismissalText: innings1BattingCard[1].dismissalText },
    { wicketNumber: 3, score: 118, overs: "15.4", playerId: rp[2].id, playerName: rp[2].name, dismissalText: innings1BattingCard[2].dismissalText },
    { wicketNumber: 4, score: 138, overs: "17.2", playerId: rp[3].id, playerName: rp[3].name, dismissalText: innings1BattingCard[3].dismissalText },
    { wicketNumber: 5, score: 151, overs: "18.5", playerId: rp[4].id, playerName: rp[4].name, dismissalText: innings1BattingCard[4].dismissalText },
    { wicketNumber: 6, score: 160, overs: "19.3", playerId: rp[5].id, playerName: rp[5].name, dismissalText: innings1BattingCard[5].dismissalText },
  ]

  // ── Innings 2 ball log ─────────────────────────────────────────────────────
  const i2balls: Ball[] = []
  const bowlerId_r1 = rp[8].id // Clive Hooper
  const bowlerId_r2 = rp[9].id // Ravi Seepersad

  // Over 0 bowled by Clive: 2,0,4,1,0,3 → 10 runs
  const i2over0runs = [2, 0, 4, 1, 0, 3]
  i2over0runs.forEach((r, idx) => {
    i2balls.push(mkBall({
      inningsIndex: 1,
      overNumber: 0,
      ballInOver: idx,
      deliveryNumber: idx,
      batsmanId: wp[0].id,
      bowlerId: bowlerId_r1,
      runs: r,
      batsmanRuns: r,
      isLegal: true,
      powerplay: true,
    }))
  })

  // Over 1 bowled by Ravi: 1,W,0,6,2,1 → 10 runs, 1 wicket
  const i2over1data: Array<{ runs: number; isW: boolean; batsman: string }> = [
    { runs: 1, isW: false, batsman: wp[0].id },
    { runs: 0, isW: true,  batsman: wp[0].id },
    { runs: 0, isW: false, batsman: wp[1].id },
    { runs: 6, isW: false, batsman: wp[1].id },
    { runs: 2, isW: false, batsman: wp[1].id },
    { runs: 1, isW: false, batsman: wp[1].id },
  ]
  i2over1data.forEach((d, idx) => {
    const ball = mkBall({
      inningsIndex: 1,
      overNumber: 1,
      ballInOver: idx,
      deliveryNumber: 6 + idx,
      batsmanId: d.batsman,
      bowlerId: bowlerId_r2,
      runs: d.runs,
      batsmanRuns: d.runs,
      isLegal: true,
      powerplay: true,
    })
    if (d.isW) {
      ball.isWicket = true
      ball.dismissalType = "caught"
      ball.dismissedPlayerId = wp[0].id
      ball.dismissalText = `c ${rp[3].name} b ${rp[9].name}`
      ball.runs = 0
      ball.batsmanRuns = 0
    }
    i2balls.push(ball)
  })

  // ── Innings 2 batting card ─────────────────────────────────────────────────
  const innings2BattingCard: BatsmanEntry[] = [
    { playerId: wp[0].id, playerName: wp[0].name, position: 1, runs: 18, balls: 14, fours: 2, sixes: 1, dots: 5, strikeRate: 128.57, isOut: true, isRetiredHurt: false, dismissalType: "caught", dismissalText: `c ${rp[3].name} b ${rp[9].name}` },
    { playerId: wp[1].id, playerName: wp[1].name, position: 2, runs: 41, balls: 30, fours: 3, sixes: 2, dots: 8, strikeRate: 136.67, isOut: true, isRetiredHurt: false, dismissalType: "bowled", dismissalText: `b ${rp[8].name}` },
    { playerId: wp[2].id, playerName: wp[2].name, position: 3, runs: 29, balls: 23, fours: 2, sixes: 1, dots: 7, strikeRate: 126.09, isOut: true, isRetiredHurt: false, dismissalType: "lbw", dismissalText: `lbw b ${rp[10].name}` },
    { playerId: wp[3].id, playerName: wp[3].name, position: 4, runs: 17, balls: 14, fours: 1, sixes: 0, dots: 5, strikeRate: 121.43, isOut: true, isRetiredHurt: false, dismissalType: "caught", dismissalText: `c ${rp[1].name} b ${rp[10].name}` },
    { playerId: wp[4].id, playerName: wp[4].name, position: 5, runs: 14, balls: 12, fours: 1, sixes: 0, dots: 4, strikeRate: 116.67, isOut: true, isRetiredHurt: false, dismissalType: "runOut", dismissalText: `run out (${rp[4].name})` },
    { playerId: wp[5].id, playerName: wp[5].name, position: 6, runs: 9,  balls: 8,  fours: 0, sixes: 1, dots: 3, strikeRate: 112.50, isOut: true, isRetiredHurt: false, dismissalType: "stumped", dismissalText: `st ${rp[6].name} b ${rp[9].name}` },
    { playerId: wp[6].id, playerName: wp[6].name, position: 7, runs: 8,  balls: 7,  fours: 1, sixes: 0, dots: 3, strikeRate: 114.29, isOut: true, isRetiredHurt: false, dismissalType: "bowled", dismissalText: `b ${rp[8].name}` },
    { playerId: wp[7].id, playerName: wp[7].name, position: 8, runs: 4,  balls: 5,  fours: 0, sixes: 0, dots: 3, strikeRate: 80.0,   isOut: true, isRetiredHurt: false, dismissalType: "caught", dismissalText: `c ${rp[0].name} b ${rp[10].name}` },
    { playerId: wp[8].id, playerName: wp[8].name, position: 9, runs: 2,  balls: 4,  fours: 0, sixes: 0, dots: 3, strikeRate: 50.0,   isOut: false, isRetiredHurt: false, dismissalText: "not out" },
  ]

  // ── Innings 2 bowling card ─────────────────────────────────────────────────
  const innings2BowlingCard: BowlerEntry[] = [
    { playerId: rp[8].id,  playerName: rp[8].name,  overs: 4, balls: 0, maidens: 0, runs: 29, wickets: 2, economy: 7.25, dots: 10, wides: 1, noBalls: 0, legalDeliveries: 24 },
    { playerId: rp[9].id,  playerName: rp[9].name,  overs: 4, balls: 0, maidens: 1, runs: 24, wickets: 2, economy: 6.0,  dots: 12, wides: 0, noBalls: 0, legalDeliveries: 24 },
    { playerId: rp[10].id, playerName: rp[10].name, overs: 4, balls: 0, maidens: 0, runs: 31, wickets: 3, economy: 7.75, dots: 9,  wides: 2, noBalls: 0, legalDeliveries: 24 },
    { playerId: rp[7].id,  playerName: rp[7].name,  overs: 4, balls: 0, maidens: 0, runs: 34, wickets: 1, economy: 8.5,  dots: 7,  wides: 1, noBalls: 1, legalDeliveries: 24 },
    { playerId: rp[6].id,  playerName: rp[6].name,  overs: 4, balls: 0, maidens: 0, runs: 24, wickets: 0, economy: 6.0,  dots: 11, wides: 0, noBalls: 0, legalDeliveries: 24 },
  ]

  // ── Innings 2 fall of wickets ──────────────────────────────────────────────
  const innings2FOW: FallOfWicket[] = [
    { wicketNumber: 1, score: 26,  overs: "4.1",  playerId: wp[0].id, playerName: wp[0].name, dismissalText: innings2BattingCard[0].dismissalText },
    { wicketNumber: 2, score: 62,  overs: "9.3",  playerId: wp[1].id, playerName: wp[1].name, dismissalText: innings2BattingCard[1].dismissalText },
    { wicketNumber: 3, score: 86,  overs: "13.2", playerId: wp[2].id, playerName: wp[2].name, dismissalText: innings2BattingCard[2].dismissalText },
    { wicketNumber: 4, score: 102, overs: "15.5", playerId: wp[3].id, playerName: wp[3].name, dismissalText: innings2BattingCard[3].dismissalText },
    { wicketNumber: 5, score: 113, overs: "17.1", playerId: wp[4].id, playerName: wp[4].name, dismissalText: innings2BattingCard[4].dismissalText },
    { wicketNumber: 6, score: 121, overs: "18.2", playerId: wp[5].id, playerName: wp[5].name, dismissalText: innings2BattingCard[5].dismissalText },
    { wicketNumber: 7, score: 131, overs: "19.1", playerId: wp[6].id, playerName: wp[6].name, dismissalText: innings2BattingCard[6].dismissalText },
    { wicketNumber: 8, score: 139, overs: "19.5", playerId: wp[7].id, playerName: wp[7].name, dismissalText: innings2BattingCard[7].dismissalText },
  ]

  // ── Assemble innings ───────────────────────────────────────────────────────
  const innings1: Innings = {
    index: 0,
    battingTeamId: royalsId,
    bowlingTeamId: warriorsId,
    status: "completed",
    totalRuns: 167,
    totalWickets: 6,
    totalOvers: 20,
    totalBalls: 0,
    totalLegalDeliveries: 120,
    extras: { wide: 7, noBall: 1, bye: 0, legBye: 2, penalty: 0, total: 10 },
    battingCard: innings1BattingCard,
    bowlingCard: innings1BowlingCard,
    ballLog: i1balls,
    fallOfWickets: innings1FOW,
    partnerships: [],
    isDeclared: false,
  }

  const innings2: Innings = {
    index: 1,
    battingTeamId: warriorsId,
    bowlingTeamId: royalsId,
    status: "completed",
    totalRuns: 142,
    totalWickets: 8,
    totalOvers: 20,
    totalBalls: 0,
    totalLegalDeliveries: 120,
    extras: { wide: 4, noBall: 1, bye: 0, legBye: 1, penalty: 0, total: 6 },
    battingCard: innings2BattingCard,
    bowlingCard: innings2BowlingCard,
    ballLog: i2balls,
    fallOfWickets: innings2FOW,
    partnerships: [],
    target: 168,
    isDeclared: false,
  }

  const playingXI1 = rp.map((p) => p.id)
  const playingXI2 = wp.map((p) => p.id)

  const match: Match = {
    id: matchId,
    format: "T20",
    rules,
    team1Id: royalsId,
    team2Id: warriorsId,
    team1Name: "Royals",
    team2Name: "Warriors",
    playingXI1,
    playingXI2,
    tossWonBy: royalsId,
    tossDecision: "bat",
    innings: [innings1, innings2],
    currentInningsIndex: 1,
    result: "Royals won by 25 runs",
    winner: royalsId,
    date: new Date("2026-01-15"),
    status: "completed",
    isSuperOver: false,
  }

  // ── Write to DB ────────────────────────────────────────────────────────────
  await db.transaction("rw", [db.teams, db.players, db.matches], async () => {
    await db.teams.bulkAdd([royals, warriors])
    await db.players.bulkAdd([...royalsPlayers, ...warriorsPlayers])
    await db.matches.add(match)
  })

  // Update player stats
  try {
    await updatePlayerStatsFromMatch(match)
  } catch {
    // Non-fatal
  }

  return matchId
}

// ─── FIFA Demo Data ───────────────────────────────────────────────────────────

import type { FifaPlayer, FifaMatch } from "@/types/fifa"

/**
 * Seeds 5 FIFA players + 20 matches of demo data.
 * Returns true if data was inserted, false if already present.
 */
export async function seedDemoFifaData(): Promise<boolean> {
  const existing = await db.fifaPlayers.count()
  if (existing > 0) return false

  const p0 = uid(), p1 = uid(), p2 = uid(), p3 = uid(), p4 = uid()

  const players: FifaPlayer[] = [
    { id: p0, name: "Kareem",  colorHex: "#3b82f6", createdAt: new Date("2025-10-01") },
    { id: p1, name: "Marcus",  colorHex: "#ef4444", createdAt: new Date("2025-10-01") },
    { id: p2, name: "Andre",   colorHex: "#22c55e", createdAt: new Date("2025-10-01") },
    { id: p3, name: "Rohan",   colorHex: "#a855f7", createdAt: new Date("2025-10-01") },
    { id: p4, name: "Sanjay",  colorHex: "#f59e0b", createdAt: new Date("2025-10-01") },
  ]

  // [p1Id, p2Id, p1Score, p2Score, date]
  type MatchRow = [string, string, number, number, string]
  const rows: MatchRow[] = [
    [p0, p1, 3, 1, "2025-11-01"],
    [p2, p3, 2, 2, "2025-11-03"],
    [p1, p2, 4, 2, "2025-11-05"],
    [p0, p3, 5, 3, "2025-11-08"],
    [p4, p1, 2, 3, "2025-11-10"],
    [p0, p2, 1, 1, "2025-11-12"],
    [p3, p4, 4, 1, "2025-11-15"],
    [p1, p4, 3, 2, "2025-11-17"],
    [p2, p0, 1, 4, "2025-11-20"],
    [p4, p3, 2, 2, "2025-11-22"],
    [p0, p4, 6, 2, "2025-11-25"],
    [p1, p3, 2, 3, "2025-11-28"],
    [p2, p4, 3, 1, "2025-12-01"],
    [p0, p1, 2, 4, "2025-12-05"],
    [p3, p2, 3, 3, "2025-12-08"],
    [p4, p0, 1, 3, "2025-12-12"],
    [p1, p2, 2, 2, "2025-12-15"],
    [p3, p0, 1, 2, "2025-12-18"],
    [p4, p2, 4, 3, "2025-12-22"],
    [p0, p3, 3, 1, "2025-12-25"],
  ]

  const matches: FifaMatch[] = rows.map(([player1Id, player2Id, player1Score, player2Score, date]) => ({
    id: uid(),
    player1Id,
    player2Id,
    player1Score,
    player2Score,
    date: new Date(date),
  }))

  await db.transaction("rw", [db.fifaPlayers, db.fifaMatches], async () => {
    await db.fifaPlayers.bulkAdd(players)
    await db.fifaMatches.bulkAdd(matches)
  })

  return true
}

// ─── Dominoes Demo Data ───────────────────────────────────────────────────────

import type { DominoPlayer, DominoTeam, DominoMatch, DominoHand } from "@/types/dominoes"

function mkDominoHand(
  n: number, winner: string | null, endType: "domino" | "pose" | "draw",
  points = 0, dominoedBy?: string
): DominoHand {
  return { handNumber: n, winnerId: winner, endType, points, passes: [], dominoedByPlayerId: dominoedBy }
}

export async function seedDemoDominoData(): Promise<boolean> {
  const existing = await db.dominoPlayers.count()
  if (existing > 0) return false

  const dp0 = uid(), dp1 = uid(), dp2 = uid(), dp3 = uid()
  const dp4 = uid(), dp5 = uid(), dp6 = uid(), dp7 = uid()

  const players: DominoPlayer[] = [
    { id: dp0, name: "Big Yard",    colorHex: "#3b82f6", createdAt: new Date("2026-01-01") },
    { id: dp1, name: "Slammer",     colorHex: "#3b82f6", createdAt: new Date("2026-01-01") },
    { id: dp2, name: "Quiet Storm", colorHex: "#ef4444", createdAt: new Date("2026-01-01") },
    { id: dp3, name: "Teacher",     colorHex: "#ef4444", createdAt: new Date("2026-01-01") },
    { id: dp4, name: "Brainiac",    colorHex: "#22c55e", createdAt: new Date("2026-01-01") },
    { id: dp5, name: "Spider",      colorHex: "#22c55e", createdAt: new Date("2026-01-01") },
    { id: dp6, name: "Hammer",      colorHex: "#a855f7", createdAt: new Date("2026-01-01") },
    { id: dp7, name: "Ace",         colorHex: "#a855f7", createdAt: new Date("2026-01-01") },
  ]

  const dt0 = uid(), dt1 = uid(), dt2 = uid(), dt3 = uid()

  const teams: DominoTeam[] = [
    { id: dt0, name: "Road Warriors", player1Id: dp0, player2Id: dp1, colorHex: "#3b82f6", createdAt: new Date("2026-01-01") },
    { id: dt1, name: "Corner Crew",   player1Id: dp2, player2Id: dp3, colorHex: "#ef4444", createdAt: new Date("2026-01-01") },
    { id: dt2, name: "Rumshop Kings", player1Id: dp4, player2Id: dp5, colorHex: "#22c55e", createdAt: new Date("2026-01-01") },
    { id: dt3, name: "Block Stars",   player1Id: dp6, player2Id: dp7, colorHex: "#a855f7", createdAt: new Date("2026-01-01") },
  ]

  const matches: DominoMatch[] = [
    // Road Warriors 6 - 3 Corner Crew
    {
      id: uid(), date: new Date("2026-02-01"), scoringMode: "hands", targetHands: 6, targetPoints: 100,
      team1Id: dt0, team2Id: dt1,
      hands: [
        mkDominoHand(1, dt0, "domino", 12, dp0),
        mkDominoHand(2, dt1, "pose",   8),
        mkDominoHand(3, dt0, "domino", 15, dp1),
        mkDominoHand(4, dt0, "pose",   6),
        mkDominoHand(5, dt1, "domino", 10, dp2),
        mkDominoHand(6, dt0, "domino", 9,  dp0),
        mkDominoHand(7, dt1, "pose",   7),
        mkDominoHand(8, dt0, "pose",   11),
        mkDominoHand(9, dt0, "domino", 8,  dp1),
      ],
      team1Score: 6, team2Score: 3, winnerId: dt0, status: "completed",
    },
    // Rumshop Kings 6 - 2 Block Stars
    {
      id: uid(), date: new Date("2026-02-08"), scoringMode: "hands", targetHands: 6, targetPoints: 100,
      team1Id: dt2, team2Id: dt3,
      hands: [
        mkDominoHand(1, dt2, "domino", 14, dp4),
        mkDominoHand(2, dt2, "pose",   9),
        mkDominoHand(3, dt3, "domino", 11, dp6),
        mkDominoHand(4, dt2, "domino", 7,  dp5),
        mkDominoHand(5, dt2, "pose",   13),
        mkDominoHand(6, dt3, "pose",   6),
        mkDominoHand(7, dt2, "domino", 10, dp4),
        mkDominoHand(8, dt2, "domino", 5,  dp5),
      ],
      team1Score: 6, team2Score: 2, winnerId: dt2, status: "completed",
    },
    // Road Warriors 5 - 6 Rumshop Kings (close game)
    {
      id: uid(), date: new Date("2026-02-15"), scoringMode: "hands", targetHands: 6, targetPoints: 100,
      team1Id: dt0, team2Id: dt2,
      hands: [
        mkDominoHand(1,  dt0, "domino", 12, dp0),
        mkDominoHand(2,  dt2, "domino", 9,  dp4),
        mkDominoHand(3,  dt0, "pose",   7),
        mkDominoHand(4,  dt2, "domino", 11, dp5),
        mkDominoHand(5,  dt0, "domino", 13, dp1),
        mkDominoHand(6,  dt2, "pose",   8),
        mkDominoHand(7,  dt0, "domino", 10, dp0),
        mkDominoHand(8,  dt2, "domino", 6,  dp4),
        mkDominoHand(9,  dt0, "pose",   14),
        mkDominoHand(10, dt2, "pose",   9),
        mkDominoHand(11, dt2, "domino", 7,  dp5),
      ],
      team1Score: 5, team2Score: 6, winnerId: dt2, status: "completed",
    },
    // Corner Crew 6 - 1 Block Stars
    {
      id: uid(), date: new Date("2026-02-22"), scoringMode: "hands", targetHands: 6, targetPoints: 100,
      team1Id: dt1, team2Id: dt3,
      hands: [
        mkDominoHand(1, dt1, "domino", 15, dp2),
        mkDominoHand(2, dt1, "pose",   8),
        mkDominoHand(3, dt3, "domino", 11, dp7),
        mkDominoHand(4, dt1, "domino", 9,  dp3),
        mkDominoHand(5, dt1, "pose",   12),
        mkDominoHand(6, dt1, "domino", 7,  dp2),
        mkDominoHand(7, dt1, "domino", 10, dp3),
      ],
      team1Score: 6, team2Score: 1, winnerId: dt1, status: "completed",
    },
    // Road Warriors 6 - 4 Block Stars
    {
      id: uid(), date: new Date("2026-03-01"), scoringMode: "hands", targetHands: 6, targetPoints: 100,
      team1Id: dt0, team2Id: dt3,
      hands: [
        mkDominoHand(1,  dt3, "domino", 12, dp6),
        mkDominoHand(2,  dt0, "domino", 9,  dp1),
        mkDominoHand(3,  dt3, "pose",   11),
        mkDominoHand(4,  dt0, "domino", 7,  dp0),
        mkDominoHand(5,  dt3, "domino", 13, dp7),
        mkDominoHand(6,  dt0, "pose",   8),
        mkDominoHand(7,  dt0, "domino", 10, dp1),
        mkDominoHand(8,  dt3, "pose",   6),
        mkDominoHand(9,  dt0, "domino", 9,  dp0),
        mkDominoHand(10, dt0, "pose",   14),
      ],
      team1Score: 6, team2Score: 4, winnerId: dt0, status: "completed",
    },
  ]

  await db.transaction("rw", [db.dominoPlayers, db.dominoTeams, db.dominoMatches], async () => {
    await db.dominoPlayers.bulkAdd(players)
    await db.dominoTeams.bulkAdd(teams)
    await db.dominoMatches.bulkAdd(matches)
  })

  return true
}

// ─── Trump / All Fours Demo Data ──────────────────────────────────────────────

import type { TrumpPlayer, TrumpTeam, TrumpMatch, TrumpHand, TrumpSuit } from "@/types/trump"

function mkTrumpHand(
  n: number, suit: TrumpSuit, dealer: string,
  hi: string | null, lo: string | null, jack: string | null, game: string | null,
  t1: string, t2: string,
  hj = false
): TrumpHand {
  const pts = (teamId: string) => {
    let p = 0
    if (hi === teamId) p++
    if (lo === teamId) p++
    if (jack === teamId) p += hj ? 2 : 1
    if (game === teamId) p++
    return p
  }
  return {
    handNumber: n, trumpSuit: suit, dealerTeamId: dealer,
    begged: false, kicked: false, gaveOne: false,
    highTeamId: hi, lowTeamId: lo, jackTeamId: jack, gameTeamId: game,
    hangJack: hj, hangJackTeamId: hj ? jack : null,
    team1Points: pts(t1), team2Points: pts(t2),
  }
}

export async function seedDemoTrumpData(): Promise<boolean> {
  const existing = await db.trumpPlayers.count()
  if (existing > 0) return false

  const tp0 = uid(), tp1 = uid(), tp2 = uid(), tp3 = uid()
  const tp4 = uid(), tp5 = uid(), tp6 = uid(), tp7 = uid()

  const players: TrumpPlayer[] = [
    { id: tp0, name: "King Pin",  colorHex: "#3b82f6", createdAt: new Date("2026-01-01") },
    { id: tp1, name: "Tricky",    colorHex: "#3b82f6", createdAt: new Date("2026-01-01") },
    { id: tp2, name: "Dealer",    colorHex: "#ef4444", createdAt: new Date("2026-01-01") },
    { id: tp3, name: "Shuffle",   colorHex: "#ef4444", createdAt: new Date("2026-01-01") },
    { id: tp4, name: "High Card", colorHex: "#22c55e", createdAt: new Date("2026-01-01") },
    { id: tp5, name: "Low Blow",  colorHex: "#22c55e", createdAt: new Date("2026-01-01") },
    { id: tp6, name: "Jack Man",  colorHex: "#a855f7", createdAt: new Date("2026-01-01") },
    { id: tp7, name: "Bossman",   colorHex: "#a855f7", createdAt: new Date("2026-01-01") },
  ]

  const tt0 = uid(), tt1 = uid(), tt2 = uid(), tt3 = uid()

  const teams: TrumpTeam[] = [
    { id: tt0, name: "Aces High",   player1Id: tp0, player2Id: tp1, colorHex: "#3b82f6", createdAt: new Date("2026-01-01") },
    { id: tt1, name: "Jack Attack", player1Id: tp2, player2Id: tp3, colorHex: "#ef4444", createdAt: new Date("2026-01-01") },
    { id: tt2, name: "Trump Lords", player1Id: tp4, player2Id: tp5, colorHex: "#22c55e", createdAt: new Date("2026-01-01") },
    { id: tt3, name: "Card Sharks", player1Id: tp6, player2Id: tp7, colorHex: "#a855f7", createdAt: new Date("2026-01-01") },
  ]

  // Match 1: Aces High (tt0) 14 - 8 Jack Attack (tt1)
  // H pts:  3-1, 2-2, 3-1, 2-2, 2-2, 2-0  → running: 3,5,8,10,12,14 vs 1,3,4,6,8,8
  const m1h: TrumpHand[] = [
    mkTrumpHand(1, "hearts",   tt0, tt0, tt0, tt1, tt0, tt0, tt1),
    mkTrumpHand(2, "spades",   tt1, tt0, tt1, tt0, tt1, tt0, tt1),
    mkTrumpHand(3, "diamonds", tt0, tt0, tt0, tt1, tt0, tt0, tt1),
    mkTrumpHand(4, "clubs",    tt1, tt0, tt1, tt0, tt1, tt0, tt1),
    mkTrumpHand(5, "hearts",   tt0, tt0, tt1, tt0, tt1, tt0, tt1),
    mkTrumpHand(6, "spades",   tt1, tt0, tt0, null, null, tt0, tt1),
  ]

  // Match 2: Trump Lords (tt2) 6 - 14 Card Sharks (tt3)
  // H pts:  1-3, 1-3, 2-2, 1-3, 1-3  → running: 1,2,4,5,6 vs 3,6,8,11,14
  const m2h: TrumpHand[] = [
    mkTrumpHand(1, "hearts",   tt2, tt3, tt3, tt2, tt3, tt2, tt3),
    mkTrumpHand(2, "diamonds", tt3, tt3, tt3, tt2, tt3, tt2, tt3),
    mkTrumpHand(3, "spades",   tt2, tt2, tt3, tt2, tt3, tt2, tt3),
    mkTrumpHand(4, "clubs",    tt3, tt3, tt3, tt2, tt3, tt2, tt3),
    mkTrumpHand(5, "hearts",   tt2, tt3, tt3, tt2, tt3, tt2, tt3),
  ]

  // Match 3: Jack Attack (tt1) 14 - 10 Trump Lords (tt2)
  // H pts:  2-2, 3-1, 1-3, 2-2, 3-1, 1-1, 2-0  → running: 2,5,6,8,11,12,14 vs 2,3,6,8,9,10,10
  const m3h: TrumpHand[] = [
    mkTrumpHand(1, "hearts",   tt1, tt1, tt2, tt1, tt2, tt1, tt2),
    mkTrumpHand(2, "spades",   tt2, tt1, tt1, tt2, tt1, tt1, tt2),
    mkTrumpHand(3, "diamonds", tt1, tt2, tt2, tt1, tt2, tt1, tt2),
    mkTrumpHand(4, "clubs",    tt2, tt1, tt2, tt1, tt2, tt1, tt2),
    mkTrumpHand(5, "hearts",   tt1, tt1, tt1, tt2, tt1, tt1, tt2),
    mkTrumpHand(6, "spades",   tt2, tt1, tt2, null, null, tt1, tt2),
    mkTrumpHand(7, "diamonds", tt1, tt1, tt1, null, null, tt1, tt2),
  ]

  // Match 4: Aces High (tt0) 13 - 14 Card Sharks (tt3) — cock game!
  // H pts:  3-1, 2-2, 3-1, 1-3, 1-3, 3-1, 0-2, 0-1
  // Running: 3,5,8,9,10,13,13,13 vs 1,3,4,7,10,11,13,14
  const m4h: TrumpHand[] = [
    mkTrumpHand(1, "hearts",   tt0, tt0, tt0, tt3, tt0, tt0, tt3),
    mkTrumpHand(2, "spades",   tt3, tt0, tt3, tt0, tt3, tt0, tt3),
    mkTrumpHand(3, "diamonds", tt0, tt0, tt0, tt3, tt0, tt0, tt3),
    mkTrumpHand(4, "clubs",    tt3, tt3, tt3, tt0, tt3, tt0, tt3),
    mkTrumpHand(5, "hearts",   tt0, tt3, tt3, tt0, tt3, tt0, tt3),
    mkTrumpHand(6, "spades",   tt3, tt0, tt0, tt3, tt0, tt0, tt3),
    mkTrumpHand(7, "diamonds", tt0, tt3, null, null, tt3, tt0, tt3),
    mkTrumpHand(8, "clubs",    tt3, tt3, null, null, null, tt0, tt3),
  ]

  const matches: TrumpMatch[] = [
    {
      id: uid(), date: new Date("2026-02-03"), targetScore: 14,
      team1Id: tt0, team2Id: tt1, hands: m1h,
      team1Score: 14, team2Score: 8, winnerId: tt0, status: "completed",
    },
    {
      id: uid(), date: new Date("2026-02-10"), targetScore: 14,
      team1Id: tt2, team2Id: tt3, hands: m2h,
      team1Score: 6, team2Score: 14, winnerId: tt3, status: "completed",
    },
    {
      id: uid(), date: new Date("2026-02-17"), targetScore: 14,
      team1Id: tt1, team2Id: tt2, hands: m3h,
      team1Score: 14, team2Score: 10, winnerId: tt1, status: "completed",
    },
    {
      id: uid(), date: new Date("2026-02-24"), targetScore: 14,
      team1Id: tt0, team2Id: tt3, hands: m4h,
      team1Score: 13, team2Score: 14, winnerId: tt3, status: "completed",
    },
  ]

  await db.transaction("rw", [db.trumpPlayers, db.trumpTeams, db.trumpMatches], async () => {
    await db.trumpPlayers.bulkAdd(players)
    await db.trumpTeams.bulkAdd(teams)
    await db.trumpMatches.bulkAdd(matches)
  })

  return true
}
