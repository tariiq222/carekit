import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';

@Injectable()
export class ListRolesHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute() {
    const organizationId = this.tenant.requireOrganizationIdOrDefault();
    return this.prisma.customRole.findMany({
      where: { organizationId },
      include: { permissions: true },
      orderBy: { createdAt: 'asc' },
    });
  }
}
