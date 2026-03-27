import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { TanStackRouterVite } from "@tanstack/router-plugin/vite"
import { VitePWA } from "vite-plugin-pwa"

export default defineConfig({
  base: "/cricketbook/fifa/",
  plugins: [
    TanStackRouterVite({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "apple-touch-icon.png", "icons/*.png"],
      manifest: {
        name: "FIFABook",
        short_name: "FIFABook",
        description: "Track FIFA match results, leaderboard, and head-to-head stats",
        theme_color: "#1a7f37",
        background_color: "#0d1117",
        display: "standalone",
        orientation: "portrait",
        start_url: "/cricketbook/fifa/",
        icons: [
          { src: "/cricketbook/fifa/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/cricketbook/fifa/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "/cricketbook/fifa/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/cricketbook/fifa/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        screenshots: [],
        categories: ["sports", "utilities"],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "lucide-react"],
  },
})
