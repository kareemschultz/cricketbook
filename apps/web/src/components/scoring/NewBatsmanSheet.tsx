import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import type { Player } from "@/types/cricket"

interface NewBatsmanSheetProps {
  open: boolean
  availableBatsmen: Player[]
  onSelect: (playerId: string) => void
}

export function NewBatsmanSheet({ open, availableBatsmen, onSelect }: NewBatsmanSheetProps) {
  return (
    <Sheet open={open}>
      <SheetContent side="bottom" showCloseButton={false} className="rounded-t-2xl max-h-[70dvh]">
        <SheetHeader className="pb-2 pt-4 px-4">
          <SheetTitle className="text-center">Select Incoming Batsman</SheetTitle>
          <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mt-2" />
        </SheetHeader>

        <div className="overflow-y-auto pb-8 px-2">
          {availableBatsmen.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No batsmen remaining
            </p>
          ) : (
            <div className="space-y-1">
              {availableBatsmen.map((player) => (
                <button
                  key={player.id}
                  onClick={() => onSelect(player.id)}
                  className="w-full flex items-center px-4 py-3 rounded-xl hover:bg-primary/10 active:bg-primary/15 transition-colors text-left"
                >
                  <span className="text-sm font-medium text-foreground">{player.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
