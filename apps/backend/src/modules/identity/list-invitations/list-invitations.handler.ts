import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { toListResponse } from '../../../common/dto';
import { InvitationStatus } from '@prisma/client';

export interface ListInvitationsQuery {
  page: number;
  limit: number;
}

export interface InvitationDto {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: Date;
  createdAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
}

@Injectable()
export class ListInvitationsHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(query: ListInvitationsQuery) {
    const organizationId = this.tenant.requireOrganizationId();

    const where: Record<string, unknown> = {
      organizationId,
      status: { in: [InvitationStatus.PENDING, InvitationStatus.EXPIRED] },
    };

    const [items, total] = await Promise.all([
      this.prisma.invitation.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.invitation.count({ where }),
    ]);

    return toListResponse(items as InvitationDto[], total, query.page, query.limit);
  }
}