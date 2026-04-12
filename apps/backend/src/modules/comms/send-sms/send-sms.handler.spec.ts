import { SendSmsHandler } from './send-sms.handler';

describe('SendSmsHandler', () => {
  it('logs SMS send (stub)', async () => {
    await expect(
      new SendSmsHandler().execute({ phone: '+966500000000', body: 'Test message' }),
    ).resolves.toBeUndefined();
  });
});
