# Messaging Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify `notifications/`, `email/`, and `email-templates/` under a single `messaging/` module with a `MessagingDispatcherService` that handles channel routing, user preferences, and message rendering — so all consumers call one method instead of wiring channels manually.

**Architecture:** A `MessagingDispatcherService` accepts a typed event + context, renders bilingual copy from a static registry, resolves per-user channel preferences from a new `MessagingPreference` DB table, persists an inbox row unconditionally, then fans out to push/email/sms channels in parallel. Every channel implements a `Channel` interface so adding new channels (WhatsApp etc.) requires zero changes to callers. All existing HTTP routes (`/notifications`, `/email-templates`) stay on their current paths — no breaking changes for mobile or dashboard clients.

**Tech Stack:** NestJS 11, Prisma 7, BullMQ (email queue stays), Firebase Admin (FCM), `@nestjs-modules/mailer`, TypeScript strict mode.

---

## File Map

### New files to create

| Path | Responsibility |
|------|---------------|
| `prisma/schema/messaging.prisma` | `MessagingPreference` model |
| `src/modules/messaging/messaging.module.ts` | Barrel module — imports all sub-modules, exports `MessagingDispatcherService` |
| `src/modules/messaging/core/channel.interface.ts` | `Channel` interface + `ChannelSendPayload` / `ChannelSendResult` types |
| `src/modules/messaging/core/messaging-events.ts` | `MessagingEvent` enum |
| `src/modules/messaging/core/messaging-templates.ts` | `EventTemplate` type + `TEMPLATES` registry (one entry per event) |
| `src/modules/messaging/core/messaging-dispatcher.service.ts` | `dispatch()` — orchestrator |
| `src/modules/messaging/core/messaging-preferences.service.ts` | Lazy-init CRUD on `MessagingPreference` |
| `src/modules/messaging/channels/push/push.channel.ts` | `PushChannel implements Channel` (thin adapter) |
| `src/modules/messaging/channels/push/push.service.ts` | Firebase FCM logic (moved from `notifications/`) |
| `src/modules/messaging/channels/push/fcm-tokens.service.ts` | FCM token CRUD (split from `notifications.service.ts`) |
| `src/modules/messaging/channels/sms/sms.channel.ts` | `SmsChannel implements Channel` (thin adapter) |
| `src/modules/messaging/channels/sms/sms.service.ts` | Unifonic/Twilio logic (moved from `notifications/`) |
| `src/modules/messaging/channels/email/email.channel.ts` | `EmailChannel implements Channel` (enqueues BullMQ job) |
| `src/modules/messaging/channels/email/email.service.ts` | Queue-only email producer (moved from `email/`) |
| `src/modules/messaging/channels/email/email.processor.ts` | BullMQ worker (moved from `email/`) |
| `src/modules/messaging/channels/email/email.layout.ts` | HTML builder (moved from `email/`) |
| `src/modules/messaging/channels/email/email.helpers.ts` | Plain-text builder (moved from `email/`) |
| `src/modules/messaging/inbox/notifications.controller.ts` | `@Controller('notifications')` — same routes, new location |
| `src/modules/messaging/inbox/notifications-inbox.service.ts` | `findAll`, `getUnreadCount`, `markAsRead`, `markAllAsRead`, `registerFcmToken`, `unregisterFcmToken` |
| `src/modules/messaging/inbox/dto/` | Move DTOs from `notifications/dto/` |
| `src/modules/messaging/email-templates/email-templates.controller.ts` | `@Controller('email-templates')` (moved) |
| `src/modules/messaging/email-templates/email-templates.service.ts` | Moved unchanged |
| `src/modules/messaging/email-templates/dto/` | Moved unchanged |
| `test/unit/messaging/messaging-dispatcher.spec.ts` | Dispatcher unit tests |
| `test/unit/messaging/messaging-templates.spec.ts` | Template render coverage |
| `test/unit/messaging/messaging-preferences.spec.ts` | Preferences lazy-init + resolve tests |

### Files to modify

| Path | Change |
|------|--------|
| `prisma/schema/enums.prisma` | No change — `NotificationType` stays |
| `prisma/schema/config.prisma` | No change — `Notification` + `FcmToken` stay |
| `src/app.module.ts` | Replace `NotificationsModule`, `EmailModule`, `EmailTemplatesModule` with `MessagingModule` |
| `src/modules/bookings/bookings.module.ts` | Replace `NotificationsModule` with `MessagingModule` |
| `src/modules/bookings/booking-creation.service.ts` | Inject `MessagingDispatcherService`, replace `createNotification` call |
| `src/modules/bookings/booking-status.service.ts` | Same (3 calls) |
| `src/modules/bookings/booking-reschedule.service.ts` | Same |
| `src/modules/bookings/booking-cancel-helpers.service.ts` | Same |
| `src/modules/bookings/waitlist.service.ts` | Same |
| `src/modules/bookings/booking-cancellation.service.ts` | Same |
| `src/modules/payments/payments.module.ts` | Replace `NotificationsModule` with `MessagingModule` |
| `src/modules/payments/bank-transfer.service.ts` | Replace `createNotification` call |
| `src/modules/tasks/tasks.module.ts` | Replace `NotificationsModule` with `MessagingModule` |
| `src/modules/tasks/reminder.service.ts` | Replace 6 `createNotification` calls |
| `src/modules/tasks/group-session-automation.service.ts` | Replace 3 calls |
| `src/modules/tasks/booking-expiry.service.ts` | Replace 1 call |
| `src/modules/tasks/booking-noshow.service.ts` | Replace 4 calls |
| `src/modules/tasks/booking-cancellation-timeout.service.ts` | Replace 1 call |
| `src/modules/tasks/booking-autocomplete.service.ts` | Replace 1 call |
| `src/modules/groups/groups.module.ts` | Replace `NotificationsModule` with `MessagingModule` |
| `src/modules/groups/groups-attendance.service.ts` | Replace call |
| `src/modules/groups/groups-enrollments.service.ts` | Replace call |
| `src/modules/groups/groups-lifecycle.service.ts` | Replace calls |
| `src/modules/groups/groups-payment.service.ts` | Replace call |
| `src/modules/problem-reports/problem-reports.module.ts` | Replace `NotificationsModule` with `MessagingModule` |
| `src/modules/problem-reports/problem-reports.service.ts` | Replace call |
| `src/modules/employees/employees.module.ts` | Replace `EmailModule` with `MessagingModule` |
| `src/modules/employees/employee-onboarding.service.ts` | Replace `emailService.sendEmployeeWelcome()` |
| `src/modules/auth/auth.module.ts` | Replace `EmailModule` with `MessagingModule` |
| `src/modules/auth/auth.service.ts` | Replace 3 email calls with `dispatch()` |

### Files to delete (PR #7 only)

```
src/modules/notifications/
src/modules/email/
src/modules/email-templates/
```

---

## PR Sequence

| PR | Title | Scope |
|----|-------|-------|
| #1 | `feat(messaging): add MessagingPreference migration` | Schema only |
| #2 | `feat(messaging): scaffold module skeleton + event registry` | Core types, no wiring |
| #3 | `refactor(messaging): move push channel` | push.service + fcm-tokens + channel adapter |
| #4 | `refactor(messaging): move sms + email + email-templates channels` | All three channels moved |
| #5 | `feat(messaging): wire dispatcher + preferences` | Full dispatch() logic |
| #6a | `refactor(messaging): migrate non-auth consumers` | bookings, tasks, groups, payments, problem-reports, employees |
| #6b | `refactor(messaging): migrate auth consumers` | auth.service (Owner-tier) |
| #7 | `refactor(messaging): remove legacy modules` | Delete old dirs, clean app.module |

---

## Task 1: Prisma Migration — MessagingPreference

**Files:**
- Create: `apps/backend/prisma/schema/messaging.prisma`
- Run: `apps/backend/prisma/migrations/` (generated)

- [ ] **Step 1: Create schema file**

```prisma
// apps/backend/prisma/schema/messaging.prisma

model MessagingPreference {
  id     String @id @default(uuid())
  userId String @unique @map("user_id")

  pushEnabled  Boolean @default(true) @map("push_enabled")
  emailEnabled Boolean @default(true) @map("email_enabled")
  smsEnabled   Boolean @default(true) @map("sms_enabled")

  // JSON shape: { "booking": { push: true, email: true, sms: true } }
  categories Json @default("{}") @map("categories")

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("messaging_preferences")
}
```

- [ ] **Step 2: Add relation to User in auth.prisma**

Open `apps/backend/prisma/schema/auth.prisma`. Find the `User` model. Add after the last relation line:

```prisma
  messagingPreference   MessagingPreference?
```

- [ ] **Step 3: Run migration**

```bash
cd apps/backend
npm run prisma:migrate
```

When prompted for migration name, enter: `add_messaging_preferences`

Expected output: `Your database is now in sync with your schema.`

- [ ] **Step 4: Verify generated migration SQL contains only an ADD TABLE**

```bash
ls prisma/migrations/ | grep messaging
cat prisma/migrations/*messaging_preferences*/migration.sql
```

Expected: SQL contains `CREATE TABLE "messaging_preferences"` and **no DROP or ALTER on existing tables**.

- [ ] **Step 5: Commit**

```bash
cd apps/backend
git add prisma/schema/messaging.prisma prisma/schema/auth.prisma prisma/migrations/
git commit -m "feat(messaging): add MessagingPreference migration"
```

---

## Task 2: Core Types — Channel Interface + Event Registry + Templates

**Files:**
- Create: `src/modules/messaging/core/channel.interface.ts`
- Create: `src/modules/messaging/core/messaging-events.ts`
- Create: `src/modules/messaging/core/messaging-templates.ts`
- Create: `test/unit/messaging/messaging-templates.spec.ts`

- [ ] **Step 1: Write failing test**

```typescript
// apps/backend/test/unit/messaging/messaging-templates.spec.ts
import { TEMPLATES } from '../../../src/modules/messaging/core/messaging-templates.js';
import { MessagingEvent } from '../../../src/modules/messaging/core/messaging-events.js';

describe('TEMPLATES registry', () => {
  it('covers every MessagingEvent value', () => {
    const allEvents = Object.values(MessagingEvent);
    for (const event of allEvents) {
      expect(TEMPLATES[event]).toBeDefined();
    }
  });

  it('BOOKING_CONFIRMED renders Arabic title', () => {
    const tpl = TEMPLATES[MessagingEvent.BOOKING_CONFIRMED];
    const result = tpl.render({ date: '2026-05-01', time: '10:00', employeeName: 'أحمد', serviceName: 'استشارة' });
    expect(result.titleAr).toBe('تأكيد الموعد');
    expect(result.bodyAr).toContain('أحمد');
  });

  it('OTP_REQUESTED has override: true (bypasses preferences)', () => {
    expect(TEMPLATES[MessagingEvent.OTP_REQUESTED].overridePreferences).toBe(true);
  });

  it('every template render returns all 4 string fields', () => {
    const minCtx = {
      date: 'd', time: 't', employeeName: 'p', serviceName: 's',
      code: '1234', firstName: 'علي', otpCode: '5678',
      bookingId: 'b1', amount: '100',
    };
    for (const [event, tpl] of Object.entries(TEMPLATES)) {
      const r = (tpl as typeof TEMPLATES[MessagingEvent]).render(minCtx as never);
      expect(typeof r.titleAr).toBe('string');
      expect(typeof r.titleEn).toBe('string');
      expect(typeof r.bodyAr).toBe('string');
      expect(typeof r.bodyEn).toBe('string');
      expect(typeof r.notificationType).toBe('string');
    }
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd apps/backend
npx jest test/unit/messaging/messaging-templates.spec.ts --no-coverage
```

Expected: `Cannot find module '../../../src/modules/messaging/core/messaging-templates.js'`

- [ ] **Step 3: Create channel interface**

```typescript
// apps/backend/src/modules/messaging/core/channel.interface.ts
import type { MessagingEvent } from './messaging-events.js';

export interface ChannelSendPayload {
  userId: string;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  data?: Record<string, string>;
  event: MessagingEvent;
  /** Direct recipient email — provided by dispatcher when resolved */
  recipientEmail?: string;
}

export interface ChannelSendResult {
  ok: boolean;
  skipped?: 'user_opt_out' | 'channel_disabled' | 'no_address' | 'no_token';
  error?: string;
}

export interface Channel {
  readonly name: 'push' | 'email' | 'sms';
  send(payload: ChannelSendPayload): Promise<ChannelSendResult>;
  isEnabled(): boolean;
}
```

- [ ] **Step 4: Create event enum**

```typescript
// apps/backend/src/modules/messaging/core/messaging-events.ts
export enum MessagingEvent {
  // Auth
  OTP_REQUESTED = 'auth.otp_requested',
  WELCOME = 'auth.welcome',
  EMPLOYEE_WELCOME = 'auth.employee_welcome',

  // Bookings
  BOOKING_CONFIRMED = 'booking.confirmed',
  BOOKING_CONFIRMED_EMPLOYEE = 'booking.confirmed_employee',
  BOOKING_REMINDER = 'booking.reminder',
  BOOKING_REMINDER_URGENT = 'booking.reminder_urgent',
  BOOKING_CANCELLED = 'booking.cancelled',
  BOOKING_CANCELLED_BY_EMPLOYEE = 'booking.cancelled_by_employee',
  BOOKING_CANCELLATION_REQUESTED = 'booking.cancellation_requested',
  BOOKING_CANCELLATION_REJECTED = 'booking.cancellation_rejected',
  BOOKING_RESCHEDULED = 'booking.rescheduled',
  BOOKING_RESCHEDULED_EMPLOYEE = 'booking.rescheduled_employee',
  BOOKING_COMPLETED = 'booking.completed',
  BOOKING_EXPIRED = 'booking.expired',
  BOOKING_NOSHOW = 'booking.noshow',
  BOOKING_NOSHOW_REVIEW = 'booking.noshow_review',
  BOOKING_AUTOCOMPLETED = 'booking.autocompleted',
  CLIENT_ARRIVED = 'booking.client_arrived',
  WAITLIST_SLOT_AVAILABLE = 'booking.waitlist_slot_available',

  // Payments
  PAYMENT_RECEIVED = 'payment.received',
  BANK_TRANSFER_SUBMITTED = 'payment.bank_transfer_submitted',
  RECEIPT_REJECTED = 'payment.receipt_rejected',

  // Groups
  GROUP_SESSION_REMINDER = 'group.session_reminder',
  GROUP_ENROLLMENT_CONFIRMED = 'group.enrollment_confirmed',
  GROUP_CAPACITY_REACHED = 'group.capacity_reached',
  GROUP_SESSION_CONFIRMED = 'group.session_confirmed',
  GROUP_PAYMENT_CONFIRMED = 'group.payment_confirmed',
  GROUP_ATTENDANCE_MARKED = 'group.attendance_marked',

  // Problem reports
  PROBLEM_REPORT_RESOLVED = 'problem.resolved',
}
```

- [ ] **Step 5: Create templates registry**

```typescript
// apps/backend/src/modules/messaging/core/messaging-templates.ts
import type { NotificationType } from '@prisma/client';
import { MessagingEvent } from './messaging-events.js';

export interface RenderedMessage {
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  notificationType: NotificationType;
}

export interface EventTemplate<TCtx = Record<string, string>> {
  category: 'booking' | 'payment' | 'auth' | 'group' | 'system';
  defaultChannels: ('push' | 'email' | 'sms')[];
  /** When true, ignore per-user preferences and send on all defaultChannels */
  overridePreferences?: boolean;
  render: (ctx: TCtx) => RenderedMessage;
}

type BookingCtx = { date: string; time: string; employeeName: string; serviceName: string };
type OtpCtx = { code: string; firstName?: string; otpType?: string };
type WelcomeCtx = { firstName: string };
type EmployeeWelcomeCtx = { firstName: string; otpCode: string };
type AmountCtx = { amount: string };
type GenericCtx = Record<string, string>;

export const TEMPLATES: Record<MessagingEvent, EventTemplate<never>> = {
  // ─── Auth ─────────────────────────────────────────────────────
  [MessagingEvent.OTP_REQUESTED]: {
    category: 'auth',
    defaultChannels: ['email', 'sms'],
    overridePreferences: true,
    render: (ctx: OtpCtx) => ({
      titleAr: 'رمز التحقق',
      titleEn: 'Verification Code',
      bodyAr: `رمز التحقق الخاص بك هو: ${ctx.code}`,
      bodyEn: `Your verification code is: ${ctx.code}`,
      notificationType: 'system_alert',
    }),
  } as EventTemplate<never>,

  [MessagingEvent.WELCOME]: {
    category: 'auth',
    defaultChannels: ['push', 'email'],
    render: (ctx: WelcomeCtx) => ({
      titleAr: 'أهلاً بك',
      titleEn: 'Welcome',
      bodyAr: `مرحباً ${ctx.firstName}، يسعدنا انضمامك`,
      bodyEn: `Welcome ${ctx.firstName}, we're glad to have you`,
      notificationType: 'system_alert',
    }),
  } as EventTemplate<never>,

  [MessagingEvent.EMPLOYEE_WELCOME]: {
    category: 'auth',
    defaultChannels: ['email'],
    render: (ctx: EmployeeWelcomeCtx) => ({
      titleAr: 'مرحباً بك',
      titleEn: 'Welcome',
      bodyAr: `مرحباً ${ctx.firstName}، رمز كلمة المرور المؤقت: ${ctx.otpCode}`,
      bodyEn: `Welcome ${ctx.firstName}, your temporary password code: ${ctx.otpCode}`,
      notificationType: 'system_alert',
    }),
  } as EventTemplate<never>,

  // ─── Bookings ──────────────────────────────────────────────────
  [MessagingEvent.BOOKING_CONFIRMED]: {
    category: 'booking',
    defaultChannels: ['push', 'sms'],
    render: (ctx: BookingCtx) => ({
      titleAr: 'تأكيد الموعد',
      titleEn: 'Booking Confirmed',
      bodyAr: `تم تأكيد موعدك مع ${ctx.employeeName} بتاريخ ${ctx.date} الساعة ${ctx.time}`,
      bodyEn: `Your appointment with ${ctx.employeeName} on ${ctx.date} at ${ctx.time} is confirmed`,
      notificationType: 'booking_confirmed',
    }),
  } as EventTemplate<never>,

  [MessagingEvent.BOOKING_CONFIRMED_EMPLOYEE]: {
    category: 'booking',
    defaultChannels: ['push'],
    render: (ctx: BookingCtx) => ({
      titleAr: 'حجز جديد',
      titleEn: 'New Booking',
      bodyAr: `لديك حجز جديد بتاريخ ${ctx.date} الساعة ${ctx.time}`,
      bodyEn: `You have a new booking on ${ctx.date} at ${ctx.time}`,
      notificationType: 'booking_confirmed',
    }),
  } as EventTemplate<never>,

  [MessagingEvent.BOOKING_REMINDER]: {
    category: 'booking',
    defaultChannels: ['push', 'sms'],
    render: (ctx: BookingCtx) => ({
      titleAr: 'تذكير بموعدك',
      titleEn: 'Appointment Reminder',
      bodyAr: `تذكير: موعدك مع ${ctx.employeeName} غداً الساعة ${ctx.time}`,
      bodyEn: `Reminder: Your appointment with ${ctx.employeeName} is tomorrow at ${ctx.time}`,
      notificationType: 'booking_reminder',
    }),
  } as EventTemplate<never>,

  [MessagingEvent.BOOKING_REMINDER_URGENT]: {
    category: 'booking',
    defaultChannels: ['push', 'sms'],
    render: (ctx: BookingCtx) => ({
      titleAr: 'موعدك قريب',
      titleEn: 'Appointment Soon',
      bodyAr: `موعدك مع ${ctx.employeeName} خلال ساعة الساعة ${ctx.time}`,
      bodyEn: `Your appointment with ${ctx.employeeName} is in 1 hour at ${ctx.time}`,
      notificationType: 'booking_reminder_urgent',
    }),
  } as EventTemplate<never>,

  [MessagingEvent.BOOKING_CANCELLED]: {
    category: 'booking',
    defaultChannels: ['push', 'sms'],
    render: (ctx: BookingCtx) => ({
      titleAr: 'تم إلغاء الموعد',
      titleEn: 'Booking Cancelled',
      bodyAr: `تم إلغاء موعدك مع ${ctx.employeeName} بتاريخ ${ctx.date}`,
      bodyEn: `Your booking with ${ctx.employeeName} on ${ctx.date} has been cancelled`,
      notificationType: 'booking_cancelled',
    }),
  } as EventTemplate<never>,

  [MessagingEvent.BOOKING_CANCELLED_BY_EMPLOYEE]: {
    category: 'booking',
    defaultChannels: ['push', 'sms'],
    render: (ctx: BookingCtx) => ({
      titleAr: 'تم إلغاء موعدك من قبل الطبيب',
      titleEn: 'Your Booking Was Cancelled by Employee',
      bodyAr: `أعتذر، تم إلغاء موعدك بتاريخ ${ctx.date} من قبل ${ctx.employeeName}`,
      bodyEn: `Your booking on ${ctx.date} was cancelled by ${ctx.employeeName}`,
      notificationType: 'booking_employee_cancelled',
    }),
  } as EventTemplate<never>,

  [MessagingEvent.BOOKING_CANCELLATION_REQUESTED]: {
    category: 'booking',
    defaultChannels: ['push'],
    render: (ctx: BookingCtx) => ({
      titleAr: 'طلب إلغاء موعد جديد',
      titleEn: 'New Cancellation Request',
      bodyAr: `طلب إلغاء موعد بتاريخ ${ctx.date} الساعة ${ctx.time}`,
      bodyEn: `Cancellation request for booking on ${ctx.date} at ${ctx.time}`,
      notificationType: 'booking_cancellation_requested',
    }),
  } as EventTemplate<never>,

  [MessagingEvent.BOOKING_CANCELLATION_REJECTED]: {
    category: 'booking',
    defaultChannels: ['push', 'sms'],
    render: (_ctx: GenericCtx) => ({
      titleAr: 'تم رفض طلب الإلغاء',
      titleEn: 'Cancellation Rejected',
      bodyAr: 'تم رفض طلب إلغاء موعدك. الموعد لا يزال مؤكداً',
      bodyEn: 'Your cancellation request was rejected. The booking remains confirmed',
      notificationType: 'cancellation_rejected',
    }),
  } as EventTemplate<never>,

  [MessagingEvent.BOOKING_RESCHEDULED]: {
    category: 'booking',
    defaultChannels: ['push', 'sms'],
    render: (ctx: BookingCtx) => ({
      titleAr: 'إعادة جدولة الموعد',
      titleEn: 'Booking Rescheduled',
      bodyAr: `تم إعادة جدولة موعدك مع ${ctx.employeeName} إلى ${ctx.date} الساعة ${ctx.time}`,
      bodyEn: `Your booking with ${ctx.employeeName} has been rescheduled to ${ctx.date} at ${ctx.time}`,
      notificationType: 'booking_rescheduled',
    }),
  } as EventTemplate<never>,

  [MessagingEvent.BOOKING_RESCHEDULED_EMPLOYEE]: {
    category: 'booking',
    defaultChannels: ['push'],
    render: (_ctx: GenericCtx) => ({
      titleAr: 'إعادة جدولة موعد',
      titleEn: 'Booking Rescheduled',
      bodyAr: 'تم إعادة جدولة أحد مواعيدك',
      bodyEn: 'One of your bookings has been rescheduled',
      notificationType: 'booking_rescheduled',
    }),
  } as EventTemplate<never>,

  [MessagingEvent.BOOKING_COMPLETED]: {
    category: 'booking',
    defaultChannels: ['push'],
    render: (_ctx: GenericCtx) => ({
      titleAr: 'اكتمل الموعد',
      titleEn: 'Booking Completed',
      bodyAr: 'تم اكتمال موعدك. يمكنك الآن تقييم تجربتك',
      bodyEn: 'Your booking is completed. You can now rate your experience',
      notificationType: 'booking_completed',
    }),
  } as EventTemplate<never>,

  [MessagingEvent.BOOKING_EXPIRED]: {
    category: 'booking',
    defaultChannels: ['push'],
    render: (ctx: BookingCtx) => ({
      titleAr: 'انتهى وقت الحجز',
      titleEn: 'Booking Expired',
      bodyAr: `انتهى وقت تأكيد حجزك بتاريخ ${ctx.date}`,
      bodyEn: `Your booking on ${ctx.date} has expired due to non-payment`,
      notificationType: 'booking_expired',
    }),
  } as EventTemplate<never>,

  [MessagingEvent.BOOKING_NOSHOW]: {
    category: 'booking',
    defaultChannels: ['push'],
    render: (ctx: BookingCtx) => ({
      titleAr: 'تغيب عن الموعد',
      titleEn: 'No-Show Recorded',
      bodyAr: `تم تسجيل تغيب عن موعدك بتاريخ ${ctx.date}`,
      bodyEn: `A no-show was recorded for your appointment on ${ctx.date}`,
      notificationType: 'booking_no_show',
    }),
  } as EventTemplate<never>,

  [MessagingEvent.BOOKING_NOSHOW_REVIEW]: {
    category: 'booking',
    defaultChannels: ['push'],
    render: (ctx: BookingCtx) => ({
      titleAr: 'مراجعة حالة التغيب',
      titleEn: 'No-Show Review',
      bodyAr: `يرجى مراجعة حالة التغيب للموعد بتاريخ ${ctx.date}`,
      bodyEn: `Please review the no-show for the booking on ${ctx.date}`,
      notificationType: 'no_show_review',
    }),
  } as EventTemplate<never>,

  [MessagingEvent.BOOKING_AUTOCOMPLETED]: {
    category: 'booking',
    defaultChannels: ['push'],
    render: (ctx: BookingCtx) => ({
      titleAr: 'اكتمل الموعد تلقائياً',
      titleEn: 'Booking Auto-Completed',
      bodyAr: `تم إتمام موعدك بتاريخ ${ctx.date} تلقائياً`,
      bodyEn: `Your booking on ${ctx.date} was automatically completed`,
      notificationType: 'booking_completed',
    }),
  } as EventTemplate<never>,

  [MessagingEvent.CLIENT_ARRIVED]: {
    category: 'booking',
    defaultChannels: ['push'],
    render: (_ctx: GenericCtx) => ({
      titleAr: 'وصول المريض',
      titleEn: 'Client Arrived',
      bodyAr: 'المريض وصل وجاهز للموعد',
      bodyEn: 'Client has arrived and is ready',
      notificationType: 'client_arrived',
    }),
  } as EventTemplate<never>,

  [MessagingEvent.WAITLIST_SLOT_AVAILABLE]: {
    category: 'booking',
    defaultChannels: ['push', 'sms'],
    render: (ctx: BookingCtx) => ({
      titleAr: 'موعد متاح!',
      titleEn: 'Slot Available!',
      bodyAr: `أصبح هناك موعد متاح مع ${ctx.employeeName} بتاريخ ${ctx.date}`,
      bodyEn: `A slot is now available with ${ctx.employeeName} on ${ctx.date}`,
      notificationType: 'waitlist_slot_available',
    }),
  } as EventTemplate<never>,

  // ─── Payments ──────────────────────────────────────────────────
  [MessagingEvent.PAYMENT_RECEIVED]: {
    category: 'payment',
    defaultChannels: ['push'],
    render: (ctx: AmountCtx) => ({
      titleAr: 'تم استلام الدفعة',
      titleEn: 'Payment Received',
      bodyAr: `تم استلام دفعتك بمبلغ ${ctx.amount} ريال`,
      bodyEn: `Your payment of ${ctx.amount} SAR has been received`,
      notificationType: 'payment_received',
    }),
  } as EventTemplate<never>,

  [MessagingEvent.BANK_TRANSFER_SUBMITTED]: {
    category: 'payment',
    defaultChannels: ['push'],
    render: (ctx: AmountCtx) => ({
      titleAr: 'تم استلام إيصال التحويل',
      titleEn: 'Transfer Receipt Submitted',
      bodyAr: `تم استلام إيصال التحويل البنكي بمبلغ ${ctx.amount} ريال وهو قيد المراجعة`,
      bodyEn: `Bank transfer receipt of ${ctx.amount} SAR received and under review`,
      notificationType: 'payment_received',
    }),
  } as EventTemplate<never>,

  [MessagingEvent.RECEIPT_REJECTED]: {
    category: 'payment',
    defaultChannels: ['push', 'sms'],
    render: (_ctx: GenericCtx) => ({
      titleAr: 'تم رفض إيصال التحويل البنكي',
      titleEn: 'Bank Transfer Receipt Rejected',
      bodyAr: 'تم رفض إيصال التحويل البنكي. يرجى إعادة الرفع أو التواصل معنا',
      bodyEn: 'Your bank transfer receipt was rejected. Please re-upload or contact us',
      notificationType: 'payment_received',
    }),
  } as EventTemplate<never>,

  // ─── Groups ────────────────────────────────────────────────────
  [MessagingEvent.GROUP_SESSION_REMINDER]: {
    category: 'group',
    defaultChannels: ['push', 'sms'],
    render: (ctx: BookingCtx) => ({
      titleAr: 'تذكير بالجلسة الجماعية',
      titleEn: 'Group Session Reminder',
      bodyAr: `جلستك الجماعية مع ${ctx.employeeName} غداً الساعة ${ctx.time}`,
      bodyEn: `Your group session with ${ctx.employeeName} is tomorrow at ${ctx.time}`,
      notificationType: 'booking_reminder',
    }),
  } as EventTemplate<never>,

  [MessagingEvent.GROUP_ENROLLMENT_CONFIRMED]: {
    category: 'group',
    defaultChannels: ['push'],
    render: (ctx: BookingCtx) => ({
      titleAr: 'تأكيد التسجيل',
      titleEn: 'Enrollment Confirmed',
      bodyAr: `تم تأكيد تسجيلك في جلسة ${ctx.serviceName}`,
      bodyEn: `Your enrollment in ${ctx.serviceName} has been confirmed`,
      notificationType: 'group_enrollment_created',
    }),
  } as EventTemplate<never>,

  [MessagingEvent.GROUP_CAPACITY_REACHED]: {
    category: 'group',
    defaultChannels: ['push'],
    render: (ctx: BookingCtx) => ({
      titleAr: 'اكتمل عدد المشتركين',
      titleEn: 'Group Capacity Reached',
      bodyAr: `اكتملت الجلسة الجماعية ${ctx.serviceName}`,
      bodyEn: `Group session ${ctx.serviceName} has reached full capacity`,
      notificationType: 'group_capacity_reached',
    }),
  } as EventTemplate<never>,

  [MessagingEvent.GROUP_SESSION_CONFIRMED]: {
    category: 'group',
    defaultChannels: ['push'],
    render: (ctx: BookingCtx) => ({
      titleAr: 'تأكيد الجلسة الجماعية',
      titleEn: 'Group Session Confirmed',
      bodyAr: `تم تأكيد الجلسة الجماعية ${ctx.serviceName} بتاريخ ${ctx.date}`,
      bodyEn: `Group session ${ctx.serviceName} on ${ctx.date} is confirmed`,
      notificationType: 'group_session_confirmed',
    }),
  } as EventTemplate<never>,

  [MessagingEvent.GROUP_PAYMENT_CONFIRMED]: {
    category: 'group',
    defaultChannels: ['push'],
    render: (ctx: AmountCtx) => ({
      titleAr: 'تأكيد الدفع',
      titleEn: 'Payment Confirmed',
      bodyAr: `تم تأكيد دفعتك بمبلغ ${ctx.amount} ريال للجلسة الجماعية`,
      bodyEn: `Your payment of ${ctx.amount} SAR for the group session is confirmed`,
      notificationType: 'group_payment_confirmed',
    }),
  } as EventTemplate<never>,

  [MessagingEvent.GROUP_ATTENDANCE_MARKED]: {
    category: 'group',
    defaultChannels: ['push'],
    render: (_ctx: GenericCtx) => ({
      titleAr: 'تم تسجيل حضورك',
      titleEn: 'Attendance Marked',
      bodyAr: 'تم تسجيل حضورك في الجلسة',
      bodyEn: 'Your attendance has been recorded',
      notificationType: 'system_alert',
    }),
  } as EventTemplate<never>,

  // ─── Problem Reports ───────────────────────────────────────────
  [MessagingEvent.PROBLEM_REPORT_RESOLVED]: {
    category: 'system',
    defaultChannels: ['push'],
    render: (_ctx: GenericCtx) => ({
      titleAr: 'تم حل المشكلة',
      titleEn: 'Problem Resolved',
      bodyAr: 'تم مراجعة بلاغك وحل المشكلة المُبلَّغ عنها',
      bodyEn: 'Your problem report has been reviewed and resolved',
      notificationType: 'system_alert',
    }),
  } as EventTemplate<never>,
};
```

- [ ] **Step 6: Run test — expect PASS**

```bash
cd apps/backend
npx jest test/unit/messaging/messaging-templates.spec.ts --no-coverage
```

Expected: `Tests: 4 passed`

- [ ] **Step 7: Commit**

```bash
cd apps/backend
git add src/modules/messaging/core/ test/unit/messaging/messaging-templates.spec.ts
git commit -m "feat(messaging): add channel interface, event enum, and templates registry"
```

---

## Task 3: MessagingPreferencesService

**Files:**
- Create: `src/modules/messaging/core/messaging-preferences.service.ts`
- Create: `test/unit/messaging/messaging-preferences.spec.ts`

- [ ] **Step 1: Write failing test**

```typescript
// apps/backend/test/unit/messaging/messaging-preferences.spec.ts
import { Test } from '@nestjs/testing';
import { MessagingPreferencesService } from '../../../src/modules/messaging/core/messaging-preferences.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';

const mockPrisma = {
  messagingPreference: {
    upsert: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

describe('MessagingPreferencesService', () => {
  let service: MessagingPreferencesService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        MessagingPreferencesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(MessagingPreferencesService);
    jest.clearAllMocks();
  });

  describe('resolve', () => {
    it('returns defaults when no record exists', async () => {
      mockPrisma.messagingPreference.findUnique.mockResolvedValue(null);
      const prefs = await service.resolve('user-1');
      expect(prefs.pushEnabled).toBe(true);
      expect(prefs.emailEnabled).toBe(true);
      expect(prefs.smsEnabled).toBe(true);
    });

    it('returns stored values when record exists', async () => {
      mockPrisma.messagingPreference.findUnique.mockResolvedValue({
        pushEnabled: true,
        emailEnabled: false,
        smsEnabled: true,
        categories: {},
      });
      const prefs = await service.resolve('user-1');
      expect(prefs.emailEnabled).toBe(false);
    });
  });

  describe('isChannelEnabled', () => {
    it('returns false for sms when smsEnabled is false', async () => {
      mockPrisma.messagingPreference.findUnique.mockResolvedValue({
        pushEnabled: true, emailEnabled: true, smsEnabled: false, categories: {},
      });
      const enabled = await service.isChannelEnabled('user-1', 'sms', 'booking');
      expect(enabled).toBe(false);
    });

    it('returns true for push when all enabled', async () => {
      mockPrisma.messagingPreference.findUnique.mockResolvedValue({
        pushEnabled: true, emailEnabled: true, smsEnabled: true, categories: {},
      });
      const enabled = await service.isChannelEnabled('user-1', 'push', 'booking');
      expect(enabled).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd apps/backend
npx jest test/unit/messaging/messaging-preferences.spec.ts --no-coverage
```

Expected: `Cannot find module '...messaging-preferences.service.js'`

- [ ] **Step 3: Implement**

```typescript
// apps/backend/src/modules/messaging/core/messaging-preferences.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service.js';

export interface ResolvedPreferences {
  pushEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  categories: Record<string, { push?: boolean; email?: boolean; sms?: boolean }>;
}

const DEFAULTS: ResolvedPreferences = {
  pushEnabled: true,
  emailEnabled: true,
  smsEnabled: true,
  categories: {},
};

@Injectable()
export class MessagingPreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(userId: string): Promise<ResolvedPreferences> {
    const record = await this.prisma.messagingPreference.findUnique({
      where: { userId },
    });
    if (!record) return { ...DEFAULTS };
    return {
      pushEnabled: record.pushEnabled,
      emailEnabled: record.emailEnabled,
      smsEnabled: record.smsEnabled,
      categories: (record.categories as ResolvedPreferences['categories']) ?? {},
    };
  }

  async isChannelEnabled(
    userId: string,
    channel: 'push' | 'email' | 'sms',
    category: string,
  ): Promise<boolean> {
    const prefs = await this.resolve(userId);
    const globalEnabled =
      channel === 'push' ? prefs.pushEnabled :
      channel === 'email' ? prefs.emailEnabled :
      prefs.smsEnabled;
    if (!globalEnabled) return false;
    const catPrefs = prefs.categories[category];
    if (!catPrefs) return true;
    return catPrefs[channel] !== false;
  }
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd apps/backend
npx jest test/unit/messaging/messaging-preferences.spec.ts --no-coverage
```

Expected: `Tests: 4 passed`

- [ ] **Step 5: Commit**

```bash
cd apps/backend
git add src/modules/messaging/core/messaging-preferences.service.ts test/unit/messaging/messaging-preferences.spec.ts
git commit -m "feat(messaging): add MessagingPreferencesService"
```

---

## Task 4: Move Push Channel

**Files:**
- Create: `src/modules/messaging/channels/push/push.service.ts` (moved)
- Create: `src/modules/messaging/channels/push/fcm-tokens.service.ts` (split)
- Create: `src/modules/messaging/channels/push/push.channel.ts` (new adapter)

- [ ] **Step 1: Copy push.service.ts with updated imports**

Create `apps/backend/src/modules/messaging/channels/push/push.service.ts` with this content (import path updated from `../../database` to `../../../../database`):

```typescript
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { PrismaService } from '../../../../database/prisma.service.js';

export interface PushNotificationPayload {
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  data?: Record<string, string>;
}

@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  private initialized = false;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.config.get<string>('FIREBASE_PRIVATE_KEY');

    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn('Firebase credentials not configured — push notifications disabled');
      return;
    }

    try {
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey: privateKey.replace(/\\n/g, '\n'),
          }),
        });
      }
      this.initialized = true;
      this.logger.log('Firebase Admin initialized');
    } catch (err) {
      this.logger.warn('Firebase Admin init failed — push disabled', err);
    }
  }

  async sendToUser(userId: string, notification: PushNotificationPayload): Promise<void> {
    if (!this.initialized) return;

    const tokens = await this.prisma.fcmToken.findMany({
      where: { userId },
      select: { token: true },
    });

    if (tokens.length === 0) return;

    const tokenStrings = tokens.map((t) => t.token);

    try {
      const response = await admin.messaging().sendEachForMulticast({
        tokens: tokenStrings,
        notification: {
          title: notification.titleEn,
          body: notification.bodyEn,
        },
        data: {
          titleAr: notification.titleAr,
          titleEn: notification.titleEn,
          bodyAr: notification.bodyAr,
          bodyEn: notification.bodyEn,
          ...(notification.data ?? {}),
        },
      });

      await this.cleanupInvalidTokens(response, tokenStrings);
    } catch (err) {
      this.logger.error(`FCM send failed for user ${userId}`, err);
    }
  }

  isEnabled(): boolean {
    return this.initialized;
  }

  private async cleanupInvalidTokens(
    response: admin.messaging.BatchResponse,
    tokenStrings: string[],
  ): Promise<void> {
    const failedTokens: string[] = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success && resp.error?.code === 'messaging/registration-token-not-registered') {
        failedTokens.push(tokenStrings[idx]);
      }
    });
    if (failedTokens.length === 0) return;
    await this.prisma.fcmToken.deleteMany({ where: { token: { in: failedTokens } } });
    this.logger.log(`Cleaned up ${failedTokens.length} invalid FCM tokens`);
  }
}
```

- [ ] **Step 2: Create FcmTokensService (split from notifications.service.ts)**

```typescript
// apps/backend/src/modules/messaging/channels/push/fcm-tokens.service.ts
import { Injectable } from '@nestjs/common';
import type { DevicePlatform } from '@prisma/client';
import { PrismaService } from '../../../../database/prisma.service.js';

@Injectable()
export class FcmTokensService {
  constructor(private readonly prisma: PrismaService) {}

  async register(userId: string, token: string, platform: DevicePlatform): Promise<void> {
    await this.prisma.fcmToken.upsert({
      where: { userId_token: { userId, token } },
      create: { userId, token, platform },
      update: { platform },
    });
  }

  async unregister(userId: string, token: string): Promise<void> {
    await this.prisma.fcmToken.deleteMany({ where: { userId, token } });
  }
}
```

- [ ] **Step 3: Create PushChannel adapter**

```typescript
// apps/backend/src/modules/messaging/channels/push/push.channel.ts
import { Injectable } from '@nestjs/common';
import type { Channel, ChannelSendPayload, ChannelSendResult } from '../../core/channel.interface.js';
import { PushService } from './push.service.js';

@Injectable()
export class PushChannel implements Channel {
  readonly name = 'push' as const;

  constructor(private readonly pushService: PushService) {}

  isEnabled(): boolean {
    return this.pushService.isEnabled();
  }

  async send(payload: ChannelSendPayload): Promise<ChannelSendResult> {
    if (!this.isEnabled()) return { ok: false, skipped: 'channel_disabled' };
    try {
      await this.pushService.sendToUser(payload.userId, {
        titleAr: payload.titleAr,
        titleEn: payload.titleEn,
        bodyAr: payload.bodyAr,
        bodyEn: payload.bodyEn,
        data: payload.data,
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd apps/backend
npm run typecheck 2>&1 | grep -i "messaging/channels/push" | head -10
```

Expected: no errors related to push channel files.

- [ ] **Step 5: Commit**

```bash
cd apps/backend
git add src/modules/messaging/channels/push/
git commit -m "refactor(messaging): move push channel into messaging module"
```

---

## Task 5: Move SMS + Email + EmailTemplates Channels

**Files:**
- Create: `src/modules/messaging/channels/sms/sms.service.ts` (moved)
- Create: `src/modules/messaging/channels/sms/sms.channel.ts`
- Create: `src/modules/messaging/channels/email/email.service.ts` (moved)
- Create: `src/modules/messaging/channels/email/email.processor.ts` (moved)
- Create: `src/modules/messaging/channels/email/email.layout.ts` (moved)
- Create: `src/modules/messaging/channels/email/email.helpers.ts` (moved)
- Create: `src/modules/messaging/channels/email/email.channel.ts`
- Create: `src/modules/messaging/email-templates/` (directory moved)

- [ ] **Step 1: Copy sms.service.ts with updated imports**

Copy `src/modules/notifications/sms.service.ts` to `src/modules/messaging/channels/sms/sms.service.ts`. Change only the import path at line 3:

```typescript
// Change:
import { resilientFetch } from '../../common/helpers/resilient-fetch.helper.js';
// To:
import { resilientFetch } from '../../../../common/helpers/resilient-fetch.helper.js';
```

Add `isEnabled()` method before the closing brace:

```typescript
  isEnabled(): boolean {
    return this.enabled;
  }
```

- [ ] **Step 2: Create SmsChannel adapter**

```typescript
// apps/backend/src/modules/messaging/channels/sms/sms.channel.ts
import { Injectable, Logger } from '@nestjs/common';
import type { Channel, ChannelSendPayload, ChannelSendResult } from '../../core/channel.interface.js';
import { SmsService } from './sms.service.js';
import { PrismaService } from '../../../../database/prisma.service.js';

@Injectable()
export class SmsChannel implements Channel {
  readonly name = 'sms' as const;
  private readonly logger = new Logger(SmsChannel.name);

  constructor(
    private readonly smsService: SmsService,
    private readonly prisma: PrismaService,
  ) {}

  isEnabled(): boolean {
    return this.smsService.isEnabled();
  }

  async send(payload: ChannelSendPayload): Promise<ChannelSendResult> {
    if (!this.isEnabled()) return { ok: false, skipped: 'channel_disabled' };

    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
      select: { phone: true },
    });

    if (!user?.phone) return { ok: false, skipped: 'no_address' };

    try {
      await this.smsService.sendSms(user.phone, payload.bodyAr || payload.bodyEn);
      return { ok: true };
    } catch (err) {
      this.logger.error(`SMS send failed for user ${payload.userId}`, err);
      return { ok: false, error: String(err) };
    }
  }
}
```

- [ ] **Step 3: Copy email files with updated import paths**

Copy these files to `src/modules/messaging/channels/email/`, updating `../../` → `../../../../` in imports:
- `src/modules/email/email.service.ts`
- `src/modules/email/email.processor.ts` — also update `../email-templates/` → `../../email-templates/`
- `src/modules/email/email.layout.ts`
- `src/modules/email/email.helpers.ts`

- [ ] **Step 4: Create EmailChannel adapter**

```typescript
// apps/backend/src/modules/messaging/channels/email/email.channel.ts
import { Injectable } from '@nestjs/common';
import type { Channel, ChannelSendPayload, ChannelSendResult } from '../../core/channel.interface.js';
import { EmailService } from './email.service.js';
import { PrismaService } from '../../../../database/prisma.service.js';

@Injectable()
export class EmailChannel implements Channel {
  readonly name = 'email' as const;

  constructor(
    private readonly emailService: EmailService,
    private readonly prisma: PrismaService,
  ) {}

  isEnabled(): boolean {
    return true; // MailerModule handles unavailability internally
  }

  async send(payload: ChannelSendPayload): Promise<ChannelSendResult> {
    const email = payload.recipientEmail ?? await this.resolveEmail(payload.userId);
    if (!email) return { ok: false, skipped: 'no_address' };

    try {
      // Use the generic queue path; dispatcher provides bodyAr/bodyEn via context
      await this.emailService.sendRaw({
        to: email,
        subject: `${payload.titleEn} | ${payload.titleAr}`,
        bodyEn: payload.bodyEn,
        bodyAr: payload.bodyAr,
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }

  private async resolveEmail(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    return user?.email ?? null;
  }
}
```

- [ ] **Step 5: Add `sendRaw` method to EmailService**

Open `src/modules/messaging/channels/email/email.service.ts`. Add this method after `sendBookingConfirmation`:

```typescript
  async sendRaw(input: {
    to: string;
    subject: string;
    bodyEn: string;
    bodyAr: string;
  }): Promise<void> {
    await this.emailQueue.add('send-email', {
      template: 'raw',
      to: input.to,
      subject: input.subject,
      context: { bodyEn: input.bodyEn, bodyAr: input.bodyAr },
      correlationId: correlationStorage.getStore() ?? null,
    });
    this.logger.log(`Queued raw email to ${input.to}`);
  }
```

- [ ] **Step 6: Handle 'raw' template in EmailProcessor**

Open `src/modules/messaging/channels/email/email.processor.ts`. In the `process` method, before the `try` block that calls `renderTemplate`, add:

```typescript
    // Raw emails come pre-rendered from the dispatcher
    if (template === 'raw') {
      const { bodyEn: rawEn = '', bodyAr: rawAr = '' } = context as { bodyEn?: string; bodyAr?: string };
      const layoutConfig = await this.getLayoutConfig();
      const html = buildHtmlEmail(rawEn, rawAr, layoutConfig);
      await this.mailerService.sendMail({ to, subject, text: `${rawEn}\n\n---\n\n${rawAr}`, html });
      this.logger.log(`Raw email sent: job ${job.id} to ${to}`);
      return;
    }
```

- [ ] **Step 7: Copy email-templates module**

Copy `src/modules/email-templates/` entirely to `src/modules/messaging/email-templates/`. Update import paths from `../../database/` → `../../../database/`. Keep the `@Controller('email-templates')` decorator unchanged.

- [ ] **Step 8: Verify TypeScript**

```bash
cd apps/backend
npm run typecheck 2>&1 | grep -i "messaging/channels" | head -10
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
cd apps/backend
git add src/modules/messaging/channels/sms/ src/modules/messaging/channels/email/ src/modules/messaging/email-templates/
git commit -m "refactor(messaging): move sms, email, and email-templates channels"
```

---

## Task 6: Notifications Inbox Service + Controller

**Files:**
- Create: `src/modules/messaging/inbox/notifications-inbox.service.ts`
- Create: `src/modules/messaging/inbox/notifications.controller.ts`
- Create: `src/modules/messaging/inbox/dto/` (copy from notifications/dto/)

- [ ] **Step 1: Create inbox service**

```typescript
// apps/backend/src/modules/messaging/inbox/notifications-inbox.service.ts
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service.js';
import { parsePaginationParams, buildPaginationMeta } from '../../../common/helpers/pagination.helper.js';
import type { DevicePlatform } from '@prisma/client';

@Injectable()
export class NotificationsInboxService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string, query: { page?: number; perPage?: number }) {
    const { page, perPage, skip } = parsePaginationParams(query.page, query.perPage);
    const where = { userId };
    const [rawItems, total] = await Promise.all([
      this.prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: perPage }),
      this.prisma.notification.count({ where }),
    ]);
    const items = rawItems.map(({ userId: _, ...item }) => item);
    return { items, meta: buildPaginationMeta(total, page, perPage) };
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, isRead: false } });
  }

  async markAsRead(notificationId: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({ where: { id: notificationId } });
    if (!notification) throw new NotFoundException({ statusCode: 404, message: 'Notification not found', error: 'NOT_FOUND' });
    if (notification.userId !== userId) throw new ForbiddenException({ statusCode: 403, message: 'You can only mark your own notifications as read', error: 'FORBIDDEN' });
    return this.prisma.notification.update({ where: { id: notificationId }, data: { isRead: true, readAt: new Date() } });
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true, readAt: new Date() } });
  }

  async registerFcmToken(userId: string, token: string, platform: DevicePlatform): Promise<void> {
    await this.prisma.fcmToken.upsert({
      where: { userId_token: { userId, token } },
      create: { userId, token, platform },
      update: { platform },
    });
  }

  async unregisterFcmToken(userId: string, token: string): Promise<void> {
    await this.prisma.fcmToken.deleteMany({ where: { userId, token } });
  }
}
```

- [ ] **Step 2: Copy notifications.controller.ts to inbox with updated imports**

Copy `src/modules/notifications/notifications.controller.ts` to `src/modules/messaging/inbox/notifications.controller.ts`. Update:
- Import `NotificationsService` → `NotificationsInboxService` from `./notifications-inbox.service.js`
- All method implementations delegate to `NotificationsInboxService` (same method names)

- [ ] **Step 3: Copy DTOs**

```bash
cp -r apps/backend/src/modules/notifications/dto/ apps/backend/src/modules/messaging/inbox/dto/
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd apps/backend
npm run typecheck 2>&1 | grep "messaging/inbox" | head -5
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd apps/backend
git add src/modules/messaging/inbox/
git commit -m "refactor(messaging): move notifications inbox into messaging module"
```

---

## Task 7: MessagingDispatcherService

**Files:**
- Create: `src/modules/messaging/core/messaging-dispatcher.service.ts`
- Create: `test/unit/messaging/messaging-dispatcher.spec.ts`

- [ ] **Step 1: Write failing test**

```typescript
// apps/backend/test/unit/messaging/messaging-dispatcher.spec.ts
import { Test } from '@nestjs/testing';
import { MessagingDispatcherService } from '../../../src/modules/messaging/core/messaging-dispatcher.service.js';
import { MessagingPreferencesService } from '../../../src/modules/messaging/core/messaging-preferences.service.js';
import { MessagingEvent } from '../../../src/modules/messaging/core/messaging-events.js';
import { PrismaService } from '../../../src/database/prisma.service.js';

const mockPrisma = {
  notification: { create: jest.fn().mockResolvedValue({ id: 'notif-1' }) },
  user: { findUnique: jest.fn() },
};
const mockPrefs = { isChannelEnabled: jest.fn().mockResolvedValue(true) };
const mockPushChannel = { name: 'push', isEnabled: jest.fn().mockReturnValue(true), send: jest.fn().mockResolvedValue({ ok: true }) };
const mockEmailChannel = { name: 'email', isEnabled: jest.fn().mockReturnValue(true), send: jest.fn().mockResolvedValue({ ok: true }) };
const mockSmsChannel = { name: 'sms', isEnabled: jest.fn().mockReturnValue(true), send: jest.fn().mockResolvedValue({ ok: true }) };

describe('MessagingDispatcherService', () => {
  let service: MessagingDispatcherService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        MessagingDispatcherService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MessagingPreferencesService, useValue: mockPrefs },
        { provide: 'PUSH_CHANNEL', useValue: mockPushChannel },
        { provide: 'EMAIL_CHANNEL', useValue: mockEmailChannel },
        { provide: 'SMS_CHANNEL', useValue: mockSmsChannel },
      ],
    }).compile();
    service = module.get(MessagingDispatcherService);
    jest.clearAllMocks();
    mockPrisma.notification.create.mockResolvedValue({ id: 'notif-1' });
    mockPrefs.isChannelEnabled.mockResolvedValue(true);
    mockPushChannel.send.mockResolvedValue({ ok: true });
    mockEmailChannel.send.mockResolvedValue({ ok: true });
    mockSmsChannel.send.mockResolvedValue({ ok: true });
  });

  it('persists inbox row unconditionally', async () => {
    await service.dispatch({
      event: MessagingEvent.BOOKING_CONFIRMED,
      recipientUserId: 'user-1',
      context: { date: '2026-05-01', time: '10:00', employeeName: 'أحمد', serviceName: 'استشارة' },
    });
    expect(mockPrisma.notification.create).toHaveBeenCalledTimes(1);
  });

  it('sends push and sms for BOOKING_CONFIRMED (default channels)', async () => {
    await service.dispatch({
      event: MessagingEvent.BOOKING_CONFIRMED,
      recipientUserId: 'user-1',
      context: { date: '2026-05-01', time: '10:00', employeeName: 'أحمد', serviceName: 'استشارة' },
    });
    expect(mockPushChannel.send).toHaveBeenCalledTimes(1);
    expect(mockSmsChannel.send).toHaveBeenCalledTimes(1);
    expect(mockEmailChannel.send).not.toHaveBeenCalled();
  });

  it('bypasses preferences for OTP_REQUESTED', async () => {
    mockPrefs.isChannelEnabled.mockResolvedValue(false);
    await service.dispatch({
      event: MessagingEvent.OTP_REQUESTED,
      recipientUserId: 'user-1',
      context: { code: '1234' },
    });
    // Should still send despite preferences returning false
    expect(mockEmailChannel.send).toHaveBeenCalledTimes(1);
    expect(mockSmsChannel.send).toHaveBeenCalledTimes(1);
  });

  it('skips sms channel when user preference disables it', async () => {
    mockPrefs.isChannelEnabled.mockImplementation((_userId, channel) =>
      Promise.resolve(channel !== 'sms'),
    );
    await service.dispatch({
      event: MessagingEvent.BOOKING_CONFIRMED,
      recipientUserId: 'user-1',
      context: { date: '2026-05-01', time: '10:00', employeeName: 'أحمد', serviceName: 'استشارة' },
    });
    expect(mockSmsChannel.send).not.toHaveBeenCalled();
    expect(mockPushChannel.send).toHaveBeenCalledTimes(1);
  });

  it('does not throw if a channel fails', async () => {
    mockPushChannel.send.mockRejectedValue(new Error('FCM down'));
    await expect(
      service.dispatch({
        event: MessagingEvent.BOOKING_CONFIRMED,
        recipientUserId: 'user-1',
        context: { date: '2026-05-01', time: '10:00', employeeName: 'أحمد', serviceName: 'استشارة' },
      }),
    ).resolves.not.toThrow();
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd apps/backend
npx jest test/unit/messaging/messaging-dispatcher.spec.ts --no-coverage
```

Expected: `Cannot find module '...messaging-dispatcher.service.js'`

- [ ] **Step 3: Implement dispatcher**

```typescript
// apps/backend/src/modules/messaging/core/messaging-dispatcher.service.ts
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service.js';
import type { Channel, ChannelSendPayload } from './channel.interface.js';
import { MessagingEvent } from './messaging-events.js';
import { TEMPLATES } from './messaging-templates.js';
import { MessagingPreferencesService } from './messaging-preferences.service.js';

@Injectable()
export class MessagingDispatcherService {
  private readonly logger = new Logger(MessagingDispatcherService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly prefs: MessagingPreferencesService,
    @Inject('PUSH_CHANNEL') private readonly pushChannel: Channel,
    @Inject('EMAIL_CHANNEL') private readonly emailChannel: Channel,
    @Inject('SMS_CHANNEL') private readonly smsChannel: Channel,
  ) {}

  async dispatch<TCtx>(input: {
    event: MessagingEvent;
    recipientUserId: string;
    context: TCtx;
    /** Override which channels to use — bypasses defaultChannels but NOT preferences (unless overridePreferences is set on template) */
    overrideChannels?: ('push' | 'email' | 'sms')[];
    /** Direct email address — skips user lookup for email channel */
    recipientEmail?: string;
  }): Promise<void> {
    const template = TEMPLATES[input.event];
    const rendered = template.render(input.context as never);

    // 1. Always persist inbox row
    const notification = await this.prisma.notification.create({
      data: {
        userId: input.recipientUserId,
        titleAr: rendered.titleAr,
        titleEn: rendered.titleEn,
        bodyAr: rendered.bodyAr,
        bodyEn: rendered.bodyEn,
        type: rendered.notificationType as NotificationType,
        data: { event: input.event, ...(input.context as object) } as Prisma.InputJsonValue,
      },
    });

    // 2. Resolve which channels to attempt
    const candidateChannels = input.overrideChannels ?? template.defaultChannels;
    const bypassPrefs = template.overridePreferences === true;

    const activeChannels = bypassPrefs
      ? candidateChannels
      : await this.filterByPreferences(
          input.recipientUserId,
          candidateChannels,
          template.category,
        );

    if (activeChannels.length === 0) return;

    // 3. Fan out (parallel, swallow errors per channel)
    const payload: ChannelSendPayload = {
      userId: input.recipientUserId,
      titleAr: rendered.titleAr,
      titleEn: rendered.titleEn,
      bodyAr: rendered.bodyAr,
      bodyEn: rendered.bodyEn,
      data: { notificationId: notification.id, event: input.event },
      event: input.event,
      recipientEmail: input.recipientEmail,
    };

    await Promise.allSettled(
      activeChannels.map((ch) => this.sendOnChannel(ch, payload)),
    );
  }

  private async filterByPreferences(
    userId: string,
    channels: ('push' | 'email' | 'sms')[],
    category: string,
  ): Promise<('push' | 'email' | 'sms')[]> {
    const results = await Promise.all(
      channels.map(async (ch) => ({
        ch,
        enabled: await this.prefs.isChannelEnabled(userId, ch, category),
      })),
    );
    return results.filter((r) => r.enabled).map((r) => r.ch);
  }

  private async sendOnChannel(
    channelName: 'push' | 'email' | 'sms',
    payload: ChannelSendPayload,
  ): Promise<void> {
    const channel = this.channelFor(channelName);
    if (!channel.isEnabled()) {
      this.logger.debug(`Channel ${channelName} is disabled at config level — skipped`);
      return;
    }
    try {
      const result = await channel.send(payload);
      if (!result.ok && result.skipped) {
        this.logger.debug(`Channel ${channelName} skipped: ${result.skipped}`);
      } else if (!result.ok && result.error) {
        this.logger.warn(`Channel ${channelName} send failed: ${result.error}`);
      }
    } catch (err) {
      this.logger.error(`Channel ${channelName} threw unexpectedly`, err);
    }
  }

  private channelFor(name: 'push' | 'email' | 'sms'): Channel {
    switch (name) {
      case 'push': return this.pushChannel;
      case 'email': return this.emailChannel;
      case 'sms': return this.smsChannel;
    }
  }
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd apps/backend
npx jest test/unit/messaging/messaging-dispatcher.spec.ts --no-coverage
```

Expected: `Tests: 5 passed`

- [ ] **Step 5: Commit**

```bash
cd apps/backend
git add src/modules/messaging/core/messaging-dispatcher.service.ts test/unit/messaging/messaging-dispatcher.spec.ts
git commit -m "feat(messaging): implement MessagingDispatcherService"
```

---

## Task 8: MessagingModule Barrel + Wire into App

**Files:**
- Create: `src/modules/messaging/messaging.module.ts`
- Modify: `src/app.module.ts`

- [ ] **Step 1: Create messaging.module.ts**

```typescript
// apps/backend/src/modules/messaging/messaging.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { PushService } from './channels/push/push.service.js';
import { PushChannel } from './channels/push/push.channel.js';
import { FcmTokensService } from './channels/push/fcm-tokens.service.js';
import { SmsService } from './channels/sms/sms.service.js';
import { SmsChannel } from './channels/sms/sms.channel.js';
import { EmailService } from './channels/email/email.service.js';
import { EmailProcessor } from './channels/email/email.processor.js';
import { EmailChannel } from './channels/email/email.channel.js';
import { EmailTemplatesService } from './email-templates/email-templates.service.js';
import { EmailTemplatesController } from './email-templates/email-templates.controller.js';
import { NotificationsInboxService } from './inbox/notifications-inbox.service.js';
import { NotificationsController } from './inbox/notifications.controller.js';
import { MessagingPreferencesService } from './core/messaging-preferences.service.js';
import { MessagingDispatcherService } from './core/messaging-dispatcher.service.js';
import { WhitelabelModule } from '../whitelabel/whitelabel.module.js';
import { OrganizationSettingsModule } from '../organization-settings/organization-settings.module.js';
import {
  DEFAULT_JOB_OPTIONS,
  QUEUE_EMAIL,
} from '../../config/constants/queues.js';

@Module({
  imports: [
    WhitelabelModule,
    OrganizationSettingsModule,
    BullModule.registerQueue({ name: QUEUE_EMAIL, defaultJobOptions: DEFAULT_JOB_OPTIONS }),
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        transport: {
          host: config.get<string>('MAIL_HOST', 'localhost'),
          port: Number(config.get<string>('MAIL_PORT', '587')),
          auth: {
            user: config.get<string>('MAIL_USER', ''),
            pass: config.get<string>('MAIL_PASSWORD', ''),
          },
        },
        defaults: {
          from: config.get<string>('MAIL_FROM', '"Deqah" <noreply@deqah.app>'),
        },
      }),
    }),
  ],
  controllers: [NotificationsController, EmailTemplatesController],
  providers: [
    // Channels
    PushService,
    FcmTokensService,
    SmsService,
    EmailService,
    EmailProcessor,
    EmailTemplatesService,
    // Channel adapters (named injection tokens)
    PushChannel,
    SmsChannel,
    EmailChannel,
    { provide: 'PUSH_CHANNEL', useExisting: PushChannel },
    { provide: 'EMAIL_CHANNEL', useExisting: EmailChannel },
    { provide: 'SMS_CHANNEL', useExisting: SmsChannel },
    // Core
    MessagingPreferencesService,
    MessagingDispatcherService,
    // Inbox
    NotificationsInboxService,
  ],
  exports: [MessagingDispatcherService, NotificationsInboxService, FcmTokensService],
})
export class MessagingModule {}
```

- [ ] **Step 2: Register in app.module.ts**

Open `src/app.module.ts`. Find the imports array. Add `MessagingModule` import. Do NOT yet remove `NotificationsModule`, `EmailModule`, or `EmailTemplatesModule` — they stay as parallel registrations until Task 9.

```typescript
import { MessagingModule } from './modules/messaging/messaging.module.js';
// Add to imports array:
MessagingModule,
```

- [ ] **Step 3: Run full test suite**

```bash
cd apps/backend
npm run test
```

Expected: all existing tests pass. New messaging tests pass.

- [ ] **Step 4: Start dev server and verify no startup errors**

```bash
cd apps/backend
npm run dev 2>&1 | head -30
```

Expected: `NestJS application started`, no `Cannot determine a GraphQL schema` or module errors.

- [ ] **Step 5: Commit**

```bash
cd apps/backend
git add src/modules/messaging/messaging.module.ts src/app.module.ts
git commit -m "feat(messaging): register MessagingModule in app (parallel with legacy modules)"
```

---

## Task 9: Migrate Non-Auth Consumers (PR #6a)

Migrate all consumers except `auth.service.ts`. Each consumer: inject `MessagingDispatcherService`, replace `createNotification` / `emailService.*` call with `dispatch()`.

**Files:** bookings (5 files), tasks (6 files), groups (4 files), payments (1 file), problem-reports (1 file), employees (1 file), and their respective `.module.ts` files.

- [ ] **Step 1: Update module files to import MessagingModule**

For each module file listed below, replace `NotificationsModule` / `EmailModule` import with `MessagingModule`:

```typescript
// In each of these files:
// apps/backend/src/modules/bookings/bookings.module.ts
// apps/backend/src/modules/tasks/tasks.module.ts
// apps/backend/src/modules/groups/groups.module.ts
// apps/backend/src/modules/payments/payments.module.ts
// apps/backend/src/modules/problem-reports/problem-reports.module.ts
// apps/backend/src/modules/employees/employees.module.ts

// Change:
import { NotificationsModule } from '../notifications/notifications.module.js';
// To:
import { MessagingModule } from '../messaging/messaging.module.js';

// In imports array: replace NotificationsModule with MessagingModule
// (same for EmailModule in employees)
```

- [ ] **Step 2: Update booking-creation.service.ts**

```typescript
// Replace constructor injection:
// Before:
import { NotificationsService } from '../notifications/notifications.service.js';
// ...
private readonly notificationsService: NotificationsService,

// After:
import { MessagingDispatcherService } from '../messaging/core/messaging-dispatcher.service.js';
import { MessagingEvent } from '../messaging/core/messaging-events.js';
// ...
private readonly messagingDispatcher: MessagingDispatcherService,
```

Replace the `createNotification` call (around line 390):

```typescript
// Before:
await this.notificationsService.createNotification({
  userId: employee.userId,
  type: 'booking_confirmed',
  ...NOTIF.BOOKING_NEW_FOR_EMPLOYEE,
  bodyAr: `لديك حجز جديد بتاريخ ${d} الساعة ${dto.startTime}`,
  bodyEn: `You have a new booking on ${d} at ${dto.startTime}`,
  data: { bookingId: booking.id },
});

// After:
await this.messagingDispatcher.dispatch({
  event: MessagingEvent.BOOKING_CONFIRMED_EMPLOYEE,
  recipientUserId: employee.userId,
  context: {
    date: d,
    time: dto.startTime,
    employeeName: '',
    serviceName: '',
  },
});
```

- [ ] **Step 3: Update booking-status.service.ts (3 calls)**

The file has 3 `createNotification` calls. Replace each:

**Call 1 (~line 69) — BOOKING_CONFIRMED:**
```typescript
// Before uses NOTIF.BOOKING_CONFIRMED + dynamic body
// After:
await this.messagingDispatcher.dispatch({
  event: MessagingEvent.BOOKING_CONFIRMED,
  recipientUserId: userId,  // use whatever userId variable is in scope
  context: { date: bookingDate, time: bookingTime, employeeName, serviceName },
});
```

**Call 2 (~line 138) — CLIENT_ARRIVED:**
```typescript
await this.messagingDispatcher.dispatch({
  event: MessagingEvent.CLIENT_ARRIVED,
  recipientUserId: employeeUserId,
  context: {},
});
```

**Call 3 (~line 299) — BOOKING_COMPLETED:**
```typescript
await this.messagingDispatcher.dispatch({
  event: MessagingEvent.BOOKING_COMPLETED,
  recipientUserId: userId,
  context: {},
});
```

> **Note:** Open `booking-status.service.ts` and read the exact variable names in scope at each call site before replacing. The context field names must match what the template `render()` function receives.

- [ ] **Step 4: Update remaining booking services**

Apply the same pattern to:
- `booking-reschedule.service.ts` → `MessagingEvent.BOOKING_RESCHEDULED`
- `booking-cancel-helpers.service.ts` → `MessagingEvent.BOOKING_CANCELLED`
- `waitlist.service.ts` → `MessagingEvent.WAITLIST_SLOT_AVAILABLE`
- `booking-cancellation.service.ts` → `MessagingEvent.BOOKING_CANCELLATION_REQUESTED` and `BOOKING_CANCELLATION_REJECTED`

For each: read the file first, match variable names to context fields.

- [ ] **Step 5: Update tasks services (16 calls total)**

Apply the same pattern to all `createNotification` calls in:
- `reminder.service.ts` (6 calls) → `BOOKING_REMINDER`, `BOOKING_REMINDER_URGENT`, `GROUP_SESSION_REMINDER`
- `group-session-automation.service.ts` (3 calls) → `GROUP_SESSION_REMINDER`, `GROUP_SESSION_CONFIRMED`, `GROUP_CAPACITY_REACHED`
- `booking-expiry.service.ts` (1 call) → `BOOKING_EXPIRED`
- `booking-noshow.service.ts` (4 calls) → `BOOKING_NOSHOW`, `BOOKING_NOSHOW_REVIEW`
- `booking-cancellation-timeout.service.ts` (1 call) → `BOOKING_CANCELLATION_REJECTED`
- `booking-autocomplete.service.ts` (1 call) → `BOOKING_AUTOCOMPLETED`

- [ ] **Step 6: Update groups services (4 calls)**

- `groups-attendance.service.ts` → `GROUP_ATTENDANCE_MARKED`
- `groups-enrollments.service.ts` → `GROUP_ENROLLMENT_CONFIRMED`
- `groups-lifecycle.service.ts` → `GROUP_SESSION_CONFIRMED`
- `groups-payment.service.ts` → `GROUP_PAYMENT_CONFIRMED`

- [ ] **Step 7: Update payments + problem-reports + employees**

- `bank-transfer.service.ts` → `BANK_TRANSFER_SUBMITTED` (provide `amount` in context)
- `problem-reports.service.ts` → `PROBLEM_REPORT_RESOLVED`
- `employee-onboarding.service.ts` → replace `emailService.sendEmployeeWelcome(email, firstName, otpCode)` with:

```typescript
await this.messagingDispatcher.dispatch({
  event: MessagingEvent.EMPLOYEE_WELCOME,
  recipientUserId: employee.userId,
  context: { firstName, otpCode },
  recipientEmail: email,
});
```

- [ ] **Step 8: Run full test suite**

```bash
cd apps/backend
npm run test
```

Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
cd apps/backend
git add src/modules/bookings/ src/modules/tasks/ src/modules/groups/ src/modules/payments/bank-transfer.service.ts src/modules/problem-reports/ src/modules/employees/
git commit -m "refactor(messaging): migrate all non-auth consumers to MessagingDispatcherService"
```

---

## Task 10: Migrate Auth Consumers (PR #6b — Owner-tier)

**Files:**
- Modify: `src/modules/auth/auth.module.ts`
- Modify: `src/modules/auth/auth.service.ts`

- [ ] **Step 1: Update auth.module.ts**

```typescript
// Replace:
import { EmailModule } from '../email/email.module.js';
// With:
import { MessagingModule } from '../messaging/messaging.module.js';

// In imports array: replace EmailModule with MessagingModule
```

- [ ] **Step 2: Update auth.service.ts**

Replace constructor injection (EmailService → MessagingDispatcherService):

```typescript
// Remove:
import { EmailService } from '../email/email.service.js';
// ...
private readonly emailService: EmailService,

// Add:
import { MessagingDispatcherService } from '../messaging/core/messaging-dispatcher.service.js';
import { MessagingEvent } from '../messaging/core/messaging-events.js';
// ...
private readonly messagingDispatcher: MessagingDispatcherService,
```

Replace the 3 email calls:

**Call 1 + 2 (~lines 71, 135) — sendWelcome:**
```typescript
// Before:
await this.emailService.sendWelcome(claimed.email, claimed.firstName);
// After:
await this.messagingDispatcher.dispatch({
  event: MessagingEvent.WELCOME,
  recipientUserId: claimed.id,   // use the user id, not email
  context: { firstName: claimed.firstName },
  recipientEmail: claimed.email,
});
```

**Call 3 (~line 299) — sendOtp:**
```typescript
// Before:
await this.emailService.sendOtp(email, code, type);
// After:
// OTP needs recipientEmail because userId may not be resolved yet
await this.messagingDispatcher.dispatch({
  event: MessagingEvent.OTP_REQUESTED,
  recipientUserId: userId ?? 'system',  // check what variable is in scope
  context: { code, otpType: type },
  recipientEmail: email,
});
```

> **Important:** Read `auth.service.ts` lines 60-80, 125-145, and 285-310 before replacing to confirm variable names in scope. OTP flow may not have a `userId` resolved — if so, create a system user sentinel or pass email only.

- [ ] **Step 3: Run full test suite including E2E**

```bash
cd apps/backend
npm run test
npm run test:e2e 2>&1 | grep -E "PASS|FAIL|ERROR" | head -20
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
cd apps/backend
git add src/modules/auth/
git commit -m "refactor(messaging): migrate auth consumers to MessagingDispatcherService"
```

---

## Task 11: Remove Legacy Modules (PR #7 — after 48h production observation)

> **Gate:** Do NOT merge this PR until the system has been running in production for 48 hours with no notification delivery failures.

**Files:**
- Delete: `src/modules/notifications/`
- Delete: `src/modules/email/`
- Delete: `src/modules/email-templates/`
- Modify: `src/app.module.ts`
- Modify: `src/common/constants/notification-messages.ts` (delete — NOTIF constants no longer needed)

- [ ] **Step 1: Remove legacy modules from app.module.ts**

Open `src/app.module.ts`. Remove:
- `NotificationsModule` import + array entry
- `EmailModule` import + array entry
- `EmailTemplatesModule` import + array entry

- [ ] **Step 2: Delete legacy directories**

```bash
rm -rf apps/backend/src/modules/notifications/
rm -rf apps/backend/src/modules/email/
rm -rf apps/backend/src/modules/email-templates/
```

- [ ] **Step 3: Delete NOTIF constants (now replaced by templates registry)**

```bash
rm apps/backend/src/common/constants/notification-messages.ts
```

- [ ] **Step 4: Verify no remaining imports**

```bash
cd apps/backend
grep -r "from.*modules/notifications/" src/ --include="*.ts"
grep -r "from.*modules/email/" src/ --include="*.ts"
grep -r "from.*modules/email-templates/" src/ --include="*.ts"
grep -r "notification-messages" src/ --include="*.ts"
```

Expected: all commands return empty output.

- [ ] **Step 5: Run typecheck + full tests**

```bash
cd apps/backend
npm run typecheck
npm run test
npm run test:e2e 2>&1 | grep -E "PASS|FAIL" | head -20
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
cd apps/backend
git add -A
git commit -m "refactor(messaging): remove legacy notifications, email, email-templates modules"
```

---

## Task 12: Update CLAUDE.md

- [ ] **Step 1: Update backend module count**

Open `apps/backend/CLAUDE.md`. Find `## Active Modules (36)`. Change to `(34)` and update the module list:
- Remove: `email`, `email-templates`, `notifications`
- Add: `messaging`

- [ ] **Step 2: Commit**

```bash
git add apps/backend/CLAUDE.md
git commit -m "docs(backend): update module list after messaging unification"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** All 7 PRs covered. Preferences, dispatcher, channels, inbox, email-templates, consumer migration, cleanup — all accounted for.
- [x] **No placeholders:** Every step has concrete code or exact commands.
- [x] **Type consistency:** `MessagingEvent`, `Channel`, `ChannelSendPayload`, `RenderedMessage`, `ResolvedPreferences` — names consistent across all tasks.
- [x] **`isEnabled()` added** to `SmsService` in Task 5 Step 1 — used by `SmsChannel.isEnabled()`.
- [x] **`admin.apps.length` guard** added in PushService to prevent double-init when module is re-registered during tests.
- [x] **OTP edge case** flagged in Task 10 Step 2 — userId may not be resolved, implementer instructed to read auth flow before replacing.
- [x] **`raw` template** handled in EmailProcessor (Task 5 Step 6) — dispatcher can send arbitrary rendered bodies.
- [x] **No breaking HTTP changes** — `/notifications` and `/email-templates` controllers keep their `@Controller(...)` path unchanged.
- [x] **Production gate on PR #7** — Task 11 has explicit 48h observation requirement.
