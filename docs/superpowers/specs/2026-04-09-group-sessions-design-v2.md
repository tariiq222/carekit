# Group Sessions v2 — Redesigned Spec (Single Entity)

## Overview

Group therapy sessions sold via a **pre-order model** using a **single entity** instead of offering+session split. Patients register interest for free; the session only runs if minimum enrollment is met. Payment is requested only after confirmation.

**Example:** "العلاج بالفن" — Dr. Noura — min 2, max 5 — 150 SAR/person — 90 min

## What Changed from v1

| Aspect | v1 (old) | v2 (new) |
|--------|----------|----------|
| Entities | GroupOffering + GroupSession | **GroupSession only** |
| Creation | 2 steps (create offering → schedule session) | **1 step** |
| Scheduling | Manual date on session creation | **`fixed_date` or `on_capacity` mode** |
| Auto-schedule | None | **Notify admin when capacity met** |
| Visibility | Always visible | **`isPublished` toggle** |
| Expiry | Via registrationDeadline only | **Optional `expiresAt`** |
| Dashboard | Tabs (offerings + sessions) | **Single table, no tabs** |
| GroupOffering model | Exists | **Deleted** |

## Position in the System

```
Path 1: Departments → Services → Practitioner → Individual Booking  (existing)
Path 2: Group Sessions (pre-order group enrollment)                  (independent)
```

Fully independent from the individual services pipeline. No `serviceId` link. Nullable `departmentId` for future upsell — not used in v1.

## Architecture: Single Module

One NestJS module `group-sessions/` with sub-services. Same pattern as `bookings/`.

Dependencies (shared only):
- `PrismaService` — database
- `NotificationsService` — push notifications
- `PaymentsService` — payment linking
- `CacheService` — cache invalidation
- `PractitionersService` — practitioner validation (read-only)

No dependency on: Bookings, Services, Departments, or any other business module.

## Feature Flag

- Key: `group_sessions`
- Default: `enabled: false` (clinic opts in)
- Backend: `@RequireFeature('group_sessions')` → 403 if disabled
- Dashboard: sidebar hides route when flag off

---

## Data Model

### Enums (in `enums.prisma`)

```prisma
enum GroupSessionSchedulingMode {
  fixed_date
  on_capacity
}

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

### GroupSession (single entity — replaces GroupOffering + GroupSession)

```prisma
model GroupSession {
  id                    String                     @id @default(uuid()) @map("id")
  clinicId              String                     @map("clinic_id")
  practitionerId        String                     @map("practitioner_id")
  departmentId          String?                    @map("department_id")

  // Session definition (was in GroupOffering)
  nameAr                String                     @map("name_ar")
  nameEn                String                     @map("name_en")
  descriptionAr         String?                    @map("description_ar")
  descriptionEn         String?                    @map("description_en")
  minParticipants       Int                        @map("min_participants")
  maxParticipants       Int                        @map("max_participants")
  pricePerPersonHalalat Int                        @map("price_per_person_halalat")
  durationMinutes       Int                        @map("duration_minutes")
  paymentDeadlineHours  Int                        @default(48) @map("payment_deadline_hours")

  // Scheduling
  schedulingMode        GroupSessionSchedulingMode @map("scheduling_mode")
  startTime             DateTime?                  @map("start_time")
  endTime               DateTime?                  @map("end_time")

  // Status & enrollment
  status                GroupSessionStatus         @default(open) @map("status")
  currentEnrollment     Int                        @default(0) @map("current_enrollment")
  reminderSent          Boolean                    @default(false) @map("reminder_sent")

  // Visibility & expiry
  isPublished           Boolean                    @default(false) @map("is_published")
  expiresAt             DateTime?                  @map("expires_at")

  // Timestamps
  createdAt             DateTime                   @default(now()) @map("created_at")
  updatedAt             DateTime                   @updatedAt @map("updated_at")
  deletedAt             DateTime?                  @map("deleted_at")

  // Relations
  clinic       Clinic       @relation(fields: [clinicId], references: [id], onDelete: Restrict)
  practitioner Practitioner @relation(fields: [practitionerId], references: [id], onDelete: Restrict)
  department   Department?  @relation(fields: [departmentId], references: [id], onDelete: SetNull)
  enrollments  GroupEnrollment[]

  @@index([clinicId, status])
  @@index([status, expiresAt])
  @@map("group_sessions")
}
```

### GroupEnrollment (unchanged from v1)

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

## Scheduling Modes

### `fixed_date` — Admin sets date at creation

```
1. Admin creates session with startTime
   → endTime = startTime + durationMinutes
   → status = open, isPublished = true/false (admin choice)
   → Registration open immediately

2. Min enrollment reached
   → status = confirmed
   → Payment flow starts (if paid session)

3. Session date arrives
   → Admin completes + marks attendance
```

### `on_capacity` — Date set after min enrollment

```
1. Admin creates session WITHOUT startTime
   → startTime = null, endTime = null
   → status = open, isPublished = true/false (admin choice)
   → Registration open immediately

2. Min enrollment reached
   → Notification to admin: "اكتمل الحد الأدنى — حدد موعد الجلسة"
   → Status stays open (NOT confirmed yet)

3. Admin sets date via PATCH /group-sessions/:id
   → startTime set, endTime = startTime + durationMinutes
   → status = confirmed
   → Payment flow starts (if paid session)
   → Notification to all enrolled: "تم تحديد موعد الجلسة"
```

**Key difference:** In `on_capacity` mode, reaching min enrollment does NOT auto-confirm. It notifies the admin to set a date. Confirmation happens when the admin sets the date.

---

## Payment Model: Register Free, Pay When Confirmed

### Core Decision

Patient does NOT pay upfront. They register interest for free. Payment is requested only after session is confirmed.

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

2. Session confirmed (fixed_date: min reached / on_capacity: admin sets date)
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

2. Session confirmed
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
open → confirmed         (fixed_date: min reached / on_capacity: admin sets date)
confirmed → full         (currentEnrollment >= maxParticipants)
full → confirmed         (enrollment removed, below max)
confirmed → open         (enrollment expired/removed, below min)
open → cancelled         (expiresAt passed OR admin cancels)
confirmed → completed    (admin marks complete + attendance)
full → completed         (admin marks complete + attendance)
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
├── group-sessions.service.ts              # session CRUD + state transitions
├── group-sessions-enrollments.service.ts  # enrollments + payment flow
├── dto/
│   ├── create-group-session.dto.ts
│   ├── update-group-session.dto.ts
│   ├── enroll-patient.dto.ts
│   ├── mark-attendance.dto.ts
│   └── group-session-query.dto.ts
```

### Endpoints

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| `POST` | `/group-sessions` | Create session | `group_sessions.create` |
| `GET` | `/group-sessions` | List sessions (paginated, filtered) | `group_sessions.read` |
| `GET` | `/group-sessions/:id` | Session detail + enrollments | `group_sessions.read` |
| `PATCH` | `/group-sessions/:id` | Update session (+ set date for on_capacity) | `group_sessions.edit` |
| `DELETE` | `/group-sessions/:id` | Soft-delete session | `group_sessions.delete` |
| `POST` | `/group-sessions/:id/enroll` | Enroll patient | authenticated |
| `DELETE` | `/group-sessions/:id/enrollments/:eid` | Remove enrollment (admin) | `group_sessions.edit` |
| `PATCH` | `/group-sessions/:id/complete` | Complete + mark attendance | `group_sessions.edit` |
| `PATCH` | `/group-sessions/:id/cancel` | Cancel session | `group_sessions.edit` |

### Guards

```typescript
@UseGuards(JwtAuthGuard, PermissionsGuard, FeatureFlagGuard)
@RequireFeature('group_sessions')
```

---

## Cron Jobs

### Job 1: `group-enrollment-expiry` (every 30 minutes)

```
1. Find: enrollments WHERE status = 'registered'
   AND paymentDeadlineAt IS NOT NULL
   AND paymentDeadlineAt < NOW()

2. For each:
   → enrollment.status = 'expired', expiredAt = NOW()
   → session.currentEnrollment -= 1
   → Notify: group_enrollment_expired

3. For each affected session:
   → If currentEnrollment < minParticipants: session.status = 'open'
   → If currentEnrollment < maxParticipants AND status = 'full': session.status = 'confirmed'
```

### Job 2: `group-session-expiry` (every hour)

```
1. Find: sessions WHERE status = 'open'
   AND expiresAt IS NOT NULL
   AND expiresAt < NOW()

2. For each:
   → session.status = 'cancelled'
   → All enrollments with status IN ('registered') → 'cancelled'
   → Notify all: group_session_expired
```

### Job 3: `group-session-reminder` (every hour)

```
1. Find: sessions WHERE status IN ('confirmed', 'full')
   AND startTime IS NOT NULL
   AND startTime BETWEEN NOW() AND NOW() + 24h
   AND reminderSent = false

2. For each:
   → Notify all 'confirmed' enrollments: group_session_reminder
   → session.reminderSent = true
```

---

## Notifications

| Event | Recipient | Type | SMS |
|-------|-----------|------|-----|
| Patient enrolled | Patient | `group_enrollment_created` | No |
| Min reached (on_capacity) | Admin | `group_capacity_reached` | Yes |
| Session confirmed | All registered | `group_session_confirmed` | Yes |
| Date set (on_capacity) | All enrolled | `group_session_scheduled` | Yes |
| Payment confirmed | Patient | `group_payment_confirmed` | No |
| Payment deadline expired | Patient | `group_enrollment_expired` | Yes |
| Session expired (expiresAt) | All enrolled | `group_session_expired` | Yes |
| Session cancelled (admin) | All enrolled | `group_session_cancelled` | Yes |
| Session reminder (24h) | Confirmed enrollments | `group_session_reminder` | Yes |

---

## Dashboard

### Files

```
dashboard/
├── app/(dashboard)/group-sessions/
│   ├── page.tsx                              # Main list page
│   └── [sessionId]/page.tsx                  # Session detail
├── components/features/group-sessions/
│   ├── sessions-tab-content.tsx              # Main table content
│   ├── session-detail-header.tsx
│   ├── enrollments-table.tsx
│   ├── attendance-form.tsx
│   ├── create-session-dialog.tsx
│   ├── edit-session-dialog.tsx
│   ├── set-date-dialog.tsx                   # For on_capacity sessions
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
PageHeader: "الجلسات الجماعية" | [+ إضافة جلسة]
StatsGrid (4):
  - الكل (primary)
  - مفتوحة (success)
  - بانتظار التاريخ (warning) — on_capacity sessions where min reached but no date
  - منتهية (accent)
FilterBar: [بحث] [الحالة ▼] [الممارس ▼] [منشورة/مسودة ▼]
DataTable (no tabs, no Card wrapper):
  الاسم | الممارس | النوع | المسجلين | الحالة | منشورة | الإجراءات
Pagination
```

### Create Session Dialog

```
الاسم بالعربي *
الاسم بالإنجليزي *
الوصف (اختياري)
الممارس *
الحد الأدنى * | الحد الأقصى *
السعر (ريال) *
المدة (بالدقائق) *
مهلة الدفع (ساعات) [48]
────────────────────────────
☐ تحديد تاريخ     → DateTimePicker (startTime)
☐ بعد اكتمال العدد → (no date field)
────────────────────────────
☑ عرض للعملاء (isPublished)
☐ تاريخ انتهاء    → DateTimePicker (expiresAt)
────────────────────────────
[إلغاء] [إنشاء]
```

**Validation:** One of the two scheduling modes must be selected (radio, not checkbox).

### Session Detail `/group-sessions/[sessionId]`

```
Breadcrumbs: Home > Group Sessions > العلاج بالفن
session-detail-header:
  Session name + practitioner + status badge
  Date/time (or "بانتظار تحديد التاريخ" if on_capacity + no date)
  Duration
  Indicator: "3 مسجلين · 2 مدفوع · 1 بانتظار الدفع"
  Actions: [تحديد التاريخ (on_capacity only)] [إضافة مستفيد] [إلغاء] [إكمال]

enrollments-table:
  الاسم | حالة التسجيل | حالة الدفع | مهلة الدفع | إجراءات

attendance-form (visible when confirmed/full):
  Checkboxes per confirmed patient
  Button: "حفظ الحضور وإكمال الجلسة"
```

---

## Decisions Log

| Decision | Choice | Reason |
|----------|--------|--------|
| Single entity | GroupSession only | User requirement — simpler mental model |
| Scheduling modes | `fixed_date` / `on_capacity` | Support both use cases in one entity |
| on_capacity confirmation | Admin sets date → then confirms | Admin controls timing, not auto-confirm |
| isPublished | Boolean toggle | Admin controls when clients see it |
| expiresAt | Optional DateTime | Session can optionally auto-expire |
| No tabs | Single table view | One entity = one table |
| No GroupOffering | Deleted entirely | Merged into GroupSession |

## Migration from v1

Since v1 was not deployed to production:
- Delete `GroupOffering` model
- Modify `GroupSession` to include offering fields
- Add new fields: `schedulingMode`, `isPublished`, `expiresAt`
- Add new enum: `GroupSessionSchedulingMode`
- Drop v1 migration if exists, create fresh migration

## Size Estimate

| Layer | New Files | Modified Files |
|-------|-----------|---------------|
| Prisma schema | 1 | 2 (enums, payments) |
| Backend module | ~8 | 3 (tasks-bootstrap, payments.service, app.module) |
| Dashboard | ~12 | 3 (sidebar-config, sidebar-nav, query-keys) |
| Shared (types/i18n) | ~2 | 0 |
| **Total** | **~23 new** | **~8 modified** |

Classification: **XL** (but smaller than v1 — fewer entities, fewer endpoints, fewer components)
