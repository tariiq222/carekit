export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface ToolExecutionContext {
  userId: string;
  sessionId: string;
}

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface OpenRouterTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface OpenRouterChoice {
  message: {
    role: string;
    content: string | null;
    tool_calls?: ToolCall[];
  };
  finish_reason: string;
}

export interface OpenRouterResponse {
  id: string;
  choices: OpenRouterChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ChatbotResponse {
  message: string;
  intent?: string;
  toolName?: string;
  actionCard?: ActionCard;
  tokenCount?: number;
}

export interface ActionCard {
  type:
    | 'booking_created'
    | 'bookings_list'
    | 'services_list'
    | 'practitioners_list'
    | 'slots_list'
    | 'cancellation_requested'
    | 'handoff';
  payload: unknown;
}
