import { PaymentMethod } from '@prisma/client';

export interface ProcessPaymentDto {
  tenantId: string;
  invoiceId: string;
  amount: number;
  method: PaymentMethod;
  gatewayRef?: string;
  idempotencyKey?: string;
}
