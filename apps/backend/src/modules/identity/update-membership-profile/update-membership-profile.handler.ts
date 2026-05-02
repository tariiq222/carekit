import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import type { UpdateMembershipProfileCommand } from './update-membership-profile.command';

export interface UpdateMembershipProfileResult {
  id: string;
  userId: string;
  organizationId: string;
  role: string;
  isActive: boolean;
  displayName: string | null;
  jobTitle: string | null;
  avatarUrl: string | null;
  acceptedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Update the per-org display profile (displayName / jobTitle / avatarUrl)
 * for the caller's own Membership. The caller may only edit their own
 * memberships; cross-user edits are blocked here regardless of role.
 *
 * Membership is a platform-level model (not tenant-scoped via SCOPED_MODELS),
 * so we filter explicitly by both id and userId — this is also the
 * authorization gate.
 */
@Injectable()
export class UpdateMembershipProfileHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: UpdateMembershipProfileCommand): Promise<UpdateMembershipProfileResult> {
    const existing = await this.prisma.membership.findUnique({
      where: { id: cmd.membershipId },
      select: { id: true, userId: true, isActive: true },
    });
    if (!existing) throw new NotFoundException('Membership not found');
    if (existing.userId !== cmd.userId) {
      throw new ForbiddenException('Cannot edit another user’s membership profile');
    }
    if (!existing.isActive) {
      throw new ForbiddenException('Cannot edit an inactive membership');
    }

    const data: { displayName?: string | null; jobTitle?: string | null; avatarUrl?: string | null } = {};
    if (cmd.displayName !== undefined) data.displayName = cmd.displayName ?? null;
    if (cmd.jobTitle !== undefined) data.jobTitle = cmd.jobTitle ?? null;
    if (cmd.avatarUrl !== undefined) data.avatarUrl = cmd.avatarUrl ?? null;

    const updated = await this.prisma.membership.update({
      where: { id: cmd.membershipId },
      data,
    });

    return {
      id: updated.id,
      userId: updated.userId,
      organizationId: updated.organizationId,
      role: updated.role,
      isActive: updated.isActive,
      displayName: updated.displayName,
      jobTitle: updated.jobTitle,
      avatarUrl: updated.avatarUrl,
      acceptedAt: updated.acceptedAt,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }
}
