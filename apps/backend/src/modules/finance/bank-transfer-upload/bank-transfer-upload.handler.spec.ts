import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PaymentMethod, PaymentStatus } from '@prisma/client';
import { BankTransferUploadHandler } from './bank-transfer-upload.handler';

const mockInvoice = {
  id: 'inv-1',
  total: 230,
  currency: 'SAR',
};

const mockPayment = {
  id: 'pay-1',
  method: PaymentMethod.BANK_TRANSFER,
  status: PaymentStatus.PENDING_VERIFICATION,
  receiptUrl: 'http://minio/bucket/path.jpg',
};

const buildPrisma = () => ({
  invoice: { findFirst: jest.fn().mockResolvedValue(mockInvoice) },
  payment: { create: jest.fn().mockResolvedValue(mockPayment) },
});

const buildStorage = () => ({
  uploadFile: jest.fn().mockResolvedValue('http://minio/bucket/path.jpg'),
});

const cmd = {
  invoiceId: 'inv-1',
  clientId: 'client-1',
  amount: 230,
  fileBuffer: Buffer.from('fake-image'),
  mimetype: 'image/jpeg',
  filename: 'receipt.jpg',
};

describe('BankTransferUploadHandler', () => {
  it('uploads receipt and creates PENDING_VERIFICATION payment', async () => {
    const prisma = buildPrisma();
    const storage = buildStorage();
    const handler = new BankTransferUploadHandler(prisma as never, storage as never);

    const result = await handler.execute(cmd);

    expect(storage.uploadFile).toHaveBeenCalledWith(
      'finance-receipts',
      expect.stringContaining('inv-1/'),
      cmd.fileBuffer,
      'image/jpeg',
    );
    expect(prisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: PaymentStatus.PENDING_VERIFICATION,
          method: PaymentMethod.BANK_TRANSFER,
          receiptUrl: 'http://minio/bucket/path.jpg',
        }),
      }),
    );
    expect(result.id).toBe('pay-1');
  });

  it('throws BadRequestException for disallowed mime type', async () => {
    const handler = new BankTransferUploadHandler(buildPrisma() as never, buildStorage() as never);
    await expect(handler.execute({ ...cmd, mimetype: 'text/html' })).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException when invoice not found', async () => {
    const prisma = buildPrisma();
    prisma.invoice.findFirst = jest.fn().mockResolvedValue(null);
    const handler = new BankTransferUploadHandler(prisma as never, buildStorage() as never);
    await expect(handler.execute(cmd)).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when invoice not found by id', async () => {
    const prisma = buildPrisma();
    prisma.invoice.findFirst = jest.fn().mockResolvedValue(null);
    const handler = new BankTransferUploadHandler(prisma as never, buildStorage() as never);
    await expect(handler.execute({ ...cmd, invoiceId: 'bad-id' })).rejects.toThrow(NotFoundException);
  });
});
