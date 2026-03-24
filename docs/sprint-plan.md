# CareKit — خطة المهام المتبقية

> **آخر تحديث:** 2026-03-24
> **المنجزات السابقة:** [`docs/achievements.md`](achievements.md)
> المراحل المكتملة: Phase 1–5 + Sprint 4.5 + Sprint 4.6

---

## قواعد العمل الصارمة

1. **لا يتجاوز أي ملف 350 سطراً** — فوراً يُقسم عند الاقتراب
2. **لا كود بدون مراجعة الـ schema أولاً** — الـ Prisma schema هو مصدر الحقيقة
3. **كل migration تُراجع قبل التطبيق**
4. **كل endpoint له Swagger decorator + unit test**
5. **لا hardcoded values** — كل شيء في constants/ أو env
6. **RTL-first في كل مكون**
7. **كل رسالة commit بالإنجليزية — Conventional Commits فقط**

---

## نظرة عامة — المراحل المتبقية

```
Phase 5 — إعادة تصميم وتوحيد Dashboard          ✅ 100%  ← docs/phase5-workplan.md
Phase 6 — الموقع الإلكتروني (Website)             🔲 0%
Phase 7 — التطبيق (Mobile Polishing + Store)      🔲 0%
Phase 8 — Production Readiness                     🔲 0%
Phase 9 — Testing & Delivery                       🔲 0%
```

---

## مؤجلات من Sprint 4.6

> يجب إنهاؤها قبل أو خلال المراحل القادمة

| # | المهمة | الملف | تُنجز في |
|---|--------|-------|----------|
| I-01 | Zoom API integration الفعلية (بدل الـ stub الحالي) | `zoom.service.ts` | Phase 8 |
| I-09 | تحديث Zoom link عند reschedule لحجز فيديو | `bookings.service.ts` | Phase 8 |
| D-02 | صفحة Notifications في Dashboard (حالياً placeholder) | Dashboard | Phase 5 |

---

## Phase 5 — إعادة تصميم وتوحيد Dashboard 🔲

> **الهدف:** توحيد التصميم المرئي لكل صفحات الداشبورد — تجربة مستخدم متسقة واحترافية
> **خطة العمل التفصيلية:** [`docs/phase5-workplan.md`](phase5-workplan.md)
> **الحالة الحالية:** 5 صفحات من 12 (4 mock + 1 API) — تغطية API: 10%
> **الهيكل:** 4 sprints فرعية (5.0 بنية تحتية → 5.1 صفحات أساسية → 5.2 صفحات ثانوية → 5.3 DS + 5.4 UX)

### 5.1 — Design System & Tokens

| # | المهمة | الوصف | الحالة |
|---|--------|-------|--------|
| 5.1.1 | تعريف Design Tokens | ألوان، spacing، typography، shadows، border-radius — متغيرات CSS موحدة | 🔲 |
| 5.1.2 | Color Palette | ألوان رئيسية + ثانوية + neutral + semantic (success/warning/error/info) + dark mode | 🔲 |
| 5.1.3 | Typography Scale | أحجام الخطوط + line-height + font-weight — نظام واحد | 🔲 |
| 5.1.4 | Spacing System | نظام spacing متسق (4px base) | 🔲 |
| 5.1.5 | RTL Audit | مراجعة كل المكونات للتأكد من دعم RTL الصحيح | 🔲 |

### 5.2 — توحيد المكونات الأساسية

| # | المهمة | الوصف | الحالة |
|---|--------|-------|--------|
| 5.2.1 | Data Tables | توحيد شكل الجداول في كل الصفحات (header, rows, pagination, search, filters) | 🔲 |
| 5.2.2 | Forms | توحيد شكل الفورمات (labels, inputs, validation errors, buttons) | 🔲 |
| 5.2.3 | Cards & Stats | توحيد البطاقات الإحصائية والمعلوماتية | 🔲 |
| 5.2.4 | Modals & Sheets | توحيد الحوارات والـ side sheets | 🔲 |
| 5.2.5 | Navigation | تحسين Sidebar + Header + Breadcrumbs | 🔲 |
| 5.2.6 | Empty States | تصميم حالات "لا بيانات" موحدة لكل صفحة | 🔲 |
| 5.2.7 | Loading States | Skeleton loaders موحدة | 🔲 |

### 5.3 — إعادة تصميم الصفحات

| # | الصفحة | المطلوب | الحالة |
|---|--------|---------|--------|
| 5.3.1 | Dashboard Home | إعادة تصميم الصفحة الرئيسية — stats + charts + recent activity + quick actions | 🔲 |
| 5.3.2 | Appointments | تحسين العرض — calendar view + list view + filters | 🔲 |
| 5.3.3 | Practitioners | تحسين القائمة + صفحة التفاصيل (profile, schedule, services, ratings) | 🔲 |
| 5.3.4 | Patients | تحسين القائمة + صفحة التفاصيل (medical history, bookings, payments) | 🔲 |
| 5.3.5 | Services | تحسين عرض الخدمات والفئات | 🔲 |
| 5.3.6 | Invoices | تحسين العرض مع ZATCA status واضح | 🔲 |
| 5.3.7 | Payments | تحسين العرض + مراجعة التحويلات البنكية | 🔲 |
| 5.3.8 | Reports | تحسين التقارير والرسوم البيانية | 🔲 |
| 5.3.9 | Users & Roles | توحيد إدارة المستخدمين والأدوار | 🔲 |
| 5.3.10 | Notifications | بناء صفحة Notifications كاملة (بدل placeholder) | 🔲 |
| 5.3.11 | Chatbot | تحسين واجهة Chatbot settings + conversations + analytics | 🔲 |
| 5.3.12 | Settings | تحسين صفحة الإعدادات (7 tabs) | 🔲 |

### 5.4 — تحسينات UX

| # | المهمة | الوصف | الحالة |
|---|--------|-------|--------|
| 5.4.1 | Responsive Design | التأكد من عمل كل الصفحات على tablet + mobile | 🔲 |
| 5.4.2 | Dark Mode | تطبيق dark mode متسق على كل الصفحات | 🔲 |
| 5.4.3 | Animations | transitions ناعمة بين الصفحات والحالات | 🔲 |
| 5.4.4 | Toast & Feedback | توحيد رسائل النجاح والخطأ | 🔲 |
| 5.4.5 | Keyboard Shortcuts | اختصارات لوحة مفاتيح للعمليات الشائعة | 🔲 |

### معيار إتمام Phase 5

- كل الصفحات بتصميم موحد ومتسق
- Dark mode يعمل على كل الصفحات
- RTL يعمل بشكل صحيح
- لا صفحات placeholder فاضية
- Responsive على tablet

---

## Phase 6 — الموقع الإلكتروني (Website) 🔲

> **الهدف:** موقع تعريفي احترافي للعيادة — يتخصص حسب إعدادات White Label

### 6.1 — الهيكل والبنية

| # | المهمة | الوصف | الحالة |
|---|--------|-------|--------|
| 6.1.1 | إنشاء مشروع Website | Next.js 14 + Tailwind + i18n (AR/EN) داخل الـ monorepo | 🔲 |
| 6.1.2 | ربط بـ White Label Config | سحب اللوقو والألوان والخطوط من إعدادات الداشبورد | 🔲 |
| 6.1.3 | SEO Setup | meta tags, sitemap, robots.txt, structured data (Schema.org) | 🔲 |

### 6.2 — الصفحات

| # | الصفحة | الوصف | الحالة |
|---|--------|-------|--------|
| 6.2.1 | الرئيسية (Landing) | hero + خدمات + أطباء مميزين + تقييمات + CTA | 🔲 |
| 6.2.2 | من نحن (About) | تعريف العيادة + الرؤية + الفريق | 🔲 |
| 6.2.3 | الخدمات (Services) | عرض كل الخدمات مع التفاصيل والأسعار | 🔲 |
| 6.2.4 | الأطباء (Practitioners) | قائمة الأطباء مع التخصص والتقييمات + صفحة تفصيلية لكل طبيب | 🔲 |
| 6.2.5 | احجز موعد (Book) | نموذج حجز مبسّط — أو redirect للتطبيق | 🔲 |
| 6.2.6 | تواصل معنا (Contact) | نموذج تواصل + خريطة + معلومات الاتصال | 🔲 |
| 6.2.7 | الأسئلة الشائعة (FAQ) | أسئلة وأجوبة من Knowledge Base | 🔲 |
| 6.2.8 | سياسة الخصوصية + الشروط | صفحات قانونية | 🔲 |

### 6.3 — المميزات

| # | المهمة | الوصف | الحالة |
|---|--------|-------|--------|
| 6.3.1 | Chatbot Widget | ويدجت المحادثة الذكية على الموقع | 🔲 |
| 6.3.2 | Online Booking | حجز مواعيد مباشرة من الموقع (أو redirect للتطبيق) | 🔲 |
| 6.3.3 | Practitioner Profiles | صفحات SEO-friendly لكل طبيب | 🔲 |
| 6.3.4 | Blog/Articles | مقالات طبية (اختياري — حسب العميل) | 🔲 |
| 6.3.5 | WhatsApp Integration | زر واتساب للتواصل المباشر | 🔲 |

### معيار إتمام Phase 6

- موقع كامل يعمل بالعربي والإنجليزي
- متجاوب (mobile-first)
- SEO محسّن
- متصل بـ White Label Config
- سرعة تحميل ممتازة (Core Web Vitals)

---

## Phase 7 — التطبيق (Mobile Polishing + Store) 🔲

> **الهدف:** تجهيز التطبيق للنشر على App Store و Google Play

### 7.1 — تحسين التصميم

| # | المهمة | الوصف | الحالة |
|---|--------|-------|--------|
| 7.1.1 | Design System Review | مراجعة وتوحيد tokens/theme عبر كل الشاشات | 🔲 |
| 7.1.2 | Onboarding Screens | شاشات ترحيبية للمستخدم الجديد (3-4 slides) | 🔲 |
| 7.1.3 | Splash Screen | شاشة تحميل بلوقو العيادة (من White Label) | 🔲 |
| 7.1.4 | App Icon | أيقونة التطبيق (ديناميكية حسب العميل أو ثابتة) | 🔲 |
| 7.1.5 | Animations & Transitions | حركات سلسة بين الشاشات | 🔲 |
| 7.1.6 | Error States | شاشات خطأ محسّنة (no internet, server error, empty states) | 🔲 |
| 7.1.7 | Pull to Refresh | تحديث بالسحب في القوائم | 🔲 |

### 7.2 — المميزات الناقصة

| # | المهمة | الوصف | الحالة |
|---|--------|-------|--------|
| 7.2.1 | Push Notifications (FCM) | ربط فعلي بـ Firebase Cloud Messaging | 🔲 |
| 7.2.2 | Deep Links | فتح شاشات محددة من الإشعارات أو الروابط | 🔲 |
| 7.2.3 | Offline Support | تخزين مؤقت للبيانات الأساسية | 🔲 |
| 7.2.4 | Biometric Auth | Face ID / Fingerprint لتسجيل الدخول | 🔲 |
| 7.2.5 | Image Upload (Profile) | رفع صورة الملف الشخصي (MinIO) | 🔲 |
| 7.2.6 | Practitioner Notifications | شاشة إشعارات الممارس | 🔲 |
| 7.2.7 | Practitioner Settings | إعدادات الممارس (أوقات العمل، إجازات) | 🔲 |

### 7.3 — App Store Submission

| # | المهمة | الوصف | الحالة |
|---|--------|-------|--------|
| 7.3.1 | EAS Build Setup | إعداد Expo Application Services للبناء | 🔲 |
| 7.3.2 | Apple Developer Account | إعداد الحساب + certificates + provisioning profiles | 🔲 |
| 7.3.3 | Google Play Console | إعداد الحساب + signing key | 🔲 |
| 7.3.4 | App Store Screenshots | سكرين شوتات لكل حجم شاشة (iPhone + iPad + Android) | 🔲 |
| 7.3.5 | App Store Listing | وصف التطبيق + keywords + privacy policy | 🔲 |
| 7.3.6 | TestFlight / Internal Testing | اختبار داخلي قبل النشر | 🔲 |
| 7.3.7 | Submit to Stores | رفع للمراجعة (Apple 1-2 أسبوع) | 🔲 |

### معيار إتمام Phase 7

- تصميم موحد واحترافي على iOS + Android
- Push notifications تعمل
- Deep links تعمل
- التطبيق مرفوع على TestFlight + Internal Testing
- جاهز للنشر

---

## Phase 8 — Production Readiness 🔲

| # | المهمة | الوصف | الحالة |
|---|--------|-------|--------|
| 8.1 | Zoom API Integration | ربط فعلي بـ Zoom API — إنشاء اجتماعات تلقائياً + تحديث عند reschedule | 🔲 |
| 8.2 | PDF Invoices | توليد فواتير PDF (Puppeteer أو React-PDF) | 🔲 |
| 8.3 | ZATCA Phase 2 | CSR + CSID + production flow كامل | 🔲 |
| 8.4 | Email Templates | قوالب بريد إلكتروني احترافية (تأكيد حجز، إلغاء، إيصال، OTP) | 🔲 |
| 8.5 | Docker Production | multi-stage builds + secrets + health checks + nginx | 🔲 |
| 8.6 | CI/CD Pipeline | GitHub Actions → build → test → deploy to Dokploy | 🔲 |
| 8.7 | Monitoring | Sentry (errors) + health check endpoints + logging | 🔲 |
| 8.8 | Security Hardening | rate limiting, CORS, helmet, input sanitization, OWASP audit | 🔲 |
| 8.9 | Performance | load testing, DB query optimization, caching strategy (Redis) | 🔲 |
| 8.10 | Backup & Recovery | نسخ احتياطي تلقائي لقاعدة البيانات + MinIO | 🔲 |

### معيار إتمام Phase 8

- كل الخدمات الخارجية (Zoom, Email, FCM, Moyasar) مربوطة فعلياً
- Docker production-ready
- CI/CD يعمل
- Monitoring مُعد
- Security audit passed

---

## Phase 9 — Testing & Delivery 🔲

| # | المهمة | الوصف | الحالة |
|---|--------|-------|--------|
| 9.1 | E2E Testing | Playwright — كل user flows الأساسية (auth, booking, payment, cancel) | 🔲 |
| 9.2 | Integration Testing | اختبار تكاملي لكل الـ API endpoints | 🔲 |
| 9.3 | RTL + i18n Testing | اختبار كل الشاشات بالعربي والإنجليزي | 🔲 |
| 9.4 | Performance Testing | load testing + Core Web Vitals | 🔲 |
| 9.5 | Security Testing | penetration testing + OWASP top 10 | 🔲 |
| 9.6 | UAT | اختبار قبول المستخدم مع العميل | 🔲 |
| 9.7 | Documentation | دليل تثبيت + API docs (Swagger) + دليل مستخدم عربي | 🔲 |
| 9.8 | App Store Publish | نشر على App Store + Google Play | 🔲 |
| 9.9 | Client Training | تدريب العميل على الداشبورد | 🔲 |
| 9.10 | Go Live | إطلاق رسمي 🚀 | 🔲 |

### معيار إتمام Phase 9

- كل الاختبارات تمر
- التوثيق مكتمل
- التطبيق منشور على المتاجر
- العميل مدرّب
- النظام يعمل في Production

---

## نقاط مراجعة إلزامية

- ✋ تطبيق أي migration على قاعدة البيانات
- ✋ إرسال أي طلب لـ ZATCA حتى Sandbox
- ✋ أي تعديل على Payment model
- ✋ الانتقال من Phase 1 لـ Phase 2 في ZATCA
- ✋ نشر أي build لـ App Store / Play Store
- ✋ أي push لـ production

---

## الموارد والمكتبات

### Backend (NestJS + Prisma)

| Package | Purpose |
|---------|---------|
| `@nestjs/passport` + `passport-jwt` | JWT Auth |
| `@casl/ability` + `@casl/prisma` | Dynamic RBAC |
| `@nestjs/swagger` | API Documentation |
| `@nestjs/bull` + `bullmq` | Job Queues |
| `@nestjs/schedule` | Cron Jobs |
| `nestjs-i18n` | i18n (AR/EN) |
| `@nestjs/throttler` | Rate Limiting |
| `class-validator` + `class-transformer` | Validation |
| `@nestjs-modules/mailer` | Email |
| `minio` | S3-compatible storage |

### Mobile (Expo SDK 54)

| Package | Purpose |
|---------|---------|
| `expo-router` v6 | Navigation |
| `@reduxjs/toolkit` + `redux-persist` | State Management |
| `react-hook-form` + `zod` | Form Validation |
| `expo-notifications` | Push (FCM) |
| `expo-image-picker` | Receipt upload |
| `i18next` + `react-i18next` | i18n |
| `axios` | API Client |
| `expo-secure-store` | Token storage |

### Dashboard (Next.js 14)

| Package | Purpose |
|---------|---------|
| `shadcn/ui` (33 component) | UI Components |
| `@tanstack/react-table` | Data Tables |
| `recharts` | Charts |
| `react-hook-form` + `zod` | Forms |
| `next-intl` | i18n |
| `nuqs` | URL State |
| `lucide-react` | Icons |

### External Services

| Service | Technology |
|---------|-----------|
| Payment | Moyasar SDK |
| Video | Zoom API |
| Email | Resend / SendGrid |
| Push | Firebase FCM |
| Storage | MinIO (self-hosted) |
| AI | OpenRouter API (multi-model) |

---

## Critical Path

```
Phase 5 (Dashboard Design) → Phase 6 (Website) → Phase 7 (Mobile + Store)
                                                          ↓
                                              Phase 8 (Production) → Phase 9 (Testing & Go Live)
```

---

*CareKit — WebVue Technology Solutions — آخر تحديث: 2026-03-23*
