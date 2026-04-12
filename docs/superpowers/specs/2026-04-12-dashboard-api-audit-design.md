# Dashboard ↔ Backend API Audit & Sync

**Date**: 2026-04-12
**Scope**: `api/dashboard/` + `api/public/` controllers ↔ `lib/api/` + `hooks/` + `app/(dashboard)/`
**Goal**: Produce a mapping table, fix path mismatches, remove dead code, wire missing links, ensure test coverage.

---

## Critical Finding: Full Path Mismatch

The dashboard `lib/api/*.ts` calls paths **without** a `dashboard/` prefix (e.g. `/bookings`, `/clients`, `/employees`). The backend controllers register routes **with** the prefix (e.g. `dashboard/bookings`, `dashboard/people/clients`). The entire dashboard is currently disconnected from the new backend controllers.

---

## Audit Table — Dashboard Controllers

### Bookings (`dashboard/bookings`)

| # | Method | Backend Path | Dashboard API fn | lib/api file | Hook | Hook Spec | Status |
|---|--------|-------------|-----------------|-------------|------|-----------|--------|
| 1 | POST | `/dashboard/bookings` | `createBooking()` | bookings.ts → `/bookings` | useCreateBooking | use-bookings-mutations | **Path Mismatch** |
| 2 | POST | `/dashboard/bookings/recurring` | `createRecurringBooking()` | bookings.ts → `/bookings/recurring` | — | — | **Path Mismatch** |
| 3 | GET | `/dashboard/bookings` | `fetchBookings()` | bookings.ts → `/bookings` | useBookings | use-bookings-queries | **Path Mismatch** |
| 4 | GET | `/dashboard/bookings/availability` | — | — | — | — | **Gap: No Dashboard fn** |
| 5 | GET | `/dashboard/bookings/:id` | `fetchBooking()` | bookings.ts → `/bookings/${id}` | useBooking | use-bookings-queries | **Path Mismatch** |
| 6 | PATCH | `/dashboard/bookings/:id/cancel` | `adminCancelBooking()` | bookings.ts → `/bookings/${id}/cancel` | useCancelBooking | use-bookings-mutations | **Path Mismatch** |
| 7 | PATCH | `/dashboard/bookings/:id/reschedule` | `rescheduleBooking()` | bookings.ts → `/bookings/${id}/reschedule` | useReschedule | use-bookings-mutations | **Path Mismatch** |
| 8 | PATCH | `/dashboard/bookings/:id/confirm` | `confirmBooking()` | bookings.ts → `/bookings/${id}/confirm` | useConfirmBooking | use-bookings-mutations | **Path Mismatch** |
| 9 | PATCH | `/dashboard/bookings/:id/check-in` | `checkInBooking()` | bookings.ts → `/bookings/${id}/check-in` | useCheckIn | use-bookings-mutations | **Path Mismatch** |
| 10 | PATCH | `/dashboard/bookings/:id/complete` | `completeBooking()` | bookings.ts → `/bookings/${id}/complete` | useComplete | use-bookings-mutations | **Path Mismatch** |
| 11 | PATCH | `/dashboard/bookings/:id/no-show` | `markNoShow()` | bookings.ts → `/bookings/${id}/no-show` | useNoShow | use-bookings-mutations | **Path Mismatch** |
| 12 | POST | `/dashboard/bookings/waitlist` | `fetchWaitlist()` | waitlist.ts → `/waitlist` | useWaitlist | use-waitlist | **Path Mismatch + Wrong method** |

### People (`dashboard/people`)

| # | Method | Backend Path | Dashboard API fn | lib/api file | Hook | Hook Spec | Status |
|---|--------|-------------|-----------------|-------------|------|-----------|--------|
| 13 | POST | `/dashboard/people/clients` | `createWalkInClient()` | clients.ts → `/clients/walk-in` | — | — | **Path Mismatch** |
| 14 | GET | `/dashboard/people/clients` | `fetchClients()` | clients.ts → `/clients` | useClients | use-clients | **Path Mismatch** |
| 15 | GET | `/dashboard/people/clients/:id` | `fetchClient()` | clients.ts → `/clients/${id}` | useClient | use-clients | **Path Mismatch** |
| 16 | PATCH | `/dashboard/people/clients/:id` | `updateClient()` | clients.ts → `/clients/${id}` | — | — | **Path Mismatch** |
| 17 | POST | `/dashboard/people/employees` | `createEmployee()` | employees.ts → `/employees` | — | use-employee-mutations | **Path Mismatch** |
| 18 | GET | `/dashboard/people/employees` | `fetchEmployees()` | employees.ts → `/employees` | useEmployees | use-employees | **Path Mismatch** |
| 19 | GET | `/dashboard/people/employees/:id` | `fetchEmployee()` | employees.ts → `/employees/${id}` | useEmployee | use-employees | **Path Mismatch** |
| 20 | PATCH | `/dashboard/people/employees/:id/availability` | `setAvailability()` | employees-schedule.ts → ? | — | — | **Path Mismatch** |
| 21 | POST | `/dashboard/people/employees/:id/onboarding` | `onboardEmployee()` | employees.ts → `/employees/onboard` | — | use-employee-mutations | **Path Mismatch** |

### Organization — Branches (`dashboard/organization`)

| # | Method | Backend Path | Dashboard API fn | lib/api file | Hook | Hook Spec | Status |
|---|--------|-------------|-----------------|-------------|------|-----------|--------|
| 22 | POST | `/dashboard/organization/branches` | `createBranch()` | branches.ts → `/branches` | — | use-branches | **Path Mismatch** |
| 23 | GET | `/dashboard/organization/branches` | `fetchBranches()` | branches.ts → `/branches` | useBranches | use-branches | **Path Mismatch** |
| 24 | GET | `/dashboard/organization/branches/:branchId` | `fetchBranch()` | branches.ts → `/branches/${id}` | useBranch | use-branches | **Path Mismatch** |
| 25 | PATCH | `/dashboard/organization/branches/:branchId` | `updateBranch()` | branches.ts → `/branches/${id}` | — | use-branches | **Path Mismatch** |

### Organization — Categories (`dashboard/organization`)

| # | Method | Backend Path | Dashboard API fn | lib/api file | Hook | Hook Spec | Status |
|---|--------|-------------|-----------------|-------------|------|-----------|--------|
| 26 | POST | `/dashboard/organization/categories` | `createCategory()` | services.ts → `/services/categories` | — | — | **Path Mismatch** |
| 27 | GET | `/dashboard/organization/categories` | `fetchCategories()` | services.ts → `/services/categories` | useCategories | use-services-queries | **Path Mismatch** |
| 28 | PATCH | `/dashboard/organization/categories/:categoryId` | `updateCategory()` | services.ts → `/services/categories/${id}` | — | — | **Path Mismatch** |

### Organization — Departments (`dashboard/organization`)

| # | Method | Backend Path | Dashboard API fn | lib/api file | Hook | Hook Spec | Status |
|---|--------|-------------|-----------------|-------------|------|-----------|--------|
| 29 | POST | `/dashboard/organization/departments` | `createDepartment()` | departments.ts → `/departments` | — | use-departments | **Path Mismatch** |
| 30 | GET | `/dashboard/organization/departments` | `fetchDepartments()` | departments.ts → `/departments` | useDepartments | use-departments | **Path Mismatch** |
| 31 | PATCH | `/dashboard/organization/departments/:departmentId` | `updateDepartment()` | departments.ts → `/departments/${id}` | — | use-departments | **Path Mismatch** |

### Organization — Hours (`dashboard/organization`)

| # | Method | Backend Path | Dashboard API fn | lib/api file | Hook | Hook Spec | Status |
|---|--------|-------------|-----------------|-------------|------|-----------|--------|
| 32 | POST | `/dashboard/organization/hours` | `updateOrganizationHours()` | organization.ts → `/organization/hours` | — | use-organization-settings | **Path Mismatch** |
| 33 | GET | `/dashboard/organization/hours/:branchId` | `fetchOrganizationHours()` | organization.ts → `/organization/hours` | — | use-organization-settings | **Path Mismatch** |
| 34 | POST | `/dashboard/organization/holidays` | `createOrganizationHoliday()` | organization.ts → `/organization/holidays` | — | use-organization-settings | **Path Mismatch** |
| 35 | DELETE | `/dashboard/organization/holidays/:holidayId` | `deleteOrganizationHoliday()` | organization.ts → `/organization/holidays/${id}` | — | use-organization-settings | **Path Mismatch** |
| 36 | GET | `/dashboard/organization/holidays` | `fetchOrganizationHolidays()` | organization.ts → `/organization/holidays` | — | use-organization-settings | **Path Mismatch** |

### Organization — Settings (`dashboard/organization`)

| # | Method | Backend Path | Dashboard API fn | lib/api file | Hook | Hook Spec | Status |
|---|--------|-------------|-----------------|-------------|------|-----------|--------|
| 37 | POST | `/dashboard/organization/services` | `createService()` | services.ts → `/services` | — | use-services-mutations | **Path Mismatch** |
| 38 | GET | `/dashboard/organization/services` | `fetchServices()` | services.ts → `/services` | useServices | use-services-queries | **Path Mismatch** |
| 39 | PATCH | `/dashboard/organization/services/:serviceId` | `updateService()` | services.ts → `/services/${id}` | — | use-services-mutations | **Path Mismatch** |
| 40 | DELETE | `/dashboard/organization/services/:serviceId` | `deleteService()` | services.ts → `/services/${id}` | — | use-services-mutations | **Path Mismatch** |
| 41 | POST | `/dashboard/organization/branding` | `updateWhitelabel()` | whitelabel.ts → `/whitelabel` | — | use-whitelabel | **Path Mismatch** |
| 42 | GET | `/dashboard/organization/branding` | `fetchWhitelabel()` | whitelabel.ts → `/whitelabel` | useWhitelabel | use-whitelabel | **Path Mismatch** |
| 43 | POST | `/dashboard/organization/intake-forms` | `createIntakeForm()` | intake-forms.ts → `/intake-forms` | — | use-intake-forms | **Path Mismatch** |
| 44 | GET | `/dashboard/organization/intake-forms` | `fetchIntakeForms()` | intake-forms.ts → `/intake-forms` | useIntakeForms | use-intake-forms | **Path Mismatch** |
| 45 | GET | `/dashboard/organization/intake-forms/:formId` | `fetchIntakeForm()` | intake-forms.ts → `/intake-forms/${id}` | useIntakeForm | use-intake-forms | **Path Mismatch** |
| 46 | POST | `/dashboard/organization/ratings` | — | — | — | — | **Gap: No Dashboard fn** |
| 47 | GET | `/dashboard/organization/ratings` | — | ratings page exists but no `lib/api/ratings.ts` | — | — | **Gap: No Dashboard fn** |

### Finance (`dashboard/finance`)

| # | Method | Backend Path | Dashboard API fn | lib/api file | Hook | Hook Spec | Status |
|---|--------|-------------|-----------------|-------------|------|-----------|--------|
| 48 | POST | `/dashboard/finance/invoices` | `createInvoice()` | invoices.ts → `/invoices` | — | use-invoice | **Path Mismatch** |
| 49 | GET | `/dashboard/finance/invoices/:id` | `fetchInvoice()` | invoices.ts → `/invoices/${id}` | useInvoice | use-invoice | **Path Mismatch** |
| 50 | POST | `/dashboard/finance/payments` | — | — | — | — | **Gap: No Dashboard fn** |
| 51 | GET | `/dashboard/finance/payments` | `fetchPayments()` | payments.ts → `/payments` | usePayments | use-payments | **Path Mismatch** |
| 52 | POST | `/dashboard/finance/coupons/apply` | — | coupons.ts has CRUD but no `applyCoupon()` | — | — | **Gap: No Dashboard fn** |
| 53 | POST | `/dashboard/finance/zatca/submit` | — | zatca.ts has config/onboard but no `submitZatca()` | — | — | **Gap: No Dashboard fn** |

### Comms (`dashboard/comms`)

| # | Method | Backend Path | Dashboard API fn | lib/api file | Hook | Hook Spec | Status |
|---|--------|-------------|-----------------|-------------|------|-----------|--------|
| 54 | GET | `/dashboard/comms/notifications` | `fetchNotifications()` | notifications.ts → `/notifications` | useNotifications | use-notifications | **Path Mismatch** |
| 55 | PATCH | `/dashboard/comms/notifications/mark-read` | `markAllAsRead()` | notifications.ts → `/notifications/read-all` | — | use-notifications | **Path Mismatch + Wrong subpath** |
| 56 | GET | `/dashboard/comms/email-templates` | `fetchEmailTemplates()` | email-templates.ts → `/email-templates` | — | use-email-templates | **Path Mismatch** |
| 57 | POST | `/dashboard/comms/email-templates` | — | — | — | — | **Gap: No Dashboard fn** |
| 58 | GET | `/dashboard/comms/email-templates/:id` | `fetchEmailTemplate()` | email-templates.ts → `/email-templates/${slug}` | — | use-email-templates | **Path Mismatch** |
| 59 | PATCH | `/dashboard/comms/email-templates/:id` | `updateEmailTemplate()` | email-templates.ts → `/email-templates/${slug}` | — | use-email-templates | **Path Mismatch** |
| 60 | GET | `/dashboard/comms/chat/conversations` | `fetchChatSessions()` | chatbot.ts → `/chatbot/sessions` | useChatSessions | use-chat-sessions | **Path Mismatch** |
| 61 | GET | `/dashboard/comms/chat/conversations/:id/messages` | — | chatbot.ts has session-level fns but no `fetchMessages()` | — | — | **Gap: No Dashboard fn** |

### AI (`dashboard/ai`)

| # | Method | Backend Path | Dashboard API fn | lib/api file | Hook | Hook Spec | Status |
|---|--------|-------------|-----------------|-------------|------|-----------|--------|
| 62 | GET | `/dashboard/ai/knowledge-base` | `fetchKnowledgeBase()` | chatbot-kb.ts → `/chatbot/knowledge-base` | — | — | **Path Mismatch + Dead (0 importers)** |
| 63 | GET | `/dashboard/ai/knowledge-base/:id` | — | — | — | — | **Gap: No Dashboard fn** |
| 64 | PATCH | `/dashboard/ai/knowledge-base/:id` | `updateKnowledgeEntry()` | chatbot-kb.ts → `/chatbot/knowledge-base/${id}` | — | — | **Path Mismatch + Dead** |
| 65 | DELETE | `/dashboard/ai/knowledge-base/:id` | `deleteKnowledgeEntry()` | chatbot-kb.ts → `/chatbot/knowledge-base/${id}` | — | — | **Path Mismatch + Dead** |
| 66 | POST | `/dashboard/ai/chat` | — | chatbot.ts has `sendChatMessage()` → `/chatbot/sessions/${id}/messages` | — | — | **Path Mismatch** |

### Ops (`dashboard/ops`)

| # | Method | Backend Path | Dashboard API fn | lib/api file | Hook | Hook Spec | Status |
|---|--------|-------------|-----------------|-------------|------|-----------|--------|
| 67 | POST | `/dashboard/ops/reports` | `fetchRevenueReport()` etc. | reports.ts → `/reports/revenue` | — | — | **Path Mismatch** |
| 68 | GET | `/dashboard/ops/activity` | `fetchActivityLogs()` | activity-log.ts → `/activity-log` | useActivityLogs | use-activity-log | **Path Mismatch** |

### Media (`dashboard/media`)

| # | Method | Backend Path | Dashboard API fn | lib/api file | Hook | Hook Spec | Status |
|---|--------|-------------|-----------------|-------------|------|-----------|--------|
| 69 | POST | `/dashboard/media/upload` | — | — | — | — | **Gap: No Dashboard fn** |
| 70 | GET | `/dashboard/media/:id` | — | — | — | — | **Gap: No Dashboard fn** |
| 71 | DELETE | `/dashboard/media/:id` | — | — | — | — | **Gap: No Dashboard fn** |
| 72 | GET | `/dashboard/media/:id/presigned-url` | — | — | — | — | **Gap: No Dashboard fn** |

### Platform (`dashboard/platform`)

| # | Method | Backend Path | Dashboard API fn | lib/api file | Hook | Hook Spec | Status |
|---|--------|-------------|-----------------|-------------|------|-----------|--------|
| 73 | POST | `/dashboard/platform/problem-reports` | — | — | — | — | **Gap: No Dashboard fn** |
| 74 | GET | `/dashboard/platform/problem-reports` | — | — | — | — | **Gap: No Dashboard fn** |
| 75 | PATCH | `/dashboard/platform/problem-reports/:id/status` | — | — | — | — | **Gap: No Dashboard fn** |
| 76 | POST | `/dashboard/platform/integrations` | `updateOrganizationIntegrations()` | organization-integrations.ts → `/organization-integrations` | — | use-organization-integrations | **Path Mismatch** |
| 77 | GET | `/dashboard/platform/integrations` | `fetchOrganizationIntegrations()` | organization-integrations.ts → `/organization-integrations` | — | use-organization-integrations | **Path Mismatch** |

---

## Audit Table — Public Controllers

| # | Method | Backend Path | Dashboard API fn | lib/api file | Hook | Status |
|---|--------|-------------|-----------------|-------------|------|--------|
| 78 | POST | `/auth/login` | `login()` | auth.ts → `/auth/login` | — | **Connected** |
| 79 | POST | `/auth/refresh` | `refreshToken()` | auth.ts → `/auth/refresh-token` | — | **Path Mismatch** (`/refresh` vs `/refresh-token`) |
| 80 | POST | `/auth/logout` | `logoutApi()` | auth.ts → `/auth/logout` | — | **Connected** |
| 81 | GET | `/public/branding/:tenantId` | `fetchPublicBranding()` | whitelabel.ts → `/whitelabel/public` | — | **Path Mismatch** |
| 82 | GET | `/public/services/:tenantId` | — | widget.ts has `fetchWidgetServices()` → `/services` | — | **Path Mismatch** |
| 83 | GET | `/public/availability` | — | widget.ts has `fetchWidgetSlots()` | — | **Needs verification** |

---

## Dead Code — Dashboard API Functions Without Backend Endpoint

These `lib/api/` files contain functions that call paths with no matching backend controller endpoint:

| lib/api file | Functions | Called Path | Issue |
|-------------|----------|------------|-------|
| `chatbot-kb.ts` | `syncKnowledgeBase()`, `fetchKnowledgeFiles()`, `uploadKnowledgeFile()`, `processKnowledgeFile()`, `deleteKnowledgeFile()` | `/chatbot/knowledge-base/sync`, `/chatbot/knowledge-base/files` | No backend endpoint + 0 importers |
| `chatbot.ts` | `createChatSession()`, `endChatSession()`, `sendChatMessage()`, `fetchChatbotConfig()`, `updateChatbotConfig()`, `seedChatbotDefaults()`, `fetchChatbotAnalytics()`, `fetchTopQuestions()`, `sendStaffMessage()` | `/chatbot/*` | No `dashboard/` prefix controller for most |
| `booking-settings.ts` | `fetchBookingSettings()`, `updateBookingSettings()` | `/booking-settings` | No backend endpoint |
| `runs.ts` | `fetchRun()`, `pauseRun()`, `cancelRun()` | — | No backend endpoint |
| `license.ts` | `fetchLicense()`, `fetchLicenseFeatures()`, `updateLicense()` | `/license` | No backend endpoint |
| `feature-flags.ts` | `fetchFeatureFlags()`, `fetchFeatureFlagMap()`, `updateFeatureFlag()` | `/feature-flags` | No backend endpoint |
| `groups.ts` | all 14 functions | `/groups/*` | No backend endpoint |
| `waitlist.ts` | `fetchWaitlist()`, `removeWaitlistEntry()` | `/waitlist` | Backend has `POST /dashboard/bookings/waitlist` (add only) |

---

## Dead Code — Dashboard Hooks Without Matching API

| Hook | Imports from | Issue |
|------|-------------|-------|
| `use-groups.ts` | groups.ts | No backend endpoint |
| `use-groups-mutations.ts` | groups.ts | No backend endpoint |
| `use-chatbot-analytics.ts` | chatbot.ts | Functions call non-existent paths |
| `use-chatbot-config.ts` | chatbot.ts | Functions call non-existent paths |
| `use-chatbot-mutations.ts` | chatbot.ts | Functions call non-existent paths |
| `use-booking-slots.ts` | employees.ts | Calls `/employees` not `/dashboard/people/employees` |
| `use-feature-flags.ts` | feature-flags.ts | No backend endpoint |
| `use-license.ts` | license.ts | No backend endpoint |

---

## Summary Statistics

| Category | Count |
|----------|-------|
| Total backend endpoints (dashboard + public) | 83 |
| Path Mismatch (fn exists, wrong path) | ~55 |
| Gap: Backend endpoint, no dashboard fn | ~14 |
| Connected correctly | 2 (auth/login, auth/logout) |
| Dead code: dashboard fns with no backend | ~40+ functions across 8 files |
| Dead code: hooks with no backend | 8 hooks |

---

## Fix Plan

### Phase 1: Path Alignment (Priority: Critical)

Update all `lib/api/*.ts` files to call the correct `dashboard/` prefixed paths. This is a mechanical find-and-replace per file:

- `bookings.ts`: `/bookings` → `/dashboard/bookings`
- `clients.ts`: `/clients` → `/dashboard/people/clients`
- `employees.ts`: `/employees` → `/dashboard/people/employees`
- `branches.ts`: `/branches` → `/dashboard/organization/branches`
- `departments.ts`: `/departments` → `/dashboard/organization/departments`
- `services.ts`: `/services` → `/dashboard/organization/services`, categories → `/dashboard/organization/categories`
- `invoices.ts`: `/invoices` → `/dashboard/finance/invoices`
- `payments.ts`: `/payments` → `/dashboard/finance/payments`
- `coupons.ts`: `/coupons` → needs new endpoint or map to `/dashboard/finance/coupons/apply`
- `notifications.ts`: `/notifications` → `/dashboard/comms/notifications`
- `email-templates.ts`: `/email-templates` → `/dashboard/comms/email-templates`
- `organization.ts`: `/organization/hours` → `/dashboard/organization/hours`
- `organization-settings.ts`: `/organization-settings` → needs mapping
- `organization-integrations.ts`: `/organization-integrations` → `/dashboard/platform/integrations`
- `whitelabel.ts`: `/whitelabel` → `/dashboard/organization/branding`
- `intake-forms.ts`: `/intake-forms` → `/dashboard/organization/intake-forms`
- `activity-log.ts`: `/activity-log` → `/dashboard/ops/activity`
- `reports.ts`: `/reports` → `/dashboard/ops/reports`
- `auth.ts`: `/auth/refresh-token` → `/auth/refresh`
- `chatbot.ts`: `/chatbot/sessions` → `/dashboard/comms/chat/conversations`
- `zatca.ts`: partial — only `submit` maps to `/dashboard/finance/zatca/submit`

### Phase 2: Dead Code Removal

Delete or archive:
- `lib/api/chatbot-kb.ts` (0 importers)
- `lib/api/runs.ts` (no backend)
- `lib/api/booking-settings.ts` (no backend)
- `lib/api/license.ts` (no backend)
- `lib/api/feature-flags.ts` (no backend)
- `lib/api/groups.ts` (no backend)
- Functions in `chatbot.ts` that have no backend match
- Excess functions in `bookings.ts` (e.g. `approveCancellation`, `rejectCancellation`, `requestCancellation`, `clientReschedule`, `employeeCancelBooking`, `startBooking`, `fetchBookingStatusLog` — no matching endpoints)
- Excess functions in `clients.ts` (e.g. `fetchClientStats`, `fetchClientBookings`, `activateClient`, `deactivateClient`, `fetchClientListStats`)
- Excess functions in `branches.ts` (e.g. `deleteBranch`, `fetchBranchEmployees`, `assignBranchEmployees`, `removeBranchEmployee`)
- Excess functions in `employees.ts` (e.g. `deleteEmployee`)
- Excess functions in `services.ts` beyond CRUD (e.g. `fetchDurationOptions`, `setDurationOptions`, `uploadServiceImage`, `fetchServiceEmployees`, etc.)
- Excess functions in `invoices.ts` (e.g. `fetchInvoices`, `fetchInvoiceStats`, `fetchInvoiceByPayment`, `fetchInvoiceHtml`, `markInvoiceAsSent`)
- Excess functions in `payments.ts` (e.g. `fetchPaymentStats`, `fetchPaymentByBooking`, `refundPayment`, `updatePaymentStatus`, `verifyBankTransfer`, `reviewReceipt`)
- Corresponding hooks that import dead functions
- Widget-related functions: keep (they call public endpoints, separate concern)

### Phase 3: Wire Missing Dashboard Functions

Add `lib/api/` functions + hooks for backend endpoints that have no dashboard caller:
- `dashboard/bookings/availability` → `checkAvailability()`
- `dashboard/organization/ratings` → `submitRating()`, `fetchRatings()`
- `dashboard/finance/payments` (POST) → `processPayment()`
- `dashboard/finance/coupons/apply` → `applyCoupon()`
- `dashboard/finance/zatca/submit` → `submitToZatca()`
- `dashboard/comms/email-templates` (POST) → `createEmailTemplate()`
- `dashboard/comms/chat/conversations/:id/messages` → `fetchConversationMessages()`
- `dashboard/ai/knowledge-base/:id` (GET) → `fetchKnowledgeDocument()`
- `dashboard/media/*` (all 4 endpoints) → new `lib/api/media.ts`
- `dashboard/platform/problem-reports/*` (3 endpoints) → new `lib/api/problem-reports.ts`

### Phase 4: Test Coverage

**Already covered (backend):** All 14 dashboard controller specs exist.

**Already covered (dashboard hooks):** 35 hook specs exist.

**Missing:**
- Hook specs for any new hooks added in Phase 3
- Verify existing hook specs actually test the correct paths (they may test old paths)
- No `lib/api/*.spec.ts` files exist — consider adding if policy requires

---

## Decision Log

| Question | Decision |
|----------|----------|
| Scope | Dashboard + Public controllers only (no mobile) |
| Dead code policy | Delete fns with 0 importers immediately. Fns with importers but no backend endpoint → mark `@deprecated` with comment, delete in Phase 2b after confirming not planned |
| Missing endpoints | Wire with new lib/api fn + hook |
| Test coverage | Controller specs + hook specs minimum |
| Widget files | Keep — separate concern (public API) |
