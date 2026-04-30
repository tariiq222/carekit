import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';

/**
 * Phase 7 — atomic per-organization invoice number allocator.
 *
 * Number format: `INV-{YYYY}-{6-digit-zero-padded-seq}`. The sequence resets
 * at year boundaries via a composite `(organizationId, year)` row in
 * `OrganizationInvoiceCounter`. Allocation MUST run inside the same
 * `$transaction` as the invoice update so failures roll back the sequence
 * advance with the invoice.
 */
@Injectable()
export class InvoiceNumberingService {
  constructor(private readonly prisma: PrismaService) {}

  async allocate(
    organizationId: string,
    now: Date,
    tx?: Prisma.TransactionClient,
  ): Promise<string> {
    const client = tx ?? this.prisma;
    const year = now.getUTCFullYear();
    const counter = await client.organizationInvoiceCounter.upsert({
      where: { organizationId_year: { organizationId, year } },
      create: { organizationId, year, lastSequence: 1 },
      update: { lastSequence: { increment: 1 } },
    });
    const seq = String(counter.lastSequence).padStart(6, '0');
    return `INV-${year}-${seq}`;
  }
}
