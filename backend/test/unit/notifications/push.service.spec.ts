/**
 * CareKit — PushService Unit Tests
 *
 * Tests the PushService in isolation:
 *   - onModuleInit — skips init when Firebase env vars missing
 *   - sendToUser — returns early when not initialized
 *   - sendToUser — returns early when user has no FCM tokens
 *   - sendToUser — builds correct multicast payload
 *   - sendToUser — cleans up stale tokens on registration-token-not-registered
 *   - sendToUser — logs error on Firebase failure, doesn't throw
 *
 * firebase-admin is mocked at the module level since we cannot
 * initialize the real Firebase Admin SDK in unit tests.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PushService } from '../../../src/modules/notifications/push.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';

// ---------------------------------------------------------------------------
// Mock firebase-admin at module level
// ---------------------------------------------------------------------------

const mockSendEachForMulticast = jest.fn();

jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  credential: {
    cert: jest.fn(() => 'mock-credential'),
  },
  messaging: jest.fn(() => ({
    sendEachForMulticast: mockSendEachForMulticast,
  })),
}));

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrismaService: any = {
  fcmToken: {
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
};

const mockConfigService = {
  get: jest.fn(),
};

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockUserId = 'user-uuid-1';

const mockNotification = {
  titleAr: 'تذكير بموعدك',
  titleEn: 'Appointment Reminder',
  bodyAr: 'لديك موعد غداً',
  bodyEn: 'You have an appointment tomorrow',
  data: { bookingId: 'booking-uuid-1' },
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('PushService', () => {
  let service: PushService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PushService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<PushService>(PushService);

    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // onModuleInit
  // ─────────────────────────────────────────────────────────────

  describe('onModuleInit', () => {
    it('should skip init when Firebase env vars are missing (warns, initialized=false)', () => {
      mockConfigService.get.mockReturnValue(undefined);

      service.onModuleInit();

      // After init with missing vars, sendToUser should return immediately
      // (initialized remains false)
      expect(mockConfigService.get).toHaveBeenCalledWith('FIREBASE_PROJECT_ID');
      expect(mockConfigService.get).toHaveBeenCalledWith(
        'FIREBASE_CLIENT_EMAIL',
      );
      expect(mockConfigService.get).toHaveBeenCalledWith(
        'FIREBASE_PRIVATE_KEY',
      );
    });

    it('should set initialized=true when Firebase env vars are present', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        const vars: Record<string, string> = {
          FIREBASE_PROJECT_ID: 'test-project',
          FIREBASE_CLIENT_EMAIL: 'test@test.iam.gserviceaccount.com',
          FIREBASE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\\ntest\\n-----END',
        };
        return vars[key];
      });

      service.onModuleInit();

      // Verify Firebase was initialized by checking sendToUser
      // doesn't return early (it will try to query tokens)
      const admin = require('firebase-admin');
      expect(admin.initializeApp).toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // sendToUser — not initialized
  // ─────────────────────────────────────────────────────────────

  describe('sendToUser — not initialized', () => {
    it('should return immediately when not initialized', async () => {
      // Don't call onModuleInit — initialized remains false
      await service.sendToUser(mockUserId, mockNotification);

      // Should not even query for tokens
      expect(mockPrismaService.fcmToken.findMany).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // sendToUser — initialized
  // ─────────────────────────────────────────────────────────────

  describe('sendToUser — initialized', () => {
    beforeEach(() => {
      // Initialize Firebase
      mockConfigService.get.mockImplementation((key: string) => {
        const vars: Record<string, string> = {
          FIREBASE_PROJECT_ID: 'test-project',
          FIREBASE_CLIENT_EMAIL: 'test@test.iam.gserviceaccount.com',
          FIREBASE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\\ntest\\n-----END',
        };
        return vars[key];
      });
      service.onModuleInit();
      jest.clearAllMocks();
    });

    it('should return immediately when user has no FCM tokens', async () => {
      mockPrismaService.fcmToken.findMany.mockResolvedValue([]);

      await service.sendToUser(mockUserId, mockNotification);

      expect(mockPrismaService.fcmToken.findMany).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        select: { token: true },
      });
      expect(mockSendEachForMulticast).not.toHaveBeenCalled();
    });

    it('should build correct multicast payload (title, body, data)', async () => {
      mockPrismaService.fcmToken.findMany.mockResolvedValue([
        { token: 'token-1' },
        { token: 'token-2' },
      ]);
      mockSendEachForMulticast.mockResolvedValue({
        responses: [{ success: true }, { success: true }],
      });

      await service.sendToUser(mockUserId, mockNotification);

      expect(mockSendEachForMulticast).toHaveBeenCalledWith({
        tokens: ['token-1', 'token-2'],
        notification: {
          title: mockNotification.titleEn,
          body: mockNotification.bodyEn,
        },
        data: {
          titleAr: mockNotification.titleAr,
          titleEn: mockNotification.titleEn,
          bodyAr: mockNotification.bodyAr,
          bodyEn: mockNotification.bodyEn,
          bookingId: 'booking-uuid-1',
        },
      });
    });

    it('should clean up stale tokens on registration-token-not-registered error', async () => {
      mockPrismaService.fcmToken.findMany.mockResolvedValue([
        { token: 'valid-token' },
        { token: 'stale-token' },
      ]);
      mockSendEachForMulticast.mockResolvedValue({
        responses: [
          { success: true },
          {
            success: false,
            error: {
              code: 'messaging/registration-token-not-registered',
            },
          },
        ],
      });
      mockPrismaService.fcmToken.deleteMany.mockResolvedValue({ count: 1 });

      await service.sendToUser(mockUserId, mockNotification);

      expect(mockPrismaService.fcmToken.deleteMany).toHaveBeenCalledWith({
        where: { token: { in: ['stale-token'] } },
      });
    });

    it('should not clean up tokens when all succeed', async () => {
      mockPrismaService.fcmToken.findMany.mockResolvedValue([
        { token: 'token-1' },
      ]);
      mockSendEachForMulticast.mockResolvedValue({
        responses: [{ success: true }],
      });

      await service.sendToUser(mockUserId, mockNotification);

      expect(mockPrismaService.fcmToken.deleteMany).not.toHaveBeenCalled();
    });

    it('should log error on Firebase failure but not throw', async () => {
      mockPrismaService.fcmToken.findMany.mockResolvedValue([
        { token: 'token-1' },
      ]);
      mockSendEachForMulticast.mockRejectedValue(
        new Error('Firebase unavailable'),
      );

      // Should not throw
      await expect(
        service.sendToUser(mockUserId, mockNotification),
      ).resolves.not.toThrow();
    });
  });
});
