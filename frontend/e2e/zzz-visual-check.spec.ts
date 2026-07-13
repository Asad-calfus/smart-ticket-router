import { test } from "@playwright/test"

const DEMO_PASSWORD = "DemoPass123!"
const SHOT_DIR = "/private/tmp/claude-502/-Users-asadkhan-pathan-Documents-odyessey-project/18e239db-44e3-46b8-bf89-7243af64f3d4/scratchpad/shots"

async function loginAs(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login")
  await page.fill("#email", email)
  await page.fill("#password", DEMO_PASSWORD)
  await page.click("button[type=submit]")
  await page.waitForLoadState("networkidle")
}

async function setTheme(page: import("@playwright/test").Page, theme: "light" | "dark") {
  await page.evaluate((t) => {
    localStorage.setItem("theme", t)
    document.documentElement.setAttribute("data-theme", t)
  }, theme)
}

test("capture screenshots", async ({ page }) => {
  page.setViewportSize({ width: 1440, height: 900 })

  // Login page
  await page.goto("/login")
  await setTheme(page, "light")
  await page.reload()
  await page.screenshot({ path: `${SHOT_DIR}/login-light.png` })
  await setTheme(page, "dark")
  await page.reload()
  await page.screenshot({ path: `${SHOT_DIR}/login-dark.png` })

  // Agent workspace
  await loginAs(page, "agent@example.com")
  await page.waitForTimeout(1000)
  await setTheme(page, "light")
  await page.reload()
  await page.waitForTimeout(1000)
  await page.screenshot({ path: `${SHOT_DIR}/workspace-light.png`, fullPage: false })
  await setTheme(page, "dark")
  await page.reload()
  await page.waitForTimeout(1000)
  await page.screenshot({ path: `${SHOT_DIR}/workspace-dark.png`, fullPage: false })

  // Try selecting first ticket row to show conversation panel
  const firstRow = page.locator("button").filter({ hasText: /waiting|ago/ }).first()
  if (await firstRow.count()) {
    await firstRow.click()
    await page.waitForTimeout(800)
    await page.screenshot({ path: `${SHOT_DIR}/workspace-ticket-dark.png` })
    await setTheme(page, "light")
    await page.reload()
    await page.waitForTimeout(1000)
    await firstRow.click()
    await page.waitForTimeout(800)
    await page.screenshot({ path: `${SHOT_DIR}/workspace-ticket-light.png` })
  }

  // Admin
  await loginAs(page, "admin@example.com")
  await page.goto("/admin")
  await page.waitForTimeout(800)
  await setTheme(page, "light")
  await page.reload()
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${SHOT_DIR}/admin-light.png` })
  await setTheme(page, "dark")
  await page.reload()
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${SHOT_DIR}/admin-dark.png` })

  // Customer
  await loginAs(page, "customer@example.com")
  await page.goto("/my-tickets")
  await page.waitForTimeout(800)
  await setTheme(page, "light")
  await page.reload()
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${SHOT_DIR}/my-tickets-light.png` })
  await setTheme(page, "dark")
  await page.reload()
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${SHOT_DIR}/my-tickets-dark.png` })

  // Mobile viewport check for agent workspace
  await loginAs(page, "agent@example.com")
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/workspace")
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${SHOT_DIR}/workspace-mobile.png` })
})
