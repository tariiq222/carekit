/**
 * CareKit — ReceiptVerificationService Unit Tests
 *
 * Tests the ReceiptVerificationService business logic in isolation:
 *   - verifyReceipt — when receipt not found, throws NotFoundException
 *   - verifyReceipt — skips already-processed receipts (status !== pending)
 *   - verifyReceipt — successful API call updates receipt with 'matched' status
 *   - verifyReceipt — API failure sets status to 'unreadable'
 *   - verifyReceipt — 'amount_differs' when AI returns different amount
 *
 * PrismaService and global.fetch are mocked so tests run without external services.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ReceiptVerificationService } from '../../../src/modules/ai/receipt-verification.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';

// ---------------------------------------------------------------------------
// Mock PrismaService
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrismaService: any = {
  bankTransferReceipt: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

// ---------------------------------------------------------------------------
// Mock ConfigService
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockConfigService: any = {
  get: jest.fn().mockReturnValue('test-openrouter-api-key'),
};

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockReceiptId = 'receipt-uuid-1';
const mockPaymentId = 'payment-uuid-1';
const mockBookingId = 'booking-uuid-1';

const mockReceipt = {
  id: mockReceiptId,
  paymentId: mockPaymentId,
  receiptUrl: 'https://example.com/receipt.jpg',
  aiVerificationStatus: 'pending' as const,
  aiConfidence: null,
  aiNotes: null,
  extractedAmount: null,
  extractedDate: null,
  reviewedById: null,
  reviewedAt: null,
  adminNotes: null,
  createdAt: new Date('2026-03-20'),
  payment: {
    id: mockPaymentId,
    bookingId: mockBookingId,
    amount: 15000,
    vatAmount: 0,
    totalAmount: 15000,
    method: 'bank_transfer',
    status: 'pending',
    booking: {
      id: mockBookingId,
      patientId: 'patient-uuid-1',
      practitionerId: 'practitioner-uuid-1',
    },
  },
};

const mockAlreadyProcessedReceipt = {
  ...mockReceipt,
  aiVerificationStatus: 'matched' as const,
  aiConfidence: 0.98,
};

// ---------------------------------------------------------------------------
// Helper to build a mock fetch response
// ---------------------------------------------------------------------------

function buildFetchResponse(aiResult: object, ok = true, status = 200) {
  const responseBody = {
    choices: [
      {
        message: {
          content: JSON.stringify(aiResult),
        },
      },
    ],
  };

  return Promise.resolve({
    ok,
    status,
    statusText: ok ? 'OK' : 'Internal Server Error',
    json: () => Promise.resolve(responseBody),
    text: () => Promise.resolve(JSON.stringify(responseBody)),
  });
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('ReceiptVerificationService', () => {
  let service: ReceiptVerificationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReceiptVerificationService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<ReceiptVerificationService>(ReceiptVerificationService);

    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // Receipt Not Found
  // ─────────────────────────────────────────────────────────────

  describe('when receipt is not found', () => {
    it('should throw NotFoundException', async () => {
      mockPrismaService.bankTransferReceipt.findUnique.mockResolvedValue(null);

      await expect(service.verifyReceipt('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );

      expect(
        mockPrismaService.bankTransferReceipt.findUnique,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'non-existent-id' },
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Already Processed — Skip
  // ─────────────────────────────────────────────────────────────

  describe('when receipt is already processed', () => {
    it('should return early without calling the AI API', async () => {
      mockPrismaService.bankTransferReceipt.findUnique.mockResolvedValue(
        mockAlreadyProcessedReceipt,
      );

      const fetchSpy = jest.spyOn(global, 'fetch');

      await service.verifyReceipt(mockReceiptId);

      // fetch should NOT have been called
      expect(fetchSpy).not.toHaveBeenCalled();
      // Prisma update should NOT have been called
      expect(
        mockPrismaService.bankTransferReceipt.update,
      ).not.toHaveBeenCalled();

      fetchSpy.mockRestore();
    });

    it('should skip for any non-pending status (e.g. rejected)', async () => {
      mockPrismaService.bankTransferReceipt.findUnique.mockResolvedValue({
        ...mockReceipt,
        aiVerificationStatus: 'rejected',
      });

      const fetchSpy = jest.spyOn(global, 'fetch');

      await service.verifyReceipt(mockReceiptId);

      expect(fetchSpy).not.toHaveBeenCalled();

      fetchSpy.mockRestore();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Successful Verification — matched
  // ─────────────────────────────────────────────────────────────

  describe('when AI returns matched status', () => {
    it('should update receipt with matched status, confidence, notes, amount, and date', async () => {
      mockPrismaService.bankTransferReceipt.findUnique.mockResolvedValue(
        mockReceipt,
      );
      mockPrismaService.bankTransferReceipt.update.mockResolvedValue({
        ...mockReceipt,
        aiVerificationStatus: 'matched',
        aiConfidence: 0.97,
        aiNotes: 'Amount matches expected value exactly.',
        extractedAmount: 15000,
        extractedDate: new Date('2026-03-20T00:00:00.000Z'),
      });

      const aiResult = {
        extractedAmount: 15000,
        extractedDate: '2026-03-20T00:00:00.000Z',
        confidence: 0.97,
        status: 'matched',
        notes: 'Amount matches expected value exactly.',
      };

      jest
        .spyOn(global, 'fetch')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .mockResolvedValueOnce(buildFetchResponse(aiResult) as any);

      await service.verifyReceipt(mockReceiptId);

      expect(
        mockPrismaService.bankTransferReceipt.update,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockReceiptId },
          data: expect.objectContaining({
            aiVerificationStatus: 'matched',
            aiConfidence: 0.97,
            aiNotes: 'Amount matches expected value exactly.',
            extractedAmount: 15000,
          }),
        }),
      );
    });

    it('should call OpenRouter API with correct headers and model', async () => {
      mockPrismaService.bankTransferReceipt.findUnique.mockResolvedValue(
        mockReceipt,
      );
      mockPrismaService.bankTransferReceipt.update.mockResolvedValue({});

      const aiResult = {
        extractedAmount: 15000,
        extractedDate: '2026-03-20T00:00:00.000Z',
        confidence: 0.95,
        status: 'matched',
        notes: 'Receipt is valid.',
      };

      const fetchSpy = jest
        .spyOn(global, 'fetch')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .mockResolvedValueOnce(buildFetchResponse(aiResult) as any);

      await service.verifyReceipt(mockReceiptId);

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-openrouter-api-key',
            'Content-Type': 'application/json',
            'HTTP-Referer': 'carekit',
            'X-Title': 'CareKit',
          }),
          body: expect.stringContaining('google/gemini-flash-1.5'),
        }),
      );

      fetchSpy.mockRestore();
    });

    it('should pass the receipt URL and expected amount in the request body', async () => {
      mockPrismaService.bankTransferReceipt.findUnique.mockResolvedValue(
        mockReceipt,
      );
      mockPrismaService.bankTransferReceipt.update.mockResolvedValue({});

      const aiResult = {
        extractedAmount: 15000,
        extractedDate: '2026-03-20T00:00:00.000Z',
        confidence: 0.95,
        status: 'matched',
        notes: 'OK',
      };

      const fetchSpy = jest
        .spyOn(global, 'fetch')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .mockResolvedValueOnce(buildFetchResponse(aiResult) as any);

      await service.verifyReceipt(mockReceiptId);

      const callArgs = fetchSpy.mock.calls[0];
      const body = JSON.parse(callArgs[1]?.body as string);

      const userContent = body.messages[0].content;
      const imageContent = userContent.find(
        (c: { type: string }) => c.type === 'image_url',
      );
      expect(imageContent.image_url.url).toBe(mockReceipt.receiptUrl);

      const textContent = userContent.find(
        (c: { type: string }) => c.type === 'text',
      );
      expect(textContent.text).toContain('15000'); // expected halalat
      expect(textContent.text).toContain('150'); // expected SAR

      fetchSpy.mockRestore();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // API Failure — sets status to 'unreadable'
  // ─────────────────────────────────────────────────────────────

  describe('when the API call fails', () => {
    it('should set status to unreadable and store the error message', async () => {
      mockPrismaService.bankTransferReceipt.findUnique.mockResolvedValue(
        mockReceipt,
      );
      mockPrismaService.bankTransferReceipt.update.mockResolvedValue({});

      jest.spyOn(global, 'fetch').mockRejectedValueOnce(
        new Error('Network connection refused'),
      );

      await service.verifyReceipt(mockReceiptId);

      expect(
        mockPrismaService.bankTransferReceipt.update,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockReceiptId },
          data: expect.objectContaining({
            aiVerificationStatus: 'unreadable',
            aiNotes: expect.stringContaining('Network connection refused'),
          }),
        }),
      );
    });

    it('should set status to unreadable on non-ok HTTP response', async () => {
      mockPrismaService.bankTransferReceipt.findUnique.mockResolvedValue(
        mockReceipt,
      );
      mockPrismaService.bankTransferReceipt.update.mockResolvedValue({});

      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve('Service Unavailable'),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      await service.verifyReceipt(mockReceiptId);

      expect(
        mockPrismaService.bankTransferReceipt.update,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockReceiptId },
          data: expect.objectContaining({
            aiVerificationStatus: 'unreadable',
          }),
        }),
      );
    });

    it('should set status to unreadable when AI returns invalid JSON', async () => {
      mockPrismaService.bankTransferReceipt.findUnique.mockResolvedValue(
        mockReceipt,
      );
      mockPrismaService.bankTransferReceipt.update.mockResolvedValue({});

      const invalidJsonResponse = {
        choices: [
          {
            message: {
              content: 'This is not valid JSON at all!',
            },
          },
        ],
      };

      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(invalidJsonResponse),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      await service.verifyReceipt(mockReceiptId);

      expect(
        mockPrismaService.bankTransferReceipt.update,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockReceiptId },
          data: expect.objectContaining({
            aiVerificationStatus: 'unreadable',
            aiNotes: expect.stringContaining('parse'),
          }),
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // amount_differs — AI returns different amount
  // ─────────────────────────────────────────────────────────────

  describe('when AI returns amount_differs status', () => {
    it('should update receipt with amount_differs status', async () => {
      mockPrismaService.bankTransferReceipt.findUnique.mockResolvedValue(
        mockReceipt,
      );
      mockPrismaService.bankTransferReceipt.update.mockResolvedValue({
        ...mockReceipt,
        aiVerificationStatus: 'amount_differs',
        aiConfidence: 0.85,
        aiNotes: 'Receipt shows 10000 halalat, expected 15000 halalat.',
        extractedAmount: 10000,
        extractedDate: new Date('2026-03-20T00:00:00.000Z'),
      });

      const aiResult = {
        extractedAmount: 10000,
        extractedDate: '2026-03-20T00:00:00.000Z',
        confidence: 0.85,
        status: 'amount_differs',
        notes: 'Receipt shows 10000 halalat, expected 15000 halalat.',
      };

      jest
        .spyOn(global, 'fetch')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .mockResolvedValueOnce(buildFetchResponse(aiResult) as any);

      await service.verifyReceipt(mockReceiptId);

      expect(
        mockPrismaService.bankTransferReceipt.update,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockReceiptId },
          data: expect.objectContaining({
            aiVerificationStatus: 'amount_differs',
            aiConfidence: 0.85,
            extractedAmount: 10000,
            aiNotes: 'Receipt shows 10000 halalat, expected 15000 halalat.',
          }),
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Null extracted fields
  // ─────────────────────────────────────────────────────────────

  describe('when AI cannot extract data', () => {
    it('should handle null extractedAmount and extractedDate gracefully', async () => {
      mockPrismaService.bankTransferReceipt.findUnique.mockResolvedValue(
        mockReceipt,
      );
      mockPrismaService.bankTransferReceipt.update.mockResolvedValue({});

      const aiResult = {
        extractedAmount: null,
        extractedDate: null,
        confidence: 0.1,
        status: 'unreadable',
        notes: 'Image is blurry, cannot read receipt details.',
      };

      jest
        .spyOn(global, 'fetch')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .mockResolvedValueOnce(buildFetchResponse(aiResult) as any);

      await service.verifyReceipt(mockReceiptId);

      const updateCall =
        mockPrismaService.bankTransferReceipt.update.mock.calls[0][0];
      expect(updateCall.data.aiVerificationStatus).toBe('unreadable');
      expect(updateCall.data.extractedAmount).toBeUndefined();
      expect(updateCall.data.extractedDate).toBeUndefined();
    });
  });
});
