import { createRootRoute, Link, Outlet, useRouterState } from "@tanstack/react-router"
import { Trophy, Sword, Users, Settings } from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
import { cn } from "@workspace/ui/lib/utils"

// ─── Bottom Nav ───────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { to: "/", label: "Home", icon: Trophy, exact: true },
  { to: "/matches", label: "Matches", icon: Sword, exact: false },
  { to: "/players", label: "Players", icon: Users, exact: false },
  { to: "/settings", label: "Settings", icon: Settings, exact: false },
] as const

function BottomNav() {
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname

  function isActive(to: string, exact: boolean) {
    if (exact) return currentPath === to
    return currentPath.startsWith(to)
  }

  return (
    <nav
      className="border-t border-border bg-background/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)]"
      style={{ position: "sticky", bottom: 0, zIndex: 50 }}
    >
      <div className="flex items-stretch">
        {NAV_ITEMS.map(({ to, label, icon: Icon, exact }) => {
          const active = isActive(to, exact)

          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 min-h-[52px] py-2 px-1 text-xs font-medium transition-colors select-none",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-5" strokeWidth={active ? 2.5 : 2} />
              <span>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

// ─── Root Layout ──────────────────────────────────────────────────────────────

function RootLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  return (
    <div className="flex flex-col h-dvh bg-background">
      <main className="flex-1 overflow-y-auto pb-safe">
        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
      <BottomNav />
    </div>
  )
}

export const Route = createRootRoute({
  component: RootLayout,
})
