import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { MoyasarCredentialsService } from '../../../infrastructure/payments/moyasar-credentials.service';
import { GetMoyasarConfigHandler } from './get-moyasar-config.handler';
import { UpsertMoyasarConfigHandler } from './upsert-moyasar-config.handler';
import { TestMoyasarConfigHandler } from './test-moyasar-config.handler';

const ORG_ID = 'org-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

const cfg = (key: string): ConfigService =>
  ({ get: (k: string) => (k === 'MOYASAR_TENANT_ENCRYPTION_KEY' ? key : undefined) }) as ConfigService;
const tenant = () => ({ requireOrganizationIdOrDefault: jest.fn().mockReturnValue(ORG_ID) });

const buildPrismaStore = () => {
  const store = new Map<string, {
    organizationId: string;
    publishableKey: string;
    secretKeyEnc: string;
    webhookSecretEnc: string | null;
    isLive: boolean;
    lastVerifiedAt: Date | null;
    lastVerifiedStatus: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>();
  return {
    store,
    organizationPaymentConfig: {
      upsert: jest.fn(({ where, create, update }) => {
        const existing = store.get(where.organizationId);
        const next = existing
          ? { ...existing, ...update, updatedAt: new Date() }
          : { ...create, lastVerifiedAt: null, lastVerifiedStatus: null, createdAt: new Date(), updatedAt: new Date() };
        store.set(where.organizationId, next);
        return Promise.resolve(next);
      }),
      findUnique: jest.fn(({ where }) => Promise.resolve(store.get(where.organizationId) ?? null)),
      update: jest.fn(({ where, data }) => {
        const existing = store.get(where.organizationId);
        if (!existing) throw new Error('not found');
        const next = { ...existing, ...data, updatedAt: new Date() };
        store.set(where.organizationId, next);
        return Promise.resolve(next);
      }),
    },
  };
};

const mockMoyasarClient = () => ({ invalidate: jest.fn() });

describe('UpsertMoyasarConfigHandler', () => {
  it('encrypts the secret with org-bound AAD, stores publishableKey plain', async () => {
    const key = randomBytes(32).toString('base64');
    const creds = new MoyasarCredentialsService(cfg(key));
    const prisma = buildPrismaStore();
    const handler = new UpsertMoyasarConfigHandler(prisma as never, tenant() as never, creds, mockMoyasarClient() as never);

    const result = await handler.execute({
      publishableKey: 'pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      secretKey: 'sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      webhookSecret: 'whsec_testvalue00000000000000',
      isLive: false,
    });

    expect(result.publishableKey).toBe('pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
    const saved = prisma.store.get(ORG_ID)!;
    const decrypted = creds.decrypt<{ secretKey: string }>(saved.secretKeyEnc, ORG_ID);
    expect(decrypted.secretKey).toBe('sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
    // ciphertext must NOT be plaintext lookalike
    expect(saved.secretKeyEnc).not.toContain('sk_test_');
  });

  it('clears verification state on update so admin must re-test', async () => {
    const key = randomBytes(32).toString('base64');
    const creds = new MoyasarCredentialsService(cfg(key));
    const prisma = buildPrismaStore();
    prisma.store.set(ORG_ID, {
      organizationId: ORG_ID,
      publishableKey: 'pk_test_old',
      secretKeyEnc: creds.encrypt({ secretKey: 'sk_test_old' }, ORG_ID),
      webhookSecretEnc: null,
      isLive: false,
      lastVerifiedAt: new Date('2026-04-01'),
      lastVerifiedStatus: 'OK',
      createdAt: new Date('2026-03-01'),
      updatedAt: new Date('2026-04-01'),
    });
    const handler = new UpsertMoyasarConfigHandler(prisma as never, tenant() as never, creds, mockMoyasarClient() as never);

    await handler.execute({
      publishableKey: 'pk_test_new00000000000000000000',
      secretKey: 'sk_test_new00000000000000000000',
      webhookSecret: 'whsec_newvalue000000000000000',
      isLive: false,
    });

    const saved = prisma.store.get(ORG_ID)!;
    expect(saved.lastVerifiedAt).toBeNull();
    expect(saved.lastVerifiedStatus).toBeNull();
  });

  it('persists webhook secret AES-256-GCM encrypted', async () => {
    const key = randomBytes(32).toString('base64');
    const creds = new MoyasarCredentialsService(cfg(key));
    const prisma = buildPrismaStore();
    const handler = new UpsertMoyasarConfigHandler(prisma as never, tenant() as never, creds, mockMoyasarClient() as never);

    await handler.execute({
      publishableKey: 'pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      secretKey: 'sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      webhookSecret: 'whsec_supersecret',
      isLive: false,
    });
    const saved = prisma.store.get(ORG_ID)!;
    expect(saved.webhookSecretEnc).not.toBeNull();
    expect(creds.decrypt<{ webhookSecret: string }>(saved.webhookSecretEnc!, ORG_ID).webhookSecret).toBe('whsec_supersecret');
  });
});

describe('GetMoyasarConfigHandler', () => {
  it('returns null when no config exists', async () => {
    const prisma = buildPrismaStore();
    const handler = new GetMoyasarConfigHandler(prisma as never, tenant() as never);
    expect(await handler.execute()).toBeNull();
  });

  it('returns masked secret + flags but never the raw ciphertext', async () => {
    const key = randomBytes(32).toString('base64');
    const creds = new MoyasarCredentialsService(cfg(key));
    const prisma = buildPrismaStore();
    prisma.store.set(ORG_ID, {
      organizationId: ORG_ID,
      publishableKey: 'pk_test_abcdefghijklmnopqrstuvwxyz1234',
      secretKeyEnc: creds.encrypt({ secretKey: 'sk_test_secretvalue' }, ORG_ID),
      webhookSecretEnc: null,
      isLive: false,
      lastVerifiedAt: null,
      lastVerifiedStatus: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const handler = new GetMoyasarConfigHandler(prisma as never, tenant() as never);
    const result = (await handler.execute())!;
    expect(result.publishableKey).toBe('pk_test_abcdefghijklmnopqrstuvwxyz1234');
    expect(result.secretKeyMasked).toBe('sk_test_•••••••1234');
    expect(result).not.toHaveProperty('secretKeyEnc');
    expect(result.hasWebhookSecret).toBe(false);
  });
});

describe('TestMoyasarConfigHandler', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  it('throws BadRequest when no config exists', async () => {
    const prisma = buildPrismaStore();
    const handler = new TestMoyasarConfigHandler(prisma as never, tenant() as never, {} as never);
    await expect(handler.execute()).rejects.toBeInstanceOf(BadRequestException);
  });

  it('marks lastVerifiedStatus=OK on 200 and returns ok=true', async () => {
    const key = randomBytes(32).toString('base64');
    const creds = new MoyasarCredentialsService(cfg(key));
    const prisma = buildPrismaStore();
    prisma.store.set(ORG_ID, {
      organizationId: ORG_ID,
      publishableKey: 'pk_test_x',
      secretKeyEnc: creds.encrypt({ secretKey: 'sk_test_x' }, ORG_ID),
      webhookSecretEnc: null,
      isLive: false,
      lastVerifiedAt: null,
      lastVerifiedStatus: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    global.fetch = jest.fn().mockResolvedValue({ status: 200 }) as never;
    const handler = new TestMoyasarConfigHandler(prisma as never, tenant() as never, creds);
    const result = await handler.execute();
    expect(result).toEqual({ ok: true, status: 'OK' });
    expect(prisma.store.get(ORG_ID)!.lastVerifiedStatus).toBe('OK');
    expect(prisma.store.get(ORG_ID)!.lastVerifiedAt).not.toBeNull();
  });

  it('marks lastVerifiedStatus=INVALID_KEY on 401', async () => {
    const key = randomBytes(32).toString('base64');
    const creds = new MoyasarCredentialsService(cfg(key));
    const prisma = buildPrismaStore();
    prisma.store.set(ORG_ID, {
      organizationId: ORG_ID,
      publishableKey: 'pk_test_x',
      secretKeyEnc: creds.encrypt({ secretKey: 'sk_test_x' }, ORG_ID),
      webhookSecretEnc: null,
      isLive: false,
      lastVerifiedAt: null,
      lastVerifiedStatus: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    global.fetch = jest.fn().mockResolvedValue({ status: 401 }) as never;
    const handler = new TestMoyasarConfigHandler(prisma as never, tenant() as never, creds);
    const result = await handler.execute();
    expect(result).toEqual({ ok: false, status: 'INVALID_KEY' });
  });

  it('marks lastVerifiedStatus=NETWORK_ERROR on fetch throw', async () => {
    const key = randomBytes(32).toString('base64');
    const creds = new MoyasarCredentialsService(cfg(key));
    const prisma = buildPrismaStore();
    prisma.store.set(ORG_ID, {
      organizationId: ORG_ID,
      publishableKey: 'pk_test_x',
      secretKeyEnc: creds.encrypt({ secretKey: 'sk_test_x' }, ORG_ID),
      webhookSecretEnc: null,
      isLive: false,
      lastVerifiedAt: null,
      lastVerifiedStatus: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) as never;
    const handler = new TestMoyasarConfigHandler(prisma as never, tenant() as never, creds);
    const result = await handler.execute();
    expect(result.status).toBe('NETWORK_ERROR');
    expect(result.ok).toBe(false);
  });
});
