export interface ChatbotConfig {
  category: string
  key: string
  value: string
  updatedAt: string
}

export interface ChatbotAnalytics {
  totalSessions: number
  activeSessions: number
  avgMessagesPerSession: number
  satisfactionRate: number
}

export interface ChatbotTopQuestion {
  question: string
  count: number
}

export interface UpdateChatbotConfigPayload {
  configs: Array<{ key: string; value: string }>
}
