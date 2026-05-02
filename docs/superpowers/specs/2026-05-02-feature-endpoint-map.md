# Feature Key ↔ Endpoint Map (Phase 1 enforcement scope)

**Date:** 2026-05-02
**Status:** Authoritative for Phase 1 wiring. Quantitative keys excluded (enforced by PlanLimitsGuard).

## Boolean keys — to be gated by `@RequireFeature` in Phase 1

| FeatureKey | Controller file | Method | HTTP path | Handler method | Audience |
|---|---|---|---|---|---|
| `RECURRING_BOOKINGS` | `api/dashboard/bookings.controller.ts` | POST | `/api/v1/dashboard/bookings/recurring` | `createRecurringBooking` | Dashboard |
| `WAITLIST` | `api/dashboard/bookings.controller.ts` | POST | `/api/v1/dashboard/bookings/waitlist` | `addToWaitlist` | Dashboard |
| `WAITLIST` | `api/dashboard/bookings.controller.ts` | GET | `/api/v1/dashboard/bookings/waitlist` | `listWaitlist` | Dashboard |
| `WAITLIST` | `api/dashboard/bookings.controller.ts` | DELETE | `/api/v1/dashboard/bookings/waitlist/:id` | `removeWaitlistEntry` | Dashboard |
| `GROUP_SESSIONS` | — | — | — | — | **Deferred — no current backend surface** |
| `AI_CHATBOT` | `api/dashboard/ai.controller.ts` | GET | `/api/v1/dashboard/ai/knowledge-base` | `listDocuments` | Dashboard |
| `AI_CHATBOT` | `api/dashboard/ai.controller.ts` | GET | `/api/v1/dashboard/ai/knowledge-base/:id` | `getDocument` | Dashboard |
| `AI_CHATBOT` | `api/dashboard/ai.controller.ts` | PATCH | `/api/v1/dashboard/ai/knowledge-base/:id` | `updateDocument` | Dashboard |
| `AI_CHATBOT` | `api/dashboard/ai.controller.ts` | DELETE | `/api/v1/dashboard/ai/knowledge-base/:id` | `deleteDocument` | Dashboard |
| `AI_CHATBOT` | `api/dashboard/ai.controller.ts` | GET | `/api/v1/dashboard/ai/chatbot-config` | `getChatbotConfigEndpoint` | Dashboard |
| `AI_CHATBOT` | `api/dashboard/ai.controller.ts` | PATCH | `/api/v1/dashboard/ai/chatbot-config` | `upsertChatbotConfigEndpoint` | Dashboard |
| `AI_CHATBOT` | `api/dashboard/ai.controller.ts` | POST | `/api/v1/dashboard/ai/chat` | `chatCompletionEndpoint` | Dashboard |
| `AI_CHATBOT` | `api/mobile/client/chat.controller.ts` | POST | `/api/v1/mobile/client/chat` | `chat` | Mobile (client) |
| `AI_CHATBOT` | `api/mobile/client/chat.controller.ts` | GET | `/api/v1/mobile/client/chat/conversations` | `listConversationsEndpoint` | Mobile (client) |
| `AI_CHATBOT` | `api/mobile/client/chat.controller.ts` | GET | `/api/v1/mobile/client/chat/conversations/:id/messages` | `listMessagesEndpoint` | Mobile (client) |
| `EMAIL_TEMPLATES` | `api/dashboard/comms.controller.ts` | GET | `/api/v1/dashboard/comms/email-templates` | `listEmailTemplatesEndpoint` | Dashboard |
| `EMAIL_TEMPLATES` | `api/dashboard/comms.controller.ts` | POST | `/api/v1/dashboard/comms/email-templates` | `createEmailTemplateEndpoint` | Dashboard |
| `EMAIL_TEMPLATES` | `api/dashboard/comms.controller.ts` | GET | `/api/v1/dashboard/comms/email-templates/:id` | `getEmailTemplateEndpoint` | Dashboard |
| `EMAIL_TEMPLATES` | `api/dashboard/comms.controller.ts` | POST | `/api/v1/dashboard/comms/email-templates/:id/preview` | `previewEmailTemplateEndpoint` | Dashboard |
| `EMAIL_TEMPLATES` | `api/dashboard/comms.controller.ts` | PATCH | `/api/v1/dashboard/comms/email-templates/:id` | `updateEmailTemplateEndpoint` | Dashboard |
| `COUPONS` | `api/dashboard/finance.controller.ts` | POST | `/api/v1/dashboard/finance/coupons/apply` | `applyCouponEndpoint` | Dashboard |
| `COUPONS` | `api/dashboard/finance.controller.ts` | GET | `/api/v1/dashboard/finance/coupons` | `listCouponsEndpoint` | Dashboard |
| `COUPONS` | `api/dashboard/finance.controller.ts` | GET | `/api/v1/dashboard/finance/coupons/:id` | `getCouponEndpoint` | Dashboard |
| `COUPONS` | `api/dashboard/finance.controller.ts` | POST | `/api/v1/dashboard/finance/coupons` | `createCouponEndpoint` | Dashboard |
| `COUPONS` | `api/dashboard/finance.controller.ts` | PATCH | `/api/v1/dashboard/finance/coupons/:id` | `updateCouponEndpoint` | Dashboard |
| `COUPONS` | `api/dashboard/finance.controller.ts` | DELETE | `/api/v1/dashboard/finance/coupons/:id` | `deleteCouponEndpoint` | Dashboard |
| `ADVANCED_REPORTS` | `api/dashboard/ops.controller.ts` | POST | `/api/v1/dashboard/ops/reports` | `generateReportEndpoint` | Dashboard |
| `INTAKE_FORMS` | `api/dashboard/organization-settings.controller.ts` | POST | `/api/v1/dashboard/organization/intake-forms` | `createIntakeFormEndpoint` | Dashboard |
| `INTAKE_FORMS` | `api/dashboard/organization-settings.controller.ts` | GET | `/api/v1/dashboard/organization/intake-forms` | `listIntakeFormsEndpoint` | Dashboard |
| `INTAKE_FORMS` | `api/dashboard/organization-settings.controller.ts` | GET | `/api/v1/dashboard/organization/intake-forms/:formId` | `getIntakeFormEndpoint` | Dashboard |
| `INTAKE_FORMS` | `api/dashboard/organization-settings.controller.ts` | DELETE | `/api/v1/dashboard/organization/intake-forms/:formId` | `deleteIntakeFormEndpoint` | Dashboard |
| `ZATCA` | `api/dashboard/finance.controller.ts` | POST | `/api/v1/dashboard/finance/zatca/submit` | `zatca` | Dashboard |
| `ZATCA` | `api/dashboard/finance.controller.ts` | GET | `/api/v1/dashboard/finance/zatca/config` | `getZatcaConfigEndpoint` | Dashboard |
| `ZATCA` | `api/dashboard/finance.controller.ts` | PATCH | `/api/v1/dashboard/finance/zatca/config` | `upsertZatcaConfigEndpoint` | Dashboard |
| `ZATCA` | `api/dashboard/finance.controller.ts` | POST | `/api/v1/dashboard/finance/zatca/onboard` | `onboardZatcaEndpoint` | Dashboard |
| `CUSTOM_ROLES` | `api/dashboard/identity.controller.ts` | POST | `/api/v1/dashboard/identity/roles` | `createRoleEndpoint` | Dashboard |
| `CUSTOM_ROLES` | `api/dashboard/identity.controller.ts` | POST | `/api/v1/dashboard/identity/roles/:id/permissions` | `assignPermissionsEndpoint` | Dashboard |
| `CUSTOM_ROLES` | `api/dashboard/identity.controller.ts` | DELETE | `/api/v1/dashboard/identity/roles/:id` | `deleteRoleEndpoint` | Dashboard |
| `ACTIVITY_LOG` | `api/dashboard/ops.controller.ts` | GET | `/api/v1/dashboard/ops/activity` | `listActivityEndpoint` | Dashboard |

## Out-of-scope (handled by PlanLimitsGuard in later phase)

- `BRANCHES`, `EMPLOYEES`, `SERVICES`, `MONTHLY_BOOKINGS`, `STORAGE` — quantitative.

## Notes / unknowns

- **GROUP_SESSIONS**: No backend surface found. No controller method, no handler import, no route matching `group` in `bookings.controller.ts`. Deferred — requires a new vertical slice before gating can be wired.
- **CUSTOM_ROLES reads excluded**: `GET /api/v1/dashboard/identity/roles` (`listRoles`) and `GET /api/v1/dashboard/identity/permissions` (`listPermissions`) are intentionally excluded. Read-only lookups are allowed for all plans so that existing role assignments remain visible even on plans without `CUSTOM_ROLES`. Only write operations (create, assign-permissions, delete) are gated.
- **INTAKE_FORMS controller**: intake-form endpoints live in `organization-settings.controller.ts` (prefix `dashboard/organization`), not a dedicated `intake-forms.controller.ts`. No other dashboard file surfaces intake-form routes.
- **AI_CHATBOT mobile surface**: Mobile chat (`mobile/client/chat.controller.ts`) also surfaces chatbot functionality via the same `ChatCompletionHandler`. Both dashboard and mobile audience endpoints should be gated consistently when `AI_CHATBOT` is off.
- **ADVANCED_REPORTS**: Only one endpoint (`POST /reports`). No `GET` list of past reports exists in the controller — the handler generates on demand.
