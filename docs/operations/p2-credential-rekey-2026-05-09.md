# P2.B Credential Re-key Runbook — 2026-05-09

## What changed

As part of security audit fix P2.B, four credential services were upgraded from
a single shared master-key + AAD scheme to per-tenant HKDF-derived keys:

| Service | Env var | Old scheme | New scheme |
|---|---|---|---|
| `SmsCredentialsService` | `SMS_PROVIDER_ENCRYPTION_KEY` | AES-256-GCM, `masterKey`, `orgId` as AAD | AES-256-GCM, `HKDF(masterKey, salt='deqah-sms-creds-v1', info=orgId)` |
| `ZoomCredentialsService` | `ZOOM_PROVIDER_ENCRYPTION_KEY` | AES-256-GCM, `masterKey`, `orgId` as AAD | AES-256-GCM, `HKDF(masterKey, salt='deqah-zoom-creds-v1', info=orgId)` |
| `MoyasarCredentialsService` | `MOYASAR_TENANT_ENCRYPTION_KEY` | AES-256-GCM, `masterKey`, `orgId` as AAD | AES-256-GCM, `HKDF(masterKey, salt='deqah-moyasar-creds-v1', info=orgId)` |
| `ZohoCredentialsService` | `ZOHO_PROVIDER_ENCRYPTION_KEY` | AES-256-GCM, `masterKey`, `orgId` as AAD | AES-256-GCM, `HKDF(masterKey, salt='deqah-zoho-creds-v1', info=orgId)` |

`EmailCredentialsService` was already on the HKDF scheme and is unchanged.

## Breaking change — existing DB rows cannot be decrypted

Rows encrypted under the old scheme (master key + AAD) CANNOT be decrypted by
the new version. The key derivation function is different. There is no automatic
migration path.

## Why no dual-key fallback?

A dual-key fallback (try new key first, fall back to old master key) would keep
the old weaker scheme live in production code for the fallback period. This
defeats the purpose of the upgrade. The decision is: **forced re-entry**.

## Affected features per integration

| Integration | DB model | Affected tenants | Impact if not re-keyed |
|---|---|---|---|
| SMS (Unifonic / Taqnyat) | `OrganizationSmsConfig.credentialsCiphertext` | All tenants with SMS enabled | SMS sending fails (decrypt error) |
| Zoom | `ZoomIntegration.credentialsCiphertext` | All tenants with Zoom enabled | Zoom meeting creation fails |
| Moyasar (tenant) | `OrganizationPaymentConfig.credentialsCiphertext` | All tenants with Moyasar configured | **Payment collection stops** — URGENT |
| Zoho | `ZohoIntegration.credentialsCiphertext` | All tenants with Zoho enabled | Zoho sync fails |

## Severity

**Moyasar is P0.** If a tenant has configured their Moyasar credentials and does
not re-enter them after deploy, payment processing stops immediately. Contact
all active Moyasar tenants before or immediately after rolling out this version.

## Deployment sequence

1. **Before rolling out this version**, identify all tenants with each integration enabled.
   ```sql
   -- SMS
   SELECT "organizationId" FROM "OrganizationSmsConfig" WHERE "credentialsCiphertext" IS NOT NULL;
   -- Zoom
   SELECT "organizationId" FROM "ZoomIntegration" WHERE "credentialsCiphertext" IS NOT NULL;
   -- Moyasar
   SELECT "organizationId" FROM "OrganizationPaymentConfig" WHERE "credentialsCiphertext" IS NOT NULL;
   -- Zoho
   SELECT "organizationId" FROM "ZohoIntegration" WHERE "credentialsCiphertext" IS NOT NULL;
   ```

2. **Contact each affected tenant** (or their clinic admin) to inform them they
   must re-enter their integration credentials in the dashboard after the update.
   Priority order: Moyasar → SMS → Zoom → Zoho.

3. **Deploy** the new backend version.

4. **Verify** that the dashboard settings pages for SMS, Zoom, Moyasar, and Zoho
   load without errors (they show a write-only credential form — this is correct).

5. **Each tenant re-enters credentials** via the dashboard:
   - SMS: `Settings → SMS Provider` → re-enter API key / credentials → Save
   - Zoom: `Settings → Zoom Integration` → re-enter Account ID / Client ID / Client Secret → Save
   - Moyasar: `Settings → Payment Methods` → re-enter publishable key + secret key → Save
   - Zoho: `Settings → Zoho Integration` → re-enter OAuth credentials → Save

6. **Verify** each integration works end-to-end (send test SMS, create test Zoom
   meeting, run a test Moyasar charge in test mode, sync a test Zoho contact).

## Rollback

If you must roll back to the previous version:

1. Roll back the backend container to the pre-P2.B image tag.
2. Any credentials re-entered under the new version (HKDF scheme) will fail to
   decrypt with the old version. Affected tenants must re-enter credentials again.
3. There is no automatic path in either direction — re-entry is required on
   both upgrade and rollback.

## Communication template (Arabic / to clinic admins)

> السلام عليكم،
>
> تم تحديث منصة دقة اليوم لتعزيز أمان بيانات الاعتماد المخزّنة. كجزء من هذا
> التحديث، يحتاج النظام إلى إعادة إدخال بيانات الاعتماد الخاصة بالتكاملات التالية:
>
> - موزاريل (Moyasar) — **عاجل**: قد تتوقف عمليات الدفع حتى تتم إعادة الإدخال.
> - مزود الرسائل القصيرة (SMS)
> - Zoom
> - Zoho
>
> يرجى الدخول إلى لوحة التحكم ← الإعدادات ← التكاملات وإعادة إدخال بيانات
> الاعتماد لكل خدمة مفعّلة. إذا احتجتم لأي مساعدة تواصلوا معنا على الفور.

## Technical reference

- PR / commit: fix(security): P2.B — per-tenant HKDF key derivation for SMS/Zoom/Moyasar/Zoho
- Services modified:
  - `apps/backend/src/infrastructure/sms/sms-credentials.service.ts`
  - `apps/backend/src/infrastructure/zoom/zoom-credentials.service.ts`
  - `apps/backend/src/infrastructure/payments/moyasar-credentials.service.ts`
  - `apps/backend/src/infrastructure/zoho/zoho-credentials.service.ts`
- Reference implementation: `apps/backend/src/infrastructure/email/email-credentials.service.ts`
- HKDF spec: RFC 5869
