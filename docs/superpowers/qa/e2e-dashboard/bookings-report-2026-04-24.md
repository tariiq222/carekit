# E2E QA Report — Phase 4: Bookings (الحجوزات)

**Date:** 2026-04-24
**Tester:** Claude (Chrome DevTools MCP)
**Routes:** `/bookings`
**Backend endpoints touched:**
- `GET  /api/v1/dashboard/bookings?page=1&limit=20`
- `GET  /api/v1/dashboard/people/employees/:id/slots?date=...`
- `GET  /api/v1/dashboard/organization/services/:id/employees`
- `GET  /api/v1/dashboard/organization/booking-settings`

## Results Summary

| # | Test Case | Status | Severity |
|---|-----------|--------|----------|
| 4.1 | List bookings | ⚠️ PASS with issues | Medium |
| 4.2 | Create booking (full flow) | 🛑 **BLOCKED** for 9 of 11 practitioners | **HIGH** |
| 4.3 | View booking details (Dialog) | ⚠️ PASS with localization issues | Low |
| 4.4 | Waitlist tab | Not tested (flow interrupted) | — |
| 4.5 | Edit / Delete booking | Not tested (flow interrupted) | — |

---

## 🐛 BUG #13 — Create-booking blocked: seeded practitioners have zero availability

### Severity: **HIGH** (blocks the single most important flow in the product)

### Reproduction
1. Open `/bookings` → click "حجز جديد".
2. Pick any client from the list (e.g., "عميل رقم 45").
3. Pick any service (e.g., "كشف عام").
4. The next step shows only **one** practitioner (the one linked to this service — most services are linked to exactly one).
5. Select that practitioner.
6. The date picker shows 14 days. Click any day (Sun–Thu, within normal working hours).
7. The availability list shows **"لا توجد مواعيد متاحة"** for every day.

### Root cause

Direct DB query on `EmployeeAvailability`:

```sql
SELECT e."nameEn", COUNT(a.id) AS availability_rows
FROM "Employee" e
LEFT JOIN "EmployeeAvailability" a ON a."employeeId" = e.id
WHERE e."organizationId" = '00000000-0000-0000-0000-000000000001'
GROUP BY e.id, e."nameEn";
```

Result (11 practitioners):
```
Dr. Ahmed Alghamdi    | 0 availability rows
Dr. Fatima Alqahtani  | 0
Dr. Khalid Alsubaie   | 0
Dr. Sarah Alharbi     | 0
Dr. Omar Alotaibi     | 0
Dr. Hind Aldosari     | 0
Dr. Yousef Almutairi  | 0
Dr. Reem Alshehri     | 0
Dr. Talal Alzahrani   | 0
د. ليان القحطاني      | 5     ← only seeded employee with availability
QA Tester             | 5     ← created through dashboard UI during testing
```

**9 out of 11** seed practitioners have zero rows in `EmployeeAvailability`. The slots endpoint correctly returns `[]`. The booking create flow cannot complete with those practitioners.

Interestingly, 17 seed bookings *already exist* for these same zero-availability practitioners — meaning the seed script directly writes into `Booking` without first populating `EmployeeAvailability`.

### Fix
In `apps/backend/prisma/seed.ts`, for each seeded employee add default availability rows — same as what the dashboard create form writes by default (Sun–Thu 09:00–17:00). Suggested helper:

```ts
async function seedDefaultAvailability(employeeId: string) {
  const activeDays = [0, 1, 2, 3, 4]; // Sun..Thu
  for (const day of activeDays) {
    await prisma.employeeAvailability.upsert({
      where: { employeeId_dayOfWeek: { employeeId, dayOfWeek: day } },
      update: {},
      create: { employeeId, dayOfWeek: day, startTime: "09:00", endTime: "17:00", isActive: true },
    });
  }
}
```

Call it for every seeded employee inside the existing loop.

---

## 🐛 BUG #14 — Duplicate "د." prefix on practitioner names in the list

### Severity: **MEDIUM** (visible on every single row)

### Reproduction
1. Open `/bookings`.
2. Look at any row's "الممارس" column.

### Expected
`د. خالد السبيعي` — one `د.` prefix.

### Actual
A11y snapshot shows three separate static text nodes:

```
uid=53_66 StaticText "د."
uid=53_67 StaticText " "
uid=53_68 StaticText "د."
uid=53_69 StaticText " "
uid=53_70 StaticText "خالد السبيعي"
```

Visually renders as **"د. د. خالد السبيعي"** — double prefix.

### Root cause (likely)
The practitioner name column renders both:
1. A prefix `<span>{employee.title}</span>` (where `title = "د."` or `"دكتور"` for seeded records), AND
2. A stored name that **already starts with** `د.` (e.g., `nameAr = "د. خالد السبيعي"`).

Pick one source of truth:
- Either stop prepending `title` if `nameAr` already starts with a prefix.
- Or clean the seeded `nameAr` to remove the `د.` prefix (keep it only in `title`).

### Location
- `apps/dashboard/components/features/bookings/booking-columns.tsx` (or similar) — the cell that renders the practitioner column.
- `apps/backend/prisma/seed.ts` — where seeded employees get their `title`/`nameAr`.

---

## 🐛 BUG #15 — Bookings list has no stats cards (violates Page Anatomy — The Law)

### Severity: **MEDIUM** (spec violation)

### Reproduction
Open `/bookings` and compare against the Page Anatomy rule in the root `CLAUDE.md`:

> StatsGrid: 4× StatCard (Total/primary · Active/success · Inactive/warning · New/accent)

### Expected
The bookings list should have a StatsGrid with at least:
- **Today's bookings** (count)
- **Pending** bookings count
- **Completed today**
- **Revenue today** (SAR)

### Actual
No StatsGrid at all. The page jumps from PageHeader directly to Tabs → FilterBar → Table.

### Context
Bookings is the highest-traffic page for receptionists and the operational heartbeat of the clinic. Missing stats means a receptionist has to scan the whole table to answer "how many bookings do I have today?" — which defeats the point of a dashboard.

### Fix
Add a `<StatsGrid>` between PageHeader and the `<Tabs>`. Source the numbers from a new `GET /api/v1/dashboard/bookings/stats` endpoint that returns `{ todayCount, pendingCount, completedToday, revenueToday }` (already has a similar pattern in `employee-stats.handler.ts`).

---

## 🐛 BUG #16 — Price unit inconsistency: service list shows "200.00 ر.س" but booking create shows "20000 ر.س"

### Severity: **HIGH** (visible to operator, risks wrong charge)

### Reproduction
1. Compare prices shown on `/services` vs in the "حجز جديد" Dialog step 2 (service picker).

| Service | `/services` list | Booking create dialog |
|---------|------------------|------------------------|
| استشارة جلدية | **200.00 ر.س** | **20000 ر.س** |
| تنظيف أسنان | **250.00 ر.س** | **25000 ر.س** |
| كشف عام | **120.00 ر.س** | **12000 ر.س** |

Exactly **100×** difference — classic halalas-vs-SAR unit mix-up.

### Root cause (likely)
DB stores price in halalas (smallest unit): `200 SAR = 20000 halalas`. The `/services` list formatter divides by 100 and shows "200.00". The booking create dialog skips this conversion and renders the raw integer.

### Location
- `apps/dashboard/components/features/bookings/create-booking-dialog/service-step.tsx` (or wherever the service list inside the dialog is rendered)
- Look for a missing call to the same price formatter used by `/services` — likely `formatCurrency(price)` or `(price / 100).toFixed(2)`.

### Critical because
If an operator creates a booking seeing "20000 ر.س" and approves it, whatever happens at payment time could be wrong — either show the right price to the client, or the completed booking lists under "bookings" will disagree with what was just shown at create-time.

---

## 🐛 BUG #17 — "رجوع" button doesn't navigate back in the booking create Dialog

### Severity: **MEDIUM** (usability)

### Reproduction
1. Open "حجز جديد" Dialog. Proceed through Client → Service → Practitioner → Date.
2. On the Date step, click "رجوع" (top-left of dialog).
3. Nothing happens — still on Date step.
4. Click again — still on Date step.
5. Only way out: press Escape to close the whole dialog.

### Expected
"رجوع" goes to the previous step (Practitioner picker), same as it does from Date → Practitioner in the first place.

### Actual
Button is rendered with label "رجوع" but its click handler is missing or wired to `router.back()` (which does nothing because the dialog never pushed a history entry).

### Fix
Wire the back button to a local `setStep(step - 1)` call. Check `apps/dashboard/components/features/bookings/create-booking-dialog/*.tsx`.

---

## 🐛 BUG #18 — Status column has mixed display patterns (text vs dropdown)

### Severity: **LOW** (visual inconsistency)

### Reproduction
On `/bookings`, compare the "الحالة" column across rows:
- bkg-15 → plain text "مكتمل"
- bkg-11 → plain text "منتهي"
- bkg-1  → **dropdown menu button** "بالانتظار"
- bkg-4  → plain text "ملغي"
- bkg-12 → plain text "طلب إلغاء"

Plain-text rendering means no way to change status from the list. Dropdown-button rendering means you can. The decision seems to depend on whether the status is "transitionable" — but it's not explained to the user.

### Suggested fix
Either:
- Always use a status chip; put actions in a separate "الإجراءات" menu.
- Or always use a status dropdown; disable options that aren't reachable from the current state.

The mixed mode is confusing — receptionists can't predict whether the cell is clickable.

---

## 🐛 BUG #19 — Booking details Dialog mixes Arabic and English

### Severity: **LOW** (localization gap)

### Reproduction
1. `/bookings` → "عرض التفاصيل" on any row.
2. Dialog "تفاصيل الحجز" shows:
   - Service name: **"Dental cleaning"** (English, should be `nameAr`)
   - Duration: **"45 min"** (English, should be "45 دقيقة")

### Expected
All user-facing strings use Arabic when `locale === "ar"`.

### Actual
The dialog reads `service.nameEn` and hardcodes "min" instead of using translation keys.

### Fix
- `apps/dashboard/components/features/bookings/booking-details-dialog.tsx`
- Replace `service.name` (or `nameEn`) with `locale === "ar" ? service.nameAr : service.nameEn`.
- Replace hardcoded "min" with `t("common.duration.minutes", { count })`.

---

## ✅ Working flows (baseline)

### 4.1 — List bookings
- 17 seeded bookings rendered in table.
- Columns: # · المريض · الممارس · النوع · التاريخ والوقت · المبلغ · الحالة · إجراءات.
- Tabs: الحجوزات · قائمة الانتظار (waitlist).
- Rich filter set: الكل/اليوم/هذا الأسبوع/هذا الشهر · بحث · النوع · المصدر · الممارس · الحالة · من/إلى dates.
- Row actions: عرض التفاصيل · تعديل الموعد · حذف الحجز (all icon-only — matches spec).
- SAR icon rendered as SVG image (not emoji) — consistent.

### 4.2 — Create booking (partial)
- Step 1 (Client): Tabs "بحث / جديد" with client list + "create walk-in" option. Good UX.
- Step 2 (Service): Service cards with duration and price. Good UX (blocked by Bug #16).
- Step 3 (Practitioner): Shows only practitioners linked to chosen service. Good scoping.
- Step 4 (Date): 14-day horizontal date picker. (Blocked by Bug #13.)

### 4.3 — View details Dialog
- Shows Client / Practitioner / Service / Payment / Status-change log sections. Clean layout.
- Status change log section handles empty state ("لا توجد تغييرات في الحالة حتى الآن.") cleanly.

---

## Next phase

Phase 5 — Finance (payments, invoices, coupons, ZATCA). The booking→payment link can also be retested after Bug #13/#16 are resolved.
