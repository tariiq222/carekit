import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NotificationsInboxService } from '../../../src/modules/messaging/inbox/notifications-inbox.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';

const NOTIFICATION = {
  id: 'notif-1',
  userId: 'user-1',
  titleAr: 'عنوان',
  titleEn: 'Title',
  bodyAr: 'نص',
  bodyEn: 'Body',
  type: 'system_alert',
  isRead: false,
  readAt: null,
  data: {},
  createdAt: new Date('2026-01-01'),
};

const mockPrisma = {
  notification: {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    create: jest.fn(),
  },
  fcmToken: {
    upsert: jest.fn(),
    deleteMany: jest.fn(),
  },
};

describe('NotificationsInboxService', () => {
  let service: NotificationsInboxService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        NotificationsInboxService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(NotificationsInboxService);
    jest.clearAllMocks();
  });

  // ─── findAll ────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns paginated items without userId field', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([NOTIFICATION]);
      mockPrisma.notification.count.mockResolvedValue(1);

      const result = await service.findAll('user-1', { page: 1, perPage: 10 });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).not.toHaveProperty('userId');
      expect(result.meta.total).toBe(1);
    });

    it('uses defaults when page/perPage are omitted', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([]);
      mockPrisma.notification.count.mockResolvedValue(0);

      const result = await service.findAll('user-1', {});

      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1' } }),
      );
      expect(result.meta.total).toBe(0);
    });
  });

  // ─── getUnreadCount ──────────────────────────────────────────────────────────

  describe('getUnreadCount', () => {
    it('returns count of unread notifications', async () => {
      mockPrisma.notification.count.mockResolvedValue(5);

      const count = await service.getUnreadCount('user-1');

      expect(count).toBe(5);
      expect(mockPrisma.notification.count).toHaveBeenCalledWith({
        where: { userId: 'user-1', isRead: false },
      });
    });
  });

  // ─── markAsRead ──────────────────────────────────────────────────────────────

  describe('markAsRead', () => {
    it('updates notification when owner calls it', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue(NOTIFICATION);
      mockPrisma.notification.update.mockResolvedValue({ ...NOTIFICATION, isRead: true });

      const result = await service.markAsRead('notif-1', 'user-1');

      expect(result.isRead).toBe(true);
      expect(mockPrisma.notification.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'notif-1' } }),
      );
    });

    it('throws NotFoundException when notification does not exist', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue(null);

      await expect(service.markAsRead('notif-999', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when notification belongs to another user', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue({
        ...NOTIFICATION,
        userId: 'other-user',
      });

      await expect(service.markAsRead('notif-1', 'user-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ─── markAllAsRead ────────────────────────────────────────────────────────────

  describe('markAllAsRead', () => {
    it('calls updateMany for the correct user', async () => {
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 3 });

      await service.markAllAsRead('user-1');

      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', isRead: false },
        data: expect.objectContaining({ isRead: true }),
      });
    });
  });

  // ─── registerFcmToken ────────────────────────────────────────────────────────

  describe('registerFcmToken', () => {
    it('upserts FCM token with correct composite key', async () => {
      mockPrisma.fcmToken.upsert.mockResolvedValue({});

      await service.registerFcmToken('user-1', 'fcm-token-abc', 'android');

      expect(mockPrisma.fcmToken.upsert).toHaveBeenCalledWith({
        where: { userId_token: { userId: 'user-1', token: 'fcm-token-abc' } },
        create: { userId: 'user-1', token: 'fcm-token-abc', platform: 'android' },
        update: { platform: 'android' },
      });
    });
  });

  // ─── unregisterFcmToken ───────────────────────────────────────────────────────

  describe('unregisterFcmToken', () => {
    it('deletes matching FCM token for user', async () => {
      mockPrisma.fcmToken.deleteMany.mockResolvedValue({ count: 1 });

      await service.unregisterFcmToken('user-1', 'fcm-token-abc');

      expect(mockPrisma.fcmToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', token: 'fcm-token-abc' },
      });
    });
  });

  // ─── createSystemAlert ────────────────────────────────────────────────────────

  describe('createSystemAlert', () => {
    it('creates notification with type system_alert', async () => {
      mockPrisma.notification.create.mockResolvedValue({});

      await service.createSystemAlert({
        userId: 'user-1',
        titleAr: 'تنبيه',
        titleEn: 'Alert',
        bodyAr: 'نص',
        bodyEn: 'Body',
      });

      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ type: 'system_alert', userId: 'user-1' }),
      });
    });

    it('defaults data to empty object when not provided', async () => {
      mockPrisma.notification.create.mockResolvedValue({});

      await service.createSystemAlert({
        userId: 'user-1',
        titleAr: 'تنبيه',
        titleEn: 'Alert',
        bodyAr: 'نص',
        bodyEn: 'Body',
      });

      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ data: {} }),
      });
    });
  });
});
