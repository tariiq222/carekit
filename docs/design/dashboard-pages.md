# CareKit Dashboard — Admin Pages Specification

16 admin dashboard pages. Built with Next.js 14 + shadcn/ui + Tailwind. Dark mode + RTL-first.

---

## Page Index

| # | Page | Route | Sidebar Section |
|---|------|-------|-----------------|
| A01 | Login | `/auth/login` | - |
| A02 | Dashboard Home | `/` | Home |
| A03 | Appointments | `/appointments` | Main |
| A04 | Appointment Detail | `/appointments/[id]` | Main |
| A05 | Employees | `/employees` | Main |
| A06 | Employee Detail | `/employees/[id]` | Main |
| A07 | Clients | `/clients` | Main |
| A08 | Client Detail | `/clients/[id]` | Main |
| A09 | Services | `/services` | Main |
| A10 | Payments | `/payments` | Finance |
| A11 | Invoices | `/invoices` | Finance |
| A12 | Financial Reports | `/reports` | Finance |
| A13 | Chatbot Management | `/chatbot` | System |
| A14 | Users & Roles | `/users` | System |
| A15 | White Label Settings | `/settings` | System |
| A16 | Notifications | `/notifications` | System |

---

## A01 — Login

**Purpose:** Admin/staff authentication

**Layout:**
```
┌────────────────────────────────────────────────────────┐
│                                                        │
│                   [Client Logo]                        │
│                   [App Name]                           │
│                                                        │
│              ┌─────────────────────┐                   │
│              │                     │                   │
│              │  تسجيل الدخول       │                   │
│              │  Sign In             │                   │
│              │                     │                   │
│              │  البريد الإلكتروني   │                   │
│              │  ┌─────────────┐    │                   │
│              │  │             │    │                   │
│              │  └─────────────┘    │                   │
│              │                     │                   │
│              │  كلمة المرور        │                   │
│              │  ┌─────────────┐    │                   │
│              │  │         [👁] │    │                   │
│              │  └─────────────┘    │                   │
│              │                     │                   │
│              │  [تسجيل الدخول]     │                   │
│              │                     │                   │
│              │  نسيت كلمة المرور؟  │                   │
│              │                     │                   │
│              └─────────────────────┘                   │
│                                                        │
│              🌐 العربية | English                       │
│                                                        │
└────────────────────────────────────────────────────────┘
```

**Behavior:**
- Email + password only (no OTP for admin)
- Language toggle at bottom
- On success: redirect to dashboard home
- Failed attempts: show error inline
- Rate limited (throttled) after 5 failed attempts

---

## A02 — Dashboard Home

**Purpose:** Overview with stats, today's agenda, and pending actions

**Layout:**
```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ Sidebar │                                                                       │
│         │  الرئيسية / Dashboard                             [🔔 3] [👤 Admin]    │
│ ● Home  │──────────────────────────────────────────────────────────────────────── │
│         │                                                                       │
│ 📋 Appts│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                 │
│ 👨‍⚕️ Docs │  │ مواعيد اليوم│ │  الإيرادات │ │ مرضى جدد  │ │ إجراء مطلوب│                 │
│ 👥 Pts  │  │    12     │ │ 5,400 ر.س│ │    3     │ │    5     │                 │
│ 🏥 Svcs │  │  Today's  │ │ Revenue  │ │   New    │ │ Pending  │                 │
│         │  │  Bookings │ │  Today   │ │ Clients │ │ Actions  │                 │
│ 💰 Fin  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘                 │
│  ├ Pay  │                                                                       │
│  ├ Inv  │  ┌──────────────────────────┐ ┌──────────────────────────┐            │
│  └ Rpt  │  │ مواعيد اليوم              │ │ إجراءات معلقة             │            │
│         │  │ Today's Appointments      │ │ Pending Actions           │            │
│ 🤖 Chat │  │                          │ │                          │            │
│ 👤 Users│  │ 09:00  أحمد سالم         │ │ ⚠️ 2 طلبات إلغاء          │            │
│ ⚙️ Sett │  │        د. أحمد  🏥 مؤكد  │ │    Cancellation requests  │            │
│         │  │                          │ │                          │            │
│         │  │ 10:30  خالد محمد         │ │ 🏦 3 تحويلات بنكية         │            │
│         │  │        د. سارة  📹 مؤكد  │ │    Bank transfers pending │            │
│         │  │                          │ │                          │            │
│         │  │ 14:30  سارة أحمد         │ │                          │            │
│         │  │        د. أحمد  📞 مؤكد   │ │                          │            │
│         │  │                          │ │                          │            │
│         │  │ [عرض الكل / View All]    │ │ [عرض الكل / View All]    │            │
│         │  └──────────────────────────┘ └──────────────────────────┘            │
│         │                                                                       │
│         │  ┌────────────────────────────────────────────────────────┐            │
│         │  │ الإيرادات — آخر 30 يوم / Revenue — Last 30 Days       │            │
│         │  │                                                        │            │
│         │  │  [Recharts line/bar chart]                              │            │
│         │  │                                                        │            │
│         │  └────────────────────────────────────────────────────────┘            │
│         │                                                                       │
└─────────┴───────────────────────────────────────────────────────────────────────┘
```

**Stats cards:**
1. Today's bookings count
2. Today's revenue (SAR)
3. New clients this week
4. Pending actions (cancellations + bank transfers)

**Sections:**
- Today's appointments: mini-list, click to navigate
- Pending actions: cancellation requests + bank transfer verifications
- Revenue chart: last 30 days, Recharts line chart

**Behavior:**
- Data refreshes on page load (server component)
- Pending actions badge shows count
- Click any section → navigates to relevant page

---

## A03 — Appointments

**Purpose:** Full appointment management with calendar and table views

**Layout:**
```
┌──────────────────────────────────────────────────────────────────────┐
│  المواعيد / Appointments                          [+ حجز جديد]       │
│──────────────────────────────────────────────────────────────────────│
│                                                                      │
│  ┌────────────┐ ┌─────────┐                                         │
│  │ 📅 تقويم   │ │ 📋 جدول │                    ← Toggle views       │
│  │  Calendar  │ │  Table  │                                         │
│  └────────────┘ └─────────┘                                         │
│                                                                      │
│  [Calendar View — react-big-calendar]                                │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │ ◀  مارس 2026  ▶          [يوم] [أسبوع] [شهر]                │    │
│  │──────────────────────────────────────────────────────────────│    │
│  │      الأحد     الاثنين    الثلاثاء   الأربعاء   ...          │    │
│  │ 08:00                                                        │    │
│  │ 09:00  ┌──────┐                                              │    │
│  │        │أحمد  │                                              │    │
│  │ 09:30  │تنظيف │                                              │    │
│  │        └──────┘                                              │    │
│  │ 10:00           ┌──────┐                                     │    │
│  │                 │خالد  │                                     │    │
│  │ 10:30           │فحص📹 │                                     │    │
│  │                 └──────┘                                     │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  OR                                                                  │
│                                                                      │
│  [Table View — TanStack Table]                                       │
│  Filters: [الحالة ▼] [الطبيب ▼] [النوع ▼] [من تاريخ] [إلى تاريخ]   │
│  ┌──────┬────────────┬───────────┬────────┬────────┬────────────┐    │
│  │ #    │ المريض      │ الطبيب    │ النوع  │ التاريخ │ الحالة     │    │
│  ├──────┼────────────┼───────────┼────────┼────────┼────────────┤    │
│  │ 1234 │ أحمد سالم   │ د. أحمد   │ 🏥     │ 22/03  │ مؤكد ✅    │    │
│  │ 1235 │ خالد محمد   │ د. سارة   │ 📹     │ 22/03  │ قيد الانتظار│   │
│  │ 1236 │ فاطمة علي   │ د. أحمد   │ 📞     │ 23/03  │ طلب إلغاء ⚠️│   │
│  └──────┴────────────┴───────────┴────────┴────────┴────────────┘    │
│  ◀ 1 2 3 ... 10 ▶    عرض 10 | 25 | 50                               │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**Behavior:**
- Toggle between calendar view and table view
- Calendar: day/week/month views. Click appointment → A04 slide-over
- Table: sortable columns, filterable, paginated (TanStack Table)
- "New Booking" button → modal with booking form
- Status filter includes "pending_cancellation" for admin action
- Export to CSV/Excel

**Create Appointment Modal:**
- Client selector (search by name/email)
- Employee selector
- Service selector
- Type selector
- Date/time picker
- Notes

---

## A04 — Appointment Detail (Slide-over Panel)

**Purpose:** Full appointment details with admin actions

Opens as a slide-over panel from the right (RTL: left) when clicking an appointment.

**Content:**
- Booking ID, status badge
- Client info: name, email, phone
- Employee info: name, specialty
- Service, type, date, time
- Payment status + method + amount
- Client notes
- Timeline: created → confirmed → completed/cancelled

**Admin Actions:**
- Change status (pending → confirmed, confirmed → completed)
- Process cancellation (if pending_cancellation):
  - Approve with: full refund / partial refund / no refund
  - Reject (keep appointment)
- View/download invoice
- Resend confirmation email

---

## A05 — Employees

**Purpose:** Manage employees

**Layout:**
```
┌──────────────────────────────────────────────────────────────────────┐
│  الأطباء / Employees                          [+ إضافة طبيب]    │
│──────────────────────────────────────────────────────────────────────│
│                                                                      │
│  ┌──────────────────────────────────────────┐                        │
│  │ 🔍 بحث بالاسم أو التخصص...               │                        │
│  └──────────────────────────────────────────┘                        │
│  Filters: [التخصص ▼] [الحالة ▼]                                      │
│                                                                      │
│  ┌──────────┬───────────┬────────┬────────┬────────┬────────────┐    │
│  │ الطبيب   │ التخصص    │ التقييم │ المواعيد│ الحالة  │ الإجراءات  │    │
│  ├──────────┼───────────┼────────┼────────┼────────┼────────────┤    │
│  │ [A] أحمد │ طب أسنان  │ ⭐ 4.8 │  245   │ نشط ✅ │ [👁] [✏️]  │    │
│  │ [S] سارة │ طب عيون   │ ⭐ 4.9 │  189   │ نشط ✅ │ [👁] [✏️]  │    │
│  │ [M] محمد │ جلدية     │ ⭐ 4.5 │   12   │ معطل ❌│ [👁] [✏️]  │    │
│  └──────────┴───────────┴────────┴────────┴────────┴────────────┘    │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**Behavior:**
- TanStack Table with search, filters, sorting, pagination
- View → A06 (Employee Detail page)
- Edit → inline or modal
- Add → multi-step form (creates User account + Employee profile)

**Add Employee Form:**
- Personal info: name, email, phone, password
- Professional: specialty, bio, qualifications, experience years
- Pricing: clinic visit, phone, video (in SAR, stored as halalat)
- Photo upload
- Availability: weekly schedule (can be set later)

---

## A06 — Employee Detail

**Purpose:** Full employee profile with schedule management

**Tabs:** Profile | Schedule | Appointments | Ratings

**Profile Tab:**
- View/edit all employee info
- Photo, bio, qualifications, pricing
- Toggle active/inactive status

**Schedule Tab:**
- Weekly availability grid (visual)
- Edit start/end time per day
- Vacation manager (add/remove date ranges)
- View conflicts (bookings during proposed off-time)

**Appointments Tab:**
- Table of all appointments for this employee
- Filter by status, date range
- Same columns as A03 table

**Ratings Tab:**
- Overall rating with distribution chart
- Reviews list with client name (first + initial)
- Problem reports section

---

## A07 — Clients

**Purpose:** View and manage client records

**Layout:**
```
┌──────────────────────────────────────────────────────────────────────┐
│  المرضى / Clients                                [تصدير / Export]   │
│──────────────────────────────────────────────────────────────────────│
│                                                                      │
│  ┌──────────────────────────────────────────┐                        │
│  │ 🔍 بحث بالاسم أو البريد أو الهاتف...     │                        │
│  └──────────────────────────────────────────┘                        │
│                                                                      │
│  ┌──────────┬──────────────┬──────────┬──────────┬──────────────┐    │
│  │ المريض   │ البريد        │ الهاتف   │ الزيارات │ آخر زيارة     │    │
│  ├──────────┼──────────────┼──────────┼──────────┼──────────────┤    │
│  │ أحمد سالم│ahmed@email   │ 050...   │    8     │ 22/03/2026   │    │
│  │ فاطمة علي│fatma@email   │ 055...   │    3     │ 20/03/2026   │    │
│  │ خالد محمد│khaled@email  │ 056...   │    1     │ 18/03/2026   │    │
│  └──────────┴──────────────┴──────────┴──────────┴──────────────┘    │
│  ◀ 1 2 3 ... ▶                                                      │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**Behavior:**
- Search by name, email, or phone
- Sortable columns
- Click row → A08 (Client Detail)
- Export to CSV/Excel
- No "Add Client" (clients self-register via mobile app)

---

## A08 — Client Detail

**Purpose:** Full client profile with history

**Tabs:** Profile | Appointments | Payments | Ratings Given

**Profile Tab:**
- Name, email, phone, registration date, status
- Deactivate/reactivate client account

**Appointments Tab:**
- All appointments for this client
- Filter by status, employee, date range

**Payments Tab:**
- All payments by this client
- Total spent
- Payment method breakdown

**Ratings Given Tab:**
- All ratings this client has given
- Useful for identifying problematic clients

---

## A09 — Services

**Purpose:** Manage service categories and services

**Layout:**
```
┌──────────────────────────────────────────────────────────────────────┐
│  الخدمات / Services                    [+ فئة جديدة] [+ خدمة جديدة] │
│──────────────────────────────────────────────────────────────────────│
│                                                                      │
│  طب الأسنان / Dentistry                              [✏️] [🗑️]       │
│  ┌──────────────┬──────────┬──────────┬──────────┬────────────┐      │
│  │ الخدمة       │ المدة    │ السعر    │ الحالة   │ الإجراءات  │      │
│  ├──────────────┼──────────┼──────────┼──────────┼────────────┤      │
│  │ تنظيف أسنان  │ 30 د     │ 150 ر.س  │ نشط ✅  │ [✏️] [🗑️]  │      │
│  │ حشو أسنان    │ 45 د     │ 300 ر.س  │ نشط ✅  │ [✏️] [🗑️]  │      │
│  │ تقويم أسنان  │ 60 د     │ 500 ر.س  │ معطل ❌ │ [✏️] [🗑️]  │      │
│  └──────────────┴──────────┴──────────┴──────────┴────────────┘      │
│                                                                      │
│  طب العيون / Ophthalmology                           [✏️] [🗑️]       │
│  ┌──────────────┬──────────┬──────────┬──────────┬────────────┐      │
│  │ فحص نظر شامل│ 30 د     │ 200 ر.س  │ نشط ✅  │ [✏️] [🗑️]  │      │
│  └──────────────┴──────────┴──────────┴──────────┴────────────┘      │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**Behavior:**
- Services grouped under categories (accordion-style)
- Add/edit/delete categories
- Add/edit/delete services within categories
- Drag to reorder within category (sort order)
- Service form: name (AR + EN), description (AR + EN), duration, price, category, active toggle
- Category form: name (AR + EN), sort order
- Delete: soft delete with confirmation

---

## A10 — Payments

**Purpose:** View all payments and verify bank transfers

**Layout:**
```
┌──────────────────────────────────────────────────────────────────────┐
│  المدفوعات / Payments                                                │
│──────────────────────────────────────────────────────────────────────│
│  ┌──────────────┐ ┌──────────────┐                                   │
│  │ جميع المدفوعات│ │ تحويلات بنكية │                                   │
│  │ All Payments  │ │ Bank Transfers│  ← 3 pending badge              │
│  └──────────────┘ └──────────────┘                                   │
│                                                                      │
│  Filters: [الحالة ▼] [الطريقة ▼] [من تاريخ] [إلى تاريخ]             │
│                                                                      │
│  ┌───────┬──────────┬──────────┬──────────┬──────────┬────────────┐  │
│  │ الفاتورة│ المريض   │ المبلغ   │ الطريقة  │ التاريخ  │ الحالة     │  │
│  ├───────┼──────────┼──────────┼──────────┼──────────┼────────────┤  │
│  │ #1001 │ أحمد سالم│ 172.50   │ مدى     │ 22/03   │ مدفوع ✅   │  │
│  │ #1002 │ خالد محمد│ 230.00   │ تحويل   │ 22/03   │ قيد المراجعة│  │
│  │ #1003 │ سارة أحمد│ 115.00   │ فيزا    │ 21/03   │ مدفوع ✅   │  │
│  └───────┴──────────┴──────────┴──────────┴──────────┴────────────┘  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**Bank Transfer Tab — Verification Panel:**

When clicking a pending bank transfer, a side panel opens:

```
┌───────────────────────────────────────────┐
│  مراجعة التحويل البنكي                     │
│  Bank Transfer Review                      │
│──────────────────────────────────────────── │
│                                            │
│  المريض: خالد محمد                         │
│  الحجز: #1235 — 22/03/2026                │
│  المبلغ المطلوب: 230.00 ر.س                │
│                                            │
│  ┌────────────────────────────┐            │
│  │                            │            │
│  │    [Receipt Image]         │            │
│  │    (from MinIO)            │            │
│  │                            │            │
│  └────────────────────────────┘            │
│                                            │
│  تحليل الذكاء الاصطناعي                    │
│  AI Analysis                               │
│  ┌────────────────────────────┐            │
│  │ الحالة: مطابق ✅           │            │
│  │ المبلغ المستخرج: 230.00    │            │
│  │ التاريخ المستخرج: 22/03    │            │
│  │ الثقة: 95%                 │            │
│  │                            │            │
│  │ ملاحظات: المبلغ مطابق      │            │
│  │ والتاريخ حديث              │            │
│  └────────────────────────────┘            │
│                                            │
│  ملاحظات المراجع / Reviewer Notes          │
│  ┌────────────────────────────┐            │
│  │                            │            │
│  └────────────────────────────┘            │
│                                            │
│  [✅ قبول / Approve] [❌ رفض / Reject]     │
│                                            │
└───────────────────────────────────────────┘
```

**AI Verification Tags (color-coded):**
| Tag | Color | Meaning |
|-----|-------|---------|
| matched | Green | Amount and details match booking |
| amount_differs | Amber | Extracted amount doesn't match expected |
| suspicious | Red | Receipt looks fraudulent or manipulated |
| old_date | Orange | Transfer date is too old (> 7 days) |
| unreadable | Grey | AI couldn't read the receipt |

---

## A11 — Invoices

**Purpose:** View and manage invoices

**Layout:** Standard TanStack Table with:
- Invoice number, client name, amount, date, sent status
- Click invoice → view PDF (in-page or new tab)
- "Resend" button to re-email invoice
- Filter by date range, sent status
- Export (date range → CSV/PDF)
- Bulk actions: resend selected, export selected

---

## A12 — Financial Reports

**Purpose:** Revenue analytics and financial overview

**Layout:**
```
┌──────────────────────────────────────────────────────────────────────┐
│  التقارير المالية / Financial Reports                                │
│──────────────────────────────────────────────────────────────────────│
│                                                                      │
│  الفترة: [من: 01/03/2026] [إلى: 31/03/2026]  [تطبيق / Apply]       │
│                                                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                │
│  │ إجمالي   │ │ صافي     │ │ الضريبة  │ │ المسترد  │                │
│  │ الإيرادات │ │ الإيرادات │ │ المحصلة  │ │ Refunded │                │
│  │ 45,000   │ │ 39,130   │ │ 5,870    │ │ 1,200    │                │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘                │
│                                                                      │
│  ┌────────────────────────────────────────────────────────┐          │
│  │  الإيرادات حسب اليوم / Revenue by Day                  │          │
│  │  [Recharts bar chart — daily revenue for period]       │          │
│  └────────────────────────────────────────────────────────┘          │
│                                                                      │
│  ┌──────────────────────────┐ ┌──────────────────────────┐          │
│  │ طرق الدفع / Payment     │ │ الإيرادات حسب الطبيب      │          │
│  │ Methods                  │ │ Revenue by Employee    │          │
│  │                          │ │                          │          │
│  │ [Recharts pie chart]     │ │ ┌────────┬──────┬─────┐  │          │
│  │  مدى: 60%               │ │ │ الطبيب  │ الحجوزات│المبلغ│  │          │
│  │  فيزا: 25%              │ │ ├────────┼──────┼─────┤  │          │
│  │  تحويل: 15%             │ │ │ د. أحمد│  45  │18,000│  │          │
│  │                          │ │ │ د. سارة│  38  │15,200│  │          │
│  └──────────────────────────┘ └──────────────────────────┘          │
│                                                                      │
│  ┌────────────────────────────────────────────────────────┐          │
│  │ الإيرادات حسب الخدمة / Revenue by Service              │          │
│  │ ┌──────────────┬──────┬──────────┐                      │          │
│  │ │ الخدمة       │ العدد │ المبلغ   │                      │          │
│  │ ├──────────────┼──────┼──────────┤                      │          │
│  │ │ تنظيف أسنان  │  65  │ 9,750    │                      │          │
│  │ │ حشو أسنان    │  28  │ 8,400    │                      │          │
│  │ │ فحص نظر     │  40  │ 8,000    │                      │          │
│  │ └──────────────┴──────┴──────────┘                      │          │
│  └────────────────────────────────────────────────────────┘          │
│                                                                      │
│                                  [📥 تصدير Excel] [📥 تصدير PDF]     │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**Charts (Recharts):**
1. Revenue by day (bar chart)
2. Payment method breakdown (pie chart)
3. Revenue by employee (table or horizontal bar)
4. Revenue by service (table)

**Export:** Excel and PDF for the selected date range.

---

## A13 — Chatbot Management

**Purpose:** Monitor chatbot conversations and manage knowledge base

**Tabs:** Conversations | Analytics | Knowledge Base | Settings

**Conversations Tab:**
- List of chat sessions with: user, start time, message count, handoff status
- Click session → full transcript view
- Filter by date, handoff status

**Analytics Tab:**
- Total conversations (line chart over time)
- Most-asked questions (bar chart / table)
- Handoff rate
- Average conversation length
- Satisfaction (if collected)

**Knowledge Base Tab:**
- CRUD for knowledge base entries
- Each entry: title, content, category, active toggle
- "Re-index" button → triggers re-embedding of all entries
- Import from CSV

**Settings Tab:**
- Greeting message (AR + EN)
- Fallback mode: "Live Chat" or "Show Contact Number"
- AI model selection (from OpenRouter available models)
- Temperature, max tokens (advanced)

---

## A14 — Users & Roles

**Purpose:** Manage users and dynamic roles with permissions

**Tabs:** Users | Roles

**Users Tab:**
```
┌──────────────────────────────────────────────────────────────────────┐
│  Filters: [الدور ▼] [الحالة ▼]                    [+ إضافة مستخدم]  │
│                                                                      │
│  ┌──────────┬──────────────┬──────────┬────────┬────────┬─────────┐  │
│  │ المستخدم │ البريد        │ الدور    │ الحالة  │آخر دخول│الإجراءات│  │
│  ├──────────┼──────────────┼──────────┼────────┼────────┼─────────┤  │
│  │ طارق     │ tariq@...    │ مدير عام │ نشط ✅│ اليوم  │ [✏️]    │  │
│  │ نورة     │ noura@...    │ استقبال  │ نشط ✅│ أمس    │ [✏️]    │  │
│  │ فهد      │ fahd@...     │ محاسب   │ معطل ❌│ 01/03  │ [✏️]    │  │
│  └──────────┴──────────────┴──────────┴────────┴────────┴─────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

**Add/Edit User Form:**
- Name, email, password (for new users), phone
- Role selector (from available roles)
- Active/inactive toggle

**Roles Tab:**
```
┌──────────────────────────────────────────────────────────────────────┐
│                                                     [+ دور جديد]     │
│  ┌────────────┬──────────────┬──────────┬────────┬─────────┐        │
│  │ الدور      │ الوصف        │ المستخدمين│ النظام │الإجراءات│        │
│  ├────────────┼──────────────┼──────────┼────────┼─────────┤        │
│  │ مدير عام   │ صلاحيات كاملة│    1     │ ✅     │ [👁]    │        │
│  │ استقبال    │ إدارة المواعيد│    2     │ ✅     │ [👁][✏️]│        │
│  │ محاسب     │ المالية فقط  │    1     │ ✅     │ [👁][✏️]│        │
│  │ طبيب      │ مواعيده فقط  │    5     │ ✅     │ [👁][✏️]│        │
│  │ مريض      │ حسابه فقط    │   120    │ ✅     │ [👁]    │        │
│  │ مشرف مخصص │ مخصص         │    1     │ ❌     │ [✏️][🗑]│        │
│  └────────────┴──────────────┴──────────┴────────┴─────────┘        │
└──────────────────────────────────────────────────────────────────────┘
```

**Permission Matrix (Role Editor):**
```
┌──────────────────────────────────────────────────────────┐
│  تعديل الدور: مشرف مخصص                                  │
│──────────────────────────────────────────────────────────│
│                                                          │
│  اسم الدور: ┌─────────────────┐                         │
│            │ مشرف مخصص       │                          │
│            └─────────────────┘                          │
│  الوصف:    ┌─────────────────┐                          │
│            │ إشراف على الأطباء│                          │
│            └─────────────────┘                          │
│                                                          │
│  الصلاحيات / Permissions                                 │
│  ┌──────────────┬──────┬──────┬──────┬──────┐           │
│  │ الوحدة       │ عرض  │ إضافة │ تعديل │ حذف  │           │
│  ├──────────────┼──────┼──────┼──────┼──────┤           │
│  │ المواعيد     │ ☑    │ ☑    │ ☑    │ ☐    │           │
│  │ الأطباء      │ ☑    │ ☐    │ ☑    │ ☐    │           │
│  │ المرضى      │ ☑    │ ☐    │ ☐    │ ☐    │           │
│  │ الخدمات     │ ☑    │ ☐    │ ☐    │ ☐    │           │
│  │ المدفوعات   │ ☐    │ ☐    │ ☐    │ ☐    │           │
│  │ الفواتير     │ ☐    │ ☐    │ ☐    │ ☐    │           │
│  │ التقارير     │ ☐    │ ☐    │ ☐    │ ☐    │           │
│  │ الشات بوت   │ ☐    │ ☐    │ ☐    │ ☐    │           │
│  │ المستخدمين  │ ☐    │ ☐    │ ☐    │ ☐    │           │
│  │ الأدوار     │ ☐    │ ☐    │ ☐    │ ☐    │           │
│  │ الإعدادات   │ ☐    │ ☐    │ ☐    │ ☐    │           │
│  │ الإشعارات   │ ☑    │ ☐    │ ☐    │ ☐    │           │
│  └──────────────┴──────┴──────┴──────┴──────┘           │
│                                                          │
│  [حفظ / Save]  [إلغاء / Cancel]                         │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Modules for permissions:**
bookings, employees, clients, services, payments, invoices, reports, chatbot, users, roles, whitelabel, notifications

**Actions:** view, create, edit, delete

**System roles** (super_admin, receptionist, accountant, employee, client) cannot be deleted but their permissions can be adjusted (except super_admin which always has full access).

---

## A15 — White Label Settings

See `white-label-theming.md` for full specification of this page's sections:
- Branding (logo, colors, fonts, border style)
- Contact info
- Integration keys
- Content (about, policies — bilingual rich text editors)
- System settings (language, timezone, session duration, bank info)

---

## A16 — Notifications (Admin)

**Purpose:** System notifications for admin actions

**Layout:**
- List of notifications grouped by date
- Types: new booking, cancellation request, bank transfer pending, problem report, new client registration
- Mark as read / mark all as read
- Click → navigate to relevant page
- Real-time updates (WebSocket or polling)

---

## Shared Dashboard Components

### Layout Shell
- Collapsible sidebar (expanded/collapsed)
- Top header with: page title, notification bell (with badge), user dropdown (profile, language, logout)
- Breadcrumb navigation
- Dark mode toggle in header or sidebar footer
- Language toggle (AR/EN)

### Data Table Pattern (All tables use this)
- TanStack Table with: search, column filters, sorting, pagination
- Row selection (checkbox)
- Bulk actions toolbar (appears on selection)
- Export button (CSV, Excel)
- Column visibility toggle
- Responsive: horizontal scroll on small screens

### Form Pattern (All forms use this)
- react-hook-form + zod validation
- Inline error messages (below field)
- Loading state on submit button
- Confirmation dialog for destructive actions
- Toast notification on success/error (sonner)
- Bilingual fields: side-by-side AR/EN inputs where applicable
