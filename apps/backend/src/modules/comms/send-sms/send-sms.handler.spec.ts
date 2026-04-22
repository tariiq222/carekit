import { NoOpAdapter } from '../../../infrastructure/sms/no-op.adapter';
import type { SmsProviderFactory } from '../../../infrastructure/sms/sms-provider.factory';
import { SendSmsHandler } from './send-sms.handler';

const buildTenant = (organizationId = 'org-A') => ({
  requireOrganizationIdOrDefault: jest.fn().mockReturnValue(organizationId),
});

describe('SendSmsHandler', () => {
  it('resolves tenant provider, sends, writes SmsDelivery with SENT status', async () => {
    const prisma = {
      smsDelivery: { create: jest.fn().mockResolvedValue({}) },
    };
    const adapter = {
      name: 'UNIFONIC' as const,
      send: jest
        .fn()
        .mockResolvedValue({ providerMessageId: 'm1', status: 'SENT' }),
      verifyDlrSignature: jest.fn(),
      parseDlr: jest.fn(),
    };
    const factory = {
      forCurrentTenant: jest.fn().mockResolvedValue(adapter),
    } as unknown as SmsProviderFactory;
    const handler = new SendSmsHandler(
      prisma as never,
      buildTenant('org-A') as never,
      factory,
    );

    await handler.execute({ phone: '+966500000000', body: 'hi' });

    expect(adapter.send).toHaveBeenCalledWith('+966500000000', 'hi', null);
    expect(prisma.smsDelivery.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: 'org-A',
        provider: 'UNIFONIC',
        toPhone: '+966500000000',
        body: 'hi',
        status: 'SENT',
        providerMessageId: 'm1',
      }),
    });
  });

  it('writes FAILED row and re-throws when adapter errors', async () => {
    const prisma = {
      smsDelivery: { create: jest.fn().mockResolvedValue({}) },
    };
    const adapter = {
      name: 'TAQNYAT' as const,
      send: jest.fn().mockRejectedValue(new Error('boom')),
      verifyDlrSignature: jest.fn(),
      parseDlr: jest.fn(),
    };
    const factory = {
      forCurrentTenant: jest.fn().mockResolvedValue(adapter),
    } as unknown as SmsProviderFactory;
    const handler = new SendSmsHandler(
      prisma as never,
      buildTenant() as never,
      factory,
    );

    await expect(
      handler.execute({ phone: '+9665', body: 'hi' }),
    ).rejects.toThrow(/boom/);
    expect(prisma.smsDelivery.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: 'FAILED',
        errorMessage: 'boom',
      }),
    });
  });

  it('skips + logs silently when provider=NONE (no SmsDelivery row)', async () => {
    const prisma = {
      smsDelivery: { create: jest.fn() },
    };
    const factory = {
      forCurrentTenant: jest.fn().mockResolvedValue(new NoOpAdapter()),
    } as unknown as SmsProviderFactory;
    const handler = new SendSmsHandler(
      prisma as never,
      buildTenant() as never,
      factory,
    );

    await expect(
      handler.execute({ phone: '+9665', body: 'hi' }),
    ).resolves.toBeUndefined();
    expect(prisma.smsDelivery.create).not.toHaveBeenCalled();
  });
});
