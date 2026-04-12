"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import {
  createInvoice,
} from "@/lib/api/invoices"

/* ─── Mutations ─── */

export function useInvoiceMutations() {
  const queryClient = useQueryClient()
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })

  const createMut = useMutation({
    mutationFn: createInvoice,
    onSuccess: invalidate,
  })

  return { createMut }
}
