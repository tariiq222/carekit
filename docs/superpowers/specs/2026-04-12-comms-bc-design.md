# Comms BC — Design Spec

**Date:** 2026-04-12
**Status:** Approved
**Phase:** p9 (التواصل والإشعارات)
**Approach:** Separate Channel Slices + Notification Aggregator

---

## 1. Scope

Comms BC owns all outbound communication from CareKit:

- **Push notifications** (FCM)
- **Email** (SMTP + editable templates with branding variables)
- **SMS**
- **In-app notifications** (stored in DB)
- **Chat** (client ↔ employee or client ↔ AI — 1-on-1 only)
- **Email Templates** (per-tenant, editable from dashboard, branding-aware)

Runs in parallel with p7 (Finance) and p8 (Bookings) — no blocking dependencies. p7 and p8 are already done, so p9 starts immediately.

---

## 2. Prisma Schema (comms.prisma)

```prisma
// Comms BC — notifications, chat, email templates.
// Phase 9 (p9-t*).

enum NotificationType {
  BOOKING_CONFIRMED
  BOOKING_CANCELLED
  BOOKING_REMINDER
  PAYMENT_RECEIVED
  PAYMENT_FAILED
  WELCOME
  GENERAL
}

enum RecipientType {
  CLIENT
  EMPLOYEE
}

enum ConversationStatus {
  OPEN
  CLOSED
}

enum MessageSenderType {
  CLIENT
  EMPLOYEE
  AI
}

model Notification {
  id            String           @id @default(uuid())
  tenantId      String
  recipientId   String
  recipientType RecipientType
  type          NotificationType
  title         String
  body          String
  metadata      Json?
  isRead        Boolean          @default(false)
  readAt        DateTime?
  createdAt     DateTime         @default(now())

  @@index([tenantId, recipientId])
  @@index([tenantId, recipientId, isRead])
}

model ChatConversation {
  id            String             @id @default(uuid())
  tenantId      String
  clientId      String
  employeeId    String?            // null = AI chat
  isAiChat      Boolean            @default(false)
  status        ConversationStatus @default(OPEN)
  lastMessageAt DateTime?
  createdAt     DateTime           @default(now())
  updatedAt     DateTime           @updatedAt

  messages      ChatMessage[]

  @@index([tenantId, clientId])
  @@index([tenantId, employeeId])
}

model ChatMessage {
  id             String            @id @default(uuid())
  tenantId       String
  conversationId String
  conversation   ChatConversation  @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  senderType     MessageSenderType
  senderId       String?           // null for AI
  body           String
  isRead         Boolean           @default(false)
  createdAt      DateTime          @default(now())

  @@index([tenantId, conversationId])
}

model EmailTemplate {
  id        String   @id @default(uuid())
  tenantId  String
  slug      String   // e.g. "booking-confirmed", "welcome", "payment-failed"
  nameAr    String
  nameEn    String?
  subject   String
  htmlBody  String   // supports {{clinic_name}}, {{primary_color}}, {{logo_url}}, {{client_name}}, etc.
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([tenantId, slug])
  @@index([tenantId])
}
```

---

## 3. Folder Structure

```
modules/comms/
├── send-push/
│   ├── send-push.command.ts
│   ├── send-push.handler.ts
│   ├── send-push.dto.ts
│   └── send-push.handler.spec.ts
├── send-email/
│   ├── send-email.command.ts
│   ├── send-email.handler.ts
│   ├── send-email.dto.ts
│   └── send-email.handler.spec.ts
├── send-sms/
│   ├── send-sms.command.ts
│   ├── send-sms.handler.ts
│   ├── send-sms.dto.ts
│   └── send-sms.handler.spec.ts
├── send-notification/
│   ├── send-notification.command.ts
│   ├── send-notification.handler.ts
│   └── send-notification.handler.spec.ts
├── notifications/
│   ├── create-notification.command.ts
│   ├── create-notification.handler.ts
│   ├── list-notifications.query.ts
│   ├── list-notifications.handler.ts
│   ├── mark-read.command.ts
│   ├── mark-read.handler.ts
│   └── *.handler.spec.ts
├── chat/
│   ├── create-conversation.command.ts
│   ├── create-conversation.handler.ts
│   ├── create-chat-message.command.ts
│   ├── create-chat-message.handler.ts
│   ├── list-conversations.query.ts
│   ├── list-conversations.handler.ts
│   └── *.handler.spec.ts
├── email-templates/
│   ├── create-email-template.command.ts
│   ├── create-email-template.handler.ts
│   ├── update-email-template.command.ts
│   ├── update-email-template.handler.ts
│   ├── get-email-template.query.ts
│   ├── get-email-template.handler.ts
│   ├── list-email-templates.query.ts
│   ├── list-email-templates.handler.ts
│   └── *.handler.spec.ts
├── events/
│   ├── on-booking-cancelled.handler.ts
│   ├── on-booking-reminder.handler.ts
│   ├── on-payment-failed.handler.ts
│   └── on-client-enrolled.handler.ts
└── comms.module.ts
```

---

## 4. send-notification Aggregator

The central entry point for all notifications. All event handlers call this — never the channel slices directly.

```typescript
// send-notification.command.ts
export class SendNotificationCommand {
  tenantId: string;
  recipientId: string;
  recipientType: RecipientType;
  type: NotificationType;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
  channels: Array<'push' | 'email' | 'sms' | 'in-app'>;
  emailTemplateSlug?: string; // required when 'email' is in channels
  emailTemplateVars?: Record<string, string>; // e.g. { booking_date: '...' }
}
```

**Handler logic (sequential, non-throwing):**
1. Always persist `Notification` record in DB (in-app store)
2. If `channels` includes `push` → dispatch `SendPushCommand`
3. If `channels` includes `email` → fetch template by slug, inject branding vars + template vars, dispatch `SendEmailCommand`
4. If `channels` includes `sms` → dispatch `SendSmsCommand`
5. Each channel failure is logged but does not throw — partial delivery is better than total failure

---

## 5. send-email Branding Injection

`SendEmailHandler` fetches branding config from Organization BC via a direct service call (sync read — acceptable for same-process communication). It merges:

- **Branding vars**: `{{clinic_name}}`, `{{logo_url}}`, `{{primary_color}}`, `{{accent_color}}`
- **Template vars**: `{{client_name}}`, `{{booking_date}}`, `{{service_name}}`, etc.

Variable substitution is a simple `htmlBody.replace(/\{\{(\w+)\}\}/g, vars[key] ?? '')`.

---

## 6. Event Handlers (p9-t5)

| Event | Handler | Channels |
|-------|---------|----------|
| `BookingCancelledEvent` | `on-booking-cancelled.handler.ts` | push + email + in-app |
| `BookingReminderDueEvent` | `on-booking-reminder.handler.ts` | push + sms + in-app |
| `PaymentFailedEvent` | `on-payment-failed.handler.ts` | push + email + in-app |
| `ClientEnrolledEvent` | `on-client-enrolled.handler.ts` | email + in-app (welcome) |

All handlers follow the same pattern: extract payload → build `SendNotificationCommand` → dispatch.

`BookingReminderDueEvent` is emitted by Ops BC cron job (p10-t1) — not by Bookings BC directly.

---

## 7. Email Template Slugs (system defaults — seeded per tenant)

| Slug | Trigger |
|------|---------|
| `booking-confirmed` | BookingConfirmedEvent (Finance BC already handles invoice; Comms sends email) |
| `booking-cancelled` | BookingCancelledEvent |
| `booking-reminder` | BookingReminderDueEvent |
| `payment-failed` | PaymentFailedEvent |
| `welcome` | ClientEnrolledEvent |

System templates are created via seed on tenant provisioning. Admins can edit `htmlBody` and `subject` from the dashboard but cannot delete system templates.

---

## 8. Kanban Task Mapping

| Kanban Task | Slices Covered |
|-------------|---------------|
| p9-t1 | `send-push/`, `send-email/`, `send-sms/`, `send-notification/` |
| p9-t2 | `notifications/` (create, list, mark-read) |
| p9-t3 | `chat/` (create-conversation, create-chat-message, list-conversations) |
| p9-t4 | `email-templates/` (CRUD) |
| p9-t5 | `events/` (4 handlers) |

Execution order: t1 → (t2 + t3 + t4 in parallel) → t5.
