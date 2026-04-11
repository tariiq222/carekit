import { apiRequest } from '../client.js'
import type {
  ChatbotConfig,
  ChatbotAnalytics,
  ChatbotTopQuestion,
  UpdateChatbotConfigPayload,
} from '../types/chatbot-admin.js'

export async function getConfig(): Promise<ChatbotConfig[]> {
  return apiRequest<ChatbotConfig[]>('/chatbot/admin/config')
}

export async function updateConfig(payload: UpdateChatbotConfigPayload): Promise<ChatbotConfig[]> {
  return apiRequest<ChatbotConfig[]>('/chatbot/admin/config', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function seedConfig(): Promise<void> {
  return apiRequest<void>('/chatbot/admin/config/seed', { method: 'POST' })
}

export async function analytics(): Promise<ChatbotAnalytics> {
  return apiRequest<ChatbotAnalytics>('/chatbot/admin/analytics')
}

export async function topQuestions(): Promise<ChatbotTopQuestion[]> {
  return apiRequest<ChatbotTopQuestion[]>('/chatbot/admin/analytics/questions')
}
