# Tenant Owner Provisioning — Design Spec

**Date:** 2026-05-04
**Status:** Agreed / Ready to implement
**Scope:** Backend (`apps/backend`) + Super-admin frontend (`apps/admin`)

---

## 1. Background

Two parallel tenant-creation flows exist today:

- **Self-serve** (`apps/website` calls `POST /api/v1/public/tenants/register` → `RegisterTenantHandler`): creates Org + User + Membership + BrandingConfig + OrganizationSettings + Subscription + vertical seed; sends welcome email; issues JWT.
- **Super-admin** (`apps/admin` calls `POST /api/v1/admin/organizations` → `CreateTenantHandler`): only accepts an existing `ownerUserId` (UUID). The wizard's "Create new owner" mode submits `ownerName/ownerEmail/ownerPhone/ownerPassword`, which the DTO whitelist rejects ("property ownerName should not exist…"). This is a real bug.

---

## 2. Decisions

1. **Email collision in admin path → auto-link.** If the super-admin enters an email that matches an existing User, we link that User as OWNER of the new tenant via a fresh `Membership` row. Multi-org membership is a supported, normal case (one user can be ADMIN in tenant A and OWNER of tenant B).
2. **Remove `reason` from tenant creation only.** Keep `reason` on suspend/reinstate/archive/change-plan/refund/waive/grant-credit (those are dispute-prone). Tenant creation is a positive, revenue-generating action — no dispute surface. The `SuperAdminActionLog` row still records actor + action + org + timestamp + IP + UA + metadata; only the free-text `reason` is dropped for `TENANT_CREATE`.
3. **Hybrid password.** Super-admin can enter a password OR leave it blank → backend generates a 16-char password meeting policy (≥8 chars, ≥1 uppercase, ≥1 digit) and emails it via the existing welcome email.
4. **Welcome email.** Reuse `PlatformMailerService.sendTenantWelcome`. Send AFTER transaction commits (fire-and-forget with logged failure). Generated password — when applicable — is included in the email and never persisted in any log.
5. **Self-serve flow keeps user-supplied password.** No generation in self-serve. The shared service simply exposes both modes.

---

## 3. Architecture

### 3.1 New shared service

`apps/backend/src/modules/identity/owner-provisioning/owner-provisioning.service.ts`

```ts
interface ProvisionOwnerInput {
  // Either provide existing user id...
  ownerUserId?: string;
  // ...or new-owner fields:
  name?: string;
  email?: string;
  phone?: string;
  password?: string; // optional; if absent, service generates one
  // tx is the active Prisma transaction client
  tx: Prisma.TransactionClient;
}

interface ProvisionOwnerResult {
  userId: string;
  isNewUser: boolean;
  generatedPassword?: string; // only set when service generated one
}
```

**Logic:**

- If `ownerUserId` provided → verify exists + active → return `{ userId, isNewUser: false }`.
- Else: lookup user by email.
  - Found → return `{ userId: found.id, isNewUser: false }`.
  - Not found → generate password if absent, hash via `PasswordService`, create User (`role: 'ADMIN'`, `isActive: true`), return `{ userId, isNewUser: true, generatedPassword? }`.
- Validates exactly one of `ownerUserId` XOR `email` is provided.

### 3.2 CreateTenantDto changes (admin path)

Remove `reason` (and remove validators). Replace `ownerUserId` requirement with a union:

- `ownerUserId?: string` (UUID) — XOR
- `ownerName?: string`, `ownerEmail?: string`, `ownerPhone?: string`, `ownerPassword?: string`

Validation: at least one of `ownerUserId` or `ownerEmail` must be present; `ownerEmail` requires `ownerName`+`ownerPhone`. Implement via `@ValidateIf` + a custom `@ValidatorConstraint` (or refactor into discriminated union with `class-transformer`).

### 3.3 CreateTenantHandler changes

- Drop `reason` from command + log row (`reason: null` for `TENANT_CREATE`).
- Inside the transaction, call `OwnerProvisioningService.provision({ ...ownerFields, tx })`. Use the returned `userId` for the Membership.
- Outside the transaction (after commit), if `isNewUser` and the email path was taken, call `PlatformMailerService.sendTenantWelcome(email, { ownerName, orgName, dashboardUrl, generatedPassword? })` — fire-and-forget with logged failures.
- `metadata` adds `{ ownerCreatedNew: boolean, passwordWasGenerated: boolean }`.

### 3.4 RegisterTenantHandler refactor (self-serve)

- Replace inline User creation with `OwnerProvisioningService.provision({ name, email, phone, password, tx })`.
- Email collision still throws 409 (same behavior as today via the service).
- No generated-password path here (password is always provided by the user).

### 3.5 SuperAdminActionLog schema

`reason` becomes nullable in Prisma schema (new migration). Existing rows untouched. UI-side reason fields remain mandatory for the other action types — only the DTO and handler for `TENANT_CREATE` drop it.

### 3.6 Admin frontend (`apps/admin/features/organizations/create-tenant`)

- `create-tenant.api.ts`: drop `reason` from `CreateTenantCommand`.
- `create-tenant-dialog.tsx`: drop `reason` from `WizardForm` + `DEFAULT_FORM` + submit payload.
- `steps/review-step.tsx`: remove the "Audit reason" Label + Textarea block. `isReviewStepValid` becomes `() => true`.
- `steps/owner-step.tsx`: `ownerPassword` no longer required when present-but-empty. `isOwnerStepValid` accepts empty password (still validates >=8 chars + uppercase + digit when non-empty).
- Add helper text under password field: AR "اتركه فارغاً لتوليد كلمة مرور وإرسالها بالبريد الإلكتروني" / EN "Leave blank to auto-generate and email a password".
- AR + EN translation key updates (`messages/ar.json`, `messages/en.json`): remove `organizations.create.reason*`, add helper-text key.

### 3.7 Policy update

`apps/admin/CLAUDE.md` rule #5: change "Every destructive action collects a `reason` (min 10 chars)" → "Every destructive action **except tenant creation** collects a `reason` (min 10 chars). Tenant creation is recorded in `SuperAdminActionLog` without a free-text reason — the action itself is the audit trail."

---

## 4. Tests

- **New:** `owner-provisioning.service.spec.ts` covering: existing-user-by-id happy path, existing-user-by-email auto-link, new-user creation with provided password, new-user creation with generated password (assert policy), invalid input (neither id nor email), inactive user rejection.
- **Update:** `create-tenant.handler.spec.ts` — add cases for new-owner mode (with + without password), email-collision-auto-link, dropped `reason`, metadata flags.
- **Update:** `register-tenant.handler.spec.ts` — assert it now delegates to the shared service (mock or use real service); existing assertions keep passing.
- **Update:** `create-tenant-dialog.spec.tsx` — remove reason-field assertions, add password-optional assertions.
- **Update:** `organizations.controller.spec.ts` — drop reason from request payloads in tenant-create cases.
- **Snapshot:** `npm run openapi:build-and-snapshot` after DTO change; commit `apps/backend/openapi.json`.

---

## 5. Migration

A new Prisma migration makes `SuperAdminActionLog.reason` nullable. Migrations are immutable per CLAUDE.md — this is a new migration, not an edit.

---

## 6. Out of Scope

- Tenant self-serve UI changes (the website's register form is fine as-is).
- Plan/billing-cycle/trialDays exposure on the self-serve path (separate concern).
- Adding 2FA to new owner accounts (already covered by tenant security settings post-onboarding).

---

## 7. Risks

- **Email auto-link UX surprise:** super-admin might unintentionally link an unrelated existing user. Mitigation: the OwnerUserCombobox in "existing user" mode is the obvious path; "new owner" mode's auto-link only triggers on exact email match — the UI shows a toast "تم ربط مستخدم موجود" on success so the action is visible.
- **Generated password in email:** transit-only; never persisted. Standard practice for invite flows.
- **Race on email uniqueness:** email is `UNIQUE` in Prisma; on collision the service catches `P2002` and falls through to the link-existing branch.

---

## 8. Rollout

Single PR. No feature flag — the wizard already has the broken "new owner" mode visible; this PR fixes it end-to-end. Deploy backend + admin frontend together.
