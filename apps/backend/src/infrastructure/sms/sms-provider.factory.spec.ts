import type { PrismaService } from '../database/prisma.service';
import { NoOpAdapter } from './no-op.adapter';
import { SmsCredentialsService } from './sms-credentials.service';
import { SmsProviderFactory } from './sms-provider.factory';
import { TaqnyatAdapter } from './taqnyat.adapter';
import { UnifonicAdapter } from './unifonic.adapter';

function makeSvc(
  row: Record<string, unknown> | null,
  credentials: SmsCredentialsService,
): SmsProviderFactory {
  const prisma = {
    organizationSmsConfig: {
      findFirst: jest.fn().mockResolvedValue(row),
    },
  } as unknown as PrismaService;
  return new SmsProviderFactory(prisma, credentials);
}

function makeCreds(): SmsCredentialsService {
  const svc = new SmsCredentialsService({
    get: () => Buffer.alloc(32, 3).toString('base64'),
  } as never);
  return svc;
}

describe('SmsProviderFactory', () => {
  const creds = makeCreds();

  it('returns NoOpAdapter when no config row', async () => {
    const f = makeSvc(null, creds);
    const adapter = await f.forCurrentTenant('org-1');
    expect(adapter).toBeInstanceOf(NoOpAdapter);
  });

  it('returns NoOpAdapter when provider=NONE', async () => {
    const f = makeSvc(
      { provider: 'NONE', credentialsCiphertext: null },
      creds,
    );
    expect(await f.forCurrentTenant('org-1')).toBeInstanceOf(NoOpAdapter);
  });

  it('returns NoOpAdapter when credentials are missing', async () => {
    const f = makeSvc(
      { provider: 'UNIFONIC', credentialsCiphertext: null },
      creds,
    );
    expect(await f.forCurrentTenant('org-1')).toBeInstanceOf(NoOpAdapter);
  });

  it('returns UnifonicAdapter for UNIFONIC provider', async () => {
    const ciphertext = creds.encrypt(
      { appSid: 'a', apiKey: 'b' },
      'org-1',
    );
    const f = makeSvc(
      { provider: 'UNIFONIC', credentialsCiphertext: ciphertext },
      creds,
    );
    const adapter = await f.forCurrentTenant('org-1');
    expect(adapter).toBeInstanceOf(UnifonicAdapter);
  });

  it('returns TaqnyatAdapter for TAQNYAT provider', async () => {
    const ciphertext = creds.encrypt({ apiToken: 't' }, 'org-2');
    const f = makeSvc(
      { provider: 'TAQNYAT', credentialsCiphertext: ciphertext },
      creds,
    );
    const adapter = await f.forCurrentTenant('org-2');
    expect(adapter).toBeInstanceOf(TaqnyatAdapter);
  });

  it('buildTransient picks adapter by provider name', () => {
    const f = makeSvc(null, creds);
    expect(
      f.buildTransient('UNIFONIC', { appSid: 'a', apiKey: 'b' }),
    ).toBeInstanceOf(UnifonicAdapter);
    expect(
      f.buildTransient('TAQNYAT', { apiToken: 't' }),
    ).toBeInstanceOf(TaqnyatAdapter);
  });
});
