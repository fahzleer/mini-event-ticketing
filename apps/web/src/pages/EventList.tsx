import { Link } from "react-router"
import { useEvents } from "../hooks/useEvents"
import { TicketBadge } from "../components/TicketBadge"

export function EventList() {
  const { data: events, isLoading, error } = useEvents()

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <p className="text-gray-500">Loading...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-20 text-red-600">
        Something went wrong: {(error as Error).message}
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Events</h1>

      {events?.length === 0 ? (
        <p className="text-gray-500 text-center py-20">No events yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events?.map((event) => (
            <Link
              key={event.id}
              to={`/events/${event.id}`}
              className="block border rounded-lg p-5 hover:shadow-md transition-shadow bg-white"
            >
              <div className="flex justify-between items-start mb-2">
                <h2 className="font-semibold text-lg leading-tight">{event.name}</h2>
                <TicketBadge
                  remaining={event.remainingTickets}
                  total={event.totalTickets}
                />
              </div>

              {event.description && (
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                  {event.description}
                </p>
              )}

              <div className="text-xs text-gray-500 space-y-1">
                {event.venue && <p>📍 {event.venue}</p>}
                <p>
                  📅{" "}
                  {new Date(event.eventDate).toLocaleDateString("en-GB", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
                <p>
                  🎟 {event.totalTickets} {event.totalTickets === 1 ? "ticket" : "tickets"}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
