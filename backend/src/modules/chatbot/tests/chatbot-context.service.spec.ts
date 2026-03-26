/**
 * ChatbotContextService Unit Tests
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ChatbotContextService } from '../chatbot-context.service.js';
import { PrismaService } from '../../../database/prisma.service.js';
import { ChatbotConfigService } from '../chatbot-config.service.js';

const sessionId = 'session-uuid-1';
const userId = 'user-uuid-1';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockConfig: any = {
  enabled: true,
  context_window_size: 10,
  bot_name: 'CareBot',
  tone: 'professional',
  supported_languages: ['ar', 'en'],
  can_book: true,
  can_reschedule: false,
  can_request_cancel: false,
  can_view_prices: true,
  restricted_topics: [],
  restricted_topics_response_ar: '',
  restricted_topics_response_en: '',
  max_messages_per_session: 20,
  require_booking_confirmation: false,
  custom_instructions: null,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma: any = {
  user: {
    findUnique: jest.fn().mockResolvedValue({ firstName: 'Ahmad', lastName: 'Al-Rashid' }),
  },
  whiteLabelConfig: {
    findFirst: jest.fn().mockResolvedValue({ key: 'clinic_name', value: 'CareKit Clinic' }),
  },
  chatMessage: {
    findMany: jest.fn().mockResolvedValue([]),
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockConfigService: any = {
  getConfig: jest.fn().mockResolvedValue(mockConfig),
};

describe('ChatbotContextService', () => {
  let service: ChatbotContextService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatbotContextService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ChatbotConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<ChatbotContextService>(ChatbotContextService);
    jest.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue({ firstName: 'Ahmad', lastName: 'Al-Rashid' });
    mockPrisma.whiteLabelConfig.findFirst.mockResolvedValue({ key: 'clinic_name', value: 'CareKit Clinic' });
    mockPrisma.chatMessage.findMany.mockResolvedValue([]);
  });

  describe('buildAiContext', () => {
    it('should return messages array with system, user content', async () => {
      const result = await service.buildAiContext(sessionId, userId, 'Hello', mockConfig as Parameters<typeof service.buildAiContext>[3]);

      expect(result.messages).toBeDefined();
      expect(result.tools).toBeDefined();
      expect(result.messages[0].role).toBe('system');
      expect(result.messages[result.messages.length - 1]).toEqual(
        expect.objectContaining({ role: 'user', content: 'Hello' }),
      );
    });

    it('should use "Patient" when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await service.buildAiContext(sessionId, userId, 'Hi', mockConfig as Parameters<typeof service.buildAiContext>[3]);

      expect(result.messages[0].content).toContain('Patient');
    });

    it('should use default clinic name when config not found', async () => {
      mockPrisma.whiteLabelConfig.findFirst.mockResolvedValue(null);

      const result = await service.buildAiContext(sessionId, userId, 'Hi', mockConfig as Parameters<typeof service.buildAiContext>[3]);

      expect(result.messages[0].content).toContain('CareKit Clinic');
    });

    it('should include history messages between system and user', async () => {
      mockPrisma.chatMessage.findMany.mockResolvedValue([
        { id: 'm-1', sessionId, role: 'user', content: 'Previous message', functionCall: null, createdAt: new Date() },
        { id: 'm-2', sessionId, role: 'assistant', content: 'Previous response', functionCall: null, createdAt: new Date() },
      ]);

      const result = await service.buildAiContext(sessionId, userId, 'New message', mockConfig as Parameters<typeof service.buildAiContext>[3]);

      // system + 2 history + user
      expect(result.messages.length).toBe(4);
    });
  });

  describe('loadHistory', () => {
    it('should return empty array when no messages', async () => {
      mockPrisma.chatMessage.findMany.mockResolvedValue([]);

      const result = await service.loadHistory(sessionId, 10);

      expect(result).toEqual([]);
    });

    it('should return user and assistant messages in order', async () => {
      mockPrisma.chatMessage.findMany.mockResolvedValue([
        { id: 'm-2', role: 'assistant', content: 'Response', functionCall: null },
        { id: 'm-1', role: 'user', content: 'Question', functionCall: null },
      ]);

      const result = await service.loadHistory(sessionId, 10);

      // reversed() means m-1 first, m-2 second
      expect(result[0].role).toBe('user');
      expect(result[1].role).toBe('assistant');
    });

    it('should handle tool messages with tool_call_id', async () => {
      mockPrisma.chatMessage.findMany.mockResolvedValue([
        {
          id: 'm-1',
          role: 'tool',
          content: '{"result": "ok"}',
          functionCall: { tool_call_id: 'call-123' },
        },
      ]);

      const result = await service.loadHistory(sessionId, 10);

      expect(result[0].role).toBe('tool');
      expect((result[0] as { tool_call_id: string }).tool_call_id).toBe('call-123');
    });

    it('should pass windowSize as take limit', async () => {
      mockPrisma.chatMessage.findMany.mockResolvedValue([]);

      await service.loadHistory(sessionId, 5);

      expect(mockPrisma.chatMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 }),
      );
    });
  });
});
