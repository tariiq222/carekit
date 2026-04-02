/** CareKit — ChatbotStreamService Unit Tests */

import { Test, TestingModule } from '@nestjs/testing';
import { of, firstValueFrom } from 'rxjs';
import { ChatbotStreamService } from '../../../src/modules/chatbot/chatbot-stream.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { ChatbotConfigService } from '../../../src/modules/chatbot/chatbot-config.service.js';
import { ChatbotContextService } from '../../../src/modules/chatbot/chatbot-context.service.js';
import { ChatbotStreamLoopService } from '../../../src/modules/chatbot/chatbot-stream-loop.service.js';
import type { ChatbotConfigMap } from '../../../src/modules/chatbot/interfaces/chatbot-config.interface.js';

// ── Fixtures ──

const mockConfig: ChatbotConfigMap = {
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
} as ChatbotConfigMap;

const mockSession = {
  id: 'session-1',
  userId: 'user-1',
  language: null,
  endedAt: null,
};

// ── Mock factories ──

function createMockPrisma() {
  return {
    chatSession: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    chatMessage: {
      create: jest.fn(),
      count: jest.fn().mockResolvedValue(5),
    },
  };
}

function createMockConfigService() {
  return {
    getConfigMap: jest.fn().mockResolvedValue(mockConfig),
  };
}

function createMockContextService() {
  return {
    buildAiContext: jest.fn().mockResolvedValue({
      messages: [{ role: 'system', content: 'You are a helpful assistant' }],
      tools: [],
    }),
  };
}

function createMockStreamLoopService() {
  return {
    runStreamLoop: jest.fn().mockResolvedValue(undefined),
  };
}

// ── Test Suite ──

describe('ChatbotStreamService', () => {
  let service: ChatbotStreamService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let configService: ReturnType<typeof createMockConfigService>;
  let contextService: ReturnType<typeof createMockContextService>;
  let streamLoop: ReturnType<typeof createMockStreamLoopService>;

  beforeEach(async () => {
    jest.clearAllMocks();

    prisma = createMockPrisma();
    configService = createMockConfigService();
    contextService = createMockContextService();
    streamLoop = createMockStreamLoopService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatbotStreamService,
        { provide: PrismaService, useValue: prisma },
        { provide: ChatbotConfigService, useValue: configService },
        { provide: ChatbotContextService, useValue: contextService },
        { provide: ChatbotStreamLoopService, useValue: streamLoop },
      ],
    }).compile();

    service = module.get<ChatbotStreamService>(ChatbotStreamService);
  });

  // ────────────────────────────────────────────
  // handleMessageStream — Happy Path
  // ────────────────────────────────────────────

  describe('handleMessageStream', () => {
    const sessionId = 'session-1';
    const userId = 'user-1';
    const content = 'مرحبا، أريد حجز موعد';

    it('should return an Observable that emits SSE events', async () => {
      prisma.chatSession.findFirst.mockResolvedValue(mockSession);

      const observable = service.handleMessageStream(sessionId, userId, content);

      expect(observable).toBeDefined();
      // Observable should be subscribable
      const events: MessageEvent[] = [];
      observable.subscribe({
        next: (event) => events.push(event),
        complete: () => {
          // Stream completed
        },
      });

      // Give async pipeline time to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should have called the pipeline methods
      expect(prisma.chatSession.findFirst).toHaveBeenCalledWith({
        where: { id: sessionId, userId },
      });
    });

    it('should save user message to DB', async () => {
      prisma.chatSession.findFirst.mockResolvedValue(mockSession);

      const observable = service.handleMessageStream(sessionId, userId, content);
      observable.subscribe();

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(prisma.chatMessage.create).toHaveBeenCalledWith({
        data: { sessionId, role: 'user', content },
      });
    });

    it('should detect language and update session when language is null', async () => {
      prisma.chatSession.findFirst.mockResolvedValue({
        ...mockSession,
        language: null,
      });

      const observable = service.handleMessageStream(sessionId, userId, content);
      observable.subscribe();

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Arabic content → should update session language to 'ar'
      expect(prisma.chatSession.update).toHaveBeenCalledWith({
        where: { id: sessionId },
        data: { language: 'ar' },
      });
    });

    it('should not update session language when it is already set', async () => {
      prisma.chatSession.findFirst.mockResolvedValue({
        ...mockSession,
        language: 'ar',
      });

      const observable = service.handleMessageStream(sessionId, userId, content);
      observable.subscribe();

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(prisma.chatSession.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: sessionId },
          data: expect.objectContaining({ language: expect.any(String) }),
        }),
      );
    });

    it('should build AI context and delegate to stream loop', async () => {
      prisma.chatSession.findFirst.mockResolvedValue(mockSession);

      const observable = service.handleMessageStream(sessionId, userId, content);
      observable.subscribe();

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(contextService.buildAiContext).toHaveBeenCalledWith(
        sessionId,
        userId,
        content,
        mockConfig,
      );
      expect(streamLoop.runStreamLoop).toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────────────
  // Validation — Session not found
  // ────────────────────────────────────────────

  describe('handleMessageStream — validation', () => {
    it('should emit error event when session is not found', async () => {
      prisma.chatSession.findFirst.mockResolvedValue(null);

      const events: MessageEvent[] = [];
      const observable = service.handleMessageStream('bad-session', 'user-1', 'Hello');

      await new Promise<void>((resolve) => {
        observable.subscribe({
          next: (event) => events.push(event),
          complete: () => resolve(),
        });
      });

      const errorEvent = events.find((e) => {
        const data = JSON.parse((e as any).data);
        return data.event === 'error';
      });

      expect(errorEvent).toBeDefined();
      const parsed = JSON.parse((errorEvent as any).data);
      expect(parsed.message).toContain('not found');
    });

    it('should emit error event when session has ended', async () => {
      prisma.chatSession.findFirst.mockResolvedValue({
        ...mockSession,
        endedAt: new Date(),
      });

      const events: MessageEvent[] = [];
      const observable = service.handleMessageStream('session-1', 'user-1', 'Hello');

      await new Promise<void>((resolve) => {
        observable.subscribe({
          next: (event) => events.push(event),
          complete: () => resolve(),
        });
      });

      const errorEvent = events.find((e) => {
        const data = JSON.parse((e as any).data);
        return data.event === 'error';
      });

      expect(errorEvent).toBeDefined();
      const parsed = JSON.parse((errorEvent as any).data);
      expect(parsed.message).toContain('ended');
    });

    it('should emit error when max messages reached', async () => {
      prisma.chatSession.findFirst.mockResolvedValue(mockSession);
      prisma.chatMessage.count.mockResolvedValue(999);

      const events: MessageEvent[] = [];
      const observable = service.handleMessageStream('session-1', 'user-1', 'Hello');

      await new Promise<void>((resolve) => {
        observable.subscribe({
          next: (event) => events.push(event),
          complete: () => resolve(),
        });
      });

      const errorEvent = events.find((e) => {
        const data = JSON.parse((e as any).data);
        return data.event === 'error';
      });

      expect(errorEvent).toBeDefined();
      const parsed = JSON.parse((errorEvent as any).data);
      expect(parsed.message).toContain('Maximum');
    });
  });

  // ────────────────────────────────────────────
  // Error handling
  // ────────────────────────────────────────────

  describe('handleMessageStream — error handling', () => {
    it('should emit error event and complete on unexpected error', async () => {
      prisma.chatSession.findFirst.mockRejectedValue(new Error('DB crash'));

      const events: MessageEvent[] = [];
      const observable = service.handleMessageStream('session-1', 'user-1', 'Hi');

      await new Promise<void>((resolve) => {
        observable.subscribe({
          next: (event) => events.push(event),
          complete: () => resolve(),
        });
      });

      const errorEvent = events.find((e) => {
        const data = JSON.parse((e as any).data);
        return data.event === 'error';
      });

      expect(errorEvent).toBeDefined();
      const parsed = JSON.parse((errorEvent as any).data);
      expect(parsed.message).toBe('DB crash');
    });

    it('should handle non-Error thrown values', async () => {
      prisma.chatSession.findFirst.mockRejectedValue('string error');

      const events: MessageEvent[] = [];
      const observable = service.handleMessageStream('session-1', 'user-1', 'Hi');

      await new Promise<void>((resolve) => {
        observable.subscribe({
          next: (event) => events.push(event),
          complete: () => resolve(),
        });
      });

      const errorEvent = events.find((e) => {
        const data = JSON.parse((e as any).data);
        return data.event === 'error';
      });

      expect(errorEvent).toBeDefined();
      const parsed = JSON.parse((errorEvent as any).data);
      expect(parsed.message).toBe('Unknown error');
    });
  });
});
