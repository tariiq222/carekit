import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import type {
  ListMembershipsQuery,
  MembershipSummary,
} from './list-memberships.query';

/**
 * SaaS-06 — List all active organization memberships for the caller.
 *
 * Returns the rows the current user belongs to. `Membership` is a
 * platform-level model (not tenant-scoped), so we can filter directly by
 * `userId` without the TenantContext escape hatch.
 */
@Injectable()
export class ListMembershipsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: ListMembershipsQuery): Promise<MembershipSummary[]> {
    const rows = await this.prisma.membership.findMany({
      where: { userId: query.userId, isActive: true },
      include: {
        organization: {
          select: {
            id: true,
            slug: true,
            nameAr: true,
            nameEn: true,
            status: true,
          },
        },
      },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    });

    return rows.map((r) => ({
      id: r.id,
      organizationId: r.organizationId,
      role: r.role,
      isActive: r.isActive,
      organization: {
        id: r.organization.id,
        slug: r.organization.slug,
        nameAr: r.organization.nameAr,
        nameEn: r.organization.nameEn,
        status: r.organization.status,
      },
    }));
  }
}
