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

export interface StreamChunk {
  type: 'text' | 'tool_calls' | 'done';
  content?: string;
  toolCalls?: ToolCall[];
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

  /**
   * Streaming variant of chatCompletion. Returns an AsyncGenerator
   * that yields text chunks, accumulated tool_calls, and a done signal.
   */
  async *chatCompletionStream(
    messages: OpenRouterMessage[],
    tools: OpenRouterTool[],
    chatConfig: ChatbotConfigMap,
  ): AsyncGenerator<StreamChunk> {
    const apiKey = this.config.get<string>('OPENROUTER_API_KEY');
    const model = chatConfig.ai_model || 'openai/gpt-4o';

    const body: Record<string, unknown> = {
      model,
      messages,
      temperature: chatConfig.ai_temperature ?? 0.3,
      max_tokens: chatConfig.ai_max_tokens ?? 1000,
      stream: true,
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

    if (!response.ok || !response.body) {
      const errorText = response.body ? await response.text() : 'No body';
      this.logger.error(`OpenRouter stream error: ${response.status} — ${errorText}`);
      throw new Error(`AI API error: ${response.status} ${response.statusText}`);
    }

    yield* this.parseSSEStream(response.body);
  }

  /**
   * Parse the SSE byte stream from OpenRouter into typed chunks.
   */
  private async *parseSSEStream(
    body: ReadableStream<Uint8Array>,
  ): AsyncGenerator<StreamChunk> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const accumulatedToolCalls: ToolCall[] = [];

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const chunk = this.parseSingleSSELine(line, accumulatedToolCalls);
          if (chunk) {
            yield chunk;
            if (chunk.type === 'done') return;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Stream ended without [DONE] — flush remaining
    if (accumulatedToolCalls.length > 0) {
      yield { type: 'tool_calls', toolCalls: accumulatedToolCalls };
    }
    yield { type: 'done' };
  }

  /**
   * Parse a single SSE line. Returns a StreamChunk or null if not actionable.
   */
  private parseSingleSSELine(
    line: string,
    accumulatedToolCalls: ToolCall[],
  ): StreamChunk | null {
    if (!line.startsWith('data: ')) return null;
    const data = line.slice(6).trim();

    if (data === '[DONE]') {
      if (accumulatedToolCalls.length > 0) {
        return { type: 'tool_calls', toolCalls: [...accumulatedToolCalls] };
      }
      return { type: 'done' };
    }

    try {
      const parsed = JSON.parse(data) as {
        choices?: { delta?: { content?: string; tool_calls?: StreamDeltaToolCall[] } }[];
      };
      const delta = parsed.choices?.[0]?.delta;
      if (!delta) return null;

      if (delta.content) {
        return { type: 'text', content: delta.content };
      }

      if (delta.tool_calls) {
        this.mergeToolCallDeltas(delta.tool_calls, accumulatedToolCalls);
      }
    } catch {
      // Skip malformed JSON lines
    }

    return null;
  }

  /**
   * Merge incremental tool_call deltas into the accumulated array.
   */
  private mergeToolCallDeltas(
    deltas: StreamDeltaToolCall[],
    accumulated: ToolCall[],
  ): void {
    for (const tc of deltas) {
      const idx = tc.index ?? 0;
      if (!accumulated[idx]) {
        accumulated[idx] = {
          id: tc.id ?? '',
          type: 'function',
          function: { name: '', arguments: '' },
        };
      }
      if (tc.id) accumulated[idx].id = tc.id;
      if (tc.function?.name) accumulated[idx].function.name += tc.function.name;
      if (tc.function?.arguments) {
        accumulated[idx].function.arguments += tc.function.arguments;
      }
    }
  }
}

/** Shape of a streamed tool_call delta from OpenRouter / OpenAI. */
interface StreamDeltaToolCall {
  index?: number;
  id?: string;
  function?: { name?: string; arguments?: string };
}
