/** CareKit — ChatbotAiService Unit Tests */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ChatbotAiService } from '../../../src/modules/chatbot/chatbot-ai.service.js';
import type { ChatbotConfigMap } from '../../../src/modules/chatbot/interfaces/chatbot-config.interface.js';

// ── Helpers ──

const makeConfig = (overrides?: Partial<ChatbotConfigMap>): ChatbotConfigMap =>
  ({
    bot_name: 'TestBot',
    bot_avatar_url: null,
    tone: 'professional',
    supported_languages: ['ar', 'en'],
    welcome_message_ar: 'مرحبا',
    welcome_message_en: 'Hello',
    custom_instructions: '',
    can_book: true,
    can_reschedule: true,
    can_request_cancel: true,
    can_view_prices: true,
    max_messages_per_session: 50,
    max_tool_calls_per_message: 5,
    restricted_topics: [],
    restricted_topics_response_ar: '',
    restricted_topics_response_en: '',
    require_booking_confirmation: true,
    quick_replies: [],
    handoff_type: 'contact_number',
    handoff_contact_number: '',
    handoff_after_failures: 3,
    handoff_message_ar: '',
    handoff_message_en: '',
    auto_sync_enabled: false,
    auto_sync_interval_hours: 24,
    auto_sync_services: false,
    auto_sync_practitioners: false,
    last_sync_at: null,
    ai_model: 'openai/gpt-4o',
    ai_temperature: 0.3,
    ai_max_tokens: 1000,
    context_window_size: 10,
    ...overrides,
  }) as ChatbotConfigMap;

function mockFetchSuccess(body: unknown, status = 200, ok = true) {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: jest.fn().mockResolvedValue(body),
    text: jest.fn().mockResolvedValue(JSON.stringify(body)),
  };
}

const mockMessages = [{ role: 'user' as const, content: 'Hello' }];
const mockTools: any[] = [];

// ── Test Suite ──

describe('ChatbotAiService', () => {
  let service: ChatbotAiService;
  let configService: ConfigService;
  let fetchSpy: jest.SpyInstance;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatbotAiService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-api-key'),
          },
        },
      ],
    }).compile();

    service = module.get<ChatbotAiService>(ChatbotAiService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    fetchSpy?.mockRestore();
  });

  // ────────────────────────────────────────────
  // chatCompletion
  // ────────────────────────────────────────────

  describe('chatCompletion', () => {
    it('should return content and tokenCount on successful response', async () => {
      const aiResponse = {
        id: 'chatcmpl-123',
        choices: [
          {
            message: { role: 'assistant', content: 'Hello! How can I help?' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
      };

      fetchSpy = jest
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(mockFetchSuccess(aiResponse) as any);

      const config = makeConfig();
      const result = await service.chatCompletion(
        mockMessages,
        mockTools,
        config,
      );

      expect(result.content).toBe('Hello! How can I help?');
      expect(result.toolCalls).toEqual([]);
      expect(result.tokenCount).toBe(30);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      const [url, options] = fetchSpy.mock.calls[0];
      expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
      expect(options.method).toBe('POST');
      expect(options.headers.Authorization).toBe('Bearer test-api-key');
    });

    it('should include tools in the request body when tools are provided', async () => {
      const tools = [
        {
          type: 'function' as const,
          function: {
            name: 'list_services',
            description: 'List available services',
            parameters: { type: 'object', properties: {} },
          },
        },
      ];

      const aiResponse = {
        id: 'chatcmpl-456',
        choices: [
          {
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call_1',
                  type: 'function',
                  function: { name: 'list_services', arguments: '{}' },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
        usage: { prompt_tokens: 30, completion_tokens: 15, total_tokens: 45 },
      };

      fetchSpy = jest
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(mockFetchSuccess(aiResponse) as any);

      const config = makeConfig();
      const result = await service.chatCompletion(mockMessages, tools, config);

      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0].function.name).toBe('list_services');

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.tools).toEqual(tools);
      expect(body.tool_choice).toBe('auto');
    });

    it('should use custom model and temperature from config', async () => {
      const aiResponse = {
        id: 'chatcmpl-789',
        choices: [
          {
            message: { role: 'assistant', content: 'Hi' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 },
      };

      fetchSpy = jest
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(mockFetchSuccess(aiResponse) as any);

      const config = makeConfig({
        ai_model: 'anthropic/claude-3',
        ai_temperature: 0.7,
        ai_max_tokens: 2000,
      });

      await service.chatCompletion(mockMessages, mockTools, config);

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.model).toBe('anthropic/claude-3');
      expect(body.temperature).toBe(0.7);
      expect(body.max_tokens).toBe(2000);
    });

    it('should throw error when API returns non-OK status', async () => {
      fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        text: jest.fn().mockResolvedValue('Rate limited'),
        json: jest.fn(),
      } as any);

      const config = makeConfig();

      await expect(
        service.chatCompletion(mockMessages, mockTools, config),
      ).rejects.toThrow('AI API error: 429 Too Many Requests');
    });

    it('should throw error when API returns 500', async () => {
      fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: jest.fn().mockResolvedValue('Server error'),
        json: jest.fn(),
      } as any);

      const config = makeConfig();

      await expect(
        service.chatCompletion(mockMessages, mockTools, config),
      ).rejects.toThrow('AI API error: 500 Internal Server Error');
    });

    it('should default model to openai/gpt-4o when ai_model is empty', async () => {
      const aiResponse = {
        id: 'chatcmpl-1',
        choices: [
          {
            message: { role: 'assistant', content: 'OK' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      };

      fetchSpy = jest
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(mockFetchSuccess(aiResponse) as any);

      const config = makeConfig({ ai_model: '' });
      await service.chatCompletion(mockMessages, mockTools, config);

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.model).toBe('openai/gpt-4o');
    });

    it('should handle null content in response', async () => {
      const aiResponse = {
        id: 'chatcmpl-null',
        choices: [
          {
            message: { role: 'assistant', content: null },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 5, completion_tokens: 0, total_tokens: 5 },
      };

      fetchSpy = jest
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(mockFetchSuccess(aiResponse) as any);

      const config = makeConfig();
      const result = await service.chatCompletion(
        mockMessages,
        mockTools,
        config,
      );

      expect(result.content).toBeNull();
      expect(result.tokenCount).toBe(5);
    });

    it('should handle missing usage gracefully (tokenCount = 0)', async () => {
      const aiResponse = {
        id: 'chatcmpl-nousage',
        choices: [
          {
            message: { role: 'assistant', content: 'Hey' },
            finish_reason: 'stop',
          },
        ],
        // no usage field
      };

      fetchSpy = jest
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(mockFetchSuccess(aiResponse) as any);

      const config = makeConfig();
      const result = await service.chatCompletion(
        mockMessages,
        mockTools,
        config,
      );

      expect(result.tokenCount).toBe(0);
    });
  });

  // ────────────────────────────────────────────
  // chatCompletionStream
  // ────────────────────────────────────────────

  describe('chatCompletionStream', () => {
    it('should yield text chunks and done signal for a simple stream', async () => {
      const sseLines = [
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n',
        'data: {"choices":[{"delta":{"content":" world"}}]}\n',
        'data: [DONE]\n',
      ];

      const mockBody = createMockReadableStream(sseLines);

      fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        body: mockBody,
        text: jest.fn().mockResolvedValue(''),
      } as any);

      const config = makeConfig();
      const chunks: any[] = [];

      for await (const chunk of service.chatCompletionStream(
        mockMessages,
        mockTools,
        config,
      )) {
        chunks.push(chunk);
      }

      const textChunks = chunks.filter((c) => c.type === 'text');
      const doneChunks = chunks.filter((c) => c.type === 'done');

      expect(textChunks.map((c) => c.content).join('')).toBe('Hello world');
      expect(doneChunks.length).toBeGreaterThanOrEqual(1);
    });

    it('should accumulate tool_calls from streaming deltas', async () => {
      const sseLines = [
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"list_ser","arguments":""}}]}}]}\n',
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"name":"vices","arguments":"{}"}}]}}]}\n',
        'data: [DONE]\n',
      ];

      const mockBody = createMockReadableStream(sseLines);

      fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        body: mockBody,
        text: jest.fn().mockResolvedValue(''),
      } as any);

      const config = makeConfig();
      const chunks: any[] = [];

      for await (const chunk of service.chatCompletionStream(
        mockMessages,
        mockTools,
        config,
      )) {
        chunks.push(chunk);
      }

      const toolCallChunks = chunks.filter((c) => c.type === 'tool_calls');
      expect(toolCallChunks.length).toBeGreaterThanOrEqual(1);

      const tc = toolCallChunks[0].toolCalls[0];
      expect(tc.id).toBe('call_1');
      expect(tc.function.name).toBe('list_services');
      expect(tc.function.arguments).toBe('{}');
    });

    it('should throw when stream response is not OK', async () => {
      fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        body: null,
        text: jest.fn().mockResolvedValue('Unavailable'),
      } as any);

      const config = makeConfig();

      const gen = service.chatCompletionStream(mockMessages, mockTools, config);

      await expect(gen.next()).rejects.toThrow(
        'AI API error: 503 Service Unavailable',
      );
    });

    it('should set stream: true in the request body', async () => {
      const mockBody = createMockReadableStream(['data: [DONE]\n']);

      fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        body: mockBody,
        text: jest.fn().mockResolvedValue(''),
      } as any);

      const config = makeConfig();

      // Drain the generator
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of service.chatCompletionStream(
        mockMessages,
        mockTools,
        config,
      )) {
        // drain
      }

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.stream).toBe(true);
    });

    it('should handle stream ending without [DONE] by emitting done', async () => {
      // Stream with text but no [DONE] marker
      const sseLines = [
        'data: {"choices":[{"delta":{"content":"Partial"}}]}\n',
      ];

      const mockBody = createMockReadableStream(sseLines);

      fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        body: mockBody,
        text: jest.fn().mockResolvedValue(''),
      } as any);

      const config = makeConfig();
      const chunks: any[] = [];

      for await (const chunk of service.chatCompletionStream(
        mockMessages,
        mockTools,
        config,
      )) {
        chunks.push(chunk);
      }

      const doneChunks = chunks.filter((c) => c.type === 'done');
      expect(doneChunks.length).toBe(1);
    });

    it('should skip malformed JSON lines gracefully', async () => {
      const sseLines = [
        'data: {"choices":[{"delta":{"content":"Good"}}]}\n',
        'data: not-json\n',
        'data: {"choices":[{"delta":{"content":" data"}}]}\n',
        'data: [DONE]\n',
      ];

      const mockBody = createMockReadableStream(sseLines);

      fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        body: mockBody,
        text: jest.fn().mockResolvedValue(''),
      } as any);

      const config = makeConfig();
      const chunks: any[] = [];

      for await (const chunk of service.chatCompletionStream(
        mockMessages,
        mockTools,
        config,
      )) {
        chunks.push(chunk);
      }

      const textChunks = chunks.filter((c) => c.type === 'text');
      expect(textChunks.map((c) => c.content).join('')).toBe('Good data');
    });
  });
});

// ── Mock ReadableStream helper ──

function createMockReadableStream(lines: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const fullText = lines.join('\n');
  const data = encoder.encode(fullText);

  let offset = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset < data.length) {
        controller.enqueue(data.slice(offset));
        offset = data.length;
      } else {
        controller.close();
      }
    },
  });
}
