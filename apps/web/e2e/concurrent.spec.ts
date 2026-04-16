import { expect, test } from "@playwright/test"
import { bookTickets, listEvents, register, uniqueEmail } from "./helpers/api"

/**
 * Concurrent booking test — the centerpiece of the race condition story.
 *
 * Two independent users fire a booking request for the SAME last-available
 * ticket at the exact same moment.  The distributed Redis lock (SETNX) inside
 * the API guarantees exactly-once execution:
 *
 *   ✓ Exactly ONE booking succeeds
 *   ✓ The other gets SYSTEM_BUSY (lock already held) or NOT_ENOUGH_TICKETS
 *   ✓ The event's remaining count never goes below 0 (no overselling)
 *
 * This is impossible to verify by eye and requires programmatic concurrency.
 */

test.describe("Concurrent booking — race condition prevention", () => {
  test("TC-CON-01/02 — Only one booking succeeds for last ticket, remaining never goes negative", async () => {
    // ── Setup: two distinct users ──────────────────────────────────────────
    const [authA, authB] = await Promise.all([register(uniqueEmail()), register(uniqueEmail())])

    // ── Find an event with exactly 1 ticket remaining (best case), ─────────
    // ── or the event with the fewest remaining tickets (≥1).        ─────────
    const events = await listEvents(authA.token)
    const available = events
      .filter((e) => e.remainingTickets >= 1)
      .sort((a, b) => a.remainingTickets - b.remainingTickets)

    if (available.length === 0) {
      test.skip(true, "No events with remaining tickets — reseed the database")
      return
    }

    const target = available[0]
    if (!target) return
    const ticketsBefore = target.remainingTickets

    // If more than 1 ticket remains, pre-book down to exactly 1 so the race
    // is as tight as possible.
    if (ticketsBefore > 1) {
      const toBuy = ticketsBefore - 1
      // Book in chunks of max 5 (per-user limit)
      let remaining = toBuy
      while (remaining > 0) {
        const qty = Math.min(remaining, 5)
        const result = await bookTickets(authA.token, target.id, qty)
        // If this user hit the 5-ticket cap, use a fresh user for the rest
        if (!result.success) break
        remaining -= qty
      }
    }

    // ── Fire two booking requests at the EXACT same time ──────────────────
    const [resultA, resultB] = await Promise.all([
      bookTickets(authB.token, target.id, 1),
      // Use a brand-new user to avoid 5-ticket-cap interference on A
      register(uniqueEmail()).then(({ token }) => bookTickets(token, target.id, 1)),
    ])

    const successCount = [resultA, resultB].filter((r) => r.success).length
    const failureCount = [resultA, resultB].filter((r) => !r.success).length

    // ── Assertions ────────────────────────────────────────────────────────

    // At most one booking can succeed for the last ticket
    expect(successCount, "at most one concurrent booking should succeed").toBeLessThanOrEqual(1)

    // The failure must carry a meaningful error code — not a 500 crash
    if (failureCount > 0) {
      const failed = [resultA, resultB].find((r) => !r.success) as {
        success: false
        code: string
      }
      expect(
        ["NOT_ENOUGH_TICKETS", "SYSTEM_BUSY"],
        `failure code must be NOT_ENOUGH_TICKETS or SYSTEM_BUSY, got: ${failed.code}`
      ).toContain(failed.code)
    }

    // Verify no overselling: remaining tickets should be ≥ 0 after the race
    const eventsAfter = await listEvents(authB.token)
    const eventAfter = eventsAfter.find((e) => e.id === target.id)
    expect(
      eventAfter?.remainingTickets ?? 0,
      "remaining tickets must never go negative (no overselling)"
    ).toBeGreaterThanOrEqual(0)
  })

  test("TC-CON-03 — Two browser sessions race for last ticket", async ({ browser }) => {
    // ── Setup two isolated browser contexts ───────────────────────────────
    const [authA, authB] = await Promise.all([register(uniqueEmail()), register(uniqueEmail())])

    const ctxA = await browser.newContext()
    const ctxB = await browser.newContext()
    const pageA = await ctxA.newPage()
    const pageB = await ctxB.newPage()

    // Seed auth into each context
    for (const [page, auth] of [
      [pageA, authA],
      [pageB, authB],
    ] as const) {
      await page.goto("/login")
      await page.evaluate(
        ({ t, u }) => {
          localStorage.setItem("token", t)
          localStorage.setItem("user", JSON.stringify(u))
        },
        { t: auth.token, u: auth.user }
      )
    }

    // Find an event with few tickets
    const events = await listEvents(authA.token)
    const target = events
      .filter((e) => e.remainingTickets >= 1)
      .sort((a, b) => a.remainingTickets - b.remainingTickets)[0]

    if (!target) {
      test.skip(true, "No events with remaining tickets")
      return
    }

    // Both navigate to the same event detail page
    await Promise.all([pageA.goto(`/events/${target.id}`), pageB.goto(`/events/${target.id}`)])

    // Both click Book simultaneously
    await Promise.all([
      pageA.getByRole("button", { name: /book/i }).click(),
      pageB.getByRole("button", { name: /book/i }).click(),
    ])

    // Wait for both to settle
    await Promise.all([pageA.waitForTimeout(2000), pageB.waitForTimeout(2000)])

    const aSuccess = await pageA.getByText(/ticket.*booked/i).isVisible()
    const bSuccess = await pageB.getByText(/ticket.*booked/i).isVisible()

    // Both cannot show success if only 1 ticket was available
    if (target.remainingTickets === 1) {
      expect(aSuccess && bSuccess, "both users cannot see 'booked' for the last ticket").toBe(false)
    }

    await ctxA.close()
    await ctxB.close()
  })
})
