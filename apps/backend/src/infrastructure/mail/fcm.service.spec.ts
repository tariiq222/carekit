import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { FcmService } from './fcm.service';

const mockSend = jest.fn().mockResolvedValue('msg-id-123');
const mockSendEachForMulticast = jest.fn().mockResolvedValue({ successCount: 2, failureCount: 0 });
const mockMessaging = jest.fn(() => ({ send: mockSend, sendEachForMulticast: mockSendEachForMulticast }));
const mockInitializeApp = jest.fn();

jest.mock('firebase-admin', () => ({
  initializeApp: (options: unknown) => mockInitializeApp(options),
  messaging: () => mockMessaging(),
  credential: {
    cert: jest.fn((creds: unknown) => creds),
  },
}));

describe('FcmService', () => {
  let service: FcmService;

  function buildModule(fcmProjectId: string | undefined): Promise<TestingModule> {
    return Test.createTestingModule({
      providers: [
        FcmService,
        {
          provide: ConfigService,
          useValue: { get: (key: string) => (key === 'FCM_PROJECT_ID' ? fcmProjectId : undefined) },
        },
      ],
    }).compile();
  }

  afterEach(() => jest.clearAllMocks());

  describe('when FCM_PROJECT_ID is absent', () => {
    beforeEach(async () => {
      const mod = await buildModule(undefined);
      service = mod.get(FcmService);
      service.onModuleInit();
    });

    it('isAvailable returns false', () => {
      expect(service.isAvailable()).toBe(false);
    });

    it('sendPush throws', async () => {
      await expect(service.sendPush('token', 'title', 'body')).rejects.toThrow('FCM is not initialized');
    });
  });

  describe('when FCM_PROJECT_ID is present', () => {
    beforeEach(async () => {
      const mod = await buildModule('test-project');
      service = mod.get(FcmService);
      service.onModuleInit();
    });

    it('isAvailable returns true', () => {
      expect(service.isAvailable()).toBe(true);
    });

    it('sendPush calls messaging().send() and returns messageId', async () => {
      const result = await service.sendPush('token-abc', 'Hello', 'World', { key: 'val' });
      expect(mockSend).toHaveBeenCalledWith({
        token: 'token-abc',
        notification: { title: 'Hello', body: 'World' },
        data: { key: 'val' },
      });
      expect(result).toBe('msg-id-123');
    });

    it('sendMulticast calls messaging().sendEachForMulticast()', async () => {
      const result = await service.sendMulticast(['t1', 't2'], 'Hi', 'There');
      expect(mockSendEachForMulticast).toHaveBeenCalledWith({
        tokens: ['t1', 't2'],
        notification: { title: 'Hi', body: 'There' },
        data: undefined,
      });
      expect(result).toEqual({ successCount: 2, failureCount: 0 });
    });
  });
});
