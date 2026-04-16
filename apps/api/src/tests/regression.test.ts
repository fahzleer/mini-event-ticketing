import { beforeAll, describe, expect, it } from "bun:test"
import { db } from "@repo/db"
import { events, bookings, users } from "@repo/db/schema"
import { eq } from "drizzle-orm"
import { redis } from "../lib/redis"
import { AuthService } from "../services/auth.service"
import { BookingService } from "../services/booking.service"
import { EventService } from "../services/event.service"

// ─── Test Helpers ─────────────────────────────────────────────────────────────

function uniqueEmail() {
  return `regression+${Date.now()}_${Math.random().toString(36).slice(2, 7)}@test.local`
}

async function createTestEvent(totalTickets: number, remainingTickets?: number) {
  const [event] = await db
    .insert(events)
    .values({
      name: `Regression Event ${Date.now()}`,
      totalTickets,
      remainingTickets: remainingTickets ?? totalTickets,
      eventDate: new Date("2099-12-31"),
    })
    .returning()
  if (!event) throw new Error("Failed to create test event")
  return event
}

async function createTestUser(email?: string) {
  const [user] = await db
    .insert(users)
    .values({
      email: email ?? uniqueEmail(),
      password: "hashed-placeholder",
      name: "Regression User",
    })
    .returning()
  if (!user) throw new Error("Failed to create test user")
  return user
}

// ─── Redis lifecycle ──────────────────────────────────────────────────────────
// lazyConnect: true in redis.ts — connection is established automatically on
// first command. Do not call redis.quit() here: both test files share the same
// Redis singleton and quitting in one file closes the connection for the other.

beforeAll(async () => {
  if (redis.status === "wait") await redis.connect()
})

// ─── AuthService Regression ───────────────────────────────────────────────────

describe("AuthService — register", () => {
  it("TC-REG-01 — Valid registration returns user without password field", async () => {
    const email = uniqueEmail()

    const user = await AuthService.register({ email, name: "Test User", password: "Password1!" })

    expect(user.email).toBe(email)
    expect(user.name).toBe("Test User")
    expect(user.id).toBeDefined()
    expect(user.createdAt).toBeDefined()
    // Password must never be returned
    expect((user as Record<string, unknown>).password).toBeUndefined()

    // Cleanup
    await db.delete(users).where(eq(users.id, user.id))
  })

  it("TC-REG-02 — Duplicate email throws EMAIL_TAKEN", async () => {
    const email = uniqueEmail()

    const first = await AuthService.register({ email, name: "First", password: "Password1!" })

    await expect(
      AuthService.register({ email, name: "Second", password: "Password1!" })
    ).rejects.toThrow("EMAIL_TAKEN")

    // Cleanup
    await db.delete(users).where(eq(users.id, first.id))
  })

  it("TC-REG-03 — Password is stored as bcrypt hash, not plaintext", async () => {
    const email = uniqueEmail()
    const plaintext = "Password1!"

    const user = await AuthService.register({ email, name: "Hash Test", password: plaintext })

    const [row] = await db.select().from(users).where(eq(users.id, user.id))
    expect(row?.password).not.toBe(plaintext)
    // Bun.password.hash() defaults to argon2id
    expect(row?.password).toMatch(/^\$argon2id\$/)

    // Cleanup
    await db.delete(users).where(eq(users.id, user.id))
  })
})

describe("AuthService — login", () => {
  it("TC-LOGIN-01 — Valid credentials return user profile", async () => {
    const email = uniqueEmail()
    await AuthService.register({ email, name: "Login User", password: "Password1!" })

    const user = await AuthService.login({ email, password: "Password1!" })

    expect(user.email).toBe(email)
    expect(user.id).toBeDefined()
    expect((user as Record<string, unknown>).password).toBeUndefined()

    // Cleanup
    await db.delete(users).where(eq(users.id, user.id))
  })

  it("TC-LOGIN-02 — Wrong password throws INVALID_CREDENTIALS", async () => {
    const email = uniqueEmail()
    const registered = await AuthService.register({
      email,
      name: "Login User",
      password: "Password1!",
    })

    await expect(AuthService.login({ email, password: "WrongPassword1!" })).rejects.toThrow(
      "INVALID_CREDENTIALS"
    )

    // Cleanup
    await db.delete(users).where(eq(users.id, registered.id))
  })

  it("TC-LOGIN-03 — Non-existent email throws INVALID_CREDENTIALS", async () => {
    await expect(
      AuthService.login({ email: "ghost@nowhere.local", password: "Password1!" })
    ).rejects.toThrow("INVALID_CREDENTIALS")
  })

  it("TC-LOGIN-04 — Login with correct password after register succeeds (hash round-trip)", async () => {
    const email = uniqueEmail()
    const password = "Str0ng!Pass"

    const registered = await AuthService.register({ email, name: "Round-trip", password })
    const loggedIn = await AuthService.login({ email, password })

    expect(loggedIn.id).toBe(registered.id)

    // Cleanup
    await db.delete(users).where(eq(users.id, registered.id))
  })
})

// ─── EventService Regression ──────────────────────────────────────────────────

describe("EventService — findAll", () => {
  it("TC-EVT-SVC-01 — Returns at least the events created for this test, ordered by eventDate ASC", async () => {
    const earlier = await db
      .insert(events)
      .values({
        name: "Earlier Event",
        totalTickets: 10,
        remainingTickets: 10,
        eventDate: new Date("2099-01-01"),
      })
      .returning()
    const later = await db
      .insert(events)
      .values({
        name: "Later Event",
        totalTickets: 10,
        remainingTickets: 10,
        eventDate: new Date("2099-06-01"),
      })
      .returning()

    const earlierId = earlier[0]?.id
    const laterId = later[0]?.id
    if (!earlierId || !laterId) throw new Error("Failed to create events")

    const all = await EventService.findAll()

    // Events should exist in the result
    const foundEarlier = all.find((e) => e.id === earlierId)
    const foundLater = all.find((e) => e.id === laterId)
    expect(foundEarlier).toBeDefined()
    expect(foundLater).toBeDefined()

    // Earlier must come before Later in the sorted list
    const earlierIndex = all.findIndex((e) => e.id === earlierId)
    const laterIndex = all.findIndex((e) => e.id === laterId)
    expect(earlierIndex).toBeLessThan(laterIndex)

    // Cleanup
    await db.delete(events).where(eq(events.id, earlierId))
    await db.delete(events).where(eq(events.id, laterId))
  })
})

describe("EventService — findById", () => {
  it("TC-EVT-SVC-02 — Returns event with myBookedCount = 0 when no userId provided", async () => {
    const event = await createTestEvent(100)

    const result = await EventService.findById(event.id)

    expect(result.id).toBe(event.id)
    expect(result.myBookedCount).toBe(0)

    // Cleanup
    await db.delete(events).where(eq(events.id, event.id))
  })

  it("TC-EVT-SVC-03 — Returns myBookedCount = 0 when userId has no bookings for this event", async () => {
    const event = await createTestEvent(100)
    const user = await createTestUser()

    const result = await EventService.findById(event.id, user.id)

    expect(result.myBookedCount).toBe(0)

    // Cleanup
    await db.delete(events).where(eq(events.id, event.id))
    await db.delete(users).where(eq(users.id, user.id))
  })

  it("TC-EVT-SVC-04 — myBookedCount reflects confirmed bookings for the user on this event", async () => {
    const event = await createTestEvent(100)
    const user = await createTestUser()

    // Create 2 confirmed bookings with quantity 2 and 1 → total = 3
    await db
      .insert(bookings)
      .values({ userId: user.id, eventId: event.id, quantity: 2, status: "confirmed" })
    await db
      .insert(bookings)
      .values({ userId: user.id, eventId: event.id, quantity: 1, status: "confirmed" })

    const result = await EventService.findById(event.id, user.id)

    expect(result.myBookedCount).toBe(3)

    // Cleanup
    await db.delete(bookings).where(eq(bookings.eventId, event.id))
    await db.delete(events).where(eq(events.id, event.id))
    await db.delete(users).where(eq(users.id, user.id))
  })

  it("TC-EVT-SVC-05 — myBookedCount excludes cancelled bookings", async () => {
    const event = await createTestEvent(100)
    const user = await createTestUser()

    await db
      .insert(bookings)
      .values({ userId: user.id, eventId: event.id, quantity: 3, status: "confirmed" })
    await db
      .insert(bookings)
      .values({ userId: user.id, eventId: event.id, quantity: 2, status: "cancelled" })

    const result = await EventService.findById(event.id, user.id)

    // Only confirmed bookings count — cancelled must be excluded
    expect(result.myBookedCount).toBe(3)

    // Cleanup
    await db.delete(bookings).where(eq(bookings.eventId, event.id))
    await db.delete(events).where(eq(events.id, event.id))
    await db.delete(users).where(eq(users.id, user.id))
  })

  it("TC-EVT-SVC-06 — Non-existent event ID throws EVENT_NOT_FOUND", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000"

    await expect(EventService.findById(fakeId)).rejects.toThrow("EVENT_NOT_FOUND")
  })

  it("TC-EVT-SVC-07 — myBookedCount is per-user: other users' bookings not counted", async () => {
    const event = await createTestEvent(100)
    const userA = await createTestUser()
    const userB = await createTestUser()

    // User B books 3 tickets; User A books 1
    await db
      .insert(bookings)
      .values({ userId: userB.id, eventId: event.id, quantity: 3, status: "confirmed" })
    await db
      .insert(bookings)
      .values({ userId: userA.id, eventId: event.id, quantity: 1, status: "confirmed" })

    const result = await EventService.findById(event.id, userA.id)

    // User A sees only their own 1 ticket, not userB's 3
    expect(result.myBookedCount).toBe(1)

    // Cleanup
    await db.delete(bookings).where(eq(bookings.eventId, event.id))
    await db.delete(events).where(eq(events.id, event.id))
    await db.delete(users).where(eq(users.id, userA.id))
    await db.delete(users).where(eq(users.id, userB.id))
  })
})

// ─── BookingService — getMyBookings Regression ───────────────────────────────

describe("BookingService — getMyBookings", () => {
  it("TC-BK-SVC-01 — Returns empty array when user has no bookings", async () => {
    const user = await createTestUser()

    const result = await BookingService.getMyBookings(user.id)

    expect(result).toEqual([])

    // Cleanup
    await db.delete(users).where(eq(users.id, user.id))
  })

  it("TC-BK-SVC-02 — Returns confirmed bookings with related event data", async () => {
    const event = await createTestEvent(100)
    const user = await createTestUser()

    await BookingService.book(user.id, event.id, 2)

    const result = await BookingService.getMyBookings(user.id)

    expect(result).toHaveLength(1)
    expect(result[0]?.quantity).toBe(2)
    expect(result[0]?.status).toBe("confirmed")
    // Related event data must be joined
    expect(result[0]?.event).toBeDefined()
    expect(result[0]?.event?.id).toBe(event.id)

    // Cleanup
    await db.delete(bookings).where(eq(bookings.eventId, event.id))
    await db.delete(events).where(eq(events.id, event.id))
    await db.delete(users).where(eq(users.id, user.id))
  })

  it("TC-BK-SVC-03 — Returns multiple bookings ordered by createdAt DESC (newest first)", async () => {
    const eventA = await createTestEvent(100)
    const eventB = await createTestEvent(100)
    const user = await createTestUser()

    // Book in order: A first, then B
    await BookingService.book(user.id, eventA.id, 1)
    await BookingService.book(user.id, eventB.id, 1)

    const result = await BookingService.getMyBookings(user.id)

    expect(result).toHaveLength(2)
    // Most recent booking (eventB) must come first
    expect(result[0]?.eventId).toBe(eventB.id)
    expect(result[1]?.eventId).toBe(eventA.id)

    // Cleanup
    await db.delete(bookings).where(eq(bookings.eventId, eventA.id))
    await db.delete(bookings).where(eq(bookings.eventId, eventB.id))
    await db.delete(events).where(eq(events.id, eventA.id))
    await db.delete(events).where(eq(events.id, eventB.id))
    await db.delete(users).where(eq(users.id, user.id))
  })

  it("TC-BK-SVC-04 — Does not return bookings belonging to other users", async () => {
    const event = await createTestEvent(100)
    const userA = await createTestUser()
    const userB = await createTestUser()

    await BookingService.book(userA.id, event.id, 1)
    await BookingService.book(userB.id, event.id, 1)

    const resultA = await BookingService.getMyBookings(userA.id)

    // User A should only see their own booking
    expect(resultA).toHaveLength(1)
    expect(resultA[0]?.userId).toBe(userA.id)

    // Cleanup
    await db.delete(bookings).where(eq(bookings.eventId, event.id))
    await db.delete(events).where(eq(events.id, event.id))
    await db.delete(users).where(eq(users.id, userA.id))
    await db.delete(users).where(eq(users.id, userB.id))
  })
})

// ─── BookingService — remainingTickets consistency ───────────────────────────

describe("BookingService — ticket count consistency", () => {
  it("TC-BK-SVC-05 — remainingTickets decrements by exactly the booked quantity", async () => {
    const event = await createTestEvent(50)
    const user = await createTestUser()

    await BookingService.book(user.id, event.id, 3)

    const [updated] = await db.select().from(events).where(eq(events.id, event.id))
    expect(updated?.remainingTickets).toBe(47)

    // Cleanup
    await db.delete(bookings).where(eq(bookings.eventId, event.id))
    await db.delete(events).where(eq(events.id, event.id))
    await db.delete(users).where(eq(users.id, user.id))
  })

  it("TC-BK-SVC-06 — remainingTickets is consistent across sequential bookings by different users", async () => {
    const event = await createTestEvent(10)
    const userA = await createTestUser()
    const userB = await createTestUser()

    await BookingService.book(userA.id, event.id, 3)
    await BookingService.book(userB.id, event.id, 4)

    const [updated] = await db.select().from(events).where(eq(events.id, event.id))
    // 10 - 3 - 4 = 3 remaining
    expect(updated?.remainingTickets).toBe(3)

    // Cleanup
    await db.delete(bookings).where(eq(bookings.eventId, event.id))
    await db.delete(events).where(eq(events.id, event.id))
    await db.delete(users).where(eq(users.id, userA.id))
    await db.delete(users).where(eq(users.id, userB.id))
  })

  it("TC-BK-SVC-07 — Booking 0-ticket event is rejected with NOT_ENOUGH_TICKETS", async () => {
    const event = await createTestEvent(5, 0)
    const user = await createTestUser()

    await expect(BookingService.book(user.id, event.id, 1)).rejects.toThrow("NOT_ENOUGH_TICKETS")

    // Cleanup
    await db.delete(events).where(eq(events.id, event.id))
    await db.delete(users).where(eq(users.id, user.id))
  })

  it("TC-BK-SVC-08 — Booking more than remainingTickets is rejected with NOT_ENOUGH_TICKETS", async () => {
    const event = await createTestEvent(10, 2)
    const user = await createTestUser()

    // Try to book 3 when only 2 remain
    await expect(BookingService.book(user.id, event.id, 3)).rejects.toThrow("NOT_ENOUGH_TICKETS")

    const [unchanged] = await db.select().from(events).where(eq(events.id, event.id))
    // remainingTickets must not have changed
    expect(unchanged?.remainingTickets).toBe(2)

    // Cleanup
    await db.delete(events).where(eq(events.id, event.id))
    await db.delete(users).where(eq(users.id, user.id))
  })
})
