import { useState } from "react"
import type { Event } from "@repo/types"
import { useBook } from "../hooks/useBooking"

const MAX_PER_USER = 5

const ERROR_MESSAGES: Record<string, string> = {
  NOT_ENOUGH_TICKETS: "Not enough tickets left.",
  LIMIT_EXCEEDED: "You've hit the 5-ticket limit for this event.",
  SYSTEM_BUSY: "System's a bit busy — please try again.",
  UNAUTHORIZED: "Please log in first.",
}

type Props = { event: Event & { myBookedCount: number } }

export function BookingForm({ event }: Props) {
  const [quantity, setQuantity] = useState(1)
  const [successMsg, setSuccessMsg] = useState("")
  const { mutate: book, isPending, error } = useBook(event.id)

  const canBookMore = MAX_PER_USER - event.myBookedCount
  const maxAllowed = Math.min(event.remainingTickets, canBookMore, 5)
  const isSoldOut = event.remainingTickets === 0
  const isLimitReached = canBookMore <= 0

  const errorCode = (error as (Error & { code?: string }) | null)?.code
  const errorMessage = errorCode ? (ERROR_MESSAGES[errorCode] ?? error?.message) : null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSuccessMsg("")
    book(
      { eventId: event.id, quantity },
      {
        onSuccess: () => {
          setSuccessMsg(`${quantity} ticket${quantity !== 1 ? "s" : ""} booked!`)
          setQuantity(1)
        },
      }
    )
  }

  if (isSoldOut) {
    return <div className="p-4 bg-gray-100 rounded text-center text-gray-500">Sold out</div>
  }

  if (isLimitReached) {
    return (
      <div className="p-4 bg-yellow-50 rounded text-center text-yellow-700">
        You've used all 5 of your tickets for this event.
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-gray-600">
        Booked{" "}
        <strong>
          {event.myBookedCount} / {MAX_PER_USER}
        </strong>{" "}
        tickets
      </p>

      <div className="flex items-center gap-3">
        <label htmlFor="quantity" className="text-sm font-medium">
          Tickets
        </label>
        <input
          id="quantity"
          type="number"
          min={1}
          max={maxAllowed}
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          className="w-20 border rounded px-2 py-1 text-center"
        />
        <span className="text-sm text-gray-500">Max {maxAllowed}</span>
      </div>

      {errorMessage && <p className="text-red-600 text-sm">{errorMessage}</p>}

      {successMsg && <p className="text-green-600 text-sm font-medium">{successMsg}</p>}

      <button
        type="submit"
        disabled={isPending || quantity < 1 || quantity > maxAllowed}
        className="w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? "Booking..." : `Book ${quantity} ticket${quantity !== 1 ? "s" : ""}`}
      </button>
    </form>
  )
}
