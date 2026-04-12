import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  fetchRatings,
  submitRating,
  type ListRatingsQuery,
  type SubmitRatingPayload,
} from "@/lib/api/ratings"

export const ratingKeys = {
  all: ["ratings"] as const,
  list: (query: ListRatingsQuery) => ["ratings", "list", query] as const,
}

export function useRatings(query: ListRatingsQuery = {}) {
  return useQuery({
    queryKey: ratingKeys.list(query),
    queryFn: () => fetchRatings(query),
    staleTime: 30 * 1000,
  })
}

export function useSubmitRating() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: SubmitRatingPayload) => submitRating(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ratingKeys.all })
    },
  })
}
