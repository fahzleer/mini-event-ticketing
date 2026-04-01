import { Elysia } from "elysia"
import { type } from "arktype"
import { BookingSchema } from "@repo/types"
import { authMiddleware } from "../middleware/auth.middleware"
import { BookingService } from "../services/booking.service"

export const bookingRoutes = new Elysia({ prefix: "/bookings" })
  .use(authMiddleware)
  // ⚠️ Route order matters — specific before parameterized (Spring Security lesson)
  // GET /bookings/my must come BEFORE GET /bookings/:id
  .get("/my", async ({ userId }) => {
    const data = await BookingService.getMyBookings(userId)
    return { success: true, data }
  })
  .post("/", async ({ body, userId }) => {
    const input = BookingSchema(body)
    if (input instanceof type.errors) {
      throw new Error("VALIDATION_ERROR")
    }

    const booking = await BookingService.book(
      userId,
      input.eventId,
      input.quantity
    )
    return { success: true, data: booking }
  })
