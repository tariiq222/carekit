import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuthenticaClient, AuthenticaSendOtpInput, AuthenticaError } from './authentica.client';

describe('AuthenticaClient', () => {
  let client: AuthenticaClient;
  let fetchMock: jest.Mock;

  beforeEach(async () => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const module = await Test.createTestingModule({
      providers: [
        AuthenticaClient,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const map: Record<string, string> = {
                AUTHENTICA_API_KEY: 'apikey-test',
                AUTHENTICA_BASE_URL: 'https://api.authentica.test',
                AUTHENTICA_DEFAULT_TEMPLATE_ID: '1',
              };
              return map[key];
            }),
          },
        },
      ],
    }).compile();

    client = module.get(AuthenticaClient);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('isConfigured returns false when API key is missing', () => {
    const noKey = new AuthenticaClient({
      get: () => undefined,
    } as unknown as ConfigService);
    expect(noKey.isConfigured()).toBe(false);
  });

  it('isConfigured returns true when API key is set', () => {
    expect(client.isConfigured()).toBe(true);
  });

  describe('sendOtp', () => {
    it('POSTs /api/v2/send-otp with X-Authorization header and method+phone+otp body for SMS', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, data: {}, message: 'ok' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const input: AuthenticaSendOtpInput = {
        channel: 'SMS',
        identifier: '+966512345678',
        code: '123456',
      };
      await client.sendOtp(input);

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.authentica.test/api/v2/send-otp');
      expect((init as RequestInit).method).toBe('POST');
      const headers = (init as RequestInit).headers as Record<string, string>;
      expect(headers['X-Authorization']).toBe('apikey-test');
      expect(headers['Accept']).toBe('application/json');
      expect(headers['Content-Type']).toBe('application/json');
      expect(JSON.parse((init as RequestInit).body as string)).toEqual({
        method: 'sms',
        phone: '+966512345678',
        otp: '123456',
        template_id: 1,
      });
    });

    it('uses email field for EMAIL channel', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, data: {}, message: 'ok' }), { status: 200 }),
      );
      await client.sendOtp({ channel: 'EMAIL', identifier: 'a@b.c', code: '111111' });
      const [, init] = fetchMock.mock.calls[0];
      const body = JSON.parse((init as RequestInit).body as string);
      expect(body.method).toBe('email');
      expect(body.email).toBe('a@b.c');
      expect(body.phone).toBeUndefined();
    });

    it('throws AuthenticaError with message from errors[0].message on failure', async () => {
      fetchMock.mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify({ errors: [{ message: 'Phone format invalid' }] }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }),
        ),
      );
      await expect(
        client.sendOtp({ channel: 'SMS', identifier: '0512345678', code: '123456' }),
      ).rejects.toThrow(AuthenticaError);
      await expect(
        client.sendOtp({ channel: 'SMS', identifier: '0512345678', code: '123456' }),
      ).rejects.toThrow('Phone format invalid');
    });
  });

  describe('getBalance', () => {
    it('GETs /api/v2/balance and returns data.balance', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ success: true, data: { balance: 87 }, message: 'ok' }),
          { status: 200 },
        ),
      );

      const balance = await client.getBalance();

      expect(balance).toBe(87);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.authentica.test/api/v2/balance');
      expect((init as RequestInit).method).toBe('GET');
    });
  });
});
