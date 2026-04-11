import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface RedeemGiftCardCommand {
  tenantId: string;
  invoiceId: string;
  clientId: string;
  code: string;
  amount: number;
}

@Injectable()
export class RedeemGiftCardHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: RedeemGiftCardCommand) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id: cmd.invoiceId } });
    if (!invoice || invoice.tenantId !== cmd.tenantId) {
      throw new NotFoundException(`Invoice ${cmd.invoiceId} not found`);
    }

    const giftCard = await this.prisma.giftCard.findUnique({
      where: { tenantId_code: { tenantId: cmd.tenantId, code: cmd.code } },
    });
    if (!giftCard || !giftCard.isActive) throw new NotFoundException(`Gift card ${cmd.code} not found`);
    if (giftCard.expiresAt && giftCard.expiresAt < new Date()) {
      throw new BadRequestException(`Gift card ${cmd.code} has expired`);
    }
    if (Number(giftCard.balance) <= 0) {
      throw new BadRequestException(`Gift card ${cmd.code} has no remaining balance`);
    }

    const redeemAmount = Math.min(cmd.amount, Number(giftCard.balance), Number(invoice.total));
    if (redeemAmount <= 0) throw new BadRequestException('Redemption amount must be greater than zero');

    const newBalance = parseFloat((Number(giftCard.balance) - redeemAmount).toFixed(2));

    const [redemption] = await this.prisma.$transaction([
      this.prisma.giftCardRedemption.create({
        data: {
          tenantId: cmd.tenantId,
          giftCardId: giftCard.id,
          invoiceId: cmd.invoiceId,
          clientId: cmd.clientId,
          amount: redeemAmount,
        },
      }),
      this.prisma.giftCard.update({
        where: { id: giftCard.id },
        data: { balance: newBalance, isActive: newBalance > 0 },
      }),
      this.prisma.payment.create({
        data: {
          tenantId: cmd.tenantId,
          invoiceId: cmd.invoiceId,
          amount: redeemAmount,
          currency: giftCard.currency,
          method: 'GIFT_CARD',
          status: 'COMPLETED',
          processedAt: new Date(),
        },
      }),
    ]);

    return redemption;
  }
}
