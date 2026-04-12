"use client"

import type { KnowledgeBaseEntry, KnowledgeBaseFile, ChatbotConfigEntry } from "@/lib/types/chatbot"

// Stubs — TODO: no backend KB/config endpoints yet

export function useKnowledgeBase() {
  return {
    entries: [] as KnowledgeBaseEntry[],
    meta: null as null,
    loading: false,
    error: null as string | null,
    filters: {} as Record<string, unknown>,
    setFilters: (_f: Record<string, unknown>) => {},
    resetFilters: () => {},
    setPage: (_p: number) => {},
    hasFilters: false,
  }
}

export function useKnowledgeFiles() {
  return {
    files: [] as KnowledgeBaseFile[],
    meta: null as null,
    loading: false,
    error: null as string | null,
    setPage: (_p: number) => {},
  }
}

export function useChatbotConfig(_category?: string) {
  return { config: [] as ChatbotConfigEntry[], loading: false, error: null as string | null }
}
