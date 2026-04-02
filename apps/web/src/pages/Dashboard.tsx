import type { User } from "@repo/types"
import { Link } from "react-router"
import { useMyBookings } from "../hooks/useBooking"

type Props = { user: User }

export function Dashboard({ user }: Props) {
  const { data: bookings, isLoading, error } = useMyBookings()

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-2">My Dashboard</h1>
      <p className="text-gray-600 mb-8">Hey, {user.name}</p>

      <h2 className="text-lg font-semibold mb-4">Your Bookings</h2>

      {isLoading && <p className="text-gray-500">Loading...</p>}

      {error && <p className="text-red-600">{(error as Error).message}</p>}

      {!isLoading && bookings?.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="mb-4">No bookings yet.</p>
          <Link to="/" className="text-blue-600 hover:underline">
            Browse events
          </Link>
        </div>
      )}

      {bookings &&
        bookings.length > 0 &&
        (() => {
          const grouped = bookings.reduce<
            Record<
              string,
              { event: (typeof bookings)[0]["event"]; totalQuantity: number; latestDate: Date }
            >
          >((acc, booking) => {
            const key = booking.event.id
            const existing = acc[key]
            if (!existing) {
              acc[key] = {
                event: booking.event,
                totalQuantity: booking.quantity,
                latestDate: booking.createdAt,
              }
              return acc
            }
            existing.totalQuantity += booking.quantity
            if (booking.createdAt > existing.latestDate) {
              existing.latestDate = booking.createdAt
            }
            return acc
          }, {})

          return (
            <div className="space-y-3">
              {Object.values(grouped).map(({ event, totalQuantity, latestDate }) => (
                <div
                  key={event.id}
                  className="border rounded-lg p-4 bg-white flex justify-between items-center"
                >
                  <div>
                    <p className="font-medium">{event.name}</p>
                    <p className="text-sm text-gray-600">
                      {event.venue && `📍 ${event.venue} · `}📅{" "}
                      {new Date(event.eventDate).toLocaleDateString("en-GB", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Last booked on {new Date(latestDate).toLocaleDateString("en-GB")}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-lg font-bold">{totalQuantity}</span>
                    <p className="text-xs text-gray-500">
                      {totalQuantity === 1 ? "ticket" : "tickets"}
                    </p>
                    <span className="inline-block mt-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded">
                      confirmed
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )
        })()}
    </div>
  )
}
