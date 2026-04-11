import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import type {
  ListDocumentsDto,
  GetDocumentDto,
  DeleteDocumentDto,
  UpdateDocumentDto,
} from './manage-knowledge-base.dto';

@Injectable()
export class ManageKnowledgeBaseHandler {
  constructor(private readonly prisma: PrismaService) {}

  async listDocuments(dto: ListDocumentsDto) {
    const page = dto.page ?? 1;
    const limit = Math.min(dto.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where = {
      tenantId: dto.tenantId,
      ...(dto.status ? { status: dto.status } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.knowledgeDocument.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.knowledgeDocument.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async getDocument(dto: GetDocumentDto) {
    const doc = await this.prisma.knowledgeDocument.findUnique({
      where: { id: dto.documentId },
      include: {
        chunks: {
          select: { id: true, chunkIndex: true, tokenCount: true },
          orderBy: { chunkIndex: 'asc' },
        },
      },
    });
    if (!doc || doc.tenantId !== dto.tenantId) throw new NotFoundException('Document not found');
    return doc;
  }

  async deleteDocument(dto: DeleteDocumentDto) {
    await this.getDocument(dto);
    await this.prisma.knowledgeDocument.delete({ where: { id: dto.documentId } });
  }

  async updateDocument(dto: UpdateDocumentDto) {
    await this.getDocument(dto);
    return this.prisma.knowledgeDocument.update({
      where: { id: dto.documentId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.metadata !== undefined ? { metadata: dto.metadata } : {}),
      },
    });
  }
}
