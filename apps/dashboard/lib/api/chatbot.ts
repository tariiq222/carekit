/**
 * Chatbot API — CareKit Dashboard
 * Controller: dashboard/comms/chat
 */

import { api } from "@/lib/api"
import type { PaginatedResponse } from "@/lib/types/common"
import type { ChatSession, ChatSessionDetail, ChatSessionListQuery } from "@/lib/types/chatbot"

export async function fetchChatSession(id: string): Promise<ChatSessionDetail> {
  return api.get<ChatSessionDetail>(`/dashboard/comms/chat/conversations/${id}`)
}

export async function endChatSession(id: string): Promise<unknown> {
  return api.patch<unknown>(`/dashboard/comms/chat/conversations/${id}/close`)
}

export async function sendStaffMessage(id: string, body: string): Promise<unknown> {
  return api.post<unknown>(`/dashboard/comms/chat/conversations/${id}/messages`, { body })
}

export async function fetchChatSessions(
  query: ChatSessionListQuery = {},
): Promise<PaginatedResponse<ChatSession>> {
  return api.get<PaginatedResponse<ChatSession>>(
    "/dashboard/comms/chat/conversations",
    {
      page: query.page,
      perPage: query.perPage,
      handedOff:
        query.handedOff !== undefined ? String(query.handedOff) : undefined,
      language: query.language,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      search: query.search,
    },
  )
}
