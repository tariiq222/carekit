# E2E QA Report — Phase 7: Tools + misc

**Date:** 2026-04-24
**Routes tested:** `/notifications`, `/contact-messages`, `/activity-log`, `/chatbot`, `/ratings`, `/branches`

## Results Summary

| # | Route | Status | Severity |
|---|-------|--------|----------|
| 7.1 | `/notifications` | ✅ PASS | — |
| 7.2 | `/contact-messages` | 🐛 Breadcrumb untranslated + no StatsGrid | Low |
| 7.3 | `/activity-log` | 🛑 Raw error string visible + URL rewrite | High |
| 7.4 | `/chatbot` | 🛑 Empty main area (feature-gated, no fallback) | High |
| 7.5 | `/ratings` | 🐛 Too minimal, no default content | Medium |
| 7.6 | `/branches` | ⚠️ Row actions dropdown (inconsistency) | Low |

---

## 🐛 BUG #30 — Raw backend validation error "property sortOrder should not exist" visible on `/activity-log`

### Severity: **HIGH** (raw API error leaking to UI; also the URL is silently rewritten)

### Reproduction
1. Navigate directly to `/activity-log`.
2. URL is rewritten to `/users?tab=activityLog` (sidebar shows "المستخدمون والأدوار" as active).
3. In the tabpanel "سجل النشاط", a text node renders:

```
uid=78_47 StaticText "property sortOrder should not exist"
```

4. Below it is the empty-state header "لا يوجد سجل نشاط".

### Root cause
This is a **class-validator whitelist error** from NestJS, raw-rendered to the user. The activity-log hook is probably sending `{ sortOrder: "..." }` to a backend endpoint that applies `@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))` and the DTO doesn't declare `sortOrder`.

The 4xx response body includes the `message: ["property sortOrder should not exist"]` array, and the UI is rendering it as-is instead of showing a graceful error state.

### Fix (two parts)
1. **Backend:** either add `sortOrder` to the activity-log query DTO, or change the frontend to stop sending it.
2. **Frontend error handling:** wrap the query's error state in a user-facing message, not the raw array from `message`. Common pattern: `{error ? <ErrorState /> : null}`.

### Files
- `apps/backend/src/api/dashboard/*.controller.ts` — find the activity-log GET endpoint and its DTO
- `apps/dashboard/hooks/use-activity-log.ts` or equivalent — check the query params sent
- `apps/dashboard/components/features/activity-log/*.tsx` — add proper error rendering

### Additional concern — `/activity-log` → `/users?tab=activityLog` URL rewrite
The route `/activity-log` is not a dedicated page; it rewrites to a tab inside `/users`. This breaks expectations:
- Deep-links to `/activity-log` lose the URL on back navigation.
- Breadcrumb shows "المستخدمون والأدوار" not "سجل النشاط".
- Sidebar highlight is wrong.

Prefer either a dedicated `/activity-log/page.tsx` OR drop the redirect and rename the sidebar item to point at `/users?tab=activityLog` directly.

---

## 🐛 BUG #31 — `/chatbot` renders an empty main area (same pattern as `/coupons`, `/reports`)

### Severity: **HIGH** (third page with the same dead-route bug)

### Reproduction
Navigate to `/chatbot`. `<main>` contains only the sidebar toggle and command palette — no page content at all.

### Status
Same root cause as Bug #20 (Phase 5). Grouping them here for visibility:

| Route | Feature flag | Current state |
|-------|--------------|---------------|
| `/coupons` | `COUPONS` | Blank |
| `/reports` | `ADVANCED_REPORTS` | Blank |
| `/chatbot` | `AI_CHATBOT` | Blank |

### Fix
Identical to Bug #20 — apply the `<FeatureGate fallback={<FeatureDisabledState />}>` pattern once and use it consistently across all feature-gated routes.

---

## 🐛 BUG #32 — `/ratings` is too thin — no default content

### Severity: **MEDIUM** (feature looks abandoned/unfinished)

### Reproduction
Open `/ratings`. The page shows only:
- PageHeader ("تقييمات الممارسين")
- Single dropdown "اختر ممارساً"
- Helper text "اختر ممارساً لعرض تقييماته"

### Expected
Per the spec and the data available in DB (9 ratings exist across 3 employees in default org), this page should have:
- **StatsGrid**: إجمالي التقييمات · المتوسط العام · أعلى ممارس تقييماً · الجديدة هذا الأسبوع
- **Default list** of all recent ratings across all practitioners (most recent first), with inline filters for practitioner / score / date range.
- The dropdown should filter, not gate visibility.

### Fix
Expand the ratings page to match the Page Anatomy spec. Reuse `rating.groupBy` from the employee stats handler for the aggregate numbers; add a new listing endpoint `GET /api/v1/dashboard/org-experience/ratings?page=...&employeeId=...`.

---

## 🐛 BUG #33 — `/contact-messages` missing StatsGrid and has untranslated breadcrumb

### Severity: **LOW** (spec violation + another breadcrumb gap)

### Reproduction
Open `/contact-messages`. Breadcrumb reads "contact-messages" (sixth untranslated path — see Bug #26 pattern).

Table columns are present but no StatsGrid (unread count, today's messages, resolved, pending). On a real deployment this would be a high-traffic quality-of-life gap for clinic managers.

### Fix
- Breadcrumb: fix globally via the same fix in Bug #26.
- StatsGrid: add 4 stats: غير مقروءة · اليوم · محلولة · إجمالي.

---

## 🐛 BUG #34 — `/branches` row actions use dropdown (inconsistent with the spec)

### Severity: **LOW** (repeat of Bug #11 pattern)

### Reproduction
On `/branches` each row ends with "الإجراءات" dropdown button instead of the icon-only buttons specified in `CLAUDE.md`'s Page Anatomy section.

### Fix
Unify with the pattern used on `/clients`, `/employees`, `/services`, `/categories`, `/departments` (after Bug #11 fix). Keep dropdowns only for pages with 5+ row actions.

---

## ✅ Working

### /notifications
- Stats cards (1 غير مقروءة / 1 الإجمالي). ✓
- Shows 1 seeded/triggered notification ("مرحباً بك! · أهلاً اختبار QA..."). ✓
- "تحديد الكل كمقروء" action present. ✓
- Relative time rendering ("منذ ساعتين تقريبا"). ✓

Clean and simple. No issues spotted.

### /branches
- Seeded 2 branches (فرع الروضة · الفرع الرئيسي).
- StatsGrid (4 cards) correct. ✓
- FilterBar with search + status. ✓
- Table columns correct. ✓
- "Main" flag shown correctly.

Only issue is row-actions pattern (Bug #34 above).

---

## Next phase

Phase 8 — Dashboard home (`/`).
