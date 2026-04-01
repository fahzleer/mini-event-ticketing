import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { bookingApi } from "../api/client"
import type { BookingInput } from "@repo/types"

export function useMyBookings() {
  return useQuery({
    queryKey: ["bookings", "my"],
    queryFn: () => bookingApi.mine(),
  })
}

export function useBook(eventId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: BookingInput) => bookingApi.book(data),
    onSuccess: () => {
      // Refetch event detail to show updated remaining tickets
      void queryClient.invalidateQueries({ queryKey: ["events", eventId] })
      void queryClient.invalidateQueries({ queryKey: ["bookings", "my"] })
    },
  })
}
