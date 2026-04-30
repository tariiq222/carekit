import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { SubscriptionInvoiceStatus } from '@prisma/client';

/**
 * Phase 7 — query DTO for the tenant invoice list endpoint. Status filter
 * accepts the existing 5-value enum (DRAFT | DUE | PAID | FAILED | VOID);
 * Phase 7 introduces no new statuses.
 */
export class ListInvoicesQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsEnum(SubscriptionInvoiceStatus)
  status?: SubscriptionInvoiceStatus;
}

export interface InvoiceListItemDto {
  id: string;
  /** null while DRAFT/DUE pre-issuance; non-null once issued. */
  invoiceNumber: string | null;
  status: SubscriptionInvoiceStatus;
  /** VAT-inclusive total, fixed-2 string. */
  amount: string;
  currency: string;
  periodStart: string;
  periodEnd: string;
  /** null = not yet issued. */
  issuedAt: string | null;
  paidAt: string | null;
}

export interface InvoiceDetailDto extends InvoiceListItemDto {
  invoiceHash: string | null;
  previousHash: string | null;
  pdfStorageKey: string | null;
}
