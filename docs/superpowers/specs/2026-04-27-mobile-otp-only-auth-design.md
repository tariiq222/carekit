# Mobile OTP-Only Auth — Design Spec

**Date:** 2026-04-27
**Scope:** `apps/mobile`, `apps/backend/src/modules/identity/`
**Out of scope:** `apps/dashboard` auth (stays email + password)

## Background

Deqah Mobile (currently tenant-locked to Sawaa) has two distinct auth flows: clients use phone + OTP, employees use email + password. This split was a design choice tied to "professional" assumptions about employees, but role/permission decisions are independent of how a user logs in. The split also makes the same human go through two different flows on the same app once they get promoted to staff.

The dashboard (web) keeps email + password — staff manage the platform from desktops where browser autofill of passwords is normal and there is no SMS gateway native to the workflow.

## Goals

- One unified auth flow for mobile: register, log in, get promoted to staff later — all without a password.
- Email is captured at registration but verification is deferred and pull-based (user requests it from settings).
- Routing inside the app branches on `activeMembership` from `/me`, not on the auth flow.
- Dashboard auth is untouched.

## Non-Goals

- Marketplace UX (multiple tenants per mobile install) — explicitly future work.
- Migrating the dashboard to OTP.
- Password reset on mobile (no passwords to reset).

## User Model (Prisma)

### `User` table — fields

```
id                String   @id @default(uuid())
firstName         String
lastName          String
phone             String   @unique          // E.164, mandatory
email             String   @unique          // mandatory
phoneVerifiedAt   DateTime?                 // null until OTP confirmed
emailVerifiedAt   DateTime?                 // null until link clicked
isActive          Boolean  @default(false)  // true once phoneVerifiedAt != null
organizationId    String                    // Sawaa for the mobile install
// passwordHash REMOVED
```

The dashboard `User` keeps `passwordHash` — these are the **same** records; mobile registrations create rows that simply have `passwordHash = null`. Dashboard login rejects rows with `passwordHash = null`.

### Distinguishing client vs employee

A `User` is treated as an **employee** when they have at least one active `Membership` row in the active organization. Otherwise they are a **client**. No flag on `User` itself.

### New tables

```
OtpCode {
  id              String   @id
  userId          String
  channel         OtpChannel  // 'sms' | 'email'
  purpose         OtpPurpose  // 'register' | 'login'
  codeHash        String      // bcrypt of 4-digit code
  expiresAt       DateTime
  attempts        Int      @default(0)
  consumedAt      DateTime?
  createdAt       DateTime @default(now())
  organizationId  String
}

EmailVerificationToken {
  id              String   @id
  userId          String   @unique           // one active token per user
  tokenHash       String                     // sha256 of token
  expiresAt       DateTime                   // 30 minutes
  consumedAt      DateTime?
  createdAt       DateTime @default(now())
  organizationId  String
}
```

`PasswordResetToken` is dropped (no passwords on mobile; dashboard reset stays via email + temp password through the existing super-admin flow).

## Registration Flow

### Screen: `register.tsx`

Four fields:
- First name
- Last name
- Phone (E.164, with country picker defaulting to +966)
- Email

Submit → `POST /api/mobile/auth/register`.

### Backend: `register.handler.ts`

```
1. Validate input (Zod).
2. Reject if phone OR email already exists (do not leak which one).
3. Create User { passwordHash: null, phoneVerifiedAt: null, emailVerifiedAt: null, isActive: false }.
4. Generate 4-digit code, hash it, insert OtpCode { channel: 'sms', purpose: 'register', expiresAt: now + 10m }.
5. Send SMS via tenant SMS provider.
6. Return { userId, maskedPhone } (no token yet).
```

### Screen: `otp-verify.tsx` (purpose=`register`)

- Single 4-digit input.
- Resend button (disabled 60s after each send).
- On submit → `POST /api/mobile/auth/verify-otp { userId, code, purpose: 'register' }`.

### Backend: `verify-otp.handler.ts` (purpose=`register`)

```
1. Find latest unconsumed OtpCode for userId, purpose=register, channel=sms.
2. If expired or attempts >= 3 → reject.
3. Compare hash → on mismatch increment attempts, reject.
4. Mark consumedAt = now.
5. Update User { phoneVerifiedAt: now, isActive: true }.
6. Issue access + refresh tokens.
7. Return tokens + user payload (including activeMembership = null).
```

## Login Flow

### Screen: `login.tsx`

- One input: "رقم الجوال أو البريد الإلكتروني" / "Phone or email".
- Submit → `POST /api/mobile/auth/request-login-otp { identifier }`.

### Backend: `request-login-otp.handler.ts`

```
1. Detect identifier type:
   - contains '@' → email channel
   - else → phone channel (validate as E.164)
2. Lookup User by identifier.
3. Decide whether to issue an OTP:
   - User not found → do nothing.
   - User found, channel == 'sms', `phoneVerifiedAt == null` → do nothing (account never activated).
   - User found, channel == 'sms', `phoneVerifiedAt != null` → issue OTP.
   - User found, channel == 'email', `emailVerifiedAt == null` → do nothing.
   - User found, channel == 'email', `emailVerifiedAt != null` → issue OTP.
4. Issuing means: generate 4-digit code, hash, insert OtpCode { channel, purpose: 'login', expiresAt: 10m }, send through the matching transport.
5. Always return `{ maskedIdentifier }` with constant timing — same response shape whether or not an OTP was sent. This avoids account enumeration and avoids leaking activation state.
6. The follow-up `verify-otp` call is the natural failure point when no code was issued — the user simply sees "code incorrect" after the standard attempt window, which we accept as the cost of not enumerating accounts. The mobile UI may show a passive hint after a failed verify ("Didn't receive a code? Make sure your number/email is registered and verified.") but never before.
```

### Screen: `otp-verify.tsx` (purpose=`login`)

Same UI as register, calls verify-otp with `purpose: 'login'`.

### Backend: `verify-otp.handler.ts` (purpose=`login`)

```
1. Validate code (same logic as register).
2. Issue access + refresh tokens.
3. Load activeMembership (first Membership in active org for this user, if any).
4. Return tokens + user + activeMembership.
```

## Email Verification Flow (post-login)

Banner appears in `(client)/settings.tsx` and `(employee)/(tabs)/profile.tsx` when `emailVerifiedAt == null`.

```
[Banner] "بريدك الإلكتروني غير مؤكد" [إرسال رابط تفعيل]
```

Tapping → `POST /api/mobile/auth/request-email-verification` (auth required).

### Backend: `request-email-verification.handler.ts`

```
1. If User.emailVerifiedAt != null → no-op success.
2. Delete any existing EmailVerificationToken for this user.
3. Generate random 32-byte token, hash with sha256, insert.
4. Email user a link: https://deqah.sa/verify-email?token=<raw>
5. Token TTL = 30 minutes.
```

### Backend: `verify-email.handler.ts`

```
1. Hash incoming token, lookup EmailVerificationToken.
2. If expired or consumed → reject.
3. Mark consumedAt, update User.emailVerifiedAt = now.
4. Return success page that deep-links back into the app (deqah://settings?verified=1).
```

The `verify-email` page itself lives in `apps/website` (`/verify-email`) — it calls the backend on load, shows result, and triggers the deep link.

## Routing After Login

In `app/_layout.tsx` (or AuthGate):

```ts
const { user, activeMembership } = useAppSelector(s => s.auth);

if (!user) → (auth) stack
else if (activeMembership) → router.replace('/(employee)/(tabs)/today')
else → router.replace('/(client)/(tabs)/home')
```

`/me` response shape (mobile):

```json
{
  "user": { ...User fields except passwordHash, organizationId... },
  "activeMembership": null | {
    "id": "...",
    "role": "RECEPTIONIST" | "DOCTOR" | "ADMIN" | ...,
    "branchId": "..." | null,
    "permissions": [...]
  }
}
```

## Promote Client → Employee (dashboard side, light touch)

Dashboard `apps/dashboard/components/features/employees/add-employee-dialog.tsx` (existing or new) gets a small change:

- Search input by phone or email.
- If user exists → show preview, confirm role + branch → create `Membership`.
- If user does not exist → reject with "User must register on the mobile app first" (we explicitly do **not** add admin-driven user creation; this keeps the auth model clean).

When user reopens the mobile app, `/me` returns `activeMembership` → routing flips to `(employee)`.

When admin removes a Membership, `/me` returns `activeMembership: null` → next launch routes to `(client)`. No forced logout.

## Removed Surfaces

- `apps/mobile/app/(auth)/forgot-password.tsx` — deleted (mobile has no passwords).
- `apps/mobile/app/(auth)/reset-password.tsx` — deleted.
- `apps/backend/src/modules/identity/client-auth/reset-password/` — deleted (client password reset; clients have no passwords anymore).

Kept (used by dashboard staff):
- `apps/backend/src/modules/identity/user-password-reset/` — staff forgot-password on dashboard.
- `apps/backend/src/modules/identity/login/` — dashboard email + password login.
- `PasswordResetToken` table — used by dashboard staff reset.

`User.passwordHash` is **not** dropped. Mobile-registered users simply have `passwordHash = null`; dashboard-invited staff keep theirs. Dashboard login rejects rows with `passwordHash = null` with a generic invalid-credentials error.

## Backend Slice Inventory

```
apps/backend/src/modules/identity/
├── login/                                # KEEP — dashboard email+password
├── client-auth/
│   ├── client-login/                     # DELETE (replaced by request-login-otp)
│   ├── register/                         # DELETE (replaced by /register below)
│   ├── reset-password/                   # DELETE
│   └── shared/                           # KEEP/MERGE
├── register/                             # NEW — mobile unified register
├── request-login-otp/                    # NEW
├── verify-otp/                           # NEW (handles register + login)
├── request-email-verification/           # NEW
├── verify-email/                         # NEW
├── otp/                                  # KEEP — refactor to use new OtpCode model
├── refresh-token/                        # KEEP
├── logout/                               # KEEP
├── get-current-user/                     # MODIFY — return activeMembership for mobile
├── user-password-reset/                  # KEEP — dashboard staff only
├── switch-organization/                  # KEEP (for future marketplace)
├── list-memberships/                     # KEEP
├── casl/, roles/, users/, shared/        # KEEP
```

## Rate Limiting & Abuse Controls

- Per-phone OTP requests: max 5 per hour, max 20 per day.
- Per-email login OTP: max 5 per hour.
- Per-IP register: max 10 per hour.
- OTP attempts per code: 3, then code is invalidated (must request a new one).
- Email verification token: 30 min TTL, single-use, only one active per user.

## Tenant Isolation

All new tables (`OtpCode`, `EmailVerificationToken`) include `organizationId` and are added to `SCOPED_MODELS` in `prisma.service.ts`. RLS policies are added in the same migration.

For tenant-locked Sawaa app, all writes go to the Sawaa org id resolved via `EXPO_PUBLIC_TENANT_ID` → `X-Org-Id` header → tenant resolver middleware.

## Mobile Screens — File-Level Changes

```
apps/mobile/app/(auth)/
├── welcome.tsx          # KEEP
├── login.tsx            # REWRITE — single identifier field
├── register.tsx         # REWRITE — 4 fields
├── otp-verify.tsx       # MODIFY — accept purpose+identifier params
├── onboarding.tsx       # KEEP
├── suspended.tsx        # KEEP
├── forgot-password.tsx  # DELETE
└── reset-password.tsx   # DELETE
```

`(client)/settings.tsx` and `(employee)/(tabs)/profile.tsx` — add unverified-email banner.

`app/_layout.tsx` — add membership-based routing in the post-auth gate.

## Tests

### Backend Unit
- `register.handler.spec.ts` — duplicate phone/email, OTP issuance, organizationId scoping.
- `request-login-otp.handler.spec.ts` — type detection, unverified rejection, channel routing.
- `verify-otp.handler.spec.ts` — happy path, expired, attempt limit, consumed code reuse.
- `request-email-verification.handler.spec.ts` — token rotation, idempotent for already-verified.
- `verify-email.handler.spec.ts` — token validation, expiry, deep-link redirect.

### Backend E2E
- Full flow: register → verify SMS OTP → login (with phone) → request email verification → verify email → login (with email) succeeds.
- Tenant isolation: Sawaa OTP cannot be consumed by another org's request.
- Rate limiting boundary: 6th SMS request in an hour rejected.

### Mobile Unit (Jest + jest-expo)
- `login.test.tsx` — identifier type detection.
- `register.test.tsx` — Zod validation messages.
- `otp-verify.test.tsx` — countdown for resend, error states.
- Routing test (RNTL) — `_layout.tsx` routes to (employee) when membership present.

### Manual QA (Kiwi)
Plan: `mobile-otp-auth-<date>.json` with cases:
1. Register new user → OTP arrives → activates → lands in (client).
2. Login with phone → OTP arrives → success.
3. Login with verified email → OTP arrives → success.
4. Login with unverified email → reject with "use phone" error.
5. Tap unverified-email banner → email arrives → tap link → returns to app verified.
6. Admin promotes user via dashboard → user reopens app → lands in (employee).
7. Admin removes membership → user reopens app → lands in (client).
8. 6th OTP request in an hour → rate-limited message.

## Migration Strategy

1. Migration A: add new `User` columns (`firstName`, `lastName`, `phone`, `phoneVerifiedAt`, `emailVerifiedAt`) as nullable. Make `passwordHash` nullable (it currently is required for staff invites).
2. Migration B: backfill existing dashboard staff. Split existing `name` → `firstName`/`lastName`. Copy `phone` from any linked `Client` row if present, otherwise leave null. Set `phoneVerifiedAt = createdAt` and `emailVerifiedAt = createdAt` (they came in via admin invite, so we trust their email; phone stays unverified until they re-confirm if/when they install the mobile app).
3. Migration C: add UNIQUE constraints on `phone` and `email` (after backfill resolves any duplicates).
4. Migration D: create `OtpCode`, `EmailVerificationToken` tables, register them in `SCOPED_MODELS`, add RLS policies.
5. Migration E: no destructive drops in the first release. `PasswordResetToken` and the staff `user-password-reset` cluster remain for dashboard use.

`passwordHash` stays on `User`. Mobile-registered users simply have `passwordHash = null`. Dashboard `login.handler` rejects rows with `passwordHash = null` with a generic invalid-credentials response.

## Open Questions

None — all resolved during brainstorming. Ready to proceed to plan.

## Acceptance Criteria

- A new user can register through the mobile app with name + phone + email and receive a 4-digit SMS OTP, enter it once, and land in the client tab stack.
- The same user can log out and log back in using either phone (always) or verified email — never both at once, only the channel they chose.
- An unverified email cannot be used as a login identifier.
- A user promoted via the dashboard's add-employee dialog is routed to the employee tab stack on next app launch with no logout required.
- A user whose membership is revoked is routed back to the client tab stack on next launch.
- All OTPs and verification tokens are tenant-scoped and pass the existing isolation E2E suite.
- Dashboard email+password login is unchanged and all dashboard auth tests still pass.
