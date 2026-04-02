/**
 * NotificationsController — Unit Tests (delegation)
 */
import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from '../../../src/modules/notifications/notifications.controller.js';
import { NotificationsService } from '../../../src/modules/notifications/notifications.service.js';

const mockNotificationsService = {
  findAll: jest.fn(), getUnreadCount: jest.fn(),
  markAllAsRead: jest.fn(), markAsRead: jest.fn(),
  registerFcmToken: jest.fn(), unregisterFcmToken: jest.fn(),
};

const mockUser = { id: 'user-1' };

describe('NotificationsController', () => {
  let controller: NotificationsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        { provide: NotificationsService, useValue: mockNotificationsService },

      ],
    }).compile();
    controller = module.get(NotificationsController);
  });

  it('findAll → notificationsService.findAll()', () => {
    mockNotificationsService.findAll.mockResolvedValue([]);
    controller.findAll(mockUser as any, {} as any);
    expect(mockNotificationsService.findAll).toHaveBeenCalled();
  });

  it('getUnreadCount → notificationsService.getUnreadCount()', () => {
    mockNotificationsService.getUnreadCount.mockResolvedValue(5);
    controller.getUnreadCount(mockUser as any);
    expect(mockNotificationsService.getUnreadCount).toHaveBeenCalledWith('user-1');
  });

  it('markAllAsRead → notificationsService.markAllAsRead()', () => {
    mockNotificationsService.markAllAsRead.mockResolvedValue(undefined);
    controller.markAllAsRead(mockUser as any);
    expect(mockNotificationsService.markAllAsRead).toHaveBeenCalledWith('user-1');
  });

  it('markAsRead → notificationsService.markAsRead()', () => {
    mockNotificationsService.markAsRead.mockResolvedValue(undefined);
    controller.markAsRead('notif-1', mockUser as any);
    expect(mockNotificationsService.markAsRead).toHaveBeenCalledWith('notif-1', 'user-1');
  });

  it('registerFcmToken → pushService.registerToken()', () => {
    mockNotificationsService.registerFcmToken.mockResolvedValue(undefined);
    controller.registerFcmToken({ token: 'fcm-token' } as any, mockUser as any);
    expect(mockNotificationsService.registerFcmToken).toHaveBeenCalledWith('user-1', expect.any(Object));
  });

  it('unregisterFcmToken → pushService.unregisterToken()', () => {
    mockNotificationsService.unregisterFcmToken.mockResolvedValue(undefined);
    controller.unregisterFcmToken({ token: 'fcm-token' } as any, mockUser as any);
    expect(mockNotificationsService.unregisterFcmToken).toHaveBeenCalledWith('user-1', 'fcm-token');
  });
});
