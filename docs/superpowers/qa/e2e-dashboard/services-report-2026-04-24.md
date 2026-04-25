# E2E QA Report — Phase 3: Services + Categories + Departments

**Date:** 2026-04-24
**Tester:** Claude (Chrome DevTools MCP)
**Routes:** `/services`, `/services/create`, `/categories`, `/departments`
**Backend endpoints touched:**
- `GET  /api/v1/dashboard/organization/services`
- `POST /api/v1/dashboard/organization/services`
- `GET/POST /api/v1/dashboard/org-config/categories`
- `GET/POST /api/v1/dashboard/org-config/departments`

## Results Summary

| # | Test Case | Status | Severity if failing |
|---|-----------|--------|---------------------|
| 3.1 | List services | ⚠️ PASS with data issues | Medium |
| 3.2 | Create service (without category) | 🛑 BLOCKED until category exists | High (first-run UX) |
| 3.3 | Create category | ✅ PASS | — |
| 3.4 | Create department | ✅ PASS | — |
| 3.5 | Create service (with category) | ✅ PASS | — |
| 3.6 | View service details (modal) | ✅ PASS | — |
| 3.7 | Category/department actions menu | ⚠️ Different pattern | Low (UX inconsistency) |

---

## 🐛 BUG #8 — First-run UX: cannot create a service, no CTA to create category

### Severity: **HIGH** (onboarding friction)

### Reproduction
1. Fresh org, no categories, no departments.
2. Navigate to `/services/create`.
3. Form shows "الفئة *" (required) with a dropdown that says "اختر الفئة" — but the dropdown is **completely empty**.
4. User has no way to proceed and no hint that they must go create a category first.

### Expected
One of:
1. **Inline creation** — "+" icon inside the dropdown that opens the "New category" dialog without leaving the form.
2. **Empty-state guidance** — when categories list is empty, render a banner at the top of the create form: "لا توجد فئات — [إنشاء فئة]".
3. **Soft requirement** — make category optional at create time (match what the seed evidently does — see Bug #9).

### Actual
Empty dropdown, no message, no redirect. Silent dead-end.

### Files likely involved
- `apps/dashboard/components/features/services/create/basic-info-tab.tsx` (or similar — the tab rendering the category combobox)
- The category combobox itself — probably reads a TanStack Query and shows `[]` with no empty state.

---

## 🐛 BUG #9 — Seeded services bypass the "category required" rule

### Severity: **MEDIUM** (data/UI contract mismatch)

### Reproduction
1. After a fresh seed, navigate to `/services`.
2. 3 services exist: "استشارة جلدية", "تنظيف أسنان", "كشف عام". All show **"—"** in the Category column.
3. Open `/services/create` — the form enforces "الفئة *" as required.

### Expected
Either:
- Seed should create matching categories (e.g., Dermatology, Dental, General) and link these services to them, OR
- The schema/DB should mirror the UI and require `categoryId`, OR
- The UI "required" constraint should be dropped (match reality).

### Actual
Three services exist without categories — proving the DB column is nullable. The UI treats it as required. Two incompatible sources of truth.

### Files
- `apps/backend/prisma/seed.ts` — seeds services without categoryId.
- `apps/backend/prisma/schema/org-experience.prisma` (or wherever `Service` model lives) — check if `categoryId` is nullable.
- `apps/dashboard/components/features/services/create/form-schema.ts` — zod schema likely has `categoryId: z.string().min(1)` as required.

### Suggested fix
Align all three. Most likely the right direction is: **seed real categories** and link the existing 3 services to them, and keep the UI rule "required" because users will expect categorization for reporting/filtering.

---

## 🐛 BUG #10 — Services price data looks like pennies (2.00, 2.50, 1.20 SAR)

### Severity: **LOW** (test data polish, not functionality)

### Reproduction
1. Navigate to `/services`.
2. Observe the "السعر (ر.س)" column values: 2.00, 2.50, 1.20.

### Concern
These values look like cents/halalas rather than realistic clinic prices. A dermatology consultation at 2 SAR is obviously wrong. Either:
- The seed values are intentional placeholders (harmless but confusing in demos), OR
- There's a division-by-100 or paisa→SAR unit bug somewhere in the pipeline.

### How to verify
1. Query the DB directly:
   ```sql
   SELECT id, "nameAr", price, "priceInCents" FROM "Service" LIMIT 5;
   ```
2. If the schema stores `priceInCents` (or `priceHalalas`) and the UI divides by 100, the "2.00 ر.س" result means the DB has `200` cents — a typical seed placeholder.
3. If the schema stores `price` as decimal SAR, then 2.00 is literally what was seeded and the seed needs realistic values (e.g., 150, 300, 450).

### Fix
If it's a seed-data issue: bump the seed values to realistic clinic prices (e.g., 200–800 SAR).
If it's a unit-handling issue: that's a bigger bug — fix the conversion and audit every place prices are displayed.

---

## 🐛 BUG #11 — Row actions pattern differs across list pages

### Severity: **LOW** (UX inconsistency)

### Summary

| Page | Row actions |
|------|-------------|
| `/clients` | 4 icon-only buttons: عرض / تعديل / حظر / حذف |
| `/employees` | 3 icon-only buttons: معاينة / تعديل / حذف |
| `/services` | 3 text buttons: عرض / تعديل / حذف |
| `/categories` | **Single "الإجراءات" dropdown menu** |
| `/departments` | **Single "الإجراءات" dropdown menu** |

The clinic/finance area of the sidebar uses three different action-column patterns on three adjacent pages. The spec in the root `CLAUDE.md` (Page Anatomy — The Law) says:

> Table action buttons → **icon-only** (size-9, rounded-sm) + Tooltip, no text labels

Services uses text buttons (contrary to the rule). Categories & Departments use a dropdown (also not the rule).

### Suggested fix
Unify to icon-only buttons across all list pages. Reserve dropdown menus for pages with 5+ row actions.

---

## 🐛 BUG #12 — Departments table: header lists no "Actions" column but rows have one

### Severity: **LOW** (a11y — column header mismatch)

### Reproduction
1. Open `/departments` with at least one department row.
2. Table header shows columns: الاسم, التصنيفات, الحالة — only three.
3. Each row has a fourth cell containing the "الإجراءات" menu button.

### Expected
Column headers should include "الإجراءات" (or a blank `<th>` with an aria-label) to match the body.

### Actual
Body has 4 cells, header has 3 `<th>`. Screen readers and AT announce table structure inconsistently.

### Fix
Add a fourth column header in the departments DataTable definition (even if visually empty, give it `aria-label="الإجراءات"`).

---

## ✅ Working flows (baseline)

### 3.1 — Services list (`/services`)
- 3 seeded services + 1 newly created = 4.
- Stats: إجمالي 4 · نشطة 4 · غير نشطة 0 · الفئات 1.
- Stat card "الفئات" updates when a category is used by a service (seeded 3 services had no category → "الفئات" was 0 before our test).
- FilterBar: search + حالة + فئة.
- PageHeader: single "إضافة خدمة" button (no Export button — likely intentional, confirm with design).

### 3.3 — Create category (`/categories` → Dialog)
- Simple modal with fields: الاسم (AR) * · الاسم (EN) · القسم (optional) · ترتيب العرض.
- Saves, closes modal, list refreshes, stat card goes 0 → 1.

### 3.4 — Create department (`/departments` → Dialog)
- Fields: الاسم AR * · الاسم EN * · الوصف AR/EN · الأيقونة · ترتيب العرض · نشط.
- Saves and appears immediately.

### 3.5 — Create service (with category)
- 5-tab form: المعلومات الأساسية / التسعير / إعدادات الحجز / الممارسون / نماذج المعلومات.
- With category chosen → POST `services` → success → redirect to `/services`.
- Price/duration defaults used (0.00 SAR, 30 min) — only basic info was filled.

### 3.6 — View service details (modal)
- Opens a Dialog instead of navigating to a page — **different pattern** from clients/employees which use full detail pages.
- Shows 4 sections: الأساسية / التسعير / الإعدادات / التواريخ.
- Edit/Close buttons at footer.

---

## Next phase

Phase 4 — **Bookings**. Now that services, categories, departments, employees, and clients all exist, the Booking create flow should have data to work with.
