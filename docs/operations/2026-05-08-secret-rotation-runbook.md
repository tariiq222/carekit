# Secret Rotation Runbook (2026-05-08)

**Owner:** @tariq
**Trigger:** P0-5 of the pre-launch fixes plan
**Why:** Production-shaped secrets are sitting in a developer-workstation `.env` and may exist in dev backups or git history.

## Inventory of secrets to rotate

| Key | Where it lives | Where to rotate |
|-----|----------------|-----------------|
| `RESEND_API_KEY` | `.env`, Dokploy env, `apps/backend` runtime | Resend dashboard → API Keys → revoke `re_B83UBwxR_…`, mint new key |
| `POSTHOG_API_KEY` | `.env`, dashboards | PostHog → Project Settings → Project API Keys → rotate |
| `AUTHENTICA_API_KEY` | `.env`, Dokploy env | portal.authentica.sa → Account → API Keys → revoke + mint new |
| `SENTRY_DSN` (GlitchTip) | `.env`, Dokploy env | GlitchTip self-hosted (`100.124.231.44:8000`) → Project Settings → Client Keys → rotate |
| `SMS_PROVIDER_ENCRYPTION_KEY` | `.env`, Dokploy env | Generate locally; rotate stored ciphertexts (see Re-encryption) |
| `ZOOM_PROVIDER_ENCRYPTION_KEY` | same | same |
| `MOYASAR_TENANT_ENCRYPTION_KEY` | same | same — **danger: re-encrypts every tenant's Moyasar credentials** |
| `EMAIL_PROVIDER_ENCRYPTION_KEY` | same | same |
| `ZOHO_PROVIDER_ENCRYPTION_KEY` | same | same |
| `SUPER_ADMIN_PASSWORD` | `.env`, Dokploy env | Generate ≥ 24-char passphrase; update password column |

## Generating new encryption keys

```bash
openssl rand -base64 32
```

Run **5 times** — one per encryption key.

## Re-encryption procedure (per encryption key)

1. Postgres snapshot (`pg_dump`).
2. Maintenance migration: read each `*Enc` column, decrypt with OLD key, re-encrypt with NEW key (AAD remains `organizationId`), write back.
3. Swap the env var in Dokploy → restart backend → verify a single tenant's webhook can decrypt.
4. Roll the next encryption key only after the previous one is verified.

**If unsure of the AAD scheme:** read `apps/backend/src/infrastructure/payments/moyasar-credentials.service.ts` and the analogous services. Each uses `organizationId` as AAD.

## Super-admin password

```bash
docker exec -it <db-container> psql -U deqah -d deqah <<'SQL'
UPDATE "User"
SET "password" = crypt('NEW-LONG-PASSPHRASE', gen_salt('bf'))
WHERE "email" = 'tariiq222@gmail.com';
SQL
```

(Adjust to whatever hashing the auth module uses — confirm before running.)

## Rollback

Old ciphertexts are still in the snapshot. Restore + restore old env var if anything decrypts wrong.

## Verification checklist (post-rotation)

- [ ] Backend boots; `/api/v1/health` returns 200
- [ ] One Moyasar webhook arrives end-to-end (small test payment) → `Payment.status=COMPLETED`
- [ ] One SMS sends end-to-end (test OTP) → DLR comes back
- [ ] Super-admin login with new password works; old password rejected
- [ ] GlitchTip ingests a forced test exception
- [ ] All 5 `*_PROVIDER_ENCRYPTION_KEY` env vars in Dokploy match new generated values
- [ ] `.env` on local workstation rotated to match (or replaced with dev placeholders)
- [ ] Force-rotate any Resend/PostHog/Authentica keys that were ever shared in chat/screenshots

## Hardening checklist (this PR)

- [x] `apps/backend/.dockerignore` excludes `.env*`
- [x] Root `.dockerignore` tightened to also cover `.env` (bare) and `.env.*`
- [x] Joi schema rejects placeholders in production (`REPLACE_ME`, `CHANGE_ME`, `Admin@2026`)
- [x] `EMAIL_PROVIDER_ENCRYPTION_KEY` added to Joi schema (was used in code but not validated)
- [x] `SUPER_ADMIN_PASSWORD` added to Joi schema with production disallow list
- [x] Startup assertion in main.ts rejects empty or placeholder encryption keys
