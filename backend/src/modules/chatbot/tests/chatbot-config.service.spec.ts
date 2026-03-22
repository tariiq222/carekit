/** CareKit — ChatbotConfigService Unit Tests */

import { Test, TestingModule } from '@nestjs/testing';
import { ChatbotConfigService } from '../chatbot-config.service.js';
import { PrismaService } from '../../../database/prisma.service.js';
import { CHATBOT_CONFIG_DEFAULTS } from '../constants/config-defaults.js';

const mockPrisma: any = {
  chatbotConfig: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    upsert: jest.fn(),
    create: jest.fn(),
  },
};

describe('ChatbotConfigService', () => {
  let service: ChatbotConfigService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatbotConfigService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<ChatbotConfigService>(ChatbotConfigService);
  });

  describe('getAll', () => {
    it('returns all configs ordered by key', async () => {
      const mockConfigs = [
        { key: 'bot_name', value: 'TestBot', category: 'personality' },
      ];
      mockPrisma.chatbotConfig.findMany.mockResolvedValue(mockConfigs);

      const result = await service.getAll();
      expect(result).toEqual(mockConfigs);
      expect(mockPrisma.chatbotConfig.findMany).toHaveBeenCalledWith({
        orderBy: { key: 'asc' },
      });
    });
  });

  describe('getByCategory', () => {
    it('filters configs by category', async () => {
      mockPrisma.chatbotConfig.findMany.mockResolvedValue([]);

      await service.getByCategory('personality');
      expect(mockPrisma.chatbotConfig.findMany).toHaveBeenCalledWith({
        where: { category: 'personality' },
        orderBy: { key: 'asc' },
      });
    });
  });

  describe('getConfigMap', () => {
    it('returns defaults when no DB entries exist', async () => {
      mockPrisma.chatbotConfig.findMany.mockResolvedValue([]);

      const result = await service.getConfigMap();
      expect(result.bot_name).toBe('CareKit Assistant');
      expect(result.can_book).toBe(true);
      expect(result.ai_model).toBe('openai/gpt-4o');
      expect(result.max_messages_per_session).toBe(50);
    });

    it('overrides defaults with DB values', async () => {
      mockPrisma.chatbotConfig.findMany.mockResolvedValue([
        { key: 'bot_name', value: 'MyClinicBot' },
        { key: 'can_book', value: false },
      ]);

      const result = await service.getConfigMap();
      expect(result.bot_name).toBe('MyClinicBot');
      expect(result.can_book).toBe(false);
      // Non-overridden defaults still present
      expect(result.ai_model).toBe('openai/gpt-4o');
    });
  });

  describe('upsert', () => {
    it('calls prisma upsert with correct params', async () => {
      mockPrisma.chatbotConfig.upsert.mockResolvedValue({
        key: 'bot_name',
        value: 'NewBot',
        category: 'personality',
      });

      await service.upsert('bot_name', 'NewBot', 'personality');
      expect(mockPrisma.chatbotConfig.upsert).toHaveBeenCalledWith({
        where: { key: 'bot_name' },
        create: { key: 'bot_name', value: 'NewBot', category: 'personality' },
        update: { value: 'NewBot', category: 'personality' },
      });
    });
  });

  describe('seedDefaults', () => {
    it('only creates keys that do not exist', async () => {
      // First key exists, rest don't
      mockPrisma.chatbotConfig.findUnique
        .mockResolvedValueOnce({ key: 'bot_name' }) // exists
        .mockResolvedValue(null); // rest don't exist

      mockPrisma.chatbotConfig.create.mockResolvedValue({});

      const count = await service.seedDefaults();

      // Should have created (total defaults - 1) entries
      expect(count).toBe(CHATBOT_CONFIG_DEFAULTS.length - 1);
      expect(mockPrisma.chatbotConfig.create).toHaveBeenCalledTimes(
        CHATBOT_CONFIG_DEFAULTS.length - 1,
      );
    });

    it('returns 0 when all keys already exist', async () => {
      mockPrisma.chatbotConfig.findUnique.mockResolvedValue({ key: 'exists' });

      const count = await service.seedDefaults();
      expect(count).toBe(0);
      expect(mockPrisma.chatbotConfig.create).not.toHaveBeenCalled();
    });
  });
});
