import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { ExternalLink, RotateCcw, Trash2 } from "lucide-react"
import { db } from "@/db/index"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Button } from "@workspace/ui/components/button"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@workspace/ui/components/alert-dialog"

type ConfirmAction = "new-season" | "clear-all" | null

function SettingsPage() {
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null)

  async function handleConfirm() {
    if (confirmAction === "new-season") {
      await db.matches.clear()
    } else if (confirmAction === "clear-all") {
      await db.matches.clear()
      await db.players.clear()
    }
    setConfirmAction(null)
  }

  return (
    <div className="min-h-full bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3">
        <h1 className="text-lg font-bold">Settings</h1>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Season Management */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Season Management
          </h2>
          <Card>
            <CardContent className="py-0 divide-y divide-border">
              <div className="py-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">New Season</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Clear all matches but keep players
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmAction("new-season")}
                  className="shrink-0 gap-1.5"
                >
                  <RotateCcw className="size-3.5" />
                  New Season
                </Button>
              </div>

              <div className="py-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-destructive">Clear All Data</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Delete all matches and players permanently
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setConfirmAction("clear-all")}
                  className="shrink-0 gap-1.5"
                >
                  <Trash2 className="size-3.5" />
                  Clear All
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* About */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            About
          </h2>
          <Card>
            <CardContent className="py-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">FIFABook</p>
                  <p className="text-xs text-muted-foreground">v1.0.0 — FIFA match tracker</p>
                </div>
                <span className="text-2xl">⚽</span>
              </div>
              <p className="text-xs text-muted-foreground">
                All data is stored locally on this device using IndexedDB. No account required.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Navigation */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Other Apps
          </h2>
          <Card>
            <CardContent className="py-4">
              <a
                href="/cricketbook/"
                className="flex items-center justify-between text-sm font-medium hover:text-primary transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">🏏</span>
                  <span>Switch to CricketBook</span>
                </div>
                <ExternalLink className="size-4 text-muted-foreground" />
              </a>
            </CardContent>
          </Card>
        </section>
      </div>

      {/* Confirm dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={(open) => { if (!open) setConfirmAction(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === "new-season" ? "Start New Season?" : "Clear All Data?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === "new-season"
                ? "This will permanently delete all match results. Players will be kept. This action cannot be undone."
                : "This will permanently delete all matches and players. This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmAction(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {confirmAction === "new-season" ? "Clear Matches" : "Delete Everything"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
})
