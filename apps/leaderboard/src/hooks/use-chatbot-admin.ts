import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { chatbotAdminApi } from '@carekit/api-client'
import type { UpdateChatbotConfigPayload } from '@carekit/api-client'
import { QUERY_KEYS } from '@/lib/query-keys'

export function useChatbotConfig() {
  return useQuery({
    queryKey: QUERY_KEYS.chatbot.config,
    queryFn: () => chatbotAdminApi.getConfig(),
  })
}

export function useChatbotAnalytics() {
  return useQuery({
    queryKey: QUERY_KEYS.chatbot.analytics,
    queryFn: () => chatbotAdminApi.analytics(),
  })
}

export function useChatbotTopQuestions() {
  return useQuery({
    queryKey: QUERY_KEYS.chatbot.topQuestions,
    queryFn: () => chatbotAdminApi.topQuestions(),
  })
}

export function useUpdateChatbotConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: UpdateChatbotConfigPayload) => chatbotAdminApi.updateConfig(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.chatbot.config }),
  })
}
