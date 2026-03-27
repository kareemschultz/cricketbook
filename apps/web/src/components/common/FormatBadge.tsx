import { Badge } from "@workspace/ui/components/badge"
import type { CricketFormat } from "@/types/cricket"
import { cn } from "@workspace/ui/lib/utils"

const FORMAT_COLORS: Record<CricketFormat, string> = {
  T20: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  ODI: "bg-green-500/15 text-green-400 border-green-500/30",
  TEST: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  CUSTOM: "bg-purple-500/15 text-purple-400 border-purple-500/30",
}

interface FormatBadgeProps {
  format: CricketFormat
  className?: string
}

export function FormatBadge({ format, className }: FormatBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn("text-xs font-semibold", FORMAT_COLORS[format], className)}
    >
      {format}
    </Badge>
  )
}
