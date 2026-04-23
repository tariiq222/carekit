# ADR: Card Display Metadata on Subscription Model

**Date:** 2026-04-23  
**Status:** Proposed  
**Author:** Rashed (planning persona)

## Context

Payment Methods (SaaS-06d) needs to display saved card info (last4, brand, expiry) without exposing the raw Moyasar token. `Subscription.moyasarCardTokenRef` already exists for the token itself.

## Decision

Add 4 nullable columns to `Subscription` in `platform.prisma`:
- `cardLast4 String?`
- `cardBrand String?`  
- `cardExpiryMonth Int?`
- `cardExpiryYear Int?`

**Not** a separate `SavedPaymentMethod` table, because:
- One active subscription per org enforced by `@unique(organizationId)`
- Multi-card support is not in scope for Phase 1

## Future Breakpoint

If multi-card support is required: extract to `SavedPaymentMethod` model, add `defaultPaymentMethodId` FK on `Subscription`.

## Rollback

Drop 4 nullable columns. No data loss, no FK changes. Safe.
