"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { addToWaitlist } from "@/lib/api/waitlist"
import type { AddToWaitlistPayload } from "@/lib/api/waitlist"

/* ─── Waitlist Mutations ─── */

export function useWaitlistMutations() {
  const queryClient = useQueryClient()
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.waitlist.all })

  const addMut = useMutation({
    mutationFn: (payload: AddToWaitlistPayload) => addToWaitlist(payload),
    onSuccess: invalidate,
  })

  return { addMut }
}
