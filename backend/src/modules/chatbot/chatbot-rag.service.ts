import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service.js';

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

    const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'carekit',
        'X-Title': 'CareKit',
      },
      body: JSON.stringify({ model, input: text }),
    });

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
    const vectorStr = `[${embedding.join(',')}]`;

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

    // Update embedding via raw SQL (Prisma can't handle Unsupported types)
    await this.prisma.$executeRawUnsafe(
      `UPDATE knowledge_base SET embedding = $1::vector WHERE id = $2`,
      vectorStr,
      entry.id,
    );

    return entry;
  }

  /**
   * Auto-sync services and practitioners from database to knowledge base.
   */
  async syncFromDatabase(): Promise<number> {
    // Delete old auto-synced entries
    await this.prisma.knowledgeBase.deleteMany({
      where: { source: 'auto_sync' },
    });

    let count = 0;

    // Sync services
    const services = await this.prisma.service.findMany({
      where: { isActive: true, deletedAt: null },
      include: { category: true },
    });

    for (const svc of services) {
      const content = [
        `Service: ${svc.nameEn} / ${svc.nameAr}`,
        `Category: ${svc.category.nameEn} / ${svc.category.nameAr}`,
        `Price: ${svc.price / 100} SAR`,
        `Duration: ${svc.duration} minutes`,
        svc.descriptionEn ? `Description: ${svc.descriptionEn}` : '',
        svc.descriptionAr ? `الوصف: ${svc.descriptionAr}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      await this.upsertEntry({
        title: `${svc.nameEn} / ${svc.nameAr}`,
        content,
        category: 'services',
        source: 'auto_sync',
      });
      count++;
    }

    // Sync practitioners
    const practitioners = await this.prisma.practitioner.findMany({
      where: { isActive: true, deletedAt: null },
      include: {
        user: { select: { firstName: true, lastName: true } },
        specialty: { select: { nameEn: true, nameAr: true } },
      },
    });

    for (const doc of practitioners) {
      const name = `${doc.user.firstName} ${doc.user.lastName}`;
      const content = [
        `Practitioner: ${name}`,
        `Specialty: ${doc.specialty.nameEn} / ${doc.specialty.nameAr}`,
        `Clinic Visit: ${doc.priceClinic / 100} SAR`,
        `Phone Consultation: ${doc.pricePhone / 100} SAR`,
        `Video Consultation: ${doc.priceVideo / 100} SAR`,
        `Experience: ${doc.experience} years`,
        `Rating: ${doc.rating}/5 (${doc.reviewCount} reviews)`,
        doc.bio ? `Bio: ${doc.bio}` : '',
        doc.bioAr ? `السيرة: ${doc.bioAr}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      await this.upsertEntry({
        title: name,
        content,
        category: 'practitioners',
        source: 'auto_sync',
      });
      count++;
    }

    this.logger.log(`Auto-synced ${count} entries to knowledge base`);
    return count;
  }

  // ── KB CRUD ──

  async findAll(params?: { source?: string; category?: string; page?: number; perPage?: number }) {
    const page = params?.page ?? 1;
    const perPage = params?.perPage ?? 20;
    const where: Record<string, unknown> = {};

    if (params?.source) where.source = params.source;
    if (params?.category) where.category = params.category;

    const [items, total] = await Promise.all([
      this.prisma.knowledgeBase.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.knowledgeBase.count({ where }),
    ]);

    const totalPages = Math.ceil(total / perPage);
    return {
      items,
      meta: { total, page, perPage, totalPages, hasNextPage: page < totalPages, hasPreviousPage: page > 1 },
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

    // Re-generate embedding if content changed
    if (data.title || data.content) {
      const updated = await this.prisma.knowledgeBase.findUnique({ where: { id } });
      if (updated) {
        const embedding = await this.generateEmbedding(`${updated.title}\n${updated.content}`);
        const vectorStr = `[${embedding.join(',')}]`;
        await this.prisma.$executeRawUnsafe(
          `UPDATE knowledge_base SET embedding = $1::vector WHERE id = $2`,
          vectorStr,
          id,
        );
      }
    }

    return entry;
  }

  async delete(id: string) {
    await this.prisma.knowledgeBase.delete({ where: { id } });
    return { deleted: true };
  }
}
