export interface ChatCompletionDto {
  tenantId: string;
  userMessage: string;
  sessionId?: string;
  clientId?: string;
  userId?: string;
}

export interface ChatCompletionResult {
  sessionId: string;
  reply: string;
  sourcesUsed: number;
}
