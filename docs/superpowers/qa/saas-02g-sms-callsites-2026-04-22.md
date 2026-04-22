# SaaS-02g-sms — Pre-flight callsite audit (2026-04-22)

## 1.1 SMS callsites

```
src/modules/comms/comms.module.ts:8             — imports SendSmsHandler
src/modules/comms/send-notification/send-notification.handler.ts:7,63 — calls this.sms.execute({ phone, body })
src/modules/comms/send-sms/send-sms.handler.ts  — current handler (stub)
```

**Only callsite:** `SendNotificationHandler` fans out to `SendSmsHandler.execute({ phone, body })`.

## 1.2 Legacy provider client

No references to `unifonic`, `taqnyat`, `twilio`, `SmsClient`, or `HttpService.*sms` exist in `src/`.
Current `send-sms.handler.ts` is a **stub** that only logs a warning — no provider wired up yet.

**Env vars:** none currently reference an SMS provider.

## Implications for 02g-sms

- No legacy env vars to remove (Task 10.2 is a no-op for `TWILIO_*`).
- `send-sms.handler.ts` replacement in Task 7 is a straight swap; single caller.
- Adding `OrganizationSmsConfig` + provider factory is net-new infra; no dual-write concerns.
