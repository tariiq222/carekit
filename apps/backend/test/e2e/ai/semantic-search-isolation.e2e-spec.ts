import { bootHarness, IsolationHarness } from '../../tenant-isolation/isolation-harness';

/**
 * SaaS-02g §11.1 — Semantic search cross-tenant isolation (pgvector).
 *
 * Proves the `"organizationId" = $3` predicate in SemanticSearchHandler's
 * $queryRawUnsafe call (Red-flag invariant #4).
 *
 * bootHarness mocks SemanticSearchHandler at the provider level, so we cannot
 * invoke the real handler here. Instead we prove isolation at the DB layer
 * directly: the same raw SQL used by SemanticSearchHandler is executed via
 * h.prisma.$queryRawUnsafe with an explicit organizationId parameter, which is
 * equivalent to what the real handler would do under a given CLS context.
 *
 * We seed KnowledgeDocument + DocumentChunk rows in two orgs with deterministic
 * embeddings (via $executeRawUnsafe — pgvector is Unsupported in Prisma), then
 * execute the raw vector-search SQL scoped to each org and assert no cross-org
 * leakage.
 */

const DIM = 1536;
const vec = (seed: number): string => {
  // Deterministic vector in pgvector literal format. All zeros except one slot
  // so cosine distance is stable and orgs' docs sort predictably.
  const v = new Array<number>(DIM).fill(0);
  v[seed % DIM] = 1;
  return `[${v.join(',')}]`;
};

describe('SaaS-02g — semantic-search cross-tenant isolation', () => {
  let h: IsolationHarness;

  beforeAll(async () => {
    h = await bootHarness();
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

  /**
   * Run the same raw SQL that SemanticSearchHandler.execute() uses, scoped to
   * the given organizationId. This is the DB-level proof that the predicate
   * `dc."organizationId" = $3` correctly gates cross-org access.
   */
  async function rawSearch(
    organizationId: string,
    vectorSeed: number,
    topK = 10,
    documentId?: string,
  ): Promise<Array<{ id: string; documentId: string }>> {
    const vectorLiteral = vec(vectorSeed);
    const docFilter = documentId ? `AND dc."documentId" = $4` : '';
    const params: unknown[] = [vectorLiteral, topK, organizationId];
    if (documentId) params.push(documentId);

    return h.prisma.$queryRawUnsafe<Array<{ id: string; documentId: string }>>(
      `SELECT dc.id, dc."documentId"
       FROM "DocumentChunk" dc
       WHERE dc.embedding IS NOT NULL AND dc."organizationId" = $3 ${docFilter}
       ORDER BY dc.embedding <=> $1::vector
       LIMIT $2`,
      ...params,
    );
  }

  it('search from org A never returns chunks seeded in org B', async () => {
    const ts = Date.now();
    const a = await h.createOrg(`kb-iso-a-${ts}`, 'منظمة معرفة أ');
    const b = await h.createOrg(`kb-iso-b-${ts}`, 'منظمة معرفة ب');

    const seeded = {
      a: await seedChunkInOrg(a.id, 'doc-A', 7),
      b: await seedChunkInOrg(b.id, 'doc-B', 7),
    };

    const rowsA = await rawSearch(a.id, 7);
    const rowsB = await rawSearch(b.id, 7);

    const idsA = rowsA.map((r) => r.id);
    const idsB = rowsB.map((r) => r.id);

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

    // Attempt to reach Org B's chunk from Org A's context, specifying Org B's
    // documentId — the organizationId predicate must still block access.
    const rows = await rawSearch(a.id, 7, 10, seededB.docId);

    expect(rows.map((r) => r.id)).not.toContain(seededB.chunkId);
    expect(rows).toHaveLength(0);
  });
});
