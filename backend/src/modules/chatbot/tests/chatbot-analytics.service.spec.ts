/**
 * ChatbotAnalyticsService Unit Tests
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ChatbotAnalyticsService } from '../chatbot-analytics.service.js';
import { PrismaService } from '../../../database/prisma.service.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma: any = {
  chatSession: {
    count: jest.fn(),
    groupBy: jest.fn(),
  },
  chatMessage: {
    count: jest.fn(),
    aggregate: jest.fn(),
    groupBy: jest.fn(),
  },
};

describe('ChatbotAnalyticsService', () => {
  let service: ChatbotAnalyticsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatbotAnalyticsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ChatbotAnalyticsService>(ChatbotAnalyticsService);
    jest.clearAllMocks();

    // Default mocks for all stats calls
    mockPrisma.chatSession.count.mockResolvedValue(0);
    mockPrisma.chatMessage.count.mockResolvedValue(0);
    mockPrisma.chatMessage.aggregate.mockResolvedValue({ _sum: { tokenCount: null } });
    mockPrisma.chatSession.groupBy.mockResolvedValue([]);
    mockPrisma.chatMessage.groupBy.mockResolvedValue([]);
  });

  describe('getSessionStats', () => {
    it('should return zeroed stats when no sessions', async () => {
      const result = await service.getSessionStats();

      expect(result.totalSessions).toBe(0);
      expect(result.avgMessagesPerSession).toBe(0);
      expect(result.handoffRate).toBe(0);
      expect(result.estimatedTokens).toBe(0);
    });

    it('should calculate handoff rate correctly', async () => {
      mockPrisma.chatSession.count
        .mockResolvedValueOnce(10)  // totalSessions
        .mockResolvedValueOnce(4);  // handedOffCount
      mockPrisma.chatMessage.count.mockResolvedValue(50);
      mockPrisma.chatMessage.aggregate.mockResolvedValue({ _sum: { tokenCount: 1000 } });

      const result = await service.getSessionStats();

      expect(result.totalSessions).toBe(10);
      expect(result.handoffRate).toBe(40); // 4/10 * 100
      expect(result.avgMessagesPerSession).toBe(5); // 50/10
      expect(result.estimatedTokens).toBe(1000);
    });

    it('should apply date range filter when provided', async () => {
      const range = { from: '2026-01-01', to: '2026-03-31' };

      await service.getSessionStats(range);

      // chatSession.count should be called with date filter
      expect(mockPrisma.chatSession.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        }),
      );
    });

    it('should not apply date filter when range is undefined', async () => {
      await service.getSessionStats();

      expect(mockPrisma.chatSession.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });

    it('should include language distribution in result', async () => {
      mockPrisma.chatSession.count.mockResolvedValue(5);
      mockPrisma.chatMessage.count.mockResolvedValue(20);
      mockPrisma.chatMessage.aggregate.mockResolvedValue({ _sum: { tokenCount: 500 } });
      mockPrisma.chatSession.groupBy.mockResolvedValue([
        { language: 'ar', _count: { language: 3 } },
        { language: 'en', _count: { language: 2 } },
      ]);

      const result = await service.getSessionStats();

      expect(result.languageDistribution).toEqual({ ar: 3, en: 2 });
    });

    it('should include top intents and tools in result', async () => {
      mockPrisma.chatSession.count.mockResolvedValue(2);
      mockPrisma.chatMessage.count.mockResolvedValue(10);
      mockPrisma.chatMessage.aggregate.mockResolvedValue({ _sum: { tokenCount: 200 } });
      mockPrisma.chatSession.groupBy.mockResolvedValue([]);
      mockPrisma.chatMessage.groupBy
        .mockResolvedValueOnce([
          { intent: 'book_appointment', _count: { intent: 5 } },
        ])
        .mockResolvedValueOnce([
          { toolName: 'getAvailableSlots', _count: { toolName: 3 } },
        ]);

      const result = await service.getSessionStats();

      expect(result.topIntents[0]).toEqual({ intent: 'book_appointment', count: 5 });
      expect(result.topTools[0]).toEqual({ tool: 'getAvailableSlots', count: 3 });
    });
  });

  describe('getMostAskedQuestions', () => {
    it('should return grouped user messages', async () => {
      mockPrisma.chatMessage.groupBy.mockResolvedValue([
        { content: 'How to book?', _count: { content: 10 } },
        { content: 'What are the prices?', _count: { content: 5 } },
      ]);

      const result = await service.getMostAskedQuestions(10);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ content: 'How to book?', count: 10 });
    });

    it('should pass limit as take parameter', async () => {
      mockPrisma.chatMessage.groupBy.mockResolvedValue([]);

      await service.getMostAskedQuestions(5);

      expect(mockPrisma.chatMessage.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 }),
      );
    });
  });
});
