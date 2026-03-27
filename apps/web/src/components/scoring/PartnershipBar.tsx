interface PartnershipBarProps {
  runs: number
  balls: number
  batsman1Runs: number
  batsman2Runs: number
}

export function PartnershipBar({ runs, balls, batsman1Runs, batsman2Runs }: PartnershipBarProps) {
  const total = batsman1Runs + batsman2Runs
  const b1Pct = total > 0 ? (batsman1Runs / total) * 100 : 50
  const b2Pct = 100 - b1Pct

  return (
    <div className="px-3 py-1.5 border-b border-border/50">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
          Partnership
        </span>
        <span className="text-xs font-semibold tabular-nums text-foreground">
          {runs} <span className="text-muted-foreground font-normal">({balls} balls)</span>
        </span>
      </div>
      {/* Split bar */}
      <div className="flex h-1.5 rounded-full overflow-hidden gap-px bg-transparent">
        <div
          className="bg-primary/60 rounded-l-full transition-all"
          style={{ width: `${b1Pct}%` }}
          title={`${batsman1Runs} runs`}
        />
        <div
          className="bg-cricket-six/60 rounded-r-full transition-all"
          style={{ width: `${b2Pct}%` }}
          title={`${batsman2Runs} runs`}
        />
      </div>
      <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5 tabular-nums">
        <span>{batsman1Runs}</span>
        <span>{batsman2Runs}</span>
      </div>
    </div>
  )
}
