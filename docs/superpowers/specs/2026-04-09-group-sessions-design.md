# Group Sessions — Design Spec

## Overview

Group therapy sessions sold via a **pre-order model**. Patients register interest for free; the session only runs if minimum enrollment is met. Payment is requested only after confirmation.

**Example:** "Art Therapy" — Dr. Noura — min 2, max 5 — 150 SAR/person — 90 min

## Position in the System

```
Path 1: Departments → Services → Practitioner → Individual Booking  (existing)
Path 2: Group Sessions (pre-order group enrollment)                  (new — independent)
```

Group Sessions are **fully independent** from the individual services pipeline. No `serviceId` link. A nullable `departmentId` exists for future upsell linking — not used in v1.

## Architecture: Single Module

One NestJS module `group-sessions/` with sub-services as needed. Same pattern as `bookings/`.

Dependencies (shared only):
- `PrismaService` — database
- `NotificationsService` — push notifications
- `PaymentsService` — payment linking (extended with `groupEnrollmentId`)
- `CacheService` — cache invalidation
- `PractitionersService` — practitioner validation (read-only)

No dependency on: Bookings, Services, Departments, or any other business module.

## Feature Flag

Uses existing `FeatureFlag` system:
- Key: `group_sessions`
- Default: `enabled: false` (clinic opts in)
- Backend: `@RequireFeature('group_sessions')` on controller → returns 403 if disabled
- Dashboard: sidebar hides the route when flag is off (requires new `featureFlag` field on `NavItem`)

---

## Data Model

### Enums (added to `enums.prisma`)

```prisma
enum GroupSessionStatus {
  open
  confirmed
  full
  completed
  cancelled
}

enum GroupEnrollmentStatus {
  registered
  confirmed
  attended
  expired
  cancelled
}
```

### GroupOffering (the template)

Created once by admin. Not a scheduled date — just a definition.

```prisma
model GroupOffering {
  id                    String    @id @default(uuid()) @map("id")
  clinicId              String    @map("clinic_id")
  practitionerId        String    @map("practitioner_id")
  departmentId          String?   @map("department_id")
  nameAr                String    @map("name_ar")
  nameEn                String    @map("name_en")
  descriptionAr         String?   @map("description_ar")
  descriptionEn         String?   @map("description_en")
  minParticipants       Int       @map("min_participants")
  maxParticipants       Int       @map("max_participants")
  pricePerPersonHalalat Int       @map("price_per_person_halalat")
  durationMin           Int       @map("duration_min")
  paymentDeadlineHours  Int       @default(48) @map("payment_deadline_hours")
  createdAt             DateTime  @default(now()) @map("created_at")
  updatedAt             DateTime  @updatedAt @map("updated_at")
  deletedAt             DateTime? @map("deleted_at")

  clinic       Clinic       @relation(fields: [clinicId], references: [id], onDelete: Restrict)
  practitioner Practitioner @relation(fields: [practitionerId], references: [id], onDelete: Restrict)
  department   Department?  @relation(fields: [departmentId], references: [id], onDelete: SetNull)
  sessions     GroupSession[]

  @@map("group_offerings")
}
```

### GroupSession (the actual scheduled date)

Generated from an offering. Each session has a specific date/time and status.

```prisma
model GroupSession {
  id                    String             @id @default(uuid()) @map("id")
  groupOfferingId       String             @map("group_offering_id")
  startTime             DateTime           @map("start_time")
  endTime               DateTime           @map("end_time")
  status                GroupSessionStatus @default(open) @map("status")
  currentEnrollment     Int                @default(0) @map("current_enrollment")
  registrationDeadline  DateTime           @map("registration_deadline")
  reminderSent          Boolean            @default(false) @map("reminder_sent")
  createdAt             DateTime           @default(now()) @map("created_at")
  updatedAt             DateTime           @updatedAt @map("updated_at")

  groupOffering  GroupOffering     @relation(fields: [groupOfferingId], references: [id], onDelete: Restrict)
  enrollments    GroupEnrollment[]

  @@index([groupOfferingId, status])
  @@index([status, registrationDeadline])
  @@map("group_sessions")
}
```

### GroupEnrollment (patient registration)

```prisma
model GroupEnrollment {
  id                 String                 @id @default(uuid()) @map("id")
  groupSessionId     String                 @map("group_session_id")
  patientId          String                 @map("patient_id")
  paymentId          String?                @unique @map("payment_id")
  status             GroupEnrollmentStatus  @default(registered) @map("status")
  paymentDeadlineAt  DateTime?              @map("payment_deadline_at")
  expiredAt          DateTime?              @map("expired_at")
  createdAt          DateTime               @default(now()) @map("created_at")
  updatedAt          DateTime               @updatedAt @map("updated_at")

  groupSession  GroupSession @relation(fields: [groupSessionId], references: [id], onDelete: Restrict)
  patient       Patient      @relation(fields: [patientId], references: [id], onDelete: Restrict)
  payment       Payment?     @relation(fields: [paymentId], references: [id], onDelete: SetNull)

  @@unique([groupSessionId, patientId])
  @@index([status, paymentDeadlineAt])
  @@map("group_enrollments")
}
```

### Payment Extension

Added to existing `Payment` model:

```prisma
groupEnrollmentId  String?          @unique @map("group_enrollment_id")
groupEnrollment    GroupEnrollment? @relation(fields: [groupEnrollmentId], references: [id], onDelete: SetNull)
```

---

## Payment Model: Register Free, Pay When Confirmed

### Core Decision

Patient does NOT pay upfront. They register interest for free. Payment is requested only after minimum enrollment is reached.

**Why:**
- Patient doesn't pay for something uncertain — better UX
- Clinic doesn't deal with refunds — simpler accounting
- No authorize/capture needed — less technical complexity

### Paid Sessions (pricePerPersonHalalat > 0)

```
1. Patient registers
   → enrollment.status = "registered"
   → No payment, no charge
   → session.currentEnrollment += 1

2. Minimum reached (e.g., 2 of 5)
   → session.status = "confirmed"
   → All registered enrollments get paymentDeadlineAt set
   → Notification: "Session confirmed — pay within 48 hours"

3. Patient pays (within deadline)
   → enrollment.status = "confirmed"
   → Linked to Payment record

4. Patient doesn't pay within deadline
   → enrollment.status = "expired", expiredAt = now
   → session.currentEnrollment -= 1
   → If below minimum: session.status reverts to "open"
```

### Free Sessions (pricePerPersonHalalat = 0)

```
1. Patient registers
   → enrollment.status = "confirmed" immediately
   → No payment step

2. Minimum reached
   → session.status = "confirmed"
   → Everyone is ready — no payment step needed
```

### Cancellation Rules

- Patient can cancel while `status = registered` (before payment) — free
- Patient CANNOT cancel after `status = confirmed` (already paid) — no refunds
- Admin can cancel any enrollment before payment
- Admin can cancel entire session → all enrollments cancelled + notifications

---

## State Machines

### Session Status

```
open → confirmed    (currentEnrollment >= minParticipants)
confirmed → full    (currentEnrollment >= maxParticipants)
full → confirmed    (enrollment removed, below max)
confirmed → open    (enrollment expired/removed, below min)
open → cancelled    (registrationDeadline passed, still below min)
confirmed → completed  (admin marks complete + attendance)
full → completed       (admin marks complete + attendance)
```

### Enrollment Status

```
registered → confirmed   (payment received, or free session)
registered → expired     (payment deadline passed)
registered → cancelled   (patient cancels, or admin removes)
confirmed → attended     (admin marks attendance on completion)
```

---

## Backend API

### Module Structure

```
backend/src/modules/group-sessions/
├── group-sessions.module.ts
├── group-sessions.controller.ts
├── group-sessions.service.ts              # offerings CRUD
├── group-sessions-sessions.service.ts     # sessions CRUD + state transitions
├── group-sessions-enrollments.service.ts  # enrollments + payment flow
├── dto/
│   ├── create-offering.dto.ts
│   ├── update-offering.dto.ts
│   ├── create-session.dto.ts
│   ├── enroll-patient.dto.ts
│   ├── mark-attendance.dto.ts
│   └── offering-list-query.dto.ts
```

### Endpoints

**Offerings:**

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| `POST` | `/group-sessions/offerings` | Create offering | `group_sessions.create` |
| `GET` | `/group-sessions/offerings` | List offerings (paginated) | `@Public()` |
| `GET` | `/group-sessions/offerings/:id` | Get offering detail | `@Public()` |
| `PATCH` | `/group-sessions/offerings/:id` | Update offering | `group_sessions.edit` |
| `DELETE` | `/group-sessions/offerings/:id` | Soft-delete offering | `group_sessions.delete` |

**Sessions:**

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| `POST` | `/group-sessions/offerings/:id/sessions` | Schedule session | `group_sessions.create` |
| `GET` | `/group-sessions/sessions` | List all sessions (paginated) | `@Public()` |
| `GET` | `/group-sessions/sessions/:id` | Session detail + enrollments | `@Public()` |
| `PATCH` | `/group-sessions/sessions/:id/cancel` | Cancel session (admin) | `group_sessions.edit` |
| `PATCH` | `/group-sessions/sessions/:id/complete` | Complete session | `group_sessions.edit` |

**Enrollments:**

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| `POST` | `/group-sessions/sessions/:id/enroll` | Enroll patient | authenticated patient |
| `DELETE` | `/group-sessions/sessions/:id/enrollments/:eid` | Remove patient (admin, pre-payment) | `group_sessions.edit` |
| `PATCH` | `/group-sessions/sessions/:id/enrollments/:eid/cancel` | Patient self-cancel | authenticated patient |
| `POST` | `/group-sessions/sessions/:id/attendance` | Mark attendance (batch) | `group_sessions.edit` |

### Guards

```typescript
@UseGuards(JwtAuthGuard, PermissionsGuard, FeatureFlagGuard)
@RequireFeature('group_sessions')
```

---

## Cron Jobs

Added to `TasksBootstrapService` desired jobs array.

### Job 1: `group-enrollment-expiry` (every 30 minutes)

```
1. Find: enrollments WHERE status = 'registered'
   AND paymentDeadlineAt IS NOT NULL
   AND paymentDeadlineAt < NOW()

2. For each (individual transactions):
   → enrollment.status = 'expired', expiredAt = NOW()
   → session.currentEnrollment -= 1
   → Notify: group_enrollment_expired

3. For each affected session:
   → If currentEnrollment < minParticipants: session.status = 'open'
   → If currentEnrollment < maxParticipants AND status = 'full': session.status = 'confirmed'
```

### Job 2: `group-session-cancellation` (every hour)

```
1. Find: sessions WHERE status = 'open'
   AND registrationDeadline < NOW()

2. For each:
   → session.status = 'cancelled'
   → All enrollments with status 'registered' → 'cancelled'
   → Notify all: group_session_cancelled
```

### Job 3: `group-session-reminder` (every hour)

```
1. Find: sessions WHERE status IN ('confirmed', 'full')
   AND startTime BETWEEN NOW() AND NOW() + 24h
   AND reminderSent = false

2. For each:
   → Notify all 'confirmed' enrollments: group_session_reminder
   → session.reminderSent = true
```

---

## Notifications

| Event | Recipient | Type | SMS Eligible |
|-------|-----------|------|-------------|
| Patient enrolled | Patient | `group_enrollment_created` | No |
| Session confirmed (min reached) | All registered | `group_session_confirmed` | Yes |
| Payment confirmed | Patient | `group_payment_confirmed` | No |
| Payment deadline expired | Patient | `group_enrollment_expired` | Yes |
| Session cancelled (min not met) | All enrolled | `group_session_cancelled` | Yes |
| Session cancelled (admin) | All enrolled | `group_session_cancelled_admin` | Yes |
| Session reminder (24h before) | Confirmed enrollments | `group_session_reminder` | Yes |

All via `NotificationsService.createNotification()` — fire-and-forget pattern.

---

## Dashboard

### Files

```
dashboard/
├── app/(dashboard)/group-sessions/
│   ├── page.tsx                              # Main page (tabs)
│   └── [sessionId]/page.tsx                  # Session detail
├── components/features/group-sessions/
│   ├── offerings-tab-content.tsx
│   ├── sessions-tab-content.tsx
│   ├── offering-card.tsx
│   ├── session-detail-header.tsx
│   ├── enrollments-table.tsx
│   ├── attendance-form.tsx
│   ├── create-offering-dialog.tsx
│   ├── edit-offering-dialog.tsx
│   ├── schedule-session-dialog.tsx
│   ├── cancel-session-dialog.tsx
│   └── enroll-patient-dialog.tsx
├── hooks/
│   ├── use-group-sessions.ts
│   └── use-group-sessions-mutations.ts
├── lib/
│   ├── api/group-sessions.ts
│   ├── types/group-sessions.ts
│   └── schemas/group-sessions.schema.ts
```

### Main Page `/group-sessions`

```
Breadcrumbs: Home > Group Sessions
PageHeader: "الجلسات الجماعية" + description | [+ إنشاء عرض]
StatsGrid (4):
  - Total Offerings (primary)
  - Upcoming Sessions (success)
  - Total Enrollments (warning)
  - Fill Rate % (accent)
Tabs: [العروض] [الجلسات]
```

**Offerings tab:** Card grid — name, practitioner, min/max, price, upcoming sessions count, actions (edit, schedule, disable).

**Sessions tab:** FilterBar + DataTable + Pagination. Columns: offering, date, enrolled/max, status, actions.

### Session Detail `/group-sessions/[sessionId]`

```
Breadcrumbs: Home > Group Sessions > Art Therapy — Apr 13
session-detail-header:
  Offering name + practitioner + date/time + duration
  Status badge
  Indicator: "3 enrolled · 2 paid · 1 awaiting payment"
  Actions: [Add Patient] [Cancel Session] [Complete Session]

enrollments-table:
  Name | Enrollment Status | Payment Status | Payment Deadline | Actions

attendance-form (visible when session is confirmed/full):
  Checkboxes per confirmed patient
  Button: "Save Attendance & Complete Session"
```

### Sidebar Integration

Add `featureFlag?: string` to `NavItem` in `sidebar-config.ts`. Filter in `sidebar-nav.tsx` by querying enabled feature flags once on mount.

```typescript
// sidebar-config.ts addition:
{
  title: "الجلسات الجماعية",
  titleEn: "Group Sessions",
  href: "/group-sessions",
  icon: UsersIcon,
  permission: "group_sessions.read",
  featureFlag: "group_sessions"
}
```

---

## Decisions Log

| Decision | Choice | Reason |
|----------|--------|--------|
| Position | Independent from services | Different model (group vs individual) |
| Payment model | Register free, pay when confirmed | Best patient UX, no refunds |
| Free sessions | Auto-confirm immediately | pricePerPersonHalalat = 0 |
| Feature flag | Existing FeatureFlag system | Already built with guards |
| departmentId | Nullable — not linked in v1 | Future upsell option |
| Recurring | Manual only (admin schedules each) | Simpler, no auto-generation |
| Payment table | Extend existing Payment with groupEnrollmentId | Reuse Moyasar/bank transfer logic |
| Cancellation | Patient can cancel before payment only | No refunds philosophy |
| Attendance | Manual by admin | Accurate data, matches individual bookings |
| Module structure | Single module with sub-services | Matches bookings pattern |
| Sidebar feature flags | New featureFlag field on NavItem | Generic — any future module can use it |

## Size Estimate

| Layer | New Files | Modified Files |
|-------|-----------|---------------|
| Prisma schema | 1 | 2 (enums, payments) |
| Backend module | ~10 | 3 (tasks-bootstrap, payments.service, app.module) |
| Dashboard | ~15 | 3 (sidebar-config, sidebar-nav, query-keys) |
| Shared (types/i18n) | ~3 | 0 |
| **Total** | **~29 new** | **~8 modified** |

Classification: **XL**
