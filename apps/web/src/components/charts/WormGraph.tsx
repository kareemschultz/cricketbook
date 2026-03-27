import { useRef, useState, useEffect } from "react"
import type { Ball } from "@/types/cricket"

// ─── Types ────────────────────────────────────────────────────────────────────

interface WormGraphProps {
  innings1Balls: Ball[]
  innings2Balls?: Ball[]
  ballsPerOver: number
  maxOvers: number
  team1Name: string
  team2Name?: string
  height?: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface WormPoint {
  over: number
  runs: number
  isWicket: boolean
}

function computeWormPoints(balls: Ball[], ballsPerOver: number): WormPoint[] {
  const points: WormPoint[] = [{ over: 0, runs: 0, isWicket: false }]
  let cumRuns = 0
  let legalCount = 0

  for (const ball of balls) {
    cumRuns += ball.runs
    if (ball.isLegal) {
      legalCount++
      const over = legalCount / ballsPerOver
      points.push({ over, runs: cumRuns, isWicket: ball.isWicket })
    }
  }

  return points
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PADDING = { top: 12, right: 8, bottom: 28, left: 28 }

// ─── WormGraph ────────────────────────────────────────────────────────────────

export function WormGraph({
  innings1Balls,
  innings2Balls,
  ballsPerOver,
  maxOvers,
  team1Name,
  team2Name,
  height = 160,
}: WormGraphProps) {
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

  const pts1 = computeWormPoints(innings1Balls, ballsPerOver)
  const pts2 = innings2Balls ? computeWormPoints(innings2Balls, ballsPerOver) : []

  const allRuns = [...pts1.map((p) => p.runs), ...pts2.map((p) => p.runs)]
  const maxRuns = Math.max(...allRuns, 1)

  const yTick = maxRuns <= 50 ? 10 : maxRuns <= 100 ? 20 : maxRuns <= 200 ? 50 : 100
  const yMax = Math.ceil(maxRuns / yTick) * yTick

  const toX = (over: number) => (over / maxOvers) * chartW
  const toY = (runs: number) => chartH - (runs / yMax) * chartH

  const pointsToPolyline = (pts: WormPoint[]) =>
    pts.map((p) => `${toX(p.over)},${toY(p.runs)}`).join(" ")

  const yTicks: number[] = []
  for (let v = 0; v <= yMax; v += yTick) yTicks.push(v)

  const xTicks: number[] = []
  for (let i = 0; i <= maxOvers; i += 5) xTicks.push(i)

  const hasSecond = pts2.length > 0

  return (
    <div ref={containerRef} className="w-full">
      {/* Legend */}
      <div className="flex items-center gap-4 mb-1 px-1">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-0.5 bg-blue-500" />
          <span className="text-[10px] text-muted-foreground truncate">{team1Name}</span>
        </div>
        {hasSecond && (
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-0.5 bg-amber-500" />
            <span className="text-[10px] text-muted-foreground truncate">{team2Name}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 ml-auto">
          <div className="w-2 h-2 rounded-full border border-current" />
          <span className="text-[10px] text-muted-foreground">Wicket</span>
        </div>
      </div>

      <svg width={width} height={height} aria-label="Worm graph">
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

          {/* Innings 2 line */}
          {pts2.length > 1 && (
            <>
              <polyline
                points={pointsToPolyline(pts2)}
                fill="none"
                stroke="rgb(245,158,11)"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                opacity={0.9}
              />
              {pts2.filter((p) => p.isWicket).map((p, i) => (
                <circle
                  key={i}
                  cx={toX(p.over)} cy={toY(p.runs)}
                  r={3}
                  fill="rgb(245,158,11)"
                  stroke="white"
                  strokeWidth={1.5}
                />
              ))}
            </>
          )}

          {/* Innings 1 line */}
          {pts1.length > 1 && (
            <>
              <polyline
                points={pointsToPolyline(pts1)}
                fill="none"
                stroke="rgb(59,130,246)"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                opacity={0.9}
              />
              {pts1.filter((p) => p.isWicket).map((p, i) => (
                <circle
                  key={i}
                  cx={toX(p.over)} cy={toY(p.runs)}
                  r={3}
                  fill="rgb(59,130,246)"
                  stroke="white"
                  strokeWidth={1.5}
                />
              ))}
            </>
          )}

          {/* Axes */}
          <line x1={0} x2={0} y1={0} y2={chartH} stroke="currentColor" strokeOpacity={0.2} strokeWidth={1} />
          <line x1={0} x2={chartW} y1={chartH} y2={chartH} stroke="currentColor" strokeOpacity={0.2} strokeWidth={1} />
        </g>
      </svg>
    </div>
  )
}
