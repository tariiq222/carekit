import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import {
  parsePaginationParams,
  buildPaginationMeta,
} from '../../common/helpers/pagination.helper.js';
import { CreateGiftCardDto } from './dto/create-gift-card.dto.js';
import { UpdateGiftCardDto } from './dto/update-gift-card.dto.js';
import { GiftCardFilterDto } from './dto/gift-card-filter.dto.js';
import { AddCreditDto } from './dto/add-credit.dto.js';

@Injectable()
export class GiftCardsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: GiftCardFilterDto) {
    const { page, perPage, skip } = parsePaginationParams(
      query.page,
      query.perPage,
    );
    const now = new Date();
    const where = this.buildWhereClause(query, now);

    const [items, total] = await Promise.all([
      this.prisma.giftCard.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
      }),
      this.prisma.giftCard.count({ where }),
    ]);

    return {
      items,
      meta: buildPaginationMeta(total, page, perPage),
    };
  }

  async findById(id: string) {
    const card = await this.prisma.giftCard.findUnique({
      where: { id },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!card) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Gift card not found',
        error: 'NOT_FOUND',
      });
    }

    return card;
  }

  async create(dto: CreateGiftCardDto) {
    const code = dto.code?.toUpperCase() || generateGiftCardCode();

    const existing = await this.prisma.giftCard.findUnique({
      where: { code },
    });
    if (existing) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'A gift card with this code already exists',
        error: 'CODE_EXISTS',
      });
    }

    return this.prisma.giftCard.create({
      data: {
        code,
        initialAmount: dto.initialAmount,
        balance: dto.initialAmount,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(id: string, dto: UpdateGiftCardDto) {
    await this.findById(id);

    const data: Record<string, unknown> = {};
    if (dto.expiresAt !== undefined) data.expiresAt = new Date(dto.expiresAt);
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.purchasedBy !== undefined) data.purchasedBy = dto.purchasedBy;
    if (dto.redeemedBy !== undefined) data.redeemedBy = dto.redeemedBy;

    return this.prisma.giftCard.update({ where: { id }, data });
  }

  async deactivate(id: string) {
    await this.findById(id);
    await this.prisma.giftCard.update({
      where: { id },
      data: { isActive: false },
    });
    return { deactivated: true };
  }

  async checkBalance(
    code: string,
  ): Promise<{ balance: number; isValid: boolean }> {
    const card = await this.prisma.giftCard.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!card || !card.isActive) {
      return { balance: 0, isValid: false };
    }
    if (card.expiresAt && card.expiresAt < new Date()) {
      return { balance: 0, isValid: false };
    }

    return { balance: card.balance, isValid: true };
  }

  async redeemBalance(
    code: string,
    amount: number,
    bookingId?: string,
    userId?: string,
  ): Promise<{ deducted: number; remaining: number }> {
    return this.prisma.$transaction(async (tx) => {
      const card = await tx.giftCard.findUnique({
        where: { code: code.toUpperCase() },
      });

      if (!card || !card.isActive) {
        throw new BadRequestException('Gift card not found or inactive');
      }
      if (card.expiresAt && card.expiresAt < new Date()) {
        throw new BadRequestException('Gift card expired');
      }

      const deducted = Math.min(amount, card.balance);
      if (deducted <= 0) {
        throw new BadRequestException('Gift card has no balance');
      }

      await tx.giftCard.update({
        where: { id: card.id },
        data: {
          balance: { decrement: deducted },
          redeemedBy: userId ?? card.redeemedBy,
        },
      });

      await tx.giftCardTransaction.create({
        data: {
          giftCardId: card.id,
          amount: -deducted,
          bookingId,
          note: bookingId ? `Payment for booking ${bookingId}` : 'Redemption',
        },
      });

      return { deducted, remaining: card.balance - deducted };
    });
  }

  async addCredit(id: string, dto: AddCreditDto) {
    await this.findById(id);

    return this.prisma.$transaction(async (tx) => {
      await tx.giftCard.update({
        where: { id },
        data: { balance: { increment: dto.amount } },
      });

      await tx.giftCardTransaction.create({
        data: {
          giftCardId: id,
          amount: dto.amount,
          note: dto.note ?? 'Manual credit',
        },
      });

      return tx.giftCard.findUnique({ where: { id } });
    });
  }

  // ═══════════════════════════════════════════════════════════════
  //  PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════════════

  private buildWhereClause(
    query: GiftCardFilterDto,
    now: Date,
  ): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (query.search) {
      where.code = { contains: query.search, mode: 'insensitive' };
    }

    if (query.status === 'active') {
      where.isActive = true;
      where.balance = { gt: 0 };
      where.OR = [{ expiresAt: null }, { expiresAt: { gt: now } }];
    } else if (query.status === 'inactive') {
      where.isActive = false;
    } else if (query.status === 'expired') {
      where.expiresAt = { lte: now };
    } else if (query.status === 'depleted') {
      where.balance = 0;
      where.isActive = true;
    }

    return where;
  }
}

// ═══════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════

/** Generate a human-friendly gift card code (no ambiguous chars: I, O, 0, 1) */
function generateGiftCardCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'GC-';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
