import type { BowlerEntry } from "@/types/cricket"

// ─── Types ────────────────────────────────────────────────────────────────────

interface BowlingCardProps {
  bowlingCard: BowlerEntry[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtOvers(overs: number, balls: number): string {
  return balls > 0 ? `${overs}.${balls}` : `${overs}`
}

function fmtEco(eco: number): string {
  return isFinite(eco) && eco > 0 ? eco.toFixed(2) : "0.00"
}

// ─── BowlingCard ──────────────────────────────────────────────────────────────

export function BowlingCard({ bowlingCard }: BowlingCardProps) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-xs min-w-[300px]">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-1.5 px-2 text-muted-foreground font-medium w-full">Bowler</th>
            <th className="text-right py-1.5 px-2 text-muted-foreground font-medium">O</th>
            <th className="text-right py-1.5 px-2 text-muted-foreground font-medium">M</th>
            <th className="text-right py-1.5 px-2 text-muted-foreground font-medium">R</th>
            <th className="text-right py-1.5 px-2 text-muted-foreground font-medium">W</th>
            <th className="text-right py-1.5 px-2 text-muted-foreground font-medium">Eco</th>
            <th className="text-right py-1.5 px-2 text-muted-foreground font-medium">Dots</th>
          </tr>
        </thead>
        <tbody>
          {bowlingCard.map((b) => (
            <tr key={b.playerId} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
              <td className="py-1.5 px-2">{b.playerName}</td>
              <td className="py-1.5 px-2 text-right tabular-nums">{fmtOvers(b.overs, b.balls)}</td>
              <td className="py-1.5 px-2 text-right tabular-nums text-muted-foreground">{b.maidens}</td>
              <td className="py-1.5 px-2 text-right tabular-nums">{b.runs}</td>
              <td className="py-1.5 px-2 text-right tabular-nums font-semibold">
                {b.wickets > 0 ? (
                  <span className="text-primary">{b.wickets}</span>
                ) : (
                  <span className="text-muted-foreground">{b.wickets}</span>
                )}
              </td>
              <td className="py-1.5 px-2 text-right tabular-nums text-muted-foreground">{fmtEco(b.economy)}</td>
              <td className="py-1.5 px-2 text-right tabular-nums text-muted-foreground">{b.dots}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
