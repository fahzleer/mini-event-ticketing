import { Link, useParams } from "react-router"
import { useEvent } from "../hooks/useEvents"
import { BookingForm } from "../components/BookingForm"
import { TicketBadge } from "../components/TicketBadge"

export function EventDetail() {
  const { id } = useParams<{ id: string }>()
  const { data: event, isLoading, error } = useEvent(id ?? "")

  if (isLoading) {
    return <div className="flex justify-center py-20 text-gray-500">Loading...</div>
  }

  if (error || !event) {
    return (
      <div className="text-center py-20">
        <p className="text-red-600 mb-4">Event not found.</p>
        <Link to="/" className="text-blue-600 hover:underline">
          Back to events
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link to="/" className="text-blue-600 hover:underline text-sm mb-6 block">
        ← All events
      </Link>

      <div className="bg-white rounded-lg border p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <h1 className="text-2xl font-bold">{event.name}</h1>
          <TicketBadge remaining={event.remainingTickets} total={event.totalTickets} />
        </div>

        {/* Details */}
        <div className="text-sm text-gray-600 space-y-1">
          {event.venue && <p>📍 {event.venue}</p>}
          <p>
            📅{" "}
            {new Date(event.eventDate).toLocaleDateString("en-GB", {
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
          <p>
            🎟 {event.remainingTickets} / {event.totalTickets} tickets remaining
          </p>
        </div>

        {event.description && <p className="text-gray-700 leading-relaxed">{event.description}</p>}

        <hr />

        {/* Booking Form */}
        <div>
          <h2 className="font-semibold text-lg mb-4">Book tickets</h2>
          <BookingForm event={event} />
        </div>
      </div>
    </div>
  )
}
