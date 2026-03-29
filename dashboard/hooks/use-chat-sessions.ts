"use client"

/**
 * Chat Sessions Hooks — CareKit Dashboard
 *
 * TanStack Query hooks for chatbot session listing and detail.
 */

import { useQuery } from "@tanstack/react-query"
import { useState, useCallback } from "react"
import { queryKeys } from "@/lib/query-keys"
import { fetchChatSessions, fetchChatSession } from "@/lib/api/chatbot"
import type { ChatSessionListQuery, SessionLanguage } from "@/lib/types/chatbot"

interface SessionFilters {
  handedOff: boolean | undefined
  language: SessionLanguage | "all"
  dateFrom: string
  dateTo: string
}

const defaultSessionFilters: SessionFilters = {
  handedOff: undefined,
  language: "all",
  dateFrom: "",
  dateTo: "",
}

export function useChatSessions() {
  const [page, setPage] = useState(1)
  const [filters, setFiltersState] =
    useState<SessionFilters>(defaultSessionFilters)

  const hasFilters =
    filters.handedOff !== undefined ||
    filters.language !== "all" ||
    filters.dateFrom !== "" ||
    filters.dateTo !== ""

  const query: ChatSessionListQuery = {
    page,
    perPage: 20,
    handedOff: filters.handedOff,
    language: filters.language !== "all" ? filters.language : undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
  }

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.chatbot.sessions.list(query),
    queryFn: () => fetchChatSessions(query),
  })

  const setFilters = useCallback((partial: Partial<SessionFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...partial }))
    setPage(1)
  }, [])

  const resetFilters = useCallback(() => {
    setFiltersState(defaultSessionFilters)
    setPage(1)
  }, [])

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

export function useChatSession(id: string) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.chatbot.sessions.detail(id),
    queryFn: () => fetchChatSession(id),
    enabled: !!id,
  })
  return {
    session: data ?? null,
    loading: isLoading,
    error: error?.message ?? null,
    refetch,
  }
}
