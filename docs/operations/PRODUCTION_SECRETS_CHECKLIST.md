# Production Secrets Checklist

Everything the platform owner must provide before running CareKit in production.
Source template: [`apps/backend/.env.prod.example`](../../apps/backend/.env.prod.example).

The backend's Joi schema rejects boot if any item marked **REQUIRED** below is
missing or contains a dev placeholder (`change-me`, `dev-`, `sk_test_`, `CHANGE_ME`).
See [`apps/backend/src/config/env.validation.ts`](../../apps/backend/src/config/env.validation.ts).

---

## A. Auto-generated locally (use the commands below)

Run each command on your laptop, paste the result into `.env.prod`. Never share these values; never commit.

| Key | Command | Notes |
|-----|---------|-------|
| `POSTGRES_PASSWORD` | `openssl rand -base64 32 \| tr -d '/+=' \| cut -c1-32` | 32 chars, no special chars (avoids URL encoding issues) |
| `REDIS_PASSWORD` | `openssl rand -base64 24 \| tr -d '/+='` | |
| `MINIO_ACCESS_KEY` | `openssl rand -hex 16` | |
| `MINIO_SECRET_KEY` | `openssl rand -base64 32 \| tr -d '/+='` | |
| `JWT_ACCESS_SECRET` | `openssl rand -base64 48 \| tr -d '/+=' \| cut -c1-48` | **MUST be unique per key** |
| `JWT_REFRESH_SECRET` | `openssl rand -base64 48 \| tr -d '/+=' \| cut -c1-48` | |
| `JWT_OTP_SECRET` | `openssl rand -base64 48 \| tr -d '/+=' \| cut -c1-48` | |
| `JWT_CLIENT_ACCESS_SECRET` | `openssl rand -base64 48 \| tr -d '/+=' \| cut -c1-48` | |
| `SMS_PROVIDER_ENCRYPTION_KEY` | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` | Must be **base64, length 44** (32 raw bytes). Anything else → boot fails |
| `ZOOM_PROVIDER_ENCRYPTION_KEY` | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` | Same constraint |
| `SUPER_ADMIN_PASSWORD` | `openssl rand -base64 32 \| tr -d '/+=' \| cut -c1-24` | First super-admin login. Save in a password manager — only used at seed time |
| `BACKUP_ENCRYPTION_KEY` | `openssl rand -base64 32 \| tr -d '/+='` | gpg symmetric key for nightly DB + MinIO backups |

**Rotation policy:** rotate JWT secrets and encryption keys at least every 12 months. Rotating a JWT secret invalidates all existing sessions; rotating an encryption key requires re-encrypting affected rows (SMS configs, Zoom configs).

---

## B. External accounts (must be created/purchased first)

### B-1. Authentica (REQUIRED — primary OTP provider for client auth)

- **Purpose**: delivers OTP codes to clients during mobile/website login.
- **Sign up**: <https://authentica.sa>
- **Get the API key**: Portal → Settings → API Keys → <https://portal.authentica.sa/settings/apikeys/>
- **Fill**:
  - `AUTHENTICA_API_KEY`
  - `AUTHENTICA_BASE_URL=https://api.authentica.sa` (default)
  - `AUTHENTICA_DEFAULT_TEMPLATE_ID` — the OTP template ID approved for your sender name.
- **Cost**: per-OTP fees billed by Authentica directly.
- **Failure mode**: if missing in production, the backend refuses to boot.

### B-2. hCaptcha (REQUIRED — bot protection on auth/OTP endpoints)

- **Purpose**: prevents OTP flooding attacks (each OTP request costs you Authentica fees).
- **Sign up**: <https://dashboard.hcaptcha.com>
- **Create site**: Dashboard → New Site → add `app.carekit.app`, `admin.carekit.app`, `carekit.app`.
- **Fill**:
  - `CAPTCHA_PROVIDER=hcaptcha`
  - `HCAPTCHA_SECRET` (the secret key, NOT the site key — site key is hardcoded in frontend)
- **Note**: the frontend currently uses a placeholder widget. Updating the secret here is necessary but not sufficient — the site key must also be wired in `apps/dashboard`/`apps/admin` env. See open issue #captcha-frontend-keys.

### B-3. Moyasar — Platform Account (REQUIRED for SaaS billing)

- **Purpose**: charges clinics for their CareKit subscription. **This is a separate Moyasar account from anything tenants use.**
- **Sign up**: <https://moyasar.com> as `CareKit` (the platform).
- **Get keys**: Dashboard → Developers → API Keys → use **live** keys (`sk_live_*`).
- **Configure webhook**: `POST https://api.carekit.app/api/v1/public/webhooks/moyasar/platform`
- **Fill**:
  - `MOYASAR_PLATFORM_SECRET_KEY` (sk_live_*)
  - `MOYASAR_PLATFORM_WEBHOOK_SECRET` (set in Moyasar webhook config; copy the same value here)
- **Note**: the Joi schema rejects `sk_test_*` in production.
- **Defer**: keep `BILLING_CRON_ENABLED=false` until you have manually charged the first tenant successfully and verified the webhook flow in production.

### B-4. SMTP — transactional email (REQUIRED)

Recommended providers: SendGrid, Postmark, AWS SES, Mailgun.

- **Purpose**: booking confirmations, password resets, billing invoices.
- **Fill**:
  - `SMTP_HOST` (e.g. `smtp.sendgrid.net`)
  - `SMTP_PORT=587`
  - `SMTP_USER`
  - `SMTP_PASS`
  - `SMTP_FROM` (must be a verified sender, e.g. `no-reply@carekit.app`)
- **DNS**: configure SPF, DKIM, and DMARC for the sender domain or your delivery rate will tank.

### B-5. FCM — Firebase Cloud Messaging (REQUIRED for mobile push)

- **Purpose**: push notifications to iOS/Android clients (booking reminders, payment failures).
- **Setup**: Firebase Console → Project Settings → Service Accounts → **Generate new private key** → downloads a JSON file.
- **Fill**:
  - `FCM_PROJECT_ID` = JSON `project_id`
  - `FCM_CLIENT_EMAIL` = JSON `client_email`
  - `FCM_PRIVATE_KEY` = JSON `private_key` — paste **with** the literal `\n` separators (do not convert to real newlines, do not unwrap)
- **iOS extra**: APNs auth key uploaded to Firebase Console → Cloud Messaging.

### B-6. Sentry (RECOMMENDED — error tracking)

- **Purpose**: capture runtime exceptions across backend + dashboards.
- **Sign up**: <https://sentry.io>; create three projects: `carekit-backend`, `carekit-dashboard`, `carekit-admin`.
- **Fill**: `SENTRY_DSN` (backend project DSN). The frontend DSNs are wired separately in `apps/<app>/.env.production`.
- **Without it**: errors are logged to stdout only.

### B-7. OpenAI + OpenRouter (OPTIONAL — only if chatbot enabled)

- **Purpose**: chatbot RAG (KB embeddings via OpenAI, chat via OpenRouter).
- **Get keys**: <https://platform.openai.com/api-keys> + <https://openrouter.ai/keys>.
- **Fill**: `OPENAI_API_KEY`, `OPENROUTER_API_KEY`.
- **Skip if**: chatbot is not enabled for any tenant in the trial.

---

## C. Per-tenant inputs (NOT in `.env.prod` — collected from each clinic during onboarding)

These do **not** go into `.env.prod`. Each clinic provides them via the dashboard `/settings/*` UI; the backend encrypts and stores them per-organization with `organizationId` as AES-GCM AAD.

| Setting | Where | Owner |
|---------|-------|-------|
| Tenant Moyasar keys (booking payments) | Dashboard → Settings → Payments | Clinic admin |
| Tenant SMS provider (Unifonic / Taqnyat) | Dashboard → Settings → SMS | Clinic admin |
| Tenant Zoom credentials (telehealth) | Dashboard → Settings → Integrations → Zoom | Clinic admin |
| Tenant branding (logo, colors, hours) | Dashboard → Settings → Branding | Clinic admin |
| ZATCA registration | Dashboard → Settings → ZATCA | Clinic admin (deferred — `ZATCA_ENABLED=false`) |

---

## D. Domain + DNS (REQUIRED — DevOps work)

| Subdomain | Points to | TLS |
|-----------|-----------|-----|
| `api.carekit.app` | Backend (port 5100) via nginx | Let's Encrypt |
| `app.carekit.app` | `apps/dashboard` (port 5103) | Let's Encrypt |
| `admin.carekit.app` | `apps/admin` (port 5104) | Let's Encrypt |
| `carekit.app` | `apps/website` (port 5105) | Let's Encrypt |

**SSL**: nginx loads certs from `docker/nginx/ssl/`. Use certbot with the dns-01 or http-01 challenge before first deploy. Auto-renewal cron must be configured.

**Email DNS**: SPF + DKIM + DMARC for `carekit.app` so SMTP delivers.

---

## E. Validation checklist before `docker compose up`

```bash
# 1. Verify no placeholders remain
grep -E "REPLACE_WITH|change-me|CHANGE_ME|dev-|sk_test_" apps/backend/.env.prod
#   → must return zero lines

# 2. Verify base64-32-byte keys are exactly 44 chars
node -e "
  const env = require('dotenv').config({ path: 'apps/backend/.env.prod' }).parsed;
  for (const k of ['SMS_PROVIDER_ENCRYPTION_KEY', 'ZOOM_PROVIDER_ENCRYPTION_KEY']) {
    if (env[k].length !== 44) { console.error(k, 'wrong length:', env[k].length); process.exit(1); }
  }
  console.log('encryption keys OK');
"

# 3. Verify all 5 JWT secrets are distinct
node -e "
  const env = require('dotenv').config({ path: 'apps/backend/.env.prod' }).parsed;
  const keys = ['JWT_ACCESS_SECRET','JWT_REFRESH_SECRET','JWT_OTP_SECRET','JWT_CLIENT_ACCESS_SECRET'];
  const vals = keys.map(k => env[k]);
  if (new Set(vals).size !== keys.length) { console.error('JWT secrets must be distinct'); process.exit(1); }
  console.log('JWT secrets distinct OK');
"

# 4. Verify Moyasar PLATFORM key is sk_live_*
grep "^MOYASAR_PLATFORM_SECRET_KEY=sk_live_" apps/backend/.env.prod && echo OK || echo "WARN: not sk_live_*"

# 5. Try the backend boot — Joi will reject any remaining issue immediately
docker compose -f docker/docker-compose.yml -f docker/docker-compose.prod.yml --env-file apps/backend/.env.prod up backend --abort-on-container-exit
```

---

## F. After first deploy — manual verification

1. **Auth**: log into `admin.carekit.app` with `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD`. Force-rotate the password from the UI immediately.
2. **OTP**: trigger a test OTP from the mobile app → confirm Authentica delivers within 30s.
3. **Push**: register an FCM token from a real device → trigger a test booking reminder → confirm push arrives.
4. **Webhook**: trigger a Moyasar test payment in a tenant's sandbox → confirm `Invoice.status=PAID` flips within 5s.
5. **Sentry**: throw a test error → confirm it appears in the Sentry project.
6. **Backups**: wait until 02:00 server time + 1 hour → confirm `/backups/` contains a fresh `*.sql.gpg` and `*.tar.gpg`.
7. **Tenant isolation**: create two test orgs; log in as user-A; confirm `/api/v1/dashboard/bookings?organizationId=<orgB>` returns 401/empty (NOT orgB data).

If any of the above fails, rollback per [`migration-rollback-runbook.md`](migration-rollback-runbook.md).
