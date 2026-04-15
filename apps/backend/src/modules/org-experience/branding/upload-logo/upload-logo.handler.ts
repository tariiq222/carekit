import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database';
import { UploadFileHandler } from '../../../media/files/upload-file.handler';

export const MAX_LOGO_BYTES = 2 * 1024 * 1024;
export const ALLOWED_LOGO_MIMETYPES: ReadonlySet<string> = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
]);

export type UploadLogoCommand = {
  tenantId: string;
  filename: string;
  mimetype: string;
  size: number;
};

@Injectable()
export class UploadLogoHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadFile: UploadFileHandler,
  ) {}

  async execute(cmd: UploadLogoCommand, buffer: Buffer): Promise<{ fileId: string; url: string }> {
    if (!ALLOWED_LOGO_MIMETYPES.has(cmd.mimetype)) {
      throw new BadRequestException(`Logo mimetype not allowed: ${cmd.mimetype}`);
    }
    if (cmd.size > MAX_LOGO_BYTES) {
      throw new BadRequestException(`Logo exceeds maximum size of ${MAX_LOGO_BYTES} bytes`);
    }

    const file = await this.uploadFile.execute(
      {
        tenantId: cmd.tenantId,
        filename: cmd.filename,
        mimetype: cmd.mimetype,
        size: cmd.size,
        ownerType: 'branding',
      },
      buffer,
    );

    await this.prisma.brandingConfig.upsert({
      where: { tenantId: cmd.tenantId },
      create: {
        tenantId: cmd.tenantId,
        clinicNameAr: 'Clinic',
        logoUrl: file.url,
      },
      update: { logoUrl: file.url },
    });

    return { fileId: file.id, url: file.url };
  }
}
