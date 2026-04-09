import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from '../../../src/modules/notifications/notifications.controller.js';
import { NotificationsService } from '../../../src/modules/notifications/notifications.service.js';
import { JwtAuthGuard } from '../../../src/common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../../src/common/guards/permissions.guard.js';

const mockService = {
  findAll: jest.fn(),
  getUnreadCount: jest.fn(),
  markAllAsRead: jest.fn(),
  markAsRead: jest.fn(),
  registerFcmToken: jest.fn(),
  unregisterFcmToken: jest.fn(),
};

const mockUser = { id: 'user-1' };

describe('NotificationsController', () => {
  let controller: NotificationsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [{ provide: NotificationsService, useValue: mockService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<NotificationsController>(NotificationsController);
  });

  describe('findAll', () => {
    it('should pass userId and query to service', async () => {
      const query = { page: '1' } as any;
      const notifications = [{ id: 'n1', title: 'New booking' }];
      mockService.findAll.mockResolvedValue(notifications);

      expect(await controller.findAll(query, mockUser)).toEqual(notifications);
      expect(mockService.findAll).toHaveBeenCalledWith('user-1', query);
    });
  });

  describe('getUnreadCount', () => {
    it('should return count wrapped in object', async () => {
      mockService.getUnreadCount.mockResolvedValue(5);

      expect(await controller.getUnreadCount(mockUser)).toEqual({ count: 5 });
      expect(mockService.getUnreadCount).toHaveBeenCalledWith('user-1');
    });
  });

  describe('markAllAsRead', () => {
    it('should return updated: true after calling service', async () => {
      mockService.markAllAsRead.mockResolvedValue(undefined);

      expect(await controller.markAllAsRead(mockUser)).toEqual({ updated: true });
      expect(mockService.markAllAsRead).toHaveBeenCalledWith('user-1');
    });
  });

  describe('markAsRead', () => {
    it('should pass notification id and userId', async () => {
      const result = { id: 'n1', readAt: new Date() };
      mockService.markAsRead.mockResolvedValue(result);

      expect(await controller.markAsRead('n1', mockUser)).toEqual(result);
      expect(mockService.markAsRead).toHaveBeenCalledWith('n1', 'user-1');
    });
  });

  describe('registerFcmToken', () => {
    it('should pass userId and dto', async () => {
      const dto = { token: 'fcm-token-abc' } as any;
      const result = { registered: true };
      mockService.registerFcmToken.mockResolvedValue(result);

      expect(await controller.registerFcmToken(dto, mockUser)).toEqual(result);
      expect(mockService.registerFcmToken).toHaveBeenCalledWith('user-1', dto);
    });
  });

  describe('unregisterFcmToken', () => {
    it('should return deleted: true after calling service', async () => {
      const dto = { token: 'fcm-token-abc' } as any;
      mockService.unregisterFcmToken.mockResolvedValue(undefined);

      expect(await controller.unregisterFcmToken(dto, mockUser)).toEqual({ deleted: true });
      expect(mockService.unregisterFcmToken).toHaveBeenCalledWith('user-1', 'fcm-token-abc');
    });
  });
});
