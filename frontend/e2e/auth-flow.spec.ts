import { expect, test } from "@playwright/test"
import { loginAs } from "./helpers"

// Required end-to-end flow:
// 1. Customer signs in and creates a ticket
// 2. Agent signs in, routes and responds to it (plus an internal note)
// 3. Customer sees the response but cannot see internal notes or AI evidence
test("customer creates a ticket, agent routes and replies, customer sees only the public reply", async ({
  page,
}) => {
  const uniqueMessage = `E2E test ticket ${Date.now()}`
  const internalNoteText = "SECRET internal-only note — must never reach the customer"
  const publicReplyText = "Thanks for reaching out, we are looking into this."

  // 1. Customer creates a ticket.
  await loginAs(page, "customer@example.com")
  await page.waitForURL("**/my-tickets")
  await page.click("text=New Ticket")
  await page.fill("textarea", uniqueMessage)
  await page.click("button:has-text('Submit Ticket')")
  await page.waitForURL(/\/tickets\/(\d+)/)
  const ticketUrl = page.url()
  const ticketId = ticketUrl.match(/\/tickets\/(\d+)/)?.[1]
  expect(ticketId).toBeTruthy()

  await page.click("text=Log out")
  await page.waitForURL("**/login")

  // 2. Agent logs in, finds the ticket, routes it, replies publicly, and adds
  // an internal note.
  await loginAs(page, "agent@example.com")
  await page.waitForURL("**/workspace")
  await page.click("button:has-text('All')")
  await page.click(`text=${uniqueMessage}`)
  await page.waitForSelector("text=Ticket #")

  const routeButton = page.getByRole("button", { name: "Route Ticket", exact: true })
  if ((await routeButton.count()) > 0) {
    await routeButton.click()
    await page.waitForSelector("text=AI Recommendation", { timeout: 10_000 })
  }

  await page.click("text=Public Reply")
  await page.fill("textarea[placeholder*='Reply to the customer']", publicReplyText)
  await page.click("button:has-text('Send')")
  await page.waitForTimeout(500)

  await page.click("text=Internal Note")
  await page.fill("textarea[placeholder*='agents']", internalNoteText)
  await page.click("button:has-text('Send')")
  await page.waitForTimeout(500)

  await page.click("text=Log out")
  await page.waitForURL("**/login")

  // 3. Customer sees the public reply but never the internal note or any AI
  // evidence (which doesn't even have UI on the customer side).
  await loginAs(page, "customer@example.com")
  await page.waitForURL("**/my-tickets")
  await page.goto(`/tickets/${ticketId}`)

  await expect(page.getByText(publicReplyText)).toBeVisible()
  await expect(page.getByText(internalNoteText)).toHaveCount(0)
  await expect(page.getByText("AI Recommendation")).toHaveCount(0)
  await expect(page.getByText("Evidence used")).toHaveCount(0)
})
