import { bootHarness, IsolationHarness } from '../../tenant-isolation/isolation-harness';
import { EmbeddingAdapter } from '../../../src/infrastructure/ai';
import { SemanticSearchHandler } from '../../../src/modules/ai/semantic-search/semantic-search.handler';

/**
 * SaaS-02g §11.1 — Semantic search cross-tenant isolation (pgvector).
 *
 * This is the most critical 02g isolation test: it proves the raw $queryRawUnsafe
 * in SemanticSearchHandler honors the `"organizationId" = $3` predicate required
 * by Red-flag invariant #4. RLS is a defense-in-depth backstop; the predicate in
 * the SQL itself is the primary gate.
 *
 * We seed KnowledgeDocument + DocumentChunk rows in two orgs with deterministic
 * embeddings (via $executeRawUnsafe — pgvector is Unsupported in Prisma). Then
 * we run SemanticSearchHandler.execute() under each org's CLS context with a
 * stubbed EmbeddingAdapter and assert no cross-org leakage.
 */

const DIM = 1536;
const vec = (seed: number): string => {
  // Deterministic vector in pgvector literal format. All zeros except one slot
  // so cosine distance is stable and orgs' docs sort predictably.
  const v = new Array<number>(DIM).fill(0);
  v[seed % DIM] = 1;
  return `[${v.join(',')}]`;
};

const numericVec = (seed: number): number[] => {
  const v = new Array<number>(DIM).fill(0);
  v[seed % DIM] = 1;
  return v;
};

describe('SaaS-02g — semantic-search cross-tenant isolation', () => {
  let h: IsolationHarness;
  let handler: SemanticSearchHandler;

  beforeAll(async () => {
    h = await bootHarness();
    handler = h.app.get(SemanticSearchHandler);
    const emb = h.app.get(EmbeddingAdapter);
    jest.spyOn(emb, 'isAvailable').mockReturnValue(true);
    // Return the same canonical vector so both orgs' seeded chunks are reachable.
    jest.spyOn(emb, 'embed').mockResolvedValue([numericVec(7)]);
  });

  afterAll(async () => {
    if (h) await h.close();
  });

  const seedChunkInOrg = async (organizationId: string, title: string, seed: number) => {
    const doc = await h.runAs({ organizationId }, () =>
      h.prisma.knowledgeDocument.create({
        data: { organizationId, title, sourceType: 'manual', status: 'EMBEDDED' },
        select: { id: true },
      }),
    );
    const chunk = await h.runAs({ organizationId }, () =>
      h.prisma.documentChunk.create({
        data: {
          organizationId,
          documentId: doc.id,
          content: `${title} — chunk body`,
          chunkIndex: 0,
          tokenCount: 10,
        },
        select: { id: true },
      }),
    );
    // Embedding column is pgvector Unsupported — write via raw SQL.
    await h.prisma.$executeRawUnsafe(
      `UPDATE "DocumentChunk" SET embedding = $1::vector WHERE id = $2`,
      vec(seed),
      chunk.id,
    );
    return { docId: doc.id, chunkId: chunk.id };
  };

  it('search from org A never returns chunks seeded in org B', async () => {
    const ts = Date.now();
    const a = await h.createOrg(`kb-iso-a-${ts}`, 'منظمة معرفة أ');
    const b = await h.createOrg(`kb-iso-b-${ts}`, 'منظمة معرفة ب');

    const seeded = {
      a: await seedChunkInOrg(a.id, 'doc-A', 7),
      b: await seedChunkInOrg(b.id, 'doc-B', 7),
    };

    const resultsA = await h.runAs({ organizationId: a.id }, () =>
      handler.execute({ query: 'anything', topK: 10 }),
    );
    const resultsB = await h.runAs({ organizationId: b.id }, () =>
      handler.execute({ query: 'anything', topK: 10 }),
    );

    const idsA = resultsA.map((r) => r.chunkId);
    const idsB = resultsB.map((r) => r.chunkId);

    expect(idsA).toContain(seeded.a.chunkId);
    expect(idsA).not.toContain(seeded.b.chunkId);
    expect(idsB).toContain(seeded.b.chunkId);
    expect(idsB).not.toContain(seeded.a.chunkId);
  });

  it('org A cannot reach org B chunks even when filtering by a known cross-org documentId', async () => {
    const ts = Date.now();
    const a = await h.createOrg(`kb-cross-a-${ts}`, 'منظمة معرفة عبور أ');
    const b = await h.createOrg(`kb-cross-b-${ts}`, 'منظمة معرفة عبور ب');

    const seededB = await seedChunkInOrg(b.id, 'doc-B-secret', 7);

    const results = await h.runAs({ organizationId: a.id }, () =>
      handler.execute({ query: 'anything', topK: 10, documentId: seededB.docId }),
    );

    expect(results.map((r) => r.chunkId)).not.toContain(seededB.chunkId);
    expect(results).toHaveLength(0);
  });
});
