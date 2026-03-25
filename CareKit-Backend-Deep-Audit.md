# CareKit Backend — Deep Root-Cause Analysis

> **Staff/Principal Backend Engineer Audit**
> 363 TypeScript files • 29 modules • 206 endpoints • 80 services analyzed
> March 25, 2026 • Confidential

---

## 1. Executive Summary — Critical Findings

This is a root-cause analysis of the CareKit NestJS backend (363 TypeScript files, 29 modules, 206 API endpoints). The audit examined architecture, business logic, security, performance, and code quality at the source code level. Below is a severity-ranked summary of all discovered issues.

| Severity | Count | Categories |
|----------|-------|------------|
| **CRITICAL** | 5 | Race conditions (booking, payment, OTP, token), webhook idempotency |
| **HIGH** | 11 | Auth brute-force, missing ownership checks, timezone bugs, amount verification, missing indexes |
| **MEDIUM** | 10 | Inconsistent errors, dead code, cache stampede, file size violations, naming |
| **LOW** | 3 | Naming variance, minor code style, minor architecture |

**Total issues discovered: 29 actionable findings across 5 audit domains.**

---

## 2. Top Critical Issues (Must Fix Before Production)

### 2.1 Race Condition: Duplicate Payment Creation

**File:** `payments.service.ts` (lines 84-105)
**Severity:** CRITICAL — Financial integrity risk

Payment creation uses a non-atomic check-then-create pattern. Two concurrent requests for the same booking both pass the existence check and create duplicate payments. The `findUnique` and `create` are not wrapped in a transaction.

```typescript
const existing = await this.prisma.payment.findUnique({ where: { bookingId } });
if (existing) throw new BadRequestException(...);
// RACE WINDOW: Two requests pass this check simultaneously
return this.prisma.payment.create({ data: { bookingId, ... } });
```

**Fix:** Wrap in serializable transaction OR use Prisma upsert with unique constraint conflict handling.

---

### 2.2 Race Condition: OTP Reuse in Concurrent Verification

**File:** `otp.service.ts` (lines 43-112)
**Severity:** CRITICAL — Security vulnerability

Two concurrent requests can verify the same OTP before either marks it as used. The `findFirst` (where `usedAt: null`) and `update` (set `usedAt`) are not atomic. An attacker sending two parallel requests can use the same OTP code twice.

**Fix:** Replace with atomic `updateMany({ where: { id, usedAt: null }, data: { usedAt: new Date() } })` and check `modifiedCount > 0`.

---

### 2.3 Race Condition: Moyasar Webhook Idempotency Gap

**File:** `moyasar-payment.service.ts` (lines 134-195)
**Severity:** CRITICAL — Duplicate/lost transactions

Webhook idempotency check (`findUnique` on `processedWebhook.eventId`) is done outside the transaction. Two concurrent webhook deliveries for the same event can both pass the check before either creates the `ProcessedWebhook` record. One transaction will fail with a unique constraint violation that is not caught.

**Fix:** Move `processedWebhook.create()` inside the transaction BEFORE payment update. Catch unique constraint violations gracefully.

---

### 2.4 Race Condition: Token Refresh Dual-Use

**File:** `token.service.ts` (lines 53-95)
**Severity:** CRITICAL — Token theft undetectable

Refresh token rotation has a race window between delete and create. Two concurrent refresh requests with the same token can both succeed. Additionally, there is no token reuse detection — if an attacker steals a refresh token and uses it, the legitimate user's subsequent use generates a new valid token pair instead of triggering a compromise alert.

**Fix:** Use serializable transaction for atomic delete + create. Implement token family tracking: if a deleted token is reused, revoke ALL tokens for that user (compromise detected).

---

### 2.5 Double-Booking: Zoom Creation Outside Transaction

**File:** `bookings.service.ts` (lines 131-198)
**Severity:** CRITICAL — Booking integrity

Zoom meeting is created BEFORE the serializable transaction. Two concurrent booking requests both create Zoom meetings, then both enter the transaction. If both pass the conflict check (possible in edge cases), two bookings exist with two different Zoom meetings for the same slot.

**Fix:** Move Zoom meeting creation inside the transaction, or implement post-transaction cleanup that deletes orphaned Zoom meetings.

---

## 3. High Severity Issues

| # | Issue | File | Impact |
|---|-------|------|--------|
| H1 | OTP brute-force: 5 attempts/min throttle is too weak for 6-digit OTP | `auth.controller.ts:105` | Account takeover possible in 24 hours |
| H2 | Payment amount never verified server-side against booking price | `moyasar-payment.service.ts:57-71` | Client can pay less than owed |
| H3 | Vacation check timezone bug: UTC midnight normalization vs Riyadh timezone | `booking-validation.helper.ts:25-38` | Bookings allowed during practitioner vacation |
| H4 | No token reuse detection (token theft recovery) | `token.service.ts` | Stolen tokens remain undetectable |
| H5 | Payment failure leaves booking orphaned (fire-and-forget) | `bookings.service.ts:201-203` | Booking stuck in pending forever |
| H6 | Buffer time enforcement app-level only, no DB constraint | `booking-validation.helper.ts:87-93` | Direct DB manipulation bypasses buffers |
| H7 | Booking reschedule missing practitioner ownership check | `bookings.controller.ts:130` | Anyone can reschedule any booking |
| H8 | Booking status transitions (confirm/checkIn) lack user context | `bookings.controller.ts:161-193` | Staff can modify arbitrary bookings |
| H9 | Missing composite index on OTP queries (userId + type + usedAt) | `schema.prisma` | Full table scan on every OTP verification |
| H10 | Missing index on practitioner availability (practitionerId + dayOfWeek + isActive) | `schema.prisma` | Slow availability lookups per booking |
| H11 | bookings.service.ts exceeds 350-line limit (380 lines, 12 dependencies) | `bookings.service.ts` | Violates project rules, maintenance risk |

---

## 4. Business Logic Flaws

### 4.1 Booking Status State Machine: No Transition Validation

**File:** `bookings.service.ts` (reschedule, lines 263-277)

When a booking is rescheduled, the new booking inherits the old booking's status WITHOUT validation. If an `in_progress` booking is rescheduled, the new booking becomes `in_progress` immediately (invalid — should start as `confirmed`). There is no central state machine defining valid transitions.

**Fix:** Create a `BookingStateMachine` constant defining allowed transitions. Validate before every status change.

---

### 4.2 Cancellation Logic Scattered Across 3 Files

**Files:** `booking-cancellation.service.ts`, `booking-cancel-helpers.service.ts`, `booking-lookup.helper.ts`

Cancellation authorization ("who can cancel?") is checked differently in 3 places. Patient ownership check in one file, practitioner ownership in another, status validation in a third. If rules change, 3 files must be updated consistently.

**Fix:** Create `BookingAuthorizationService` with centralized `validateOwnership()` and `validateCancellable()` methods.

---

### 4.3 Pricing Logic Split Without Clear Boundary

**Files:** `price-resolver.service.ts` (140 lines), `booking-payment.helper.ts` (42 lines)

Price resolution (which price tier to use) lives in `PriceResolverService`. VAT calculation and payment record creation live in `BookingPaymentHelper`. If VAT rules change, developers may not know to update the helper. No single source of truth for "total amount = price + VAT".

**Fix:** Consolidate into `PriceResolverService`: `resolve()` should return `{ basePrice, vatAmount, totalAmount }`.

---

### 4.4 Bank Transfer Receipt: Rejected Receipts Deletable and Replayable

**File:** `bank-transfer.service.ts` (lines 239-261)

When a receipt is rejected, the payment record is DELETED (not marked rejected). The patient can upload the exact same receipt image again. No hash-based deduplication prevents repeated fraudulent uploads.

**Fix:** Mark payment as `rejected` instead of deleting. Store receipt image hash and block reuse.

---

## 5. Security Vulnerabilities

| ID | Vulnerability | Severity | File | Exploitability |
|----|--------------|----------|------|----------------|
| S1 | Booking reschedule: no ownership check | HIGH | `bookings.controller.ts:130` | Any authenticated user can reschedule any booking |
| S2 | Booking confirm/checkIn: no user context passed | HIGH | `bookings.controller.ts:161-193` | Staff can confirm arbitrary bookings |
| S3 | OTP brute-forcible: 6-digit with 5/min throttle | HIGH | `otp.service.ts` + `auth.controller.ts` | 50% crack chance in 24h |
| S4 | JWT algorithm not explicitly pinned to HS256 | MEDIUM | `jwt.strategy.ts` | Algorithm-switching attack possible |
| S5 | User PII in JWT payload (phone, gender, createdAt) | MEDIUM | `user-payload.type.ts` | Token leaks expose personal data |
| S6 | Login endpoint reveals user existence | MEDIUM | `auth.controller.ts:65` | Email enumeration possible |
| S7 | Pagination sortBy not whitelisted in DTO | MEDIUM | `pagination-query.dto.ts` | Potential injection in raw queries |
| S8 | Admin can book for any patient without audit | MEDIUM | `bookings.service.ts:51` | No trail, no patient notification |
| S9 | Stack traces sent to Sentry in production | MEDIUM | `http-exception.filter.ts:57` | Information disclosure |

**Positive security findings:** bcrypt with 10 rounds (good), file uploads validate magic bytes (good), Prisma parameterized queries (good), refresh token rotation (good), soft deletes (good), receipt file type/size validation (good).

---

## 6. Performance Bottlenecks

### 6.1 Missing Database Indexes

| Table | Query Pattern | Current Index | Recommended Index |
|-------|--------------|---------------|-------------------|
| OtpCode | userId + type + usedAt | `@@index([userId])` | `@@index([userId, type, usedAt])` |
| PractitionerAvailability | practitionerId + dayOfWeek + isActive | `@@index([practitionerId, dayOfWeek])` | Add isActive to composite |
| Payment | status (for stats queries) | None on status | `@@index([status, deletedAt])` |
| RefreshToken | expiresAt (for cleanup) | `@@unique([token]), @@index([userId])` | `@@index([expiresAt])` |
| Booking | practitionerId + date + status | `@@index([practitionerId, date])` | Add status to composite |

### 6.2 Sequential Queries in Availability Endpoint

**File:** `practitioner-availability.service.ts` (lines 87-143)

Four sequential database queries for availability, vacations, breaks, and bookings. These are independent and should use `Promise.all()` for parallel execution. Current pattern adds ~4x latency on every availability lookup (a public, high-traffic endpoint).

**Fix:** `const [availabilities, vacation, breaks, bookings] = await Promise.all([...])`

### 6.3 Cache Stampede in Auth Cache

**File:** `token.service.ts` (lines 153-187)

When the auth cache expires for a frequently accessed user, all concurrent requests hit the database simultaneously (thundering herd). No cache locking or probabilistic early refresh is implemented.

**Fix:** Use Redis `SETNX`-based locking or background cache refresh before TTL expires.

---

## 7. Code Duplication

### 7.1 Error Response Shape Inconsistency

Exception throwing is inconsistent: some modules use structured objects (`{ statusCode, message, error }`) while others use plain strings. This breaks frontend error parsing reliability.

- **Structured (correct):** bookings, services, auth — `throw new NotFoundException({ statusCode: 404, message: '...', error: 'NOT_FOUND' })`
- **Plain string (incorrect):** patients, ratings, roles — `throw new NotFoundException('Patient not found')`

**Fix:** Create `throwNotFound(message, code)` helper. Use across all modules.

### 7.2 Booking Lookup Methods Triplication

**File:** `booking-lookup.helper.ts` (lines 20-48)

Three nearly identical methods: `findBookingOrFail()`, `findWithPayment()`, `findWithRelations()`. All share the same where clause and error handling, differing only in include options.

**Fix:** Consolidate into `findBookingOrFail(id, options?: { include? })` with optional include parameter.

### 7.3 Notification Message Constants Not Centralized

Bilingual notification messages (Arabic/English) are defined inline in multiple service files. Same message patterns repeated across `booking-cancel-helpers.service.ts`, `booking-status.service.ts`, and notifications helpers.

**Fix:** Create `shared/constants/notification-messages.ts` with all bilingual templates.

---

## 8. Architecture Assessment

### 8.1 Architecture Strengths ✅

- 23 clean domain modules with proper NestJS boundaries
- All controllers delegate to services — no business logic in route handlers
- Centralized error handling (global exception filter + Sentry + structured logger)
- Proper DI everywhere — no manual instantiation (`new Service()`) detected
- Well-organized shared utilities in `common/` (decorators, guards, helpers, interceptors, pipes)
- Redis-backed rate limiting and throttling
- Circuit breakers on all 4 external APIs (Moyasar, Zoom, OpenRouter, SMS)
- Pagination logic properly centralized — used consistently across 18+ services

### 8.2 Architecture Weaknesses

- `ChatbotToolsService` has tight coupling: directly imports `BookingsService`, `ServicesService`, `PractitionersService` — needs abstraction layer
- `BookingsService` is a growing "god service" with 12 injected dependencies and 380 lines
- No repository pattern — acceptable for current scale but limits testability for complex queries
- Timezone handling hardcoded to `Asia/Riyadh` — breaks for multi-timezone deployments
- Single circular dependency: `UsersModule` ↔ `PractitionersModule` (managed with `forwardRef`, acceptable)

### 8.3 Scalability Assessment

The system is designed for single-instance Docker deployment per client (White Label). For this model, the architecture is adequate. However, if horizontal scaling (multiple backend instances) is needed, the following break:

- In-memory circuit breaker state is per-instance — needs Redis-backed circuit breakers
- BullMQ queue processing assumes single consumer — needs concurrency config for multi-instance
- No distributed locking for booking creation race conditions

---

## 9. Dead Code & Unused Artifacts

The codebase is relatively clean with minimal dead code. The following items were identified:

- Two separate cancellation services (`booking-cancellation.service.ts` + `booking-cancel-helpers.service.ts`) with unclear responsibility boundaries — review for potential merge
- `booking-automation.service.ts` at 367 lines is approaching the 350-line limit and mixes query logic with automation logic
- No unused exported functions or orphaned services detected — the codebase is well-maintained
- Test files are appropriately large (1,129 lines for `bookings.spec.ts`) — this is normal

---

## 10. Prioritized Action Plan

### Phase A: Critical Security Fixes (Day 1-2)

1. **Fix payment creation race condition:** Wrap in serializable transaction with unique constraint on bookingId
2. **Fix OTP reuse race condition:** Replace `findFirst` + `update` with atomic `updateMany` where `usedAt IS NULL`
3. **Fix webhook idempotency:** Move `processedWebhook.create` inside transaction, catch unique constraint errors
4. **Fix token refresh race:** Serializable transaction + token family tracking for theft detection
5. **Fix Zoom creation outside transaction:** Move inside transaction or implement post-transaction orphan cleanup

### Phase B: High Priority Fixes (Day 3-5)

1. Strengthen OTP brute-force protection: reduce to 3 lifetime attempts, implement 24h lockout, increase to 8 digits
2. Add server-side payment amount verification against booking price in Moyasar flow
3. Fix vacation check timezone bug: use clinic timezone (from WhiteLabelConfig) for date normalization
4. Add ownership checks to booking reschedule and status transition endpoints
5. Add 5 missing database indexes (OTP, availability, payment status, token expiry, booking composite)
6. Split `bookings.service.ts` to comply with 350-line limit

### Phase C: Medium Priority Improvements (Day 6-10)

1. Standardize error response shape across all modules (structured `{ statusCode, message, error }`)
2. Create `BookingStateMachine` constant with valid status transitions
3. Create `BookingAuthorizationService` to centralize ownership and cancellation checks
4. Pin JWT algorithm to HS256 explicitly, remove PII from JWT payload
5. Add cache stampede protection with Redis `SETNX` locking
6. Parallelize availability endpoint queries with `Promise.all()`
7. Refactor `ChatbotToolsService` to use abstraction interfaces instead of direct service imports
8. Mark rejected bank transfer receipts instead of deleting; add receipt hash deduplication

---

## 11. Complete Issue Matrix

| # | Issue | Severity | Category | File |
|---|-------|----------|----------|------|
| C1 | Payment creation race condition | **CRITICAL** | Race Condition | `payments.service.ts:84` |
| C2 | OTP reuse in concurrent verification | **CRITICAL** | Race Condition | `otp.service.ts:43` |
| C3 | Webhook idempotency gap | **CRITICAL** | Race Condition | `moyasar-payment.service.ts:134` |
| C4 | Token refresh dual-use race | **CRITICAL** | Race Condition | `token.service.ts:53` |
| C5 | Double-booking Zoom outside tx | **CRITICAL** | Race Condition | `bookings.service.ts:131` |
| H1 | OTP brute-force throttle too weak | HIGH | Security | `auth.controller.ts:105` |
| H2 | Payment amount not verified server-side | HIGH | Security | `moyasar-payment.service.ts:57` |
| H3 | Vacation check timezone bug | HIGH | Logic Flaw | `booking-validation.helper.ts:25` |
| H4 | No token theft detection | HIGH | Security | `token.service.ts` |
| H5 | Payment failure orphans booking | HIGH | Logic Flaw | `bookings.service.ts:201` |
| H6 | Buffer enforcement app-level only | HIGH | Logic Flaw | `booking-validation.helper.ts:87` |
| H7 | Missing ownership check on reschedule | HIGH | Security | `bookings.controller.ts:130` |
| H8 | Status transitions lack user context | HIGH | Security | `bookings.controller.ts:161` |
| H9 | Missing OTP composite index | HIGH | Performance | `schema.prisma` |
| H10 | Missing availability composite index | HIGH | Performance | `schema.prisma` |
| H11 | bookings.service.ts exceeds 350 lines | HIGH | Code Quality | `bookings.service.ts` |
| M1 | Error response shape inconsistent | MEDIUM | Code Quality | Multiple files |
| M2 | Booking lookup logic triplicated | MEDIUM | Duplication | `booking-lookup.helper.ts` |
| M3 | Cancellation auth logic scattered | MEDIUM | Duplication | 3 files |
| M4 | JWT algorithm not pinned | MEDIUM | Security | `jwt.strategy.ts` |
| M5 | PII in JWT payload | MEDIUM | Security | `user-payload.type.ts` |
| M6 | Cache stampede (auth cache) | MEDIUM | Performance | `token.service.ts:153` |
| M7 | Missing payment status index | MEDIUM | Performance | `schema.prisma` |
| M8 | Sequential availability queries | MEDIUM | Performance | `practitioner-availability.service.ts` |
| M9 | Rejected receipts deleted not marked | MEDIUM | Logic Flaw | `bank-transfer.service.ts:239` |
| M10 | Pricing logic split without boundary | MEDIUM | Architecture | 2 files |
| L1 | ChatbotToolsService tight coupling | LOW | Architecture | `chatbot-tools.service.ts` |
| L2 | Timezone hardcoded to Riyadh | LOW | Architecture | `practitioner-availability.service.ts` |
| L3 | Notification messages not centralized | LOW | Duplication | Multiple files |

---

## 12. Conclusion

The CareKit backend demonstrates solid engineering fundamentals: clean module architecture, proper dependency injection, centralized error handling, and good pagination patterns. However, the audit uncovered **5 critical race conditions** that must be fixed before production deployment. These are concurrency issues in the most sensitive flows: payments, authentication, and booking creation.

The 11 high-severity issues center on authorization gaps (missing ownership checks), security weaknesses (OTP brute-force, unverified payment amounts), and missing database indexes. These are typical of a rapidly developed MVP and are straightforward to fix.

**Estimated total remediation time: 8-12 engineering days for all 29 issues, with the 5 critical fixes achievable in 2 days by an experienced backend engineer.**

---

*CareKit — WebVue Technology Solutions — Confidential*
