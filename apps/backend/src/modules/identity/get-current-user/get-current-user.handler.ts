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
    // forcing the caller to decode the JWT. Prefer lastActiveOrganizationId
    // when it still maps to an active membership; otherwise fall back to the
    // canonical ordering (role asc → createdAt asc) shared with LoginHandler.
    const activeMemberships = await this.prisma.membership.findMany({
      where: { userId: user.id, isActive: true },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        organizationId: true,
        role: true,
        displayName: true,
        jobTitle: true,
        avatarUrl: true,
        organization: {
          select: {
            onboardingCompletedAt: true,
            vertical: { select: { slug: true } },
          },
        },
      },
    });

    const sticky =
      user.lastActiveOrganizationId
        ? activeMemberships.find((m) => m.organizationId === user.lastActiveOrganizationId) ?? null
        : null;
    const membership = sticky ?? activeMemberships[0] ?? null;

    const [fallbackFirstName = '', ...fallbackRest] = (user.name ?? '').trim().split(/\s+/);
    const firstName = user.firstName ?? fallbackFirstName;
    const lastName = user.lastName ?? fallbackRest.join(' ');

    return {
      ...user,
      firstName,
      lastName,
      organizationId: membership?.organizationId ?? null,
      verticalSlug: membership?.organization?.vertical?.slug ?? null,
      onboardingCompletedAt: membership?.organization?.onboardingCompletedAt ?? null,
      activeMembership: membership
        ? {
            id: membership.id,
            organizationId: membership.organizationId,
            role: membership.role,
            verticalSlug: membership.organization?.vertical?.slug ?? null,
            displayName: membership.displayName ?? null,
            jobTitle: membership.jobTitle ?? null,
            avatarUrl: membership.avatarUrl ?? null,
          }
        : null,
    };
  }
}
