import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useLiveQuery } from "dexie-react-hooks"
import { formatDistanceToNow } from "date-fns"
import { Search, Clock, Trophy } from "lucide-react"
import { useState } from "react"
import { db } from "@/db/index"
import type { Match } from "@/types/cricket"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Badge } from "@workspace/ui/components/badge"
import { Input } from "@workspace/ui/components/input"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBadgeClass(format: Match["format"]) {
  const map: Record<Match["format"], string> = {
    T20: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    ODI: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    TEST: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    CUSTOM: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  }
  return map[format]
}

function statusBadgeClass(status: Match["status"]) {
  if (status === "abandoned")
    return "bg-red-500/20 text-red-400 border-red-500/30"
  return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
}

function getTeamScore(match: Match, teamId: string): string {
  const innings = match.innings.filter((i) => i.battingTeamId === teamId)
  if (!innings.length) return "—"
  return innings
    .map((i) => `${i.totalRuns}/${i.totalWickets}`)
    .join(" & ")
}

// ─── Match Row ────────────────────────────────────────────────────────────────

function MatchRow({ match }: { match: Match }) {
  const navigate = useNavigate()
  const team1Score = getTeamScore(match, match.team1Id)
  const team2Score = getTeamScore(match, match.team2Id)

  return (
    <button
      className="w-full text-left"
      onClick={() =>
        navigate({ to: "/scorecard/$matchId", params: { matchId: match.id } })
      }
    >
      <Card className="hover:bg-muted/50 active:bg-muted/70 transition-colors">
        <CardContent className="py-3 px-4">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              {/* Teams */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold text-sm">{match.team1Name}</span>
                <span className="text-xs text-muted-foreground">vs</span>
                <span className="font-semibold text-sm">{match.team2Name}</span>
              </div>

              {/* Scores */}
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground tabular-nums">
                  {team1Score}
                </span>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {team2Score}
                </span>
              </div>

              {/* Result */}
              {match.result && (
                <p className="text-xs text-primary font-medium mt-1 leading-tight">
                  {match.result}
                </p>
              )}
            </div>

            {/* Right column: badges + date */}
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <div className="flex items-center gap-1">
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 ${formatBadgeClass(match.format)}`}
                >
                  {match.format}
                </Badge>
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 ${statusBadgeClass(match.status)}`}
                >
                  {match.status === "abandoned" ? "ABD" : "FIN"}
                </Badge>
              </div>
              <span className="text-[10px] text-muted-foreground">
                {formatDistanceToNow(new Date(match.date), { addSuffix: true })}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </button>
  )
}

// ─── History Page ─────────────────────────────────────────────────────────────

function HistoryPage() {
  const [search, setSearch] = useState("")

  const matches = useLiveQuery(async () => {
    const all = await db.matches
      .where("status")
      .anyOf(["completed", "abandoned"])
      .reverse()
      .sortBy("date")
    return all
  })

  const filtered =
    search.trim() === ""
      ? (matches ?? [])
      : (matches ?? []).filter(
          (m) =>
            m.team1Name.toLowerCase().includes(search.toLowerCase()) ||
            m.team2Name.toLowerCase().includes(search.toLowerCase())
        )

  return (
    <div className="min-h-full bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="size-5 text-primary" />
          <h1 className="text-lg font-bold tracking-tight">Match History</h1>
        </div>
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            placeholder="Search by team name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="px-4 py-4">
        {matches === undefined ? (
          /* Loading skeleton */
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i}>
                <CardContent className="py-3 px-4">
                  <div className="h-4 bg-muted rounded animate-pulse w-3/4 mb-2" />
                  <div className="h-3 bg-muted rounded animate-pulse w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Trophy className="size-12 text-muted-foreground/40 mb-4" />
            {search.trim() !== "" ? (
              <>
                <p className="text-sm font-medium text-muted-foreground">
                  No matches found
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Try a different team name
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-muted-foreground">
                  No match history yet
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Completed matches will appear here
                </p>
              </>
            )}
          </div>
        ) : (
          /* Match list */
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground mb-3">
              {filtered.length} match{filtered.length !== 1 ? "es" : ""}
              {search.trim() !== "" && " found"}
            </p>
            {filtered.map((match) => (
              <MatchRow key={match.id} match={match} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export const Route = createFileRoute("/history")({
  component: HistoryPage,
})
