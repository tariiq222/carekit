"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { fetchChatSessions } from "@/lib/api/chatbot"
import type { ChatSessionListQuery } from "@/lib/types/chatbot"

// useChatSession stub — no backend single-session endpoint
export function useChatSession(_sessionId: string) {
  return { session: null as import("@/lib/types/chatbot").ChatSessionDetail | null, loading: false, error: null as string | null, refetch: () => {} }
}

export function useChatSessions() {
  const [page, setPage] = useState(1)
  const [filters, setFiltersState] = useState<Omit<ChatSessionListQuery, "page" | "perPage">>({})

  const query: ChatSessionListQuery = { page, perPage: 20, ...filters }

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.chatbot.sessions.list(query),
    queryFn: () => fetchChatSessions(query),
    staleTime: 60 * 1000,
  })

  const setFilters = (f: Omit<ChatSessionListQuery, "page" | "perPage">) => {
    setFiltersState(f)
    setPage(1)
  }

  const resetFilters = () => {
    setFiltersState({})
    setPage(1)
  }

  const hasFilters = Object.keys(filters).some(
    (k) => filters[k as keyof typeof filters] !== undefined,
  )

  return {
    sessions: data?.items ?? [],
    meta: data?.meta ?? null,
    loading: isLoading,
    error: error?.message ?? null,
    filters,
    setFilters,
    resetFilters,
    setPage,
    hasFilters,
  }
}
