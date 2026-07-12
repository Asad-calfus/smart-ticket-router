import { defineConfig } from "@playwright/test"

// Assumes the backend (port 8000) and frontend dev server (port 5173) are
// already running against a seeded database — see README "Run the 20-ticket
// demo" / "How to run tests" sections.
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:5173",
  },
})
