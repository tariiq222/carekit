"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { fetchChatSessions } from "@/lib/api/chatbot"
import type { ChatSessionListQuery } from "@/lib/types/chatbot"

// useChatSession stub — TODO: no backend single-session endpoint
export function useChatSession(_sessionId: string) {
  return { session: null as import("@/lib/types/chatbot").ChatSessionDetail | null, loading: false, error: null as string | null, refetch: () => {} }
}

export function useChatSessions() {
  const [page, setPage] = [1, () => {}]

  const query: ChatSessionListQuery = {
    page,
    perPage: 20,
  }

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.chatbot.sessions.list(query),
    queryFn: () => fetchChatSessions(query),
    enabled: false,
  })

  return {
    sessions: data?.items ?? [],
    meta: data?.meta ?? null,
    loading: isLoading,
    error: error?.message ?? null,
    filters: {},
    setFilters: () => {},
    resetFilters: () => {},
    setPage,
    hasFilters: false,
  }
}
