/// <reference types="node" />
/**
 * Direct API helpers — bypass the browser UI to set up test state and make
 * raw assertions against the backend (things you can't verify with naked eyes).
 */

export const API_URL =
  process.env.API_URL ?? "https://mini-event-ticketing-api.up.railway.app"

// ─── Types ───────────────────────────────────────────────────────────────────

export type AuthResponse = {
  success: true
  data: { token: string; refreshToken: string; user: { id: string; email: string; name: string } }
}

export type ApiError = {
  success: false
  error: string
  code: string
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────

/** Register a throwaway test user. Email must be unique per test run. */
export async function register(
  email: string,
  password = "Test1234!",
  name = "Test User"
): Promise<AuthResponse["data"]> {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
  })
  const json = (await res.json()) as AuthResponse | ApiError
  if (!json.success) throw new Error(`Register failed: ${(json as ApiError).code}`)
  return (json as AuthResponse).data
}

/** Login and return tokens + user. */
export async function login(
  email: string,
  password = "Test1234!"
): Promise<AuthResponse["data"]> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })
  const json = (await res.json()) as AuthResponse | ApiError
  if (!json.success) throw new Error(`Login failed: ${(json as ApiError).code}`)
  return (json as AuthResponse).data
}

/** Logout — blacklists the current access token in Redis. */
export async function logout(accessToken: string): Promise<void> {
  const res = await fetch(`${API_URL}/auth/logout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Logout failed: ${res.status}`)
}

/** Exchange a refresh token for a new access token + refreshToken pair. */
export async function refreshTokens(
  refreshToken: string
): Promise<{ token: string; refreshToken: string }> {
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  })
  const json = (await res.json()) as { success: true; data: { token: string; refreshToken: string } } | ApiError
  if (!json.success) throw new Error(`Refresh failed: ${(json as ApiError).code}`)
  return (json as { success: true; data: { token: string; refreshToken: string } }).data
}

// ─── Event helpers ────────────────────────────────────────────────────────────

export type Event = {
  id: string
  name: string
  remainingTickets: number
  totalTickets: number
}

/** List all events (requires auth token). */
export async function listEvents(accessToken: string): Promise<Event[]> {
  const res = await fetch(`${API_URL}/events`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const json = (await res.json()) as { success: true; data: Event[] }
  return json.data
}

// ─── Booking helpers ──────────────────────────────────────────────────────────

export type BookingResult =
  | { success: true; data: unknown }
  | { success: false; code: string; error: string }

/** Book tickets directly via API. Returns the raw result so callers can assert. */
export async function bookTickets(
  accessToken: string,
  eventId: string,
  quantity: number
): Promise<BookingResult> {
  const res = await fetch(`${API_URL}/bookings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ eventId, quantity }),
  })
  return res.json() as Promise<BookingResult>
}

// ─── Test user factory ────────────────────────────────────────────────────────

/** Create a unique test user for each test run (uses timestamp + random suffix). */
export function uniqueEmail(): string {
  return `test+${Date.now()}_${Math.random().toString(36).slice(2, 7)}@playwright.local`
}
