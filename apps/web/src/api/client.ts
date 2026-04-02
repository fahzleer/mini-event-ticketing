import type { Booking, BookingInput, Event, LoginInput, RegisterInput, User } from "@repo/types"
import axios from "axios"

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:3000",
  headers: { "Content-Type": "application/json" },
})

// Inject JWT on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token")
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Unwrap API response or throw structured error
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const code: string = err.response?.data?.code ?? "UNKNOWN_ERROR"
    const message: string = err.response?.data?.error ?? "Something went wrong"
    const error = new Error(message) as Error & { code: string }
    error.code = code
    return Promise.reject(error)
  }
)

// ─── Auth ────────────────────────────────────────────────────────────────────

export const authApi = {
  register: (data: RegisterInput) =>
    api
      .post<{ success: true; data: { token: string; user: User } }>("/auth/register", data)
      .then((r) => r.data.data),

  login: (data: LoginInput) =>
    api
      .post<{ success: true; data: { token: string; user: User } }>("/auth/login", data)
      .then((r) => r.data.data),
}

// ─── Events ──────────────────────────────────────────────────────────────────

export const eventApi = {
  list: () => api.get<{ success: true; data: Event[] }>("/events").then((r) => r.data.data),

  detail: (id: string) =>
    api
      .get<{ success: true; data: Event & { myBookedCount: number } }>(`/events/${id}`)
      .then((r) => r.data.data),
}

// ─── Bookings ────────────────────────────────────────────────────────────────

export const bookingApi = {
  book: (data: BookingInput) =>
    api.post<{ success: true; data: Booking }>("/bookings", data).then((r) => r.data.data),

  mine: () => api.get<{ success: true; data: Booking[] }>("/bookings/my").then((r) => r.data.data),
}
