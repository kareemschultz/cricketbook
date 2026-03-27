import type { FallOfWicket } from "@/types/cricket"

// ─── Types ────────────────────────────────────────────────────────────────────

interface FallOfWicketsProps {
  fallOfWickets: FallOfWicket[]
}

// ─── FallOfWickets ────────────────────────────────────────────────────────────

export function FallOfWickets({ fallOfWickets }: FallOfWicketsProps) {
  if (!fallOfWickets.length) return null

  return (
    <div className="w-full">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        Fall of Wickets
      </p>
      <div className="flex flex-wrap gap-1.5">
        {fallOfWickets.map((fow) => (
          <div
            key={fow.wicketNumber}
            className="inline-flex items-center gap-1 bg-muted/40 border border-border/50 rounded-full px-2.5 py-1 text-[10px] whitespace-nowrap"
          >
            <span className="text-muted-foreground font-medium">{fow.wicketNumber}</span>
            <span className="text-border/70">·</span>
            <span className="font-semibold tabular-nums">{fow.score}</span>
            <span className="text-border/70">·</span>
            <span className="text-foreground/80 truncate max-w-[80px]">{fow.playerName}</span>
            <span className="text-muted-foreground">({fow.overs})</span>
          </div>
        ))}
      </div>
    </div>
  )
}
