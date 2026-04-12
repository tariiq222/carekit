# Phase 1 — API Mapping: Dashboard ↔ New Backend
**Date:** 2026-04-12  
**Status:** Complete  
**Scope:** Full comparison of all dashboard API calls vs. new backend controllers

---

## Method

1. Extracted all endpoints from `apps/dashboard/lib/api/*.ts` (31 files)
2. Extracted all routes from `apps/backend/src/api/dashboard|public|mobile/**/*.controller.ts`
3. Verified handler availability in `apps/backend/src/modules/`
4. Classified each gap by type

---

## Backend Controller Map (New)

### `@Controller('dashboard/bookings')`
| Method | Path |
|---|---|
| POST | `/dashboard/bookings` |
| POST | `/dashboard/bookings/recurring` |
| GET | `/dashboard/bookings` |
| GET | `/dashboard/bookings/availability` |
| GET | `/dashboard/bookings/:id` |
| PATCH | `/dashboard/bookings/:id/cancel` |
| PATCH | `/dashboard/bookings/:id/reschedule` |
| PATCH | `/dashboard/bookings/:id/confirm` |
| PATCH | `/dashboard/bookings/:id/check-in` |
| PATCH | `/dashboard/bookings/:id/complete` |
| PATCH | `/dashboard/bookings/:id/no-show` |
| POST | `/dashboard/bookings/waitlist` |

### `@Controller('dashboard/people')`
| Method | Path |
|---|---|
| POST | `/dashboard/people/clients` |
| GET | `/dashboard/people/clients` |
| GET | `/dashboard/people/clients/:id` |
| PATCH | `/dashboard/people/clients/:id` |
| POST | `/dashboard/people/employees` |
| GET | `/dashboard/people/employees` |
| GET | `/dashboard/people/employees/:id` |
| PATCH | `/dashboard/people/employees/:id/availability` |
| POST | `/dashboard/people/employees/:id/onboarding` |

### `@Controller('dashboard/organization')`
| Method | Path |
|---|---|
| POST | `/dashboard/organization/branches` |
| GET | `/dashboard/organization/branches` |
| GET | `/dashboard/organization/branches/:branchId` |
| PATCH | `/dashboard/organization/branches/:branchId` |
| POST | `/dashboard/organization/categories` |
| GET | `/dashboard/organization/categories` |
| PATCH | `/dashboard/organization/categories/:categoryId` |
| POST | `/dashboard/organization/departments` |
| GET | `/dashboard/organization/departments` |
| PATCH | `/dashboard/organization/departments/:departmentId` |
| POST | `/dashboard/organization/hours` |
| GET | `/dashboard/organization/hours/:branchId` |
| POST | `/dashboard/organization/holidays` |
| DELETE | `/dashboard/organization/holidays/:holidayId` |
| GET | `/dashboard/organization/holidays` |
| POST | `/dashboard/organization/services` |
| GET | `/dashboard/organization/services` |
| PATCH | `/dashboard/organization/services/:serviceId` |
| DELETE | `/dashboard/organization/services/:serviceId` |
| POST | `/dashboard/organization/branding` |
| GET | `/dashboard/organization/branding` |
| POST | `/dashboard/organization/intake-forms` |
| GET | `/dashboard/organization/intake-forms` |
| GET | `/dashboard/organization/intake-forms/:formId` |
| POST | `/dashboard/organization/ratings` |
| GET | `/dashboard/organization/ratings` |

### `@Controller('dashboard/comms')`
| Method | Path |
|---|---|
| GET | `/dashboard/comms/notifications` |
| PATCH | `/dashboard/comms/notifications/mark-read` |
| GET | `/dashboard/comms/email-templates` |
| POST | `/dashboard/comms/email-templates` |
| GET | `/dashboard/comms/email-templates/:id` |
| PATCH | `/dashboard/comms/email-templates/:id` |
| GET | `/dashboard/comms/chat/conversations` |
| GET | `/dashboard/comms/chat/conversations/:id/messages` |

### `@Controller('dashboard/finance')`
| Method | Path |
|---|---|
| POST | `/dashboard/finance/invoices` |
| GET | `/dashboard/finance/invoices/:id` |
| POST | `/dashboard/finance/payments` |
| GET | `/dashboard/finance/payments` |
| POST | `/dashboard/finance/coupons/apply` |
| POST | `/dashboard/finance/zatca/submit` |

### `@Controller('dashboard/ops')`
| Method | Path |
|---|---|
| POST | `/dashboard/ops/reports` |
| GET | `/dashboard/ops/activity` |

### `@Controller('dashboard/ai')`
| Method | Path |
|---|---|
| GET | `/dashboard/ai/knowledge-base` |
| GET | `/dashboard/ai/knowledge-base/:id` |
| PATCH | `/dashboard/ai/knowledge-base/:id` |
| DELETE | `/dashboard/ai/knowledge-base/:id` |
| POST | `/dashboard/ai/chat` |

### `@Controller('dashboard/platform')`
| Method | Path |
|---|---|
| POST | `/dashboard/platform/problem-reports` |
| GET | `/dashboard/platform/problem-reports` |
| PATCH | `/dashboard/platform/problem-reports/:id/status` |
| POST | `/dashboard/platform/integrations` |
| GET | `/dashboard/platform/integrations` |

### `@Controller('dashboard/media')`
| Method | Path |
|---|---|
| POST | `/dashboard/media/upload` |
| GET | `/dashboard/media/:id` |
| DELETE | `/dashboard/media/:id` |
| GET | `/dashboard/media/:id/presigned-url` |

### `@Controller('auth')`
| Method | Path |
|---|---|
| POST | `/auth/login` |
| POST | `/auth/refresh` |
| POST | `/auth/logout` |

### `@Controller('public/*')`
| Method | Path |
|---|---|
| GET | `/public/services/:tenantId` |
| GET | `/public/availability` |
| GET | `/public/branding/:tenantId` |

### `@Controller('mobile/client/*')`
| Method | Path |
|---|---|
| POST | `/mobile/client/bookings` |
| GET | `/mobile/client/bookings` |
| GET | `/mobile/client/bookings/:id` |
| PATCH | `/mobile/client/bookings/:id/cancel` |
| PATCH | `/mobile/client/bookings/:id/reschedule` |
| GET | `/mobile/client/profile` |
| PATCH | `/mobile/client/profile` |
| GET | `/mobile/client/payments` |
| GET | `/mobile/client/payments/invoices/:id` |
| POST | `/mobile/client/chat` |
| GET | `/mobile/client/chat/conversations` |
| GET | `/mobile/client/chat/conversations/:id/messages` |
| GET | `/mobile/client/notifications` |
| PATCH | `/mobile/client/notifications/mark-read` |
| GET | `/mobile/client/portal/home` |
| GET | `/mobile/client/portal/upcoming` |
| GET | `/mobile/client/portal/summary` |

### `@Controller('mobile/employee/*')`
| Method | Path |
|---|---|
| GET | `/mobile/employee/schedule/today` |
| GET | `/mobile/employee/schedule/weekly` |
| PATCH | `/mobile/employee/schedule/availability` |
| GET | `/mobile/employee/clients` |
| GET | `/mobile/employee/clients/:clientId/history` |
| GET | `/mobile/employee/earnings` |

---

## Full Gap Analysis

### ✅ يعمل بدون تغيير (28 endpoint groups)

| Dashboard API File | Endpoints | الحالة |
|---|---|---|
| `bookings.ts` | كل الـ CRUD + actions | ✅ |
| `clients.ts` | GET/POST/PATCH | ✅ |
| `email-templates.ts` | GET/POST/PATCH | ✅ |
| `notifications.ts` | GET/PATCH mark-read | ✅ |
| `payments.ts` | GET/POST | ✅ |
| `invoices.ts` | GET/:id | ✅ |
| `reports.ts` | POST | ✅ |
| `activity-log.ts` | GET | ✅ |
| `whitelabel.ts` | GET/POST branding | ✅ |
| `intake-forms.ts` | GET/POST/GET/:id | ✅ |
| `integrations.ts` | GET/POST | ✅ |
| `media.ts` | POST/GET/DELETE/presigned | ✅ |
| `auth.ts` (login/refresh/logout) | POST ×3 | ✅ |
| `organization.ts` (hours/holidays) | GET/POST/DELETE | ✅ |

---

### ⚠️ يحتاج تعديل prefix في الداشبورد فقط (7 ملفات)

| الملف | Path القديم | Path الجديد |
|---|---|---|
| `lib/api/employees.ts` | `/employees` | `/dashboard/people/employees` |
| `lib/api/branches.ts` | `/branches` | `/dashboard/organization/branches` |
| `lib/api/departments.ts` | `/departments` | `/dashboard/organization/departments` |
| `lib/api/services.ts` | `/services` | `/dashboard/organization/services` |
| `lib/api/ratings.ts` | `/ratings` | `/dashboard/organization/ratings` |
| `lib/api/problem-reports.ts` | `/problem-reports` | `/dashboard/platform/problem-reports` |
| `lib/api/chatbot-kb.ts` | `/chatbot/knowledge-base` | `/dashboard/ai/knowledge-base` |

---

### ❌ فجوات — النوع A: Module موجود، يحتاج Controller أو Handler

#### A1 — Handler موجود، يحتاج endpoint فقط

| الـ Endpoint المطلوب | الـ Handler الموجود | الملف |
|---|---|---|
| `GET /auth/me` | `identity/get-current-user/get-current-user.handler.ts` | يُضاف لـ `auth.controller.ts` |
| `PATCH /auth/password/change` | `identity/shared` | يُضاف لـ `auth.controller.ts` |
| `GET/POST/PATCH/DELETE /dashboard/identity/users` | `identity/users/*.handler.ts` | يُنشأ `users.controller.ts` |
| `PATCH /dashboard/identity/users/:id/activate\|deactivate` | `identity/users/deactivate-user.handler.ts` | نفس الـ controller |
| `GET/POST/DELETE /dashboard/identity/roles` | `identity/roles/*.handler.ts` | يُنشأ `identity.controller.ts` |
| `POST /dashboard/identity/roles/:id/permissions` | `identity/roles/assign-permissions.handler.ts` | نفس الـ controller |
| `GET /dashboard/identity/permissions` | `identity/casl` | نفس الـ controller |
| `GET/PUT /dashboard/platform/license` | `platform/license/*.handler.ts` | يُضاف لـ `platform.controller.ts` |

#### A2 — يحتاج Handler + Controller

| الـ Endpoint المطلوب | الوضع |
|---|---|
| `DELETE /dashboard/people/employees/:id` | handler مفقود في `people/employees` |
| `PUT /dashboard/people/employees/:id/breaks` | handler مفقود |
| `GET /dashboard/people/employees/:id/vacations` + POST/DELETE | handlers مفقودة |
| `GET /dashboard/people/employees/:id/services` + POST/PATCH/DELETE | handlers مفقودة |
| `GET /dashboard/people/employees/:id/slots` | handler مفقود |
| `GET /dashboard/people/employees/:id/ratings` | handler مفقود |
| `GET/POST/PATCH/DELETE /dashboard/finance/coupons` (CRUD كامل) | apply فقط موجود، CRUD مفقود |
| `GET /dashboard/finance/zatca/config` | handler مفقود |
| `POST /dashboard/finance/zatca/onboard` | handler مفقود |
| `GET /dashboard/finance/zatca/sandbox/stats` | handler مفقود |
| `GET /dashboard/organization/settings` | module غير موجود |
| `PATCH /dashboard/organization/settings/booking-flow` | module غير موجود |
| `PATCH /dashboard/organization/settings/payment` | module غير موجود |
| `GET/PATCH /dashboard/organization/booking-settings` | module غير موجود |

---

### ❌ فجوات — النوع B: غائب كليًا (لا module، لا logic)

| Domain | الـ Endpoints المطلوبة | الحجم |
|---|---|---|
| **Groups** | GET/POST/PATCH/DELETE + cancel, complete, trigger-payment, confirm-schedule, enroll, remove-enrollment, bulk-attendance, certificate, resend-payment, attendance | ضخم — domain كامل |
| **Feature Flags** | GET/PATCH `/feature-flags` + GET `/feature-flags/map` | صغير |
| **Runs** | GET/POST pause/cancel `/runs/:id` | صغير — غير واضح المقصود |
| **Auth OTP** | POST `/auth/login/otp/send` + `/auth/login/otp/verify` | متوسط |
| **Auth Register** | POST `/auth/register` | صغير |

---

### ❌ فجوات — النوع C: Public/Widget endpoints مفقودة

| الـ Endpoint المطلوب | الوضع |
|---|---|
| `GET /branches/public` | لا يوجد public branches endpoint |
| `POST /coupons/validate` | لا يوجد |
| `GET /employees` (public للـ widget) | الموجود dashboard فقط |
| `GET /services` (public للـ widget) | الموجود dashboard فقط |
| `POST /bookings` (widget — بدون auth) | الموجود `/mobile/client/bookings` يتطلب auth |
| `GET /public/branding` (بدون tenantId) | الجديد يطلب tenantId إلزامي |
| `GET /public/services` (بدون tenantId) | الجديد يطلب tenantId إلزامي |

---

## إحصائيات

| التصنيف | العدد |
|---|---|
| ✅ يعمل بدون تغيير | 28 |
| ⚠️ prefix fix في الداشبورد فقط | 7 ملفات |
| ❌ A1 — controller/endpoint فقط (logic جاهزة) | 8 |
| ❌ A2 — handler + controller | 14 |
| ❌ B — بناء كامل من صفر | 5 domains |
| ❌ C — public/widget endpoints | 7 |

---

## الخطوة التالية

المرحلة 2 — تحديد أولويات التنفيذ وتصنيف كل فجوة بـ:
- الطرف المسؤول عن الإصلاح (باك / داشبورد / كلاهما)
- الأولوية (حرج / عالي / متوسط / منخفض)
- الاعتمادية (ما يجب يكتمل أولًا)
