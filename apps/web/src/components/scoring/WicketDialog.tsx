import { useState } from "react"
import { Search } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@workspace/ui/components/dialog"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"
import type {
  BatsmanEntry,
  BowlerEntry,
  DismissalType,
  Player,
} from "@/types/cricket"
import {
  DISMISSAL_LABELS,
  FREE_HIT_DISMISSALS,
  FIELDER_REQUIRED,
} from "@/types/cricket"

interface WicketDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: (data: {
    dismissalType: DismissalType
    dismissedPlayerId: string
    fielderId?: string
  }) => void
  striker: BatsmanEntry
  nonStriker: BatsmanEntry
  bowler: BowlerEntry
  allPlayersInField: Player[]
  isFreeHit: boolean
}

const ALL_DISMISSALS: DismissalType[] = [
  "bowled",
  "caught",
  "lbw",
  "runOut",
  "stumped",
  "hitWicket",
  "caughtAndBowled",
  "retiredHurt",
  "retiredOut",
  "obstructingField",
  "hitBallTwice",
  "timedOut",
  "handledBall",
]

export function WicketDialog({
  open,
  onClose,
  onConfirm,
  striker,
  nonStriker,
  bowler: _bowler,
  allPlayersInField,
  isFreeHit,
}: WicketDialogProps) {
  const [dismissalType, setDismissalType] = useState<DismissalType | null>(null)
  const [dismissedPlayerId, setDismissedPlayerId] = useState<string>(striker.playerId)
  const [fielderId, setFielderId] = useState<string | undefined>(undefined)
  const [fielderSearch, setFielderSearch] = useState("")

  const availableDismissals = isFreeHit
    ? ALL_DISMISSALS.filter((d) => FREE_HIT_DISMISSALS.includes(d))
    : ALL_DISMISSALS

  const needsFielder = dismissalType ? FIELDER_REQUIRED.includes(dismissalType) : false
  const isRunOut = dismissalType === "runOut"

  // For run outs, either batsman could be out; for others always striker
  const showWhoGotOut = isRunOut

  const filteredFielders = allPlayersInField.filter((p) =>
    p.name.toLowerCase().includes(fielderSearch.toLowerCase())
  )

  function handleConfirm() {
    if (!dismissalType) return
    onConfirm({
      dismissalType,
      dismissedPlayerId: showWhoGotOut ? dismissedPlayerId : striker.playerId,
      fielderId: needsFielder ? fielderId : undefined,
    })
    // Reset state
    setDismissalType(null)
    setDismissedPlayerId(striker.playerId)
    setFielderId(undefined)
    setFielderSearch("")
  }

  function handleClose() {
    setDismissalType(null)
    setDismissedPlayerId(striker.playerId)
    setFielderId(undefined)
    setFielderSearch("")
    onClose()
  }

  const canConfirm =
    dismissalType !== null &&
    (!needsFielder || fielderId !== undefined || dismissalType === "runOut")

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent showCloseButton={false} className="max-h-[90dvh] overflow-y-auto p-4 gap-4">
        <DialogHeader>
          <DialogTitle className="text-base">Wicket — How was {striker.playerName} out?</DialogTitle>
        </DialogHeader>

        {/* Dismissal type grid */}
        <div>
          <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">
            Dismissal Type
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {availableDismissals.map((d) => (
              <button
                key={d}
                onClick={() => {
                  setDismissalType(d)
                  // Reset fielder when type changes
                  setFielderId(undefined)
                  // Reset who got out for non-runouts
                  if (d !== "runOut") setDismissedPlayerId(striker.playerId)
                }}
                className={cn(
                  "rounded-lg border px-2 py-2 text-xs font-medium text-center transition-colors",
                  dismissalType === d
                    ? "bg-cricket-wicket/20 border-cricket-wicket text-cricket-wicket"
                    : "bg-muted/30 border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                {DISMISSAL_LABELS[d]}
              </button>
            ))}
          </div>
        </div>

        {/* Who got out (run out only) */}
        {showWhoGotOut && (
          <div>
            <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">
              Who Got Out?
            </p>
            <div className="grid grid-cols-2 gap-2">
              {[striker, nonStriker].map((batter) => (
                <button
                  key={batter.playerId}
                  onClick={() => setDismissedPlayerId(batter.playerId)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm font-medium text-left transition-colors",
                    dismissedPlayerId === batter.playerId
                      ? "bg-primary/15 border-primary text-foreground"
                      : "bg-muted/30 border-border text-muted-foreground hover:bg-muted/60"
                  )}
                >
                  {batter.playerName}
                  <span className="block text-xs font-normal text-muted-foreground">
                    {batter.runs} ({batter.balls})
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Fielder picker */}
        {needsFielder && (
          <div>
            <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">
              {dismissalType === "stumped" ? "Wicket-keeper" : dismissalType === "runOut" ? "Fielder (optional)" : "Fielder / Catcher"}
            </p>
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Search fielder..."
                value={fielderSearch}
                onChange={(e) => setFielderSearch(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
            <div className="max-h-36 overflow-y-auto space-y-1">
              {filteredFielders.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">No players found</p>
              ) : (
                filteredFielders.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setFielderId(p.id)}
                    className={cn(
                      "w-full text-left rounded-lg px-3 py-2 text-sm transition-colors",
                      fielderId === p.id
                        ? "bg-primary/15 text-foreground font-medium"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    )}
                  >
                    {p.name}
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 flex-row">
          <Button variant="outline" className="flex-1" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            className="flex-1 bg-cricket-wicket/90 hover:bg-cricket-wicket text-white border-0"
            disabled={!canConfirm}
            onClick={handleConfirm}
          >
            Confirm Wicket
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
