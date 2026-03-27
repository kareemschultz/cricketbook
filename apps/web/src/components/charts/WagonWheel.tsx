import type { Ball } from "@/types/cricket"

// ─── Types ────────────────────────────────────────────────────────────────────

interface WagonWheelProps {
  balls: Ball[]
  size?: number
}

// ─── Zone definitions (1-8, clockwise from off side) ─────────────────────────

const ZONE_LABELS = [
  "Off",
  "Cover",
  "Mid-off",
  "Straight",
  "Mid-on",
  "Midwicket",
  "Sq Leg",
  "Fine Leg",
]

// Zone 1 starts at -90° (top, "straight"), going clockwise
// We map zones 1-8 evenly around 360 degrees
function zoneAngle(zone: number): number {
  // zones 1-8 → 0-7 index, placed evenly
  // Straight = zone 4 → top (270° in standard SVG = -90°)
  // Offset so zone 1 (Off) is at ~right-ish (roughly 0°–45° range from top)
  const base = -90 // top of circle
  const degPerZone = 360 / 8
  return base + (zone - 1) * degPerZone
}

function zoneMidAngle(zone: number): number {
  return zoneAngle(zone) + 360 / 16 // midpoint of zone sector
}

function colorForRuns(runs: number): string {
  if (runs >= 6) return "#eab308" // gold
  if (runs >= 4) return "#22c55e" // green
  return "#f8fafc"                // white/off-white for 1-3
}

function polarToCart(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  }
}

// ─── WagonWheel ───────────────────────────────────────────────────────────────

export function WagonWheel({ balls, size = 200 }: WagonWheelProps) {
  const zoneBalls = balls.filter((b) => b.wagonZone !== undefined)
  const cx = size / 2
  const cy = size / 2
  const outerR = size * 0.43
  const innerR = size * 0.05
  const labelR = outerR + size * 0.07

  return (
    <div className="flex flex-col items-center gap-2">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-label="Wagon wheel"
      >
        {/* Pitch rectangle in center */}
        <rect
          x={cx - size * 0.025}
          y={cy - size * 0.07}
          width={size * 0.05}
          height={size * 0.14}
          fill="currentColor"
          fillOpacity={0.1}
          rx={2}
        />

        {/* Outer oval */}
        <ellipse
          cx={cx} cy={cy}
          rx={outerR} ry={outerR * 0.85}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.15}
          strokeWidth={1.5}
        />

        {/* Inner circle */}
        <circle
          cx={cx} cy={cy} r={outerR * 0.5}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.08}
          strokeWidth={1}
          strokeDasharray="3 3"
        />

        {/* Zone dividers */}
        {[1, 2, 3, 4, 5, 6, 7, 8].map((z) => {
          const angleDeg = zoneAngle(z)
          const outer = polarToCart(cx, cy, outerR, angleDeg)
          return (
            <line
              key={z}
              x1={cx} y1={cy}
              x2={outer.x} y2={outer.y}
              stroke="currentColor"
              strokeOpacity={0.1}
              strokeWidth={1}
            />
          )
        })}

        {/* Zone labels */}
        {[1, 2, 3, 4, 5, 6, 7, 8].map((z) => {
          const midAngle = zoneMidAngle(z)
          const pos = polarToCart(cx, cy, labelR, midAngle)
          return (
            <text
              key={z}
              x={pos.x}
              y={pos.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={size * 0.042}
              className="fill-muted-foreground"
            >
              {ZONE_LABELS[z - 1]}
            </text>
          )
        })}

        {/* Shot lines */}
        {zoneBalls.map((ball, idx) => {
          const zone = ball.wagonZone!
          // Add slight jitter within the zone for readability
          const midAngle = zoneMidAngle(zone)
          const jitter = ((idx * 7) % 20) - 10 // -10 to +10 degrees
          const angle = midAngle + jitter
          const lineR = outerR * (0.55 + ((idx * 13) % 20) / 100)
          const end = polarToCart(cx, cy, lineR, angle)
          const start = polarToCart(cx, cy, innerR, angle)
          const color = colorForRuns(ball.batsmanRuns)

          return (
            <line
              key={ball.id}
              x1={start.x} y1={start.y}
              x2={end.x} y2={end.y}
              stroke={color}
              strokeWidth={ball.batsmanRuns >= 4 ? 2 : 1.5}
              strokeOpacity={0.85}
              strokeLinecap="round"
            />
          )
        })}

        {/* Center dot */}
        <circle cx={cx} cy={cy} r={3} className="fill-muted-foreground" />
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-0.5 bg-white/70 rounded" />
          1–3
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-0.5 bg-green-500 rounded" />
          4
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-0.5 bg-yellow-500 rounded" />
          6
        </span>
        <span className="ml-2">{zoneBalls.length} shots</span>
      </div>
    </div>
  )
}
