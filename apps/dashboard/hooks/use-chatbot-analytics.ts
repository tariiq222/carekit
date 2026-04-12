"use client"

import type { SessionStats, TopQuestion } from "@/lib/types/chatbot"

// Stubs — TODO: no backend analytics endpoints yet

export function useChatbotAnalytics(_query = {}) {
  return {
    stats: null as SessionStats | null,
    loading: false,
    error: null as string | null,
  }
}

export function useTopQuestions(_limit?: number) {
  return {
    questions: [] as TopQuestion[],
    loading: false,
    error: null as string | null,
  }
}
