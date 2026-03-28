// ─── Export / Import types ─────────────────────────────────────────────────
//
// ExportPayload is the canonical shape written to JSON by Settings → Export.
// Versioned at schemaVersion 3 (covers all 17 DB tables).

import type {
  Team,
  Player,
  Match,
  Tournament,
  PlayerBattingStats,
  PlayerBowlingStats,
  AppSettings,
} from "@/types/cricket"
import type { FifaPlayer, FifaMatch } from "@/types/fifa"
import type {
  DominoPlayer,
  DominoTeam,
  DominoMatch,
  DominoTournament,
} from "@/types/dominoes"
import type {
  TrumpPlayer,
  TrumpTeam,
  TrumpMatch,
  TrumpTournament,
} from "@/types/trump"

// ─── Import mode ──────────────────────────────────────────────────────────────

/** How to handle records that already exist in the local DB during an import. */
export type ImportMode =
  | "replace" // bulkPut — overwrite existing records (default)
  | "merge"   // bulkAdd skipping existing keys — keeps current data, adds new records only

// ─── Integrity metadata ───────────────────────────────────────────────────────

export interface ExportIntegrity {
  /** Hash algorithm used to produce the digest. */
  algorithm: "sha256"
  /**
   * Hex-encoded SHA-256 of the canonical JSON representation of the 17 data
   * tables (in EXPORT_TABLE_KEYS order). Metadata fields (exportedAt, version,
   * schemaVersion, integrity) are excluded from the hash input so that
   * re-exporting identical data always produces the same hash.
   */
  hash: string
}

// ─── Payload ──────────────────────────────────────────────────────────────────

/** Full export payload — schema version 3. */
export interface ExportPayload {
  exportedAt: string
  version: string
  schemaVersion: 3
  integrity: ExportIntegrity
  // Cricket
  teams: Team[]
  players: Player[]
  matches: Match[]
  tournaments: Tournament[]
  battingStats: (PlayerBattingStats & { id: string })[]
  bowlingStats: (PlayerBowlingStats & { id: string })[]
  // FIFA
  fifaPlayers: FifaPlayer[]
  fifaMatches: FifaMatch[]
  // Dominoes
  dominoPlayers: DominoPlayer[]
  dominoTeams: DominoTeam[]
  dominoMatches: DominoMatch[]
  dominoTournaments: DominoTournament[]
  // Trump
  trumpPlayers: TrumpPlayer[]
  trumpTeams: TrumpTeam[]
  trumpMatches: TrumpMatch[]
  trumpTournaments: TrumpTournament[]
  // Settings (singleton array, always length 0 or 1)
  settings: (AppSettings & { id: string })[]
}

// ─── Canonical table key order (used for integrity hash) ──────────────────────

/**
 * Fixed ordering of the 17 data-table keys used when computing the integrity
 * hash. This order must never change — changing it would invalidate all
 * previously exported hashes.
 */
export const EXPORT_TABLE_KEYS = [
  "teams",
  "players",
  "matches",
  "tournaments",
  "battingStats",
  "bowlingStats",
  "fifaPlayers",
  "fifaMatches",
  "dominoPlayers",
  "dominoTeams",
  "dominoMatches",
  "dominoTournaments",
  "trumpPlayers",
  "trumpTeams",
  "trumpMatches",
  "trumpTournaments",
  "settings",
] as const

export type ExportTableKey = (typeof EXPORT_TABLE_KEYS)[number]
