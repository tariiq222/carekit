# CareKit — Claude Code Initial Prompt

## How to Use This File
Copy the prompt below and paste it to Claude Code after setting up the project.

---

## Step 1: Setup Project Structure

```bash
mkdir carekit && cd carekit
git init

# Create folder structure
mkdir -p backend mobile dashboard shared docs docker

# Copy docs
# (Copy the 3 files: CareKit-PRD-EN.md, CareKit-PRD-AR.md, CareKit-Resources-Milestones.md into docs/)

# Copy CLAUDE.md to root
# (Copy CLAUDE.md to carekit/CLAUDE.md)

git add . && git commit -m "chore: initial project structure with PRD and CLAUDE.md"
```

---

## Step 2: First Prompt to Claude Code

Copy everything below the line and paste it:

---

```
Read CLAUDE.md and docs/CareKit-PRD-EN.md and docs/CareKit-Resources-Milestones.md carefully.

You are building CareKit — a White Label clinic management platform. I need you to start Phase 1.

## Task 1: Initialize the Monorepo

Set up the project with these 3 apps:

1. **backend/** — Initialize NestJS project with:
   - Prisma ORM (PostgreSQL)
   - @casl/ability for Dynamic RBAC
   - @nestjs/passport + passport-jwt for auth
   - @nestjs/swagger for API docs
   - nestjs-i18n for Arabic + English
   - @nestjs-modules/mailer for email (OTP + notifications)
   - class-validator + class-transformer
   - @nestjs/throttler for rate limiting
   - Docker Compose with PostgreSQL + Redis + MinIO

2. **mobile/** — Clone and configure wataru-maeda/react-native-boilerplate:
   - Rename to CareKit
   - Add i18next + react-i18next
   - Add axios + react-query
   - Add react-hook-form + zod
   - Add expo-secure-store
   - Set up RTL-first layout

3. **dashboard/** — Initialize Next.js 14 project with:
   - shadcn/ui (install all components)
   - Tailwind CSS with RTL support
   - next-intl for Arabic + English
   - TanStack Table + Recharts
   - react-hook-form + zod
   - App Router structure matching the admin pages in the PRD

Create a root package.json with workspace scripts:
- `npm run dev:backend` → starts NestJS
- `npm run dev:mobile` → starts Expo
- `npm run dev:dashboard` → starts Next.js
- `npm run dev:all` → starts everything
- `npm run docker:up` → starts PostgreSQL + Redis + MinIO

## Task 2: Design the ERD (Prisma Schema)

Based on the PRD decisions, create the complete Prisma schema at backend/prisma/schema.prisma with ALL these models:

**Auth & Users:**
- User (id, email, passwordHash, role, isActive, emailVerified, createdAt, updatedAt, deletedAt)
- OtpCode (id, userId, code, type, expiresAt, usedAt)
- RefreshToken (id, userId, token, expiresAt)

**RBAC:**
- Role (id, name, slug, description, isDefault, isSystem, createdAt)
- Permission (id, module, action, description) — module: bookings, practitioners, patients, services, invoices, payments, reports, notifications, chatbot, whitelabel, users, roles. action: view, create, edit, delete
- RolePermission (roleId, permissionId)
- UserRole (userId, roleId)

**Clinic:**
- Practitioner (id, userId, specialtyId, bio, experience, education, priceClinic, pricePhone, priceVideo, rating, reviewCount, isActive)
- Specialty (id, nameAr, nameEn, iconUrl, description, sortOrder)
- PractitionerAvailability (id, practitionerId, dayOfWeek, startTime, endTime, isActive)
- PractitionerVacation (id, practitionerId, startDate, endDate, reason)

**Services:**
- Service (id, nameAr, nameEn, descriptionAr, descriptionEn, categoryId, price, duration, isActive)
- ServiceCategory (id, nameAr, nameEn, sortOrder)

**Bookings:**
- Booking (id, patientId, practitionerId, serviceId, type [clinic_visit/phone_consultation/video_consultation], date, startTime, endTime, status [pending/confirmed/completed/cancelled/pending_cancellation], notes, zoomMeetingId, zoomJoinUrl, cancellationReason, createdAt, updatedAt)

**Payments:**
- Payment (id, bookingId, amount, vatAmount, totalAmount, method [moyasar/bank_transfer], status [pending/paid/refunded/failed], moyasarPaymentId, createdAt)
- BankTransferReceipt (id, paymentId, receiptUrl, aiVerificationStatus [pending/matched/amount_differs/suspicious/old_date/unreadable/approved/rejected], aiConfidence, aiNotes, extractedAmount, extractedDate, reviewedBy, reviewedAt, createdAt)
- Invoice (id, paymentId, invoiceNumber, pdfUrl, sentAt, createdAt)

**Ratings:**
- Rating (id, bookingId, patientId, practitionerId, stars, comment, createdAt)
- ProblemReport (id, bookingId, patientId, type [no_call/late/technical/other], description, status [open/reviewing/resolved], resolvedBy, resolvedAt, createdAt)

**Chatbot:**
- ChatSession (id, userId, startedAt, endedAt, handedOff, handoffType [live_chat/contact_number])
- ChatMessage (id, sessionId, role [user/assistant/system], content, functionCall, createdAt)
- KnowledgeBase (id, title, content, embedding, category, isActive, updatedAt)

**White Label:**
- WhiteLabelConfig (id, key, value, type [string/json/file], updatedAt) — keys: logo, primaryColor, secondaryColor, font, appName, domain, phone, email, address, socialMedia, moyasarApiKey, moyasarSecretKey, bankAccountName, bankAccountNumber, bankAccountIban, zoomApiKey, zoomApiSecret, openrouterApiKey, cancellationPolicyAr, cancellationPolicyEn, aboutAr, aboutEn, privacyPolicyAr, privacyPolicyEn, termsAr, termsEn, defaultLanguage, timezone, sessionDuration, reminderBeforeMinutes, firebaseConfig

**Notifications:**
- Notification (id, userId, titleAr, titleEn, bodyAr, bodyEn, type [booking_confirmed/booking_cancelled/reminder/payment_received/new_rating/problem_report], isRead, data, createdAt)

Add proper relations, indexes, enums, and seed data for:
- 5 default roles with permissions
- Sample specialties
- Sample services
- Default WhiteLabelConfig values

After creating the schema, run prisma migrate and prisma generate.

## Output
When done, show me:
1. The complete folder structure
2. The Prisma schema
3. Confirmation that docker compose up works (PostgreSQL + Redis + MinIO running)
4. Confirmation that all 3 apps start without errors
```

---

## Step 3: After Phase 1 Setup, Next Prompts

### Prompt for Auth System:
```
Read CLAUDE.md. Build the complete auth system in backend/:

1. Email + Password registration and login (JWT + refresh tokens)
2. Email OTP login (send 6-digit code via email, verify, issue JWT)
3. Password reset via email OTP
4. Auth guards (JwtAuthGuard)
5. CASL permission guards (check permissions on every endpoint)
6. Role-based user creation (admin creates practitioner/staff accounts)
7. Current user endpoint (GET /auth/me)

All endpoints documented in Swagger. Include unit tests for auth service.
```

### Prompt for Booking System:
```
Read CLAUDE.md. Build the booking system in backend/:

1. CRUD for specialties and services
2. CRUD for practitioners (with availability schedule)
3. Booking creation with conflict detection (no double booking)
4. 3 booking types: clinic_visit, phone_consultation, video_consultation
5. Booking status flow: pending → confirmed → completed (or cancelled)
6. Cancellation request flow (pending_cancellation → admin reviews)
7. Auto-generate Zoom link for video consultations (Zoom API)
8. Appointment reminders (BullMQ scheduled jobs)
9. All endpoints with proper CASL permission checks

Include Swagger docs and tests for booking service.
```

### Prompt for Payment System:
```
Read CLAUDE.md. Build the payment system in backend/:

1. Moyasar payment integration (create payment, webhook for confirmation)
2. Bank transfer flow (upload receipt, store in MinIO)
3. AI receipt verification (send receipt image to OpenRouter Vision API, extract amount/date, compare with booking, generate tags)
4. Admin approve/reject bank transfers
5. Invoice auto-generation (PDF)
6. Refund processing
7. Payment reporting endpoints
8. VAT calculation (15%)

Include Swagger docs and tests.
```
