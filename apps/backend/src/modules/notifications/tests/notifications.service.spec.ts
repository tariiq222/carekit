/**
 * CareKit — NotificationsService Unit Tests (TDD RED Phase)
 *
 * Tests the NotificationsService business logic in isolation:
 *   - findAll — paginated, user-scoped, sorted by createdAt desc
 *   - getUnreadCount — count of unread notifications for a user
 *   - markAsRead — mark single notification as read (ownership check)
 *   - markAllAsRead — mark all user's notifications as read
 *   - createNotification — create notification for a user (internal use)
 *   - registerFcmToken — register/upsert FCM device token
 *   - unregisterFcmToken — remove FCM device token
 *
 * NotificationType enum values:
 *   booking_confirmed, booking_cancelled, reminder,
 *   payment_received, new_rating, problem_report
 *
 * PrismaService is mocked so tests run without a database.
 * These tests will FAIL until backend-dev implements NotificationsService.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { NotificationsService } from '../notifications.service.js';
import { PrismaService } from '../../../database/prisma.service.js';

// ---------------------------------------------------------------------------
// DTO interfaces (replaced by actual imports once backend-dev creates them)
// ---------------------------------------------------------------------------

interface CreateNotificationDto {
  userId: string;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  type: string;
  data?: Record<string, unknown>;
}

interface RegisterFcmTokenDto {
  token: string;
  platform: 'ios' | 'android';
}

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const mockPrismaService: any = {
  notification: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn(),
  },
  fcmToken: {
    upsert: jest.fn(),
    deleteMany: jest.fn(),
    findFirst: jest.fn(),
  },
  $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) =>
    fn(mockPrismaService),
  ),
};

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockUserId = 'user-uuid-patient-1';
const mockUser2Id = 'user-uuid-patient-2';

const mockNotification = {
  id: 'notification-uuid-1',
  userId: mockUserId,
  titleAr: 'تم تأكيد الحجز',
  titleEn: 'Booking Confirmed',
  bodyAr: 'تم تأكيد حجزك مع د. خالد الفهد في 1 أبريل 2026',
  bodyEn:
    'Your booking with Dr. Khalid Al-Fahad on April 1, 2026 has been confirmed',
  type: 'booking_confirmed',
  isRead: false,
  data: { bookingId: 'booking-uuid-1' },
  createdAt: new Date('2026-03-30T14:00:00.000Z'),
};

const mockNotification2 = {
  id: 'notification-uuid-2',
  userId: mockUserId,
  titleAr: 'تذكير بالموعد',
  titleEn: 'Appointment Reminder',
  bodyAr: 'لديك موعد غدًا في الساعة 9:00 صباحًا',
  bodyEn: 'You have an appointment tomorrow at 9:00 AM',
  type: 'reminder',
  isRead: false,
  data: { bookingId: 'booking-uuid-2' },
  createdAt: new Date('2026-03-31T08:00:00.000Z'),
};

const mockReadNotification = {
  ...mockNotification,
  id: 'notification-uuid-3',
  isRead: true,
};

const mockFcmToken = {
  id: 'fcm-uuid-1',
  userId: mockUserId,
  token: 'dGVzdC1mY20tdG9rZW4tZm9yLWlvcy1kZXZpY2U',
  platform: 'ios',
  createdAt: new Date('2026-03-20'),
  updatedAt: new Date('2026-03-20'),
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('NotificationsService', () => {
  let service: NotificationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);

    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // findAll — List user's notifications
  // ─────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return paginated notifications for a user', async () => {
      mockPrismaService.notification.findMany.mockResolvedValue([
        mockNotification2,
        mockNotification,
      ]);
      mockPrismaService.notification.count.mockResolvedValue(2);

      const result = await service.findAll(mockUserId, {
        page: 1,
        perPage: 20,
      });

      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('meta');
      expect(result.meta).toMatchObject({
        page: 1,
        perPage: 20,
        total: 2,
      });
      expect(result.items).toHaveLength(2);
    });

    it('should filter by userId (user-scoped)', async () => {
      mockPrismaService.notification.findMany.mockResolvedValue([]);
      mockPrismaService.notification.count.mockResolvedValue(0);

      await service.findAll(mockUserId, {});

      expect(mockPrismaService.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: mockUserId,
          }),
        }),
      );
    });

    it('should sort by createdAt descending (newest first)', async () => {
      mockPrismaService.notification.findMany.mockResolvedValue([]);
      mockPrismaService.notification.count.mockResolvedValue(0);

      await service.findAll(mockUserId, {});

      expect(mockPrismaService.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('should apply pagination', async () => {
      mockPrismaService.notification.findMany.mockResolvedValue([]);
      mockPrismaService.notification.count.mockResolvedValue(50);

      const result = await service.findAll(mockUserId, {
        page: 3,
        perPage: 10,
      });

      expect(result.meta.page).toBe(3);
      expect(result.meta.perPage).toBe(10);
      expect(result.meta.totalPages).toBe(5);
      expect(mockPrismaService.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        }),
      );
    });

    it('should return empty list for user with no notifications', async () => {
      mockPrismaService.notification.findMany.mockResolvedValue([]);
      mockPrismaService.notification.count.mockResolvedValue(0);

      const result = await service.findAll(mockUser2Id, {});

      expect(result.items).toEqual([]);
      expect(result.meta.total).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // getUnreadCount
  // ─────────────────────────────────────────────────────────────

  describe('getUnreadCount', () => {
    it('should return count of unread notifications for a user', async () => {
      mockPrismaService.notification.count.mockResolvedValue(5);

      const result = await service.getUnreadCount(mockUserId);

      expect(result).toBe(5);
      expect(mockPrismaService.notification.count).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          isRead: false,
        },
      });
    });

    it('should return 0 when all notifications are read', async () => {
      mockPrismaService.notification.count.mockResolvedValue(0);

      const result = await service.getUnreadCount(mockUserId);

      expect(result).toBe(0);
    });

    it('should return 0 for user with no notifications', async () => {
      mockPrismaService.notification.count.mockResolvedValue(0);

      const result = await service.getUnreadCount(mockUser2Id);

      expect(result).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // markAsRead — Mark single notification as read
  // ─────────────────────────────────────────────────────────────

  describe('markAsRead', () => {
    it('should mark a notification as read', async () => {
      mockPrismaService.notification.findUnique.mockResolvedValue(
        mockNotification,
      );
      mockPrismaService.notification.update.mockResolvedValue({
        ...mockNotification,
        isRead: true,
      });

      const result = await service.markAsRead(mockNotification.id, mockUserId);

      expect(result.isRead).toBe(true);
      expect(mockPrismaService.notification.update).toHaveBeenCalledWith({
        where: { id: mockNotification.id },
        data: { isRead: true },
      });
    });

    it('should throw NotFoundException when notification does not exist', async () => {
      mockPrismaService.notification.findUnique.mockResolvedValue(null);

      await expect(
        service.markAsRead('non-existent-id', mockUserId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user does not own the notification', async () => {
      mockPrismaService.notification.findUnique.mockResolvedValue(
        mockNotification,
      );

      await expect(
        service.markAsRead(mockNotification.id, mockUser2Id), // different user
      ).rejects.toThrow(ForbiddenException);
    });

    it('should be idempotent (already-read notification succeeds)', async () => {
      mockPrismaService.notification.findUnique.mockResolvedValue(
        mockReadNotification,
      );
      mockPrismaService.notification.update.mockResolvedValue(
        mockReadNotification,
      );

      const result = await service.markAsRead(
        mockReadNotification.id,
        mockUserId,
      );

      expect(result.isRead).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // markAllAsRead — Mark all user's notifications as read
  // ─────────────────────────────────────────────────────────────

  describe('markAllAsRead', () => {
    it('should update all unread notifications for the user', async () => {
      mockPrismaService.notification.updateMany.mockResolvedValue({ count: 5 });

      await service.markAllAsRead(mockUserId);

      expect(mockPrismaService.notification.updateMany).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          isRead: false,
        },
        data: { isRead: true },
      });
    });

    it('should succeed even if no unread notifications exist', async () => {
      mockPrismaService.notification.updateMany.mockResolvedValue({ count: 0 });

      // Should not throw
      await expect(service.markAllAsRead(mockUserId)).resolves.not.toThrow();
    });

    it("should only update the specified user's notifications", async () => {
      mockPrismaService.notification.updateMany.mockResolvedValue({ count: 3 });

      await service.markAllAsRead(mockUserId);

      expect(mockPrismaService.notification.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: mockUserId,
          }),
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // createNotification — Internal notification creation
  // ─────────────────────────────────────────────────────────────

  describe('createNotification', () => {
    const createDto: CreateNotificationDto = {
      userId: mockUserId,
      titleAr: 'إشعار جديد',
      titleEn: 'New Notification',
      bodyAr: 'محتوى الإشعار باللغة العربية',
      bodyEn: 'Notification body in English',
      type: 'booking_confirmed',
      data: { bookingId: 'booking-uuid-new' },
    };

    it('should create a notification with all fields', async () => {
      mockPrismaService.notification.create.mockResolvedValue({
        id: 'new-notification-uuid',
        ...createDto,
        isRead: false,
        createdAt: new Date(),
      });

      const result = await service.createNotification(createDto);

      expect(result).toBeDefined();
      expect(result.isRead).toBe(false);
      expect(mockPrismaService.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: createDto.userId,
          titleAr: createDto.titleAr,
          titleEn: createDto.titleEn,
          bodyAr: createDto.bodyAr,
          bodyEn: createDto.bodyEn,
          type: createDto.type,
          data: createDto.data,
        }),
      });
    });

    it('should create a notification without optional data field', async () => {
      const minimalDto: CreateNotificationDto = {
        userId: mockUserId,
        titleAr: 'تذكير',
        titleEn: 'Reminder',
        bodyAr: 'تذكير بالموعد',
        bodyEn: 'Appointment reminder',
        type: 'reminder',
      };

      mockPrismaService.notification.create.mockResolvedValue({
        id: 'new-uuid',
        ...minimalDto,
        data: null,
        isRead: false,
        createdAt: new Date(),
      });

      const result = await service.createNotification(minimalDto);

      expect(result).toBeDefined();
    });

    it('should set isRead to false by default', async () => {
      mockPrismaService.notification.create.mockResolvedValue({
        id: 'new-uuid',
        ...createDto,
        isRead: false,
        createdAt: new Date(),
      });

      await service.createNotification(createDto);

      expect(mockPrismaService.notification.create).toHaveBeenCalledWith({
        data: expect.not.objectContaining({
          isRead: true,
        }),
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // registerFcmToken — Register/upsert FCM device token
  // ─────────────────────────────────────────────────────────────

  describe('registerFcmToken', () => {
    const tokenDto: RegisterFcmTokenDto = {
      token: 'dGVzdC1mY20tdG9rZW4tZm9yLWlvcy1kZXZpY2U',
      platform: 'ios',
    };

    it('should register a new FCM token (upsert)', async () => {
      mockPrismaService.fcmToken.upsert.mockResolvedValue(mockFcmToken);

      const result = await service.registerFcmToken(mockUserId, tokenDto);

      expect(result).toBeDefined();
      expect(mockPrismaService.fcmToken.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.anything(),
          create: expect.objectContaining({
            userId: mockUserId,
            token: tokenDto.token,
            platform: tokenDto.platform,
          }),
          update: expect.objectContaining({
            platform: tokenDto.platform,
          }),
        }),
      );
    });

    it('should update platform if same token is re-registered', async () => {
      mockPrismaService.fcmToken.upsert.mockResolvedValue({
        ...mockFcmToken,
        platform: 'android',
      });

      await service.registerFcmToken(mockUserId, {
        token: tokenDto.token,
        platform: 'android',
      });

      expect(mockPrismaService.fcmToken.upsert).toHaveBeenCalled();
    });

    it('should accept ios platform', async () => {
      mockPrismaService.fcmToken.upsert.mockResolvedValue(mockFcmToken);

      await service.registerFcmToken(mockUserId, {
        token: 'ios-token',
        platform: 'ios',
      });

      expect(mockPrismaService.fcmToken.upsert).toHaveBeenCalled();
    });

    it('should accept android platform', async () => {
      mockPrismaService.fcmToken.upsert.mockResolvedValue({
        ...mockFcmToken,
        platform: 'android',
      });

      await service.registerFcmToken(mockUserId, {
        token: 'android-token',
        platform: 'android',
      });

      expect(mockPrismaService.fcmToken.upsert).toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // unregisterFcmToken — Remove FCM device token
  // ─────────────────────────────────────────────────────────────

  describe('unregisterFcmToken', () => {
    const fcmTokenValue = 'dGVzdC1mY20tdG9rZW4tZm9yLWlvcy1kZXZpY2U';

    it('should delete the FCM token for the user', async () => {
      mockPrismaService.fcmToken.deleteMany.mockResolvedValue({ count: 1 });

      await service.unregisterFcmToken(mockUserId, fcmTokenValue);

      expect(mockPrismaService.fcmToken.deleteMany).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          token: fcmTokenValue,
        },
      });
    });

    it('should succeed even if token does not exist (idempotent)', async () => {
      mockPrismaService.fcmToken.deleteMany.mockResolvedValue({ count: 0 });

      // Should not throw
      await expect(
        service.unregisterFcmToken(mockUserId, 'non-existent-token'),
      ).resolves.not.toThrow();
    });

    it('should only delete tokens belonging to the specified user', async () => {
      mockPrismaService.fcmToken.deleteMany.mockResolvedValue({ count: 1 });

      await service.unregisterFcmToken(mockUserId, 'some-token');

      expect(mockPrismaService.fcmToken.deleteMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          userId: mockUserId,
        }),
      });
    });
  });
});
