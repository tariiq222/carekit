import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PaymentMethod, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { MinioService } from '../../../infrastructure/storage/minio.service';

const RECEIPTS_BUCKET = 'finance-receipts';
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

export interface BankTransferUploadCommand {
  tenantId: string;
  invoiceId: string;
  clientId: string;
  amount: number;
  fileBuffer: Buffer;
  mimetype: string;
  filename: string;
}

@Injectable()
export class BankTransferUploadHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: MinioService,
  ) {}

  async execute(cmd: BankTransferUploadCommand) {
    if (!ALLOWED_MIME_TYPES.includes(cmd.mimetype)) {
      throw new BadRequestException(`File type ${cmd.mimetype} not allowed. Use JPEG, PNG, WebP, or PDF.`);
    }

    const invoice = await this.prisma.invoice.findUnique({ where: { id: cmd.invoiceId } });
    if (!invoice || invoice.tenantId !== cmd.tenantId) {
      throw new NotFoundException(`Invoice ${cmd.invoiceId} not found`);
    }

    const ext = cmd.filename.split('.').pop() ?? 'bin';
    const key = `${cmd.tenantId}/${cmd.invoiceId}/${Date.now()}.${ext}`;

    const receiptUrl = await this.storage.uploadFile(RECEIPTS_BUCKET, key, cmd.fileBuffer, cmd.mimetype);

    const payment = await this.prisma.payment.create({
      data: {
        tenantId: cmd.tenantId,
        invoiceId: cmd.invoiceId,
        amount: cmd.amount,
        currency: invoice.currency,
        method: PaymentMethod.BANK_TRANSFER,
        status: PaymentStatus.PENDING_VERIFICATION,
        receiptUrl,
      },
    });

    return payment;
  }
}
