import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { SmsCredentialsService } from '../../../infrastructure/sms/sms-credentials.service';
import { SmsProviderFactory } from '../../../infrastructure/sms/sms-provider.factory';
import { GetOrgSmsConfigHandler } from './get-org-sms-config.handler';
import { TestSmsConfigHandler } from './test-sms-config.handler';
import { UpsertOrgSmsConfigHandler } from './upsert-org-sms-config.handler';

const buildTenant = (organizationId = 'org-A') => ({
  requireOrganizationIdOrDefault: jest.fn().mockReturnValue(organizationId),
});

const buildCredentials = (): SmsCredentialsService => {
  const cfg: Partial<ConfigService> = {
    get: () => Buffer.alloc(32, 9).toString('base64'),
  };
  return new SmsCredentialsService(cfg as ConfigService);
};

describe('GetOrgSmsConfigHandler', () => {
  it('upserts the singleton and NEVER returns credentialsCiphertext / webhookSecret', async () => {
    const prisma = {
      organizationSmsConfig: {
        upsert: jest.fn().mockResolvedValue({
          id: 'row-1',
          organizationId: 'org-A',
          provider: 'UNIFONIC',
          senderId: 'Deqah',
          credentialsCiphertext: 'cipher-blob',
          webhookSecret: 'secret-blob',
          lastTestAt: null,
          lastTestOk: null,
          createdAt: new Date('2026-04-22'),
          updatedAt: new Date('2026-04-22'),
        }),
      },
    };
    const handler = new GetOrgSmsConfigHandler(
      prisma as never,
      buildTenant() as never,
    );
    const res = await handler.execute();
    expect(res.credentialsConfigured).toBe(true);
    expect(res).not.toHaveProperty('credentialsCiphertext');
    expect(res).not.toHaveProperty('webhookSecret');
    expect(prisma.organizationSmsConfig.upsert).toHaveBeenCalledWith({
      where: { organizationId: 'org-A' },
      update: {},
      create: { organizationId: 'org-A', provider: 'NONE' },
    });
  });

  it('reports credentialsConfigured=false when no ciphertext', async () => {
    const prisma = {
      organizationSmsConfig: {
        upsert: jest.fn().mockResolvedValue({
          id: 'r',
          organizationId: 'org-A',
          provider: 'NONE',
          senderId: null,
          credentialsCiphertext: null,
          webhookSecret: null,
          lastTestAt: null,
          lastTestOk: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      },
    };
    const handler = new GetOrgSmsConfigHandler(
      prisma as never,
      buildTenant() as never,
    );
    const res = await handler.execute();
    expect(res.credentialsConfigured).toBe(false);
  });
});

describe('UpsertOrgSmsConfigHandler', () => {
  const credentials = buildCredentials();

  it('encrypts Unifonic credentials, never persists plaintext', async () => {
    const prisma = {
      organizationSmsConfig: {
        findFirst: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockImplementation(async ({ create }) => ({
          id: 'r',
          organizationId: 'org-A',
          provider: 'UNIFONIC',
          senderId: create.senderId,
          credentialsCiphertext: create.credentialsCiphertext,
          webhookSecret: create.webhookSecret,
          lastTestAt: null,
          lastTestOk: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      },
    };
    const handler = new UpsertOrgSmsConfigHandler(
      prisma as never,
      buildTenant('org-A') as never,
      credentials,
    );
    const res = await handler.execute({
      provider: 'UNIFONIC',
      senderId: 'Deqah',
      unifonic: { appSid: 'SID', apiKey: 'KEY' },
    });
    expect(res.credentialsConfigured).toBe(true);
    const callArg = prisma.organizationSmsConfig.upsert.mock.calls[0][0];
    const ciphertext = callArg.create.credentialsCiphertext as string;
    expect(ciphertext).not.toContain('SID');
    expect(ciphertext).not.toContain('KEY');
    expect(credentials.decrypt(ciphertext, 'org-A')).toEqual({
      appSid: 'SID',
      apiKey: 'KEY',
    });
    expect(typeof callArg.create.webhookSecret).toBe('string');
    expect((callArg.create.webhookSecret as string).length).toBe(64);
  });

  it('rejects UNIFONIC provider without unifonic credentials (bilingual)', async () => {
    const prisma = {
      organizationSmsConfig: {
        findFirst: jest.fn().mockResolvedValue(null),
        upsert: jest.fn(),
      },
    };
    const handler = new UpsertOrgSmsConfigHandler(
      prisma as never,
      buildTenant() as never,
      credentials,
    );
    await expect(
      handler.execute({ provider: 'UNIFONIC' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('reuses webhookSecret when provider unchanged', async () => {
    const prisma = {
      organizationSmsConfig: {
        findFirst: jest.fn().mockResolvedValue({
          provider: 'UNIFONIC',
          webhookSecret: 'existing-secret-abc',
        }),
        upsert: jest.fn().mockImplementation(async ({ update }) => ({
          id: 'r',
          organizationId: 'org-A',
          provider: 'UNIFONIC',
          senderId: update.senderId,
          credentialsCiphertext: update.credentialsCiphertext,
          webhookSecret: update.webhookSecret,
          lastTestAt: null,
          lastTestOk: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      },
    };
    const handler = new UpsertOrgSmsConfigHandler(
      prisma as never,
      buildTenant() as never,
      credentials,
    );
    await handler.execute({
      provider: 'UNIFONIC',
      unifonic: { appSid: 'SID', apiKey: 'KEY' },
    });
    const callArg = prisma.organizationSmsConfig.upsert.mock.calls[0][0];
    expect(callArg.update.webhookSecret).toBe('existing-secret-abc');
  });

  it('sets webhookSecret to null when provider=NONE', async () => {
    const prisma = {
      organizationSmsConfig: {
        findFirst: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockImplementation(async ({ create }) => ({
          id: 'r',
          organizationId: 'org-A',
          provider: 'NONE',
          senderId: null,
          credentialsCiphertext: create.credentialsCiphertext,
          webhookSecret: create.webhookSecret,
          lastTestAt: null,
          lastTestOk: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      },
    };
    const handler = new UpsertOrgSmsConfigHandler(
      prisma as never,
      buildTenant() as never,
      credentials,
    );
    const res = await handler.execute({ provider: 'NONE' });
    expect(res.credentialsConfigured).toBe(false);
    const callArg = prisma.organizationSmsConfig.upsert.mock.calls[0][0];
    expect(callArg.create.webhookSecret).toBeNull();
    expect(callArg.create.credentialsCiphertext).toBeNull();
  });
});

describe('TestSmsConfigHandler', () => {
  it('throws bilingual error when provider=NONE', async () => {
    const prisma = {
      organizationSmsConfig: {
        findFirst: jest.fn().mockResolvedValue({
          provider: 'NONE',
          credentialsCiphertext: null,
        }),
        update: jest.fn(),
      },
    };
    const factory = { forCurrentTenant: jest.fn() } as unknown as SmsProviderFactory;
    const handler = new TestSmsConfigHandler(
      prisma as never,
      buildTenant() as never,
      factory,
    );
    await expect(
      handler.execute({ toPhone: '+9665' }),
    ).rejects.toThrow(BadRequestException);
    expect(factory.forCurrentTenant).not.toHaveBeenCalled();
  });

  it('returns ok=true and stamps lastTestOk=true on success', async () => {
    const prisma = {
      organizationSmsConfig: {
        findFirst: jest.fn().mockResolvedValue({
          provider: 'UNIFONIC',
          credentialsCiphertext: 'cipher',
          senderId: 'Deqah',
        }),
        update: jest.fn(),
      },
    };
    const adapter = {
      send: jest
        .fn()
        .mockResolvedValue({ providerMessageId: 'm-1', status: 'SENT' }),
    };
    const factory = {
      forCurrentTenant: jest.fn().mockResolvedValue(adapter),
    } as unknown as SmsProviderFactory;
    const handler = new TestSmsConfigHandler(
      prisma as never,
      buildTenant() as never,
      factory,
    );
    const res = await handler.execute({ toPhone: '+9665' });
    expect(res).toEqual({ ok: true, providerMessageId: 'm-1' });
    expect(prisma.organizationSmsConfig.update).toHaveBeenCalledWith({
      where: { organizationId: 'org-A' },
      data: expect.objectContaining({ lastTestOk: true }),
    });
  });

  it('returns ok=false with bilingual error on adapter failure', async () => {
    const prisma = {
      organizationSmsConfig: {
        findFirst: jest.fn().mockResolvedValue({
          provider: 'UNIFONIC',
          credentialsCiphertext: 'cipher',
          senderId: null,
        }),
        update: jest.fn(),
      },
    };
    const adapter = {
      send: jest.fn().mockRejectedValue(new Error('boom')),
    };
    const factory = {
      forCurrentTenant: jest.fn().mockResolvedValue(adapter),
    } as unknown as SmsProviderFactory;
    const handler = new TestSmsConfigHandler(
      prisma as never,
      buildTenant() as never,
      factory,
    );
    const res = await handler.execute({ toPhone: '+9665' });
    expect(res.ok).toBe(false);
    expect(res.error?.ar).toMatch(/فشل/);
    expect(res.error?.en).toMatch(/Failed/);
    expect(prisma.organizationSmsConfig.update).toHaveBeenCalledWith({
      where: { organizationId: 'org-A' },
      data: expect.objectContaining({ lastTestOk: false }),
    });
  });
});
