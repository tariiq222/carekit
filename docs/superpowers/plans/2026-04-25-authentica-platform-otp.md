# Authentica Platform OTP Implementation Plan

> ⏸️ **STATUS: PAUSED — 2026-04-25.** Owner reported a login/sign-in issue on the Authentica side (portal.authentica.sa). Cannot obtain a working `AUTHENTICA_API_KEY` to validate the integration end-to-end. Plan + architectural decisions are final; resume from Task 1 once portal access is restored. Do not start implementation until then.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire **Authentica** (`api.authentica.sa`) as the single, platform-wide OTP delivery provider for SMS, WhatsApp, and (optionally) Email across every tenant and every user — distinct from the per-tenant SMS notification providers (Unifonic / Taqnyat) that already live under `OrganizationSmsConfig`.

**Architecture:** OTP delivery is a **platform concern** — CareKit owns one Authentica account, charges nothing to tenants for it, and tenants never see the credentials. Implementation slots into the existing `NotificationChannelRegistry` pattern: today it has only `EmailChannelAdapter` (SMTP); we add `SmsChannelAdapter` + `WhatsappChannelAdapter`, both delegating to a shared `AuthenticaClient`. The per-tenant SMS provider stack stays untouched — it is for booking/marketing notifications, not OTP.

**Tech Stack:** NestJS 11, axios/fetch, Prisma 7 (enum addition), Authentica REST API v2, Jest.

---

## Why this is platform-wide (and the SMS cluster is not)

| | Per-tenant SMS (Unifonic/Taqnyat) | Platform OTP (Authentica) |
|---|---|---|
| Scope | One config per `Organization` | One config for the whole CareKit platform |
| Credentials | `OrganizationSmsConfig` (AES-GCM, orgId AAD) | `AUTHENTICA_API_KEY` env var |
| Who pays | Tenant pays Authentica/Unifonic directly | CareKit pays Authentica, absorbs the cost |
| Used for | Booking confirmations, reminders, marketing | Sign-up, login, password reset, sensitive-action confirmation |
| Tenant context | Required (AAD on decrypt) | Not required — same key for every caller |
| Failure mode | Tenant config missing → SMS fails for that tenant only | Authentica balance exhausted → OTP fails platform-wide |

Keep these tracks **separate**. Do not reuse `OrganizationSmsConfig` for OTP; do not reuse Authentica for booking SMS.

---

## File Structure

| File | Responsibility |
|---|---|
| `apps/backend/src/infrastructure/authentica/authentica.client.ts` (create) | Thin HTTP client: `sendOtp({channel, identifier, code})`, `verifyOtp({identifier, otp})`, `getBalance()`. Owns the X-Authorization header, response normalization, error formatting. |
| `apps/backend/src/infrastructure/authentica/authentica.module.ts` (create) | Nest module exporting `AuthenticaClient` |
| `apps/backend/src/infrastructure/authentica/authentica.client.spec.ts` (create) | Contract tests with mocked fetch |
| `apps/backend/src/modules/comms/notification-channel/sms-channel.adapter.ts` (create) | Implements `NotificationChannel` for `OtpChannel.SMS` — delegates to AuthenticaClient |
| `apps/backend/src/modules/comms/notification-channel/whatsapp-channel.adapter.ts` (create) | Same for `OtpChannel.WHATSAPP` |
| `apps/backend/src/modules/comms/notification-channel/notification-channel-registry.ts` (modify) | Register the two new adapters |
| `apps/backend/src/modules/comms/notification-channel/notification-channel.module.ts` (modify) | Provide AuthenticaModule + new adapters |
| `apps/backend/src/modules/comms/notification-channel/notification-channel.spec.ts` (modify) | Cover the new channels |
| `apps/backend/prisma/schema/identity.prisma` (modify) | Add `WHATSAPP` to `OtpChannel` enum |
| `apps/backend/prisma/migrations/<timestamp>_add_whatsapp_otp_channel/migration.sql` (create) | The migration |
| `apps/backend/.env.example` (modify) | Document the three new env vars |

**Out of scope:**
- Custom SMS sender names (`/api/v2/send-sms`) — only OTP `/send-otp` + `/verify-otp` are wired
- Face / voice verification — Authentica supports them, but we ship them only when the product asks
- Balance dashboard widget — file a follow-up
- Replacing the existing SMTP `EmailChannelAdapter` with Authentica's email — SMTP is already working; switching requires a separate cost/template decision
- Per-tenant Authentica overrides — explicitly NOT supported by this design

---

## Env vars (added in Task 1)

```bash
# Platform-wide OTP delivery (Authentica). Same key for every tenant.
AUTHENTICA_API_KEY="$2y$10$..."          # from portal.authentica.sa/settings/apikeys/
AUTHENTICA_BASE_URL=https://api.authentica.sa
AUTHENTICA_DEFAULT_TEMPLATE_ID=1         # optional; 1 == default. Must match channel.
```

If `AUTHENTICA_API_KEY` is unset:
- The new SMS / WhatsApp adapters log a warning and silently no-op (matches `EmailChannelAdapter` SMTP-unavailable behavior). Tests/dev environments without a real key keep working.

---

## Task 1: Document env vars + add `WHATSAPP` to OtpChannel enum

**Files:**
- Modify: `apps/backend/.env.example`
- Modify: `apps/backend/prisma/schema/identity.prisma`
- Create: `apps/backend/prisma/migrations/<timestamp>_add_whatsapp_otp_channel/migration.sql`

- [ ] **Step 1: Append env doc**

Append to `apps/backend/.env.example` under a new `# --- Authentica (platform OTP) ---` section:

```bash
# --- Authentica (platform OTP — same key for every tenant) ---
# https://portal.authentica.sa/settings/apikeys/
# Distinct from OrganizationSmsConfig (per-tenant booking SMS via Unifonic/Taqnyat).
AUTHENTICA_API_KEY=
AUTHENTICA_BASE_URL=https://api.authentica.sa
AUTHENTICA_DEFAULT_TEMPLATE_ID=1
```

- [ ] **Step 2: Extend the OtpChannel enum**

Edit `apps/backend/prisma/schema/identity.prisma`. Change:

```prisma
enum OtpChannel {
  EMAIL
  SMS
}
```

to:

```prisma
enum OtpChannel {
  EMAIL
  SMS
  WHATSAPP
}
```

- [ ] **Step 3: Generate the migration**

Run from `apps/backend`:

```bash
npx prisma migrate dev --name add_whatsapp_otp_channel --create-only
```

Inspect the generated SQL — it must be a single `ALTER TYPE "OtpChannel" ADD VALUE 'WHATSAPP';`. Anything more = abort and investigate.

- [ ] **Step 4: Apply + regenerate client**

```bash
npx prisma migrate dev
npx prisma generate
```

- [ ] **Step 5: Confirm typecheck still passes**

```bash
npm run typecheck --workspace=apps/backend
```
Expected: 0 errors. If `OtpChannel.WHATSAPP` is referenced nowhere yet, that's fine.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/.env.example apps/backend/prisma/schema/identity.prisma \
        apps/backend/prisma/migrations/*_add_whatsapp_otp_channel
git commit -m "feat(otp): add WHATSAPP channel + Authentica env config

Adds the WHATSAPP value to the OtpChannel enum (DB migration) and
documents the three Authentica env vars in .env.example. Wiring of the
actual provider lives in the next commits."
```

---

## Task 2: Build `AuthenticaClient` (thin HTTP client + tests)

**Files:**
- Create: `apps/backend/src/infrastructure/authentica/authentica.client.ts`
- Create: `apps/backend/src/infrastructure/authentica/authentica.client.spec.ts`
- Create: `apps/backend/src/infrastructure/authentica/authentica.module.ts`
- Create: `apps/backend/src/infrastructure/authentica/index.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/backend/src/infrastructure/authentica/authentica.client.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuthenticaClient, AuthenticaSendOtpInput } from './authentica.client';

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

  it('isConfigured returns false when API key is missing', async () => {
    const noKey = new AuthenticaClient({
      get: () => undefined,
    } as unknown as ConfigService);
    expect(noKey.isConfigured()).toBe(false);
  });

  it('isConfigured returns true when API key is set', () => {
    expect(client.isConfigured()).toBe(true);
  });

  describe('sendOtp', () => {
    it('POSTs /api/v2/send-otp with X-Authorization, JSON body, and method+phone+otp', async () => {
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

    it('uses whatsapp method for WHATSAPP channel', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, data: {}, message: 'ok' }), { status: 200 }),
      );
      await client.sendOtp({ channel: 'WHATSAPP', identifier: '+966500000000', code: '999999' });
      const [, init] = fetchMock.mock.calls[0];
      const body = JSON.parse((init as RequestInit).body as string);
      expect(body.method).toBe('whatsapp');
      expect(body.phone).toBe('+966500000000');
    });

    it('throws AuthenticaError with message from errors[0].message on failure', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ errors: [{ message: 'Phone format invalid' }] }),
          { status: 400 },
        ),
      );
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
```

- [ ] **Step 2: Run — should fail (file does not exist)**

```bash
cd apps/backend && npx jest src/infrastructure/authentica
```
Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Implement the client**

Create `apps/backend/src/infrastructure/authentica/authentica.client.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type AuthenticaChannel = 'EMAIL' | 'SMS' | 'WHATSAPP';

export interface AuthenticaSendOtpInput {
  channel: AuthenticaChannel;
  // Phone in E.164 (+9665…) for SMS/WHATSAPP, email address for EMAIL.
  identifier: string;
  // 6-digit code we generated locally; Authentica will deliver it verbatim
  // when an `otp` field is provided in the body.
  code: string;
  // Optional override; default 1 (matches AUTHENTICA_DEFAULT_TEMPLATE_ID).
  templateId?: number;
}

export class AuthenticaError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'AuthenticaError';
  }
}

@Injectable()
export class AuthenticaClient {
  private readonly logger = new Logger(AuthenticaClient.name);
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  private readonly defaultTemplateId: number;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('AUTHENTICA_API_KEY');
    this.baseUrl = config.get<string>('AUTHENTICA_BASE_URL') ?? 'https://api.authentica.sa';
    this.defaultTemplateId = Number(config.get<string>('AUTHENTICA_DEFAULT_TEMPLATE_ID') ?? '1');
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async sendOtp(input: AuthenticaSendOtpInput): Promise<void> {
    if (!this.apiKey) {
      // Configured no-op so dev/CI without a real key keeps working.
      this.logger.warn(`Authentica unconfigured — skipping ${input.channel} OTP delivery`);
      return;
    }

    const body: Record<string, unknown> = {
      method: input.channel.toLowerCase(),
      template_id: input.templateId ?? this.defaultTemplateId,
      otp: input.code,
    };
    if (input.channel === 'EMAIL') {
      body.email = input.identifier;
    } else {
      body.phone = input.identifier;
    }

    await this.request('POST', '/api/v2/send-otp', body);
  }

  async getBalance(): Promise<number> {
    if (!this.apiKey) return 0;
    const data = await this.request<{ data: { balance: number } }>('GET', '/api/v2/balance');
    return data.data?.balance ?? 0;
  }

  // ---------------------------------------------------------------------------
  // private
  // ---------------------------------------------------------------------------

  private async request<T = unknown>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const init: RequestInit = {
      method,
      headers: {
        'X-Authorization': this.apiKey ?? '',
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    };

    const res = await fetch(url, init);

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      const message =
        (json as { errors?: Array<{ message?: string }> }).errors?.[0]?.message ??
        res.statusText ??
        'Authentica request failed';
      throw new AuthenticaError(res.status, message);
    }

    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }
}
```

- [ ] **Step 4: Create the module**

Create `apps/backend/src/infrastructure/authentica/authentica.module.ts`:

```typescript
import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthenticaClient } from './authentica.client';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [AuthenticaClient],
  exports: [AuthenticaClient],
})
export class AuthenticaModule {}
```

Create `apps/backend/src/infrastructure/authentica/index.ts`:

```typescript
export { AuthenticaClient, AuthenticaError } from './authentica.client';
export type { AuthenticaChannel, AuthenticaSendOtpInput } from './authentica.client';
export { AuthenticaModule } from './authentica.module';
```

- [ ] **Step 5: Run tests — green**

```bash
cd apps/backend && npx jest src/infrastructure/authentica
```
Expected: 6 / 6 PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/infrastructure/authentica
git commit -m "feat(authentica): platform OTP HTTP client + module

Thin client over api.authentica.sa exposing sendOtp() and getBalance().
Single X-Authorization header (Authentica's quirk — not Authorization),
JSON body, normalized error extraction from the errors[0].message shape
the API uses across endpoints. Configured-no-op when AUTHENTICA_API_KEY
is unset so dev/CI environments without a real key keep working.

6/6 contract tests green."
```

---

## Task 3: SmsChannelAdapter + WhatsappChannelAdapter

**Files:**
- Create: `apps/backend/src/modules/comms/notification-channel/sms-channel.adapter.ts`
- Create: `apps/backend/src/modules/comms/notification-channel/whatsapp-channel.adapter.ts`
- Modify: `apps/backend/src/modules/comms/notification-channel/notification-channel-registry.ts`
- Modify: `apps/backend/src/modules/comms/notification-channel/notification-channel.module.ts`
- Modify: `apps/backend/src/modules/comms/notification-channel/notification-channel.spec.ts`

- [ ] **Step 1: SmsChannelAdapter**

Create `apps/backend/src/modules/comms/notification-channel/sms-channel.adapter.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { OtpChannel } from '@prisma/client';
import { AuthenticaClient } from '../../../infrastructure/authentica';
import { NotificationChannel } from './notification-channel';

@Injectable()
export class SmsChannelAdapter implements NotificationChannel {
  private readonly logger = new Logger(SmsChannelAdapter.name);
  readonly kind = OtpChannel.SMS;

  constructor(private readonly authentica: AuthenticaClient) {}

  async send(identifier: string, code: string): Promise<void> {
    if (!this.authentica.isConfigured()) {
      this.logger.warn(`Authentica unconfigured — skipping SMS OTP to ${maskPhone(identifier)}`);
      return;
    }
    try {
      await this.authentica.sendOtp({ channel: 'SMS', identifier, code });
    } catch (err) {
      this.logger.error(
        `Authentica SMS OTP failed for ${maskPhone(identifier)}`,
        err instanceof Error ? err.message : err,
      );
      throw err;
    }
  }
}

function maskPhone(phone: string): string {
  if (phone.length <= 4) return '***';
  return `${phone.slice(0, 4)}***${phone.slice(-2)}`;
}
```

- [ ] **Step 2: WhatsappChannelAdapter**

Create `apps/backend/src/modules/comms/notification-channel/whatsapp-channel.adapter.ts` — identical structure with `OtpChannel.WHATSAPP` and `channel: 'WHATSAPP'`. Show the full file:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { OtpChannel } from '@prisma/client';
import { AuthenticaClient } from '../../../infrastructure/authentica';
import { NotificationChannel } from './notification-channel';

@Injectable()
export class WhatsappChannelAdapter implements NotificationChannel {
  private readonly logger = new Logger(WhatsappChannelAdapter.name);
  readonly kind = OtpChannel.WHATSAPP;

  constructor(private readonly authentica: AuthenticaClient) {}

  async send(identifier: string, code: string): Promise<void> {
    if (!this.authentica.isConfigured()) {
      this.logger.warn(`Authentica unconfigured — skipping WhatsApp OTP to ${maskPhone(identifier)}`);
      return;
    }
    try {
      await this.authentica.sendOtp({ channel: 'WHATSAPP', identifier, code });
    } catch (err) {
      this.logger.error(
        `Authentica WhatsApp OTP failed for ${maskPhone(identifier)}`,
        err instanceof Error ? err.message : err,
      );
      throw err;
    }
  }
}

function maskPhone(phone: string): string {
  if (phone.length <= 4) return '***';
  return `${phone.slice(0, 4)}***${phone.slice(-2)}`;
}
```

- [ ] **Step 3: Register them**

Edit `apps/backend/src/modules/comms/notification-channel/notification-channel-registry.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { OtpChannel } from '@prisma/client';
import { NotificationChannel } from './notification-channel';
import { EmailChannelAdapter } from './email-channel.adapter';
import { SmsChannelAdapter } from './sms-channel.adapter';
import { WhatsappChannelAdapter } from './whatsapp-channel.adapter';

@Injectable()
export class NotificationChannelRegistry {
  private readonly channels: Map<OtpChannel, NotificationChannel> = new Map();

  constructor(
    private readonly emailAdapter: EmailChannelAdapter,
    private readonly smsAdapter: SmsChannelAdapter,
    private readonly whatsappAdapter: WhatsappChannelAdapter,
  ) {
    this.channels.set(OtpChannel.EMAIL, this.emailAdapter);
    this.channels.set(OtpChannel.SMS, this.smsAdapter);
    this.channels.set(OtpChannel.WHATSAPP, this.whatsappAdapter);
  }

  resolve(kind: OtpChannel): NotificationChannel {
    const channel = this.channels.get(kind);
    if (!channel) {
      throw new Error(`No notification channel registered for kind: ${kind}`);
    }
    return channel;
  }
}
```

- [ ] **Step 4: Wire into the comms module**

Edit `apps/backend/src/modules/comms/notification-channel/notification-channel.module.ts`. Read the current providers list, then add:
- `SmsChannelAdapter`
- `WhatsappChannelAdapter`
- import `AuthenticaModule` from `../../../infrastructure/authentica`

Show the full final file in the commit:

```typescript
import { Module } from '@nestjs/common';
import { MailModule } from '../../../infrastructure/mail';
import { AuthenticaModule } from '../../../infrastructure/authentica';
import { EmailChannelAdapter } from './email-channel.adapter';
import { SmsChannelAdapter } from './sms-channel.adapter';
import { WhatsappChannelAdapter } from './whatsapp-channel.adapter';
import { NotificationChannelRegistry } from './notification-channel-registry';

@Module({
  imports: [MailModule, AuthenticaModule],
  providers: [
    EmailChannelAdapter,
    SmsChannelAdapter,
    WhatsappChannelAdapter,
    NotificationChannelRegistry,
  ],
  exports: [NotificationChannelRegistry],
})
export class NotificationChannelModule {}
```

> If the actual file imports `MailModule` from a different relative path or has additional providers, preserve those — only add the three lines (`AuthenticaModule`, `SmsChannelAdapter`, `WhatsappChannelAdapter`).

- [ ] **Step 5: Update the registry spec**

Edit `apps/backend/src/modules/comms/notification-channel/notification-channel.spec.ts`. Add coverage that:
1. The registry resolves SMS to `SmsChannelAdapter`.
2. The registry resolves WHATSAPP to `WhatsappChannelAdapter`.
3. Each adapter calls `AuthenticaClient.sendOtp` with the correct channel string.

Sample additions (append to the existing describe block):

```typescript
describe('SmsChannelAdapter', () => {
  it('delegates to AuthenticaClient.sendOtp with SMS', async () => {
    const authentica = {
      isConfigured: () => true,
      sendOtp: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuthenticaClient;
    const adapter = new SmsChannelAdapter(authentica);
    await adapter.send('+966500000000', '123456');
    expect(authentica.sendOtp).toHaveBeenCalledWith({
      channel: 'SMS',
      identifier: '+966500000000',
      code: '123456',
    });
  });

  it('no-ops when Authentica is not configured', async () => {
    const authentica = {
      isConfigured: () => false,
      sendOtp: jest.fn(),
    } as unknown as AuthenticaClient;
    const adapter = new SmsChannelAdapter(authentica);
    await expect(adapter.send('+966500000000', '111111')).resolves.toBeUndefined();
    expect(authentica.sendOtp).not.toHaveBeenCalled();
  });
});

describe('WhatsappChannelAdapter', () => {
  it('delegates to AuthenticaClient.sendOtp with WHATSAPP', async () => {
    const authentica = {
      isConfigured: () => true,
      sendOtp: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuthenticaClient;
    const adapter = new WhatsappChannelAdapter(authentica);
    await adapter.send('+966500000000', '654321');
    expect(authentica.sendOtp).toHaveBeenCalledWith({
      channel: 'WHATSAPP',
      identifier: '+966500000000',
      code: '654321',
    });
  });
});

describe('NotificationChannelRegistry — SMS + WHATSAPP', () => {
  it('resolves SMS to SmsChannelAdapter', () => {
    const sms = { kind: OtpChannel.SMS, send: jest.fn() } as unknown as SmsChannelAdapter;
    const wa = { kind: OtpChannel.WHATSAPP, send: jest.fn() } as unknown as WhatsappChannelAdapter;
    const email = { kind: OtpChannel.EMAIL, send: jest.fn() } as unknown as EmailChannelAdapter;
    const registry = new NotificationChannelRegistry(email, sms, wa);
    expect(registry.resolve(OtpChannel.SMS)).toBe(sms);
    expect(registry.resolve(OtpChannel.WHATSAPP)).toBe(wa);
  });
});
```

Add the matching imports at the top of the spec.

- [ ] **Step 6: Run tests**

```bash
cd apps/backend && npx jest src/modules/comms/notification-channel src/infrastructure/authentica
```
Expected: all green.

- [ ] **Step 7: Run identity OTP suites to confirm no regression**

```bash
npx jest src/modules/identity/otp
```
Expected: 0 failures. The OTP handlers don't change — they call `channelRegistry.resolve(channel).send(...)` exactly as before.

- [ ] **Step 8: Commit**

```bash
git add apps/backend/src/modules/comms/notification-channel
git commit -m "feat(otp): SMS + WhatsApp channel adapters via Authentica

Both adapters implement the existing NotificationChannel interface and
delegate to AuthenticaClient. The registry now resolves all three OTP
channels (EMAIL stays SMTP; SMS + WHATSAPP go through Authentica). When
AUTHENTICA_API_KEY is unset the adapters log + no-op (matches
EmailChannelAdapter's SMTP-unavailable behaviour).

Identity OTP suites remain green — no handler changes needed."
```

---

## Task 4: End-to-end smoke test against real Authentica (optional, gated)

Skipped automatically if `AUTHENTICA_API_KEY` is unset.

- [ ] **Step 1: Spot-check balance**

```bash
curl -s -H "X-Authorization: $AUTHENTICA_API_KEY" \
  -H "Accept: application/json" \
  https://api.authentica.sa/api/v2/balance
```
Expected: `{"success":true,"data":{"balance":<int>},"message":"…"}`. Aborts the smoke test if balance < 5 — don't burn the demo allowance.

- [ ] **Step 2: Trigger a real SMS OTP via the existing CareKit endpoint**

```bash
curl -s -X POST http://localhost:5100/api/v1/public/otp/request \
  -H 'Content-Type: application/json' \
  -d '{"identifier":"+9665XXXXXXXX","channel":"SMS","purpose":"CLIENT_LOGIN","hCaptchaToken":"<token>"}'
```
Expected: 200 + `{"success":true}` AND a real SMS arrives within ~10 s.

- [ ] **Step 3: Document outcome**

Write a short note under `docs/superpowers/qa/authentica-otp-smoke-<date>.md` with the request, response, balance before/after, and any latency observed.

---

## Task 5: Final verification + PR

- [ ] **Step 1: All backend tests**

```bash
cd apps/backend && npm run test
```
Expected: previous totals + ~10 new tests, all green.

- [ ] **Step 2: typecheck the workspace**

```bash
npm run typecheck --workspace=apps/backend
```
Expected: 0 errors.

- [ ] **Step 3: PR**

Title: `feat(otp): platform-wide Authentica OTP delivery`

Body:
- One Authentica account for the whole platform; tenants never see the key.
- New SMS + WHATSAPP channel adapters; existing EMAIL stays on SMTP.
- DB migration adds `WHATSAPP` to `OtpChannel`.
- Distinct from the per-tenant `OrganizationSmsConfig` (booking SMS via Unifonic/Taqnyat) — that path is untouched.
- Manual smoke test: send-OTP via SMS to a real Saudi number, verify-OTP, and balance preflight.
