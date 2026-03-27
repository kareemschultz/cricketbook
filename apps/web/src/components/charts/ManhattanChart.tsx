import { useRef, useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"

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

interface TooltipState {
  x: number
  overIndex: number
  i1?: InningsOver
  i2?: InningsOver
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

  const allRuns = [
    ...innings.map((o) => o.runs),
    ...(innings2 ?? []).map((o) => o.runs),
  ]
  const maxRuns = Math.max(...allRuns, 1)

  const yTick = maxRuns <= 10 ? 2 : maxRuns <= 20 ? 5 : 10
  const yMax = Math.ceil(maxRuns / yTick) * yTick

  const toY = (runs: number) => chartH - (runs / yMax) * chartH

  const totalSlots = maxOvers
  const gap = 1
  const barW = Math.max(2, chartW / totalSlots - gap)
  const slotW = chartW / totalSlots

  const yTicks: number[] = []
  for (let v = 0; v <= yMax; v += yTick) yTicks.push(v)

  const xTicks: number[] = []
  for (let i = 0; i <= maxOvers; i += 5) xTicks.push(i)

  const hasSecond = !!innings2?.length

  const i1Map = new Map(innings.map((o) => [o.overNumber, o]))
  const i2Map = innings2 ? new Map(innings2.map((o) => [o.overNumber, o])) : null

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const svgX = e.clientX - rect.left - PADDING.left
    const overIndex = Math.floor(svgX / slotW)
    if (overIndex < 0 || overIndex >= maxOvers) {
      setTooltip(null)
      return
    }
    const i1 = i1Map.get(overIndex)
    const i2 = i2Map?.get(overIndex)
    if (!i1 && !i2) {
      setTooltip(null)
      return
    }
    setTooltip({
      x: overIndex * slotW + slotW / 2 + PADDING.left,
      overIndex,
      i1,
      i2,
    })
  }

  return (
    <div ref={containerRef} className="w-full">
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

      <div className="relative">
        <svg
          width={width}
          height={height}
          className="overflow-visible"
          aria-label="Manhattan chart"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setTooltip(null)}
        >
          <g transform={`translate(${PADDING.left},${PADDING.top})`}>
            {/* Y grid lines + labels */}
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

            {/* X axis ticks */}
            {xTicks.map((ov) => (
              <text
                key={ov}
                x={(ov / totalSlots) * chartW} y={chartH + 12}
                textAnchor="middle" className="fill-muted-foreground" fontSize={8}
              >
                {ov}
              </text>
            ))}
            <text x={chartW / 2} y={chartH + 22} textAnchor="middle" className="fill-muted-foreground" fontSize={7}>
              Overs
            </text>

            {/* Hover column highlight */}
            {tooltip && (
              <rect
                x={tooltip.overIndex * slotW}
                y={0}
                width={slotW}
                height={chartH}
                fill="currentColor"
                fillOpacity={0.07}
                rx={2}
              />
            )}

            {/* Innings 2 bars (behind) */}
            {innings2?.map((over, i) => {
              const x = over.overNumber * slotW + (slotW - barW) / 2
              const bH = Math.max(1, (over.runs / yMax) * chartH)
              return (
                <g key={`i2-${over.overNumber}`}>
                  <motion.rect
                    x={x}
                    width={barW}
                    rx={1}
                    className="fill-violet-500/60"
                    initial={{ height: 0, y: chartH }}
                    animate={{ height: bH, y: chartH - bH }}
                    transition={{ delay: i * 0.012, duration: 0.4, ease: "easeOut" }}
                  />
                  {over.wickets > 0 && (
                    <motion.circle
                      cx={x + barW / 2}
                      r={2.5}
                      className="fill-red-500"
                      initial={{ cy: chartH }}
                      animate={{ cy: chartH - bH - 4 }}
                      transition={{ delay: i * 0.012 + 0.2, duration: 0.3 }}
                    />
                  )}
                </g>
              )
            })}

            {/* Innings 1 bars */}
            {innings.map((over, i) => {
              const x = over.overNumber * slotW + (slotW - barW) / 2
              const bH = Math.max(1, (over.runs / yMax) * chartH)
              return (
                <g key={`i1-${over.overNumber}`}>
                  <motion.rect
                    x={x}
                    width={barW}
                    rx={1}
                    className="fill-blue-500/80"
                    initial={{ height: 0, y: chartH }}
                    animate={{ height: bH, y: chartH - bH }}
                    transition={{ delay: i * 0.012, duration: 0.4, ease: "easeOut" }}
                  />
                  {over.wickets > 0 && (
                    <motion.circle
                      cx={x + barW / 2}
                      r={2.5}
                      className="fill-red-500"
                      initial={{ cy: chartH }}
                      animate={{ cy: chartH - bH - 4 }}
                      transition={{ delay: i * 0.012 + 0.2, duration: 0.3 }}
                    />
                  )}
                </g>
              )
            })}

            {/* Axes */}
            <line x1={0} x2={0} y1={0} y2={chartH} stroke="currentColor" strokeOpacity={0.2} strokeWidth={1} />
            <line x1={0} x2={chartW} y1={chartH} y2={chartH} stroke="currentColor" strokeOpacity={0.2} strokeWidth={1} />

            {/* Hover crosshair */}
            {tooltip && (
              <line
                x1={tooltip.overIndex * slotW + slotW / 2}
                x2={tooltip.overIndex * slotW + slotW / 2}
                y1={0} y2={chartH}
                stroke="currentColor" strokeOpacity={0.25} strokeWidth={1}
                strokeDasharray="2 2"
              />
            )}
          </g>
        </svg>

        {/* Tooltip */}
        <AnimatePresence>
          {tooltip && (
            <motion.div
              key="manhattan-tooltip"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="absolute pointer-events-none z-10 bg-background/95 backdrop-blur-sm border border-border rounded-lg px-2.5 py-2 shadow-lg min-w-[100px]"
              style={{
                left: Math.max(4, Math.min(tooltip.x - 55, width - 116)),
                top: PADDING.top,
              }}
            >
              <p className="text-[10px] font-semibold text-foreground mb-1">Over {tooltip.overIndex + 1}</p>
              {tooltip.i1 && (
                <div className="flex items-center gap-1.5 text-[10px]">
                  <div className="w-2 h-2 rounded-sm bg-blue-500 shrink-0" />
                  <span className="text-muted-foreground truncate">{hasSecond ? team1Name.slice(0, 10) : "Runs"}</span>
                  <span className="font-semibold tabular-nums ml-auto pl-1">{tooltip.i1.runs}</span>
                  {tooltip.i1.wickets > 0 && (
                    <span className="text-red-400 text-[9px]">{tooltip.i1.wickets}W</span>
                  )}
                </div>
              )}
              {tooltip.i2 && hasSecond && (
                <div className="flex items-center gap-1.5 text-[10px] mt-0.5">
                  <div className="w-2 h-2 rounded-sm bg-violet-500 shrink-0" />
                  <span className="text-muted-foreground truncate">{(team2Name ?? "").slice(0, 10)}</span>
                  <span className="font-semibold tabular-nums ml-auto pl-1">{tooltip.i2.runs}</span>
                  {tooltip.i2.wickets > 0 && (
                    <span className="text-red-400 text-[9px]">{tooltip.i2.wickets}W</span>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
