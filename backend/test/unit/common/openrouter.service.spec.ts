/**
 * OpenRouterService — Unit Tests
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { OpenRouterService } from '../../../src/common/services/openrouter.service.js';

// Mock resilientFetch globally
jest.mock('../../../src/common/helpers/resilient-fetch.helper.js', () => ({
  resilientFetch: jest.fn(),
}));

import { resilientFetch } from '../../../src/common/helpers/resilient-fetch.helper.js';
const mockFetch = resilientFetch as jest.Mock;

describe('OpenRouterService', () => {
  let service: OpenRouterService;
  const mockConfig = { get: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockConfig.get.mockImplementation((key: string, def = '') =>
      key === 'OPENROUTER_API_KEY' ? 'test-api-key' : def,
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpenRouterService,
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get(OpenRouterService);
  });

  // ── chatCompletion ────────────────────────────────────────────

  describe('chatCompletion', () => {
    it('should call resilientFetch with correct params', async () => {
      const mockResponse = { ok: true } as Response;
      mockFetch.mockResolvedValue(mockResponse);

      const result = await service.chatCompletion({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('chat'),
        expect.objectContaining({ method: 'POST' }),
        expect.objectContaining({ circuit: 'openrouter' }),
      );
      expect(result).toBe(mockResponse);
    });

    it('should include tools in body when provided', async () => {
      mockFetch.mockResolvedValue({ ok: true } as Response);

      await service.chatCompletion({
        model: 'gpt-4',
        messages: [],
        tools: [{ type: 'function', function: { name: 'test' } }],
      });

      const body = JSON.parse(
        mockFetch.mock.calls[0][1].body as string,
      ) as Record<string, unknown>;
      expect(body.tools).toBeDefined();
      expect(body.tool_choice).toBe('auto');
    });

    it('should set stream=true when streaming', async () => {
      mockFetch.mockResolvedValue({ ok: true } as Response);

      await service.chatCompletion({
        model: 'gpt-4',
        messages: [],
        stream: true,
      });

      const body = JSON.parse(
        mockFetch.mock.calls[0][1].body as string,
      ) as Record<string, unknown>;
      expect(body.stream).toBe(true);
    });

    it('should propagate errors from resilientFetch', async () => {
      mockFetch.mockRejectedValue(new Error('Circuit open'));

      await expect(
        service.chatCompletion({ model: 'gpt-4', messages: [] }),
      ).rejects.toThrow('Circuit open');
    });
  });

  // ── generateEmbedding ─────────────────────────────────────────

  describe('generateEmbedding', () => {
    it('should return embedding array on success', async () => {
      const embedding = [0.1, 0.2, 0.3];
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: [{ embedding }],
        }),
      } as unknown as Response);

      const result = await service.generateEmbedding({
        model: 'text-embedding-3-small',
        input: 'test text',
      });

      expect(result).toEqual(embedding);
    });

    it('should throw when API returns error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        text: jest.fn().mockResolvedValue('Rate limited'),
      } as unknown as Response);

      await expect(
        service.generateEmbedding({
          model: 'text-embedding-3-small',
          input: 'test',
        }),
      ).rejects.toThrow();
    });

    it('should propagate network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(
        service.generateEmbedding({
          model: 'text-embedding-3-small',
          input: 'test',
        }),
      ).rejects.toThrow('Network error');
    });
  });
});
