import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GiftCardsService } from '../gift-cards.service.js';
import { PrismaService } from '../../../database/prisma.service.js';

const mockTx = {
  giftCard: { findUnique: jest.fn(), update: jest.fn() },
  giftCardTransaction: { create: jest.fn() },
};

const mockPrisma = {
  giftCard: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  $transaction: jest.fn((fn) => fn(mockTx)),
};

const baseCard = {
  id: 'gc-uuid-1',
  code: 'GC-ABCD1234',
  initialAmount: 100,
  balance: 100,
  isActive: true,
  expiresAt: null,
  purchasedBy: null,
  redeemedBy: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

describe('GiftCardsService', () => {
  let service: GiftCardsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GiftCardsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<GiftCardsService>(GiftCardsService);
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // findById
  // ─────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('should throw NotFoundException when gift card not found', async () => {
      mockPrisma.giftCard.findUnique.mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // create
  // ─────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should auto-generate code with GC- prefix when not provided', async () => {
      mockPrisma.giftCard.findUnique.mockResolvedValue(null);
      mockPrisma.giftCard.create.mockResolvedValue(baseCard);

      await service.create({ initialAmount: 100 } as never);

      const createCall = mockPrisma.giftCard.create.mock.calls[0][0];
      expect(createCall.data.code).toMatch(/^GC-/);
    });

    it('should use provided code (uppercased)', async () => {
      mockPrisma.giftCard.findUnique.mockResolvedValue(null);
      mockPrisma.giftCard.create.mockResolvedValue({
        ...baseCard,
        code: 'CUSTOM-CODE',
      });

      await service.create({ code: 'custom-code', initialAmount: 100 } as never);

      const createCall = mockPrisma.giftCard.create.mock.calls[0][0];
      expect(createCall.data.code).toBe('CUSTOM-CODE');
    });

    it('should throw BadRequestException when code already exists', async () => {
      mockPrisma.giftCard.findUnique.mockResolvedValue(baseCard);

      await expect(
        service.create({ code: 'GC-ABCD1234', initialAmount: 100 } as never),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // checkBalance
  // ─────────────────────────────────────────────────────────────

  describe('checkBalance', () => {
    it('should return {balance, isValid: true} for valid active card', async () => {
      mockPrisma.giftCard.findUnique.mockResolvedValue(baseCard);

      const result = await service.checkBalance('GC-ABCD1234');

      expect(result).toEqual({ balance: 100, isValid: true });
    });

    it('should return {balance: 0, isValid: false} when card not found', async () => {
      mockPrisma.giftCard.findUnique.mockResolvedValue(null);

      const result = await service.checkBalance('GC-NOTFOUND');

      expect(result).toEqual({ balance: 0, isValid: false });
    });

    it('should return {balance: 0, isValid: false} when card is inactive', async () => {
      mockPrisma.giftCard.findUnique.mockResolvedValue({
        ...baseCard,
        isActive: false,
      });

      const result = await service.checkBalance('GC-ABCD1234');

      expect(result).toEqual({ balance: 0, isValid: false });
    });

    it('should return {balance: 0, isValid: false} when card is expired', async () => {
      mockPrisma.giftCard.findUnique.mockResolvedValue({
        ...baseCard,
        expiresAt: new Date('2020-01-01'),
      });

      const result = await service.checkBalance('GC-ABCD1234');

      expect(result).toEqual({ balance: 0, isValid: false });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // redeemBalance
  // ─────────────────────────────────────────────────────────────

  describe('redeemBalance', () => {
    it('should deduct balance and create transaction record', async () => {
      mockTx.giftCard.findUnique.mockResolvedValue(baseCard);
      mockTx.giftCard.update.mockResolvedValue({ ...baseCard, balance: 50 });
      mockTx.giftCardTransaction.create.mockResolvedValue({});

      const result = await service.redeemBalance('GC-ABCD1234', 50, 'booking-1', 'user-1');

      expect(result).toEqual({ deducted: 50, remaining: 50 });
      expect(mockTx.giftCard.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ balance: { decrement: 50 } }),
        }),
      );
      expect(mockTx.giftCardTransaction.create).toHaveBeenCalled();
    });

    it('should deduct only available balance when amount exceeds balance (partial redemption)', async () => {
      mockTx.giftCard.findUnique.mockResolvedValue({
        ...baseCard,
        balance: 30,
      });
      mockTx.giftCard.update.mockResolvedValue({ ...baseCard, balance: 0 });
      mockTx.giftCardTransaction.create.mockResolvedValue({});

      const result = await service.redeemBalance('GC-ABCD1234', 100);

      expect(result.deducted).toBe(30);
      expect(result.remaining).toBe(0);
    });

    it('should throw BadRequestException when card is inactive', async () => {
      mockTx.giftCard.findUnique.mockResolvedValue({
        ...baseCard,
        isActive: false,
      });

      await expect(service.redeemBalance('GC-ABCD1234', 50)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when card has no balance', async () => {
      mockTx.giftCard.findUnique.mockResolvedValue({
        ...baseCard,
        balance: 0,
      });

      await expect(service.redeemBalance('GC-ABCD1234', 50)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // addCredit
  // ─────────────────────────────────────────────────────────────

  describe('addCredit', () => {
    it('should increment balance and create transaction record', async () => {
      mockPrisma.giftCard.findUnique.mockResolvedValue({
        ...baseCard,
        transactions: [],
      });
      mockTx.giftCard.update.mockResolvedValue({ ...baseCard, balance: 150 });
      mockTx.giftCardTransaction.create.mockResolvedValue({});
      mockTx.giftCard.findUnique.mockResolvedValue({ ...baseCard, balance: 150 });

      const result = await service.addCredit('gc-uuid-1', {
        amount: 50,
        note: 'Top-up',
      });

      expect(mockTx.giftCard.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { balance: { increment: 50 } },
        }),
      );
      expect(mockTx.giftCardTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ amount: 50 }),
        }),
      );
      expect(result).toBeDefined();
    });
  });
});
