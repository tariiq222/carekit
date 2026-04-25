# E2E QA Report — Phase 8: Dashboard Home (`/`)

**Date:** 2026-04-24
**Route:** `/`

## Overall impression

The home page has the most polished structure of any page tested. Greeting + search + quick-actions + stats + alerts + multi-section "operations board" layout is a strong foundation. Gaps are mostly in the stats accuracy, not in the page structure.

---

## 🐛 BUG #35 — Stat "بانتظار الموافقة = 0" contradicts the bookings list

### Severity: **MEDIUM** (misleads operators)

### Reproduction
1. Open `/`.
2. StatsGrid card 3: "بانتظار الموافقة · 0".
3. Navigate to `/bookings`. Rows with status button "بالانتظار" (dropdown) exist: **bkg-1, bkg-6, bkg-8, bkg-10, bkg-16** — five of them.

### Expected
Home stat should equal **5** (pending-approval bookings count).

### Probable cause
The home stat might count a different status. Likely mismatch between the backend counter's enum value and the one used by the list. For example:
- Stat counts `PENDING_APPROVAL`
- List shows `PENDING` or `WAITING`

Or the stat is scoped to "today" while bookings are in the past — the label should then say "بانتظار الموافقة اليوم".

### Fix
Align the enum/filter used by the home stat with the one used on `/bookings`. If time-scoping is intentional, add it to the label.

### Files
- `apps/backend/src/api/dashboard/*dashboard-stats.controller.ts` (or similar — the home stats endpoint)
- `apps/dashboard/components/features/home/stats-grid.tsx`

---

## 🐛 BUG #36 — Ambiguous stat labels on home: "مرضى جدد" — today? week? month?

### Severity: **LOW** (UX clarity)

### Reproduction
Stats show:
- حجوزات اليوم (explicit: today)
- **مرضى جدد** (unspecified period)
- بانتظار الموافقة (unspecified period)
- إيراد اليوم (explicit: today)

Asymmetric labeling. "مرضى جدد" could mean today, this week, or this month.

### Expected
Every stat label should include its time window explicitly: "مرضى جدد اليوم" or "مرضى جدد هذا الشهر".

### Additional sanity check
The test client "اختبار QA" was created earlier in the session; the stat shows `0` for "مرضى جدد". Either:
- The scope is not "today" (and the label is ambiguous), or
- The scope is "today" and the query is broken (`createdAt >= startOfDay`).

### Fix
Confirm intended scope with product owner, then update label + verify query.

---

## 🐛 BUG #37 — Quick action "التقارير" links to a blank page

### Severity: **MEDIUM** (navigational dead end)

### Reproduction
1. Home → "إجراءات سريعة" card → "التقارير" (uid=82_62).
2. Target URL: `/reports`.
3. `/reports` renders an empty main area (see Bug #20).

### Fix
Two options:
1. Fix `/reports` first (Bug #20 / #31 — feature-gate fallback), then this becomes fine.
2. Remove or hide the "التقارير" quick action until the reports page is ready.

---

## 🐛 BUG #38 — Quick action "التقويم" links to the bookings list, not a calendar view

### Severity: **LOW** (label/behavior mismatch)

### Reproduction
1. Home → "إجراءات سريعة" → "التقويم" (uid=82_60).
2. Target URL: `/bookings` — a tabular list, not a calendar.

### Expected
"التقويم" suggests a calendar day/week/month grid view. The dashboard doesn't have a dedicated `/calendar` route — bookings is only a table.

### Fix
- Add a dedicated `/calendar` route with a proper Gantt or FullCalendar view, OR
- Relabel the quick action to "المواعيد" (matches the bookings list better).

---

## ✅ Working — Strong baseline

- Greeting with locale-aware salutation: "مساء النور، Admin 👋" + current date + today's bookings count.
- Global search + notification button + "حجز جديد" CTA in top bar.
- StatsGrid: 4 cards rendered with SAR icon for money.
- Alert cards: "مدفوعات معلقة" and "طلبات إلغاء (1)" — both with descriptive subtitles and destination links. The "1" badge correctly matches the seed's `bkg-12` which has "طلب إلغاء" status.
- إجراءات سريعة: 4-card row for common actions.
- لوحة العمليات section: 4 sub-cards (جدول اليوم / آخر الأحداث / إيرادات الأسبوع / آخر المدفوعات) with clean empty states.
- Activity feed correctly shows the "اختبار QA" welcome notification.

---

## Spec compliance

Per `CLAUDE.md` design-principle doc, home embodies the principles well:
- **Surface the signal, hide the noise** — stats up top, secondary lists below, deep actions behind links. ✓
- **Speed is a feature** — quick actions live on a card row. ✓
- **Glass, not plastic** — (visual check not done via snapshots but structure supports it).
- **Arabic-first** — all labels RTL, date formats in Arabic locale. ✓

---

## Next step: Final consolidated report.
