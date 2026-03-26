# CareKit — System Architecture Reference

> **Version:** 1.1 | **Date:** 2026-03-26 | **Author:** Architecture Team

---

## Table of Contents

- [1. Executive Summary](#1-executive-summary)
- [2. System Big Picture Diagram](#2-system-big-picture-diagram)
- [3. Canonical Stage Numbers](#3-canonical-stage-numbers)
- [4. Request Pipeline (Detailed)](#4-request-pipeline-detailed)
- [5. Module Map](#5-module-map)
- [6. API Endpoints Summary](#6-api-endpoints-summary)
- [7. Background Processing](#7-background-processing)
- [8. External Integrations](#8-external-integrations)
- [9. Notification Channels](#9-notification-channels)
- [10. Data Layer](#10-data-layer)
- [11. Security Architecture](#11-security-architecture)
- [12. Observability](#12-observability)
- [13. Infrastructure](#13-infrastructure)
- [14. Frontend Architecture](#14-frontend-architecture)
- [15. Quick Reference — 15 Points](#15-quick-reference--15-points)

---

## 1. Executive Summary

CareKit is a White Label smart clinic management platform built by WebVue Technology Solutions. It provides patient booking, payment processing, AI-powered chatbot assistance, ZATCA e-invoicing compliance, and multi-channel notifications for healthcare clinics in Saudi Arabia.

Each deployment runs as an independent Docker stack with 7 services: **NestJS backend** (API + BullMQ workers), **PostgreSQL 16** with pgvector (33 models), **Redis 7** (caching, rate limiting, queues), **MinIO** (S3-compatible file storage), **Nginx** (reverse proxy with TLS, rate limiting, security headers), and two backup containers (PostgreSQL daily at 2:00 AM, MinIO daily at 2:30 AM).

The backend exposes a REST API at `/api/v1/` with 25 controllers, 76+ services, and 33 registered NestJS modules. The **Dashboard** is a Next.js 14 app using shadcn/ui, Tailwind CSS, and Hugeicons (`@hugeicons/react`). The **Mobile App** is built with Expo SDK 54 (React Native) serving both patient and practitioner roles through role-based routing.

All branding, payment keys, chatbot knowledge base, and clinic settings are configurable per deployment through the White Label admin dashboard. The platform supports Arabic and English (RTL-first) with i18n throughout all layers.

---

## 2. System Big Picture Diagram

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                                    CLIENTS                                            │
│                                                                                      │
│   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐   │
│   │  Mobile App  │     │  Dashboard   │     │   Moyasar    │     │  Prometheus  │   │
│   │ (Expo RN)    │     │  (Next.js)   │     │  Webhooks    │     │  Scraper     │   │
│   │              │     │              │     │              │     │  (internal)  │   │
│   │ Patient View │     │ middleware.ts │     │ HMAC-SHA256  │     │              │   │
│   │ Doctor View  │     │ → AuthGate   │     │ Verification │     │              │   │
│   └──────┬───────┘     └──────┬───────┘     └──────┬───────┘     └──────┬───────┘   │
│          │ HTTPS               │ HTTPS              │ HTTPS              │ Internal  │
└──────────┼─────────────────────┼────────────────────┼────────────────────┼───────────┘
           │                     │                    │                    │
           ▼                     ▼                    ▼                    ▼
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                          NGINX (Port 80/443)                                         │
│  HTTP→HTTPS │ TLS 1.2/1.3 │ Rate Limits │ Security Headers │ SSE Support            │
└──────────────────────────────┬───────────────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                     BACKEND — NestJS (Port 3100, internal only)                       │
│                                                                                      │
│  Request Pipeline: Sentry → helmet → CORS → CorrelationId → ThrottlerGuard          │
│  → JwtAuth → Permissions → Validation → @Throttle → Controller → Transform          │
│  → Metrics → ExceptionFilter                                                         │
│                                                                                      │
│  33 Modules │ 76+ Services │ 25 Controllers │ 35 DB Models                           │
│  4 BullMQ Queues │ 7 Cron Jobs │ 4 Circuit Breakers                                 │
└──────────┬──────────────────┬──────────────────┬──────────────────┬──────────────────┘
           │                  │                  │                  │
           ▼                  ▼                  ▼                  ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐
│   PostgreSQL 16   │  │     Redis 7      │  │     MinIO        │  │  External APIs │
│   + pgvector      │  │  1 shared conn   │  │   (S3-compat)    │  │  Moyasar       │
│   33 models       │  │  noeviction      │  │   Receipts+KB    │  │  Zoom          │
│   Backup 2:00 AM  │  │  AOF persistence │  │   Backup 2:30 AM │  │  OpenRouter    │
└──────────────────┘  └──────────────────┘  └──────────────────┘  │  Firebase FCM  │
                                                                   │  SMTP Email    │
                                                                   │  SMS (Unifonic)│
                                                                   │  ZATCA API     │
                                                                   └────────────────┘
```

---

## 3. Canonical Stage Numbers — مراحل النظام المعيارية

| Stage | Name | Description |
|-------|------|-------------|
| **[1]** | User Entry | Mobile (Expo RN) / Dashboard (Next.js) / Moyasar Webhook entry points |
| **[2]** | Auth & RBAC | JWT access+refresh tokens, CASL permissions guard, rate limiting |
| **[3]** | Request Pipeline | CorrelationId → helmet → CORS → ThrottlerGuard → Validation → Transform |
| **[4]** | Business Logic (Sync) | Domain services — bookings, payments, invoices, users, practitioners |
| **[5]** | External APIs (Sync) | Moyasar, Zoom, OpenRouter — all wrapped in `resilientFetch` with circuit breakers |
| **[6]** | Data Layer | PostgreSQL via Prisma ORM (33 models) + MinIO for files (receipts, KB docs) |
| **[7]** | Background Jobs | BullMQ: `email`, `receipt-verification`, `zatca-submit`, `tasks` |
| **[8]** | Scheduled Tasks | 7 cron jobs via BullMQ repeatable: cleanup, reminders, booking automation |
| **[9]** | Notifications | In-app DB + Firebase FCM Push + SMS (Unifonic/Twilio) + Email queue |
| **[10]** | Rendering | Dashboard (Next.js 14 App Router) + Mobile (Expo Router v6) |
| **[11]** | AI Pipeline | Chatbot: RAG (pgvector) + Tool Use + SSE Streaming via OpenRouter |
| **[12]** | ZATCA E-Invoicing | XML building + SHA-256 hashing + signing + QR code + API submission |

---

## 4. Request Pipeline (Detailed) — خط أنابيب الطلبات

Every HTTP request passes through these layers in order:

| # | Layer | File Path | Description |
|---|-------|-----------|-------------|
| 1 | **Sentry Init** | `common/sentry/sentry.config.ts` | Initialized before NestFactory.create() |
| 2 | **helmet** | `main.ts` line 22 | Security headers (X-Content-Type-Options, etc.) |
| 3 | **Cookie Parser** | `main.ts` line 25 | Parse cookies before CORS |
| 4 | **CORS** | `main.ts` lines 47-61 | Origin whitelist, credentials: true |
| 5 | **CorrelationId** | `common/middleware/correlation-id.middleware.ts` | Attaches `x-correlation-id` to every request |
| 6 | **ThrottlerGuard** | `app.module.ts` (APP_GUARD) | Global rate limit: 100 req/min via Redis |
| 7 | **JwtAuthGuard** | `common/guards/jwt-auth.guard.ts` | JWT validation, skipped for `@Public()` routes |
| 8 | **PermissionsGuard** | `common/guards/permissions.guard.ts` | CASL-based permission check per endpoint |
| 9 | **ValidationPipe** | `main.ts` lines 31-39 | class-validator: whitelist + transform |
| 10 | **Controller** | `modules/*/` | Route handler executes business logic |
| 11 | **ResponseTransform** | `common/interceptors/response-transform.interceptor.ts` | Wraps response in `{ success, data }` |
| 12 | **MetricsInterceptor** | `common/metrics/metrics.interceptor.ts` | Records `http_requests_total` + `http_request_duration_seconds` |
| 13 | **GlobalExceptionFilter** | `common/filters/http-exception.filter.ts` | Catches all exceptions, returns `{ success: false, error }` |

---

## 5. Module Map — خريطة الوحدات

33 NestJS modules: 24 domain modules + 9 infrastructure modules.

### Infrastructure Modules

| Module | Key Providers | Purpose |
|--------|--------------|---------|
| `ConfigModule` | Global | Environment variable validation |
| `RedisModule` | `REDIS_CLIENT` (ioredis) | Shared Redis connection |
| `DatabaseModule` | `PrismaService` | PostgreSQL via Prisma ORM |
| `StorageModule` | `MinioService` | S3-compatible file storage |
| `AiServiceModule` | `OpenRouterService` | LLM chat completions + embeddings |
| `CacheModule` | `CacheService` | Redis GET/SET/DEL with TTL |
| `QueueModule` | `QueueFailureService` | Global — admin alerts on DLQ |
| `EmailModule` | `EmailService`, `EmailProcessor` | BullMQ email queue + SMTP send |
| `MetricsModule` | `MetricsService` | Prometheus counters + histograms |

### Domain Modules (24)

| Module | Key Services | Controllers |
|--------|-------------|-------------|
| **AuthModule** | `AuthService`, `OtpService`, `TokenService`, `AuthCacheService`, `CookieService` | `auth` |
| **UsersModule** | `UsersService`, `UserRolesService` | `users` |
| **RolesModule** | `RolesService` | `roles` |
| **PermissionsModule** | `PermissionsService` | `permissions` |
| **PractitionersModule** | `PractitionersService`, `AvailabilityService`, `VacationService`, `RatingsService`, `ServiceService`, `FavoritePractitionersService` | `practitioners` |
| **BookingsModule** | `BookingsService`, `BookingQueryService`, `BookingStatusService`, `BookingCancellationService`, `BookingRecurringService`, `WaitlistService`, `BookingSettingsService` | `bookings`, `booking-settings`, `bookings/waitlist` |
| **PaymentsModule** | `PaymentsService`, `MoyasarPaymentService`, `BankTransferService` | `payments` |
| **InvoicesModule** | `InvoicesService`, `InvoiceCreatorService`, `InvoiceHtmlBuilder`, `InvoiceStatsService` | `invoices` |
| **ServicesModule** | `ServicesService` | `services` |
| **SpecialtiesModule** | `SpecialtiesService` | `specialties` |
| **PatientsModule** | `PatientsService` | `patients` |
| **RatingsModule** | `RatingsService` | `ratings` |
| **NotificationsModule** | `NotificationsService`, `PushService`, `SmsService` | `notifications` |
| **ChatbotModule** | `ChatbotService`, `ChatbotAiService`, `ChatbotRagService`, `ChatbotToolsService`, `ChatbotStreamService`, `ChatbotStreamLoopService`, `ChatbotContextService`, `ChatbotConfigService`, `ChatbotFileService`, `ChatbotAnalyticsService` | `chatbot` (3 controllers) |
| **AiModule** | `ReceiptVerificationService`, `ReceiptVerificationProcessor` | (no controller — BullMQ processor) |
| **ZatcaModule** | `ZatcaService`, `XmlBuilderService`, `XmlSigningService`, `InvoiceHashService`, `QrGeneratorService`, `ZatcaApiService`, `ZatcaCryptoService`, `ZatcaOnboardingService`, `ZatcaSandboxService`, `ZatcaSubmitProcessor` | `zatca` |
| **ReportsModule** | `ReportsService`, `RevenueQueriesService`, `ExportService` | `reports` |
| **WhitelabelModule** | `WhitelabelService` | `whitelabel` |
| **ActivityLogModule** | `ActivityLogService` | `activity-log` |
| **ProblemReportsModule** | `ProblemReportsService` | `problem-reports` |
| **TasksModule** | `CleanupService`, `ReminderService`, `BookingAutomationService`, `TasksProcessor`, `TasksBootstrapService` | (no controller — BullMQ processor) |
| **HealthModule** | `HealthController`, `RedisHealthIndicator`, `MinioHealthIndicator` | `health` |
| **IntegrationsModule** | (sub-module: ZoomModule) | — |
| **ZoomModule** | `ZoomService` | (no controller — used by BookingsModule) |

---

## 6. API Endpoints Summary — ملخص نقاط الوصول

All endpoints are prefixed with `/api/v1/`. Auth column: `P` = Public, `A` = Authenticated, `R` = Role/Permission required.

### Auth (`/auth`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/register` | P | Register new patient |
| POST | `/login` | P | Email + password login |
| POST | `/login/otp/send` | P | Send OTP to email |
| POST | `/login/otp/verify` | P | Verify OTP code |
| POST | `/refresh-token` | P | Refresh JWT tokens |
| POST | `/logout` | A | Invalidate refresh token |
| GET | `/me` | A | Get current user profile |
| POST | `/password/forgot` | P | Send password reset email |
| POST | `/password/reset` | P | Reset password with token |
| PATCH | `/password/change` | A | Change password (logged in) |
| POST | `/email/verify/send` | A | Send email verification |
| POST | `/email/verify` | P | Verify email with token |

### Bookings (`/bookings`)
| Method | Path | Auth |
|--------|------|------|
| POST | `/` | A | GET | `/my` | A | GET | `/today` | A | GET | `/stats` | R |
| POST | `/recurring` | R | GET | `/` | R | GET | `/:id` | A | PATCH | `/:id` | R |
| POST | `/:id/patient-reschedule` | A | POST | `/:id/confirm` | R | POST | `/:id/check-in` | R |
| POST | `/:id/start` | R | POST | `/:id/complete` | R | POST | `/:id/no-show` | R |
| POST | `/:id/cancel-request` | A | POST | `/:id/cancel/approve` | R | POST | `/:id/cancel/reject` | R |
| POST | `/:id/admin-cancel` | R | POST | `/:id/practitioner-cancel` | R |

### Payments (`/payments`)
| Method | Path | Auth |
|--------|------|------|
| GET | `/stats` | R | GET | `/my` | A | GET | `/booking/:bookingId` | A |
| GET | `/` | R | POST | `/moyasar` | A | POST | `/moyasar/webhook` | P (HMAC) |
| POST | `/bank-transfer` | A | POST | `/bank-transfer/:id/verify` | R |
| POST | `/:id/refund` | R | GET | `/:id` | A | PATCH | `/:id/status` | R |
| POST | `/:id/receipt` | A | PATCH | `/receipts/:receiptId/review` | R |

### Chatbot (`/chatbot`)
| Method | Path | Auth |
|--------|------|------|
| POST | `/sessions` | A | GET | `/sessions` | A | GET | `/sessions/:id` | A |
| POST | `/sessions/:id/messages` | A | POST | `/sessions/:id/messages/stream` | A |
| POST | `/sessions/:id/end` | A | GET | `/config` | R | GET | `/config/:category` | R |
| PUT | `/config` | R | POST | `/config/seed` | R | GET | `/analytics` | R |
| GET | `/analytics/questions` | R | GET | `/knowledge-base` | R | POST | `/knowledge-base` | R |
| PATCH | `/knowledge-base/:id` | R | DELETE | `/knowledge-base/:id` | R |
| POST | `/knowledge-base/sync` | R | POST | `/knowledge-base/files` | R |
| GET | `/knowledge-base/files` | R | POST | `/knowledge-base/files/:id/process` | R |
| DELETE | `/knowledge-base/files/:id` | R |

### Other Controllers (abbreviated)
| Controller | Base Path | Endpoints |
|-----------|-----------|-----------|
| Users | `/users` | CRUD + activate/deactivate + role assign/remove (9 endpoints) |
| Practitioners | `/practitioners` | CRUD + availability + slots + vacations + services + ratings + favorites (16 endpoints) |
| Services | `/services` | CRUD + categories CRUD (9 endpoints) |
| Specialties | `/specialties` | CRUD (5 endpoints) |
| Invoices | `/invoices` | List + stats + by-payment + create + HTML + send (7 endpoints) |
| Ratings | `/ratings` | Create + by-practitioner + by-booking (3 endpoints) |
| Notifications | `/notifications` | List + unread-count + mark-read + mark-all + FCM token register/unregister (6 endpoints) |
| Reports | `/reports` | Revenue + bookings + patients + practitioner (6 endpoints with export) |
| Roles | `/roles` | CRUD + permission assign/remove (5 endpoints) |
| Permissions | `/permissions` | List all (1 endpoint) |
| Patients | `/patients` | List + detail + stats (3 endpoints) |
| Problem Reports | `/problem-reports` | Create + list + detail + resolve (4 endpoints) |
| Activity Log | `/activity-log` | List + detail (2 endpoints) |
| White Label | `/whitelabel` | Public config + admin CRUD + map (6 endpoints) |
| ZATCA | `/zatca` | Config + onboard + status + sandbox stats + report (5 endpoints) |
| Booking Settings | `/booking-settings` | Get + update (2 endpoints) |
| Waitlist | `/bookings/waitlist` | My + list + create + delete (4 endpoints) |
| Health | `/health` | Health check (1 endpoint, public) |

---

## 7. Background Processing — المعالجة في الخلفية

### 7.1 BullMQ Queues — الطوابير

All queues share the same retry config: **3 attempts**, **30s exponential backoff**, retain last 50 failed jobs for 7 days. On final failure, `QueueFailureService` sends admin notifications.

| Queue Name | Processor | Job Types | Source |
|-----------|-----------|-----------|--------|
| `email` | `EmailProcessor` | `send-email` | `email.processor.ts` |
| `receipt-verification` | `ReceiptVerificationProcessor` | `verify` | `receipt-verification.processor.ts` |
| `zatca-submit` | `ZatcaSubmitProcessor` | ZATCA invoice submission | `zatca-submit.processor.ts` |
| `tasks` | `TasksProcessor` | 7 job types (see cron below) | `tasks.processor.ts` |

### 7.2 Cron Jobs — المهام المجدولة

Registered as BullMQ repeatable jobs in `TasksBootstrapService.onModuleInit()`. Old repeatables are cleared on startup to prevent duplicates.

| Job Name | Schedule | Service Method |
|----------|----------|----------------|
| `cleanup-otps` | `0 3 * * *` (daily 3:00 AM) | `CleanupService.cleanExpiredOtps()` |
| `cleanup-tokens` | `30 3 * * *` (daily 3:30 AM) | `CleanupService.cleanExpiredRefreshTokens()` |
| `reminder-24h` | `0 * * * *` (every hour) | `ReminderService.sendDayBeforeReminders()` |
| `reminder-1h` | `*/15 * * * *` (every 15 min) | `ReminderService.sendHourBeforeReminders()` |
| `expire-pending-bookings` | `*/5 * * * *` (every 5 min) | `BookingAutomationService.expirePendingBookings()` |
| `auto-complete-bookings` | `*/15 * * * *` (every 15 min) | `BookingAutomationService.autoCompleteBookings()` |
| `auto-no-show` | `*/10 * * * *` (every 10 min) | `BookingAutomationService.autoNoShow()` |

---

## 8. External Integrations — التكاملات الخارجية

All external HTTP calls use `resilientFetch()` (`common/helpers/resilient-fetch.helper.ts`) which provides timeout via `AbortController` and a circuit breaker (5 failures = open, 30s reset timeout, half-open probe).

| API | Circuit Name | Timeout | Purpose |
|-----|-------------|---------|---------|
| **Moyasar** | `moyasar` | 15s | Payment creation, refund processing |
| **Zoom** | `zoom` | 10s | Video consultation meeting CRUD, OAuth token (cached in Redis) |
| **OpenRouter** | `openrouter` | 30s (blocking) / 60s (streaming) | LLM chat completions + embeddings for chatbot and receipt AI |
| **SMS (Unifonic/Twilio)** | `sms` | 10s | SMS notifications for critical booking events |
| **Firebase FCM** | (direct SDK) | — | Push notifications to mobile devices |
| **SMTP** | (nodemailer) | — | Email via BullMQ queue (async) |
| **ZATCA** | (within ZatcaApiService) | — | E-invoice reporting/clearance to Saudi tax authority |

---

## 9. Notification Channels — قنوات الإشعارات

```
                  ┌─────────────────────────────────────────────────────┐
                  │              NotificationsService                    │
                  │         createNotification(dto)                      │
                  └──────────┬──────────────┬──────────────┬────────────┘
                             │              │              │
                             ▼              ▼              ▼
                    ┌────────────┐  ┌────────────┐  ┌────────────────┐
                    │  In-App DB │  │  FCM Push  │  │ SMS (Unifonic) │
                    │ (always)   │  │ (always,   │  │ (critical types│
                    │            │  │  fire&forget│  │  only)         │
                    └────────────┘  └────────────┘  └────────────────┘
```

**SMS-eligible types** (triggers SMS in addition to in-app + push):
- `reminder` — appointment reminders
- `booking_confirmed` — booking confirmation
- `booking_cancelled` — cancellation notification
- `cancellation_rejected` — cancellation rejection

**Email** is sent separately via the `email` BullMQ queue for: OTP codes, password reset, email verification, booking confirmations, and invoice delivery.

---

## 10. Data Layer — طبقة البيانات

### 10.1 PostgreSQL (33 Models grouped by domain)

| Domain | Models |
|--------|--------|
| **Users & Auth** | `User`, `OtpCode`, `RefreshToken`, `Role`, `Permission`, `RolePermission`, `UserRole`, `FcmToken` |
| **Practitioners** | `Practitioner`, `Specialty`, `PractitionerAvailability`, `PractitionerVacation`, `PractitionerService`, `FavoritePractitioner` |
| **Services** | `ServiceCategory`, `Service` |
| **Bookings** | `Booking`, `BookingSettings`, `WaitlistEntry` |
| **Payments** | `Payment`, `BankTransferReceipt`, `ProcessedWebhook` |
| **Invoices** | `Invoice` |
| **Feedback** | `Rating`, `ProblemReport` |
| **Chatbot** | `ChatSession`, `ChatMessage`, `KnowledgeBase`, `KnowledgeBaseFile`, `ChatbotConfig` |
| **System** | `WhiteLabelConfig`, `ActivityLog`, `Notification` |

**Key enums:** `BookingType` (4: +walk_in), `BookingStatus` (9: +checked_in/in_progress/expired), `PaymentMethod` (2), `PaymentStatus` (5: +awaiting), `TransferVerificationStatus` (8), `NotificationType` (13), `WaitlistStatus` (5), `KbFileStatus` (4), `SessionLanguage` (2), `DevicePlatform` (3), `ProblemReportType` (7).

**pgvector extension** enabled for chatbot RAG embeddings in the `KnowledgeBase` model.

### 10.2 Redis Usage

| Use Case | Key Pattern | TTL |
|----------|------------|-----|
| Auth token cache | `auth:*` | 15 min |
| OTP lockout tracking | `otp:lockout:*`, `otp:fail:*` | 1h / 2h |
| Rate limiting (ThrottlerGuard) | Throttler keys | 60s window |
| Zoom OAuth token | `zoom:access_token` | Token expiry - 60s |
| BullMQ queues (4) | `bull:email:*`, `bull:receipt-verification:*`, `bull:tasks:*`, `bull:zatca-submit:*` | Job-dependent |
| General cache | Application-specific | Varies |

**Config:** `maxmemory 200mb`, `maxmemory-policy noeviction`, `appendonly yes`, `appendfsync everysec`.

### 10.3 MinIO (S3-Compatible Storage)

| Bucket | Content |
|--------|---------|
| `carekit` (single bucket) | Bank transfer receipt images, knowledge base files for chatbot RAG |

**Limits:** Receipt upload max 10 MB, KB file upload max 20 MB.

---

## 11. Security Architecture — بنية الأمان

| Layer | Mechanism | Implementation |
|-------|-----------|----------------|
| **L1 — Transport** | TLS 1.2/1.3, HTTP->HTTPS redirect, HSTS | Nginx: `ssl_protocols TLSv1.2 TLSv1.3` |
| **L2 — Edge Rate Limiting** | Nginx: 30 req/s API, 5 req/s auth | `limit_req_zone` in `nginx.conf` |
| **L3 — Security Headers** | X-Content-Type-Options, X-Frame-Options, CSP, XSS-Protection, Referrer-Policy | `security_headers.conf` + `helmet()` |
| **L4 — Application Rate Limiting** | ThrottlerGuard: 100 req/min per IP via Redis | `ThrottlerRedisStorage` in `app.module.ts` |
| **L5 — Authentication** | JWT (15min access + 7d refresh), bcrypt (10 rounds), OTP with lockout (3 failures = 1h ban) | `jwt-auth.guard.ts`, `otp.service.ts` |
| **L6 — Authorization** | CASL permissions guard, 5 default roles, custom roles via admin | `permissions.guard.ts` |
| **L7 — Input Validation** | class-validator whitelist + forbidNonWhitelisted, Prisma parameterized queries | `ValidationPipe` in `main.ts` |
| **L8 — Webhook Integrity** | Moyasar HMAC-SHA256 signature verification, idempotency via `ProcessedWebhook` | `moyasar-payment.service.ts` |

**Additional:** Internal-only ports (PostgreSQL, Redis, MinIO not exposed in production), metrics endpoint restricted to Docker internal network (172.16.0.0/12, 10.0.0.0/8), graceful shutdown hooks enabled.

---

## 12. Observability — المراقبة

| Component | Tool | Details |
|-----------|------|---------|
| **Error Tracking** | Sentry (`@sentry/nestjs`) | Init before app bootstrap; 10% trace sampling in production |
| **Metrics** | Prometheus (prom-client) | `http_requests_total` (counter), `http_request_duration_seconds` (histogram with 10 buckets), default Node.js metrics. Endpoint: `GET /api/v1/metrics` (internal only) |
| **Structured Logging** | `StructuredLogger` | Custom NestJS logger, JSON format in production |
| **Correlation IDs** | `CorrelationIdMiddleware` | `x-correlation-id` header attached to every request for trace propagation |
| **Health Checks** | `@nestjs/terminus` | `GET /api/v1/health` — checks PostgreSQL, Redis, MinIO. Returns uptime, version, startedAt |
| **Queue Failure Alerts** | `QueueFailureService` | On BullMQ job DLQ (3 retries exhausted), sends in-app notification to all admin users |
| **Nginx Logging** | `access.log` + `error.log` | JSON file driver, max 10MB x 5 files (production) |

---

## 13. Infrastructure — البنية التحتية

### 13.1 Docker Services (7 in production)

| Service | Image | Memory Limit | Ports (prod) | Health Check |
|---------|-------|-------------|--------------|--------------|
| `backend` | Custom (NestJS) | 512M | 3100 (internal) | `wget /api/v1/health` every 30s |
| `postgres` | `pgvector/pgvector:pg16` | 1G | None (internal) | `pg_isready` every 30s |
| `redis` | `redis:7-alpine` | 256M | None (internal) | `redis-cli ping` every 30s |
| `minio` | `minio/minio:latest` | 512M | None (internal) | `mc ready local` every 30s |
| `nginx` | `nginx:1.27-alpine` | 128M | 80, 443 | `wget /nginx-health` every 30s |
| `backup` | `postgres:16-alpine` | 128M | None | Cron-based |
| `minio-backup` | `minio/mc:latest` | 128M | None | Cron-based |

### 13.2 Backup System

| Target | Schedule | Retention | Script |
|--------|----------|-----------|--------|
| PostgreSQL | Daily at 2:00 AM | Configurable (`BACKUP_RETENTION_DAYS`, default 30) | `docker/scripts/backup.sh` |
| MinIO | Daily at 2:30 AM | Configurable (`BACKUP_RETENTION_DAYS`, default 30) | `docker/scripts/backup-minio.sh` |

Restore script available: `docker/scripts/restore.sh`.

### 13.3 Production Config

- All secrets via environment variables (`.env.prod`), never hardcoded
- All service ports closed except Nginx (80/443)
- JSON file logging with rotation (max-size 5-10MB, max-file 3-5)
- `restart: unless-stopped` on all services
- Compose override: `docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.prod up -d`

---

## 14. Frontend Architecture — بنية الواجهات

### 14.1 Dashboard (Next.js 14)

- **Router:** App Router with route group `(dashboard)/`
- **Auth:** `middleware.ts` checks `carekit_session` cookie; AuthGate component handles real JWT validation client-side
- **UI Library:** shadcn/ui exclusively, Tailwind CSS with semantic design tokens
- **Data Tables:** TanStack Table for all list pages
- **Charts:** Recharts for analytics/reports
- **Forms:** react-hook-form + zod validation
- **Pages:** Dashboard home, bookings, patients, practitioners, services, payments, invoices, ratings, notifications, chatbot, reports, problem-reports, activity-log, users, settings, ZATCA
- **Design System:** `dashboard/DESIGN-SYSTEM.md` (strict rules), tokens in `dashboard/lib/ds.ts`

### 14.2 Mobile (Expo SDK 54)

- **Router:** Expo Router v6 (file-based routing)
- **State:** Redux Toolkit + Redux Persist for auth
- **Forms:** react-hook-form + zod
- **API:** axios with auth token interceptors
- **Storage:** expo-secure-store for sensitive tokens
- **Dual Role:** Single app, role-based routing — patient tabs vs. practitioner tabs
- **i18n:** i18next (Arabic + English, RTL-first)
- **Structure:** `app/` (routes), `components/`, `services/`, `stores/`, `hooks/`, `theme/`, `i18n/`, `types/`

---

## 15. Quick Reference — 15 Points — مرجع سريع

1. **Monorepo** — `backend/`, `dashboard/`, `mobile/`, `shared/`, `docker/` managed by Turborepo
2. **API prefix** — All endpoints at `/api/v1/`, Swagger at `/api/docs` (dev only)
3. **33 NestJS modules** — 24 domain + 9 infrastructure, registered in `app.module.ts`
4. **35 Prisma models** — PostgreSQL 16 + pgvector, single `schema.prisma` as source of truth
5. **4 BullMQ queues** — `email`, `receipt-verification`, `tasks`, `zatca-submit` all on Redis
6. **7 cron jobs** — Cleanup (OTP, tokens), reminders (24h, 1h), booking automation (expire, complete, no-show)
7. **4 circuit breakers** — `moyasar`, `zoom`, `openrouter`, `sms` via `resilientFetch()`
8. **JWT auth** — 15min access + 7d refresh, bcrypt (10 rounds), OTP with 3-failure lockout
9. **CASL RBAC** — 5 default roles, custom roles via admin, permission checks on every endpoint
10. **3 notification channels** — In-app DB (always), FCM push (always), SMS (critical types only)
11. **AI chatbot** — RAG with pgvector, tool use (book/modify/cancel), SSE streaming via OpenRouter
12. **ZATCA e-invoicing** — XML build, SHA-256 hash, digital signing, QR code, async API submission
13. **White Label** — Per-deployment branding, keys, and settings via `WhiteLabelConfig`
14. **7 Docker services** — Backend, PostgreSQL, Redis, MinIO, Nginx, PG backup, MinIO backup
15. **Dual backups** — PostgreSQL at 2:00 AM, MinIO at 2:30 AM, configurable retention
