import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';

export interface GetInvoiceQuery {
  invoiceId: string;
}

@Injectable()
export class GetInvoiceHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(query: GetInvoiceQuery) {
    const organizationId = this.tenant.requireOrganizationId();
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: query.invoiceId, organizationId },
      include: {
        payments: { where: { organizationId }, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!invoice) {
      throw new NotFoundException(`Invoice ${query.invoiceId} not found`);
    }
    return invoice;
  }
}
