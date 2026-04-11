import { EmbedDocumentHandler } from './embed-document.handler';

const futureDoc = { id: 'doc-1', tenantId: 't1', title: 'Test', status: 'PENDING' };

const mockPrisma = () => ({
  knowledgeDocument: {
    create: jest.fn().mockResolvedValue(futureDoc),
    update: jest.fn().mockResolvedValue({ ...futureDoc, status: 'EMBEDDED' }),
  },
  documentChunk: {
    createMany: jest.fn().mockResolvedValue({ count: 2 }),
  },
  $executeRawUnsafe: jest.fn().mockResolvedValue(1),
});

const mockEmbedding = () => ({
  isAvailable: jest.fn().mockReturnValue(true),
  embed: jest.fn().mockResolvedValue([[0.1, 0.2], [0.3, 0.4]]),
});

const dto = {
  tenantId: 't1',
  title: 'CareKit FAQ',
  content: 'A'.repeat(3000),
  sourceType: 'manual' as const,
};

describe('EmbedDocumentHandler', () => {
  it('creates document record with PENDING status then updates to EMBEDDED', async () => {
    const prisma = mockPrisma();
    const embedding = mockEmbedding();
    const handler = new EmbedDocumentHandler(prisma as never, embedding as never);
    await handler.execute(dto);
    expect(prisma.knowledgeDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'PENDING', tenantId: 't1' }) }),
    );
    expect(prisma.knowledgeDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'EMBEDDED' }) }),
    );
  });

  it('calls embed once per chunk batch', async () => {
    const prisma = mockPrisma();
    const embedding = mockEmbedding();
    const handler = new EmbedDocumentHandler(prisma as never, embedding as never);
    await handler.execute(dto);
    expect(embedding.embed).toHaveBeenCalledTimes(1);
    const chunks: string[] = embedding.embed.mock.calls[0][0];
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('marks document as FAILED when embedding throws', async () => {
    const prisma = mockPrisma();
    const embedding = mockEmbedding();
    embedding.embed = jest.fn().mockRejectedValue(new Error('API error'));
    const handler = new EmbedDocumentHandler(prisma as never, embedding as never);
    await expect(handler.execute(dto)).rejects.toThrow('API error');
    expect(prisma.knowledgeDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
    );
  });

  it('throws if EmbeddingAdapter is not available', async () => {
    const prisma = mockPrisma();
    const embedding = { isAvailable: jest.fn().mockReturnValue(false), embed: jest.fn() };
    const handler = new EmbedDocumentHandler(prisma as never, embedding as never);
    await expect(handler.execute(dto)).rejects.toThrow('EmbeddingAdapter is not available');
  });
});
