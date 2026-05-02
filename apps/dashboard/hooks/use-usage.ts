"use client"

/**
 * useUsage — Deqah Dashboard
 *
 * Fetches the authenticated organization's usage counters from
 * `GET /dashboard/billing/usage`.
 *
 * staleTime is 30s so the sidebar widget stays fresh without hammering the API.
 */

import { useQuery } from "@tanstack/react-query"

import { billingApi } from "@/lib/api/billing"
import { queryKeys } from "@/lib/query-keys"
import type { UsageRow } from "@/lib/types/billing"

export function useUsage() {
  return useQuery<UsageRow[]>({
    queryKey: [...queryKeys.billing.all, "usage"] as const,
    queryFn: () => billingApi.getUsage(),
    staleTime: 30_000,
  })
}
