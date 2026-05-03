# Super-Admin Settings Hub — Smoke-test Runbook (2026-05-03)

> Run these steps in Chrome with DevTools open (Network + Console tabs).
> Each step lists: action → expected result → screenshot path.

## Pre-conditions
- Local Docker stack running (`npm run docker:up`)
- Backend, admin, and dashboard dev servers running
- Admin URL: http://localhost:5104
- Dashboard URL: http://localhost:5103
- At least one test tenant organization exists in the DB

---

## 1. Login + audit log baseline

| Step | Action | Expected |
|------|--------|----------|
| 1.1 | Visit http://localhost:5104 and log in as super-admin | Dashboard home renders; no console errors |
| 1.2 | Navigate to `/audit-log` | Table renders with existing rows |
| 1.3 | Note the row count before beginning | Baseline count established |

---

## 2. Email settings (`/settings/email`)

| Step | Action | Expected |
|------|--------|----------|
| 2.1 | Visit http://localhost:5104/settings/email | Page renders; Resend key field shows masked value |
| 2.2 | Enter a new Resend sandbox API key and click Save | Success toast; GET `/admin/settings/email` returns new masked key |
| 2.3 | Navigate to `/audit-log` | New row: actionType=PLATFORM_SETTING_UPDATED, details contain `email.apiKey` |

---

## 3. Email templates (`/settings/email/templates`)

| Step | Action | Expected |
|------|--------|----------|
| 3.1 | Visit http://localhost:5104/settings/email/templates | Template list renders; locked templates have disabled inputs |
| 3.2 | Click on an unlocked template; edit the AR or EN body; click Save | Success toast; template persists after page refresh |
| 3.3 | Attempt to edit a locked template field | Input is disabled; Save button unavailable for that field |

---

## 4. Email delivery logs (`/settings/email/logs`)

| Step | Action | Expected |
|------|--------|----------|
| 4.1 | Visit http://localhost:5104/settings/email/logs | Table renders; rows present if any platform emails were sent |
| 4.2 | Apply filter: Status = FAILED | Table shows only FAILED rows (or "No rows" if none) |
| 4.3 | Click Refresh | Network call to `GET /admin/settings/email/logs` fires; table updates |

---

## 5. Notifications settings (`/settings/notifications`)

| Step | Action | Expected |
|------|--------|----------|
| 5.1 | Visit http://localhost:5104/settings/notifications | Page renders; default channel toggles visible |
| 5.2 | Toggle a channel (e.g., disable EMAIL for BOOKING_CONFIRMED) and click Save | Success toast; GET returns updated defaults |
| 5.3 | Create a new tenant organization via `/organizations/new` | New tenant's notification config inherits the just-saved defaults |
| 5.4 | Attempt to save quiet hours with end time < start time | Validation error shown inline; no network call fires |

---

## 6. Billing settings (`/settings/billing`)

| Step | Action | Expected |
|------|--------|----------|
| 6.1 | Visit http://localhost:5104/settings/billing | Page renders; Moyasar platform key masked |
| 6.2 | Enter a test Moyasar key and click Test Connection | Response shows `ok: true` (sandbox) or a clear error if key is invalid |
| 6.3 | Change trial days from 14 to 7 and save | Success toast; audit log row created |
| 6.4 | Register a new test tenant | Trial period shows 7 days (not 14) |

---

## 7. Feature flags (`/settings/feature-flags`)

| Step | Action | Expected |
|------|--------|----------|
| 7.1 | Visit http://localhost:5104/settings/feature-flags | Table renders with all registered features |
| 7.2 | Toggle a global default to disabled and save | Success toast; audit row created |
| 7.3 | Log in to tenant dashboard → verify the toggled feature is disabled | Feature UI is hidden or locked |
| 7.4 | Add a per-org override for the same feature (re-enable for org A) | Override row appears in the overrides table |
| 7.5 | Log in to org A dashboard → verify the feature is enabled despite global default | Override wins |

---

## 8. Branding settings (`/settings/branding`)

| Step | Action | Expected |
|------|--------|----------|
| 8.1 | Visit http://localhost:5104/settings/branding | Page renders; current logo + primary color displayed |
| 8.2 | Upload a new logo (PNG < 2 MB) | Logo preview updates in the form |
| 8.3 | Click Save | Success toast |
| 8.4 | Hard-refresh the admin app | New logo appears in the sidebar header |
| 8.5 | Change primary color (hex input) and save | Sidebar accent color updates on refresh |

---

## 9. System health (`/settings/system`)

| Step | Action | Expected |
|------|--------|----------|
| 9.1 | Visit http://localhost:5104/settings/system | Page renders; 4 stat cards show values (not skeletons) |
| 9.2 | Verify all 6 keys present: backendVersion, gitSha, postgres, redis, minio, latestMigration | All 6 present in the stat cards and version card |
| 9.3 | Click "Run health check" | Network call to POST `/admin/settings/system/health/run` returns 200; success toast |
| 9.4 | Navigate to `/audit-log` | New audit row for the health check action |
| 9.5 | (dev only) Click "Clear cache" | Confirmation required; POST fires; success toast |

---

## 10. Security settings (`/settings/security`)

| Step | Action | Expected |
|------|--------|----------|
| 10.1 | Visit http://localhost:5104/settings/security | Page renders; all 4 cards visible |
| 10.2 | Change session TTL to 90 minutes and save | Success toast; setting persists in DB |
| 10.3 | Click "Enroll 2FA" | Dialog opens; QR code image renders |
| 10.4 | Scan QR code with authenticator app; enter 6-digit code; click Verify | Dialog closes; 2FA status badge changes to Enabled |
| 10.5 | Log out | Redirected to login page |
| 10.6 | Log in with correct password | 2FA code prompt appears |
| 10.7 | Enter correct 6-digit code | Access granted; home page renders |
| 10.8 | Log out; log in with correct password + wrong 2FA code (×3) | Three failed-login rows appear in the Failed login attempts table |

---

## 11. Tenant: email delivery log (`dashboard /settings/email-delivery-log`)

| Step | Action | Expected |
|------|--------|----------|
| 11.1 | Log in to tenant dashboard at http://localhost:5103 | Dashboard home renders |
| 11.2 | Navigate to Settings → Email & SMS Delivery Log | Page renders; 4 stat cards + table visible |
| 11.3 | Confirm rows show only the current tenant's data | No rows from other tenants visible |
| 11.4 | Filter by Channel = SMS | Only SMS rows appear (or "No rows" if none) |
| 11.5 | Verify senderActor badges render (PLATFORM / TENANT / PLATFORM_FALLBACK) | Badges with correct variant colors visible |

---

## 12. Tenant: fallback quota banner

| Step | Action | Expected |
|------|--------|----------|
| 12.1 | Set tenant plan email fallback limit to 5 via super-admin | Limit visible in feature flags |
| 12.2 | Go to tenant dashboard Settings → Email → Email provider | If provider = NONE, fallback banner appears |
| 12.3 | Send 4 emails via the dashboard | Banner shows "4/5 used" with neutral styling |
| 12.4 | Send 5th email | Banner changes to warning style (≥80%) |
| 12.5 | Send 6th email | Limit-reached dialog appears; emails blocked |
