import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import path from "path"

/**
 * Vitest config for performance benchmarks.
 * Resolves the '@' alias to the dashboard root so benchmarks
 * can import dashboard source directly without duplication.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    include: ["**/*.bench.ts"],
    benchmark: {
      include: ["**/*.bench.ts"],
      reporters: ["verbose"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "../../dashboard"),
    },
  },
})
