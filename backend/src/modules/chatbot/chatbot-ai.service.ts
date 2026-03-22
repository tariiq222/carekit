import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ChatbotConfigMap } from './interfaces/chatbot-config.interface.js';
import type {
  OpenRouterMessage,
  OpenRouterResponse,
  OpenRouterTool,
  ToolCall,
} from './interfaces/chatbot-tool.interface.js';

interface CompletionResult {
  content: string | null;
  toolCalls: ToolCall[];
  tokenCount: number;
}

@Injectable()
export class ChatbotAiService {
  private readonly logger = new Logger(ChatbotAiService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Call OpenRouter chat completion with function calling support.
   * Returns either text content or tool_calls (or both).
   */
  async chatCompletion(
    messages: OpenRouterMessage[],
    tools: OpenRouterTool[],
    chatConfig: ChatbotConfigMap,
  ): Promise<CompletionResult> {
    const apiKey = this.config.get<string>('OPENROUTER_API_KEY');
    const model = chatConfig.ai_model || 'openai/gpt-4o';

    const body: Record<string, unknown> = {
      model,
      messages,
      temperature: chatConfig.ai_temperature ?? 0.3,
      max_tokens: chatConfig.ai_max_tokens ?? 1000,
    };

    if (tools.length > 0) {
      body.tools = tools;
      body.tool_choice = 'auto';
    }

    const response = await fetch(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'carekit',
          'X-Title': 'CareKit',
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`OpenRouter error: ${response.status} — ${errorText}`);
      throw new Error(`AI API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as OpenRouterResponse;
    const choice = data.choices[0];

    const tokenCount =
      (data.usage?.prompt_tokens ?? 0) + (data.usage?.completion_tokens ?? 0);

    return {
      content: choice.message.content,
      toolCalls: choice.message.tool_calls ?? [],
      tokenCount,
    };
  }
}
