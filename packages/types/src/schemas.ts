import { type } from "arktype"

// ─── Auth Schemas ─────────────────────────────────────────────────────────────

export const RegisterSchema = type({
  email: "string.email",
  // ArkRegex: uppercase + lowercase + digit + special char + min 8 chars
  password: /^(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*[!@#$%^&*]).{8,}$/,
  name: "1 <= string <= 255",
})

export const LoginSchema = type({
  email: "string.email",
  password: "string > 0",
})

// ─── Event Schemas ────────────────────────────────────────────────────────────

export const EventIdSchema = type({
  id: "string.uuid.v4",
})

// ─── Booking Schemas ──────────────────────────────────────────────────────────

export const BookingSchema = type({
  eventId: "string.uuid.v4",
  quantity: "1 <= number.integer <= 5",
})

// ─── Inferred Input Types ─────────────────────────────────────────────────────

export type RegisterInput = typeof RegisterSchema.infer
export type LoginInput = typeof LoginSchema.infer
export type BookingInput = typeof BookingSchema.infer
