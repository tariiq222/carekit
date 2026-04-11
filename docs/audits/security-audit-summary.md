# CareKit — Security Audit Summary

> **Audit Date:** March 2026 | **Status:** All findings remediated
> **Auditor:** WebVue Technology Solutions — Internal Security Review

---

## 1. Scope

- **Backend:** NestJS + Prisma + PostgreSQL + Redis + BullMQ
- **Dashboard:** Next.js 14 + shadcn/ui
- **Mobile:** React Native (Expo SDK 54)
- **Infrastructure:** Docker + Nginx + MinIO
- **Focus:** OWASP Top 10, authentication/authorization, data protection, infrastructure security

---

## 2. Security Architecture Overview

CareKit implements an 8-layer defense-in-depth model:

| Layer | Component | Controls |
|-------|-----------|----------|
| 1. Network | Nginx | TLS 1.2+, rate limiting, IP restrictions on sensitive endpoints |
| 2. Application | NestJS middleware | helmet, CORS whitelist, cookie-parser, security headers |
| 3. Authentication | JWT + OTP | Access/refresh token rotation, OTP with per-email throttle |
| 4. Authorization | Dynamic RBAC | CASL-based PermissionsGuard, cache invalidation on role change |
| 5. Input Validation | ValidationPipe | @MaxLength on all string fields, file magic-byte verification |
| 6. Data Integrity | Prisma transactions | Serializable isolation, unique constraints, HMAC webhook verification |
| 7. Resilience | Circuit breaker | Timeouts on external APIs, Redis noeviction policy, global error handlers |
| 8. Observability | Sentry + Prometheus | Error tracking, metrics, health checks, correlation IDs |

---

## 3. OWASP Top 10 Coverage

| # | Category | Mitigation |
|---|----------|------------|
| A01 | Broken Access Control | RBAC with PermissionsGuard on every endpoint + ownership checks |
| A02 | Cryptographic Failures | TLS 1.2+, bcrypt for passwords, HMAC-SHA256 for webhooks |
| A03 | Injection | Prisma ORM (parameterized queries), embedding input validation guard |
| A04 | Insecure Design | Serializable transactions for bookings, idempotent webhook processing |
| A05 | Security Misconfiguration | helmet headers, CORS whitelist, `server_tokens off` in Nginx |
| A06 | Vulnerable Components | Node 20+ required via `engines` constraint in package.json |
| A07 | Auth Failures | JWT + refresh rotation + OTP throttle + token invalidation on password change |
| A08 | Software Integrity | HMAC webhook verification, ProcessedWebhook dedup table |
| A09 | Logging & Monitoring | Sentry error tracking, Prometheus metrics, correlation IDs, audit log |
| A10 | SSRF | No user-controlled URLs in backend HTTP fetches |

---

## 4. Critical Security Fixes Applied

| # | Fix | Impact |
|---|-----|--------|
| 1 | Booking race condition | Serializable transaction + DB unique constraint prevents double-booking |
| 2 | Token invalidation on password change | All existing sessions invalidated when password is updated |
| 3 | Auth cache invalidation on role change | RBAC cache cleared immediately when admin modifies a user's role |
| 4 | Redis noeviction policy | Prevents silent cache drops that could bypass security checks |
| 5 | Nginx reverse proxy + SSL | Backend never exposed directly; TLS terminates at Nginx |
| 6 | Circuit breaker on external APIs | Moyasar, Zoom, OpenRouter — prevents cascade failures |
| 7 | Phone number validation (E.164) | Rejects malformed phone numbers at input boundary |
| 8 | Metrics endpoint IP restriction | `/metrics` accessible only from internal network |
| 9 | Sentry error filtering | Prisma known errors excluded to reduce noise |
| 10 | Security headers on all Nginx locations | No location block bypasses security header injection |

---

## 5. Cryptographic Inventory

| Purpose | Algorithm | Key / Config |
|---------|-----------|-------------|
| Password hashing | bcrypt (10 rounds) | `SALT_ROUNDS` constant |
| JWT signing | HS256 | `JWT_SECRET` env var |
| Webhook verification | HMAC-SHA256 | `MOYASAR_WEBHOOK_SECRET` env var |
| TLS | TLSv1.2 / TLSv1.3 | Nginx SSL configuration |
| ZATCA invoice signing | XML Digital Signature | ZATCA CSID certificate |
| Invoice hash chain | SHA-256 | Sequential chaining (previous hash feeds next) |

---

## 6. Data Protection

- **Passwords:** bcrypt hashed, never stored or logged in plaintext
- **Tokens:** SHA-256 hashed before database storage
- **PII:** Soft deletes only — client data is never hard deleted
- **File uploads:** MinIO on internal Docker network, not publicly accessible
- **Secrets:** Environment variables only — no hardcoded credentials in source code
- **Dev credentials:** Removed from codebase; `.env.example` contains placeholders only

---

## 7. Known Limitations

| # | Limitation | Risk Level | Notes |
|---|-----------|------------|-------|
| 1 | Dashboard middleware checks cookie presence, not JWT validity | Medium | Mitigated by backend JWT validation on all API calls |
| 2 | Circuit breaker state is in-process | Low | Not shared across replicas; acceptable for single-instance deployment |
| 3 | No WAF deployed | Medium | Nginx rate limiting provides partial coverage |
| 4 | No penetration test performed | Medium | Recommended before production launch |
| 5 | 8 test files exceed 350-line limit | None | Code quality issue, not a security concern |

---

## 8. Recommendations for Next Phase

1. **WAF rules in Nginx** — Deploy ModSecurity or a cloud-based WAF for deeper request inspection
2. **JWT validation in Next.js middleware** — Use `jose` library for proper token verification at the edge
3. **Penetration test** — Engage a third-party security firm before production launch
4. **Redis Sentinel** — Deploy for high availability and automatic failover
5. **PgBouncer** — Add connection pooling layer for production database scaling
6. **Dependency scanning in CI** — Run `npm audit` and Snyk/Trivy on every pull request

---

> **Next review scheduled:** Before production launch (Phase 9)
