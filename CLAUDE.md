# CLAUDE.md — CareKit

## Project Overview
CareKit is a White Label smart clinic management platform built by WebVue Technology Solutions. It includes a mobile app (iOS + Android), a custom-designed website per client, an admin dashboard, and an AI chatbot assistant.

## Architecture
```
carekit/
├── backend/          # NestJS + Prisma + PostgreSQL
├── mobile/           # React Native (Expo SDK 54)
├── dashboard/        # Next.js 14 + shadcn/ui + Tailwind
├── shared/           # Shared types, constants, i18n
├── docker/           # Docker Compose + Nginx + MinIO
├── docs/             # PRD, API spec, sprint plan
│   ├── CareKit-PRD-EN.md
│   ├── sprint-plan.md        # المرجع الوحيد للتقدم والمراحل
│   ├── api-spec.md
│   └── design/
└── CLAUDE.md         # This file
```

## Tech Stack
- **Backend:** NestJS 10+ / Prisma ORM / PostgreSQL / Redis / BullMQ
- **Mobile:** React Native (Expo SDK 54) / Expo Router v6 / Redux Toolkit / TypeScript
- **Dashboard:** Next.js 14 / shadcn/ui / Tailwind CSS / Recharts / TanStack Table
- **AI:** OpenRouter API (multi-model) / LangChain or Vercel AI SDK / pgvector
- **Payments:** Moyasar SDK + manual bank transfer with AI receipt verification
- **Video:** Zoom API (auto-generated meeting links)
- **Storage:** MinIO (S3-compatible, self-hosted)
- **Email:** Resend or SendGrid
- **Notifications:** Firebase FCM
- **i18n:** Arabic + English (RTL-first)
- **Containerization:** Docker + Docker Compose

## Key Decisions (Read Before Coding)

### Authentication
- Patient login: Email + password OR Email + OTP (code sent via email). NO SMS.
- Practitioner/Staff login: Email + password (account created by admin).
- JWT with refresh tokens. Tokens stored securely (httpOnly cookies on web, expo-secure-store on mobile).

### Authorization (Dynamic RBAC)
- Permission-based system using CASL library.
- 5 default roles: super_admin, receptionist, accountant, practitioner, patient.
- Admins can create custom roles from dashboard and assign granular permissions (view, create, edit, delete) per module.
- Every API endpoint must check permissions via CASL guards.

### Mobile App — Dual Role
- Single app with role-based routing. After login, check user.role and redirect:
  - patient → patient tab navigator (home, appointments, chat, profile)
  - practitioner → doctor tab navigator (today, calendar, patients, profile)
- Shared modules: notifications, video call link, settings, about.

### Booking System
- 3 booking types: clinic_visit, phone_consultation, video_consultation
- Phone consultation: booking only — practitioner calls patient outside platform. System shows patient phone number.
- Video consultation: booking + auto-generated Zoom link sent to both parties.
- Double-booking protection: check practitioner availability before confirming.
- Cancellation: patient requests → goes to admin queue → admin approves/rejects with refund decision.

### Payment
- Moyasar: primary electronic payment (Mada, Apple Pay, Visa/MC).
- Bank transfer: patient uploads receipt photo → AI reads receipt via OpenRouter Vision API → generates tags (matched/amount_differs/suspicious/old_date/unreadable) → admin reviews and approves/rejects.
- Prepayment required for all consultation types.

### AI Chatbot
- Powered by OpenRouter (multi-model).
- Capabilities: book appointment, modify appointment time, view upcoming appointments, request cancellation (does NOT execute — sends to admin).
- Reads from clinic's knowledge base (FAQ, services, practitioners, prices) stored in pgvector.
- Fallback: handoff to Live Chat OR show contact number (configurable per client in White Label settings).
- Works in Arabic and English.

### White Label
- Each deployment is an independent Docker container on client's server.
- All branding configurable from admin dashboard: logo, colors, fonts, app name, domain, payment keys, Zoom keys, chatbot knowledge base, email templates, cancellation policy text.
- Website is custom-designed per client by WebVue (not part of the White Label product code).

### Cancellation Policy
- Each client sets their own policy text from dashboard (displayed to patient).
- No automatic rules — admin decides each case manually (full refund / partial / none).

### Language
- Arabic + English from day 1.
- RTL-first design. All components must support RTL.
- Use i18n library (nestjs-i18n for backend, next-intl for dashboard, i18next for mobile).

### Ratings & Feedback
- After every appointment: star rating (1-5) + optional text feedback + problem report option.
- Problem reports trigger instant notification to admin.
- Ratings affect practitioner ranking in search results.

## File Size Rule — CRITICAL

- **لا يتجاوز أي ملف 350 سطر مطلقاً** — هذه قاعدة صارمة بدون استثناء.
- إذا اقترب ملف من الحد، قسّمه فوراً إلى وحدات أصغر (split by responsibility).
- الملفات الكبيرة علامة على انتهاك Single Responsibility Principle — أعد الهيكلة.
- ينطبق على: TypeScript, TSX, JS, Prisma schema, CSS, وأي ملف كود.

## Code Quality Standards — Best Practices

- **SOLID Principles**: كل كلاس/وحدة مسؤولية واحدة فقط.
- **DRY**: لا تكرار — أي كود متكرر مرتين يُستخرج لـ utility أو shared module.
- **Clean Code**: أسماء واضحة، functions صغيرة (≤ 20 سطر)، لا nested callbacks.
- **Early Return**: تجنب التداخل العميق باستخدام guard clauses.
- **No Magic Numbers/Strings**: كل ثوابت في `constants/` أو enums.
- **Error Boundaries**: معالجة الأخطاء عند الحدود الصحيحة فقط.
- **Tests**: أي منطق business logic يجب أن يكون له unit test.
- **Immutability**: فضّل `const`, readonly, immutable patterns.
- **Type Safety**: لا `any`، لا `as unknown as X` إلا بتعليق يشرح السبب.

## Coding Standards

### General
- TypeScript strict mode everywhere. No `any` types.
- All API responses follow consistent shape: `{ success: boolean, data?: T, error?: { code: string, message: string } }`
- All dates in UTC. Convert to client timezone on frontend only.
- All money amounts stored as integers (halalat/cents). Display conversion on frontend.
- Environment variables: never hardcode secrets. Use .env files + Docker secrets.

### Backend (NestJS)
- Modular architecture: one module per domain (auth, users, practitioners, bookings, payments, invoices, notifications, chatbot, whitelabel).
- Prisma schema is the single source of truth for database.
- Every endpoint documented in Swagger via decorators.
- Validation using class-validator on all DTOs.
- Error handling via global exception filter.
- Logging via built-in NestJS logger.
- Tests: at minimum, unit tests for services + e2e tests for critical flows (auth, booking, payment).

### Mobile (Expo)
- File-based routing with Expo Router v6.
- Redux Toolkit for global state. Redux Persist for auth token.
- react-hook-form + zod for all forms.
- API calls via axios with interceptors for auth token injection.
- All screens must support RTL layout.
- Use expo-secure-store for sensitive data (tokens).
- Never store sensitive data in AsyncStorage.

### Dashboard (Next.js)
- App Router (not pages router).
- shadcn/ui for all UI components. Do not use other UI libraries.
- TanStack Table for all data tables.
- Recharts for all charts.
- react-hook-form + zod for all forms.
- Server components by default. Client components only when needed (interactivity).
- API calls from server components where possible (no client-side fetching for initial data).

### Database (Prisma)
- Use meaningful model names: User, Practitioner, Booking, Service, Invoice, Payment, Role, Permission, ChatMessage, Rating, WhiteLabelConfig.
- Soft delete (deletedAt timestamp) for all important models.
- Created/updated timestamps on all models.
- Use enums for: BookingType (clinic_visit, phone_consultation, video_consultation), BookingStatus (pending, confirmed, completed, cancelled, pending_cancellation), PaymentMethod (moyasar, bank_transfer), PaymentStatus (pending, paid, refunded, failed), TransferVerificationStatus (pending, matched, amount_differs, suspicious, old_date, unreadable, approved, rejected).

### Database Migrations

- Use `prisma migrate dev --name <descriptive_name>` for ALL schema changes
- NEVER use `prisma db push` — it doesn't create migration records
- Migration files in `prisma/migrations/` are committed to Git
- One migration per logical change — don't batch unrelated changes
- Migrations are immutable — never edit a committed migration
- Only backend-dev touches schema.prisma
- Production uses `prisma migrate deploy` only
- Track all migrations in `docs/migration-log.md`

## File Naming
- Backend: `kebab-case` (booking.service.ts, create-booking.dto.ts)
- Mobile: `kebab-case` for files, `PascalCase` for components
- Dashboard: `kebab-case` for files, `PascalCase` for components
- Database: `PascalCase` for Prisma models, `snake_case` for table/column names

## Git Convention
- Branch naming: `feature/booking-system`, `fix/auth-otp`, `chore/docker-setup`
- Commit messages: Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`)
- PR required for main branch. At least 1 review.

## Current Phase
Phase 1: Design & Planning — Start with ERD and API Design.

## Important Files to Read First
1. `docs/CareKit-PRD-EN.md` — Full product requirements (English)
2. `docs/sprint-plan.md` — المرجع الوحيد: المراحل + التقدم + الموارد + سجل الإنجازات
3. This file (`CLAUDE.md`) — Architecture and coding standards
