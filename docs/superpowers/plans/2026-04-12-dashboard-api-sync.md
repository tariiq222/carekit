# Dashboard ↔ Backend API Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the complete path mismatch between the dashboard `lib/api/` layer and the new backend controllers, remove dead code, wire missing API functions, and verify test coverage.

**Architecture:** The dashboard calls plain paths like `/bookings` but the backend registers routes under `dashboard/bookings`, `dashboard/people`, `dashboard/organization`, etc. Every `lib/api/*.ts` file needs its paths updated. Simultaneously, several `lib/api/` files contain functions calling endpoints that don't exist in the new backend — these must be deleted. After path alignment, a small number of backend endpoints have no dashboard caller at all — new `lib/api/` functions and hooks fill those gaps.

**Tech Stack:** NestJS 11 (backend controllers), Next.js 15 / TanStack Query v5 (dashboard hooks), Jest (backend specs), Vitest (dashboard specs), TypeScript strict.

---

## File Map

### Phase 1 — Modify (path updates only, no logic changes)

| File | Change |
|------|--------|
| `apps/dashboard/lib/api/bookings.ts` | Update all paths `/bookings` → `/dashboard/bookings` |
| `apps/dashboard/lib/api/clients.ts` | `/clients` → `/dashboard/people/clients` |
| `apps/dashboard/lib/api/employees.ts` | `/employees` → `/dashboard/people/employees` |
| `apps/dashboard/lib/api/branches.ts` | `/branches` → `/dashboard/organization/branches` |
| `apps/dashboard/lib/api/departments.ts` | `/departments` → `/dashboard/organization/departments` |
| `apps/dashboard/lib/api/services.ts` | `/services` → `/dashboard/organization/services`; `/services/categories` → `/dashboard/organization/categories` |
| `apps/dashboard/lib/api/whitelabel.ts` | `/whitelabel` → `/dashboard/organization/branding` |
| `apps/dashboard/lib/api/intake-forms.ts` | `/intake-forms` → `/dashboard/organization/intake-forms` |
| `apps/dashboard/lib/api/invoices.ts` | `/invoices` → `/dashboard/finance/invoices` |
| `apps/dashboard/lib/api/payments.ts` | `/payments` → `/dashboard/finance/payments` |
| `apps/dashboard/lib/api/notifications.ts` | `/notifications` → `/dashboard/comms/notifications` |
| `apps/dashboard/lib/api/email-templates.ts` | `/email-templates` → `/dashboard/comms/email-templates` |
| `apps/dashboard/lib/api/chatbot.ts` | `/chatbot/sessions` → `/dashboard/comms/chat/conversations` |
| `apps/dashboard/lib/api/organization.ts` | `/organization/hours` → `/dashboard/organization/hours`; `/organization/holidays` → `/dashboard/organization/holidays` |
| `apps/dashboard/lib/api/organization-integrations.ts` | `/organization-integrations` → `/dashboard/platform/integrations` |
| `apps/dashboard/lib/api/activity-log.ts` | `/activity-log` → `/dashboard/ops/activity` |
| `apps/dashboard/lib/api/reports.ts` | `/reports/*` → `/dashboard/ops/reports` (POST body, not GET) |
| `apps/dashboard/lib/api/auth.ts` | `/auth/refresh-token` → `/auth/refresh` |
| `apps/dashboard/lib/api/zatca.ts` | keep `/zatca/*` as-is (no matching backend endpoint yet — mark with `// TODO: no backend endpoint`) |
| `apps/dashboard/lib/api/organization-settings.ts` | mark all 7 calls with `// TODO: no backend endpoint` |
| `apps/dashboard/lib/api/waitlist.ts` | `/waitlist` → `/dashboard/bookings/waitlist` (GET only; POST is for adding) |

### Phase 2 — Delete

| File/Function | Reason |
|--------------|--------|
| `apps/dashboard/lib/api/chatbot-kb.ts` | 0 importers, no backend endpoints |
| `apps/dashboard/lib/api/runs.ts` | No backend endpoint |
| `apps/dashboard/lib/api/booking-settings.ts` | No backend endpoint |
| `apps/dashboard/lib/api/license.ts` | No backend endpoint |
| `apps/dashboard/lib/api/feature-flags.ts` | No backend endpoint |
| `apps/dashboard/lib/api/groups.ts` | No backend endpoint |
| `apps/dashboard/hooks/use-groups.ts` | Imports deleted groups.ts |
| `apps/dashboard/hooks/use-groups-mutations.ts` | Imports deleted groups.ts |
| `apps/dashboard/hooks/use-feature-flags.ts` | Imports deleted feature-flags.ts |
| `apps/dashboard/hooks/use-license.ts` | Imports deleted license.ts |
| Functions in `bookings.ts`: `startBooking`, `fetchBookingStatusLog`, `clientReschedule`, `requestCancellation` | No backend endpoint |
| Functions in `clients.ts`: `fetchClientStats`, `fetchClientBookings`, `activateClient`, `deactivateClient`, `fetchClientListStats` | No backend endpoint |
| Functions in `branches.ts`: `deleteBranch`, `fetchBranchEmployees`, `assignBranchEmployees`, `removeBranchEmployee` | No backend endpoint |
| Functions in `employees.ts`: `deleteEmployee` | No backend endpoint |
| Functions in `invoices.ts`: `fetchInvoices` list (use `fetchInvoice` single only), `fetchInvoiceStats`, `fetchInvoiceByPayment`, `fetchInvoiceHtml`, `markInvoiceAsSent` | No backend endpoints beyond GET /:id and POST |
| Functions in `payments.ts`: `fetchPayment`, `fetchPaymentStats`, `fetchPaymentByBooking`, `refundPayment`, `updatePaymentStatus`, `verifyBankTransfer`, `reviewReceipt` | No backend endpoints beyond GET list |
| Functions in `chatbot.ts`: all except `fetchChatSessions()` (list conversations) | Most have no backend match |

### Phase 3 — Create

| File | New Content |
|------|------------|
| `apps/dashboard/lib/api/media.ts` | 4 functions for `/dashboard/media/*` |
| `apps/dashboard/lib/api/problem-reports.ts` | 3 functions for `/dashboard/platform/problem-reports/*` |
| `apps/dashboard/lib/api/ratings.ts` | 2 functions for `/dashboard/organization/ratings` |
| `apps/dashboard/hooks/use-media.ts` | TanStack Query hook for media upload/delete |
| `apps/dashboard/hooks/use-problem-reports.ts` | TanStack Query hook for problem reports |
| `apps/dashboard/hooks/use-ratings.ts` | TanStack Query hook for ratings |

### Phase 4 — Test

| File | New Content |
|------|------------|
| `apps/dashboard/test/unit/hooks/use-media.spec.tsx` | Tests for useUploadMedia, useDeleteMedia |
| `apps/dashboard/test/unit/hooks/use-problem-reports.spec.tsx` | Tests for useProblemReports, useCreateProblemReport |
| `apps/dashboard/test/unit/hooks/use-ratings.spec.tsx` | Tests for useRatings |
| Existing hook specs | Verify they test the updated paths |

---

## Phase 1: Path Alignment

### Task 1: Update `bookings.ts` paths

**Files:**
- Modify: `apps/dashboard/lib/api/bookings.ts`

The backend controller is `@Controller('dashboard/bookings')`. Current calls use `/bookings`. Map:
- `POST /bookings` → `POST /dashboard/bookings`
- `POST /bookings/recurring` → `POST /dashboard/bookings/recurring`
- `GET /bookings` → `GET /dashboard/bookings`
- `GET /bookings/:id` → `GET /dashboard/bookings/:id`
- `GET /bookings/stats` → no backend endpoint (delete `fetchBookingStats`)
- `PATCH /bookings/:id` → `PATCH /dashboard/bookings/:id/reschedule` (rescheduleBooking)
- `POST /bookings/:id/confirm` → `PATCH /dashboard/bookings/:id/confirm`
- `POST /bookings/:id/complete` → `PATCH /dashboard/bookings/:id/complete`
- `POST /bookings/:id/no-show` → `PATCH /dashboard/bookings/:id/no-show`
- `POST /bookings/:id/check-in` → `PATCH /dashboard/bookings/:id/check-in`
- `POST /bookings/:id/cancel` (admin) → `PATCH /dashboard/bookings/:id/cancel`
- `POST /bookings/waitlist` → `POST /dashboard/bookings/waitlist`

Functions to delete: `fetchBookingStats`, `startBooking`, `fetchBookingStatusLog`, `clientReschedule`, `requestCancellation`, `employeeCancelBooking`, `approveCancellation`, `rejectCancellation`, `createRecurringBooking` (if no backend match).

- [ ] **Step 1: Read current file**

Run: `cat -n apps/dashboard/lib/api/bookings.ts`

- [ ] **Step 2: Apply path updates**

Replace entire `apps/dashboard/lib/api/bookings.ts` content with:

```typescript
/**
 * Bookings API — CareKit Dashboard
 * Controller: dashboard/bookings
 */

import { api } from "@/lib/api"
import type { PaginatedResponse } from "@/lib/api"
import type {
  Booking,
  BookingListQuery,
  CreateBookingPayload,
  ReschedulePayload,
  AdminCancelPayload,
} from "@/lib/types/booking"

export async function fetchBookings(
  query: BookingListQuery = {},
): Promise<PaginatedResponse<Booking>> {
  return api.get<PaginatedResponse<Booking>>("/dashboard/bookings", {
    page: query.page,
    limit: query.limit,
    status: query.status,
    employeeId: query.employeeId,
    branchId: query.branchId,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    clientId: query.clientId,
    search: query.search,
  })
}

export async function fetchBooking(id: string): Promise<Booking> {
  return api.get<Booking>(`/dashboard/bookings/${id}`)
}

export async function createBooking(payload: CreateBookingPayload): Promise<Booking> {
  return api.post<Booking>("/dashboard/bookings", payload)
}

export async function createRecurringBooking(payload: unknown): Promise<Booking[]> {
  return api.post<Booking[]>("/dashboard/bookings/recurring", payload)
}

export async function rescheduleBooking(id: string, payload: ReschedulePayload): Promise<Booking> {
  return api.patch<Booking>(`/dashboard/bookings/${id}/reschedule`, payload)
}

export async function confirmBooking(id: string): Promise<Booking> {
  return api.patch<Booking>(`/dashboard/bookings/${id}/confirm`)
}

export async function completeBooking(id: string, payload?: unknown): Promise<Booking> {
  return api.patch<Booking>(`/dashboard/bookings/${id}/complete`, payload)
}

export async function markNoShow(id: string): Promise<Booking> {
  return api.patch<Booking>(`/dashboard/bookings/${id}/no-show`)
}

export async function checkInBooking(id: string): Promise<Booking> {
  return api.patch<Booking>(`/dashboard/bookings/${id}/check-in`)
}

export async function adminCancelBooking(id: string, payload: AdminCancelPayload): Promise<Booking> {
  return api.patch<Booking>(`/dashboard/bookings/${id}/cancel`, payload)
}

export async function addToWaitlist(payload: unknown): Promise<unknown> {
  return api.post<unknown>("/dashboard/bookings/waitlist", payload)
}
```

- [ ] **Step 3: Run typecheck**

```bash
cd apps/dashboard && npm run typecheck 2>&1 | grep -E "bookings|error" | head -20
```

Fix any type errors before proceeding.

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/lib/api/bookings.ts
git commit -m "fix(dashboard): align bookings API paths to dashboard/bookings controller"
```

---

### Task 2: Update `clients.ts` paths

**Files:**
- Modify: `apps/dashboard/lib/api/clients.ts`

Backend: `dashboard/people/clients`. Delete functions with no backend endpoint: `fetchClientStats`, `fetchClientBookings`, `activateClient`, `deactivateClient`, `fetchClientListStats`.

- [ ] **Step 1: Replace `clients.ts` content**

```typescript
/**
 * Clients API — CareKit Dashboard
 * Controller: dashboard/people/clients
 */

import { api } from "@/lib/api"
import type { PaginatedResponse } from "@/lib/api"
import type { Client, ClientListQuery, CreateClientPayload, UpdateClientPayload, CreateClientResponse } from "@/lib/types/client"

export async function fetchClients(
  query: ClientListQuery = {},
): Promise<PaginatedResponse<Client>> {
  return api.get<PaginatedResponse<Client>>("/dashboard/people/clients", {
    page: query.page,
    limit: query.limit,
    search: query.search,
    isActive: query.isActive,
  })
}

export async function fetchClient(id: string): Promise<Client> {
  return api.get<Client>(`/dashboard/people/clients/${id}`)
}

export async function createWalkInClient(
  payload: CreateClientPayload,
): Promise<CreateClientResponse> {
  return api.post<CreateClientResponse>("/dashboard/people/clients", payload)
}

export async function updateClient(
  id: string,
  payload: UpdateClientPayload,
): Promise<Client> {
  return api.patch<Client>(`/dashboard/people/clients/${id}`, payload)
}
```

- [ ] **Step 2: Run typecheck**

```bash
cd apps/dashboard && npm run typecheck 2>&1 | grep -E "clients|error" | head -20
```

Fix type errors (callers of deleted functions will fail — update them to remove usage).

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/lib/api/clients.ts
git commit -m "fix(dashboard): align clients API paths to dashboard/people/clients controller"
```

---

### Task 3: Update `employees.ts` paths

**Files:**
- Modify: `apps/dashboard/lib/api/employees.ts`

Backend: `dashboard/people/employees`. Delete `deleteEmployee` (no backend endpoint).

- [ ] **Step 1: Update all paths in `employees.ts`**

Change:
- `/employees` → `/dashboard/people/employees`
- `/employees/${id}` → `/dashboard/people/employees/${id}`
- `/employees/onboard` → `/dashboard/people/employees/${id}/onboarding` (note: backend takes `:id` in path)
- Remove `api.delete` call for `deleteEmployee`

- [ ] **Step 2: Run typecheck**

```bash
cd apps/dashboard && npm run typecheck 2>&1 | grep -E "employees|error" | head -20
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/lib/api/employees.ts
git commit -m "fix(dashboard): align employees API paths to dashboard/people/employees controller"
```

---

### Task 4: Update `branches.ts` paths

**Files:**
- Modify: `apps/dashboard/lib/api/branches.ts`

Backend: `dashboard/organization/branches`. Keep: `fetchBranches`, `fetchBranch`, `createBranch`, `updateBranch`. Delete: `deleteBranch`, `fetchBranchEmployees`, `assignBranchEmployees`, `removeBranchEmployee` (no backend endpoints).

- [ ] **Step 1: Replace `branches.ts` content**

```typescript
/**
 * Branches API — CareKit Dashboard
 * Controller: dashboard/organization/branches
 */

import { api } from "@/lib/api"
import type { PaginatedResponse } from "@/lib/api"
import type { Branch, ListBranchesQuery, CreateBranchPayload, UpdateBranchPayload } from "@/lib/types/branch"

export async function fetchBranches(
  query: ListBranchesQuery = {},
): Promise<PaginatedResponse<Branch>> {
  return api.get<PaginatedResponse<Branch>>("/dashboard/organization/branches", {
    page: query.page,
    limit: query.limit,
    search: query.search,
  })
}

export async function fetchBranch(id: string): Promise<Branch> {
  return api.get<Branch>(`/dashboard/organization/branches/${id}`)
}

export async function createBranch(payload: CreateBranchPayload): Promise<Branch> {
  return api.post<Branch>("/dashboard/organization/branches", payload)
}

export async function updateBranch(
  id: string,
  payload: UpdateBranchPayload,
): Promise<Branch> {
  return api.patch<Branch>(`/dashboard/organization/branches/${id}`, payload)
}
```

- [ ] **Step 2: Run typecheck + fix callers of deleted functions**

```bash
cd apps/dashboard && npm run typecheck 2>&1 | grep -E "branches|error" | head -20
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/lib/api/branches.ts
git commit -m "fix(dashboard): align branches API paths to dashboard/organization/branches controller"
```

---

### Task 5: Update `departments.ts` paths

**Files:**
- Modify: `apps/dashboard/lib/api/departments.ts`

Backend: `dashboard/organization/departments`. The backend has no DELETE endpoint — remove `deleteDepartment`.

- [ ] **Step 1: Update paths in `departments.ts`**

Change:
- `"/departments"` → `"/dashboard/organization/departments"`
- `` `/departments/${id}` `` → `` `/dashboard/organization/departments/${id}` ``
- Remove `api.delete` call

- [ ] **Step 2: Run typecheck**

```bash
cd apps/dashboard && npm run typecheck 2>&1 | grep -E "departments|error" | head -20
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/lib/api/departments.ts
git commit -m "fix(dashboard): align departments API paths to dashboard/organization controller"
```

---

### Task 6: Update `services.ts` paths

**Files:**
- Modify: `apps/dashboard/lib/api/services.ts`

Backend: services → `dashboard/organization/services`; categories → `dashboard/organization/categories`. Remove functions with no backend: `fetchDurationOptions`, `setDurationOptions`, `fetchServiceBookingTypes`, `setServiceBookingTypes`, `uploadServiceImage`, `fetchServiceEmployees`, `fetchServicesListStats`, `setServiceBranches`, `clearServiceBranches`. Also remove duplicate `fetchIntakeForms`/`createIntakeForm`/etc. (already in `intake-forms.ts`).

- [ ] **Step 1: Update paths in `services.ts`**

Change:
- `"/services/categories"` → `"/dashboard/organization/categories"`
- `` `/services/categories/${id}` `` → `` `/dashboard/organization/categories/${id}` ``
- `"/services"` → `"/dashboard/organization/services"`
- `` `/services/${id}` `` → `` `/dashboard/organization/services/${id}` ``
- Remove all functions listed above with no backend endpoint
- Remove duplicate intake-forms functions (they live in `intake-forms.ts`)

- [ ] **Step 2: Run typecheck**

```bash
cd apps/dashboard && npm run typecheck 2>&1 | grep -E "services|error" | head -20
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/lib/api/services.ts
git commit -m "fix(dashboard): align services/categories API paths to dashboard/organization controller"
```

---

### Task 7: Update `whitelabel.ts` paths

**Files:**
- Modify: `apps/dashboard/lib/api/whitelabel.ts`

Backend: `dashboard/organization/branding`. The `fetchPublicBranding` → keep path `/whitelabel/public` mapped to `public/branding/:tenantId` — but this needs a tenantId param. For now keep public branding separate; only update dashboard write path.

- [ ] **Step 1: Update paths in `whitelabel.ts`**

Change:
- `"/whitelabel"` (GET) → `"/dashboard/organization/branding"`
- `"/whitelabel"` (PUT) → `"/dashboard/organization/branding"` (POST in backend — change method)
- Keep `"/whitelabel/public"` → `"/public/branding"` (public endpoint, needs tenantId injected by backend from JWT)

- [ ] **Step 2: Run typecheck**

```bash
cd apps/dashboard && npm run typecheck 2>&1 | grep -E "whitelabel|error" | head -20
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/lib/api/whitelabel.ts
git commit -m "fix(dashboard): align whitelabel API paths to dashboard/organization/branding controller"
```

---

### Task 8: Update `intake-forms.ts` paths

**Files:**
- Modify: `apps/dashboard/lib/api/intake-forms.ts`

Backend: `dashboard/organization/intake-forms`. Note: backend has no DELETE, no `setIntakeFields`, no `fetchIntakeResponses` — remove those.

- [ ] **Step 1: Update paths in `intake-forms.ts`**

Change:
- `"/intake-forms"` → `"/dashboard/organization/intake-forms"`
- `` `/intake-forms/${formId}` `` → `` `/dashboard/organization/intake-forms/${formId}` ``
- Remove: `deleteIntakeForm`, `setIntakeFields`, `fetchIntakeResponses`

- [ ] **Step 2: Run typecheck**

```bash
cd apps/dashboard && npm run typecheck 2>&1 | grep -E "intake|error" | head -20
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/lib/api/intake-forms.ts
git commit -m "fix(dashboard): align intake-forms API paths to dashboard/organization controller"
```

---

### Task 9: Update `invoices.ts` paths

**Files:**
- Modify: `apps/dashboard/lib/api/invoices.ts`

Backend: `dashboard/finance/invoices`. Available: `POST /dashboard/finance/invoices`, `GET /dashboard/finance/invoices/:id`. Remove list, stats, byPayment, html, markSent (no backend endpoints).

- [ ] **Step 1: Replace `invoices.ts` content**

```typescript
/**
 * Invoices API — CareKit Dashboard
 * Controller: dashboard/finance/invoices
 */

import { api } from "@/lib/api"
import type { Invoice, CreateInvoicePayload } from "@/lib/types/invoice"

export async function fetchInvoice(id: string): Promise<Invoice> {
  return api.get<Invoice>(`/dashboard/finance/invoices/${id}`)
}

export async function createInvoice(payload: CreateInvoicePayload): Promise<Invoice> {
  return api.post<Invoice>("/dashboard/finance/invoices", payload)
}
```

- [ ] **Step 2: Run typecheck + fix callers**

```bash
cd apps/dashboard && npm run typecheck 2>&1 | grep -E "invoice|error" | head -20
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/lib/api/invoices.ts
git commit -m "fix(dashboard): align invoices API paths to dashboard/finance controller"
```

---

### Task 10: Update `payments.ts` paths

**Files:**
- Modify: `apps/dashboard/lib/api/payments.ts`

Backend: `GET /dashboard/finance/payments` (list) only. Remove all other functions.

- [ ] **Step 1: Replace `payments.ts` content**

```typescript
/**
 * Payments API — CareKit Dashboard
 * Controller: dashboard/finance/payments
 */

import { api } from "@/lib/api"
import type { PaginatedResponse } from "@/lib/api"
import type { Payment, ListPaymentsQuery } from "@/lib/types/payment"

export async function fetchPayments(
  query: ListPaymentsQuery = {},
): Promise<PaginatedResponse<Payment>> {
  return api.get<PaginatedResponse<Payment>>("/dashboard/finance/payments", {
    page: query.page,
    limit: query.limit,
    status: query.status,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
  })
}
```

- [ ] **Step 2: Run typecheck + fix callers**

```bash
cd apps/dashboard && npm run typecheck 2>&1 | grep -E "payment|error" | head -20
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/lib/api/payments.ts
git commit -m "fix(dashboard): align payments API paths to dashboard/finance controller"
```

---

### Task 11: Update `notifications.ts` paths

**Files:**
- Modify: `apps/dashboard/lib/api/notifications.ts`

Backend: `dashboard/comms/notifications` + `dashboard/comms/notifications/mark-read`.

- [ ] **Step 1: Update paths in `notifications.ts`**

Change:
- `"/notifications"` → `"/dashboard/comms/notifications"`
- `"/notifications/read-all"` → `"/dashboard/comms/notifications/mark-read"`
- Remove `markAsRead(id)` (backend has bulk mark-read only, no single-notification endpoint)

- [ ] **Step 2: Run typecheck**

```bash
cd apps/dashboard && npm run typecheck 2>&1 | grep -E "notification|error" | head -20
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/lib/api/notifications.ts
git commit -m "fix(dashboard): align notifications API paths to dashboard/comms controller"
```

---

### Task 12: Update `email-templates.ts` paths

**Files:**
- Modify: `apps/dashboard/lib/api/email-templates.ts`

Backend: `dashboard/comms/email-templates`. Note: backend uses UUID `:id` not `:slug`. Update accordingly.

- [ ] **Step 1: Update paths in `email-templates.ts`**

Change:
- `"/email-templates"` → `"/dashboard/comms/email-templates"`
- `` `/email-templates/${slug}` `` → `` `/dashboard/comms/email-templates/${id}` `` (rename param from `slug` to `id`)
- Remove `previewEmailTemplate` (no backend endpoint)

- [ ] **Step 2: Run typecheck**

```bash
cd apps/dashboard && npm run typecheck 2>&1 | grep -E "email|error" | head -20
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/lib/api/email-templates.ts
git commit -m "fix(dashboard): align email-templates API paths to dashboard/comms controller"
```

---

### Task 13: Update `chatbot.ts` paths

**Files:**
- Modify: `apps/dashboard/lib/api/chatbot.ts`

Backend: `dashboard/comms/chat/conversations`. Keep only `fetchChatSessions` (maps to list conversations). Remove everything else — no backend endpoints for config, analytics, seed, direct messages in new controllers.

- [ ] **Step 1: Replace `chatbot.ts` content**

```typescript
/**
 * Chatbot API — CareKit Dashboard
 * Controller: dashboard/comms/chat
 */

import { api } from "@/lib/api"
import type { PaginatedResponse } from "@/lib/api"
import type { ChatSession, ListSessionsQuery } from "@/lib/types/chatbot"

export async function fetchChatSessions(
  query: ListSessionsQuery = {},
): Promise<PaginatedResponse<ChatSession>> {
  return api.get<PaginatedResponse<ChatSession>>(
    "/dashboard/comms/chat/conversations",
    {
      page: query.page,
      limit: query.limit,
    },
  )
}
```

- [ ] **Step 2: Run typecheck + fix callers of deleted functions**

```bash
cd apps/dashboard && npm run typecheck 2>&1 | grep -E "chatbot|error" | head -20
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/lib/api/chatbot.ts
git commit -m "fix(dashboard): reduce chatbot API to connected endpoint only"
```

---

### Task 14: Update `organization.ts` paths

**Files:**
- Modify: `apps/dashboard/lib/api/organization.ts`

Backend: `dashboard/organization/hours` + `dashboard/organization/holidays`.

- [ ] **Step 1: Update paths in `organization.ts`**

Change:
- `"/organization/hours"` (GET) → `"/dashboard/organization/hours/:branchId"` — note: GET requires branchId param
- `"/organization/hours"` (PUT) → `"/dashboard/organization/hours"` (POST in backend)
- `"/organization/holidays"` → `"/dashboard/organization/holidays"`
- `` `/organization/holidays/${id}` `` → `` `/dashboard/organization/holidays/${id}` ``

- [ ] **Step 2: Run typecheck**

```bash
cd apps/dashboard && npm run typecheck 2>&1 | grep -E "organization|error" | head -20
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/lib/api/organization.ts
git commit -m "fix(dashboard): align organization hours/holidays API paths"
```

---

### Task 15: Update `organization-integrations.ts` paths

**Files:**
- Modify: `apps/dashboard/lib/api/organization-integrations.ts`

Backend: `dashboard/platform/integrations`.

- [ ] **Step 1: Update paths**

Change:
- `"/organization-integrations"` (GET) → `"/dashboard/platform/integrations"`
- `"/organization-integrations"` (PUT) → `"/dashboard/platform/integrations"` (POST in backend — change method)

- [ ] **Step 2: Run typecheck**

```bash
cd apps/dashboard && npm run typecheck 2>&1 | grep -E "integrations|error" | head -20
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/lib/api/organization-integrations.ts
git commit -m "fix(dashboard): align integrations API paths to dashboard/platform controller"
```

---

### Task 16: Update `activity-log.ts` paths

**Files:**
- Modify: `apps/dashboard/lib/api/activity-log.ts`

Backend: `GET /dashboard/ops/activity`. No single-activity GET — remove `fetchActivityLog(id)`.

- [ ] **Step 1: Update paths in `activity-log.ts`**

Change:
- `"/activity-log"` → `"/dashboard/ops/activity"`
- Remove `fetchActivityLog(id: string)` (no backend endpoint)

- [ ] **Step 2: Run typecheck**

```bash
cd apps/dashboard && npm run typecheck 2>&1 | grep -E "activity|error" | head -20
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/lib/api/activity-log.ts
git commit -m "fix(dashboard): align activity-log API path to dashboard/ops controller"
```

---

### Task 17: Update `reports.ts` paths + method

**Files:**
- Modify: `apps/dashboard/lib/api/reports.ts`

Backend: `POST /dashboard/ops/reports` (single endpoint, report type in body). Current code uses separate GET paths per report type — rewrite to POST with `{ type: 'revenue'|'bookings'|'employees', ... }`.

- [ ] **Step 1: Replace `reports.ts` content**

```typescript
/**
 * Reports API — CareKit Dashboard
 * Controller: dashboard/ops/reports
 */

import { api } from "@/lib/api"
import type { RevenueReport, BookingReport, EmployeeReport } from "@/lib/types/report"

export async function fetchRevenueReport(params: {
  dateFrom: string
  dateTo: string
  branchId?: string
}): Promise<RevenueReport> {
  return api.post<RevenueReport>("/dashboard/ops/reports", {
    type: "revenue",
    ...params,
  })
}

export async function fetchBookingReport(params: {
  dateFrom: string
  dateTo: string
  branchId?: string
}): Promise<BookingReport> {
  return api.post<BookingReport>("/dashboard/ops/reports", {
    type: "bookings",
    ...params,
  })
}

export async function fetchEmployeeReport(params: {
  dateFrom: string
  dateTo: string
  employeeId?: string
}): Promise<EmployeeReport> {
  return api.post<EmployeeReport>("/dashboard/ops/reports", {
    type: "employees",
    ...params,
  })
}
```

- [ ] **Step 2: Run typecheck**

```bash
cd apps/dashboard && npm run typecheck 2>&1 | grep -E "report|error" | head -20
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/lib/api/reports.ts
git commit -m "fix(dashboard): align reports API to POST dashboard/ops/reports"
```

---

### Task 18: Update `auth.ts` paths

**Files:**
- Modify: `apps/dashboard/lib/api/auth.ts`

Backend: `POST /auth/refresh` (not `/auth/refresh-token`).

- [ ] **Step 1: Update path**

Change line 56: `"/auth/refresh-token"` → `"/auth/refresh"`

- [ ] **Step 2: Run typecheck**

```bash
cd apps/dashboard && npm run typecheck 2>&1 | grep -E "auth|error" | head -20
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/lib/api/auth.ts
git commit -m "fix(dashboard): align auth refresh path from /refresh-token to /refresh"
```

---

### Task 19: Mark `organization-settings.ts` and `zatca.ts` as TODO

**Files:**
- Modify: `apps/dashboard/lib/api/organization-settings.ts`
- Modify: `apps/dashboard/lib/api/zatca.ts`

These files call paths with no matching backend controller. Add `// TODO: no backend endpoint — verify before using` comment on each call until backend adds these routes.

- [ ] **Step 1: Add TODO comments to `organization-settings.ts`**

Add above each `api.get/put/patch` call:
```typescript
// TODO: no backend endpoint in dashboard controllers — needs backend route
```

- [ ] **Step 2: Add TODO comments to `zatca.ts`**

Add above each call:
```typescript
// TODO: no backend endpoint in dashboard controllers — needs dashboard/zatca controller
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/lib/api/organization-settings.ts apps/dashboard/lib/api/zatca.ts
git commit -m "docs(dashboard): mark organization-settings and zatca APIs as missing backend endpoints"
```

---

### Task 19b: Update `waitlist.ts` paths

**Files:**
- Modify: `apps/dashboard/lib/api/waitlist.ts`

Backend: `POST /dashboard/bookings/waitlist` (add to waitlist). `GET` list has no backend endpoint — remove `fetchWaitlist`.

- [ ] **Step 1: Replace `waitlist.ts` content**

```typescript
/**
 * Waitlist API — CareKit Dashboard
 * Controller: dashboard/bookings/waitlist
 */

import { api } from "@/lib/api"

export interface WaitlistEntry {
  id: string
  clientId: string
  serviceId: string
  branchId?: string
  employeeId?: string
  requestedAt: string
}

export interface AddToWaitlistPayload {
  clientId: string
  serviceId: string
  branchId?: string
  employeeId?: string
}

export async function addToWaitlist(payload: AddToWaitlistPayload): Promise<WaitlistEntry> {
  return api.post<WaitlistEntry>("/dashboard/bookings/waitlist", payload)
}
```

- [ ] **Step 2: Run typecheck + fix callers of removed `fetchWaitlist`**

```bash
cd apps/dashboard && npm run typecheck 2>&1 | grep -E "waitlist|error" | head -20
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/lib/api/waitlist.ts
git commit -m "fix(dashboard): align waitlist API to POST dashboard/bookings/waitlist"
```

---

## Phase 2: Dead Code Removal

### Task 20: Delete dead `lib/api/` files

**Files:**
- Delete: `apps/dashboard/lib/api/chatbot-kb.ts`
- Delete: `apps/dashboard/lib/api/runs.ts`
- Delete: `apps/dashboard/lib/api/booking-settings.ts`
- Delete: `apps/dashboard/lib/api/license.ts`
- Delete: `apps/dashboard/lib/api/feature-flags.ts`
- Delete: `apps/dashboard/lib/api/groups.ts`

- [ ] **Step 1: Confirm 0 non-test importers**

```bash
for f in chatbot-kb runs booking-settings license feature-flags groups; do
  echo "=== $f ==="
  grep -rl "lib/api/$f" apps/dashboard --include="*.ts" --include="*.tsx" | grep -v ".spec." | grep -v node_modules
done
```

Expected: no output for each (0 importers). If any file imports them, update it first.

- [ ] **Step 2: Delete the files**

```bash
rm apps/dashboard/lib/api/chatbot-kb.ts \
   apps/dashboard/lib/api/runs.ts \
   apps/dashboard/lib/api/booking-settings.ts \
   apps/dashboard/lib/api/license.ts \
   apps/dashboard/lib/api/feature-flags.ts \
   apps/dashboard/lib/api/groups.ts
```

- [ ] **Step 3: Run typecheck**

```bash
cd apps/dashboard && npm run typecheck 2>&1 | head -30
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(dashboard): delete dead lib/api files with no backend endpoint"
```

---

### Task 21: Delete dead hooks

**Files:**
- Delete: `apps/dashboard/hooks/use-groups.ts`
- Delete: `apps/dashboard/hooks/use-groups-mutations.ts`
- Delete: `apps/dashboard/hooks/use-feature-flags.ts`
- Delete: `apps/dashboard/hooks/use-license.ts`

- [ ] **Step 1: Confirm no non-test importers**

```bash
for hook in use-groups use-groups-mutations use-feature-flags use-license; do
  echo "=== $hook ==="
  grep -rl "hooks/$hook" apps/dashboard --include="*.ts" --include="*.tsx" | grep -v ".spec." | grep -v node_modules
done
```

If any file imports them, remove that usage first.

- [ ] **Step 2: Delete the hooks**

```bash
rm apps/dashboard/hooks/use-groups.ts \
   apps/dashboard/hooks/use-groups-mutations.ts \
   apps/dashboard/hooks/use-feature-flags.ts \
   apps/dashboard/hooks/use-license.ts
```

- [ ] **Step 3: Run typecheck**

```bash
cd apps/dashboard && npm run typecheck 2>&1 | head -30
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(dashboard): delete dead hooks for removed API modules"
```

---

### Task 22: Delete dead hook spec files

**Files:**
- Delete: `apps/dashboard/test/unit/hooks/use-feature-flags.spec.tsx`
- Delete: `apps/dashboard/test/unit/hooks/use-license.spec.tsx`

- [ ] **Step 1: Delete spec files**

```bash
rm apps/dashboard/test/unit/hooks/use-feature-flags.spec.tsx \
   apps/dashboard/test/unit/hooks/use-license.spec.tsx
```

- [ ] **Step 2: Run tests to confirm no broken suite**

```bash
cd apps/dashboard && npm run test 2>&1 | tail -20
```

Expected: all remaining tests pass.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore(dashboard): remove specs for deleted hooks"
```

---

## Phase 3: Wire Missing API Functions

### Task 23: Create `lib/api/media.ts`

**Files:**
- Create: `apps/dashboard/lib/api/media.ts`

Backend: `dashboard/media` — 4 endpoints: POST upload, GET/:id, DELETE/:id, GET/:id/presigned-url.

- [ ] **Step 1: Create `media.ts`**

```typescript
/**
 * Media API — CareKit Dashboard
 * Controller: dashboard/media
 */

import { api } from "@/lib/api"

export interface MediaFile {
  id: string
  url: string
  filename: string
  mimeType: string
  size: number
  createdAt: string
}

export interface PresignedUrl {
  url: string
  expiresAt: string
}

export interface UploadFilePayload {
  filename: string
  mimeType: string
  size: number
  base64?: string
}

export async function uploadFile(payload: UploadFilePayload): Promise<MediaFile> {
  return api.post<MediaFile>("/dashboard/media/upload", payload)
}

export async function fetchFile(id: string): Promise<MediaFile> {
  return api.get<MediaFile>(`/dashboard/media/${id}`)
}

export async function deleteFile(id: string): Promise<void> {
  await api.delete(`/dashboard/media/${id}`)
}

export async function fetchPresignedUrl(
  id: string,
  params: { expiresIn?: number } = {},
): Promise<PresignedUrl> {
  return api.get<PresignedUrl>(`/dashboard/media/${id}/presigned-url`, params)
}
```

- [ ] **Step 2: Run typecheck**

```bash
cd apps/dashboard && npm run typecheck 2>&1 | grep -E "media|error" | head -20
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/lib/api/media.ts
git commit -m "feat(dashboard): add media API client for dashboard/media controller"
```

---

### Task 24: Create `hooks/use-media.ts`

**Files:**
- Create: `apps/dashboard/hooks/use-media.ts`

- [ ] **Step 1: Create `use-media.ts`**

```typescript
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  uploadFile,
  fetchFile,
  deleteFile,
  fetchPresignedUrl,
  type UploadFilePayload,
} from "@/lib/api/media"

export const mediaKeys = {
  all: ["media"] as const,
  file: (id: string) => ["media", id] as const,
  presigned: (id: string) => ["media", id, "presigned"] as const,
}

export function useMediaFile(id: string) {
  return useQuery({
    queryKey: mediaKeys.file(id),
    queryFn: () => fetchFile(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  })
}

export function usePresignedUrl(id: string) {
  return useQuery({
    queryKey: mediaKeys.presigned(id),
    queryFn: () => fetchPresignedUrl(id),
    enabled: !!id,
    staleTime: 60 * 1000,
  })
}

export function useUploadFile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: UploadFilePayload) => uploadFile(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mediaKeys.all })
    },
  })
}

export function useDeleteFile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteFile(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mediaKeys.all })
    },
  })
}
```

- [ ] **Step 2: Run typecheck**

```bash
cd apps/dashboard && npm run typecheck 2>&1 | grep -E "media|error" | head -20
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/hooks/use-media.ts
git commit -m "feat(dashboard): add use-media hook for file upload/delete"
```

---

### Task 25: Create `lib/api/problem-reports.ts`

**Files:**
- Create: `apps/dashboard/lib/api/problem-reports.ts`

Backend: `dashboard/platform/problem-reports` — POST, GET list, PATCH /:id/status.

- [ ] **Step 1: Create `problem-reports.ts`**

```typescript
/**
 * Problem Reports API — CareKit Dashboard
 * Controller: dashboard/platform/problem-reports
 */

import { api } from "@/lib/api"
import type { PaginatedResponse } from "@/lib/api"

export interface ProblemReport {
  id: string
  title: string
  description: string
  status: "open" | "in_progress" | "resolved" | "closed"
  createdAt: string
  updatedAt: string
}

export interface CreateProblemReportPayload {
  title: string
  description: string
}

export interface ListProblemReportsQuery {
  page?: number
  limit?: number
  status?: ProblemReport["status"]
}

export async function fetchProblemReports(
  query: ListProblemReportsQuery = {},
): Promise<PaginatedResponse<ProblemReport>> {
  return api.get<PaginatedResponse<ProblemReport>>(
    "/dashboard/platform/problem-reports",
    query,
  )
}

export async function createProblemReport(
  payload: CreateProblemReportPayload,
): Promise<ProblemReport> {
  return api.post<ProblemReport>("/dashboard/platform/problem-reports", payload)
}

export async function updateProblemReportStatus(
  id: string,
  status: ProblemReport["status"],
): Promise<ProblemReport> {
  return api.patch<ProblemReport>(
    `/dashboard/platform/problem-reports/${id}/status`,
    { status },
  )
}
```

- [ ] **Step 2: Run typecheck**

```bash
cd apps/dashboard && npm run typecheck 2>&1 | grep -E "problem|error" | head -20
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/lib/api/problem-reports.ts
git commit -m "feat(dashboard): add problem-reports API client"
```

---

### Task 26: Create `hooks/use-problem-reports.ts`

**Files:**
- Create: `apps/dashboard/hooks/use-problem-reports.ts`

- [ ] **Step 1: Create `use-problem-reports.ts`**

```typescript
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  fetchProblemReports,
  createProblemReport,
  updateProblemReportStatus,
  type ListProblemReportsQuery,
  type CreateProblemReportPayload,
  type ProblemReport,
} from "@/lib/api/problem-reports"

export const problemReportKeys = {
  all: ["problem-reports"] as const,
  list: (query: ListProblemReportsQuery) =>
    ["problem-reports", "list", query] as const,
}

export function useProblemReports(query: ListProblemReportsQuery = {}) {
  return useQuery({
    queryKey: problemReportKeys.list(query),
    queryFn: () => fetchProblemReports(query),
    staleTime: 30 * 1000,
  })
}

export function useCreateProblemReport() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateProblemReportPayload) =>
      createProblemReport(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: problemReportKeys.all })
    },
  })
}

export function useUpdateProblemReportStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string
      status: ProblemReport["status"]
    }) => updateProblemReportStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: problemReportKeys.all })
    },
  })
}
```

- [ ] **Step 2: Run typecheck**

```bash
cd apps/dashboard && npm run typecheck 2>&1 | grep -E "problem|error" | head -20
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/hooks/use-problem-reports.ts
git commit -m "feat(dashboard): add use-problem-reports hook"
```

---

### Task 27: Create `lib/api/ratings.ts`

**Files:**
- Create: `apps/dashboard/lib/api/ratings.ts`

Backend: `dashboard/organization/ratings` — POST submit, GET list.

- [ ] **Step 1: Create `ratings.ts`**

```typescript
/**
 * Ratings API — CareKit Dashboard
 * Controller: dashboard/organization/ratings
 */

import { api } from "@/lib/api"
import type { PaginatedResponse } from "@/lib/api"

export interface Rating {
  id: string
  employeeId: string
  bookingId: string
  score: number
  comment?: string
  createdAt: string
}

export interface SubmitRatingPayload {
  employeeId: string
  bookingId: string
  score: number
  comment?: string
}

export interface ListRatingsQuery {
  page?: number
  limit?: number
  employeeId?: string
}

export async function fetchRatings(
  query: ListRatingsQuery = {},
): Promise<PaginatedResponse<Rating>> {
  return api.get<PaginatedResponse<Rating>>("/dashboard/organization/ratings", query)
}

export async function submitRating(payload: SubmitRatingPayload): Promise<Rating> {
  return api.post<Rating>("/dashboard/organization/ratings", payload)
}
```

- [ ] **Step 2: Run typecheck**

```bash
cd apps/dashboard && npm run typecheck 2>&1 | grep -E "rating|error" | head -20
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/lib/api/ratings.ts
git commit -m "feat(dashboard): add ratings API client for dashboard/organization/ratings"
```

---

### Task 28: Create `hooks/use-ratings.ts`

**Files:**
- Create: `apps/dashboard/hooks/use-ratings.ts`

- [ ] **Step 1: Create `use-ratings.ts`**

```typescript
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  fetchRatings,
  submitRating,
  type ListRatingsQuery,
  type SubmitRatingPayload,
} from "@/lib/api/ratings"

export const ratingKeys = {
  all: ["ratings"] as const,
  list: (query: ListRatingsQuery) => ["ratings", "list", query] as const,
}

export function useRatings(query: ListRatingsQuery = {}) {
  return useQuery({
    queryKey: ratingKeys.list(query),
    queryFn: () => fetchRatings(query),
    staleTime: 30 * 1000,
  })
}

export function useSubmitRating() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: SubmitRatingPayload) => submitRating(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ratingKeys.all })
    },
  })
}
```

- [ ] **Step 2: Run typecheck**

```bash
cd apps/dashboard && npm run typecheck 2>&1 | grep -E "rating|error" | head -20
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/hooks/use-ratings.ts
git commit -m "feat(dashboard): add use-ratings hook"
```

---

## Phase 4: Test Coverage

### Task 29: Write tests for `use-media` hook

**Files:**
- Create: `apps/dashboard/test/unit/hooks/use-media.spec.tsx`
- Reference pattern: `apps/dashboard/test/unit/hooks/use-clients.spec.tsx`

- [ ] **Step 1: Read an existing hook spec for patterns**

```bash
cat apps/dashboard/test/unit/hooks/use-clients.spec.tsx
```

- [ ] **Step 2: Write the test file**

```typescript
import { renderHook, waitFor } from "@testing-library/react"
import { vi, describe, it, expect, beforeEach } from "vitest"
import { createWrapper } from "@/test/helpers/wrapper"
import { useMediaFile, useUploadFile, useDeleteFile } from "@/hooks/use-media"
import * as mediaApi from "@/lib/api/media"

vi.mock("@/lib/api/media")

const mockFile = {
  id: "file-1",
  url: "https://cdn.example.com/file-1.jpg",
  filename: "photo.jpg",
  mimeType: "image/jpeg",
  size: 1024,
  createdAt: "2026-04-12T00:00:00Z",
}

describe("useMediaFile", () => {
  it("fetches file by id", async () => {
    vi.mocked(mediaApi.fetchFile).mockResolvedValue(mockFile)
    const { result } = renderHook(() => useMediaFile("file-1"), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(mockFile)
    expect(mediaApi.fetchFile).toHaveBeenCalledWith("file-1")
  })

  it("does not fetch when id is empty", () => {
    const { result } = renderHook(() => useMediaFile(""), {
      wrapper: createWrapper(),
    })
    expect(result.current.fetchStatus).toBe("idle")
    expect(mediaApi.fetchFile).not.toHaveBeenCalled()
  })
})

describe("useUploadFile", () => {
  it("uploads file and invalidates media queries", async () => {
    vi.mocked(mediaApi.uploadFile).mockResolvedValue(mockFile)
    const { result } = renderHook(() => useUploadFile(), {
      wrapper: createWrapper(),
    })
    result.current.mutate({
      filename: "photo.jpg",
      mimeType: "image/jpeg",
      size: 1024,
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mediaApi.uploadFile).toHaveBeenCalledWith({
      filename: "photo.jpg",
      mimeType: "image/jpeg",
      size: 1024,
    })
  })
})

describe("useDeleteFile", () => {
  it("deletes file by id", async () => {
    vi.mocked(mediaApi.deleteFile).mockResolvedValue(undefined)
    const { result } = renderHook(() => useDeleteFile(), {
      wrapper: createWrapper(),
    })
    result.current.mutate("file-1")
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mediaApi.deleteFile).toHaveBeenCalledWith("file-1")
  })
})
```

- [ ] **Step 3: Run tests**

```bash
cd apps/dashboard && npm run test -- use-media 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/test/unit/hooks/use-media.spec.tsx
git commit -m "test(dashboard): add use-media hook specs"
```

---

### Task 30: Write tests for `use-problem-reports` hook

**Files:**
- Create: `apps/dashboard/test/unit/hooks/use-problem-reports.spec.tsx`

- [ ] **Step 1: Write the test file**

```typescript
import { renderHook, waitFor } from "@testing-library/react"
import { vi, describe, it, expect } from "vitest"
import { createWrapper } from "@/test/helpers/wrapper"
import {
  useProblemReports,
  useCreateProblemReport,
  useUpdateProblemReportStatus,
} from "@/hooks/use-problem-reports"
import * as api from "@/lib/api/problem-reports"

vi.mock("@/lib/api/problem-reports")

const mockReport = {
  id: "rpt-1",
  title: "Button not working",
  description: "Submit button unresponsive",
  status: "open" as const,
  createdAt: "2026-04-12T00:00:00Z",
  updatedAt: "2026-04-12T00:00:00Z",
}

const mockPaginated = {
  data: [mockReport],
  meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
}

describe("useProblemReports", () => {
  it("fetches problem reports list", async () => {
    vi.mocked(api.fetchProblemReports).mockResolvedValue(mockPaginated)
    const { result } = renderHook(() => useProblemReports(), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(mockPaginated)
  })
})

describe("useCreateProblemReport", () => {
  it("creates a problem report", async () => {
    vi.mocked(api.createProblemReport).mockResolvedValue(mockReport)
    const { result } = renderHook(() => useCreateProblemReport(), {
      wrapper: createWrapper(),
    })
    result.current.mutate({
      title: "Button not working",
      description: "Submit button unresponsive",
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.createProblemReport).toHaveBeenCalledWith({
      title: "Button not working",
      description: "Submit button unresponsive",
    })
  })
})

describe("useUpdateProblemReportStatus", () => {
  it("updates report status", async () => {
    vi.mocked(api.updateProblemReportStatus).mockResolvedValue({
      ...mockReport,
      status: "resolved",
    })
    const { result } = renderHook(() => useUpdateProblemReportStatus(), {
      wrapper: createWrapper(),
    })
    result.current.mutate({ id: "rpt-1", status: "resolved" })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.updateProblemReportStatus).toHaveBeenCalledWith("rpt-1", "resolved")
  })
})
```

- [ ] **Step 2: Run tests**

```bash
cd apps/dashboard && npm run test -- use-problem-reports 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/test/unit/hooks/use-problem-reports.spec.tsx
git commit -m "test(dashboard): add use-problem-reports hook specs"
```

---

### Task 31: Write tests for `use-ratings` hook

**Files:**
- Create: `apps/dashboard/test/unit/hooks/use-ratings.spec.tsx`

- [ ] **Step 1: Write the test file**

```typescript
import { renderHook, waitFor } from "@testing-library/react"
import { vi, describe, it, expect } from "vitest"
import { createWrapper } from "@/test/helpers/wrapper"
import { useRatings, useSubmitRating } from "@/hooks/use-ratings"
import * as api from "@/lib/api/ratings"

vi.mock("@/lib/api/ratings")

const mockRating = {
  id: "rating-1",
  employeeId: "emp-1",
  bookingId: "booking-1",
  score: 5,
  comment: "Excellent service",
  createdAt: "2026-04-12T00:00:00Z",
}

const mockPaginated = {
  data: [mockRating],
  meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
}

describe("useRatings", () => {
  it("fetches ratings list", async () => {
    vi.mocked(api.fetchRatings).mockResolvedValue(mockPaginated)
    const { result } = renderHook(() => useRatings(), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(mockPaginated)
  })

  it("passes query params to API", async () => {
    vi.mocked(api.fetchRatings).mockResolvedValue(mockPaginated)
    const { result } = renderHook(
      () => useRatings({ employeeId: "emp-1", page: 2 }),
      { wrapper: createWrapper() },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.fetchRatings).toHaveBeenCalledWith({ employeeId: "emp-1", page: 2 })
  })
})

describe("useSubmitRating", () => {
  it("submits a rating", async () => {
    vi.mocked(api.submitRating).mockResolvedValue(mockRating)
    const { result } = renderHook(() => useSubmitRating(), {
      wrapper: createWrapper(),
    })
    result.current.mutate({
      employeeId: "emp-1",
      bookingId: "booking-1",
      score: 5,
      comment: "Excellent service",
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.submitRating).toHaveBeenCalledWith({
      employeeId: "emp-1",
      bookingId: "booking-1",
      score: 5,
      comment: "Excellent service",
    })
  })
})
```

- [ ] **Step 2: Run tests**

```bash
cd apps/dashboard && npm run test -- use-ratings 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/test/unit/hooks/use-ratings.spec.tsx
git commit -m "test(dashboard): add use-ratings hook specs"
```

---

### Task 32: Verify existing hook specs still pass after path updates

After all path changes in Phase 1, existing hook specs may still mock the old paths. Verify and fix.

- [ ] **Step 1: Run full dashboard test suite**

```bash
cd apps/dashboard && npm run test 2>&1 | tail -30
```

- [ ] **Step 2: For each failing spec, update the mock path**

Pattern — if a spec mocks:
```typescript
vi.mocked(api.fetchBookings).mockResolvedValue(...)
```

The mock is on the function itself, not the path — so path changes in `lib/api/` don't break hook specs. But if any spec mocks `fetch` or `apiClient` directly with a hardcoded path, update those paths.

Search for hardcoded paths in specs:
```bash
grep -r "/bookings\|/clients\|/employees\|/branches" apps/dashboard/test --include="*.spec.*"
```

Update any found to their new `dashboard/` prefixed paths.

- [ ] **Step 3: Run tests again until all pass**

```bash
cd apps/dashboard && npm run test 2>&1 | tail -20
```

Expected: 0 failures.

- [ ] **Step 4: Commit any spec fixes**

```bash
git add apps/dashboard/test
git commit -m "test(dashboard): update hook specs to reflect new API paths"
```

---

### Task 33: Final full typecheck and lint

- [ ] **Step 1: Full typecheck**

```bash
cd apps/dashboard && npm run typecheck 2>&1 | grep -c "error" || echo "0 errors"
```

Expected: 0 errors.

- [ ] **Step 2: Lint**

```bash
cd apps/dashboard && npm run lint 2>&1 | tail -10
```

Expected: 0 errors.

- [ ] **Step 3: Full backend test suite**

```bash
cd apps/backend && npm run test 2>&1 | tail -20
```

Expected: all controller specs pass (they already existed and backend code wasn't changed).

- [ ] **Step 4: Commit if any auto-fixes were applied**

```bash
git status
# only commit if lint --fix changed files
git add apps/dashboard
git commit -m "chore(dashboard): lint fixes after API path alignment"
```

---

## Summary

| Phase | Tasks | Changes |
|-------|-------|---------|
| 1 — Path Alignment | 1–19 | 19 `lib/api/` files updated |
| 2 — Dead Code | 20–22 | 6 API files + 4 hooks + 2 specs deleted |
| 3 — Wire Missing | 23–28 | 3 new API files + 3 new hooks |
| 4 — Test Coverage | 29–33 | 3 new hook specs + full suite verification |

**Total commits:** ~33 atomic commits, one per task.
