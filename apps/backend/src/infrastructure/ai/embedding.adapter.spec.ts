import { EmbeddingAdapter } from './embedding.adapter';

const buildConfig = (openaiApiKey = 'oai-key') => ({
  get: jest.fn().mockReturnValue({
    openaiApiKey,
    embeddingModel: 'text-embedding-3-small',
    openrouterApiKey: '',
    openrouterBaseUrl: '',
    chatModel: 'gpt-4o-mini',
  }),
});

describe('EmbeddingAdapter', () => {
  it('isAvailable returns false when OPENAI_API_KEY not set', () => {
    const adapter = new EmbeddingAdapter(buildConfig('') as never);
    adapter.onModuleInit();
    expect(adapter.isAvailable()).toBe(false);
  });

  it('isAvailable returns true after onModuleInit with valid key', () => {
    const adapter = new EmbeddingAdapter(buildConfig() as never);
    adapter.onModuleInit();
    expect(adapter.isAvailable()).toBe(true);
  });

  it('embed throws when adapter is not available', async () => {
    const adapter = new EmbeddingAdapter(buildConfig('') as never);
    adapter.onModuleInit();
    await expect(adapter.embed(['text'])).rejects.toThrow(/not available/);
  });

  it('embed calls OpenAI and returns float arrays', async () => {
    const adapter = new EmbeddingAdapter(buildConfig() as never);
    adapter.onModuleInit();
    (adapter as unknown as Record<string, unknown>)['client'] = {
      embeddings: {
        create: jest.fn().mockResolvedValue({
          data: [{ embedding: [0.1, 0.2, 0.3] }, { embedding: [0.4, 0.5, 0.6] }],
        }),
      },
    };
    const result = await adapter.embed(['hello', 'world']);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual([0.1, 0.2, 0.3]);
  });
});