import { Injectable, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
        metadata: (dto.metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        status: 'PENDING',
      },
    });

    const chunks = chunkText(dto.content);

    try {
      const vectors = await this.embedding.embed(chunks);

      await this.prisma.$transaction(async (tx) => {
        await tx.documentChunk.createMany({
          data: chunks.map((content, i) => ({
            tenantId: dto.tenantId,
            documentId: doc.id,
            content,
            chunkIndex: i,
            tokenCount: Math.ceil(content.length / 4),
          })),
        });

        // Batch-update all embeddings in one round-trip using UNNEST
        const indices = chunks.map((_, i) => i);
        const vectorLiterals = vectors.map((v) => `[${v.join(',')}]`);

        await tx.$executeRawUnsafe(
          `UPDATE "DocumentChunk" dc
           SET embedding = vals.vec::vector
           FROM (
             SELECT UNNEST($1::int[]) AS idx,
                    UNNEST($2::text[]) AS vec
           ) vals
           WHERE dc."documentId" = $3
             AND dc."chunkIndex" = vals.idx`,
          indices,
          vectorLiterals,
          doc.id,
        );

        await tx.knowledgeDocument.update({
          where: { id: doc.id },
          data: { status: 'EMBEDDED' },
        });
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
