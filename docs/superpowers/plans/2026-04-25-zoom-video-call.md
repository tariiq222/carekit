# Plan: Zoom Video Call Integration (per-tenant, S2S OAuth)

## Goal
Productionize Zoom video calls for online bookings: per-tenant Server-to-Server OAuth credentials encrypted at rest (AES-GCM, orgId AAD), idempotent meeting creation on booking confirmation, observable failure status, dashboard config UI, mobile join/start CTAs.

## Current State (discovered)
- `apps/backend/src/modules/bookings/create-zoom-meeting/create-zoom-meeting.handler.ts` exists; uses `Integration.config` JSON (plaintext) + S2S OAuth; called from `confirm-booking` for `bookingType === 'ONLINE'`. No status, no idempotency, fail bubbles up and breaks confirm.
- `Booking` already has `zoomMeetingId`, `zoomJoinUrl`, `zoomHostUrl` (no status, no startUrl/joinUrl split semantics — `zoomHostUrl` already = startUrl).
- `Integration` model is org-scoped composite-unique on `(organizationId, provider)`.
- Encryption pattern: `apps/backend/src/infrastructure/sms/sms-credentials.service.ts` (AES-256-GCM + orgId AAD). Mirror it.
- Service has `BookingType.ONLINE` via `ServiceBookingConfig`; no `requiresVideoCall` flag — the ONLINE config IS the flag. Use existing semantics (don't add a new boolean).
- Mobile screens `app/(client)/video-call.tsx`, `app/(employee)/video-call.tsx`, `appointment/[id].tsx` exist (likely placeholders).
- Dashboard `app/(dashboard)/settings/sms/` is the reference layout.

## Files affected

### Create — Backend
- `apps/backend/src/infrastructure/zoom/zoom-credentials.service.ts` — AES-GCM encrypt/decrypt of `{clientId, clientSecret, accountId}` with orgId AAD (mirror `sms-credentials.service.ts`).
- `apps/backend/src/infrastructure/zoom/zoom-api.client.ts` — thin HTTP client (token cache by orgId, `createMeeting`, `deleteMeeting`, `getMeeting`); injectable, mockable in tests.
- `apps/backend/src/modules/integrations/zoom/get-zoom-config.handler.ts` — read masked view.
- `apps/backend/src/modules/integrations/zoom/upsert-zoom-config.handler.ts` — encrypt+upsert via `Integration` row (`provider='zoom'`).
- `apps/backend/src/modules/integrations/zoom/test-zoom-config.handler.ts` — perform token fetch only; return ok/error.
- `apps/backend/src/modules/integrations/zoom/zoom-config.controller.ts` — `GET/PUT/POST /integrations/zoom[/test]`.
- `apps/backend/src/modules/integrations/zoom/dto/upsert-zoom-config.dto.ts`.
- `apps/backend/src/modules/integrations/zoom/zoom.module.ts` (if not folded into bookings module).
- `apps/backend/src/modules/bookings/retry-zoom-meeting/retry-zoom-meeting.handler.ts` — owner/admin-triggered retry for `failed` meetings.
- `apps/backend/src/modules/bookings/create-zoom-meeting/create-zoom-meeting.handler.spec.ts` — already exists; expand.
- `apps/backend/test/integrations/zoom-config.e2e-spec.ts` — tenant isolation (org A cannot read org B's config; cross-tenant booking cannot use other org's creds).
- `apps/backend/test/bookings/confirm-booking-zoom.e2e-spec.ts` — confirm flow with mocked Zoom HTTP.

### Create — Dashboard
- `apps/dashboard/app/(dashboard)/settings/integrations/zoom/page.tsx` — config form (clientId, clientSecret, accountId; show "configured" mask, Test button, Save).
- `apps/dashboard/components/features/zoom/ZoomConfigForm.tsx`.
- `apps/dashboard/hooks/useZoomConfig.ts` — TanStack Query (`get`, `upsert`, `test`).
- `apps/dashboard/lib/api/zoom-config.ts`.
- `apps/dashboard/components/features/bookings/BookingZoomPanel.tsx` — meeting status pill + Copy join link + Retry (when `failed`).

### Create — Mobile
- `apps/mobile/components/features/booking/JoinVideoCallButton.tsx` — visible 15 min before `scheduledAt` until `endsAt`; opens `zoomJoinUrl` (client) / `zoomHostUrl` (employee) via `Linking.openURL`.
- `apps/mobile/services/client/zoom-meeting.ts` — fetch booking with zoom fields (use existing endpoint).

### Modify — Backend
- `apps/backend/prisma/schema/bookings.prisma` — add `zoomStartUrl String?` (rename intent: `zoomHostUrl` → kept; add `zoomMeetingStatus` enum + `zoomMeetingError String?` + `zoomMeetingCreatedAt DateTime?`). Keep existing columns to avoid data loss.
- `apps/backend/src/modules/bookings/create-zoom-meeting/create-zoom-meeting.handler.ts` — (a) decrypt creds via `ZoomCredentialsService`; (b) idempotency: skip if `zoomMeetingId && status='CREATED'`; (c) wrap try/catch → set status `FAILED` + `zoomMeetingError`; (d) inject `ZoomApiClient`; (e) on success set `status='CREATED'`, `zoomMeetingCreatedAt`.
- `apps/backend/src/modules/bookings/confirm-booking/confirm-booking.handler.ts` — call `createZoomMeeting` AFTER transaction (already is) but do NOT throw on failure — log + status persisted.
- `apps/backend/src/modules/bookings/cancel-booking/cancel-booking.handler.ts` — call `ZoomApiClient.deleteMeeting` if `zoomMeetingId` present (best-effort).
- `apps/backend/src/modules/bookings/reschedule-booking/reschedule-booking.handler.ts` — update Zoom meeting time (PATCH `/meetings/:id`).
- `apps/backend/src/modules/bookings/bookings.module.ts` — wire new handlers + `ZoomApiClient` + credentials service.
- `apps/backend/src/modules/bookings/booking-row.mapper.ts` — expose zoom fields (status + URLs) on booking DTO.

### Modify — Dashboard
- `apps/dashboard/app/(dashboard)/settings/page.tsx` — add Zoom integration card link.
- `apps/dashboard/app/(dashboard)/bookings/[id]/page.tsx` (or detail panel) — render `BookingZoomPanel`.
- `apps/dashboard/i18n/{ar,en}.json` — Zoom strings (settings + booking panel).

### Modify — Mobile
- `apps/mobile/app/(client)/appointment/[id].tsx` — render `JoinVideoCallButton` when `zoomJoinUrl` present.
- `apps/mobile/app/(employee)/appointment/[id].tsx` — render Start button using `zoomHostUrl`.
- `apps/mobile/i18n/{ar,en}.json` — `videoCall.join`, `videoCall.start`, `videoCall.notReadyYet`, `videoCall.failed`.
- `apps/mobile/types/booking.ts` (or shared) — add zoom fields.

### Modify — Shared
- `packages/shared/src/types/booking.ts` — `ZoomMeetingStatus` enum + booking fields.
- `packages/api-client` — typed endpoints if generated.

## Migration plan (immutable; one new dir per phase)
1. `apps/backend/prisma/migrations/20260425200000_zoom_meeting_status/` — adds: `Booking.zoomMeetingStatus` (enum `ZoomMeetingStatus { PENDING, CREATED, FAILED, CANCELLED }`, default NULL), `zoomMeetingError TEXT NULL`, `zoomMeetingCreatedAt TIMESTAMP NULL`. Backfill existing rows where `zoomMeetingId IS NOT NULL` → `CREATED`.
2. `apps/backend/prisma/migrations/20260425200500_zoom_integration_encrypted_marker/` — no schema change; data migration that flags any existing plaintext `Integration` rows where `provider='zoom'` as inactive (force re-entry through encrypted upsert). Document in NOTES.md.

(No second migration if no existing prod rows — confirm with owner; otherwise drop step 2.)

## Phased steps

### Phase 1 — Backend foundation (1 PR, owner-review gated)
1. Add migration #1; regenerate Prisma client.
2. Create `ZoomCredentialsService` + unit tests (encrypt/decrypt round-trip, AAD mismatch fails).
3. Create `ZoomApiClient` with injected `fetch` (token cache TTL = `expires_in - 60s` keyed by orgId).
4. Build `integrations/zoom` module (handlers + controller + DTO with class-validator).
5. Add e2e tenant isolation spec.
6. Refactor `create-zoom-meeting.handler.ts` → uses encrypted creds + status field + try/catch; expand existing spec.
7. Wire `cancel-booking` + `reschedule-booking` to Zoom API (best-effort).
8. Build `retry-zoom-meeting` handler + controller route (`POST /bookings/:id/zoom/retry`, role-guarded).
9. Confirm `confirm-booking` does NOT throw on Zoom failure.

### Phase 2 — Dashboard surface (1 PR)
1. `/settings/integrations/zoom` page + form + Test button.
2. Booking detail Zoom panel with status pill + Copy + Retry.
3. i18n strings (ar/en parity).
4. Vitest for hooks; manual QA via Chrome DevTools MCP → Kiwi sync (`Manual QA / Integrations`).

### Phase 3 — Mobile surface (1 PR)
1. Extend booking types + mappers; surface zoom fields in client/employee booking responses.
2. `JoinVideoCallButton` with time-window logic (now ≥ scheduledAt - 15min && now ≤ endsAt).
3. Wire into client + employee appointment screens.
4. Jest tests for window logic + URL opening.

## Tests
- **Unit**: `zoom-credentials.service.spec.ts` (encrypt/decrypt, AAD tamper rejection); `zoom-api.client.spec.ts` (token cache, error mapping, retry on 401); `create-zoom-meeting.handler.spec.ts` (idempotent, persists FAILED with error string, success path); `retry-zoom-meeting.handler.spec.ts`; mobile `JoinVideoCallButton.test.tsx` (time window).
- **E2E**: `zoom-config.e2e-spec.ts` (org A creates → org B GET = 404); `confirm-booking-zoom.e2e-spec.ts` (ONLINE booking + mocked Zoom 200 → CREATED; mocked 500 → FAILED but booking still CONFIRMED); cancel/reschedule propagation spec.
- **Kiwi**: TestPlan `Deqah / Integrations / Manual QA` build `zoom-2026-04-25` — config, save, test, create meeting, retry on failure, mobile join.

## Acceptance criteria
- [ ] No plaintext Zoom credentials anywhere in DB (`Integration.config` for `provider='zoom'` is null/empty; ciphertext lives in encrypted column or ciphertext JSON envelope).
- [ ] Confirming an ONLINE booking with valid Zoom config persists `zoomMeetingId`, `zoomJoinUrl`, `zoomHostUrl`, `zoomMeetingStatus='CREATED'`.
- [ ] Confirming with Zoom outage leaves booking CONFIRMED + `zoomMeetingStatus='FAILED'` + `zoomMeetingError` populated; no exception bubbles to caller.
- [ ] Re-confirming or retrying an already-CREATED booking does NOT call Zoom API (verified by mock call count).
- [ ] Tenant A cannot read Tenant B's Zoom config (e2e green).
- [ ] Cancel booking → Zoom meeting deleted (best-effort; failure logged not thrown).
- [ ] Reschedule booking → Zoom meeting time updated.
- [ ] Dashboard `/settings/integrations/zoom` saves + tests config; booking detail shows status + Retry.
- [ ] Mobile client sees Join button only inside [start-15min, end] window; employee sees Start button using host URL.
- [ ] All AR/EN strings present; RTL clean.
- [ ] `npm run test` + `npm run test:e2e` green; typecheck clean; no `any`.

## Risks / open questions
- **Webhooks**: do we need Zoom webhook ingestion (meeting.started, meeting.ended, participant_joined) for attendance tracking? Defer unless required.
- **Token cache scope**: in-memory per process is fine for now; revisit if backend horizontally scales (move to Redis).
- **Refund/no-show on failed meeting**: policy decision — auto-refund? Out of scope for this PR; raise to owner.
- **Rate limits**: Zoom S2S has per-account QPS limits; add exponential backoff in `ZoomApiClient` (decision: 3 retries, 250/750/1500ms).
- **Existing plaintext `Integration.config`**: confirm with owner if any prod row exists; if yes, run data migration to inactivate & force re-entry.
- **Time zone**: handler hardcodes `Asia/Riyadh`; should use `OrganizationSettings.timezone` if present.
- **Recurring bookings**: currently each occurrence is a separate Booking — each gets its own meeting? Confirm (assume yes; matches current code).

## Out of scope
- Cloud recording, breakout rooms, registration, polls, alternative hosts.
- Alternative providers (Google Meet, MS Teams, Jitsi) — provider-abstraction layer is a future plan.
- Zoom webhook ingestion / attendance analytics.
- SDK-embedded in-app video (we use Zoom-hosted URL via `Linking.openURL`).
- Auto-refund on meeting creation failure.
