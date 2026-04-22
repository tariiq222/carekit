# SaaS-02f — Comms Cluster callsite audit (2026-04-21)

## Actual handler filenames (vs plan)

Plan guessed names; actual files:

**Comms / notifications:**
- `src/modules/comms/notifications/create-notification.handler.ts` ✅
- `src/modules/comms/notifications/list-notifications.handler.ts`
- `src/modules/comms/notifications/mark-read.handler.ts`
- `src/modules/comms/notifications/get-unread-count.handler.ts`

**Comms / send-notification:**
- `src/modules/comms/send-notification/send-notification.handler.ts` ✅

**Comms / email-templates:**
- `create-email-template.handler.ts` ✅
- `update-email-template.handler.ts` ✅
- `get-email-template.handler.ts` ✅
- `list-email-templates.handler.ts` ✅
- `preview-email-template.handler.ts` (extra — plan didn't list; reads `findFirst({ id })` only so Proxy auto-scopes)
- No separate `delete-email-template.handler.ts` — deletion done via `updateMany`/soft-delete isn't present; skip.

**Comms / chat:** (plan suggested `send-message.handler.ts`; actual names differ)
- `create-conversation.handler.ts` ✅
- `create-chat-message.handler.ts` (the plan called this "send-message")
- `send-staff-message.handler.ts` (additional — staff path writes CommsChatMessage too)
- `list-conversations.handler.ts` ✅
- `list-messages.handler.ts` (additional — reads CommsChatMessage under a conversation findFirst)
- `get-conversation.handler.ts` ✅
- `close-conversation.handler.ts` ✅

**Comms / contact-messages:**
- `create-contact-message.handler.ts` ✅
- `list-contact-messages.handler.ts` ✅
- `update-contact-message-status.handler.ts` ✅

**Comms / send-email:**
- `src/modules/comms/send-email/send-email.handler.ts` — reads `emailTemplate.findUnique({ slug })`. BREAKING after schema change — must switch to `findFirst({ slug })` so the Proxy auto-scopes.

**AI / chat-completion:**
- `src/modules/ai/chat-completion/chat-completion.handler.ts` ✅ (creates ChatSession + ChatMessage)
  - Does NOT currently read ChatbotConfig (uses hard-coded SYSTEM_PROMPT_TEMPLATE). No reshape needed beyond org scoping of ChatSession/ChatMessage.

**AI / chatbot-config:** (plan said `update-chatbot-config.handler.ts`; actual is `upsert-chatbot-config.handler.ts`)
- `get-chatbot-config.handler.ts` — currently `findMany({ where: { category } })` against the old key/value shape.
- `upsert-chatbot-config.handler.ts` — currently `$transaction(array of upsert)` with `where: { key }`.
- DTO: `upsert-chatbot-config.dto.ts` — currently accepts `{ configs: { key, value, category }[] }`. Will be replaced with a flat typed DTO per the plan.

**Public contact controller:** `src/api/public/contact-messages.controller.ts` ✅ (plan called it `contact.controller.ts`).

## Grep output summaries

### Step 1.2 — Notification create callsites
- `src/modules/comms/send-notification/send-notification.handler.ts:24` — `this.prisma.notification.create`
- `src/modules/comms/notifications/create-notification.handler.ts:19` — `this.prisma.notification.create`
- No cross-cluster event handler writes Notification directly (bookings/finance event handlers go through SendNotificationHandler).

### Step 1.3 — EmailTemplate callsites
- `create-email-template.handler.ts` — `findUnique({ slug })` + `create`. BREAKING.
- `update-email-template.handler.ts` — `findFirst({ id })` + `update({ where: { id } })`. UUID-safe.
- `get-email-template.handler.ts` — `findFirst({ id })`. Safe.
- `list-email-templates.handler.ts` — `findMany` + `count`. Proxy-scoped.
- `preview-email-template.handler.ts` — `findFirst({ id })`. Safe.
- `send-email/send-email.handler.ts:23` — `findUnique({ slug })`. BREAKING — switch to `findFirst({ slug })`.

### Step 1.4 — Chat callsites
- `comms/chat/*` (see above).
- `ai/chat-completion/chat-completion.handler.ts` — `chatSession.create`, `chatMessage.createMany`.

### Step 1.5 — ContactMessage
- `create-contact-message.handler.ts:21` — create.
- `list-contact-messages.handler.ts` — findMany/count.
- `update-contact-message-status.handler.ts:15` — `findUnique({ id })` then update. BREAKING (the Proxy extension only auto-scopes `findFirst`/`findMany`; `findUnique({ id })` does NOT get `organizationId` injected because id is declared @unique without a composite). Must switch to `findFirst({ id })`.
- `api/public/contact-messages.controller.ts` — invokes CreateContactMessageHandler. Public endpoint — relies on TenantMiddleware to resolve org from Host before hitting the handler.

### Step 1.6 — ChatbotConfig
- `get-chatbot-config.handler.ts` — findMany by category (OLD shape).
- `upsert-chatbot-config.handler.ts` — upsert by key (OLD shape).
- chat-completion.handler.ts does NOT currently read ChatbotConfig.
- Dashboard controller wires it; DTO update will be required.

### Step 1.7 — $transaction(async ...) in comms/ai
- None in `src/modules/comms/`.
- `src/modules/ai/embed-document/embed-document.handler.ts:50` — but that's KnowledgeDocument / DocumentChunk, which belongs to 02g (AI KB cluster), NOT 02f. Out of scope.

## Divergences from plan to note
1. Plan mentions `delete-email-template.handler.ts` — does not exist; removed from scope.
2. Plan mentions `send-message.handler.ts` — actual is `create-chat-message.handler.ts` + `send-staff-message.handler.ts`.
3. Plan mentions `update-chatbot-config.handler.ts` — actual is `upsert-chatbot-config.handler.ts` (multi-entry upsert). Will be replaced by a single-row update against the new singleton shape.
4. `send-email/send-email.handler.ts` — not listed in plan Task 6, but has `findUnique({ slug })` that breaks after schema change. MUST update.
5. `update-contact-message-status.handler.ts` uses `findUnique({ id })` — plan Task 8.3 says this must be `findFirst({ id })`. Noted.
6. `preview-email-template.handler.ts` — not listed but `findFirst({ id })` already safe. No change needed beyond spec fixture cleanup.
7. `list-messages.handler.ts` — extra read path on CommsChatMessage via conversation findFirst. Existing `findFirst` + `findMany` are Proxy-scoped — no change beyond verifying.
