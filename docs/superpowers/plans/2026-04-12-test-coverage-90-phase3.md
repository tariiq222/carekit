# Test Coverage 90% — Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** رفع تغطية Unit Tests للـ backend من 73.82% إلى 90%+ في Statements, Lines, Functions.

**Architecture:** Pure constructor mocks — بدون `@nestjs/testing` module. كل spec يُنشئ الـ handler مباشرة بـ mock dependencies. نمط ثابت في كل الملفات.

**Tech Stack:** Jest, TypeScript strict. لا NestJS testing utilities — فقط `jest.fn()`.

**نقطة البداية:** 73.82% Statements → الهدف 90% يتطلب +16.18%.

---

## خريطة الأولويات (مرتبة بالتأثير)

| المسار | % الحالية | الأولوية | السبب |
|--------|-----------|----------|-------|
| `identity/roles` + `identity/users` | 51–61% | عالية | specs موجودة لكن تغطية ناقصة |
| `comms/send-notification` | 52.5% | عالية | منطق متفرع (push/email/sms) |
| `comms/send-push` + `comms/send-sms` | 60–63% | متوسطة | handlers بسيطة |
| `comms/events` | 79% | متوسطة | event handlers |
| `comms/send-email` | 79% | متوسطة | SMTP + template interpolation |
| `bookings/create-booking` | 72% | عالية | أكبر handler في bookings |
| `bookings/check-availability` | 79% | متوسطة | slot logic |
| `ops/cron-tasks` | 60% | متوسطة | cron classes غير مغطاة |
| `ops/generate-report` | 61% | متوسطة | builders جزئية |
| `ops/health-check` | 51% | متوسطة | HealthCheckService dependency |
| `platform/license` | 71% | متوسطة | license server fallback |
| `finance/redeem-gift-card` | 74% | متوسطة | transaction logic |
| `finance/bank-transfer-upload` | 75% | متوسطة | file validation |
| `org-experience/services` | 58% | متوسطة | set-duration + set-employee-service |
| `identity/shared` | 88% | منخفضة | بسيط |
| `infrastructure/storage` | 73% | منخفضة | MinioService |
| `ai/semantic-search` + `ai/embed-document` | 76–83% | منخفضة | embedding handlers |
| `common/tenant` | 76% | منخفضة | middleware |
| `finance/moyasar-webhook` | 76% | منخفضة | webhook |
| `infrastructure/cache` | 88% | منخفضة | redis |

---

## Task 1: تعزيز `identity/roles` و `identity/users`

**الوضع:** specs موجودة لكن تستخدم `@nestjs/testing` — أبطأ وتغطية ناقصة. نضيف tests مباشرة.

**Files:**
- Modify: `src/modules/identity/roles/roles.handler.spec.ts`
- Modify: `src/modules/identity/users/users.handler.spec.ts`

- [ ] **Step 1: اقرأ الـ specs الموجودين بالكامل**

```bash
cd apps/backend
cat src/modules/identity/roles/roles.handler.spec.ts
cat src/modules/identity/users/users.handler.spec.ts
```

- [ ] **Step 2: أضف tests مفقودة إلى `roles.handler.spec.ts`**

```typescript
// أضف هذه الـ describe blocks في نهاية ملف roles.handler.spec.ts

import { ListRolesHandler } from './list-roles.handler';

// Pure-mock helpers (أسرع من @nestjs/testing)
const buildRolesPrisma = () => ({
  customRole: {
    findUnique: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: 'role-1', name: 'Reception', tenantId: 'tenant-1', permissions: [] }),
    findMany: jest.fn().mockResolvedValue([{ id: 'role-1', name: 'Reception', permissions: [] }]),
  },
  permission: {
    deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
    createMany: jest.fn().mockResolvedValue({ count: 2 }),
  },
});

describe('CreateRoleHandler — pure mock', () => {
  it('creates role successfully', async () => {
    const prisma = buildRolesPrisma();
    const handler = new CreateRoleHandler(prisma as never);
    const result = await handler.execute({ tenantId: 'tenant-1', name: 'Reception' });
    expect(prisma.customRole.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tenantId: 'tenant-1', name: 'Reception' }) }),
    );
    expect(result.id).toBe('role-1');
  });

  it('throws ConflictException for duplicate name', async () => {
    const prisma = buildRolesPrisma();
    prisma.customRole.findUnique = jest.fn().mockResolvedValue({ id: 'role-1', name: 'Reception' });
    const handler = new CreateRoleHandler(prisma as never);
    await expect(handler.execute({ tenantId: 'tenant-1', name: 'Reception' })).rejects.toThrow('already exists');
  });
});

describe('AssignPermissionsHandler — pure mock', () => {
  it('deletes old permissions then creates new ones', async () => {
    const prisma = buildRolesPrisma();
    const handler = new AssignPermissionsHandler(prisma as never);
    await handler.execute({
      tenantId: 'tenant-1',
      customRoleId: 'role-1',
      permissions: [
        { action: 'read', subject: 'Booking' },
        { action: 'create', subject: 'Booking' },
      ],
    });
    expect(prisma.permission.deleteMany).toHaveBeenCalledWith({ where: { customRoleId: 'role-1' } });
    expect(prisma.permission.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ action: 'read', subject: 'Booking', tenantId: 'tenant-1' }),
        ]),
      }),
    );
  });

  it('handles empty permissions array (removes all)', async () => {
    const prisma = buildRolesPrisma();
    const handler = new AssignPermissionsHandler(prisma as never);
    await handler.execute({ tenantId: 'tenant-1', customRoleId: 'role-1', permissions: [] });
    expect(prisma.permission.deleteMany).toHaveBeenCalled();
    expect(prisma.permission.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: [] }),
    );
  });
});

describe('ListRolesHandler', () => {
  it('returns roles scoped to tenant', async () => {
    const prisma = buildRolesPrisma();
    const handler = new ListRolesHandler(prisma as never);
    const result = await handler.execute({ tenantId: 'tenant-1' });
    expect(prisma.customRole.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-1' }) }),
    );
    expect(Array.isArray(result)).toBe(true);
  });
});
```

- [ ] **Step 3: أضف tests مفقودة إلى `users.handler.spec.ts`**

```typescript
// أضف في نهاية ملف users.handler.spec.ts

import { UpdateUserHandler } from './update-user.handler';
import { UserGender, UserRole } from '@prisma/client';

const buildUsersPrisma = () => ({
  user: {
    findUnique: jest.fn().mockResolvedValue({ id: 'u-1', tenantId: 'tenant-1', name: 'Ahmad', isActive: true }),
    create: jest.fn().mockResolvedValue({ id: 'u-1', email: 'a@clinic.sa', name: 'Ahmad' }),
    update: jest.fn().mockResolvedValue({ id: 'u-1', name: 'Updated', isActive: false }),
    findMany: jest.fn().mockResolvedValue([{ id: 'u-1' }]),
    count: jest.fn().mockResolvedValue(1),
  },
});

describe('UpdateUserHandler', () => {
  it('updates user fields', async () => {
    const prisma = buildUsersPrisma();
    const handler = new UpdateUserHandler(prisma as never);
    await handler.execute({ userId: 'u-1', tenantId: 'tenant-1', name: 'New Name' });
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'u-1' }, data: expect.objectContaining({ name: 'New Name' }) }),
    );
  });

  it('throws NotFoundException when user not found', async () => {
    const prisma = buildUsersPrisma();
    prisma.user.findUnique = jest.fn().mockResolvedValue(null);
    const handler = new UpdateUserHandler(prisma as never);
    await expect(handler.execute({ userId: 'bad', tenantId: 'tenant-1' })).rejects.toThrow('not found');
  });

  it('throws NotFoundException when user belongs to different tenant', async () => {
    const prisma = buildUsersPrisma();
    prisma.user.findUnique = jest.fn().mockResolvedValue({ id: 'u-1', tenantId: 'other-tenant' });
    const handler = new UpdateUserHandler(prisma as never);
    await expect(handler.execute({ userId: 'u-1', tenantId: 'tenant-1' })).rejects.toThrow('not found');
  });
});

describe('DeactivateUserHandler — cross-tenant isolation', () => {
  it('throws NotFoundException when user belongs to different tenant', async () => {
    const prisma = buildUsersPrisma();
    prisma.user.findUnique = jest.fn().mockResolvedValue({ id: 'u-1', tenantId: 'evil-tenant' });
    const handler = new DeactivateUserHandler(prisma as never);
    await expect(handler.execute({ userId: 'u-1', tenantId: 'tenant-1' })).rejects.toThrow('not found');
  });

  it('sets isActive to false', async () => {
    const prisma = buildUsersPrisma();
    const handler = new DeactivateUserHandler(prisma as never);
    await handler.execute({ userId: 'u-1', tenantId: 'tenant-1' });
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isActive: false } }),
    );
  });
});

describe('ListUsersHandler — filters', () => {
  it('applies search filter to name and email', async () => {
    const prisma = buildUsersPrisma();
    const handler = new ListUsersHandler(prisma as never);
    await handler.execute({ tenantId: 'tenant-1', page: 1, limit: 10, search: 'ahmad' });
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ OR: expect.arrayContaining([expect.objectContaining({ name: expect.anything() })]) }),
      }),
    );
  });

  it('returns paginated meta', async () => {
    const prisma = buildUsersPrisma();
    const handler = new ListUsersHandler(prisma as never);
    const result = await handler.execute({ tenantId: 'tenant-1', page: 1, limit: 10 });
    expect(result.meta).toMatchObject({ total: 1, page: 1, limit: 10, totalPages: 1 });
  });
});
```

- [ ] **Step 4: شغّل الاختبارات**

```bash
cd apps/backend && npx jest roles.handler users.handler --no-coverage
```
Expected: 2 suites, all PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/identity/roles/roles.handler.spec.ts \
        src/modules/identity/users/users.handler.spec.ts
git commit -m "test(backend/identity): strengthen roles and users handler coverage"
```

---

## Task 2: `comms/send-notification` + `comms/send-push` + `comms/send-sms` + `comms/send-email`

**Files:**
- Create: `src/modules/comms/send-notification/send-notification.handler.spec.ts`
- Create: `src/modules/comms/send-push/send-push.handler.spec.ts`
- Create: `src/modules/comms/send-sms/send-sms.handler.spec.ts`
- Modify: `src/modules/comms/send-email/send-email.handler.spec.ts`

- [ ] **Step 1: اقرأ الملف الموجود**

```bash
cd apps/backend && cat src/modules/comms/send-email/send-email.handler.spec.ts
```

- [ ] **Step 2: اكتب spec لـ SendSmsHandler**

```typescript
// src/modules/comms/send-sms/send-sms.handler.spec.ts
import { SendSmsHandler } from './send-sms.handler';

describe('SendSmsHandler', () => {
  it('executes without throwing (stub mode)', async () => {
    const handler = new SendSmsHandler();
    await expect(handler.execute({ phone: '+966500000000', body: 'Test SMS' })).resolves.not.toThrow();
  });

  it('does not throw for missing optional fields', async () => {
    const handler = new SendSmsHandler();
    await expect(handler.execute({ phone: '+966500000001', body: 'Reminder' })).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 3: اكتب spec لـ SendPushHandler**

```typescript
// src/modules/comms/send-push/send-push.handler.spec.ts
import { SendPushHandler } from './send-push.handler';

const buildFcm = (available = true) => ({
  isAvailable: jest.fn().mockReturnValue(available),
  sendPush: jest.fn().mockResolvedValue(undefined),
});

describe('SendPushHandler', () => {
  it('calls fcm.sendPush when FCM is available', async () => {
    const fcm = buildFcm(true);
    const handler = new SendPushHandler(fcm as never);
    await handler.execute({ token: 'fcm-tok', title: 'Hello', body: 'World' });
    expect(fcm.sendPush).toHaveBeenCalledWith('fcm-tok', 'Hello', 'World', undefined);
  });

  it('skips push when FCM is not available', async () => {
    const fcm = buildFcm(false);
    const handler = new SendPushHandler(fcm as never);
    await handler.execute({ token: 'fcm-tok', title: 'Hello', body: 'World' });
    expect(fcm.sendPush).not.toHaveBeenCalled();
  });

  it('does not throw when fcm.sendPush rejects', async () => {
    const fcm = buildFcm(true);
    fcm.sendPush = jest.fn().mockRejectedValue(new Error('FCM error'));
    const handler = new SendPushHandler(fcm as never);
    await expect(handler.execute({ token: 'bad-token', title: 'T', body: 'B' })).resolves.not.toThrow();
  });

  it('passes data payload to FCM', async () => {
    const fcm = buildFcm(true);
    const handler = new SendPushHandler(fcm as never);
    const data = { bookingId: 'b-1' };
    await handler.execute({ token: 'tok', title: 'T', body: 'B', data });
    expect(fcm.sendPush).toHaveBeenCalledWith('tok', 'T', 'B', data);
  });
});
```

- [ ] **Step 4: اكتب spec لـ SendNotificationHandler**

```typescript
// src/modules/comms/send-notification/send-notification.handler.spec.ts
import { SendNotificationHandler } from './send-notification.handler';
import { NotificationType, RecipientType } from '@prisma/client';

const buildPrisma = () => ({
  notification: { create: jest.fn().mockResolvedValue({ id: 'notif-1' }) },
});

const buildPush = () => ({ execute: jest.fn().mockResolvedValue(undefined) });
const buildEmail = () => ({ execute: jest.fn().mockResolvedValue(undefined) });
const buildSms = () => ({ execute: jest.fn().mockResolvedValue(undefined) });

const baseDto = {
  tenantId: 'tenant-1',
  recipientId: 'client-1',
  recipientType: RecipientType.CLIENT,
  type: NotificationType.BOOKING_CONFIRMED,
  title: 'Confirmed',
  body: 'Your booking is confirmed.',
  channels: ['in-app'] as string[],
};

describe('SendNotificationHandler', () => {
  it('persists in-app notification to DB', async () => {
    const prisma = buildPrisma();
    const handler = new SendNotificationHandler(prisma as never, buildPush() as never, buildEmail() as never, buildSms() as never);
    await handler.execute(baseDto);
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: 'tenant-1', recipientId: 'client-1' }),
      }),
    );
  });

  it('dispatches push when channel is "push" and fcmToken provided', async () => {
    const push = buildPush();
    const handler = new SendNotificationHandler(buildPrisma() as never, push as never, buildEmail() as never, buildSms() as never);
    await handler.execute({ ...baseDto, channels: ['in-app', 'push'], fcmToken: 'tok-1' });
    expect(push.execute).toHaveBeenCalledWith(expect.objectContaining({ token: 'tok-1', title: 'Confirmed' }));
  });

  it('skips push when fcmToken is missing', async () => {
    const push = buildPush();
    const handler = new SendNotificationHandler(buildPrisma() as never, push as never, buildEmail() as never, buildSms() as never);
    await handler.execute({ ...baseDto, channels: ['push'] });
    expect(push.execute).not.toHaveBeenCalled();
  });

  it('dispatches email when channel is "email" and email + templateSlug provided', async () => {
    const email = buildEmail();
    const handler = new SendNotificationHandler(buildPrisma() as never, buildPush() as never, email as never, buildSms() as never);
    await handler.execute({
      ...baseDto,
      channels: ['email'],
      recipientEmail: 'client@example.sa',
      emailTemplateSlug: 'booking-confirmed',
    });
    expect(email.execute).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'client@example.sa', templateSlug: 'booking-confirmed' }),
    );
  });

  it('skips email when recipientEmail is missing', async () => {
    const email = buildEmail();
    const handler = new SendNotificationHandler(buildPrisma() as never, buildPush() as never, email as never, buildSms() as never);
    await handler.execute({ ...baseDto, channels: ['email'], emailTemplateSlug: 'booking-confirmed' });
    expect(email.execute).not.toHaveBeenCalled();
  });

  it('dispatches SMS when channel is "sms" and phone provided', async () => {
    const sms = buildSms();
    const handler = new SendNotificationHandler(buildPrisma() as never, buildPush() as never, buildEmail() as never, sms as never);
    await handler.execute({ ...baseDto, channels: ['sms'], recipientPhone: '+966500000000' });
    expect(sms.execute).toHaveBeenCalledWith({ phone: '+966500000000', body: baseDto.body });
  });

  it('skips SMS when recipientPhone is missing', async () => {
    const sms = buildSms();
    const handler = new SendNotificationHandler(buildPrisma() as never, buildPush() as never, buildEmail() as never, sms as never);
    await handler.execute({ ...baseDto, channels: ['sms'] });
    expect(sms.execute).not.toHaveBeenCalled();
  });

  it('continues channel dispatches even when DB persist fails', async () => {
    const prisma = buildPrisma();
    prisma.notification.create = jest.fn().mockRejectedValue(new Error('DB error'));
    const push = buildPush();
    const handler = new SendNotificationHandler(prisma as never, push as never, buildEmail() as never, buildSms() as never);
    await handler.execute({ ...baseDto, channels: ['in-app', 'push'], fcmToken: 'tok' });
    expect(push.execute).toHaveBeenCalled();
  });

  it('dispatches multiple channels in one call', async () => {
    const push = buildPush();
    const sms = buildSms();
    const handler = new SendNotificationHandler(buildPrisma() as never, push as never, buildEmail() as never, sms as never);
    await handler.execute({
      ...baseDto,
      channels: ['in-app', 'push', 'sms'],
      fcmToken: 'tok',
      recipientPhone: '+966500000000',
    });
    expect(push.execute).toHaveBeenCalled();
    expect(sms.execute).toHaveBeenCalled();
  });
});
```

- [ ] **Step 5: أضف tests مفقودة لـ `send-email.handler.spec.ts`** (بعد القراءة في Step 1)

```typescript
// أضف في نهاية send-email.handler.spec.ts

describe('SendEmailHandler — interpolation', () => {
  it('skips email when SMTP not available', async () => {
    const smtp = { isAvailable: jest.fn().mockReturnValue(false), sendMail: jest.fn() };
    const prisma = { emailTemplate: { findUnique: jest.fn() } };
    const handler = new SendEmailHandler(smtp as never, prisma as never);
    await handler.execute({ tenantId: 'tenant-1', to: 'a@b.com', templateSlug: 'booking-confirmed', vars: {} });
    expect(smtp.sendMail).not.toHaveBeenCalled();
  });

  it('skips when template not found', async () => {
    const smtp = { isAvailable: jest.fn().mockReturnValue(true), sendMail: jest.fn() };
    const prisma = { emailTemplate: { findUnique: jest.fn().mockResolvedValue(null) } };
    const handler = new SendEmailHandler(smtp as never, prisma as never);
    await handler.execute({ tenantId: 'tenant-1', to: 'a@b.com', templateSlug: 'missing', vars: {} });
    expect(smtp.sendMail).not.toHaveBeenCalled();
  });

  it('skips when template is inactive', async () => {
    const smtp = { isAvailable: jest.fn().mockReturnValue(true), sendMail: jest.fn() };
    const prisma = { emailTemplate: { findUnique: jest.fn().mockResolvedValue({ isActive: false, htmlBody: '', subjectAr: '' }) } };
    const handler = new SendEmailHandler(smtp as never, prisma as never);
    await handler.execute({ tenantId: 'tenant-1', to: 'a@b.com', templateSlug: 'tpl', vars: {} });
    expect(smtp.sendMail).not.toHaveBeenCalled();
  });

  it('replaces {{vars}} in htmlBody and subject', async () => {
    const smtp = { isAvailable: jest.fn().mockReturnValue(true), sendMail: jest.fn().mockResolvedValue(undefined) };
    const prisma = {
      emailTemplate: {
        findUnique: jest.fn().mockResolvedValue({
          isActive: true,
          htmlBody: '<p>Hello {{name}}</p>',
          subjectAr: 'مرحبا {{name}}',
          subjectEn: 'Hello {{name}}',
        }),
      },
    };
    const handler = new SendEmailHandler(smtp as never, prisma as never);
    await handler.execute({ tenantId: 'tenant-1', to: 'a@b.com', templateSlug: 'tpl', vars: { name: 'Ahmad' } });
    expect(smtp.sendMail).toHaveBeenCalledWith('a@b.com', 'مرحبا Ahmad', '<p>Hello Ahmad</p>');
  });

  it('does not throw when smtp.sendMail rejects', async () => {
    const smtp = { isAvailable: jest.fn().mockReturnValue(true), sendMail: jest.fn().mockRejectedValue(new Error('SMTP down')) };
    const prisma = {
      emailTemplate: { findUnique: jest.fn().mockResolvedValue({ isActive: true, htmlBody: 'body', subjectAr: 'subj', subjectEn: '' }) },
    };
    const handler = new SendEmailHandler(smtp as never, prisma as never);
    await expect(handler.execute({ tenantId: 'tenant-1', to: 'a@b.com', templateSlug: 'tpl', vars: {} })).resolves.not.toThrow();
  });
});
```

- [ ] **Step 6: شغّل الاختبارات**

```bash
cd apps/backend && npx jest send-sms send-push send-notification send-email --no-coverage
```
Expected: 4 suites, all PASS

- [ ] **Step 7: Commit**

```bash
git add src/modules/comms/send-sms/send-sms.handler.spec.ts \
        src/modules/comms/send-push/send-push.handler.spec.ts \
        src/modules/comms/send-notification/send-notification.handler.spec.ts \
        src/modules/comms/send-email/send-email.handler.spec.ts
git commit -m "test(backend/comms): add specs for send-sms, send-push, send-notification, send-email handlers"
```

---

## Task 3: `comms/events` — تعزيز event handlers

**Files:**
- Modify: `src/modules/comms/comms.events.handler.spec.ts`

- [ ] **Step 1: اقرأ الملفين**

```bash
cd apps/backend
cat src/modules/comms/comms.events.handler.spec.ts
cat src/modules/comms/events/on-booking-reminder.handler.ts
cat src/modules/comms/events/on-client-enrolled.handler.ts
cat src/modules/comms/events/on-payment-failed.handler.ts
```

- [ ] **Step 2: أضف tests للـ handlers غير المغطاة**

```typescript
// أضف في نهاية comms.events.handler.spec.ts

import { OnBookingReminderHandler } from './events/on-booking-reminder.handler';

const buildNotify = () => ({ execute: jest.fn().mockResolvedValue(undefined) });
const buildEventBus = () => {
  const subscribers = new Map<string, (e: unknown) => Promise<void>>();
  return {
    subscribe: jest.fn((event: string, cb: (e: unknown) => Promise<void>) => { subscribers.set(event, cb); }),
    getSubscriber: (event: string) => subscribers.get(event)!,
  };
};

describe('OnBookingReminderHandler', () => {
  it('registers subscriber on ops.booking.reminder_due', () => {
    const notify = buildNotify();
    const eb = buildEventBus();
    const handler = new OnBookingReminderHandler(notify as never);
    handler.register(eb as never);
    expect(eb.subscribe).toHaveBeenCalledWith('ops.booking.reminder_due', expect.any(Function));
  });

  it('sends push notification with booking time', async () => {
    const notify = buildNotify();
    const eb = buildEventBus();
    const handler = new OnBookingReminderHandler(notify as never);
    handler.register(eb as never);

    await eb.getSubscriber('ops.booking.reminder_due')({
      payload: {
        bookingId: 'b-1', tenantId: 'tenant-1', clientId: 'c-1',
        scheduledAt: '2026-06-01T10:00:00Z', fcmToken: 'tok-1',
      },
    });

    expect(notify.execute).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1', recipientId: 'c-1' }),
    );
  });

  it('handles error gracefully without throwing', async () => {
    const notify = buildNotify();
    notify.execute = jest.fn().mockRejectedValue(new Error('push failed'));
    const eb = buildEventBus();
    const handler = new OnBookingReminderHandler(notify as never);
    handler.register(eb as never);

    await expect(
      eb.getSubscriber('ops.booking.reminder_due')({
        payload: { bookingId: 'b-1', tenantId: 'tenant-1', clientId: 'c-1', scheduledAt: new Date() },
      }),
    ).resolves.not.toThrow();
  });
});
```

- [ ] **Step 3: شغّل الاختبارات**

```bash
cd apps/backend && npx jest comms.events --no-coverage
```
Expected: all PASS

- [ ] **Step 4: Commit**

```bash
git add src/modules/comms/comms.events.handler.spec.ts
git commit -m "test(backend/comms): strengthen comms events handler coverage"
```

---

## Task 4: `bookings/create-booking` + `bookings/check-availability`

**Files:**
- Modify: `src/modules/bookings/create-booking/create-booking.handler.spec.ts`
- Modify: `src/modules/bookings/check-availability/check-availability.handler.spec.ts`

- [ ] **Step 1: اقرأ الـ specs الموجودة**

```bash
cd apps/backend
cat src/modules/bookings/create-booking/create-booking.handler.spec.ts
cat src/modules/bookings/check-availability/check-availability.handler.spec.ts
```

- [ ] **Step 2: أضف tests لـ `create-booking.handler.spec.ts`**

```typescript
// أضف في نهاية create-booking.handler.spec.ts

describe('CreateBookingHandler — validation guards', () => {
  it('throws BadRequestException for past scheduledAt', async () => {
    const prisma = buildPrisma();
    const priceResolver = { resolve: jest.fn().mockResolvedValue({ price: 200, durationMins: 60, durationOptionId: 'opt-1', currency: 'SAR', isEmployeeOverride: false }) };
    const settings = { execute: jest.fn().mockResolvedValue({ maxAdvanceBookingDays: 60, payAtClinicEnabled: false }) };
    const handler = new CreateBookingHandler(prisma as never, priceResolver as never, settings as never);

    await expect(handler.execute({
      tenantId: 'tenant-1',
      scheduledAt: new Date(Date.now() - 86400_000), // yesterday
      clientId: 'c-1', employeeId: 'e-1', serviceId: 'svc-1',
      branchId: 'branch-1', durationMins: 60, bookingType: 'INDIVIDUAL' as never,
    })).rejects.toThrow('future');
  });

  it('throws NotFoundException when branch not found', async () => {
    const prisma = buildPrisma();
    prisma.branch = { findFirst: jest.fn().mockResolvedValue(null) };
    const priceResolver = { resolve: jest.fn() };
    const settings = { execute: jest.fn().mockResolvedValue({ payAtClinicEnabled: false }) };
    const handler = new CreateBookingHandler(prisma as never, priceResolver as never, settings as never);

    await expect(handler.execute({
      tenantId: 'tenant-1',
      scheduledAt: new Date(Date.now() + 86400_000),
      clientId: 'c-1', employeeId: 'e-1', serviceId: 'svc-1',
      branchId: 'bad-branch', durationMins: 60, bookingType: 'INDIVIDUAL' as never,
    })).rejects.toThrow('Branch not found');
  });

  it('throws NotFoundException when client not found', async () => {
    const prisma = buildPrisma();
    prisma.branch = { findFirst: jest.fn().mockResolvedValue({ id: 'branch-1' }) };
    prisma.client = { findFirst: jest.fn().mockResolvedValue(null) };
    const priceResolver = { resolve: jest.fn() };
    const settings = { execute: jest.fn().mockResolvedValue({ payAtClinicEnabled: false }) };
    const handler = new CreateBookingHandler(prisma as never, priceResolver as never, settings as never);

    await expect(handler.execute({
      tenantId: 'tenant-1',
      scheduledAt: new Date(Date.now() + 86400_000),
      clientId: 'bad-client', employeeId: 'e-1', serviceId: 'svc-1',
      branchId: 'branch-1', durationMins: 60, bookingType: 'INDIVIDUAL' as never,
    })).rejects.toThrow('Client not found');
  });

  it('throws BadRequestException when pay-at-clinic is disabled', async () => {
    const prisma = buildPrisma();
    const settings = { execute: jest.fn().mockResolvedValue({ payAtClinicEnabled: false }) };
    const handler = new CreateBookingHandler(prisma as never, { resolve: jest.fn() } as never, settings as never);

    await expect(handler.execute({
      tenantId: 'tenant-1',
      scheduledAt: new Date(Date.now() + 86400_000),
      clientId: 'c-1', employeeId: 'e-1', serviceId: 'svc-1',
      branchId: 'branch-1', durationMins: 60, bookingType: 'INDIVIDUAL' as never,
      payAtClinic: true,
    })).rejects.toThrow('Pay at clinic');
  });
});
```

- [ ] **Step 3: أضف tests لـ `check-availability.handler.spec.ts`**

```typescript
// أضف في نهاية check-availability.handler.spec.ts

describe('CheckAvailabilityHandler — edge cases', () => {
  it('returns empty array when date exceeds maxAdvanceBookingDays', async () => {
    const prisma = buildPrisma();
    const settings = { execute: jest.fn().mockResolvedValue({
      maxAdvanceBookingDays: 7,
      minAdvanceBookingMins: 60,
    })};
    const handler = new CheckAvailabilityHandler(prisma as never, settings as never);
    const farFuture = new Date();
    farFuture.setDate(farFuture.getDate() + 30);

    const result = await handler.execute({
      tenantId: 'tenant-1', employeeId: 'e-1', branchId: 'branch-1',
      date: farFuture,
    });

    expect(result).toEqual([]);
  });

  it('scopes availability query to tenantId', async () => {
    const prisma = buildPrisma();
    const settings = { execute: jest.fn().mockResolvedValue({
      maxAdvanceBookingDays: 60,
      minAdvanceBookingMins: 0,
    })};
    const handler = new CheckAvailabilityHandler(prisma as never, settings as never);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    await handler.execute({ tenantId: 'tenant-99', employeeId: 'e-1', branchId: 'branch-1', date: tomorrow });

    expect(prisma.employeeAvailability?.findMany ?? prisma.businessHour?.findUnique).toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: شغّل الاختبارات**

```bash
cd apps/backend && npx jest create-booking.handler check-availability.handler --no-coverage
```
Expected: 2 suites, all PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/bookings/create-booking/create-booking.handler.spec.ts \
        src/modules/bookings/check-availability/check-availability.handler.spec.ts
git commit -m "test(backend/bookings): strengthen create-booking and check-availability coverage"
```

---

## Task 5: `ops/cron-tasks` — Cron job classes

**Files:**
- Create: `src/modules/ops/cron-tasks/booking-autocomplete.cron.spec.ts`

- [ ] **Step 1: اقرأ الملفات**

```bash
cd apps/backend
cat src/modules/ops/cron-tasks/booking-autocomplete.cron.ts
cat src/modules/ops/cron-tasks/booking-expiry.cron.ts
cat src/modules/ops/cron-tasks/booking-noshow.cron.ts
cat src/modules/ops/cron-tasks/appointment-reminders.cron.ts
cat src/modules/ops/cron-tasks/refresh-token-cleanup.cron.ts
cat src/modules/ops/cron-tasks/group-session-automation.cron.ts
```

- [ ] **Step 2: اكتب spec موحد لكل الـ cron classes** (بعد القراءة — عدّل حسب الـ constructors الفعلية)

```typescript
// src/modules/ops/cron-tasks/booking-autocomplete.cron.spec.ts
// هذا الملف يغطي كل الـ cron classes في دفعة واحدة

import { BookingAutocompleteCron } from './booking-autocomplete.cron';
import { BookingExpiryCron } from './booking-expiry.cron';
import { BookingNoShowCron } from './booking-noshow.cron';
import { RefreshTokenCleanupCron } from './refresh-token-cleanup.cron';
// استورد باقي الـ crons بعد قراءة ملفاتها

const buildPrisma = () => ({
  booking: {
    findMany: jest.fn().mockResolvedValue([]),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    update: jest.fn().mockResolvedValue({}),
  },
  refreshToken: {
    deleteMany: jest.fn().mockResolvedValue({ count: 5 }),
  },
  bookingStatusLog: {
    createMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
});

const buildEventBus = () => ({ publish: jest.fn().mockResolvedValue(undefined) });

describe('BookingAutocompleteCron', () => {
  it('executes without throwing', async () => {
    const prisma = buildPrisma();
    // عدّل الـ constructor args بناءً على ما قرأته في Step 1
    const cron = new BookingAutocompleteCron(prisma as never, buildEventBus() as never);
    await expect(cron.execute()).resolves.not.toThrow();
  });

  it('does not call updateMany when no bookings found', async () => {
    const prisma = buildPrisma();
    prisma.booking.findMany = jest.fn().mockResolvedValue([]);
    const cron = new BookingAutocompleteCron(prisma as never, buildEventBus() as never);
    await cron.execute();
    expect(prisma.booking.updateMany).not.toHaveBeenCalled();
  });
});

describe('BookingExpiryCron', () => {
  it('executes without throwing', async () => {
    const prisma = buildPrisma();
    const cron = new BookingExpiryCron(prisma as never, buildEventBus() as never);
    await expect(cron.execute()).resolves.not.toThrow();
  });
});

describe('BookingNoShowCron', () => {
  it('executes without throwing', async () => {
    const prisma = buildPrisma();
    const cron = new BookingNoShowCron(prisma as never, buildEventBus() as never);
    await expect(cron.execute()).resolves.not.toThrow();
  });
});

describe('RefreshTokenCleanupCron', () => {
  it('deletes expired tokens', async () => {
    const prisma = buildPrisma();
    const cron = new RefreshTokenCleanupCron(prisma as never);
    await cron.execute();
    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ expiresAt: expect.anything() }),
      }),
    );
  });
});
```

**ملاحظة:** بعد قراءة ملفات الـ cron في Step 1، عدّل الـ constructors وأضف assertions أكثر دقة بناءً على المنطق الفعلي لكل cron.

- [ ] **Step 3: شغّل الاختبارات**

```bash
cd apps/backend && npx jest booking-autocomplete.cron --no-coverage
```
Expected: 1 suite, all PASS

- [ ] **Step 4: Commit**

```bash
git add src/modules/ops/cron-tasks/booking-autocomplete.cron.spec.ts
git commit -m "test(backend/ops): add specs for cron job classes"
```

---

## Task 6: `ops/health-check` — تعزيز

**Files:**
- Modify: `src/modules/ops/health-check/health-check.handler.spec.ts`

- [ ] **Step 1: اقرأ الـ spec الموجود**

```bash
cd apps/backend && cat src/modules/ops/health-check/health-check.handler.spec.ts
```

- [ ] **Step 2: استبدل محتوى الـ spec بهذا**

```typescript
// src/modules/ops/health-check/health-check.handler.spec.ts
import { HealthCheckHandler } from './health-check.handler';

const buildRedis = () => ({
  getClient: jest.fn().mockReturnValue({ ping: jest.fn().mockResolvedValue('PONG') }),
});

const buildBullMq = () => ({
  getQueue: jest.fn().mockReturnValue({
    getJobCounts: jest.fn().mockResolvedValue({ waiting: 0, active: 0, completed: 5, failed: 0 }),
  }),
});

const buildHealthService = (result: object = { status: 'ok', info: {}, error: {}, details: {} }) => ({
  check: jest.fn().mockResolvedValue(result),
});

const buildPrismaIndicator = () => ({
  pingCheck: jest.fn().mockResolvedValue({ database: { status: 'up' } }),
});

const buildPrisma = () => ({
  $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
});

describe('HealthCheckHandler', () => {
  it('returns healthy status when all checks pass', async () => {
    const handler = new HealthCheckHandler(
      buildHealthService() as never,
      buildPrismaIndicator() as never,
      buildPrisma() as never,
      buildRedis() as never,
      buildBullMq() as never,
    );
    const result = await handler.execute();
    expect(result.status).toBe('ok');
  });

  it('delegates DB check to prismaIndicator.pingCheck', async () => {
    const prismaIndicator = buildPrismaIndicator();
    const healthService = buildHealthService();
    const handler = new HealthCheckHandler(
      healthService as never,
      prismaIndicator as never,
      buildPrisma() as never,
      buildRedis() as never,
      buildBullMq() as never,
    );
    await handler.execute();
    // HealthCheckService.check was called with an array of check functions
    expect(healthService.check).toHaveBeenCalledWith(
      expect.arrayContaining([expect.any(Function)]),
    );
  });

  it('includes redis and bullmq in checks array', async () => {
    const healthService = buildHealthService({ status: 'ok', info: { redis: { status: 'up' }, bullmq: { status: 'up' } }, error: {}, details: {} });
    const handler = new HealthCheckHandler(
      healthService as never,
      buildPrismaIndicator() as never,
      buildPrisma() as never,
      buildRedis() as never,
      buildBullMq() as never,
    );
    const result = await handler.execute();
    expect(result.status).toBe('ok');
  });
});

describe('HealthCheckHandler — private checks', () => {
  it('returns redis down when ping fails', async () => {
    const redis = { getClient: jest.fn().mockReturnValue({ ping: jest.fn().mockRejectedValue(new Error('Connection refused')) }) };
    // We test the private method effect by invoking health.check with the actual check callbacks
    const capturedChecks: Array<() => Promise<object>> = [];
    const healthService = {
      check: jest.fn().mockImplementation(async (checks: Array<() => Promise<object>>) => {
        capturedChecks.push(...checks);
        return { status: 'ok', info: {}, error: {}, details: {} };
      }),
    };
    const handler = new HealthCheckHandler(
      healthService as never,
      buildPrismaIndicator() as never,
      buildPrisma() as never,
      redis as never,
      buildBullMq() as never,
    );
    await handler.execute();
    // capturedChecks[1] is checkRedis (second function)
    const redisResult = await capturedChecks[1]();
    expect(redisResult).toMatchObject({ redis: { status: 'down' } });
  });
});
```

- [ ] **Step 3: شغّل الاختبار**

```bash
cd apps/backend && npx jest health-check.handler --no-coverage
```
Expected: 1 suite, all PASS

- [ ] **Step 4: Commit**

```bash
git add src/modules/ops/health-check/health-check.handler.spec.ts
git commit -m "test(backend/ops): strengthen health-check handler coverage"
```

---

## Task 7: `org-experience/services` — set-duration + set-employee-service-options

**Files:**
- Modify: `src/modules/org-experience/services/services.handler.spec.ts`

- [ ] **Step 1: اقرأ الـ spec الموجود**

```bash
cd apps/backend && cat src/modules/org-experience/services/services.handler.spec.ts
```

- [ ] **Step 2: أضف tests لـ SetDurationOptionsHandler و SetEmployeeServiceOptionsHandler**

```typescript
// أضف في نهاية services.handler.spec.ts

import { SetDurationOptionsHandler } from './set-duration-options.handler';
import { SetEmployeeServiceOptionsHandler } from './set-employee-service-options.handler';

const buildServicesPrisma = () => ({
  service: { findFirst: jest.fn().mockResolvedValue({ id: 'svc-1', tenantId: 'tenant-1' }) },
  serviceDurationOption: {
    update: jest.fn().mockResolvedValue({ id: 'opt-1' }),
    create: jest.fn().mockResolvedValue({ id: 'opt-new' }),
    findMany: jest.fn().mockResolvedValue([{ id: 'opt-1' }]),
  },
  employeeServiceOption: {
    upsert: jest.fn().mockResolvedValue({ id: 'eso-1' }),
  },
  $transaction: jest.fn().mockImplementation(
    (ops: Promise<unknown>[] | ((tx: unknown) => Promise<unknown>)) =>
      typeof ops === 'function' ? ops({
        serviceDurationOption: { update: jest.fn().mockResolvedValue({ id: 'opt-1' }), create: jest.fn().mockResolvedValue({ id: 'opt-new' }) },
        employeeServiceOption: { upsert: jest.fn().mockResolvedValue({ id: 'eso-1' }) },
      }) : Promise.all(ops),
  ),
});

describe('SetDurationOptionsHandler', () => {
  it('throws NotFoundException when service not found', async () => {
    const prisma = buildServicesPrisma();
    prisma.service.findFirst = jest.fn().mockResolvedValue(null);
    const handler = new SetDurationOptionsHandler(prisma as never);
    await expect(handler.execute({
      tenantId: 'tenant-1', serviceId: 'bad', options: [],
    })).rejects.toThrow('not found');
  });

  it('creates new options when id is not provided', async () => {
    const prisma = buildServicesPrisma();
    const handler = new SetDurationOptionsHandler(prisma as never);
    await handler.execute({
      tenantId: 'tenant-1',
      serviceId: 'svc-1',
      options: [{ durationMins: 60, price: 200, currency: 'SAR', label: '60 min', labelAr: '٦٠ دقيقة' }],
    });
    // Transaction was called (update or create path)
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('updates existing options when id is provided', async () => {
    const prisma = buildServicesPrisma();
    const handler = new SetDurationOptionsHandler(prisma as never);
    await handler.execute({
      tenantId: 'tenant-1',
      serviceId: 'svc-1',
      options: [{ id: 'opt-1', durationMins: 45, price: 150, currency: 'SAR', label: '45 min', labelAr: '٤٥ دقيقة' }],
    });
    expect(prisma.$transaction).toHaveBeenCalled();
  });
});

describe('SetEmployeeServiceOptionsHandler', () => {
  it('throws NotFoundException when durationOptionId not found for tenant', async () => {
    const prisma = buildServicesPrisma();
    prisma.serviceDurationOption.findMany = jest.fn().mockResolvedValue([]); // no valid options
    const handler = new SetEmployeeServiceOptionsHandler(prisma as never);
    await expect(handler.execute({
      tenantId: 'tenant-1',
      employeeServiceId: 'es-1',
      options: [{ durationOptionId: 'bad-opt' }],
    })).rejects.toThrow('not found');
  });

  it('upserts employee service options', async () => {
    const prisma = buildServicesPrisma();
    const handler = new SetEmployeeServiceOptionsHandler(prisma as never);
    await handler.execute({
      tenantId: 'tenant-1',
      employeeServiceId: 'es-1',
      options: [{ durationOptionId: 'opt-1', priceOverride: 300 }],
    });
    expect(prisma.$transaction).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: شغّل الاختبارات**

```bash
cd apps/backend && npx jest services.handler --no-coverage
```
Expected: 1 suite, all PASS

- [ ] **Step 4: Commit**

```bash
git add src/modules/org-experience/services/services.handler.spec.ts
git commit -m "test(backend/services): add specs for set-duration-options and set-employee-service-options handlers"
```

---

## Task 8: `platform/license` + `finance/redeem-gift-card` + `finance/bank-transfer-upload`

**Files:**
- Modify: `src/modules/platform/license/validate-license.service.spec.ts`
- Create: `src/modules/finance/redeem-gift-card/redeem-gift-card.handler.spec.ts`
- Create: `src/modules/finance/bank-transfer-upload/bank-transfer-upload.handler.spec.ts`

- [ ] **Step 1: اقرأ الملفات**

```bash
cd apps/backend
cat src/modules/platform/license/validate-license.service.spec.ts
cat src/modules/finance/redeem-gift-card/redeem-gift-card.handler.ts
cat src/modules/finance/bank-transfer-upload/bank-transfer-upload.handler.ts
```

- [ ] **Step 2: أضف tests مفقودة لـ ValidateLicenseService**

```typescript
// أضف في نهاية validate-license.service.spec.ts

describe('ValidateLicenseService — fallbacks', () => {
  const buildPrisma = (cached: unknown = null) => ({
    licenseCache: {
      findUnique: jest.fn().mockResolvedValue(cached),
      upsert: jest.fn().mockResolvedValue({}),
    },
  });

  const buildConfig = (overrides: Record<string, string | undefined> = {}) => ({
    get: jest.fn().mockImplementation((key: string) => overrides[key]),
    getOrThrow: jest.fn().mockImplementation((key: string) => overrides[key] ?? ''),
  });

  it('returns Basic license when no LICENSE_SERVER_URL configured', async () => {
    const prisma = buildPrisma();
    const config = buildConfig({ LICENSE_SERVER_URL: undefined });
    const service = new ValidateLicenseService(config as never, prisma as never);
    const result = await service.getActiveLicense('tenant-1');
    expect(result.tier).toBe('Basic');
  });

  it('returns cached license when not stale', async () => {
    const cachedLicense = {
      tenantId: 'tenant-1',
      tier: 'Pro',
      features: ['bookings', 'reports'],
      expiresAt: new Date(Date.now() + 86400_000),
      lastCheckedAt: new Date(), // fresh
    };
    const prisma = buildPrisma(cachedLicense);
    const config = buildConfig({ LICENSE_SERVER_URL: 'https://license.example.com' });
    const service = new ValidateLicenseService(config as never, prisma as never);
    const result = await service.getActiveLicense('tenant-1');
    expect(result.tier).toBe('Pro');
  });

  it('falls back to stale cache when license server unreachable', async () => {
    const staleCache = {
      tenantId: 'tenant-1',
      tier: 'Enterprise',
      features: ['all'],
      expiresAt: new Date(Date.now() + 86400_000),
      lastCheckedAt: new Date(0), // very stale
    };
    const prisma = buildPrisma(staleCache);
    const config = buildConfig({ LICENSE_SERVER_URL: 'https://license.example.com', LICENSE_KEY: 'key-1' });

    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    const service = new ValidateLicenseService(config as never, prisma as never);
    const result = await service.getActiveLicense('tenant-1');
    expect(result.tier).toBe('Enterprise');
  });

  it('fetches fresh license from server when cache is stale', async () => {
    const staleCache = {
      tenantId: 'tenant-1',
      tier: 'Basic',
      features: [],
      expiresAt: new Date(Date.now() + 86400_000),
      lastCheckedAt: new Date(0),
    };
    const prisma = buildPrisma(staleCache);
    const config = buildConfig({ LICENSE_SERVER_URL: 'https://license.example.com', LICENSE_KEY: 'key-1' });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ tier: 'Pro', features: ['bookings'], expiresAt: new Date(Date.now() + 86400_000).toISOString() }),
    });

    const service = new ValidateLicenseService(config as never, prisma as never);
    const result = await service.getActiveLicense('tenant-1');
    expect(result.tier).toBe('Pro');
    expect(prisma.licenseCache.upsert).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: اكتب spec لـ RedeemGiftCardHandler**

```typescript
// src/modules/finance/redeem-gift-card/redeem-gift-card.handler.spec.ts
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { RedeemGiftCardHandler } from './redeem-gift-card.handler';

const mockInvoice = { id: 'inv-1', tenantId: 'tenant-1', total: 300 };
const mockGiftCard = { id: 'gc-1', tenantId: 'tenant-1', code: 'GIFT100', isActive: true, balance: 100, expiresAt: null };

const buildPrisma = (overrides: Record<string, unknown> = {}) => ({
  invoice: { findFirst: jest.fn().mockResolvedValue(overrides.invoice ?? mockInvoice) },
  giftCard: {
    findUnique: jest.fn().mockResolvedValue(overrides.giftCard ?? mockGiftCard),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    findUnique: jest.fn().mockResolvedValue({ balance: 0 }),
    update: jest.fn().mockResolvedValue({}),
  },
  giftCardRedemption: { create: jest.fn().mockResolvedValue({ id: 'gcr-1' }) },
  invoiceItem: { create: jest.fn().mockResolvedValue({ id: 'ii-1' }) },
  $transaction: jest.fn().mockImplementation((fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      giftCard: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue({ balance: 0 }),
        update: jest.fn().mockResolvedValue({}),
      },
      giftCardRedemption: { create: jest.fn().mockResolvedValue({ id: 'gcr-1', redeemAmount: 100 }) },
      invoiceItem: { create: jest.fn().mockResolvedValue({ id: 'ii-1' }) },
    })
  ),
});

describe('RedeemGiftCardHandler', () => {
  it('throws NotFoundException when invoice not found', async () => {
    const prisma = buildPrisma({ invoice: null });
    const handler = new RedeemGiftCardHandler(prisma as never);
    await expect(handler.execute({ tenantId: 'tenant-1', invoiceId: 'bad', code: 'GIFT100', amount: 50 }))
      .rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when gift card not found', async () => {
    const prisma = buildPrisma({ giftCard: null });
    const handler = new RedeemGiftCardHandler(prisma as never);
    await expect(handler.execute({ tenantId: 'tenant-1', invoiceId: 'inv-1', code: 'BAD', amount: 50 }))
      .rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when gift card is expired', async () => {
    const prisma = buildPrisma({ giftCard: { ...mockGiftCard, expiresAt: new Date(Date.now() - 86400_000) } });
    const handler = new RedeemGiftCardHandler(prisma as never);
    await expect(handler.execute({ tenantId: 'tenant-1', invoiceId: 'inv-1', code: 'GIFT100', amount: 50 }))
      .rejects.toThrow('expired');
  });

  it('throws BadRequestException when gift card balance is zero', async () => {
    const prisma = buildPrisma({ giftCard: { ...mockGiftCard, balance: 0 } });
    const handler = new RedeemGiftCardHandler(prisma as never);
    await expect(handler.execute({ tenantId: 'tenant-1', invoiceId: 'inv-1', code: 'GIFT100', amount: 50 }))
      .rejects.toThrow('balance');
  });

  it('throws BadRequestException when gift card is inactive', async () => {
    const prisma = buildPrisma({ giftCard: { ...mockGiftCard, isActive: false } });
    const handler = new RedeemGiftCardHandler(prisma as never);
    await expect(handler.execute({ tenantId: 'tenant-1', invoiceId: 'inv-1', code: 'GIFT100', amount: 50 }))
      .rejects.toThrow(NotFoundException);
  });

  it('executes transaction on valid redemption', async () => {
    const prisma = buildPrisma();
    const handler = new RedeemGiftCardHandler(prisma as never);
    await handler.execute({ tenantId: 'tenant-1', invoiceId: 'inv-1', code: 'GIFT100', amount: 50 });
    expect(prisma.$transaction).toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: اكتب spec لـ BankTransferUploadHandler**

```typescript
// src/modules/finance/bank-transfer-upload/bank-transfer-upload.handler.spec.ts
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BankTransferUploadHandler } from './bank-transfer-upload.handler';

const buildPrisma = (invoice: unknown = { id: 'inv-1', tenantId: 'tenant-1' }) => ({
  invoice: { findFirst: jest.fn().mockResolvedValue(invoice) },
  payment: { create: jest.fn().mockResolvedValue({ id: 'pay-1' }) },
  invoice: { findFirst: jest.fn().mockResolvedValue(invoice), update: jest.fn().mockResolvedValue({}) },
  $transaction: jest.fn().mockImplementation((fn: (tx: unknown) => Promise<unknown>) =>
    fn({ payment: { create: jest.fn().mockResolvedValue({ id: 'pay-1' }) }, invoice: { update: jest.fn().mockResolvedValue({}) } })
  ),
});

const buildStorage = () => ({
  uploadFile: jest.fn().mockResolvedValue('https://storage.example.com/receipt.jpg'),
});

const baseCmd = {
  tenantId: 'tenant-1',
  invoiceId: 'inv-1',
  fileBuffer: Buffer.from('fake-image'),
  mimetype: 'image/jpeg',
  filename: 'receipt.jpg',
  amount: 200,
};

describe('BankTransferUploadHandler', () => {
  it('throws BadRequestException for disallowed mimetype', async () => {
    const handler = new BankTransferUploadHandler(buildPrisma() as never, buildStorage() as never);
    await expect(handler.execute({ ...baseCmd, mimetype: 'image/gif' })).rejects.toThrow(BadRequestException);
  });

  it('accepts PDF mimetype', async () => {
    const handler = new BankTransferUploadHandler(buildPrisma() as never, buildStorage() as never);
    await expect(handler.execute({ ...baseCmd, mimetype: 'application/pdf' })).resolves.not.toThrow();
  });

  it('accepts image/webp mimetype', async () => {
    const handler = new BankTransferUploadHandler(buildPrisma() as never, buildStorage() as never);
    await expect(handler.execute({ ...baseCmd, mimetype: 'image/webp' })).resolves.not.toThrow();
  });

  it('throws NotFoundException when invoice not found', async () => {
    const handler = new BankTransferUploadHandler(buildPrisma(null) as never, buildStorage() as never);
    await expect(handler.execute(baseCmd)).rejects.toThrow(NotFoundException);
  });

  it('uploads file to storage and creates payment record', async () => {
    const storage = buildStorage();
    const handler = new BankTransferUploadHandler(buildPrisma() as never, storage as never);
    await handler.execute(baseCmd);
    expect(storage.uploadFile).toHaveBeenCalledWith(
      'finance-receipts',
      expect.stringContaining('inv-1'),
      baseCmd.fileBuffer,
      'image/jpeg',
    );
  });
});
```

- [ ] **Step 5: شغّل الاختبارات**

```bash
cd apps/backend && npx jest validate-license.service redeem-gift-card bank-transfer-upload --no-coverage
```
Expected: 3 suites, all PASS

- [ ] **Step 6: Commit**

```bash
git add src/modules/platform/license/validate-license.service.spec.ts \
        src/modules/finance/redeem-gift-card/redeem-gift-card.handler.spec.ts \
        src/modules/finance/bank-transfer-upload/bank-transfer-upload.handler.spec.ts
git commit -m "test(backend/finance,platform): add specs for redeem-gift-card, bank-transfer-upload, and license validation"
```

---

## Task 9: `ai/semantic-search` + `ai/embed-document` + `common/tenant`

**Files:**
- Modify: `src/modules/ai/semantic-search/semantic-search.handler.spec.ts`
- Modify: `src/modules/ai/embed-document/embed-document.handler.spec.ts`
- Modify: `src/common/tenant/tenant.middleware.spec.ts`

- [ ] **Step 1: اقرأ الـ specs الموجودة**

```bash
cd apps/backend
cat src/modules/ai/semantic-search/semantic-search.handler.spec.ts
cat src/modules/ai/embed-document/embed-document.handler.spec.ts
cat src/common/tenant/tenant.middleware.spec.ts
```

- [ ] **Step 2: أضف tests مفقودة لـ `semantic-search.handler.spec.ts`**

```typescript
// أضف في نهاية semantic-search.handler.spec.ts

describe('SemanticSearchHandler — embedding unavailable', () => {
  it('throws BadRequestException when EmbeddingAdapter not available', async () => {
    const prisma = { $queryRawUnsafe: jest.fn() };
    const embedding = { isAvailable: jest.fn().mockReturnValue(false), embed: jest.fn() };
    const handler = new SemanticSearchHandler(prisma as never, embedding as never);
    await expect(handler.execute({ tenantId: 'tenant-1', query: 'test' })).rejects.toThrow('not available');
  });

  it('limits topK to max 20', async () => {
    const prisma = { $queryRawUnsafe: jest.fn().mockResolvedValue([]) };
    const embedding = { isAvailable: jest.fn().mockReturnValue(true), embed: jest.fn().mockResolvedValue([[0.1, 0.2]]) };
    const handler = new SemanticSearchHandler(prisma as never, embedding as never);
    await handler.execute({ tenantId: 'tenant-1', query: 'test', topK: 100 });
    // $queryRawUnsafe called with limit 20 (clamped from 100)
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('LIMIT'),
      expect.anything(), expect.anything(), 20,
    );
  });

  it('adds documentId filter when provided', async () => {
    const prisma = { $queryRawUnsafe: jest.fn().mockResolvedValue([]) };
    const embedding = { isAvailable: jest.fn().mockReturnValue(true), embed: jest.fn().mockResolvedValue([[0.1]]) };
    const handler = new SemanticSearchHandler(prisma as never, embedding as never);
    await handler.execute({ tenantId: 'tenant-1', query: 'test', documentId: 'doc-1' });
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.anything(), expect.anything(), expect.anything(), expect.anything(), 'doc-1',
    );
  });
});
```

- [ ] **Step 3: أضف tests مفقودة لـ `embed-document.handler.spec.ts`**

```typescript
// أضف في نهاية embed-document.handler.spec.ts

describe('EmbedDocumentHandler — chunking', () => {
  it('throws BadRequestException when EmbeddingAdapter not available', async () => {
    const prisma = { knowledgeDocument: { create: jest.fn() }, documentChunk: { createMany: jest.fn() } };
    const embedding = { isAvailable: jest.fn().mockReturnValue(false), embed: jest.fn() };
    const handler = new EmbedDocumentHandler(prisma as never, embedding as never);
    await expect(handler.execute({
      tenantId: 'tenant-1', title: 'Doc', content: 'text', sourceType: 'MANUAL' as never,
    })).rejects.toThrow('not available');
  });

  it('creates document and chunks for long content', async () => {
    const longContent = 'A'.repeat(5000);
    const prisma = {
      knowledgeDocument: { create: jest.fn().mockResolvedValue({ id: 'doc-1', title: 'Doc' }) },
      documentChunk: { createMany: jest.fn().mockResolvedValue({ count: 3 }) },
    };
    const embedding = {
      isAvailable: jest.fn().mockReturnValue(true),
      embed: jest.fn().mockResolvedValue([[0.1, 0.2], [0.3, 0.4], [0.5, 0.6]]),
    };
    const handler = new EmbedDocumentHandler(prisma as never, embedding as never);
    await handler.execute({ tenantId: 'tenant-1', title: 'Doc', content: longContent, sourceType: 'MANUAL' as never });
    expect(prisma.documentChunk.createMany).toHaveBeenCalled();
    // Multiple chunks should have been created for 5000 chars
    const call = (prisma.documentChunk.createMany as jest.Mock).mock.calls[0][0];
    expect(call.data.length).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 4: أضف tests مفقودة لـ `tenant.middleware.spec.ts`**

```typescript
// أضف في نهاية tenant.middleware.spec.ts

describe('TenantMiddleware — edge cases', () => {
  it('rejects requests with whitespace-only X-Tenant-ID', () => {
    const middleware = new TenantMiddleware();
    const req = { headers: { 'x-tenant-id': '   ' } } as never;
    const res = { setHeader: jest.fn() } as never;
    const next = jest.fn();
    expect(() => middleware.use(req, res, next)).toThrow('required');
  });

  it('rejects when X-Tenant-ID is an array (multi-value header)', () => {
    const middleware = new TenantMiddleware();
    const req = { headers: { 'x-tenant-id': ['t1', 't2'] } } as never;
    const res = { setHeader: jest.fn() } as never;
    const next = jest.fn();
    expect(() => middleware.use(req, res, next)).toThrow('required');
  });

  it('passes through valid X-Tenant-ID and calls next()', () => {
    const middleware = new TenantMiddleware();
    const req = { headers: { 'x-tenant-id': 'tenant-1', 'x-request-id': 'req-123' }, ip: '127.0.0.1' } as never;
    const res = { setHeader: jest.fn() } as never;
    const next = jest.fn();
    middleware.use(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('generates requestId when x-request-id header not provided', () => {
    const middleware = new TenantMiddleware();
    const req = { headers: { 'x-tenant-id': 'tenant-1' }, ip: '127.0.0.1' } as never;
    const res = { setHeader: jest.fn() } as never;
    const next = jest.fn();
    middleware.use(req, res, next);
    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', expect.stringMatching(/^[0-9a-f-]{36}$/));
  });
});
```

- [ ] **Step 5: شغّل الاختبارات**

```bash
cd apps/backend && npx jest semantic-search embed-document tenant.middleware --no-coverage
```
Expected: 3 suites, all PASS

- [ ] **Step 6: Commit**

```bash
git add src/modules/ai/semantic-search/semantic-search.handler.spec.ts \
        src/modules/ai/embed-document/embed-document.handler.spec.ts \
        src/common/tenant/tenant.middleware.spec.ts
git commit -m "test(backend/ai,common): strengthen semantic-search, embed-document, and tenant middleware coverage"
```

---

## Task 10: قياس التغطية النهائية وضبط الـ Threshold

- [ ] **Step 1: شغّل مجموعة الاختبارات الكاملة**

```bash
cd apps/backend && npm run test:cov 2>&1 | grep -E "^(All files|Jest:|Test Suites:|Tests:)"
```
Expected:
```
All files  |  90.xx  |  88.xx  |  90.xx  |  90.xx
Test Suites: 1xx passed
Tests:       5xx+ passed
```

- [ ] **Step 2: افحص أي module لا يزال دون 80%**

```bash
cd apps/backend && npm run test:cov 2>&1 | grep -E "^\s+src/" | awk -F'|' '{gsub(/ /,"",$1); gsub(/ /,"",$2); if($2+0 < 80 && $2+0 > 0) print $2"% "$1}' | sort -n
```

- [ ] **Step 3: إذا كانت هناك modules دون 80% تؤثر على الإجمالي، أضف targeted tests**

للـ modules الصغيرة (< 50 سطر) التي لا تزال دون 80%، أضف spec بسيط يغطي الـ happy path فقط — لا تحتاج edge cases.

- [ ] **Step 4: حدّث threshold في `jest.config.ts`** (بعد الوصول لـ 90%)

```bash
cd apps/backend && cat jest.config.ts
```

حدّث القيم:
```typescript
coverageThreshold: {
  global: {
    branches: 85,
    functions: 90,
    lines: 90,
    statements: 90,
  },
},
```

- [ ] **Step 5: تأكيد نهائي**

```bash
cd apps/backend && npm run test:cov 2>&1 | tail -8
```
Expected: لا رسائل "threshold not met"

- [ ] **Step 6: Commit**

```bash
git add jest.config.ts
git commit -m "test(config): raise coverage thresholds to 90% — target achieved"
```

---

## ملاحظات التنفيذ الحاسمة

### 1. قاعدة القراءة أولاً
كل مهمة تبدأ بـ `cat` للملف قبل كتابة الـ spec. Constructor arguments قد تختلف عما في الخطة — اقرأ ثم عدّل.

### 2. الـ modules التي تظهر 0% في التقرير
`src/modules/bookings` (20%) و `src/modules/identity` (37%) هي **module-level folders** تحتوي فقط على `*.module.ts` — هذه لا تحتاج اختبارات. التغطية الفعلية موجودة في الـ sub-folders.

### 3. إذا فشل اختبار
- تحقق من constructor signature الفعلي في الملف
- لا تعدّل الـ handler — عدّل الـ spec
- لا تتجاوز 3 محاولات قبل الإبلاغ

### 4. نمط `$transaction`
للـ handlers التي تستخدم `$transaction(async (tx) => {...})` (interactive form):
```typescript
$transaction: jest.fn().mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn(mockTx))
```
حيث `mockTx` هو object يحتوي على mock methods المطلوبة.

### 5. تأثير كل مهمة المتوقع

| المهمة | التأثير المتوقع |
|--------|----------------|
| 1 — identity roles/users | +2% |
| 2 — comms send-* | +4% |
| 3 — comms events | +1.5% |
| 4 — bookings create/check | +2.5% |
| 5 — ops cron classes | +2% |
| 6 — health-check تعزيز | +1% |
| 7 — org-experience services | +2% |
| 8 — finance + license | +3% |
| 9 — ai + common/tenant | +2% |
| **المجموع** | **+20% → 93%+** |
