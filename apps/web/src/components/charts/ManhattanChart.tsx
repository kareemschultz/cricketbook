import { useRef, useState, useEffect } from "react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface InningsOver {
  overNumber: number
  runs: number
  wickets: number
}

interface ManhattanChartProps {
  innings: InningsOver[]
  innings2?: InningsOver[]
  maxOvers: number
  team1Name: string
  team2Name?: string
  height?: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PADDING = { top: 12, right: 8, bottom: 28, left: 28 }

// ─── ManhattanChart ───────────────────────────────────────────────────────────

export function ManhattanChart({
  innings,
  innings2,
  maxOvers,
  team1Name,
  team2Name,
  height = 160,
}: ManhattanChartProps) {
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

  // Find max runs in a single over across both innings
  const allRuns = [
    ...innings.map((o) => o.runs),
    ...(innings2 ?? []).map((o) => o.runs),
  ]
  const maxRuns = Math.max(...allRuns, 1)

  // Y-axis scale
  const yTick = maxRuns <= 10 ? 2 : maxRuns <= 20 ? 5 : 10
  const yMax = Math.ceil(maxRuns / yTick) * yTick

  const toY = (runs: number) => chartH - (runs / yMax) * chartH

  // Bar layout
  const totalSlots = maxOvers
  const gap = 1
  const barW = Math.max(2, (chartW / totalSlots) - gap)
  const slotW = chartW / totalSlots

  // Y axis ticks
  const yTicks: number[] = []
  for (let v = 0; v <= yMax; v += yTick) yTicks.push(v)

  // X axis ticks — every 5 overs
  const xTicks: number[] = []
  for (let i = 0; i <= maxOvers; i += 5) xTicks.push(i)

  const hasSecond = !!innings2?.length

  return (
    <div ref={containerRef} className="w-full">
      {/* Legend */}
      {hasSecond && (
        <div className="flex items-center gap-4 mb-1 px-1">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-blue-500" />
            <span className="text-[10px] text-muted-foreground truncate">{team1Name}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-violet-500" />
            <span className="text-[10px] text-muted-foreground truncate">{team2Name}</span>
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-[10px] text-muted-foreground">Wicket</span>
          </div>
        </div>
      )}

      <svg
        width={width}
        height={height}
        className="overflow-visible"
        aria-label="Manhattan chart"
      >
        <g transform={`translate(${PADDING.left},${PADDING.top})`}>
          {/* Y grid lines + labels */}
          {yTicks.map((v) => (
            <g key={v}>
              <line
                x1={0}
                x2={chartW}
                y1={toY(v)}
                y2={toY(v)}
                stroke="currentColor"
                strokeOpacity={0.08}
                strokeWidth={1}
              />
              <text
                x={-4}
                y={toY(v)}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-muted-foreground"
                fontSize={8}
              >
                {v}
              </text>
            </g>
          ))}

          {/* X axis ticks */}
          {xTicks.map((ov) => (
            <text
              key={ov}
              x={(ov / totalSlots) * chartW}
              y={chartH + 12}
              textAnchor="middle"
              className="fill-muted-foreground"
              fontSize={8}
            >
              {ov}
            </text>
          ))}

          {/* X axis label */}
          <text
            x={chartW / 2}
            y={chartH + 22}
            textAnchor="middle"
            className="fill-muted-foreground"
            fontSize={7}
          >
            Overs
          </text>

          {/* Innings 2 bars (behind) */}
          {innings2?.map((over) => {
            const x = over.overNumber * slotW + (slotW - barW) / 2
            const barH = Math.max(1, (over.runs / yMax) * chartH)
            return (
              <g key={`i2-${over.overNumber}`}>
                <rect
                  x={x}
                  y={chartH - barH}
                  width={barW}
                  height={barH}
                  className="fill-violet-500/60"
                  rx={1}
                />
                {over.wickets > 0 && (
                  <circle
                    cx={x + barW / 2}
                    cy={chartH - barH - 3}
                    r={2.5}
                    className="fill-red-500"
                  />
                )}
              </g>
            )
          })}

          {/* Innings 1 bars */}
          {innings.map((over) => {
            const x = over.overNumber * slotW + (slotW - barW) / 2
            const barH = Math.max(1, (over.runs / yMax) * chartH)
            return (
              <g key={`i1-${over.overNumber}`}>
                <rect
                  x={x}
                  y={chartH - barH}
                  width={barW}
                  height={barH}
                  className="fill-blue-500/80"
                  rx={1}
                />
                {over.wickets > 0 && (
                  <circle
                    cx={x + barW / 2}
                    cy={chartH - barH - 3}
                    r={2.5}
                    className="fill-red-500"
                  />
                )}
              </g>
            )
          })}

          {/* Axes */}
          <line x1={0} x2={0} y1={0} y2={chartH} stroke="currentColor" strokeOpacity={0.2} strokeWidth={1} />
          <line x1={0} x2={chartW} y1={chartH} y2={chartH} stroke="currentColor" strokeOpacity={0.2} strokeWidth={1} />
        </g>
      </svg>
    </div>
  )
}
