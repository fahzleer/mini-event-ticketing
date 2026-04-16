import { expect, test } from "@playwright/test"
import { bookTickets, listEvents, register, uniqueEmail } from "./helpers/api"

/**
 * Rate limiting tests — verifies the Redis INCR + EXPIRE throttle.
 *
 * The API allows 10 booking requests per user per 60-second window.
 * On the 11th request within the same window the server must return
 * an error with code RATE_LIMITED — impossible to trigger and verify manually.
 */

const RATE_LIMIT = 10 // must match apps/api/src/routes/bookings.ts

test.describe("Booking rate limiting", () => {
  test("TC-RL-01 — 11th booking request within 60s is rejected with RATE_LIMITED", async () => {
    const email = uniqueEmail()
    const { token } = await register(email)

    // Find an event with enough tickets so we never hit NOT_ENOUGH_TICKETS first.
    // We care only about the rate-limit response, not the booking outcome.
    const events = await listEvents(token)
    const target = events
      .filter((e) => e.remainingTickets > 0)
      .sort((a, b) => b.remainingTickets - a.remainingTickets)[0]

    if (!target) {
      test.skip(true, "No events with remaining tickets — reseed the database")
      return
    }

    // Fire RATE_LIMIT requests (these may succeed or fail for booking reasons
    // but must NOT return RATE_LIMITED yet)
    const firstBatch = await Promise.all(
      Array.from({ length: RATE_LIMIT }, () =>
        bookTickets(token, target.id, 1)
      )
    )

    const prematureRateLimit = firstBatch.some(
      (r) => !r.success && (r as { code: string }).code === "RATE_LIMITED"
    )
    expect(
      prematureRateLimit,
      `RATE_LIMITED must not appear in the first ${RATE_LIMIT} requests`
    ).toBe(false)

    // The 11th request must be throttled
    const eleventh = await bookTickets(token, target.id, 1)

    expect(eleventh.success, "11th request should fail").toBe(false)
    expect(
      (eleventh as { code: string }).code,
      "11th request error code must be RATE_LIMITED"
    ).toBe("RATE_LIMITED")
  })

  test("TC-RL-02 — First 10 requests within 60s are not throttled", async () => {
    const email = uniqueEmail()
    const { token } = await register(email)

    const events = await listEvents(token)
    const target = events
      .filter((e) => e.remainingTickets > 0)
      .sort((a, b) => b.remainingTickets - a.remainingTickets)[0]

    if (!target) {
      test.skip(true, "No events with remaining tickets — reseed the database")
      return
    }

    const firstBatch = await Promise.all(
      Array.from({ length: RATE_LIMIT }, () =>
        bookTickets(token, target.id, 1)
      )
    )

    const prematureRateLimit = firstBatch.some(
      (r) => !r.success && (r as { code: string }).code === "RATE_LIMITED"
    )
    expect(
      prematureRateLimit,
      `RATE_LIMITED must not appear in the first ${RATE_LIMIT} requests`
    ).toBe(false)
  })

  test("TC-RL-03 — Rate limit is per user: User A exhausted quota does not affect User B", async () => {
    const [authA, authB] = await Promise.all([
      register(uniqueEmail()),
      register(uniqueEmail()),
    ])

    const events = await listEvents(authA.token)
    const target = events
      .filter((e) => e.remainingTickets > 0)
      .sort((a, b) => b.remainingTickets - a.remainingTickets)[0]

    if (!target) {
      test.skip(true, "No events with remaining tickets — reseed the database")
      return
    }

    // Exhaust user A's quota
    await Promise.all(
      Array.from({ length: RATE_LIMIT }, () =>
        bookTickets(authA.token, target.id, 1)
      )
    )
    const aThrottled = await bookTickets(authA.token, target.id, 1)
    expect((aThrottled as { code: string }).code).toBe("RATE_LIMITED")

    // User B should still be able to make requests — rate limit is per-user
    const bResult = await bookTickets(authB.token, target.id, 1)
    expect(
      (bResult as { code: string }).code,
      "user B must not be affected by user A's rate limit"
    ).not.toBe("RATE_LIMITED")
  })
})
