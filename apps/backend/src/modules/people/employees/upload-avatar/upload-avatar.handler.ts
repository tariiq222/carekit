import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../infrastructure/database';
import { UploadFileHandler } from '../../../media/files/upload-file.handler';

export const MAX_AVATAR_BYTES = 1 * 1024 * 1024;
export const ALLOWED_AVATAR_MIMETYPES: ReadonlySet<string> = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
]);

export type UploadAvatarCommand = {
  tenantId: string;
  employeeId: string;
  filename: string;
  mimetype: string;
  size: number;
};

@Injectable()
export class UploadAvatarHandler {
  private readonly publicBase: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadFile: UploadFileHandler,
    config: ConfigService,
  ) {
    this.publicBase = config.getOrThrow<string>('MINIO_PUBLIC_URL');
  }

  async execute(
    cmd: UploadAvatarCommand,
    buffer: Buffer,
  ): Promise<{ fileId: string; url: string }> {
    if (!ALLOWED_AVATAR_MIMETYPES.has(cmd.mimetype)) {
      throw new BadRequestException(`Avatar mimetype not allowed: ${cmd.mimetype}`);
    }
    if (cmd.size > MAX_AVATAR_BYTES) {
      throw new BadRequestException(
        `Avatar exceeds maximum size of ${MAX_AVATAR_BYTES} bytes`,
      );
    }

    const employee = await this.prisma.employee.findUnique({
      where: { id: cmd.employeeId },
      select: { id: true, tenantId: true },
    });
    if (!employee || employee.tenantId !== cmd.tenantId) {
      throw new NotFoundException(`Employee ${cmd.employeeId} not found`);
    }

    const file = await this.uploadFile.execute(
      {
        tenantId: cmd.tenantId,
        filename: cmd.filename,
        mimetype: cmd.mimetype,
        size: cmd.size,
        ownerType: 'employee',
        ownerId: cmd.employeeId,
      },
      buffer,
    );

    const url = `${this.publicBase}/${file.bucket}/${file.storageKey}`;

    await this.prisma.employee.update({
      where: { id: cmd.employeeId, tenantId: cmd.tenantId },
      data: { avatarUrl: url },
    });

    return { fileId: file.id, url };
  }
}
