# CareKit Dashboard

لوحة تحكم منصة إدارة العيادات الذكية — CareKit by WebVue Technology Solutions.

---

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **UI:** shadcn/ui + Tailwind CSS v4
- **State:** TanStack Query v5
- **Forms:** React Hook Form + Zod
- **Icons:** Hugeicons React
- **Tables:** TanStack Table v8
- **i18n:** next-intl (Arabic + English, RTL-first)

---

## Quick Start

```bash
npm install
npm run dev
```

| الأمر | الوظيفة |
| ----- | ------- |
| `npm run dev` | بيئة التطوير على port 3000 |
| `npm run build` | بناء production |
| `npm run typecheck` | فحص TypeScript |
| `npm run lint` | فحص القواعد المعمارية |
| `npm run format` | تنسيق الكود |

---

## وثائق المشروع — Docs

> **ابدأ من هنا** قبل كتابة أي كود:

| الملف | اقرأه عند |
| ----- | --------- |
| **[CONTRIBUTING.md](./CONTRIBUTING.md)** | أول مرة تعمل على المشروع |
| **[ARCHITECTURE.md](./ARCHITECTURE.md)** | قبل إضافة أي ملف أو feature |
| **[DESIGN-SYSTEM.md](./DESIGN-SYSTEM.md)** | قبل كتابة أي UI |
| **[components-policy.md](./components-policy.md)** | قبل إنشاء أي مكون |
| **[CODEOWNERS](./CODEOWNERS)** | لمعرفة من يراجع ماذا |
| **[docs/refactor-roadmap.md](./docs/refactor-roadmap.md)** | جدول الصيانة الدوري |

---

## هيكل الكود — Structure

```text
app/(dashboard)/[feature]/    ← Pages (orchestration only)
components/features/[feature]/ ← Feature UI components
components/ui/                 ← shadcn primitives (لا تُعدَّل)
hooks/                         ← React Query hooks
lib/api/                       ← Network calls
lib/types/                     ← TypeScript types
lib/schemas/                   ← Zod validation
lib/translations/              ← i18n strings (ar + en)
```

قاعدة الاستيراد: `app → components → hooks → lib` (أحادي الاتجاه)

---

## Features (20)

| المجموعة | الـ Features |
| --------- | ----------- |
| Clinical Core | bookings, clients, employees |
| Financial | payments, invoices, coupons |
| Compliance | zatca |
| Catalog | services, branches, intake-forms |
| Config | settings, white-label |
| Users | users |
| AI & Comms | chatbot, notifications |
| Operations | reports, ratings, activity-log |
