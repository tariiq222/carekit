import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { extname } from 'node:path';
import { PrismaService } from '../../../infrastructure/database';
import { MinioService } from '../../../infrastructure/storage/minio.service';

const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR_MIMES: ReadonlySet<string> = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export interface UploadMembershipAvatarCommand {
  /** Caller user id (from JWT). Authorization: must own the membership. */
  userId: string;
  membershipId: string;
  filename: string;
  mimetype: string;
  buffer: Buffer;
}

export interface UploadMembershipAvatarResult {
  membershipId: string;
  avatarUrl: string;
}

/**
 * Per-membership avatar upload.
 *
 * Storage key convention:
 *   memberships/{membershipId}/avatar-{timestamp}.{ext}
 *
 * Deleting a Membership does NOT delete the underlying object (audit trail).
 * The previous avatar object (if any) is intentionally retained — Membership
 * cleanup is a separate offline concern.
 */
@Injectable()
export class UploadMembershipAvatarHandler {
  private readonly bucket: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: MinioService,
    config: ConfigService,
  ) {
    this.bucket = config.getOrThrow<string>('MINIO_BUCKET');
  }

  async execute(cmd: UploadMembershipAvatarCommand): Promise<UploadMembershipAvatarResult> {
    if (!cmd.buffer || cmd.buffer.length === 0) {
      throw new BadRequestException('Empty file buffer');
    }
    if (cmd.buffer.length > MAX_AVATAR_SIZE_BYTES) {
      throw new BadRequestException(`Avatar exceeds maximum size of ${MAX_AVATAR_SIZE_BYTES} bytes`);
    }
    if (!ALLOWED_AVATAR_MIMES.has(cmd.mimetype)) {
      throw new BadRequestException(`Mime type not allowed for avatar: ${cmd.mimetype}`);
    }

    const membership = await this.prisma.membership.findUnique({
      where: { id: cmd.membershipId },
      select: { id: true, userId: true, isActive: true },
    });
    if (!membership) throw new NotFoundException('Membership not found');
    if (membership.userId !== cmd.userId) {
      throw new ForbiddenException('Cannot upload avatar for another user’s membership');
    }
    if (!membership.isActive) {
      throw new ForbiddenException('Cannot upload avatar to an inactive membership');
    }

    const ext = (extname(cmd.filename) || '.jpg').toLowerCase();
    const storageKey = `memberships/${cmd.membershipId}/avatar-${Date.now()}${ext}`;

    const url = await this.storage.uploadFile(this.bucket, storageKey, cmd.buffer, cmd.mimetype);

    await this.prisma.membership.update({
      where: { id: cmd.membershipId },
      data: { avatarUrl: url },
    });

    return { membershipId: cmd.membershipId, avatarUrl: url };
  }
}
