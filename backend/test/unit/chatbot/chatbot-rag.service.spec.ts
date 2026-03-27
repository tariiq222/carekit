/** CareKit — ChatbotRagService Unit Tests */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ChatbotRagService } from '../../../src/modules/chatbot/chatbot-rag.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

const mockPrisma: any = {
  knowledgeBase: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },
  service: { findMany: jest.fn() },
  practitioner: { findMany: jest.fn() },
  $queryRawUnsafe: jest.fn(),
  $executeRawUnsafe: jest.fn(),
  $transaction: jest.fn((cb: (tx: unknown) => Promise<unknown>) => cb(mockPrisma)),
};

const mockConfigService: any = {
  get: jest.fn((key: string) => {
    if (key === 'OPENROUTER_API_KEY') return 'test-api-key';
    if (key === 'OPENROUTER_EMBEDDING_MODEL') return 'openai/text-embedding-3-small';
    return null;
  }),
};

describe('ChatbotRagService', () => {
  let service: ChatbotRagService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatbotRagService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();
    service = module.get<ChatbotRagService>(ChatbotRagService);
  });

  describe('generateEmbedding', () => {
    it('calls OpenRouter embedding API and returns vector', async () => {
      const mockEmbedding = Array(1536).fill(0.1);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [{ embedding: mockEmbedding }] }),
      });

      const result = await service.generateEmbedding('test text');

      expect(result).toEqual(mockEmbedding);
      expect(result.length).toBe(1536);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/embeddings',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
          }),
        }),
      );
    });

    it('throws on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: () => Promise.resolve('Rate limited'),
      });

      await expect(service.generateEmbedding('test')).rejects.toThrow('Embedding API error');
    });
  });

  describe('searchSimilar', () => {
    it('generates embedding and queries pgvector', async () => {
      const mockEmbedding = Array(1536).fill(0.1);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [{ embedding: mockEmbedding }] }),
      });

      const mockResults = [
        { id: 'kb-1', title: 'FAQ', content: 'Answer', category: 'faq', similarity: 0.85 },
      ];
      mockPrisma.$queryRawUnsafe.mockResolvedValue(mockResults);

      const result = await service.searchSimilar('test query', 5);

      expect(result).toEqual(mockResults);
      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('embedding <=>'),
        expect.any(String),
        5,
      );
    });

    it('filters out low-similarity results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [{ embedding: Array(1536).fill(0) }] }),
      });

      mockPrisma.$queryRawUnsafe.mockResolvedValue([
        { id: '1', title: 'Good', similarity: 0.8 },
        { id: '2', title: 'Bad', similarity: 0.2 },
      ]);

      const result = await service.searchSimilar('query');
      expect(result.length).toBe(1);
      expect(result[0].title).toBe('Good');
    });
  });

  describe('syncFromDatabase', () => {
    it('deletes old auto-sync entries and creates new ones', async () => {
      mockPrisma.knowledgeBase.deleteMany.mockResolvedValue({ count: 5 });
      mockPrisma.service.findMany.mockResolvedValue([
        {
          id: 's-1',
          nameEn: 'Checkup',
          nameAr: 'فحص',
          price: 15000,
          duration: 30,
          descriptionEn: 'General checkup',
          descriptionAr: 'فحص عام',
          category: { nameEn: 'General', nameAr: 'عام' },
        },
      ]);
      mockPrisma.practitioner.findMany.mockResolvedValue([
        {
          id: 'p-1',
          user: { firstName: 'Ahmed', lastName: 'Ali' },
          specialty: { nameEn: 'Dermatology', nameAr: 'جلدية' },
          practitionerServices: [
            {
              priceClinic: 20000,
              pricePhone: 15000,
              priceVideo: 15000,
              service: { nameEn: 'Skin Checkup', nameAr: 'فحص جلدي' },
            },
          ],
          experience: 10,
          rating: 4.5,
          reviewCount: 50,
          bio: 'Expert',
          bioAr: 'خبير',
        },
      ]);

      // Mock embedding calls for each entry
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [{ embedding: Array(1536).fill(0) }] }),
      });
      mockPrisma.knowledgeBase.create.mockResolvedValue({ id: 'new-1' });
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);

      const count = await service.syncFromDatabase();

      expect(count).toBe(2); // 1 service + 1 practitioner
      expect(mockPrisma.knowledgeBase.deleteMany).toHaveBeenCalledWith({
        where: { source: 'auto_sync' },
      });
    });
  });

  describe('findAll', () => {
    it('returns paginated KB entries', async () => {
      mockPrisma.knowledgeBase.findMany.mockResolvedValue([]);
      mockPrisma.knowledgeBase.count.mockResolvedValue(0);

      const result = await service.findAll({ page: 1, perPage: 10 });
      expect(result.items).toEqual([]);
      expect(result.meta.total).toBe(0);
    });

    it('filters by source and category', async () => {
      mockPrisma.knowledgeBase.findMany.mockResolvedValue([]);
      mockPrisma.knowledgeBase.count.mockResolvedValue(0);

      await service.findAll({ source: 'manual', category: 'faq' });
      expect(mockPrisma.knowledgeBase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { source: 'manual', category: 'faq' },
        }),
      );
    });
  });

  describe('delete', () => {
    it('deletes KB entry by id', async () => {
      mockPrisma.knowledgeBase.delete.mockResolvedValue({});

      const result = await service.delete('kb-1');
      expect(result).toEqual({ deleted: true });
      expect(mockPrisma.knowledgeBase.delete).toHaveBeenCalledWith({ where: { id: 'kb-1' } });
    });
  });
});
