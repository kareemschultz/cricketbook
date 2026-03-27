import Dexie, { type EntityTable } from "dexie"
import type { FifaPlayer, FifaMatch } from "@/types/fifa"

class FifaDB extends Dexie {
  players!: EntityTable<FifaPlayer, "id">
  matches!: EntityTable<FifaMatch, "id">

  constructor() {
    super("FifaBookDB")
    this.version(1).stores({
      players: "id, name, createdAt",
      matches: "id, date, player1Id, player2Id",
    })
  }
}

export const db = new FifaDB()
