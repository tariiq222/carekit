"use client"

/**
 * Chatbot Config & Knowledge Base Hooks — CareKit Dashboard
 *
 * TanStack Query hooks for chatbot configuration,
 * knowledge base entries, and knowledge base files.
 */

import { useQuery } from "@tanstack/react-query"
import { useState, useCallback } from "react"
import { queryKeys } from "@/lib/query-keys"
import {
  fetchKnowledgeBase,
  fetchKnowledgeFiles,
  fetchChatbotConfig,
  fetchChatbotConfigByCategory,
} from "@/lib/api/chatbot"
import type { KnowledgeBaseQuery, KbSource } from "@/lib/types/chatbot"

interface KbFilters {
  source: KbSource | "all"
  category: string
}

const defaultKbFilters: KbFilters = { source: "all", category: "" }

export function useKnowledgeBase() {
  const [page, setPage] = useState(1)
  const [filters, setFiltersState] = useState<KbFilters>(defaultKbFilters)

  const hasFilters = filters.source !== "all" || filters.category !== ""

  const query: KnowledgeBaseQuery = {
    page,
    perPage: 20,
    source: filters.source !== "all" ? filters.source : undefined,
    category: filters.category || undefined,
  }

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.chatbot.knowledgeBase.list(query),
    queryFn: () => fetchKnowledgeBase(query),
  })

  const setFilters = useCallback((partial: Partial<KbFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...partial }))
    setPage(1)
  }, [])

  const resetFilters = useCallback(() => {
    setFiltersState(defaultKbFilters)
    setPage(1)
  }, [])

  return {
    entries: data?.items ?? [],
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

export function useKnowledgeFiles() {
  const [page, setPage] = useState(1)
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.chatbot.files.list({ page }),
    queryFn: () => fetchKnowledgeFiles({ page, perPage: 20 }),
  })
  return {
    files: data?.items ?? [],
    meta: data?.meta ?? null,
    loading: isLoading,
    error: error?.message ?? null,
    setPage,
  }
}

export function useChatbotConfig(category?: string) {
  const { data, isLoading, error } = useQuery({
    queryKey: category
      ? queryKeys.chatbot.config.byCategory(category)
      : queryKeys.chatbot.config.all,
    queryFn: () =>
      category ? fetchChatbotConfigByCategory(category) : fetchChatbotConfig(),
  })
  return {
    config: Array.isArray(data) ? data : [],
    loading: isLoading,
    error: error?.message ?? null,
  }
}
