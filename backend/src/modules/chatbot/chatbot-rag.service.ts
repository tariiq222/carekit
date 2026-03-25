import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service.js';
import { parsePaginationParams, buildPaginationMeta } from '../../common/helpers/pagination.helper.js';
import { resilientFetch } from '../../common/helpers/resilient-fetch.helper.js';

interface KbSearchResult {
  id: string;
  title: string;
  content: string;
  category: string | null;
  similarity: number;
}

interface EmbeddingResponse {
  data: { embedding: number[] }[];
}

@Injectable()
export class ChatbotRagService {
  private readonly logger = new Logger(ChatbotRagService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Generate embedding vector for text using OpenRouter embedding API.
   */
  async generateEmbedding(text: string): Promise<number[]> {
    const apiKey = this.config.get<string>('OPENROUTER_API_KEY');
    const model = this.config.get<string>('OPENROUTER_EMBEDDING_MODEL') ?? 'openai/text-embedding-3-small';

    const response = await resilientFetch('https://openrouter.ai/api/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'carekit',
        'X-Title': 'CareKit',
      },
      body: JSON.stringify({ model, input: text }),
    }, { circuit: 'openrouter', timeoutMs: 15_000 });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Embedding API error: ${response.status} — ${errorText}`);
    }

    const data = (await response.json()) as EmbeddingResponse;
    return data.data[0].embedding;
  }

  /**
   * Search knowledge base using cosine similarity on pgvector.
   */
  async searchSimilar(query: string, limit = 5): Promise<KbSearchResult[]> {
    const embedding = await this.generateEmbedding(query);

    if (!Array.isArray(embedding) || !embedding.every(v => typeof v === 'number' && isFinite(v))) {
      this.logger.error('Invalid embedding received from API');
      return [];
    }

    const vectorStr = `[${embedding.join(',')}]`;

    // SAFETY: $queryRawUnsafe is required because Prisma cannot parameterize
    // pgvector's Unsupported("vector") type via tagged template literals.
    // vectorStr is safe: generated from OpenRouter API float[] (never user input).
    // All values ($1, $2) are parameterized — no SQL injection risk.
    const results = await this.prisma.$queryRawUnsafe<KbSearchResult[]>(
      `SELECT id, title, content, category,
              1 - (embedding <=> $1::vector) AS similarity
       FROM knowledge_base
       WHERE is_active = true AND embedding IS NOT NULL
       ORDER BY embedding <=> $1::vector
       LIMIT $2`,
      vectorStr,
      limit,
    );

    return results.filter((r) => r.similarity > 0.3);
  }

  /**
   * Create or update a knowledge base entry with embedding.
   */
  async upsertEntry(params: {
    title: string;
    content: string;
    category?: string;
    source?: string;
    fileId?: string;
    chunkIndex?: number;
  }) {
    const embedding = await this.generateEmbedding(
      `${params.title}\n${params.content}`,
    );
    const vectorStr = `[${embedding.join(',')}]`;

    const entry = await this.prisma.knowledgeBase.create({
      data: {
        title: params.title,
        content: params.content,
        category: params.category,
        source: params.source ?? 'manual',
        fileId: params.fileId,
        chunkIndex: params.chunkIndex,
      },
    });

    // SAFETY: $executeRawUnsafe required for pgvector Unsupported type.
    // vectorStr is from OpenRouter API float[] only. Values are parameterized.
    await this.prisma.$executeRawUnsafe(
      `UPDATE knowledge_base SET embedding = $1::vector WHERE id = $2`,
      vectorStr,
      entry.id,
    );

    return entry;
  }

  /**
   * Auto-sync services and practitioners from database to knowledge base.
   * Uses concurrent embedding generation + atomic transaction.
   */
  async syncFromDatabase(): Promise<number> {
    // 1. Collect all entries to sync
    const entries: Array<{ title: string; content: string; category: string }> = [];

    const services = await this.prisma.service.findMany({
      where: { isActive: true, deletedAt: null },
      include: { category: true },
    });

    for (const svc of services) {
      entries.push({
        title: `${svc.nameEn} / ${svc.nameAr}`,
        content: [
          `Service: ${svc.nameEn} / ${svc.nameAr}`,
          `Category: ${svc.category.nameEn} / ${svc.category.nameAr}`,
          `Price: ${svc.price / 100} SAR`,
          `Duration: ${svc.duration} minutes`,
          svc.descriptionEn ? `Description: ${svc.descriptionEn}` : '',
          svc.descriptionAr ? `الوصف: ${svc.descriptionAr}` : '',
        ].filter(Boolean).join('\n'),
        category: 'services',
      });
    }

    const practitioners = await this.prisma.practitioner.findMany({
      where: { isActive: true, deletedAt: null },
      include: {
        user: { select: { firstName: true, lastName: true } },
        practitionerServices: {
          where: { isActive: true },
          include: { service: { select: { nameEn: true, nameAr: true } } },
        },
      },
    });

    for (const doc of practitioners) {
      const name = `${doc.user.firstName} ${doc.user.lastName}`;
      const serviceLines = doc.practitionerServices.map((ps) => {
        const prices = [
          ps.priceClinic != null ? `Clinic: ${ps.priceClinic / 100} SAR` : null,
          ps.pricePhone != null ? `Phone: ${ps.pricePhone / 100} SAR` : null,
          ps.priceVideo != null ? `Video: ${ps.priceVideo / 100} SAR` : null,
        ].filter(Boolean).join(', ');
        return `  - ${ps.service.nameEn}: ${prices}`;
      });
      entries.push({
        title: name,
        content: [
          `Practitioner: ${name}`,
          `Specialty: ${doc.specialty} / ${doc.specialtyAr}`,
          serviceLines.length > 0 ? `Services:\n${serviceLines.join('\n')}` : '',
          `Experience: ${doc.experience} years`,
          `Rating: ${doc.rating}/5 (${doc.reviewCount} reviews)`,
          doc.bio ? `Bio: ${doc.bio}` : '',
          doc.bioAr ? `السيرة: ${doc.bioAr}` : '',
        ].filter(Boolean).join('\n'),
        category: 'practitioners',
      });
    }

    // 2. Generate embeddings concurrently (batches of 5)
    const BATCH_SIZE = 5;
    const embeddings: string[] = [];
    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map((e) => this.generateEmbedding(`${e.title}\n${e.content}`)),
      );
      embeddings.push(...results.map((emb) => `[${emb.join(',')}]`));
    }

    // 3. Atomic replace: delete old + insert new in one transaction
    await this.prisma.$transaction(async (tx) => {
      await tx.knowledgeBase.deleteMany({ where: { source: 'auto_sync' } });

      for (let i = 0; i < entries.length; i++) {
        const entry = await tx.knowledgeBase.create({
          data: {
            title: entries[i].title,
            content: entries[i].content,
            category: entries[i].category,
            source: 'auto_sync',
          },
        });
        await tx.$executeRawUnsafe(
          `UPDATE knowledge_base SET embedding = $1::vector WHERE id = $2`,
          embeddings[i],
          entry.id,
        );
      }
    });

    this.logger.log(`Auto-synced ${entries.length} entries to knowledge base`);
    return entries.length;
  }

  // ── KB CRUD ──

  async findAll(params?: { source?: string; category?: string; page?: number; perPage?: number }) {
    const { page, perPage, skip } = parsePaginationParams(params?.page, params?.perPage);
    const where: Record<string, unknown> = {};

    if (params?.source) where.source = params.source;
    if (params?.category) where.category = params.category;

    const [items, total] = await Promise.all([
      this.prisma.knowledgeBase.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
      }),
      this.prisma.knowledgeBase.count({ where }),
    ]);

    return {
      items,
      meta: buildPaginationMeta(total, page, perPage),
    };
  }

  async findOne(id: string) {
    return this.prisma.knowledgeBase.findUnique({ where: { id } });
  }

  async update(id: string, data: { title?: string; content?: string; category?: string; isActive?: boolean }) {
    const entry = await this.prisma.knowledgeBase.update({
      where: { id },
      data,
    });

    // Re-generate embedding if content changed — use the already-returned entry
    if (data.title || data.content) {
      const embedding = await this.generateEmbedding(`${entry.title}\n${entry.content}`);
      const vectorStr = `[${embedding.join(',')}]`;
      await this.prisma.$executeRawUnsafe(
        `UPDATE knowledge_base SET embedding = $1::vector WHERE id = $2`,
        vectorStr,
        id,
      );
    }

    return entry;
  }

  async delete(id: string) {
    await this.prisma.knowledgeBase.delete({ where: { id } });
    return { deleted: true };
  }
}
