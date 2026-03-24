/** CareKit — ChatbotService (Orchestrator) Unit Tests */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ChatbotService } from '../chatbot.service.js';
import { ChatbotAiService } from '../chatbot-ai.service.js';
import { ChatbotToolsService } from '../chatbot-tools.service.js';
import { ChatbotConfigService } from '../chatbot-config.service.js';
import { PrismaService } from '../../../database/prisma.service.js';

const defaultConfig = {
  bot_name: 'TestBot',
  bot_avatar_url: null,
  tone: 'professional',
  welcome_message_ar: 'مرحباً!',
  welcome_message_en: 'Hello!',
  quick_replies: [{ label_ar: 'حجز', label_en: 'Book', action: 'book' }],
  can_book: true,
  can_reschedule: true,
  can_request_cancel: true,
  can_view_prices: true,
  max_messages_per_session: 50,
  max_tool_calls_per_message: 5,
  context_window_size: 20,
  restricted_topics: [],
  restricted_topics_response_ar: '',
  restricted_topics_response_en: '',
  require_booking_confirmation: true,
  custom_instructions: '',
  supported_languages: ['ar', 'en'],
  ai_model: 'openai/gpt-4o',
  ai_temperature: 0.3,
  ai_max_tokens: 1000,
};

const mockPrisma: any = {
  chatSession: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  chatMessage: {
    create: jest.fn(),
    count: jest.fn(),
    findMany: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  whiteLabelConfig: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
};

const mockAiService: any = {
  chatCompletion: jest.fn(),
};

const mockToolsService: any = {
  execute: jest.fn(),
};

const mockConfigService: any = {
  getConfigMap: jest.fn().mockResolvedValue(defaultConfig),
};

describe('ChatbotService', () => {
  let service: ChatbotService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatbotService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ChatbotAiService, useValue: mockAiService },
        { provide: ChatbotToolsService, useValue: mockToolsService },
        { provide: ChatbotConfigService, useValue: mockConfigService },
      ],
    }).compile();
    service = module.get<ChatbotService>(ChatbotService);
  });

  describe('createSession', () => {
    it('creates session and sends welcome message in Arabic', async () => {
      const mockSession = { id: 'session-1', userId: 'user-1' };
      mockPrisma.chatSession.create.mockResolvedValue(mockSession);
      mockPrisma.chatMessage.create.mockResolvedValue({});

      const result = await service.createSession('user-1', 'ar');

      expect(result.session).toEqual(mockSession);
      expect(result.welcomeMessage).toBe('مرحباً!');
      expect(result.quickReplies).toHaveLength(1);
      expect(result.botConfig.bot_name).toBe('TestBot');
      expect(mockPrisma.chatMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sessionId: 'session-1',
            role: 'assistant',
            intent: 'greeting',
          }),
        }),
      );
    });

    it('sends welcome in English when language is en', async () => {
      mockPrisma.chatSession.create.mockResolvedValue({ id: 's-2' });
      mockPrisma.chatMessage.create.mockResolvedValue({});

      const result = await service.createSession('user-1', 'en');
      expect(result.welcomeMessage).toBe('Hello!');
    });
  });

  describe('handleMessage', () => {
    const sessionId = 'session-1';
    const userId = 'user-1';

    beforeEach(() => {
      mockPrisma.chatSession.findFirst.mockResolvedValue({
        id: sessionId,
        userId,
        language: 'en',
        endedAt: null,
      });
      mockPrisma.chatMessage.count.mockResolvedValue(5);
      mockPrisma.chatMessage.create.mockResolvedValue({});
      mockPrisma.chatMessage.findMany.mockResolvedValue([]);
      mockPrisma.chatSession.update.mockResolvedValue({});
      mockPrisma.user.findUnique.mockResolvedValue({ firstName: 'Test', lastName: 'User' });
    });

    it('returns AI text response when no tool calls', async () => {
      mockAiService.chatCompletion.mockResolvedValue({
        content: 'Hello! How can I help?',
        toolCalls: [],
        tokenCount: 100,
      });

      const result = await service.handleMessage(sessionId, userId, 'Hi');

      expect(result.message).toBe('Hello! How can I help?');
      expect(result.intent).toBe('query');
      // User message saved
      expect(mockPrisma.chatMessage.create).toHaveBeenCalledTimes(2); // user + assistant
    });

    it('executes tool calls and returns final response', async () => {
      // First call: AI returns a tool call
      mockAiService.chatCompletion
        .mockResolvedValueOnce({
          content: null,
          toolCalls: [{
            id: 'tc-1',
            type: 'function',
            function: { name: 'list_services', arguments: '{}' },
          }],
          tokenCount: 50,
        })
        // Second call: AI returns text after tool result
        .mockResolvedValueOnce({
          content: 'Here are our services: ...',
          toolCalls: [],
          tokenCount: 80,
        });

      mockToolsService.execute.mockResolvedValue({
        success: true,
        data: [{ nameEn: 'Checkup' }],
      });

      const result = await service.handleMessage(sessionId, userId, 'What services do you have?');

      expect(result.message).toBe('Here are our services: ...');
      expect(result.toolName).toBe('list_services');
      expect(result.actionCard).toBeDefined();
      expect(result.actionCard?.type).toBe('services_list');
    });

    it('throws NotFoundException when session not found', async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue(null);

      await expect(
        service.handleMessage('nonexistent', userId, 'Hi'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when session has ended', async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue({
        id: sessionId,
        userId,
        endedAt: new Date(),
      });

      await expect(
        service.handleMessage(sessionId, userId, 'Hi'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when max messages reached', async () => {
      mockPrisma.chatMessage.count.mockResolvedValue(50);

      await expect(
        service.handleMessage(sessionId, userId, 'Hi'),
      ).rejects.toThrow(BadRequestException);
    });

    it('detects Arabic language from first message', async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue({
        id: sessionId,
        userId,
        language: null, // not set yet
        endedAt: null,
      });
      mockAiService.chatCompletion.mockResolvedValue({
        content: 'مرحباً!',
        toolCalls: [],
        tokenCount: 50,
      });

      await service.handleMessage(sessionId, userId, 'مرحبا أبي أحجز');

      expect(mockPrisma.chatSession.update).toHaveBeenCalledWith({
        where: { id: sessionId },
        data: { language: 'ar' },
      });
    });
  });

  describe('endSession', () => {
    it('sets endedAt on the session', async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue({ id: 'session-1', userId: 'user-1' });
      mockPrisma.chatSession.update.mockResolvedValue({ id: 'session-1', endedAt: new Date() });

      const result = await service.endSession('session-1', 'user-1');
      expect(result.endedAt).toBeDefined();
    });

    it('throws NotFoundException for invalid session', async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue(null);

      await expect(
        service.endSession('nonexistent', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listSessions', () => {
    it('returns paginated sessions with user info', async () => {
      const mockSessions = [
        { id: 's-1', user: { firstName: 'Test', lastName: 'User' }, _count: { messages: 5 } },
      ];
      mockPrisma.chatSession.findMany.mockResolvedValue(mockSessions);
      mockPrisma.chatSession.count.mockResolvedValue(1);

      const result = await service.listSessions({ page: 1, perPage: 20 });
      expect(result.items).toEqual(mockSessions);
      expect(result.meta.total).toBe(1);
    });

    it('filters by userId when provided', async () => {
      mockPrisma.chatSession.findMany.mockResolvedValue([]);
      mockPrisma.chatSession.count.mockResolvedValue(0);

      await service.listSessions({ userId: 'user-1' });
      expect(mockPrisma.chatSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'user-1' }),
        }),
      );
    });
  });
});
