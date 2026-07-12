import type { Page } from "@playwright/test"

export const DEMO_PASSWORD = "DemoPass123!"

export async function loginAs(page: Page, email: string) {
  await page.goto("/login")
  await page.fill("#email", email)
  await page.fill("#password", DEMO_PASSWORD)
  await page.click("button[type=submit]")
}
