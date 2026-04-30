import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../../../common/tenant/tenant-context.service';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';

@Injectable()
export class ListSavedCardsHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute() {
    const organizationId = this.tenant.requireOrganizationId();
    return this.prisma.savedCard.findMany({
      where: { organizationId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        brand: true,
        last4: true,
        expiryMonth: true,
        expiryYear: true,
        holderName: true,
        isDefault: true,
        createdAt: true,
      },
    });
  }
}
