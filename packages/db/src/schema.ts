import { relations, sql } from "drizzle-orm"
import { check, integer, pgEnum, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core"

// ─── Users ──────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

// ─── Events ─────────────────────────────────────────────────────────────────

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    description: varchar("description", { length: 1000 }),
    totalTickets: integer("total_tickets").notNull(),
    remainingTickets: integer("remaining_tickets").notNull(),
    eventDate: timestamp("event_date").notNull(),
    venue: varchar("venue", { length: 255 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    // Layer 3: DB constraint — absolute last line of defense against oversell
    check("remaining_non_negative", sql`${table.remainingTickets} >= 0`),
    check("remaining_lte_total", sql`${table.remainingTickets} <= ${table.totalTickets}`),
    check("total_tickets_positive", sql`${table.totalTickets} > 0`),
  ]
)

// ─── Bookings ────────────────────────────────────────────────────────────────

export const bookingStatusEnum = pgEnum("booking_status", ["confirmed", "cancelled"])

export const bookings = pgTable("bookings", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull(),
  status: bookingStatusEnum("status").default("confirmed").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

// ─── Relations ───────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  bookings: many(bookings),
}))

export const eventsRelations = relations(events, ({ many }) => ({
  bookings: many(bookings),
}))

export const bookingsRelations = relations(bookings, ({ one }) => ({
  user: one(users, { fields: [bookings.userId], references: [users.id] }),
  event: one(events, { fields: [bookings.eventId], references: [events.id] }),
}))
