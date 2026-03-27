import { create } from "zustand"

// ─── Types ────────────────────────────────────────────────────────────────────

type Theme = "dark" | "light" | "system"

interface AppState {
  theme: Theme
  isNavVisible: boolean
}

interface AppActions {
  setTheme: (theme: Theme) => void
  setNavVisible: (visible: boolean) => void
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAppStore = create<AppState & AppActions>()((set) => ({
  theme: "system",
  isNavVisible: true,

  setTheme: (theme) => set({ theme }),
  setNavVisible: (visible) => set({ isNavVisible: visible }),
}))
