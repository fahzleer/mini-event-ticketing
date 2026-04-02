import { cors } from "@elysiajs/cors"
import { swagger } from "@elysiajs/swagger"
import { Elysia } from "elysia"
import { authRoutes } from "./routes/auth"
import { bookingRoutes } from "./routes/bookings"
import { eventRoutes } from "./routes/events"

// ─── Error Code → HTTP Status + Message Map ──────────────────────────────────
// Consistent error responses (lesson from Spring Security's inconsistent format)
const ERROR_MAP: Record<string, { status: number; message: string }> = {
  UNAUTHORIZED: { status: 401, message: "Authentication required" },
  TOKEN_INVALID: { status: 401, message: "Invalid or expired token" },
  VALIDATION_ERROR: { status: 400, message: "Invalid request data" },
  EMAIL_TAKEN: { status: 409, message: "Email already registered" },
  INVALID_CREDENTIALS: { status: 401, message: "Invalid email or password" },
  REGISTER_FAILED: { status: 500, message: "Registration failed" },
  EVENT_NOT_FOUND: { status: 404, message: "Event not found" },
  NOT_ENOUGH_TICKETS: { status: 409, message: "Not enough tickets available" },
  LIMIT_EXCEEDED: {
    status: 422,
    message: "Exceeds 5-ticket limit per event per user",
  },
  SYSTEM_BUSY: {
    status: 429,
    message: "System is busy, please try again shortly",
  },
  BOOKING_FAILED: { status: 500, message: "Booking failed, please retry" },
}

const PORT = Number(process.env.PORT ?? 3000)

// CORS_ORIGIN defaults to "*" for local dev.
// In production set CORS_ORIGIN=https://your-frontend.vercel.app to restrict access.
// Redis distributed lock is intentionally used instead of in-memory mutex so the
// service can scale horizontally to multiple instances without race conditions.
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "*"

const app = new Elysia()
  .use(cors({ origin: CORS_ORIGIN, credentials: true }))
  .use(
    swagger({
      path: "/docs",
      documentation: {
        info: { title: "Mini Ticketing API", version: "1.0.0" },
      },
    })
  )
  // ─── Global error handler ────────────────────────────────────────────────
  // No stack traces leaked — only structured error responses
  .onError(({ error, set }) => {
    const message = error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR"
    const mapped = ERROR_MAP[message]

    set.status = mapped?.status ?? 500

    return {
      success: false,
      error: mapped?.message ?? "Internal server error",
      code: message,
    }
  })
  // ─── Health ──────────────────────────────────────────────────────────────
  .get("/health", () => ({ status: "healthy", timestamp: new Date() }))
  // ─── Routes ──────────────────────────────────────────────────────────────
  .use(authRoutes)
  .use(eventRoutes)
  .use(bookingRoutes)
  .listen(PORT)

console.log(`🦊 API running at http://localhost:${PORT}`)
console.log(`📖 Swagger docs at http://localhost:${PORT}/docs`)

export type App = typeof app
