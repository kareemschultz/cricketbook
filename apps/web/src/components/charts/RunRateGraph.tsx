import { useRef, useState, useEffect } from "react"
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
  const toY = (rate: number) => chartH - Math.min(rate, yMax) / yMax * chartH

  const toPolyline = (vals: { over: number; v: number }[]) =>
    vals.map((p) => `${toX(p.over)},${toY(p.v)}`).join(" ")

  const crrPts = pts.map((p) => ({ over: p.over, v: p.crr }))
  const rrrPts = pts.map((p) => ({ over: p.over, v: p.rrr }))

  const yTicks: number[] = []
  for (let v = 0; v <= yMax; v += yTick) yTicks.push(v)

  const xTicks: number[] = []
  for (let i = 0; i <= maxOvers; i += 5) xTicks.push(i)

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

      <svg width={width} height={height} aria-label="Run rate graph">
        <g transform={`translate(${PADDING.left},${PADDING.top})`}>
          {/* Y grid + labels */}
          {yTicks.map((v) => (
            <g key={v}>
              <line
                x1={0} x2={chartW}
                y1={toY(v)} y2={toY(v)}
                stroke="currentColor" strokeOpacity={0.08} strokeWidth={1}
              />
              <text
                x={-4} y={toY(v)}
                textAnchor="end" dominantBaseline="middle"
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
              textAnchor="middle"
              className="fill-muted-foreground" fontSize={8}
            >
              {ov}
            </text>
          ))}
          <text x={chartW / 2} y={chartH + 22} textAnchor="middle" className="fill-muted-foreground" fontSize={7}>
            Overs
          </text>

          {/* RRR line */}
          {rrrPts.length > 1 && (
            <polyline
              points={toPolyline(rrrPts)}
              fill="none"
              stroke="rgb(239,68,68)"
              strokeWidth={1.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray="4 2"
              opacity={0.9}
            />
          )}

          {/* CRR line */}
          {crrPts.length > 1 && (
            <polyline
              points={toPolyline(crrPts)}
              fill="none"
              stroke="rgb(59,130,246)"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity={0.9}
            />
          )}

          {/* Axes */}
          <line x1={0} x2={0} y1={0} y2={chartH} stroke="currentColor" strokeOpacity={0.2} strokeWidth={1} />
          <line x1={0} x2={chartW} y1={chartH} y2={chartH} stroke="currentColor" strokeOpacity={0.2} strokeWidth={1} />
        </g>
      </svg>
    </div>
  )
}
