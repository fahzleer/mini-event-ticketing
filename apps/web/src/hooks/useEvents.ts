import { useQuery } from "@tanstack/react-query"
import { eventApi } from "../api/client"

export function useEvents() {
  return useQuery({
    queryKey: ["events"],
    queryFn: () => eventApi.list(),
    staleTime: 30_000,
  })
}

export function useEvent(id: string) {
  return useQuery({
    queryKey: ["events", id],
    queryFn: () => eventApi.detail(id),
    enabled: !!id,
    staleTime: 10_000,
  })
}
