# Plan — Auth Security Phase 1 (3 independent fixes)

**Worktree:** `/Users/tariq/code/carekit/.worktrees/auth-security-fixes`
**Branch:** `team/auth-security-fixes`
**Date:** 2026-04-25
**Owner-only review:** yes — every fix touches `identity/auth` (Security Tier 1).

## Goal

Three small, independent auth-security hardenings that can be executed in
parallel by Codex (FIX A + FIX B, backend-only) and Gemini (FIX C, multi-app).
No cross-fix dependencies; each fix can ship as its own commit and PR.

## Executor assignment

| Fix | Executor | Surface |
|-----|----------|---------|
| A — Revoke refresh tokens on switch-org | **Codex** | backend only |
| B — Separate `JWT_OTP_SECRET` | **Codex** | backend only |
| C — hCaptcha on staff `POST /auth/login` | **Gemini** | backend + dashboard + admin (website skipped — not staff) |

The two backend-only fixes (A + B) are co-located in `apps/backend` and share
the same Jest test runner; Codex executes them sequentially in one session.
Gemini owns FIX C end-to-end (backend DTO + 2 frontends + api-client).

---

## FIX A — Revoke refresh tokens on switch-organization

**Executor: Codex.** Backend-only. Tier 1 (auth).

### Files to modify
- `apps/backend/src/modules/identity/switch-organization/switch-organization.handler.ts` (lines 25–60 — `execute()` body, before `tokens.issueTokenPair` at line 55)
- `apps/backend/src/modules/identity/switch-organization/switch-organization.handler.spec.ts` (extend existing suite — add Prisma `refreshToken.updateMany` mock + 1 new case)

### TDD sequence
1. Edit spec: extend the `PrismaService` mock to include `refreshToken: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) }`.
2. Add new test case: `it('revokes all live refresh tokens for the user before issuing the new pair')` — asserts `prisma.refreshToken.updateMany` was called with `{ where: { userId: 'user-1', revokedAt: null }, data: { revokedAt: <Date> } }` AND that this call happened **before** `tokens.issueTokenPair` (use `mock.invocationCallOrder`).
3. Update the existing happy-path case (line 50) so the new mock does not break it — assert `updateMany` called once.
4. Update the inactive-membership / inactive-user cases (lines 70–99) to assert `updateMany` was NOT called (revocation only happens after authorization checks pass).
5. Run `npx jest switch-organization.handler.spec.ts` — confirm RED.
6. Implement: in `switch-organization.handler.ts`, between line 53 (`if (!user || !user.isActive)` block close) and line 55 (`return this.tokens.issueTokenPair(...)`), add:
   - `await this.prisma.refreshToken.updateMany({ where: { userId: cmd.userId, revokedAt: null }, data: { revokedAt: new Date() } });`
7. Re-run spec — confirm GREEN.
8. Run full backend suite: `cd apps/backend && npm test` — confirm 1025+/1025+ pass (no regressions).

### Acceptance criteria
- [ ] New spec case `revokes all live refresh tokens...` passes.
- [ ] All 5 prior cases in `switch-organization.handler.spec.ts` still green.
- [ ] `updateMany` is called with exactly `where: { userId, revokedAt: null }` and `data: { revokedAt: Date }`.
- [ ] Revocation runs AFTER membership + user active checks (no revocation on `ForbiddenException` / `UnauthorizedException` paths).
- [ ] No new `any` types introduced.

### Test commands
```bash
cd /Users/tariq/code/carekit/.worktrees/auth-security-fixes/apps/backend
npx jest src/modules/identity/switch-organization/switch-organization.handler.spec.ts
npm test
```

---

## FIX B — Separate `JWT_OTP_SECRET`

**Executor: Codex.** Backend-only. Tier 1 (auth).

### Files to modify
- `apps/backend/src/modules/identity/otp/otp-session.service.ts` (lines 22–40 — both `signSession` line 26 and `verifySession` line 35 currently read `JWT_ACCESS_SECRET`)
- `apps/backend/.env.example` (add `JWT_OTP_SECRET=` near line 34, in the auth section under `JWT_ACCESS_SECRET`)
- New spec: `apps/backend/src/modules/identity/otp/otp-session.service.spec.ts` (does not currently exist — create it)

### TDD sequence
1. Create `otp-session.service.spec.ts` with 3 cases:
   - `signs and verifies with JWT_OTP_SECRET when env var is set` — `ConfigService.get('JWT_OTP_SECRET')` returns `'otp-secret'`, sign produces a token verifiable by a `JwtService.verify(..., { secret: 'otp-secret' })` call; verify with wrong access-secret fails.
   - `falls back to JWT_ACCESS_SECRET with a warn log when JWT_OTP_SECRET is unset` — `ConfigService.get('JWT_OTP_SECRET')` returns `undefined`; spy on `Logger.prototype.warn` to assert one warn was emitted; sign uses `JWT_ACCESS_SECRET`.
   - `verifySession returns null on invalid signature` — pass a token signed with the wrong secret.
2. Run `npx jest otp-session.service.spec.ts` — confirm RED.
3. Implement in `otp-session.service.ts`:
   - Add `private readonly logger = new Logger(OtpSessionService.name);`.
   - Replace `this.config.getOrThrow('JWT_ACCESS_SECRET')` (lines 26 and 35) with a private helper `getOtpSecret()` that does:
     - read `this.config.get<string>('JWT_OTP_SECRET')`;
     - if set, return it;
     - else, `this.logger.warn('JWT_OTP_SECRET not set — falling back to JWT_ACCESS_SECRET. Set JWT_OTP_SECRET in production for namespace isolation.')` (warn ONCE per process — gate with a static flag);
     - return `this.config.getOrThrow('JWT_ACCESS_SECRET')`.
   - Both `signSession` and `verifySession` call `this.getOtpSecret()`.
4. Re-run spec — confirm GREEN.
5. Update `apps/backend/.env.example`: add line under `JWT_ACCESS_SECRET=...` (line 34):
   ```
   # OTP session token secret — isolates OTP-flow tokens from access tokens.
   # If unset, falls back to JWT_ACCESS_SECRET (dev convenience). REQUIRED in production.
   JWT_OTP_SECRET=dev-otp-secret-change-me
   ```
6. Verify no other code reads `JWT_OTP_SECRET` yet (`grep -rn JWT_OTP_SECRET apps/backend/src` should match only `otp-session.service.ts`).
7. Run full backend suite — confirm no regression in OTP request/verify spec files.

### Acceptance criteria
- [ ] `otp-session.service.spec.ts` exists and has 3 green cases.
- [ ] `JWT_OTP_SECRET` appears in `.env.example` with a comment.
- [ ] When `JWT_OTP_SECRET` is set, signing uses it (verifiable by decoding with the OTP secret).
- [ ] When unset, signing still works via `JWT_ACCESS_SECRET` and exactly one `Logger.warn` is emitted.
- [ ] Existing `request-otp.handler.spec.ts` + `verify-otp.handler.spec.ts` remain green.

### Test commands
```bash
cd /Users/tariq/code/carekit/.worktrees/auth-security-fixes/apps/backend
npx jest src/modules/identity/otp/
npm test
```

---

## FIX C — hCaptcha on staff `POST /auth/login`

**Executor: Gemini.** Backend + dashboard + admin. Tier 1 (auth).

### Scope decisions (verified during planning)
- **Staff endpoint only:** `POST /api/v1/public/auth/login` → `AuthController.loginEndpoint` (lines 72–125 of `apps/backend/src/api/public/auth.controller.ts`). This is the dashboard + admin login path.
- **Website client login is OUT OF SCOPE:** `apps/website/features/auth/login-form.tsx` calls `clientLoginApi` → `POST /api/v1/public/client-auth/login` (a separate endpoint with its own DTO + handler). This fix does NOT touch it. A follow-up phase covers `client-auth/login`.
- **`@hcaptcha/react-hcaptcha`** is already installed in `apps/website` (^1.17.4). Both `apps/dashboard` and `apps/admin` need the dependency added.
- **Site key env var:** `NEXT_PUBLIC_HCAPTCHA_SITE_KEY` (already in `apps/website/.env.example`). Add the same var to `apps/dashboard/.env.example` and `apps/admin/.env.example`. Fall back to hCaptcha's public test key when unset (mirrors `apps/website/features/otp/otp-request-form.tsx:11`).
- **Backend captcha verifier:** `CAPTCHA_VERIFIER` symbol from `apps/backend/src/modules/comms/contact-messages/captcha.verifier.ts`, already provided in `IdentityModule` (line 92 of `identity.module.ts`). Inject directly into `AuthController` — no new module wiring required.

### Files to modify

**Backend:**
- `apps/backend/src/modules/identity/login/login.dto.ts` — add `hCaptchaToken` field with `@IsString()` + `@ApiProperty`.
- `apps/backend/src/api/public/auth.controller.ts` — inject `@Inject(CAPTCHA_VERIFIER) captcha: CaptchaVerifier` (constructor lines 43–53); call `await this.captcha.verify(body.hCaptchaToken)` at top of `loginEndpoint` (line 72) and throw `BadRequestException('Invalid captcha token')` on false.
- `apps/backend/src/api/public/auth.controller.spec.ts` — add `captchaVerifier` mock to `buildController()` (line 11), 3 new cases (valid token passes through; invalid throws `BadRequestException`; missing token caught by class-validator at DTO level — covered separately in e2e or by `IsString()`).

**Shared API client:**
- `packages/api-client/src/modules/auth.ts` (line 9) — add `hCaptchaToken: string` to `LoginPayload` interface. This propagates to all consumers (dashboard `lib/api/auth.ts`, admin `login.api.ts`).

**Dashboard:**
- `apps/dashboard/package.json` — add `@hcaptcha/react-hcaptcha` ^1.17.4.
- `apps/dashboard/.env.example` — add `NEXT_PUBLIC_HCAPTCHA_SITE_KEY=`.
- `apps/dashboard/components/features/login-form.tsx` (lines 14–46) — add `<HCaptcha>` widget; track `hcaptchaToken` state; disable submit until token present; pass token to `login()`.
- `apps/dashboard/components/providers/auth-provider.tsx` (line 27) — change `login` signature to `(email, password, hCaptchaToken) => Promise<void>` and forward.
- `apps/dashboard/lib/api/auth.ts` — change `login(email, password, hCaptchaToken)` signature; pass through to `authApi.login({ email, password, hCaptchaToken })`.

**Admin:**
- `apps/admin/package.json` — add `@hcaptcha/react-hcaptcha` ^1.17.4.
- `apps/admin/.env.example` — add `NEXT_PUBLIC_HCAPTCHA_SITE_KEY=`.
- `apps/admin/features/auth/login/login-form.tsx` (lines 27–60) — add `<HCaptcha>` widget; gate submit; pass token.
- `apps/admin/features/auth/login/login.api.ts` — `LoginRequest` now `LoginPayload` (already aliased), captures the new field automatically; verify call site forwards `hCaptchaToken`.

### TDD sequence

**Backend phase (run first — Gemini step 1):**
1. Edit `auth.controller.spec.ts` `buildController()`: add `const captcha = { verify: jest.fn().mockResolvedValue(true) };` and pass as 10th constructor arg. Update existing `loginEndpoint` cases to include `hCaptchaToken: 'tok'` in the body.
2. Add 2 new cases under `describe('loginEndpoint')`:
   - `'rejects with BadRequestException when captcha verifier returns false'` — `captcha.verify.mockResolvedValueOnce(false)`; expect `BadRequestException`; `login.execute` NOT called.
   - `'calls captcha.verify with the request token before delegating to login handler'` — assert `captcha.verify` was called once with `'tok'` and that it ran before `login.execute` (invocation order).
3. Run `npx jest auth.controller.spec.ts` — confirm RED.
4. Implement:
   - `login.dto.ts` — add `@ApiProperty({ description: 'hCaptcha verification token' }) @IsString() hCaptchaToken!: string;`.
   - `auth.controller.ts` — import `CAPTCHA_VERIFIER`, `CaptchaVerifier` from `../../modules/comms/contact-messages/captcha.verifier`; add to constructor with `@Inject(CAPTCHA_VERIFIER)`; at top of `loginEndpoint` add `if (!(await this.captcha.verify(body.hCaptchaToken))) throw new BadRequestException('Invalid captcha token');`.
5. Re-run spec — GREEN. Run `npm run openapi:build-and-snapshot` to refresh the OpenAPI snapshot (`apps/backend/openapi.json`).

**Shared client phase (Gemini step 2):**
6. Edit `packages/api-client/src/modules/auth.ts` — add `hCaptchaToken: string` to `LoginPayload`.
7. Run `cd packages/api-client && npm run build` (if applicable) and `cd apps/dashboard && npm run typecheck` — expect compile errors at every `authApi.login(...)` call site. These errors drive the next steps.

**Dashboard phase (Gemini step 3):**
8. `npm install @hcaptcha/react-hcaptcha@^1.17.4 --workspace=apps/dashboard`.
9. Update `lib/api/auth.ts:login` signature → `(email, password, hCaptchaToken)` → `authApi.login({ email, password, hCaptchaToken })`.
10. Update `auth-provider.tsx`: `login: (email, password, hCaptchaToken) => Promise<void>`.
11. Update `components/features/login-form.tsx`: import `HCaptcha`; add `hcaptchaToken` state + `<HCaptcha>` block (mirror `apps/website/features/otp/otp-request-form.tsx:60-75`); disable submit while null; pass token in `await login(email, password, hcaptchaToken)`.
12. Add `NEXT_PUBLIC_HCAPTCHA_SITE_KEY=` to `apps/dashboard/.env.example`.
13. `cd apps/dashboard && npm run typecheck && npm run lint` — confirm green.

**Admin phase (Gemini step 4):**
14. `npm install @hcaptcha/react-hcaptcha@^1.17.4 --workspace=apps/admin`.
15. `apps/admin/features/auth/login/login-form.tsx` — add `HCaptcha` widget + state + gated submit + thread `hCaptchaToken` into `login({ email, password, hCaptchaToken })`.
16. Add `NEXT_PUBLIC_HCAPTCHA_SITE_KEY=` to `apps/admin/.env.example`.
17. `cd apps/admin && npm run typecheck && npm run lint` — confirm green.

**Verification phase (Gemini step 5):**
18. Manual QA via Chrome DevTools MCP: dashboard `/login` and admin `/login` — captcha visible, submit disabled until solved, login succeeds with valid solve, login returns 400 if backend forced to invalid token.

### Acceptance criteria
- [ ] `auth.controller.spec.ts` has 2 new cases, all cases green.
- [ ] `POST /auth/login` returns **400 BadRequest** with body containing `"Invalid captcha token"` when token verification fails.
- [ ] `POST /auth/login` returns **400 BadRequest** when `hCaptchaToken` is missing/empty (caught by `@IsString()` in `LoginDto`).
- [ ] OpenAPI snapshot (`apps/backend/openapi.json`) reflects the new field.
- [ ] `packages/api-client` exports updated `LoginPayload` requiring `hCaptchaToken`.
- [ ] Both `apps/dashboard` and `apps/admin` typecheck + lint clean.
- [ ] Both login forms render `<HCaptcha>` and disable submit until solved.
- [ ] Manual QA: end-to-end login on dashboard and admin succeeds with hCaptcha test key.
- [ ] Website `LoginForm` (client login) is **untouched**.

### Test commands
```bash
# Backend
cd /Users/tariq/code/carekit/.worktrees/auth-security-fixes/apps/backend
npx jest src/api/public/auth.controller.spec.ts
npm test
npm run openapi:build-and-snapshot

# Dashboard
cd /Users/tariq/code/carekit/.worktrees/auth-security-fixes/apps/dashboard
npm run typecheck && npm run lint && npm run test

# Admin
cd /Users/tariq/code/carekit/.worktrees/auth-security-fixes/apps/admin
npm run typecheck && npm run lint && npm run test
```

---

## Cross-fix dependencies

**None.** All three fixes touch disjoint files:
- A: `switch-organization/*` only.
- B: `otp/otp-session.service.*` + `.env.example` only.
- C: `login/`, `auth.controller.*`, frontends, api-client.

The only shared file across A and B is `apps/backend/.env.example` (B writes a new line); A does not touch it. Codex executes A then B sequentially in one session — no merge conflict.

FIX C touches `apps/backend/.env.example`? **No** — backend env unchanged (captcha verifier already configured via `IdentityModule`). Only frontend `.env.example` files are touched.

## Risks / open questions
- **OpenAPI snapshot drift** (FIX C): `apps/backend/openapi.json` is committed and CI-gated. Gemini must run `npm run openapi:build-and-snapshot` and include the regenerated file in the same commit.
- **`once-per-process` warn flag** (FIX B): if Jest's module-reset behavior resets the static flag between tests, the third spec case may need explicit reset — document in the spec with a `beforeEach` if so.
- **Public test site key**: dashboard + admin will need a documented fallback to hCaptcha's public test key (`10000000-ffff-ffff-ffff-000000000001`) so local dev doesn't break when the env var is unset — mirror `apps/website/features/otp/otp-request-form.tsx:11`.
- **Tenant-isolation tests:** none required — no new scoped models.
- **i18n parity:** FIX C adds 1–2 user-facing strings per frontend ("Please complete the captcha"). Add to both `ar.*.ts` and `en.*.ts` translation modules in dashboard; admin is LTR-only so no parity gate.
