import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../database/prisma.service.js';
import { MinioService } from '../../common/services/minio.service.js';
import { ChatbotRagService } from './chatbot-rag.service.js';
import { parsePaginationParams, buildPaginationMeta } from '../../common/helpers/pagination.helper.js';

// Dynamic imports for file parsing (ESM compatibility)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const loadPdfParse = () => import('pdf-parse').then((m: any) => m.default ?? m);
const loadMammoth = () => import('mammoth');

const MAX_CHUNK_LENGTH = 1500;
const CHUNK_OVERLAP = 200;

@Injectable()
export class ChatbotFileService {
  private readonly logger = new Logger(ChatbotFileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ragService: ChatbotRagService,
    private readonly minioService: MinioService,
  ) {}

  async uploadFile(userId: string, file: Express.Multer.File) {
    const ext = file.originalname.split('.').pop()?.toLowerCase() ?? 'pdf';
    const objectName = `kb-files/${crypto.randomUUID()}.${ext}`;

    const fileUrl = await this.minioService.uploadFile(
      'carekit',
      objectName,
      file.buffer,
      file.mimetype,
    );

    const fileType = ext === 'docx' || ext === 'doc' ? ext : ext === 'txt' ? 'txt' : 'pdf';

    const record = await this.prisma.knowledgeBaseFile.create({
      data: {
        fileName: file.originalname,
        fileUrl,
        fileType,
        fileSize: file.size,
        status: 'pending',
        uploadedBy: userId,
      },
    });

    return record;
  }

  /**
   * Process an uploaded file: read content, split into chunks, generate embeddings.
   * Supports PDF, DOCX, and TXT files.
   */
  async processFile(fileId: string): Promise<void> {
    const file = await this.prisma.knowledgeBaseFile.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'File not found',
        error: 'NOT_FOUND',
      });
    }

    // Update status to processing
    await this.prisma.knowledgeBaseFile.update({
      where: { id: fileId },
      data: { status: 'processing' },
    });

    try {
      // 1. Download file content from URL
      const fileBuffer = await this.downloadFile(file.fileUrl);

      // 2. Extract text based on file type
      const text = await this.extractText(fileBuffer, file.fileType);

      if (!text || text.trim().length === 0) {
        throw new Error('No text content could be extracted from the file');
      }

      // 3. Split into chunks
      const chunks = this.splitIntoChunks(text, file.fileName);

      // 4. Delete old chunks from this file
      await this.prisma.knowledgeBase.deleteMany({
        where: { fileId },
      });

      // 5. Create KB entries with embeddings for each chunk
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        await this.ragService.upsertEntry({
          title: `${file.fileName} — Part ${i + 1}`,
          content: chunk,
          category: 'file_upload',
          source: 'file_upload',
          fileId,
          chunkIndex: i,
        });
      }

      // 6. Update file status
      await this.prisma.knowledgeBaseFile.update({
        where: { id: fileId },
        data: {
          status: 'completed',
          chunksCount: chunks.length,
          error: null,
        },
      });

      this.logger.log(
        `File ${file.fileName} processed: ${chunks.length} chunks created`,
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `File processing failed for ${file.fileName}: ${errorMessage}`,
      );

      await this.prisma.knowledgeBaseFile.update({
        where: { id: fileId },
        data: { status: 'failed', error: errorMessage },
      });
    }
  }

  /**
   * Delete a file and all its associated KB chunks.
   */
  async deleteFile(fileId: string): Promise<void> {
    const file = await this.prisma.knowledgeBaseFile.findUnique({
      where: { id: fileId },
    });
    if (!file) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'File not found',
        error: 'NOT_FOUND',
      });
    }

    // Delete KB entries linked to this file
    await this.prisma.knowledgeBase.deleteMany({ where: { fileId } });

    // Delete the file record
    await this.prisma.knowledgeBaseFile.delete({ where: { id: fileId } });
  }

  /**
   * List all uploaded files with pagination.
   */
  async listFiles(params?: { page?: number; perPage?: number }) {
    const { page, perPage, skip } = parsePaginationParams(params?.page, params?.perPage);

    const [items, total] = await Promise.all([
      this.prisma.knowledgeBaseFile.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
        include: {
          user: { select: { firstName: true, lastName: true } },
        },
      }),
      this.prisma.knowledgeBaseFile.count(),
    ]);

    return {
      items,
      meta: buildPaginationMeta(total, page, perPage),
    };
  }

  // ── Private helpers ──

  private async downloadFile(url: string): Promise<Buffer> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  private async extractText(
    buffer: Buffer,
    fileType: string,
  ): Promise<string> {
    switch (fileType.toLowerCase()) {
      case 'pdf': {
        const pdfParse = await loadPdfParse();
        const result = await pdfParse(buffer);
        return result.text;
      }
      case 'docx':
      case 'doc': {
        const mammoth = await loadMammoth();
        const result = await mammoth.extractRawText({ buffer });
        return result.value;
      }
      case 'txt': {
        return buffer.toString('utf-8');
      }
      default:
        throw new Error(`Unsupported file type: ${fileType}`);
    }
  }

  /**
   * Split text into overlapping chunks for better RAG retrieval.
   * Each chunk is ~1500 chars with 200 char overlap.
   */
  private splitIntoChunks(text: string, fileName: string): string[] {
    // Clean up whitespace
    const cleaned = text.replace(/\s+/g, ' ').trim();

    if (cleaned.length <= MAX_CHUNK_LENGTH) {
      return [cleaned];
    }

    const chunks: string[] = [];
    let start = 0;

    while (start < cleaned.length) {
      let end = start + MAX_CHUNK_LENGTH;

      // Try to break at a sentence boundary
      if (end < cleaned.length) {
        const lastPeriod = cleaned.lastIndexOf('.', end);
        const lastNewline = cleaned.lastIndexOf('\n', end);
        const breakPoint = Math.max(lastPeriod, lastNewline);

        if (breakPoint > start + MAX_CHUNK_LENGTH / 2) {
          end = breakPoint + 1;
        }
      }

      chunks.push(cleaned.slice(start, end).trim());
      start = end - CHUNK_OVERLAP;
    }

    this.logger.log(
      `Split "${fileName}" into ${chunks.length} chunks (avg ${Math.round(cleaned.length / chunks.length)} chars)`,
    );

    return chunks;
  }
}
