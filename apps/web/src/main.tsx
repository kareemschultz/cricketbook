import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider, createRouter, createHashHistory } from "@tanstack/react-router"
import { routeTree } from "./routeTree.gen"
import "@workspace/ui/globals.css"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import { TooltipProvider } from "@workspace/ui/components/tooltip"

const hashHistory = createHashHistory()
const router = createRouter({ routeTree, history: hashHistory })

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>
    </ThemeProvider>
  </StrictMode>
)
