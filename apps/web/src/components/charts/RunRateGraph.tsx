import { useRef, useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import type { Ball } from "@/types/cricket"

// ─── Types ────────────────────────────────────────────────────────────────────

interface RunRateGraphProps {
  balls: Ball[]
  target: number
  ballsPerOver: number
  totalBalls: number
  height?: number
}

interface RRPoint {
  over: number
  crr: number
  rrr: number
}

interface TooltipState {
  x: number
  over: number
  crr: number
  rrr: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeRRPoints(
  balls: Ball[],
  target: number,
  ballsPerOver: number,
  totalBalls: number
): RRPoint[] {
  const points: RRPoint[] = []
  let cumRuns = 0
  let legalCount = 0

  for (const ball of balls) {
    cumRuns += ball.runs
    if (ball.isLegal) {
      legalCount++
      const over = legalCount / ballsPerOver
      const crr = legalCount > 0 ? (cumRuns / legalCount) * ballsPerOver : 0
      const ballsRemaining = totalBalls - legalCount
      const needed = target - cumRuns
      const rrr = ballsRemaining > 0 ? (needed / ballsRemaining) * ballsPerOver : 0
      points.push({ over, crr, rrr: Math.max(0, rrr) })
    }
  }

  return points
}

function pointsToPath(
  vals: { over: number; v: number }[],
  toX: (o: number) => number,
  toY: (r: number) => number
): string {
  return vals
    .map((p, i) => `${i === 0 ? "M" : "L"}${toX(p.over).toFixed(1)},${toY(p.v).toFixed(1)}`)
    .join(" ")
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PADDING = { top: 12, right: 8, bottom: 28, left: 28 }

// ─── RunRateGraph ─────────────────────────────────────────────────────────────

export function RunRateGraph({
  balls,
  target,
  ballsPerOver,
  totalBalls,
  height = 160,
}: RunRateGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(320)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w && w > 0) setWidth(w)
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  const chartW = width - PADDING.left - PADDING.right
  const chartH = height - PADDING.top - PADDING.bottom

  const maxOvers = totalBalls / ballsPerOver
  const pts = computeRRPoints(balls, target, ballsPerOver, totalBalls)

  if (pts.length === 0) {
    return (
      <div ref={containerRef} className="w-full flex items-center justify-center" style={{ height }}>
        <p className="text-xs text-muted-foreground">No data</p>
      </div>
    )
  }

  const allRates = pts.flatMap((p) => [p.crr, p.rrr]).filter((v) => isFinite(v))
  const maxRate = Math.max(...allRates, 6)

  const yTick = maxRate <= 12 ? 2 : maxRate <= 24 ? 4 : 6
  const yMax = Math.ceil(maxRate / yTick) * yTick

  const toX = (over: number) => (over / maxOvers) * chartW
  const toY = (rate: number) => chartH - (Math.min(rate, yMax) / yMax) * chartH

  const crrPts = pts.map((p) => ({ over: p.over, v: p.crr }))
  const rrrPts = pts.map((p) => ({ over: p.over, v: p.rrr }))

  const crrPath = pointsToPath(crrPts, toX, toY)
  const rrrPath = pointsToPath(rrrPts, toX, toY)

  const yTicks: number[] = []
  for (let v = 0; v <= yMax; v += yTick) yTicks.push(v)

  const xTicks: number[] = []
  for (let i = 0; i <= maxOvers; i += 5) xTicks.push(i)

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const svgX = e.clientX - rect.left - PADDING.left
    if (svgX < 0 || svgX > chartW) {
      setTooltip(null)
      return
    }
    const over = (svgX / chartW) * maxOvers
    const nearest = pts.reduce((best, p) =>
      Math.abs(p.over - over) < Math.abs(best.over - over) ? p : best
    )
    setTooltip({
      x: toX(nearest.over) + PADDING.left,
      over: nearest.over,
      crr: nearest.crr,
      rrr: nearest.rrr,
    })
  }

  return (
    <div ref={containerRef} className="w-full">
      {/* Legend */}
      <div className="flex items-center gap-4 mb-1 px-1">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-0.5 bg-blue-500" />
          <span className="text-[10px] text-muted-foreground">CRR</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-0.5 bg-red-500" />
          <span className="text-[10px] text-muted-foreground">RRR</span>
        </div>
        <span className="text-[10px] text-muted-foreground ml-auto">Target: {target}</span>
      </div>

      <div className="relative">
        <svg
          width={width}
          height={height}
          aria-label="Run rate graph"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setTooltip(null)}
        >
          <g transform={`translate(${PADDING.left},${PADDING.top})`}>
            {/* Y grid + labels */}
            {yTicks.map((v) => (
              <g key={v}>
                <line
                  x1={0} x2={chartW} y1={toY(v)} y2={toY(v)}
                  stroke="currentColor" strokeOpacity={0.08} strokeWidth={1}
                />
                <text
                  x={-4} y={toY(v)} textAnchor="end" dominantBaseline="middle"
                  className="fill-muted-foreground" fontSize={8}
                >
                  {v}
                </text>
              </g>
            ))}

            {/* X ticks */}
            {xTicks.map((ov) => (
              <text
                key={ov}
                x={toX(ov)} y={chartH + 12}
                textAnchor="middle" className="fill-muted-foreground" fontSize={8}
              >
                {ov}
              </text>
            ))}
            <text x={chartW / 2} y={chartH + 22} textAnchor="middle" className="fill-muted-foreground" fontSize={7}>
              Overs
            </text>

            {/* Hover crosshair */}
            {tooltip && (
              <line
                x1={tooltip.x - PADDING.left}
                x2={tooltip.x - PADDING.left}
                y1={0} y2={chartH}
                stroke="currentColor" strokeOpacity={0.25} strokeWidth={1}
                strokeDasharray="2 2"
              />
            )}

            {/* RRR line — dashed, fade in (pathLength conflicts with strokeDasharray) */}
            {rrrPts.length > 1 && (
              <motion.path
                d={rrrPath}
                fill="none"
                stroke="rgb(239,68,68)"
                strokeWidth={1.5}
                strokeLinejoin="round"
                strokeLinecap="round"
                strokeDasharray="4 2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.9 }}
                transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
              />
            )}

            {/* CRR line — solid, animated path draw */}
            {crrPts.length > 1 && (
              <motion.path
                d={crrPath}
                fill="none"
                stroke="rgb(59,130,246)"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 0.9 }}
                transition={{ duration: 1.5, ease: "easeInOut" }}
              />
            )}

            {/* Hover dots */}
            {tooltip && (
              <>
                <circle
                  cx={tooltip.x - PADDING.left}
                  cy={toY(tooltip.crr)}
                  r={3.5}
                  fill="rgb(59,130,246)"
                  stroke="white"
                  strokeWidth={1.5}
                />
                <circle
                  cx={tooltip.x - PADDING.left}
                  cy={toY(tooltip.rrr)}
                  r={3}
                  fill="rgb(239,68,68)"
                  stroke="white"
                  strokeWidth={1.5}
                />
              </>
            )}

            {/* Axes */}
            <line x1={0} x2={0} y1={0} y2={chartH} stroke="currentColor" strokeOpacity={0.2} strokeWidth={1} />
            <line x1={0} x2={chartW} y1={chartH} y2={chartH} stroke="currentColor" strokeOpacity={0.2} strokeWidth={1} />
          </g>
        </svg>

        {/* Tooltip */}
        <AnimatePresence>
          {tooltip && (
            <motion.div
              key="rrg-tooltip"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="absolute pointer-events-none z-10 bg-background/95 backdrop-blur-sm border border-border rounded-lg px-2.5 py-2 shadow-lg min-w-[110px]"
              style={{
                left: Math.max(4, Math.min(tooltip.x - 55, width - 120)),
                top: PADDING.top,
              }}
            >
              <p className="text-[10px] font-semibold text-foreground mb-1">
                Ov {Math.floor(tooltip.over)}.{Math.round((tooltip.over % 1) * ballsPerOver)}
              </p>
              <div className="flex items-center justify-between gap-3 text-[10px]">
                <div className="flex items-center gap-1">
                  <div className="w-2.5 h-0.5 bg-blue-500" />
                  <span className="text-muted-foreground">CRR</span>
                </div>
                <span className="font-semibold tabular-nums">{tooltip.crr.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-[10px] mt-0.5">
                <div className="flex items-center gap-1">
                  <div className="w-2.5 h-0.5 bg-red-500" />
                  <span className="text-muted-foreground">RRR</span>
                </div>
                <span className="font-semibold tabular-nums">{tooltip.rrr.toFixed(2)}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
