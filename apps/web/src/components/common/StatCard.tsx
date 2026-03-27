import { cn } from "@workspace/ui/lib/utils"

interface StatCardProps {
  label: string
  value: string | number
  subValue?: string
  highlight?: boolean
  className?: string
}

export function StatCard({ label, value, subValue, highlight, className }: StatCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-0.5 rounded-lg border border-border bg-card p-3",
        highlight && "border-primary/40 bg-primary/5",
        className
      )}
    >
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("text-xl font-bold tabular-nums", highlight && "text-primary")}>
        {value}
      </span>
      {subValue && <span className="text-xs text-muted-foreground">{subValue}</span>}
    </div>
  )
}
