import { db } from "@repo/db"
import { events, bookings } from "@repo/db/schema"
import { and, asc, eq, sum } from "drizzle-orm"

export const EventService = {
  async findAll() {
    return db.select().from(events).orderBy(asc(events.eventDate))
  },

  async findById(id: string, userId?: string) {
    const event = await db.query.events.findFirst({
      where: eq(events.id, id),
    })
    if (!event) throw new Error("EVENT_NOT_FOUND")

    // Show how many tickets the current user has booked for this event
    let myBookedCount = 0
    if (userId) {
      const [result] = await db
        .select({ total: sum(bookings.quantity) })
        .from(bookings)
        .where(
          and(
            eq(bookings.userId, userId),
            eq(bookings.eventId, id),
            eq(bookings.status, "confirmed")
          )
        )
      myBookedCount = Number(result?.total ?? 0)
    }

    return { ...event, myBookedCount }
  },
}
