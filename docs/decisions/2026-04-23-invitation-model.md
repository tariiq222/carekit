# ADR: Invitation Model in platform.prisma

**Date:** 2026-04-23  
**Status:** Proposed  
**Author:** Rashed (planning persona)

## Context

Members management (SaaS-06c) requires a way to invite users by email before they have an account. We need to persist invitation state: PENDING → ACCEPTED | REVOKED | EXPIRED.

## Decision

Add `Invitation` model to `platform.prisma` (co-located with `Membership`).

**Not** tenant-scoped via CLS Prisma extension — same pattern as `Membership` itself, which is a platform join record, not a tenant-data record.

## Consequences

- New migration `20260423_saas_06c_invitation` — forward-only, additive
- Token = signed JWT (`INVITE_SECRET`, 72h TTL). Stateless verify + DB lookup for revocation
- Public endpoint `POST /api/v1/public/auth/accept-invitation` — no auth guard, token is the credential

## Rollback

Drop `Invitation` table. No FK cascade to existing tables. Safe.
