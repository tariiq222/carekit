import { Injectable } from '@nestjs/common';
import type { SubscriptionInvoice } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { TenantContextService } from '../../../../common/tenant/tenant-context.service';
import {
  type InvoiceListItemDto,
  type ListInvoicesQueryDto,
} from '../dto/invoice.dto';

function toListItem(row: SubscriptionInvoice): InvoiceListItemDto {
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
  };
}

/**
 * Phase 7 — list invoices for the current tenant.
 *
 * `SubscriptionInvoice` is intentionally NOT in `SCOPED_MODELS`, so the
 * `where: { organizationId }` filter is mandatory and explicit. Cross-org
 * isolation is verified by `tenant-billing-invoices.e2e-spec.ts`.
 */
@Injectable()
export class ListInvoicesHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(
    query: ListInvoicesQueryDto,
  ): Promise<{ items: InvoiceListItemDto[]; nextCursor: string | null }> {
    const organizationId = this.tenant.requireOrganizationId();
    const limit = query.limit ?? 20;

    const items = await this.prisma.subscriptionInvoice.findMany({
      where: {
        organizationId,
        ...(query.status ? { status: query.status } : {}),
      },
      orderBy: [{ issuedAt: 'desc' }, { createdAt: 'desc' }],
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });

    const hasMore = items.length > limit;
    const sliced = items.slice(0, limit);
    return {
      items: sliced.map(toListItem),
      nextCursor: hasMore ? sliced[sliced.length - 1].id : null,
    };
  }
}
