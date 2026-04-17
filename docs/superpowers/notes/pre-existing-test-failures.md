# Pre-existing backend test failures — to fix in a follow-up

Discovered during Task 1 of website Phase 1 (2026-04-17). These are unrelated to the BrandingConfig migration; they exist on main after the Phase 0 merge.

## Failing tests

1. `apps/backend/src/modules/bookings/get-booking/get-booking.handler.spec.ts`
   - Error: `.toISOString()` called on `undefined`
2. `apps/backend/src/modules/bookings/list-bookings/list-bookings.handler.spec.ts`
   - Error: `prisma.client.findMany is not a function`
3. `apps/backend/src/modules/people/employees/list-get-employees.handler.spec.ts`
   - Error: received value has no `length` property

## Decision

Deferred. Not a Phase 1 blocker. Open a dedicated branch to fix before Phase 2.

## Owner

TBD
