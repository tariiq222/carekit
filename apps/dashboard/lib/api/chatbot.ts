/**
 * Chatbot API — CareKit Dashboard
 * Controller: dashboard/comms/chat
 */

import { api } from "@/lib/api"
import type { PaginatedResponse } from "@/lib/types/common"
import type { ChatSession, ChatSessionListQuery } from "@/lib/types/chatbot"

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
