// Schemas + Input types (ArkType + ArkRegex)
export {
  RegisterSchema,
  LoginSchema,
  EventIdSchema,
  BookingSchema,
} from "./schemas"

export type { RegisterInput, LoginInput, BookingInput } from "./schemas"

import type { events, bookings, users } from "@repo/db/schema"
// Response types — inferred from Drizzle schema (single source of truth)
import type { InferSelectModel } from "drizzle-orm"

export type User = Omit<InferSelectModel<typeof users>, "password">
export type Event = InferSelectModel<typeof events>
export type Booking = InferSelectModel<typeof bookings> & { event: Event }

// API Response wrapper
export type ApiResponse<T> = {
  success: true
  data: T
}

export type ApiError = {
  success: false
  error: string
  code: string
}
