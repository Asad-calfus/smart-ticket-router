import { expect, test } from "@playwright/test"

// The one critical golden path: an agent opens the workspace, picks an
// unrouted ticket, routes it with AI, and accepts the recommendation.
// Requires the backend (port 8000) + a seeded database to be running.
test("agent can route a ticket and accept the AI recommendation", async ({ page }) => {
  await page.goto("/")

  await expect(page.getByRole("heading", { name: "Smart Support Ticket Router" })).toBeVisible()

  await page.getByRole("button", { name: "Unassigned", exact: true }).click()

  const firstTicket = page.locator("button:has-text('#')").first()
  await firstTicket.waitFor()
  await firstTicket.click()

  await page.getByRole("button", { name: "Route Ticket", exact: true }).click()

  await expect(page.getByText("AI Recommendation")).toBeVisible({ timeout: 10_000 })

  await page.getByRole("button", { name: "Accept Routing" }).click()

  await expect(page.getByTestId("ticket-status-badge")).toHaveText(/Routed|In Progress|Needs Human Review/)
})
