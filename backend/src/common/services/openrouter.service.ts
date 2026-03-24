import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OPENROUTER_CHAT_URL,
  OPENROUTER_EMBEDDINGS_URL,
  OPENROUTER_HEADERS,
} from '../../config/constants/api-urls.js';
import { resilientFetch } from '../helpers/resilient-fetch.helper.js';

export interface ChatCompletionOptions {
  model: string;
  messages: Array<{ role: string; content: unknown; tool_calls?: unknown; tool_call_id?: string }>;
  tools?: unknown[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface EmbeddingOptions {
  model: string;
  input: string;
}

@Injectable()
export class OpenRouterService {
  private readonly logger = new Logger(OpenRouterService.name);
  private readonly apiKey: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('OPENROUTER_API_KEY', '');
  }

  /**
   * Makes a chat completion request to OpenRouter.
   * Returns the raw Response for streaming, or parsed JSON for blocking.
   */
  async chatCompletion(options: ChatCompletionOptions): Promise<Response> {
    const body: Record<string, unknown> = {
      model: options.model,
      messages: options.messages,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.max_tokens ?? 1000,
    };

    if (options.tools?.length) {
      body.tools = options.tools;
      body.tool_choice = 'auto';
    }

    if (options.stream) {
      body.stream = true;
    }

    return resilientFetch(OPENROUTER_CHAT_URL, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(body),
    }, { circuit: 'openrouter', timeoutMs: options.stream ? 60_000 : 30_000 });
  }

  /**
   * Generates embeddings via OpenRouter.
   * Returns the embedding vector.
   */
  async generateEmbedding(options: EmbeddingOptions): Promise<number[]> {
    const response = await resilientFetch(OPENROUTER_EMBEDDINGS_URL, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify({
        model: options.model,
        input: options.input,
      }),
    }, { circuit: 'openrouter', timeoutMs: 15_000 });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      this.logger.error(`Embedding API error: ${response.status} — ${errorText}`);
      throw new Error(`OpenRouter embedding failed: ${response.status}`);
    }

    const json = (await response.json()) as {
      data?: Array<{ embedding: number[] }>;
    };

    return json.data?.[0]?.embedding ?? [];
  }

  private buildHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      ...OPENROUTER_HEADERS,
    };
  }
}
