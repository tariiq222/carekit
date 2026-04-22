# Data Integrity Hardening — Consumer Handlers for PR #34

> **Context.** PR #34 landed schema changes (CHECK constraints, `OtpCode.lockedUntil/maxAttempts`, `PasswordHistory`, `EmployeeAvailabilityException.endTime/isStartTimeOnly`) without the handlers that consume them. This plan closes that gap so the schema doesn't lie to itself.

**Branch:** `feat/data-integrity-fixes` (extend PR #34, don't open a new one).

**Not part of SaaS phase map** — this is hardening driven by `docs/audits/gap-analysis-report.md` and `docs/audits/2026-04-12-backend-hardening-changelog.md`.

---

## Scope

Three consumer gaps, one test run, one commit on top of PR #34:

1. **PasswordHistory enforcement** for Client password reset (Client-side only — schema keys to `clientId`). Staff `User.ChangePasswordHandler` is out of scope (no `User` password history model).
2. **OTP lockout** — progressive lockout on `OtpCode.lockedUntil`, rejecting verify attempts once the window is set.
3. **Partial-day leave** — `create-employee-exception` accepts `endTime` + `isStartTimeOnly`; `check-availability` honors them.

---

## Task 1 — PasswordHistory service + reset-password integration

**New file:** `apps/backend/src/modules/identity/client-auth/shared/password-history.service.ts`

```ts
@Injectable()
export class PasswordHistoryService {
  static readonly HISTORY_DEPTH = 5;
  constructor(private readonly prisma: PrismaService, private readonly passwords: PasswordService) {}

  async assertNotReused(clientId: string, organizationId: string, plainPassword: string): Promise<void> {
    const history = await this.prisma.passwordHistory.findMany({
      where: { clientId, organizationId },
      orderBy: { createdAt: 'desc' },
      take: PasswordHistoryService.HISTORY_DEPTH,
    });
    for (const row of history) {
      if (await this.passwords.verify(plainPassword, row.passwordHash)) {
        throw new BadRequestException('PASSWORD_REUSED');
      }
    }
  }

  async record(tx: Prisma.TransactionClient, clientId: string, organizationId: string, passwordHash: string): Promise<void> {
    await tx.passwordHistory.create({ data: { clientId, organizationId, passwordHash } });
    // Trim to last N
    const surplus = await tx.passwordHistory.findMany({
      where: { clientId, organizationId },
      orderBy: { createdAt: 'desc' },
      skip: PasswordHistoryService.HISTORY_DEPTH,
      select: { id: true },
    });
    if (surplus.length) await tx.passwordHistory.deleteMany({ where: { id: { in: surplus.map(r => r.id) } } });
  }
}
```

**Wire-in to `reset-password.handler.ts`:**
- Before `tx.client.update({ passwordHash })`, also compare the new password against the current `passwordHash` (not in history table) — prevents "reset to same password".
- Call `PasswordHistoryService.assertNotReused()` before the transaction.
- Inside the transaction, after the `client.update`, call `PasswordHistoryService.record(tx, ...)` with the NEW hash (so next reset treats it as history).

**SCOPED_MODELS:** add `'PasswordHistory'` to `prisma.service.ts`.

**Identity module:** register `PasswordHistoryService` as provider.

**Spec:** `password-history.service.spec.ts` (4 cases — empty history, matches row 1, matches row 5, miss) + extend `reset-password.handler.spec.ts` with reuse-rejection path.

---

## Task 2 — OTP lockout

**Policy (matches schema defaults):**
- `OtpCode.maxAttempts = 5` (existing default).
- When `attempts >= maxAttempts` AND `lockedUntil IS NULL`: set `lockedUntil = now() + 15 minutes`, throw.
- When `lockedUntil > now()`: throw immediately — no increment.
- When `lockedUntil <= now()`: permit verify (clears via consume); lockout resets only on new `request-otp` (which invalidates prior code via `consumedAt`).

**Edit `verify-otp.handler.ts`:**

```ts
if (otpRecord.lockedUntil && otpRecord.lockedUntil > new Date()) {
  throw new BadRequestException('OTP_LOCKED_OUT');
}

await this.prisma.otpCode.update({
  where: { id: otpRecord.id },
  data: { attempts: { increment: 1 } },
});

// re-fetch attempt count for lockout decision
if (otpRecord.attempts + 1 >= otpRecord.maxAttempts) {
  await this.prisma.otpCode.update({
    where: { id: otpRecord.id },
    data: { lockedUntil: new Date(Date.now() + 15 * 60 * 1000) },
  });
}
```

Replace the hard-coded `MAX_VERIFY_ATTEMPTS = 5` constant with the row's `maxAttempts`.

**Spec:** extend `verify-otp.handler.spec.ts` — 3 new cases (locked-out rejection, transition at 5th attempt, lockout expiry passes).

---

## Task 3 — Partial-day leave

**`create-employee-exception.dto.ts`:** add optional `endTime: string` (ISO datetime) + `isStartTimeOnly: boolean`.

**`create-employee-exception.handler.ts`:** pass new fields through to Prisma `.create({ data })`.

**`check-availability.handler.ts` (line 77 region):** when an exception row has `endTime` set AND the requested slot's `scheduledAt` is strictly after the exception's `endTime` on its last day, the slot is NOT blocked. When `isStartTimeOnly=true`, exception blocks only from `startTime` onwards on the start date (not full day). Detailed semantic:

| Scenario | startDate | endDate | endTime | isStartTimeOnly | Blocks |
|---|---|---|---|---|---|
| Full multi-day leave (today's behavior) | 2026-05-01 | 2026-05-07 | null | false | entire range |
| Partial last-day (leaves early) | 2026-05-01 | 2026-05-07 | 2026-05-07T14:00Z | false | up to 14:00 on May 7 |
| Partial first-day (leaves mid-day) | 2026-05-07 | 2026-05-07 | null | true | from exception startTime (= createdAt hour-of-day)… |

**Decision:** `isStartTimeOnly` field is ill-specified in schema — the schema comment says "startTime" but the model has `startDate` (a `@db.Date`, not a time). Defer `isStartTimeOnly` to a follow-up; implement **only `endTime`** in this PR and flag `isStartTimeOnly` as schema-only until we clarify semantics. Document in `docs/audits/` as open item.

**Spec:** extend `check-availability.handler.spec.ts` with one new test — `endTime` releases slots after the time on last day.

---

## Task 4 — Verification

- `cd apps/backend && npm run typecheck`
- `cd apps/backend && npx jest src/modules/identity src/modules/people src/modules/bookings`
- `cd apps/backend && npm run test` (full unit)
- `cd apps/backend && npm run prisma:migrate` against a fresh DB
- Update PR #34 description checkboxes.

---

## Out of scope (tracked separately)

- `CouponRedemption` UNIQUE(couponId, clientId) — already enforced in `apply-coupon.handler.ts` on PR #34.
- `Booking` CHECK `endsAt ≥ scheduledAt` — DB-level only, no handler changes needed (create-booking guarantees the invariant at runtime).
- `Service` CHECK constraints — DB-level only.
- `Client.deletedAt` partial index — performance only, no handler changes.
- `FeatureFlag.id` cuid→uuid migration — internal only.
- Staff `User` password history — separate model + feature decision; not in scope.
- `EmployeeAvailabilityException.isStartTimeOnly` consumer — semantic unclear; follow-up plan.

---

## Risks

- **Reset-password tx already holds `FOR UPDATE` on `Client`** — adding history check OUTSIDE tx is correct (compare against stable passwords; attacker cannot race a reuse bypass because session is single-use via `usedOtpSession`).
- **OTP lockout + retry path:** ensure `request-otp`'s `updateMany` that consumes prior codes also implicitly resets lockout (new row = fresh `lockedUntil=null`). Already true.
- **Multi-tenant:** `passwordHistory` is scoped (will be added to `SCOPED_MODELS`). Reset handler already has `organizationId` via `tenant.requireOrganizationIdOrDefault()`.

---

## Acceptance

- [ ] `PasswordHistoryService` + spec, wired into reset-password.
- [ ] `PasswordHistory` in `SCOPED_MODELS`.
- [ ] OTP verify honors `lockedUntil`, sets it at max attempts.
- [ ] `create-employee-exception` accepts + persists `endTime`.
- [ ] `check-availability` honors `endTime` on last day.
- [ ] Unit suite green; migrate cleanly on fresh DB.
- [ ] PR #34 description checkboxes ticked.
