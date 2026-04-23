import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { toListResponse } from '../../../common/dto';
import { MembershipRole } from '@prisma/client';

export interface ListMembersQuery {
  page: number;
  limit: number;
  role?: MembershipRole;
  isActive?: boolean;
}

export interface MemberDto {
  id: string;
  userId: string;
  role: MembershipRole;
  isActive: boolean;
  acceptedAt: Date | null;
  createdAt: Date;
}

@Injectable()
export class ListMembersHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(query: ListMembersQuery) {
    const organizationId = this.tenant.requireOrganizationId();

    const where: Record<string, unknown> = {
      organizationId,
    };

    if (query.role) {
      where.role = query.role;
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    const [items, total] = await Promise.all([
      this.prisma.membership.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.membership.count({ where }),
    ]);

    return toListResponse(items as MemberDto[], total, query.page, query.limit);
  }
}