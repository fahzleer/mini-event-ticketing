import { expect, test } from "@playwright/test"
import { bookTickets, listEvents, register, uniqueEmail } from "./helpers/api"

/** Seed localStorage so the SPA treats this session as authenticated. */
async function seedAuth(
  page: import("@playwright/test").Page,
  token: string,
  user: object
) {
  await page.goto("/login")
  await page.evaluate(
    ({ t, u }) => {
      localStorage.setItem("token", t)
      localStorage.setItem("user", JSON.stringify(u))
    },
    { t: token, u: user }
  )
}

// ─── Event Browsing ───────────────────────────────────────────────────────────

test.describe("Event Browsing", () => {
  test("TC-EVT-01 — Event list loads", async ({ page }) => {
    const email = uniqueEmail()
    const { token, user } = await register(email)
    await seedAuth(page, token, user)

    await page.goto("/")

    await expect(page.getByRole("main")).toBeVisible()
    // At least one event card must be rendered
    await expect(page.locator("[data-testid='event-card'], .event-card, article").first()).toBeVisible()
  })

  test("TC-EVT-02 — Available badge (green)", async ({ page }) => {
    const email = uniqueEmail()
    const { token, user } = await register(email)
    const events = await listEvents(token)

    const available = events.find(
      (e) => e.remainingTickets > 0 && e.remainingTickets / e.totalTickets >= 0.1
    )
    if (!available) {
      test.skip(true, "No available event found in seed data")
      return
    }

    await seedAuth(page, token, user)
    await page.goto("/")

    await expect(page.getByText(/\d+ left/).first()).toBeVisible()
  })

  test("TC-EVT-03 — Low stock badge (red)", async ({ page }) => {
    const email = uniqueEmail()
    const { token, user } = await register(email)
    const events = await listEvents(token)

    const low = events.find(
      (e) => e.remainingTickets > 0 && e.remainingTickets / e.totalTickets < 0.1
    )
    if (!low) {
      test.skip(true, "No low stock event found in seed data")
      return
    }

    await seedAuth(page, token, user)
    await page.goto("/")

    await expect(page.getByText(/only \d+ left!/i).first()).toBeVisible()
  })

  test("TC-EVT-04 — Sold out badge (gray)", async ({ page }) => {
    const email = uniqueEmail()
    const { token, user } = await register(email)
    const events = await listEvents(token)

    const soldOut = events.find((e) => e.remainingTickets === 0)
    if (!soldOut) {
      test.skip(true, "No sold-out event found in seed data")
      return
    }

    await seedAuth(page, token, user)
    await page.goto("/")

    await expect(page.getByText("Sold out").first()).toBeVisible()
  })

  test("TC-EVT-05 — All 3 badge states visible", async ({ page }) => {
    const email = uniqueEmail()
    const { token, user } = await register(email)
    const events = await listEvents(token)

    const hasAvailable = events.some(
      (e) => e.remainingTickets > 0 && e.remainingTickets / e.totalTickets >= 0.1
    )
    const hasLow = events.some(
      (e) => e.remainingTickets > 0 && e.remainingTickets / e.totalTickets < 0.1
    )
    const hasSoldOut = events.some((e) => e.remainingTickets === 0)

    expect(hasAvailable, "seed data must have at least one available event (green)").toBe(true)
    expect(hasLow, "seed data must have at least one low stock event (red, <10%)").toBe(true)
    expect(hasSoldOut, "seed data must have at least one sold out event (gray)").toBe(true)

    await seedAuth(page, token, user)
    await page.goto("/")

    await expect(page.getByText("Sold out").first()).toBeVisible()
    await expect(page.getByText(/only \d+ left!/i).first()).toBeVisible()
    await expect(page.getByText(/\d+ left/).first()).toBeVisible()
  })
})

// ─── Booking ──────────────────────────────────────────────────────────────────

test.describe("Booking — Normal Flow", () => {
  test("TC-BK-01 — Book 1 ticket", async ({ page }) => {
    const email = uniqueEmail()
    const { token, user } = await register(email)
    const events = await listEvents(token)

    const target = events.find((e) => e.remainingTickets >= 1)
    if (!target) {
      test.skip(true, "No event with remaining tickets found")
      return
    }

    await seedAuth(page, token, user)
    await page.goto(`/events/${target.id}`)

    await page.getByRole("spinbutton").fill("1")
    await page.getByRole("button", { name: /book/i }).click()

    await expect(page.getByText(/booked|success/i)).toBeVisible()
  })
})

test.describe("Booking — Limit Enforcement", () => {
  test("TC-BK-06 — Limit reached: UI hides form", async ({ page }) => {
    const email = uniqueEmail()
    const { token, user } = await register(email)

    const events = await listEvents(token)
    const target = events.find((e) => e.remainingTickets >= 5)
    if (!target) {
      test.skip(true, "No event with ≥5 remaining tickets found")
      return
    }

    // Book 5 tickets directly via API (faster than clicking 5 times in the UI)
    await bookTickets(token, target.id, 5)

    await seedAuth(page, token, user)
    await page.goto(`/events/${target.id}`)

    // The form must be replaced with the limit-reached message
    await expect(page.getByText(/you've used all 5 of your tickets/i)).toBeVisible()
    await expect(page.getByRole("button", { name: /book/i })).not.toBeVisible()
  })
})

test.describe("Booking — Sold Out", () => {
  test("TC-BK-08 — Sold out event hides booking form", async ({ page }) => {
    const email = uniqueEmail()
    const { token, user } = await register(email)
    await seedAuth(page, token, user)

    const events = await listEvents(token)
    const soldOut = events.find((e) => e.remainingTickets === 0)
    if (!soldOut) {
      test.skip(true, "No sold-out event found in current seed data")
      return
    }

    await page.goto(`/events/${soldOut.id}`)
    await expect(page.getByText("Sold out")).toBeVisible()
    await expect(page.getByRole("button", { name: /book/i })).not.toBeVisible()
  })
})
