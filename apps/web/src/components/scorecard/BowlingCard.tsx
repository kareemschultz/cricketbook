import { motion } from "framer-motion"
import type { BowlerEntry } from "@/types/cricket"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"

const rowVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { duration: 0.18, delay: i * 0.04, ease: "easeOut" as const },
  }),
}

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatHeader({ label, tip }: { label: string; tip: string }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="cursor-help border-b border-dotted border-muted-foreground/40" />}>
        {label}
      </TooltipTrigger>
      <TooltipContent>{tip}</TooltipContent>
    </Tooltip>
  )
}

// ─── BowlingCard ──────────────────────────────────────────────────────────────

export function BowlingCard({ bowlingCard }: BowlingCardProps) {
  return (
    <TooltipProvider>
    <div className="w-full overflow-x-auto">
      <table className="w-full text-xs min-w-[300px]">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-1.5 px-2 text-muted-foreground font-medium w-full">Bowler</th>
            <th className="text-right py-1.5 px-2 text-muted-foreground font-medium"><StatHeader label="O" tip="Overs bowled" /></th>
            <th className="text-right py-1.5 px-2 text-muted-foreground font-medium"><StatHeader label="M" tip="Maidens — overs with no runs" /></th>
            <th className="text-right py-1.5 px-2 text-muted-foreground font-medium"><StatHeader label="R" tip="Runs conceded" /></th>
            <th className="text-right py-1.5 px-2 text-muted-foreground font-medium"><StatHeader label="W" tip="Wickets taken" /></th>
            <th className="text-right py-1.5 px-2 text-muted-foreground font-medium"><StatHeader label="Eco" tip="Economy — runs conceded per over" /></th>
            <th className="text-right py-1.5 px-2 text-muted-foreground font-medium"><StatHeader label="Dots" tip="Dot balls — deliveries with no run scored" /></th>
          </tr>
        </thead>
        <tbody>
          {bowlingCard.map((b, i) => (
            <motion.tr
              key={b.playerId}
              custom={i}
              variants={rowVariants}
              initial="hidden"
              animate="visible"
              className="border-b border-border/40 hover:bg-muted/30 transition-colors"
            >
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
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
    </TooltipProvider>
  )
}
