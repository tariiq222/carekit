import { SendPushHandler } from './send-push.handler';
import type { FcmService } from '../../../infrastructure/mail';

describe('SendPushHandler', () => {
  it('sends push via FCM', async () => {
    const fcm = {
      isAvailable: jest.fn().mockReturnValue(true),
      sendPush: jest.fn().mockResolvedValue('msg-id'),
    };
    await new SendPushHandler(fcm as unknown as FcmService).execute({
      token: 'tok-1',
      title: 'Hello',
      body: 'World',
    });
    expect(fcm.sendPush).toHaveBeenCalledWith('tok-1', 'Hello', 'World', undefined);
  });

  it('skips when FCM unavailable', async () => {
    const fcm = {
      isAvailable: jest.fn().mockReturnValue(false),
      sendPush: jest.fn(),
    };
    await new SendPushHandler(fcm as unknown as FcmService).execute({
      token: 'tok-1',
      title: 'Hello',
      body: 'World',
    });
    expect(fcm.sendPush).not.toHaveBeenCalled();
  });
});
