import { Injectable } from '@nestjs/common';
import { MembershipRole } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';

export interface StaffTarget {
  userId: string;
  role: string;
}

export interface GetStaffTargetsQuery {
  organizationId: string;
  roles: MembershipRole[];
  /** If provided, include this specific userId regardless of role (for assigned employee) */
  includeUserId?: string;
}

@Injectable()
export class GetStaffTargetsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetStaffTargetsQuery): Promise<StaffTarget[]> {
    const memberships = await this.prisma.membership.findMany({
      where: {
        organizationId: query.organizationId,
        role: { in: query.roles },
      },
      select: { userId: true, role: true },
    });

    const targets: StaffTarget[] = memberships.map((m) => ({
      userId: m.userId,
      role: m.role,
    }));

    // Add the specifically assigned user if not already in list
    if (query.includeUserId) {
      const alreadyIncluded = targets.some((t) => t.userId === query.includeUserId);
      if (!alreadyIncluded) {
        targets.push({ userId: query.includeUserId, role: 'EMPLOYEE' });
      }
    }

    return targets;
  }
}
