# CareKit Dashboard E2E QA — Master Report

**Date:** 2026-04-24
**Tester:** Claude (Chrome DevTools MCP)
**Session:** 8-phase comprehensive audit
**Total bugs documented:** 38

---

## Scoreboard

| Phase | Area | Bugs | HIGH | MEDIUM | LOW |
|-------|------|------|------|--------|-----|
| 1 | المستفيدين (Clients) | 2 | 1 | 0 | 1 |
| 2 | المعالجين (Employees) | 5 | 1 | 2 | 2 |
| 3 | الخدمات/الفئات/الأقسام | 5 | 1 | 1 | 3 |
| 4 | الحجوزات (Bookings) | 7 | 2 | 3 | 2 |
| 5 | المالية (Finance) | 3 | 1 | 2 | 0 |
| 6 | الإعدادات (Settings) | 7 | 2 | 2 | 3 |
| 7 | الأدوات (Tools) | 5 | 2 | 1 | 2 |
| 8 | الصفحة الرئيسية (Home) | 4 | 0 | 2 | 2 |
| **TOTAL** | | **38** | **10** | **13** | **15** |

**Fixed during session (all verified):** Bugs #1–7 + #8–12 — 12 bugs resolved mid-audit.

**Still open at end of session:** 26 bugs (Bugs #13–38).

---

## Still-open bugs by priority

### 🔴 HIGH (10) — blocks or misleads users
| # | Phase | Bug |
|---|-------|-----|
| 13 | Bookings | Create-booking blocked — 9/11 seeded practitioners have zero availability rows |
| 16 | Bookings | Price unit mismatch: `/services` shows "200.00 ر.س" but booking create dialog shows "20000 ر.س" (100×) |
| 20 | Finance | `/coupons` and `/reports` render completely blank main area |
| 23 | Settings | `/users` renders raw i18n keys (`users.role.RECEPTIONIST`, `users.stats.inactive`, ...) |
| 24 | Settings | 5 isolation-test users (`iso-rt-*@t.test`) pollute default-org users list |
| 30 | Tools | `/activity-log` exposes raw backend validation error "property sortOrder should not exist" |
| 31 | Tools | `/chatbot` renders blank main area (same pattern as /coupons, /reports) |

### 🟡 MEDIUM (13)
| # | Phase | Bug |
|---|-------|-----|
| 6 (original) | Employees | ~~Stats label "غير متاح" vs row "موقوف"~~ ✅ FIXED |
| 7 (original) | Employees | ~~avg rating 4.5 but all rows "—"~~ ✅ FIXED |
| 8 | Services | First-run UX: cannot create service without category, no CTA |
| 14 | Bookings | Duplicate "د." prefix on every practitioner name |
| 15 | Bookings | No StatsGrid on `/bookings` (violates Page Anatomy) |
| 17 | Bookings | "رجوع" button in create-booking dialog does nothing |
| 21 | Finance | `/invoices` is skeletal — missing StatsGrid/FilterBar/Table |
| 22 | Finance | `/zatca` redirects to `/invoices?tab=zatca` but no tab UI |
| 25 | Settings | `/users` stats card "الأدوار = 0" wrong |
| 26 | Settings | 4 routes (branding/billing/sms/content) have untranslated breadcrumbs |
| 32 | Tools | `/ratings` too thin — no default listing even though 9 ratings exist |
| 35 | Home | Stat "بانتظار الموافقة = 0" contradicts bookings list (should be 5) |
| 37 | Home | Quick action "التقارير" links to the blank `/reports` page |

### 🟢 LOW (15)
| # | Phase | Bug |
|---|-------|-----|
| 2 | Clients | Empty email shown as blank instead of "—" on details page |
| 4 (original) | Employees | ~~spinbutton valuemax="0"~~ ✅ FIXED |
| 5 (original) | Employees | ~~email missing on edit form~~ ✅ FIXED |
| 9 (original) | Services | ~~seed creates services without category~~ ✅ FIXED |
| 10 (original) | Services | ~~Prices 2.00/2.50/1.20 SAR (halalas?)~~ ✅ FIXED |
| 11 | Services | Row actions pattern inconsistent (icon/text/dropdown) across pages |
| 12 (original) | Services | ~~Departments header missing Actions column~~ ✅ FIXED |
| 18 | Bookings | Status column mixed render (text vs dropdown) |
| 19 | Bookings | Booking details Dialog mixes AR/EN ("Dental cleaning", "45 min") |
| 27 | Settings | `/settings` "عام البريد الإلكتروني" garbled tab label |
| 28 | Settings | `/settings/billing` duplicates "لا يوجد اشتراك نشط" |
| 29 | Settings | `/branding` 4 ColorWells default to `#000000` with empty text |
| 33 | Tools | `/contact-messages` missing StatsGrid |
| 34 | Tools | `/branches` row actions dropdown |
| 36 | Home | Ambiguous stat labels ("مرضى جدد" — time window unspecified) |
| 38 | Home | Quick action "التقويم" links to list, not calendar |

---

## Cross-cutting themes

1. **Page Anatomy compliance is inconsistent.** Clients/Employees/Payments/Home follow the spec. Bookings/Invoices/Coupons/Reports/Chatbot/Ratings/Contact-messages violate it (missing StatsGrid, missing FilterBar, missing Table, or entirely blank).

2. **Feature-gate fallback is absent.** `/coupons`, `/reports`, `/chatbot` all render a blank `<main>` when their feature flag is off. Need a shared `<FeatureDisabledState>` fallback.

3. **Breadcrumb translation is bolted on inconsistently.** Fixed routes render "الرئيسية › branding" where "branding" should be the Arabic label. Happens on 6 routes (branding / billing / sms / content / contact-messages / activity-log).

4. **Row-actions pattern is not enforced.** The spec says icon-only buttons. Reality: icon buttons (clients/employees), text buttons (services original, now updated), dropdowns (originally categories/departments/branches/users — partially fixed). Needs a single `RowActions` component all list pages use.

5. **Seed hygiene problems:**
   - Test-isolation users (`@t.test` emails) leaked into the default org.
   - Seeded employees were created without `EmployeeAvailability` rows — blocks the create-booking flow.
   - Seeded services originally had no category (fixed mid-audit).

6. **Price unit mismatches.** Internal DB likely stores money as integer halalas; some UI surfaces forget to divide by 100. Originally seen in `/services` (now fixed), still visible in booking-create dialog.

7. **Localization gaps.** Raw i18n keys on `/users`; raw API error on `/activity-log`; English strings inside Arabic dialogs on `/bookings/[id]`. Every user-facing string needs a pass through `t()` + `npm run i18n:verify`.

8. **Dead/stub routes:**
   - `/chatbot` — blank
   - `/reports` — blank
   - `/coupons` — blank
   - `/zatca` — redirects to an invoices page without the promised tab UI
   - `/content` — 5 "قريباً" placeholders

---

## Recommended fix batches

### Batch A — Data quality (blocks demos)
- Bug #13: seed `EmployeeAvailability` for all seeded doctors.
- Bug #24: purge `@t.test` users; make isolation tests use disposable orgs.

### Batch B — Feature-gate hygiene
- Bugs #20, #31: shared `<FeatureDisabledState>` for `/coupons`, `/reports`, `/chatbot`.

### Batch C — Translation pass
- Bugs #23, #26, #30, #19, #27: audit all `t()` call sites, run `npm run i18n:verify`.

### Batch D — Row actions unification
- Bug #11 + #34: single shared `RowActions` component, icon-only, reuse everywhere.

### Batch E — Page Anatomy compliance
- Bugs #15, #21, #32, #33: add StatsGrid + FilterBar + Table to Bookings, Invoices, Ratings, Contact-messages.

### Batch F — Home stats accuracy
- Bug #35, #36: align pending-approval counter with booking-list filter; add explicit time windows in labels.

### Batch G — Bookings create-flow polish
- Bugs #14, #16, #17, #18: duplicate-prefix fix, halalas formatter, working back button, unify status column.

---

## Files touched by this session

- `docs/superpowers/qa/e2e-dashboard/clients-report-2026-04-24.md`
- `docs/superpowers/qa/e2e-dashboard/employees-report-2026-04-24.md`
- `docs/superpowers/qa/e2e-dashboard/employees-retest-2026-04-24.md`
- `docs/superpowers/qa/e2e-dashboard/employees-retest2-2026-04-24.md`
- `docs/superpowers/qa/e2e-dashboard/services-report-2026-04-24.md`
- `docs/superpowers/qa/e2e-dashboard/bookings-report-2026-04-24.md`
- `docs/superpowers/qa/e2e-dashboard/finance-report-2026-04-24.md`
- `docs/superpowers/qa/e2e-dashboard/settings-report-2026-04-24.md`
- `docs/superpowers/qa/e2e-dashboard/tools-report-2026-04-24.md`
- `docs/superpowers/qa/e2e-dashboard/home-report-2026-04-24.md`
- `docs/superpowers/qa/e2e-dashboard/MASTER-REPORT-2026-04-24.md` (this file)
- Screenshots: `docs/superpowers/qa/e2e-dashboard/*.png`
