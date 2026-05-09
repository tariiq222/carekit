import { InvoiceStatus, PaymentStatus } from '@prisma/client';

export interface MockedPayment {
  id: string;
  amount: number | bigint;
  gatewayRef: string | null;
  status: PaymentStatus;
  invoiceId: string;
  invoice?: {
    id: string;
    bookingId: string;
    clientId: string;
    currency: string;
    organizationId: string;
  };
  organizationId?: string;
  failureReason?: string | null;
  processedAt?: Date | null;
}

export interface MockedInvoice {
  id: string;
  total: number | bigint;
  currency: string;
  bookingId: string;
  status?: InvoiceStatus;
  clientId?: string;
  organizationId?: string;
}

export interface MockedRefundRequest {
  id?: string;
  paymentId: string;
  invoiceId?: string;
  clientId?: string;
  organizationId?: string;
  amount?: number | bigint;
  status?: string;
}

export interface PaymentAggregateResult {
  _sum: { amount: number | bigint | null };
}

export interface PrismaMock {
  payment: {
    findFirst: jest.Mock;
    findFirstOrThrow: jest.Mock;
    update: jest.Mock;
    create: jest.Mock;
    aggregate: jest.Mock;
  };
  invoice: {
    findFirst: jest.Mock;
    findFirstOrThrow: jest.Mock;
    update: jest.Mock;
    create: jest.Mock;
  };
  refundRequest: {
    create: jest.Mock;
    update: jest.Mock;
    findFirst: jest.Mock;
  };
  $transaction: jest.Mock;
  [key: string]: unknown;
}

export function createPrismaMock(): PrismaMock {
  return {
    payment: {
      findFirst: jest.fn(),
      findFirstOrThrow: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      aggregate: jest.fn(),
    },
    invoice: {
      findFirst: jest.fn(),
      findFirstOrThrow: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    refundRequest: {
      create: jest.fn().mockResolvedValue({ id: 'rr-1' }),
      update: jest.fn().mockResolvedValue({ id: 'rr-1' }),
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  };
}

export function setupPaymentMock(
  prisma: PrismaMock,
  payment: MockedPayment,
) {
  prisma.payment.findFirst.mockResolvedValue(payment);
}

export function setupInvoiceMock(
  prisma: PrismaMock,
  invoice: MockedInvoice,
) {
  prisma.invoice.findFirst.mockResolvedValue(invoice);
}

export function setupPaymentUpdateMock(
  prisma: PrismaMock,
  updatedPayment: Partial<MockedPayment> & { id: string },
) {
  prisma.payment.update.mockResolvedValue(updatedPayment);
}

export function setupInvoiceUpdateMock(
  prisma: PrismaMock,
  updatedInvoice: Partial<MockedInvoice> & { id: string },
) {
  prisma.invoice.update.mockResolvedValue(updatedInvoice);
}

export function setupTransactionMock(
  prisma: PrismaMock,
  result?: unknown,
) {
  prisma.$transaction.mockImplementation(async (fn: (tx: PrismaMock) => unknown) => {
    return fn(prisma);
  });
}

export function setupPaymentAggregateMock(
  prisma: PrismaMock,
  result: PaymentAggregateResult,
) {
  prisma.payment.aggregate.mockResolvedValue(result);
}

export function setupRefundRequestMocks(
  prisma: PrismaMock,
  createResult?: Partial<MockedRefundRequest>,
  updateResult?: Partial<MockedRefundRequest>,
) {
  prisma.refundRequest.create.mockResolvedValue({ id: 'rr-1', ...createResult });
  prisma.refundRequest.update.mockResolvedValue({ id: 'rr-1', ...updateResult });
}
