import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import type { GetCurrentUserQuery } from './get-current-user.query';

@Injectable()
export class GetCurrentUserHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetCurrentUserQuery) {
    const user = await this.prisma.user.findUnique({
      where: { id: query.userId },
      include: { customRole: { include: { permissions: true } } },
      omit: { passwordHash: true },
    });
    if (!user) throw new NotFoundException('User not found');

    // Resolve active membership so /auth/me carries organizationId without
    // forcing the caller to decode the JWT. Same ordering as LoginHandler.
    // Also expose the org's vertical slug so client UIs (dashboard, mobile)
    // can drive useTerminology() without a second round-trip.
    const membership = await this.prisma.membership.findFirst({
      where: { userId: user.id, isActive: true },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        organizationId: true,
        role: true,
        organization: { select: { vertical: { select: { slug: true } } } },
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName ?? '',
        lastName: user.lastName ?? '',
        phoneVerifiedAt: user.phoneVerifiedAt,
        emailVerifiedAt: user.emailVerifiedAt,
        isActive: user.isActive,
        role: user.role,
        avatarUrl: user.avatarUrl,
        gender: user.gender,
        customRole: user.customRole,
        permissions: user.customRole?.permissions ?? [],
      },
      activeMembership: membership
        ? {
            id: membership.id,
            organizationId: membership.organizationId,
            role: membership.role,
            verticalSlug: membership.organization?.vertical?.slug ?? null,
          }
        : null,
    };
  }
}
