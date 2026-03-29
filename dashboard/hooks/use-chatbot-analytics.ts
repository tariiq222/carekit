"use client"

/**
 * Chatbot Analytics Hooks — CareKit Dashboard
 *
 * TanStack Query hooks for chatbot analytics and top questions.
 */

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { fetchChatbotAnalytics, fetchTopQuestions } from "@/lib/api/chatbot"
import type { AnalyticsQuery } from "@/lib/types/chatbot"

export function useChatbotAnalytics(query: AnalyticsQuery = {}) {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.chatbot.analytics.all(query),
    queryFn: () => fetchChatbotAnalytics(query),
  })
  return {
    stats: data ?? null,
    loading: isLoading,
    error: error?.message ?? null,
  }
}

export function useTopQuestions(limit?: number) {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.chatbot.analytics.questions(limit),
    queryFn: () => fetchTopQuestions(limit),
  })
  return {
    questions: Array.isArray(data) ? data : [],
    loading: isLoading,
    error: error?.message ?? null,
  }
}
