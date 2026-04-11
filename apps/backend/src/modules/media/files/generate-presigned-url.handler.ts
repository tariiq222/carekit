import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { MinioService } from '../../../infrastructure/storage/minio.service';
import type { GeneratePresignedUrlDto } from './generate-presigned-url.dto';

const DEFAULT_EXPIRY_SECONDS = 3600;

@Injectable()
export class GeneratePresignedUrlHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: MinioService,
  ) {}

  async execute(dto: GeneratePresignedUrlDto) {
    const file = await this.prisma.file.findFirst({
      where: { id: dto.fileId, tenantId: dto.tenantId, isDeleted: false },
    });
    if (!file) throw new NotFoundException('File not found');

    const expiry = dto.expirySeconds ?? DEFAULT_EXPIRY_SECONDS;
    const url = await this.storage.getSignedUrl(file.bucket, file.storageKey, expiry);

    return {
      fileId: file.id,
      url,
      expiresInSeconds: expiry,
      filename: file.filename,
      mimetype: file.mimetype,
    };
  }
}
