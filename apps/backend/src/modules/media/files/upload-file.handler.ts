import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { PrismaService } from '../../../infrastructure/database';
import { MinioService } from '../../../infrastructure/storage/minio.service';
import type { UploadFileDto } from './upload-file.dto';

const MAX_SIZE_BYTES = 25 * 1024 * 1024;

@Injectable()
export class UploadFileHandler {
  private readonly defaultBucket: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: MinioService,
    config: ConfigService,
  ) {
    this.defaultBucket = config.getOrThrow<string>('MINIO_BUCKET');
  }

  async execute(dto: UploadFileDto, buffer: Buffer) {
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('Empty file buffer');
    }
    if (buffer.length !== dto.size) {
      throw new BadRequestException('Declared size does not match buffer length');
    }
    if (buffer.length > MAX_SIZE_BYTES) {
      throw new BadRequestException(`File exceeds maximum size of ${MAX_SIZE_BYTES} bytes`);
    }

    const bucket = dto.bucket ?? this.defaultBucket;
    const ext = extname(dto.filename).toLowerCase();
    const storageKey = `${dto.tenantId}/${randomUUID()}${ext}`;

    await this.storage.uploadFile(bucket, storageKey, buffer, dto.mimetype);

    return this.prisma.file.create({
      data: {
        tenantId: dto.tenantId,
        bucket,
        storageKey,
        filename: dto.filename,
        mimetype: dto.mimetype,
        size: dto.size,
        visibility: dto.visibility,
        ownerType: dto.ownerType,
        ownerId: dto.ownerId,
        uploadedBy: dto.uploadedBy,
      },
    });
  }
}
