import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useLiveQuery } from "dexie-react-hooks"
import { format } from "date-fns"
import { Plus, Trophy, ExternalLink } from "lucide-react"
import { motion } from "framer-motion"
import { db } from "@/db/index"
import { computePlayerStats } from "@/lib/stats"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

// ─── Animation variants ───────────────────────────────────────────────────────

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" as const } },
}

// ─── Player Avatar ────────────────────────────────────────────────────────────

function PlayerAvatar({ name, color, size = "sm" }: { name: string; color: string; size?: "sm" | "md" }) {
  const initials = name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
  const sizeClass = size === "md" ? "size-8 text-sm" : "size-6 text-xs"
  return (
    <div
      className={cn("rounded-full flex items-center justify-center font-bold text-white shrink-0", sizeClass)}
      style={{ backgroundColor: color }}
    >
      {initials}
    </div>
  )
}

// ─── Form Pill ────────────────────────────────────────────────────────────────

function FormPill({ result }: { result: "W" | "D" | "L" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center size-5 rounded-full text-[9px] font-bold text-white",
        result === "W" && "bg-emerald-500",
        result === "D" && "bg-amber-500",
        result === "L" && "bg-red-500"
      )}
    >
      {result}
    </span>
  )
}

// ─── Leaderboard Table ────────────────────────────────────────────────────────

function LeaderboardTable() {
  const players = useLiveQuery(() => db.players.orderBy("createdAt").toArray())
  const matches = useLiveQuery(() => db.matches.toArray())

  if (!players || !matches) {
    return (
      <div className="space-y-1">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 bg-muted rounded animate-pulse" />
        ))}
      </div>
    )
  }

  if (players.length === 0 || matches.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Trophy className="size-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Add players and record matches to see the leaderboard</p>
        </CardContent>
      </Card>
    )
  }

  const stats = computePlayerStats(players, matches)

  return (
    <div className="overflow-x-auto -mx-4">
      <table className="w-full text-xs min-w-[520px] px-4">
        <thead>
          <tr className="text-muted-foreground border-b border-border">
            <th className="pl-4 pr-2 py-2 text-left font-medium w-8">#</th>
            <th className="px-2 py-2 text-left font-medium">Player</th>
            <th className="px-2 py-2 text-center font-medium">P</th>
            <th className="px-2 py-2 text-center font-medium">W</th>
            <th className="px-2 py-2 text-center font-medium">D</th>
            <th className="px-2 py-2 text-center font-medium">L</th>
            <th className="px-2 py-2 text-center font-medium">GF</th>
            <th className="px-2 py-2 text-center font-medium">GA</th>
            <th className="px-2 py-2 text-center font-medium">GD</th>
            <th className="px-2 py-2 text-center font-medium font-bold">Pts</th>
            <th className="pr-4 pl-2 py-2 text-center font-medium">Form</th>
          </tr>
        </thead>
        <motion.tbody
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          {stats.map((s, idx) => (
            <motion.tr
              key={s.playerId}
              variants={itemVariants}
              className={cn(
                "border-b border-border/50 transition-colors",
                idx === 0 && "bg-primary/5"
              )}
            >
              <td className="pl-4 pr-2 py-2.5 text-muted-foreground font-medium">{idx + 1}</td>
              <td className="px-2 py-2.5">
                <div className="flex items-center gap-2">
                  <PlayerAvatar name={s.name} color={s.colorHex} />
                  <span className="font-medium truncate max-w-[100px]">{s.name}</span>
                </div>
              </td>
              <td className="px-2 py-2.5 text-center tabular-nums">{s.played}</td>
              <td className="px-2 py-2.5 text-center tabular-nums text-emerald-500">{s.won}</td>
              <td className="px-2 py-2.5 text-center tabular-nums text-amber-500">{s.drawn}</td>
              <td className="px-2 py-2.5 text-center tabular-nums text-red-500">{s.lost}</td>
              <td className="px-2 py-2.5 text-center tabular-nums">{s.goalsFor}</td>
              <td className="px-2 py-2.5 text-center tabular-nums">{s.goalsAgainst}</td>
              <td className="px-2 py-2.5 text-center tabular-nums">
                <span className={s.goalDifference > 0 ? "text-emerald-500" : s.goalDifference < 0 ? "text-red-500" : ""}>
                  {s.goalDifference > 0 ? `+${s.goalDifference}` : s.goalDifference}
                </span>
              </td>
              <td className="px-2 py-2.5 text-center tabular-nums font-bold text-primary">{s.points}</td>
              <td className="pr-4 pl-2 py-2.5">
                <div className="flex items-center justify-center gap-0.5">
                  {s.form.length === 0
                    ? <span className="text-muted-foreground">—</span>
                    : s.form.map((r, i) => <FormPill key={i} result={r} />)
                  }
                </div>
              </td>
            </motion.tr>
          ))}
        </motion.tbody>
      </table>
    </div>
  )
}

// ─── Recent Match Card ────────────────────────────────────────────────────────

function RecentMatchCard() {
  const data = useLiveQuery(async () => {
    const matches = await db.matches.orderBy("date").reverse().limit(5).toArray()
    const players = await db.players.toArray()
    const playerMap = new Map(players.map((p) => [p.id, p]))
    return matches.map((m) => ({
      ...m,
      p1: playerMap.get(m.player1Id),
      p2: playerMap.get(m.player2Id),
    }))
  })

  if (!data || data.length === 0) return null

  return (
    <div className="space-y-2">
      {data.map((m) => {
        const winner =
          m.player1Score > m.player2Score
            ? m.p1?.name
            : m.player2Score > m.player1Score
              ? m.p2?.name
              : null

        return (
          <motion.div key={m.id} whileTap={{ scale: 0.98 }}>
            <Card className="hover:bg-muted/50 transition-colors">
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {m.p1 && <PlayerAvatar name={m.p1.name} color={m.p1.colorHex} />}
                    <span className="font-semibold text-sm tabular-nums">
                      {m.player1Score} – {m.player2Score}
                    </span>
                    {m.p2 && <PlayerAvatar name={m.p2.name} color={m.p2.colorHex} />}
                    <div className="min-w-0">
                      <span className="text-sm font-medium truncate">
                        {m.p1?.name ?? "?"} vs {m.p2?.name ?? "?"}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-muted-foreground">
                      {format(new Date(m.date), "d MMM")}
                    </p>
                    {winner && (
                      <p className="text-[10px] text-emerald-500 font-medium">{winner} wins</p>
                    )}
                    {!winner && (
                      <p className="text-[10px] text-amber-500 font-medium">Draw</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )
      })}
    </div>
  )
}

// ─── Home Page ────────────────────────────────────────────────────────────────

function HomePage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-full bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
              <span className="text-green-500">⚽</span> FIFABook
            </h1>
            <p className="text-xs text-muted-foreground">
              {format(new Date(), "EEEE, d MMMM yyyy")}
            </p>
          </div>
          <motion.div whileTap={{ scale: 0.95 }}>
            <Button
              size="sm"
              onClick={() => navigate({ to: "/matches/new" })}
              className="gap-1"
            >
              <Plus className="size-4" />
              Record
            </Button>
          </motion.div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-5">
        {/* Leaderboard */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Leaderboard
          </h2>
          <Card>
            <CardContent className="px-0 pb-2 pt-0">
              <LeaderboardTable />
            </CardContent>
          </Card>
        </section>

        {/* Recent Matches */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Recent Matches
            </h2>
            <button
              className="text-xs text-primary font-medium"
              onClick={() => navigate({ to: "/matches" })}
            >
              See all
            </button>
          </div>
          <RecentMatchCard />
        </section>

        {/* Switch link */}
        <div className="pt-2 pb-4 text-center">
          <a
            href="/cricketbook/"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Switch to CricketBook
            <ExternalLink className="size-3" />
          </a>
        </div>
      </div>
    </div>
  )
}

export const Route = createFileRoute("/")({
  component: HomePage,
})
