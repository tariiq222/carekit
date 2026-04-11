import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { MinioService } from '../../common/services/minio.service.js';
import { CacheService } from '../../common/services/cache.service.js';
import { CACHE_KEYS } from '../../config/constants.js';

@Injectable()
export class ServicesAvatarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly minio: MinioService,
    private readonly cache: CacheService,
  ) {}

  async uploadAvatar(id: string, file: Express.Multer.File) {
    const service = await this.prisma.service.findFirst({
      where: { id, deletedAt: null },
    });
    if (!service) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Service not found',
        error: 'NOT_FOUND',
      });
    }

    // Delete old avatar from MinIO if present
    if (service.imageUrl) {
      try {
        const url = new URL(service.imageUrl);
        const objectName = url.pathname.replace(/^\/carekit\//, '');
        await this.minio.deleteFile('carekit', objectName);
      } catch {
        // Non-fatal — stale object is acceptable, upload must proceed
      }
    }

    const mimeToExt: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    };
    const ext = mimeToExt[file.mimetype] ?? 'jpg';
    const objectName = `services/${id}/avatar-${Date.now()}.${ext}`;
    const imageUrl = await this.minio.uploadFile(
      'carekit',
      objectName,
      file.buffer,
      file.mimetype,
    );

    const updated = await this.prisma.service.update({
      where: { id },
      data: { imageUrl, iconName: null, iconBgColor: null },
      include: { category: true },
    });

    await this.cache.del(CACHE_KEYS.SERVICES_ACTIVE);
    return updated;
  }
}
