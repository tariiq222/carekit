import { SendSmsHandler } from './send-sms.handler';

describe('SendSmsHandler', () => {
  it('executes without throwing (stub mode)', async () => {
    const handler = new SendSmsHandler();
    await expect(handler.execute({ phone: '+966500000000', body: 'Test SMS' })).resolves.not.toThrow();
  });

  it('does not throw for missing optional fields', async () => {
    const handler = new SendSmsHandler();
    await expect(handler.execute({ phone: '+966500000001', body: 'Reminder' })).resolves.toBeUndefined();
  });
});
