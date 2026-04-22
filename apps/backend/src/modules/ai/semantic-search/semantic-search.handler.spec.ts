import { SemanticSearchHandler } from './semantic-search.handler';

const buildTenant = (organizationId = 'org-A') => ({
  requireOrganizationIdOrDefault: jest.fn().mockReturnValue(organizationId),
});

const mockChunk = {
  id: 'chunk-1',
  documentId: 'doc-1',
  content: 'CareKit helps clinics manage bookings',
  chunkIndex: 0,
  similarity: 0.92,
};

const mockPrisma = () => ({
  $queryRawUnsafe: jest.fn().mockResolvedValue([mockChunk]),
});

const mockEmbedding = () => ({
  isAvailable: jest.fn().mockReturnValue(true),
  embed: jest.fn().mockResolvedValue([[0.1, 0.2, 0.3]]),
});

const dto = { query: 'how to book an appointment', topK: 5 };

describe('SemanticSearchHandler', () => {
  it('returns ranked chunks with similarity scores', async () => {
    const prisma = mockPrisma();
    const embedding = mockEmbedding();
    const handler = new SemanticSearchHandler(prisma as never, embedding as never, buildTenant() as never);
    const result = await handler.execute(dto);
    expect(result).toHaveLength(1);
    expect(result[0].similarity).toBe(0.92);
    expect(result[0].content).toBe('CareKit helps clinics manage bookings');
  });

  it('embeds the query before searching', async () => {
    const prisma = mockPrisma();
    const embedding = mockEmbedding();
    const handler = new SemanticSearchHandler(prisma as never, embedding as never, buildTenant() as never);
    await handler.execute(dto);
    expect(embedding.embed).toHaveBeenCalledWith(['how to book an appointment']);
  });

  it('passes topK limit to the query', async () => {
    const prisma = mockPrisma();
    const embedding = mockEmbedding();
    const handler = new SemanticSearchHandler(prisma as never, embedding as never, buildTenant() as never);
    await handler.execute(dto);
    const rawCall: string = prisma.$queryRawUnsafe.mock.calls[0][0];
    expect(rawCall).toContain('LIMIT');
  });

  it('throws if EmbeddingAdapter is not available', async () => {
    const prisma = mockPrisma();
    const embedding = { isAvailable: jest.fn().mockReturnValue(false), embed: jest.fn() };
    const handler = new SemanticSearchHandler(prisma as never, embedding as never, buildTenant() as never);
    await expect(handler.execute(dto)).rejects.toThrow('EmbeddingAdapter is not available');
  });
});

describe('SemanticSearchHandler — embedding unavailable', () => {
  it('throws BadRequestException when EmbeddingAdapter not available', async () => {
    const prisma = { $queryRawUnsafe: jest.fn() };
    const embedding = { isAvailable: jest.fn().mockReturnValue(false), embed: jest.fn() };
    const handler = new SemanticSearchHandler(prisma as never, embedding as never, buildTenant() as never);
    await expect(handler.execute({ query: 'test' })).rejects.toThrow('not available');
  });

  it('limits topK to max 20', async () => {
    const prisma = { $queryRawUnsafe: jest.fn().mockResolvedValue([]) };
    const embedding = { isAvailable: jest.fn().mockReturnValue(true), embed: jest.fn().mockResolvedValue([[0.1, 0.2]]) };
    const handler = new SemanticSearchHandler(prisma as never, embedding as never, buildTenant() as never);
    await handler.execute({ query: 'test', topK: 100 });
    // params: [vectorLiteral, topK, organizationId, (optional documentId)]
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('LIMIT'),
      expect.anything(), 20, 'org-A',
    );
  });

  it('adds documentId filter when provided', async () => {
    const prisma = { $queryRawUnsafe: jest.fn().mockResolvedValue([]) };
    const embedding = { isAvailable: jest.fn().mockReturnValue(true), embed: jest.fn().mockResolvedValue([[0.1]]) };
    const handler = new SemanticSearchHandler(prisma as never, embedding as never, buildTenant() as never);
    await handler.execute({ query: 'test', documentId: 'doc-1' });
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.anything(), expect.anything(), expect.anything(), 'org-A', 'doc-1',
    );
  });

  it('always includes organizationId in the WHERE clause', async () => {
    const prisma = { $queryRawUnsafe: jest.fn().mockResolvedValue([]) };
    const embedding = { isAvailable: jest.fn().mockReturnValue(true), embed: jest.fn().mockResolvedValue([[0.1]]) };
    const handler = new SemanticSearchHandler(prisma as never, embedding as never, buildTenant() as never);
    await handler.execute({ query: 'test' });
    const sql: string = prisma.$queryRawUnsafe.mock.calls[0][0];
    expect(sql).toMatch(/organizationId/);
  });
});
