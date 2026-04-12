import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { RedeemGiftCardDto } from './redeem-gift-card.dto';

export type RedeemGiftCardCommand = RedeemGiftCardDto & { tenantId: string };

@Injectable()
export class RedeemGiftCardHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: RedeemGiftCardCommand) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: cmd.invoiceId, tenantId: cmd.tenantId },
    });
    if (!invoice) {
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

    return this.prisma.$transaction(async (tx) => {
      // Atomic guard: decrement balance only if sufficient funds remain.
      // updateMany with WHERE balance >= redeemAmount prevents concurrent overdraft.
      const { count } = await tx.giftCard.updateMany({
        where: { id: giftCard.id, balance: { gte: redeemAmount } },
        data: { balance: { decrement: redeemAmount } },
      });
      if (count === 0) {
        throw new BadRequestException(`Gift card ${cmd.code} has insufficient balance`);
      }

      // Deactivate card if balance hit zero
      const updated = await tx.giftCard.findUnique({ where: { id: giftCard.id }, select: { balance: true } });
      if (updated && Number(updated.balance) === 0) {
        await tx.giftCard.update({ where: { id: giftCard.id }, data: { isActive: false } });
      }

      const redemption = await tx.giftCardRedemption.create({
        data: {
          tenantId: cmd.tenantId,
          giftCardId: giftCard.id,
          invoiceId: cmd.invoiceId,
          clientId: cmd.clientId,
          amount: redeemAmount,
        },
      });

      await tx.payment.create({
        data: {
          tenantId: cmd.tenantId,
          invoiceId: cmd.invoiceId,
          amount: redeemAmount,
          currency: giftCard.currency,
          method: 'GIFT_CARD',
          status: 'COMPLETED',
          processedAt: new Date(),
        },
      });

      return redemption;
    });
  }
}
