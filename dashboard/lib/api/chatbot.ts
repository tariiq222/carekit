/**
 * Chatbot API — CareKit Dashboard
 *
 * All chatbot-related API calls mapped to backend endpoints.
 */

export * from "./chatbot-kb"

import { api } from "@/lib/api"
import type { PaginatedResponse } from "@/lib/api"
import type {
  ChatSession,
  ChatSessionDetail,
  ChatSessionListQuery,
  CreateSessionPayload,
  CreateSessionResponse,
  HandleMessageResult,
  ChatbotConfigEntry,
  UpdateChatbotConfigPayload,
  SessionStats,
  TopQuestion,
  AnalyticsQuery,
} from "@/lib/types/chatbot"

/* ═══════════════════════════════════════════════════════════
 *  SESSIONS
 * ═══════════════════════════════════════════════════════════ */

export async function fetchChatSessions(
  query: ChatSessionListQuery = {},
): Promise<PaginatedResponse<ChatSession>> {
  return api.get<PaginatedResponse<ChatSession>>("/chatbot/sessions", {
    page: query.page,
    perPage: query.perPage,
    handedOff:
      query.handedOff !== undefined ? String(query.handedOff) : undefined,
    language: query.language,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    search: query.search,
  })
}

export async function fetchChatSession(
  id: string,
): Promise<ChatSessionDetail> {
  return api.get<ChatSessionDetail>(`/chatbot/sessions/${id}`)
}

export async function createChatSession(
  payload: CreateSessionPayload = {},
): Promise<CreateSessionResponse> {
  return api.post<CreateSessionResponse>("/chatbot/sessions", payload)
}

export async function endChatSession(id: string): Promise<ChatSession> {
  return api.post<ChatSession>(`/chatbot/sessions/${id}/end`)
}

export async function sendChatMessage(
  sessionId: string,
  content: string,
): Promise<HandleMessageResult> {
  return api.post<HandleMessageResult>(
    `/chatbot/sessions/${sessionId}/messages`,
    { content },
  )
}

/* ═══════════════════════════════════════════════════════════
 *  CONFIG
 * ═══════════════════════════════════════════════════════════ */

export async function fetchChatbotConfig(): Promise<ChatbotConfigEntry[]> {
  return api.get<ChatbotConfigEntry[]>("/chatbot/config")
}

export async function fetchChatbotConfigByCategory(
  category: string,
): Promise<ChatbotConfigEntry[]> {
  return api.get<ChatbotConfigEntry[]>(`/chatbot/config/${category}`)
}

export async function updateChatbotConfig(
  payload: UpdateChatbotConfigPayload,
): Promise<ChatbotConfigEntry[]> {
  return api.put<ChatbotConfigEntry[]>("/chatbot/config", payload)
}

export async function seedChatbotDefaults(): Promise<{ seeded: number }> {
  return api.post<{ seeded: number }>("/chatbot/config/seed")
}

/* ═══════════════════════════════════════════════════════════
 *  ANALYTICS
 * ═══════════════════════════════════════════════════════════ */

export async function fetchChatbotAnalytics(
  query: AnalyticsQuery = {},
): Promise<SessionStats> {
  return api.get<SessionStats>("/chatbot/analytics", {
    from: query.from,
    to: query.to,
  })
}

export async function fetchTopQuestions(
  limit?: number,
): Promise<TopQuestion[]> {
  return api.get<TopQuestion[]>("/chatbot/analytics/questions", {
    limit,
  })
}

/** Staff: send message to a handed-off live chat session */
export async function sendStaffMessage(
  sessionId: string,
  content: string,
): Promise<unknown> {
  return api.post<unknown>(
    `/chatbot/sessions/${sessionId}/staff-messages`,
    { content },
  )
}
