import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { TenantContextService } from '../../../../common/tenant/tenant-context.service';
import type { InvoiceDetailDto } from '../dto/invoice.dto';

/**
 * Phase 7 — fetch a single invoice by id, scoped to the current tenant.
 * Returns 404 (not 403) for cross-org access.
 */
@Injectable()
export class GetInvoiceHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(invoiceId: string): Promise<InvoiceDetailDto> {
    const organizationId = this.tenant.requireOrganizationId();
    const row = await this.prisma.subscriptionInvoice.findFirst({
      where: { id: invoiceId, organizationId },
    });
    if (!row) throw new NotFoundException();

    return {
      id: row.id,
      invoiceNumber: row.invoiceNumber,
      status: row.status,
      amount: row.amount.toFixed(2),
      currency: row.currency,
      periodStart: row.periodStart.toISOString(),
      periodEnd: row.periodEnd.toISOString(),
      issuedAt: row.issuedAt ? row.issuedAt.toISOString() : null,
      paidAt: row.paidAt ? row.paidAt.toISOString() : null,
      invoiceHash: row.invoiceHash,
      previousHash: row.previousHash,
      pdfStorageKey: row.pdfStorageKey,
    };
  }
}
