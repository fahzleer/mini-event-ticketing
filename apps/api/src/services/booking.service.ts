import { db } from "@repo/db"
import { bookings, events } from "@repo/db/schema"
import { and, desc, eq, sum } from "drizzle-orm"
import { sql } from "drizzle-orm"
import { acquireLock, releaseLock } from "../lib/redis"

const MAX_TICKETS_PER_USER = 5
const LOCK_TTL_MS = 5000

export const BookingService = {
  async book(userId: string, eventId: string, quantity: number) {
    // ── Layer A: Pre-check before lock (fast-fail for obvious violations) ──────
    // Lesson from Spring Security: method-level check catches what URL-level misses
    const [preCheck] = await db
      .select({ total: sum(bookings.quantity) })
      .from(bookings)
      .where(
        and(
          eq(bookings.userId, userId),
          eq(bookings.eventId, eventId),
          eq(bookings.status, "confirmed")
        )
      )

    const alreadyBooked = Number(preCheck?.total ?? 0)
    if (alreadyBooked + quantity > MAX_TICKETS_PER_USER) {
      throw new Error("LIMIT_EXCEEDED")
    }

    // ── Layer B: Redis Distributed Lock ────────────────────────────────────────
    // Prevents multiple requests from entering the critical section simultaneously
    const lockKey = `event:${eventId}`
    const locked = await acquireLock(lockKey, LOCK_TTL_MS)
    if (!locked) throw new Error("SYSTEM_BUSY")

    try {
      // ── Layer C: DB Transaction + SELECT FOR UPDATE ─────────────────────────
      return await db.transaction(async (tx) => {
        // Lock the event row — no other transaction can read/write until commit
        const [event] = await tx
          .select()
          .from(events)
          .where(eq(events.id, eventId))
          .for("update")

        if (!event) throw new Error("EVENT_NOT_FOUND")
        if (event.remainingTickets < quantity) throw new Error("NOT_ENOUGH_TICKETS")

        // TOCTOU double-check inside lock
        // Two requests could both pass Layer A before either acquires the lock
        // This catches that race condition definitively
        const [inTxCheck] = await tx
          .select({ total: sum(bookings.quantity) })
          .from(bookings)
          .where(
            and(
              eq(bookings.userId, userId),
              eq(bookings.eventId, eventId),
              eq(bookings.status, "confirmed")
            )
          )

        const currentTotal = Number(inTxCheck?.total ?? 0)
        if (currentTotal + quantity > MAX_TICKETS_PER_USER) {
          throw new Error("LIMIT_EXCEEDED")
        }

        // Atomic decrement + insert booking
        await tx
          .update(events)
          .set({
            remainingTickets: sql`${events.remainingTickets} - ${quantity}`,
          })
          .where(eq(events.id, eventId))

        const [booking] = await tx
          .insert(bookings)
          .values({ userId, eventId, quantity, status: "confirmed" })
          .returning()

        if (!booking) throw new Error("BOOKING_FAILED")
        return booking
      })
    } finally {
      // Always release the lock — even if transaction fails
      await releaseLock(lockKey)
    }
  },

  async getMyBookings(userId: string) {
    return db.query.bookings.findMany({
      where: and(
        eq(bookings.userId, userId),
        eq(bookings.status, "confirmed")
      ),
      with: { event: true },
      orderBy: (b) => [desc(b.createdAt)],
    })
  },
}
