import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { cn } from "@workspace/ui/lib/utils"

interface RunPickerDialogProps {
  open: boolean
  onClose: () => void
  onSelect: (runs: number) => void
  title: string
  options: number[]
  colorClass?: string
}

export function RunPickerDialog({
  open,
  onClose,
  onSelect,
  title,
  options,
  colorClass = "bg-muted/50 hover:bg-muted border-border text-foreground",
}: RunPickerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent showCloseButton={false} className="max-w-[280px] p-4 gap-4">
        <DialogHeader>
          <DialogTitle className="text-sm text-center">{title}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-4 gap-2">
          {options.map((r) => (
            <button
              key={r}
              onClick={() => { onSelect(r); onClose() }}
              className={cn(
                "h-12 rounded-xl border text-lg font-bold transition-colors active:scale-95",
                colorClass
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
