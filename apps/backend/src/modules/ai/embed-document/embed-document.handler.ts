import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { EmbeddingAdapter } from '../../../infrastructure/ai';
import type { EmbedDocumentDto } from './embed-document.dto';

const CHUNK_SIZE = 2000;
const CHUNK_OVERLAP = 100;

function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    chunks.push(text.slice(start, end));
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks;
}

@Injectable()
export class EmbedDocumentHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly embedding: EmbeddingAdapter,
  ) {}

  async execute(dto: EmbedDocumentDto) {
    if (!this.embedding.isAvailable()) {
      throw new BadRequestException('EmbeddingAdapter is not available — set OPENAI_API_KEY');
    }

    const doc = await this.prisma.knowledgeDocument.create({
      data: {
        tenantId: dto.tenantId,
        title: dto.title,
        sourceType: dto.sourceType,
        sourceRef: dto.sourceRef,
        metadata: dto.metadata,
        status: 'PENDING',
      },
    });

    const chunks = chunkText(dto.content);

    try {
      const vectors = await this.embedding.embed(chunks);

      await this.prisma.documentChunk.createMany({
        data: chunks.map((content, i) => ({
          tenantId: dto.tenantId,
          documentId: doc.id,
          content,
          chunkIndex: i,
          tokenCount: Math.ceil(content.length / 4),
        })),
      });

      for (let i = 0; i < chunks.length; i++) {
        const vector = `[${vectors[i].join(',')}]`;
        await this.prisma.$executeRawUnsafe(
          `UPDATE "DocumentChunk" SET embedding = $1::vector WHERE "documentId" = $2 AND "chunkIndex" = $3`,
          vector,
          doc.id,
          i,
        );
      }

      await this.prisma.knowledgeDocument.update({
        where: { id: doc.id },
        data: { status: 'EMBEDDED' },
      });

      return { documentId: doc.id, chunks: chunks.length };
    } catch (err) {
      await this.prisma.knowledgeDocument.update({
        where: { id: doc.id },
        data: { status: 'FAILED' },
      });
      throw err;
    }
  }
}
