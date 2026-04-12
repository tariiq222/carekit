import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { FileVisibility } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { MinioService } from '../../../infrastructure/storage/minio.service';
import { UploadFileDto } from './upload-file.dto';

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

export const ALLOWED_MIME_TYPES: ReadonlySet<string> = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
]);

export type UploadFileCommand = UploadFileDto & {
  tenantId: string;
  filename: string;
  mimetype: string;
  size: number;
};

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

  async execute(cmd: UploadFileCommand, buffer: Buffer) {
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('Empty file buffer');
    }
    if (buffer.length !== cmd.size) {
      throw new BadRequestException('Declared size does not match buffer length');
    }
    if (buffer.length > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException(`File exceeds maximum size of ${MAX_FILE_SIZE_BYTES} bytes`);
    }
    if (!ALLOWED_MIME_TYPES.has(cmd.mimetype)) {
      throw new BadRequestException(`Mime type not allowed: ${cmd.mimetype}`);
    }

    const ext = extname(cmd.filename).toLowerCase();
    const storageKey = `${cmd.tenantId}/${randomUUID()}${ext}`;

    await this.storage.uploadFile(this.defaultBucket, storageKey, buffer, cmd.mimetype);

    return this.prisma.file.create({
      data: {
        tenantId: cmd.tenantId,
        bucket: this.defaultBucket,
        storageKey,
        filename: cmd.filename,
        mimetype: cmd.mimetype,
        size: cmd.size,
        visibility: cmd.visibility ?? FileVisibility.PRIVATE,
        ownerType: cmd.ownerType,
        ownerId: cmd.ownerId,
        uploadedBy: cmd.uploadedBy,
      },
    });
  }
}
