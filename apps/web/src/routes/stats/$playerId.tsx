import { createFileRoute, useParams } from "@tanstack/react-router"
import { useLiveQuery } from "dexie-react-hooks"
import { motion } from "framer-motion"
import { ArrowLeft, User, TrendingUp, Zap } from "lucide-react"

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
}

const itemVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 8 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" as const } },
}
import { db } from "@/db/index"
import type { CricketFormat, PlayerBattingStats, PlayerBowlingStats } from "@/types/cricket"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent } from "@workspace/ui/components/card"

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/stats/$playerId")({
  component: PlayerProfilePage,
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNum(v: number | undefined, decimals = 0): string {
  if (v === undefined || !isFinite(v)) return "—"
  return decimals > 0 ? v.toFixed(decimals) : String(v)
}

const FORMATS: (CricketFormat | "ALL")[] = ["ALL", "T20", "ODI", "TEST", "CUSTOM"]

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <motion.div
      variants={itemVariants}
      className="bg-muted/30 rounded-lg p-3 flex flex-col gap-0.5"
    >
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-xl font-bold tabular-nums leading-tight">{value}</p>
    </motion.div>
  )
}

// ─── Batting Form Chart ───────────────────────────────────────────────────────

function battingBarColor(runs: number): string {
  if (runs === 0) return "#ef4444"          // duck — red
  if (runs <= 15) return "#6b7280"          // 1-15 — muted
  if (runs <= 30) return "#3b82f6"          // 16-30 — blue/primary
  if (runs <= 50) return "#22c55e"          // 31-50 — green
  return "#eab308"                          // 50+  — gold
}

function BattingFormChart({ runs }: { runs: number[] }) {
  const n = runs.length
  if (n === 0) return null

  const maxVal = Math.max(...runs, 1)

  // viewBox dimensions
  const VW = 300
  const VH = 100
  const PAD_TOP = 18   // room for score labels
  const PAD_BOTTOM = 4
  const PAD_X = 2
  const chartH = VH - PAD_TOP - PAD_BOTTOM

  const slotW = (VW - PAD_X * 2) / n
  const barW = Math.max(2, slotW - 2)

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-2">Last {n} innings</p>
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        width="100%"
        preserveAspectRatio="none"
        aria-label="Batting recent form"
        style={{ display: "block" }}
      >
        {runs.map((v, i) => {
          const x = PAD_X + i * slotW + (slotW - barW) / 2
          const barH = Math.max(3, (v / maxVal) * chartH)
          const y = PAD_TOP + chartH - barH
          const color = battingBarColor(v)
          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={barH}
                fill={color}
                fillOpacity={0.85}
                rx={1.5}
              />
              <text
                x={x + barW / 2}
                y={y - 3}
                textAnchor="middle"
                fontSize={7}
                fill={color}
                fontWeight="600"
                fontFamily="inherit"
              >
                {v}
              </text>
            </g>
          )
        })}
      </svg>
      {/* Color legend */}
      <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1.5">
        {[
          { label: "Duck", color: "#ef4444" },
          { label: "1-15", color: "#6b7280" },
          { label: "16-30", color: "#3b82f6" },
          { label: "31-50", color: "#22c55e" },
          { label: "50+", color: "#eab308" },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: color }} />
            <span className="text-[9px] text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Bowling Form Chart ────────────────────────────────────────────────────────

function bowlingBarColor(wickets: number): string {
  if (wickets === 0) return "#6b7280"       // 0 — muted
  if (wickets === 1) return "#3b82f6"       // 1 — blue
  if (wickets === 2) return "#22c55e"       // 2 — green
  if (wickets <= 4) return "#eab308"        // 3-4 — gold
  return "#ef4444"                          // 5+ — red (haul)
}

function BowlingFormChart({ wickets }: { wickets: number[] }) {
  const n = wickets.length
  if (n === 0) return null

  const maxVal = Math.max(...wickets, 1)

  const VW = 300
  const VH = 100
  const PAD_TOP = 18
  const PAD_BOTTOM = 4
  const PAD_X = 2
  const chartH = VH - PAD_TOP - PAD_BOTTOM

  const slotW = (VW - PAD_X * 2) / n
  const barW = Math.max(2, slotW - 2)

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-2">Last {n} spells</p>
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        width="100%"
        preserveAspectRatio="none"
        aria-label="Bowling recent form"
        style={{ display: "block" }}
      >
        {wickets.map((v, i) => {
          const x = PAD_X + i * slotW + (slotW - barW) / 2
          const barH = Math.max(3, (v / maxVal) * chartH)
          const y = PAD_TOP + chartH - barH
          const color = bowlingBarColor(v)
          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={barH}
                fill={color}
                fillOpacity={0.85}
                rx={1.5}
              />
              <text
                x={x + barW / 2}
                y={y - 3}
                textAnchor="middle"
                fontSize={7}
                fill={color}
                fontWeight="600"
                fontFamily="inherit"
              >
                {v}w
              </text>
            </g>
          )
        })}
      </svg>
      {/* Color legend */}
      <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1.5">
        {[
          { label: "0w", color: "#6b7280" },
          { label: "1w", color: "#3b82f6" },
          { label: "2w", color: "#22c55e" },
          { label: "3-4w", color: "#eab308" },
          { label: "5w+", color: "#ef4444" },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: color }} />
            <span className="text-[9px] text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Batting tab ──────────────────────────────────────────────────────────────

function BattingTab({ playerId }: { playerId: string }) {
  const allStats = useLiveQuery(async () => {
    const all = await db.battingStats.where("playerId").equals(playerId).toArray()
    return all as PlayerBattingStats[]
  }, [playerId])

  const overall = allStats?.find((s) => s.format === "ALL")
  const byFormat = allStats?.filter((s) => s.format !== "ALL") ?? []

  // Form: get last 10 innings runs from match history
  const formRuns = useLiveQuery(async () => {
    const all = await db.matches
      .where("status")
      .anyOf(["completed", "abandoned"])
      .sortBy("date")
    // sortBy returns ascending — reverse for newest-first
    const recent = all.reverse()

    const innings: number[] = []
    for (const m of recent) {
      for (const inn of m.innings) {
        const entry = inn.battingCard.find((b) => b.playerId === playerId)
        if (entry) innings.push(entry.runs)
        if (innings.length >= 10) break
      }
      if (innings.length >= 10) break
    }
    return innings.reverse()
  }, [playerId])

  if (!overall) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm text-muted-foreground">No batting stats yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-5 pt-3">
      {/* Career grid */}
      <motion.div
        className="grid grid-cols-3 gap-2"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        <StatCard label="Matches" value={fmtNum(overall.matches)} />
        <StatCard label="Innings" value={fmtNum(overall.innings)} />
        <StatCard label="Runs" value={fmtNum(overall.runs)} />
        <StatCard label="Average" value={fmtNum(overall.average, 2)} />
        <StatCard label="SR" value={fmtNum(overall.strikeRate, 1)} />
        <StatCard label="HS" value={`${overall.highScore}${overall.highScoreNotOut ? "*" : ""}`} />
        <StatCard label="50s" value={fmtNum(overall.fifties)} />
        <StatCard label="100s" value={fmtNum(overall.hundreds)} />
        <StatCard label="Ducks" value={fmtNum(overall.ducks)} />
        <StatCard label="4s" value={fmtNum(overall.fours)} />
        <StatCard label="6s" value={fmtNum(overall.sixes)} />
        <StatCard label="Not Outs" value={fmtNum(overall.notOuts)} />
      </motion.div>

      {/* Recent Form chart */}
      {formRuns && formRuns.length > 1 && (
        <Card>
          <CardContent className="py-3 px-4">
            <BattingFormChart runs={formRuns} />
          </CardContent>
        </Card>
      )}

      {/* Format breakdown */}
      {byFormat.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Format Breakdown
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[320px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-2 text-muted-foreground font-medium">Format</th>
                  <th className="text-right py-2 px-2 text-muted-foreground font-medium">M</th>
                  <th className="text-right py-2 px-2 text-muted-foreground font-medium">Inn</th>
                  <th className="text-right py-2 px-2 text-muted-foreground font-medium">Runs</th>
                  <th className="text-right py-2 px-2 text-muted-foreground font-medium">Avg</th>
                  <th className="text-right py-2 px-2 text-muted-foreground font-medium">SR</th>
                  <th className="text-right py-2 px-2 text-muted-foreground font-medium">HS</th>
                </tr>
              </thead>
              <tbody>
                {FORMATS.map((fmt) => {
                  const s = fmt === "ALL" ? overall : byFormat.find((x) => x.format === fmt)
                  if (!s) return null
                  return (
                    <tr key={fmt} className="border-b border-border/40">
                      <td className="py-2 px-2 font-medium">{fmt}</td>
                      <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">{s.matches}</td>
                      <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">{s.innings}</td>
                      <td className="py-2 px-2 text-right tabular-nums font-semibold">{s.runs}</td>
                      <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">
                        {fmtNum(s.average, 1)}
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">
                        {fmtNum(s.strikeRate, 1)}
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">
                        {s.highScore}{s.highScoreNotOut ? "*" : ""}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Bowling tab ──────────────────────────────────────────────────────────────

function BowlingTab({ playerId }: { playerId: string }) {
  const allStats = useLiveQuery(async () => {
    const all = await db.bowlingStats.where("playerId").equals(playerId).toArray()
    return all as PlayerBowlingStats[]
  }, [playerId])

  const overall = allStats?.find((s) => s.format === "ALL")
  const byFormat = allStats?.filter((s) => s.format !== "ALL") ?? []

  // Form: last 10 bowling spells wickets
  const formWickets = useLiveQuery(async () => {
    const all = await db.matches
      .where("status")
      .anyOf(["completed", "abandoned"])
      .sortBy("date")
    const recent = all.reverse()

    const spells: number[] = []
    for (const m of recent) {
      for (const inn of m.innings) {
        const entry = inn.bowlingCard.find((b) => b.playerId === playerId)
        if (entry) spells.push(entry.wickets)
        if (spells.length >= 10) break
      }
      if (spells.length >= 10) break
    }
    return spells.reverse()
  }, [playerId])

  if (!overall) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm text-muted-foreground">No bowling stats yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-5 pt-3">
      {/* Career grid */}
      <motion.div
        className="grid grid-cols-3 gap-2"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        <StatCard label="Matches" value={fmtNum(overall.matches)} />
        <StatCard label="Innings" value={fmtNum(overall.innings)} />
        <StatCard label="Wickets" value={fmtNum(overall.wickets)} />
        <StatCard label="Overs" value={fmtNum(overall.overs, 1)} />
        <StatCard label="Average" value={fmtNum(overall.average, 2)} />
        <StatCard label="Economy" value={fmtNum(overall.economy, 2)} />
        <StatCard label="SR" value={fmtNum(overall.strikeRate, 1)} />
        <StatCard label="Best" value={`${overall.bestWickets}/${overall.bestRuns}`} />
        <StatCard label="Maidens" value={fmtNum(overall.maidens)} />
        <StatCard label="3W" value={fmtNum(overall.threeWicketHauls)} />
        <StatCard label="5W" value={fmtNum(overall.fiveWicketHauls)} />
        <StatCard label="Dots" value={fmtNum(overall.dots)} />
      </motion.div>

      {/* Recent Form chart */}
      {formWickets && formWickets.length > 1 && (
        <Card>
          <CardContent className="py-3 px-4">
            <BowlingFormChart wickets={formWickets} />
          </CardContent>
        </Card>
      )}

      {/* Format breakdown */}
      {byFormat.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Format Breakdown
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[320px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-2 text-muted-foreground font-medium">Format</th>
                  <th className="text-right py-2 px-2 text-muted-foreground font-medium">M</th>
                  <th className="text-right py-2 px-2 text-muted-foreground font-medium">Wkts</th>
                  <th className="text-right py-2 px-2 text-muted-foreground font-medium">Avg</th>
                  <th className="text-right py-2 px-2 text-muted-foreground font-medium">Eco</th>
                  <th className="text-right py-2 px-2 text-muted-foreground font-medium">Best</th>
                </tr>
              </thead>
              <tbody>
                {FORMATS.map((fmt) => {
                  const s = fmt === "ALL" ? overall : byFormat.find((x) => x.format === fmt)
                  if (!s) return null
                  return (
                    <tr key={fmt} className="border-b border-border/40">
                      <td className="py-2 px-2 font-medium">{fmt}</td>
                      <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">{s.matches}</td>
                      <td className="py-2 px-2 text-right tabular-nums font-semibold">{s.wickets}</td>
                      <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">
                        {fmtNum(s.average, 1)}
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">
                        {fmtNum(s.economy, 2)}
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">
                        {s.bestWickets}/{s.bestRuns}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── PlayerProfilePage ────────────────────────────────────────────────────────

function PlayerProfilePage() {
  const { playerId } = useParams({ from: "/stats/$playerId" })

  const player = useLiveQuery(() => db.players.get(playerId), [playerId])
  const team = useLiveQuery(async () => {
    if (!player?.teamId) return undefined
    return db.teams.get(player.teamId)
  }, [player?.teamId])

  if (player === undefined) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <div className="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!player) {
    return (
      <div className="min-h-full flex items-center justify-center px-4">
        <p className="text-sm text-muted-foreground">Player not found</p>
      </div>
    )
  }

  const roleBadgeColor: Record<string, string> = {
    batsman: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    bowler: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    allrounder: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    wicketkeeper: "bg-violet-500/20 text-violet-400 border-violet-500/30",
  }

  return (
    <div className="min-h-full bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => history.back()}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="size-5" />
          </button>
          <h1 className="text-sm font-bold flex-1 truncate">{player.name}</h1>
        </div>
      </div>

      <motion.div
        className="px-4 py-4 space-y-4 pb-8"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        {/* Player header card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
        <Card>
          <CardContent className="py-4 px-4">
            <div className="flex items-center gap-3">
              <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <User className="size-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-bold truncate">{player.name}</p>
                {team && (
                  <p className="text-xs text-muted-foreground mt-0.5">{team.name}</p>
                )}
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  {player.role && (
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 capitalize ${roleBadgeColor[player.role] ?? ""}`}
                    >
                      {player.role}
                    </Badge>
                  )}
                  {player.battingStyle && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {player.battingStyle === "right" ? "RHB" : "LHB"}
                    </Badge>
                  )}
                  {player.bowlingStyle && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {player.bowlingStyle}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        </motion.div>

        {/* Stats tabs */}
        <Tabs defaultValue="batting">
          <TabsList className="w-full">
            <TabsTrigger value="batting" className="flex-1 gap-1.5">
              <TrendingUp className="size-3.5" />
              Batting
            </TabsTrigger>
            <TabsTrigger value="bowling" className="flex-1 gap-1.5">
              <Zap className="size-3.5" />
              Bowling
            </TabsTrigger>
          </TabsList>

          <TabsContent value="batting">
            <BattingTab playerId={playerId} />
          </TabsContent>

          <TabsContent value="bowling">
            <BowlingTab playerId={playerId} />
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  )
}
