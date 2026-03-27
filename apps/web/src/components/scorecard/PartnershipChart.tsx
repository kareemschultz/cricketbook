import type { Partnership } from "@/types/cricket"
import { db } from "@/db/index"
import { useLiveQuery } from "dexie-react-hooks"

// ─── Types ────────────────────────────────────────────────────────────────────

interface PartnershipChartProps {
  partnerships: Partnership[]
  totalRuns: number
}

// ─── PartnershipChart ─────────────────────────────────────────────────────────

export function PartnershipChart({ partnerships, totalRuns }: PartnershipChartProps) {
  // Look up player names from Dexie
  const playerIds = [
    ...new Set(partnerships.flatMap((p) => [p.batsman1Id, p.batsman2Id])),
  ]

  const players = useLiveQuery(async () => {
    if (!playerIds.length) return {}
    const all = await db.players.where("id").anyOf(playerIds).toArray()
    return Object.fromEntries(all.map((p) => [p.id, p.name]))
  }, [playerIds.join(",")])

  const getName = (id: string) => players?.[id] ?? id.slice(0, 8)

  if (!partnerships.length) return null

  const maxRuns = Math.max(...partnerships.map((p) => p.runs), 1)

  return (
    <div className="w-full space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Partnerships
      </p>

      {partnerships.map((p) => {
        const pct = totalRuns > 0 ? (p.runs / totalRuns) * 100 : 0
        const barPct = (p.runs / maxRuns) * 100
        const name1 = getName(p.batsman1Id)
        const name2 = getName(p.batsman2Id)

        return (
          <div key={p.wicketNumber} className="space-y-0.5">
            {/* Header row */}
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-foreground/80 truncate max-w-[200px]">
                {name1} &amp; {name2}
              </span>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <span className="font-semibold tabular-nums">{p.runs} runs</span>
                <span className="text-muted-foreground tabular-nums">({p.balls} b)</span>
                <span className="text-muted-foreground">{pct.toFixed(0)}%</span>
              </div>
            </div>

            {/* Bar */}
            <div className="h-2.5 bg-muted/40 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-primary/70 transition-all duration-300"
                style={{ width: `${barPct}%` }}
              />
            </div>

            {/* Sub-contributions */}
            <div className="flex items-center gap-3 text-[9px] text-muted-foreground">
              <span>{name1.split(" ")[0]}: {p.batsman1Runs}</span>
              <span>{name2.split(" ")[0]}: {p.batsman2Runs}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
