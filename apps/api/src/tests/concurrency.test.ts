import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import { db } from "@repo/db"
import { events, bookings, users } from "@repo/db/schema"
import { count, eq } from "drizzle-orm"
import { redis } from "../lib/redis"
import { BookingService } from "../services/booking.service"

// ─── Test Helpers ─────────────────────────────────────────────────────────────

async function createTestEvent(totalTickets: number, remainingTickets?: number) {
  const [event] = await db
    .insert(events)
    .values({
      name: `Test Event ${Date.now()}`,
      totalTickets,
      remainingTickets: remainingTickets ?? totalTickets,
      eventDate: new Date("2025-12-31"),
    })
    .returning()
  if (!event) throw new Error("Failed to create test event")
  return event
}

async function createTestUser(index: number) {
  const [user] = await db
    .insert(users)
    .values({
      email: `test-${Date.now()}-${index}@example.com`,
      password: "hashed-password",
      name: `Test User ${index}`,
    })
    .returning()
  if (!user) throw new Error("Failed to create test user")
  return user
}

// ─── Redis lifecycle ──────────────────────────────────────────────────────────

beforeAll(async () => {
  await redis.connect()
})

afterAll(async () => {
  await redis.quit()
})

// ─── Concurrency Tests ────────────────────────────────────────────────────────

describe("Concurrency: No Oversell", () => {

  it("100 concurrent bookings on 10-ticket event → exactly 10 succeed", async () => {
    const event = await createTestEvent(10)
    const testUsers = await Promise.all(Array.from({ length: 100 }, (_, i) => createTestUser(i)))

    // Fire 100 concurrent booking requests
    const results = await Promise.allSettled(
      testUsers.map((user) => BookingService.book(user.id, event.id, 1))
    )

    const succeeded = results.filter((r) => r.status === "fulfilled").length
    const failed = results.filter((r) => r.status === "rejected").length

    // Verify DB state
    const [updatedEvent] = await db.select().from(events).where(eq(events.id, event.id))

    const [countResult] = await db
      .select({ count: count() })
      .from(bookings)
      .where(eq(bookings.eventId, event.id))

    expect(succeeded).toBe(10) // Only 10 succeed
    expect(failed).toBe(90) // Rest fail gracefully
    expect(updatedEvent?.remainingTickets).toBe(0) // No tickets left
    expect(Number(countResult?.count)).toBe(10) // Exactly 10 booking records

    // Cleanup
    await db.delete(bookings).where(eq(bookings.eventId, event.id))
    await db.delete(events).where(eq(events.id, event.id))
    for (const u of testUsers) {
      await db.delete(users).where(eq(users.id, u.id))
    }
  }, 30_000)

  it("remaining tickets never goes below 0 (DB constraint enforced)", async () => {
    const event = await createTestEvent(1)
    const [u1, u2] = await Promise.all([createTestUser(200), createTestUser(201)])
    if (!u1 || !u2) throw new Error("Failed to create users")

    const results = await Promise.allSettled([
      BookingService.book(u1.id, event.id, 1),
      BookingService.book(u2.id, event.id, 1),
    ])

    const succeeded = results.filter((r) => r.status === "fulfilled").length
    const [updated] = await db.select().from(events).where(eq(events.id, event.id))

    expect(succeeded).toBe(1)
    expect(updated?.remainingTickets).toBeGreaterThanOrEqual(0)

    // Cleanup
    await db.delete(bookings).where(eq(bookings.eventId, event.id))
    await db.delete(events).where(eq(events.id, event.id))
  }, 15_000)
})

// ─── Business Rule Tests ──────────────────────────────────────────────────────

describe("Business Rules: 5-Ticket Limit", () => {
  it("rejects booking when combined quantity exceeds 5", async () => {
    const event = await createTestEvent(100)
    const user = await createTestUser(300)

    await BookingService.book(user.id, event.id, 3) // 3 booked

    await expect(
      BookingService.book(user.id, event.id, 3) // 3+3=6 → reject
    ).rejects.toThrow("LIMIT_EXCEEDED")

    // Cleanup
    await db.delete(bookings).where(eq(bookings.eventId, event.id))
    await db.delete(events).where(eq(events.id, event.id))
    await db.delete(users).where(eq(users.id, user.id))
  })

  it("allows booking up to exactly 5 tickets across multiple requests", async () => {
    const event = await createTestEvent(100)
    const user = await createTestUser(301)

    await BookingService.book(user.id, event.id, 3) // 3
    await BookingService.book(user.id, event.id, 2) // 5 ✅

    await expect(
      BookingService.book(user.id, event.id, 1) // 6 → reject
    ).rejects.toThrow("LIMIT_EXCEEDED")

    // Cleanup
    await db.delete(bookings).where(eq(bookings.eventId, event.id))
    await db.delete(events).where(eq(events.id, event.id))
    await db.delete(users).where(eq(users.id, user.id))
  })

  it("rejects booking when event has no remaining tickets", async () => {
    const event = await createTestEvent(1, 0)
    const user = await createTestUser(302)

    await expect(BookingService.book(user.id, event.id, 1)).rejects.toThrow("NOT_ENOUGH_TICKETS")

    // Cleanup
    await db.delete(events).where(eq(events.id, event.id))
    await db.delete(users).where(eq(users.id, user.id))
  })
})
