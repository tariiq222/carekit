# E2E QA Report — Phase 6: Settings & Admin

**Date:** 2026-04-24
**Routes tested:** `/users`, `/branding`, `/settings`, `/settings/billing`, `/settings/sms`, `/content`

## Results Summary

| # | Route | Status | Severity |
|---|-------|--------|----------|
| 6.1 | `/users` | 🐛 Multiple issues | High |
| 6.2 | `/branding` | 🐛 Breadcrumb + stored nulls | Medium |
| 6.3 | `/settings` | 🐛 Garbled nested tab label | Low |
| 6.4 | `/settings/billing` | 🐛 Breadcrumb + duplicated empty state | Low |
| 6.5 | `/settings/sms` | 🐛 Breadcrumb untranslated | Low |
| 6.6 | `/content` | 🐛 Breadcrumb + 5 "coming soon" placeholders | Low |

---

## 🐛 BUG #23 — `/users` shows raw i18n keys

### Severity: **HIGH** (visible, professional-looking but broken)

### Reproduction
Navigate to `/users`.

### Actual — visible raw translation keys:

| uid | Raw string rendered |
|-----|---------------------|
| 70_51 | `users.stats.inactive` |
| 70_62, 70_70, 70_78, 70_86, 70_94 | `users.role.RECEPTIONIST` |
| 70_102 | `users.role.SUPER_ADMIN` |
| 70_110 | `users.role.ADMIN` |

### Expected
- `users.stats.inactive` → "غير نشط"
- `users.role.RECEPTIONIST` → "موظف استقبال"
- `users.role.ADMIN` → "مدير"
- `users.role.SUPER_ADMIN` → "مدير المنصة"

### Fix
Add the missing keys to `apps/dashboard/lib/translations/{ar,en}.users.ts` (or wherever the users feature file lives), then run `npm run i18n:verify` to confirm parity.

---

## 🐛 BUG #24 — Seeded isolation-test users pollute the `/users` list

### Severity: **HIGH** (data quality)

### Reproduction
On `/users` list (default org), 5 of 7 users have:
- Display name: **"RT Test User"**
- Email: `iso-rt-1777034417968@t.test`, `iso-rt-1777033871677@t.test`, `iso-rt-1777035050197@t.test`, `iso-rt-1777035098460@t.test`, `iso-rt-1777035136030@t.test`

These are artifacts from **tenant-isolation e2e tests** that wrote users into the default org and were never cleaned up.

### Evidence
Email domain `@t.test` and name prefix `RT` match the pattern in `apps/backend/test/tenant-isolation/*.e2e-spec.ts`.

### Fix
Two complementary fixes:
1. **Isolation e2e tests** must use **disposable organizations** (create org in `beforeAll`, truncate or cascade-delete in `afterAll`), never write to `00000000-0000-0000-0000-000000000001`.
2. **Seed cleanup** — `npm run seed` should `deleteMany` users/bookings whose email matches `@t.test` or is in the isolation-test namespace, so a re-seed resets the DB to a clean demo state.

### Files to check
- `apps/backend/test/tenant-isolation/*.e2e-spec.ts`
- `apps/backend/prisma/seed.ts`

---

## 🐛 BUG #25 — `/users` stats card "الأدوار = 0" is wrong

### Severity: **MEDIUM**

### Reproduction
Stats card shows "الأدوار: 0" while the table has users with 3 distinct roles (RECEPTIONIST, ADMIN, SUPER_ADMIN).

### Expected
Count of distinct roles assigned (3), or count of configured custom roles, whichever the card is meant to represent.

### Probable cause
- The stats API reads from the old `CustomRole` table (post-SaaS-05b) and no custom roles have been created yet. If so, the stat label should say "الأدوار المخصصة" not just "الأدوار" to match reality.
- Or the query is buggy.

### Fix
Clarify label if it's about custom roles; fix the aggregation otherwise.

---

## 🐛 BUG #26 — Breadcrumbs on 4 different routes are not translated

### Severity: **MEDIUM** (visible on 4 pages, same root cause)

### Reproduction

| Route | Breadcrumb (wrong) | Expected |
|-------|--------------------|----------|
| `/branding` | `الرئيسية › branding` | `الرئيسية › إعداد النظام` (or "البراندنق") |
| `/settings/billing` | `الإعدادات › billing` | `الإعدادات › الفوترة والاشتراك` |
| `/settings/sms` | `الإعدادات › sms` | `الإعدادات › الرسائل النصية` |
| `/content` | `الرئيسية › content` | `الرئيسية › المحتوى` |

Four routes have Arabic H1 titles in the page body but untranslated English path segments in the breadcrumb.

### Root cause
The breadcrumb component likely falls back to the URL segment when no translation exists. The translation map probably has `nav.<slug>` keys but the breadcrumb uses a different lookup that misses them.

### Fix
Unify: breadcrumb should call the same `t(nav.<slug>)` lookup that the sidebar uses, with the same fallback chain.

### File
`apps/dashboard/components/features/shared/breadcrumbs.tsx` (or wherever breadcrumbs live).

---

## 🐛 BUG #27 — `/settings` nested tab label looks garbled: "عام البريد الإلكتروني"

### Severity: **LOW**

### Reproduction
1. `/settings` → main tab "عام" is selected.
2. Under it, nested tabs are rendered — the first tab label reads **"عام البريد الإلكتروني"** (literally concatenation of "عام" + "البريد الإلكتروني").

### Expected
Either "البريد الإلكتروني" alone, or a different sensible label.

### Probable cause
The a11y tree shows:
```
uid=72_49 tab "عام البريد الإلكتروني" selectable selected
uid=72_50 tab "الإعدادات الإقليمية" selectable
```

The tab label might be rendered via `<h3>{sectionTitle}</h3>` + `<span>{tabName}</span>` without separator, making them read as one string to screen readers. Or there's a real text concatenation bug.

### Fix
Inspect `apps/dashboard/components/features/settings/general-tab.tsx`. Make sure each tab has a single accessible name; if it's visually rendered as heading + subtab, use `aria-label` on the tab to override the accessible name.

---

## 🐛 BUG #28 — `/settings/billing` renders "لا يوجد اشتراك نشط" twice

### Severity: **LOW**

### Reproduction
Open `/settings/billing`. Two identical StaticText nodes appear one after the other:

```
uid=73_40 StaticText "لا يوجد اشتراك نشط."
uid=73_41 StaticText "لا يوجد اشتراك نشط."
```

### Probable cause
The plan card and the usage card each render their own "no-subscription" empty state independently when there is no subscription. Either consolidate into one top-level banner when no subscription exists, or have the subcards render "—" placeholders instead of repeating the full message.

### Fix
`apps/dashboard/app/(dashboard)/settings/billing/page.tsx` (orchestration) — detect the no-subscription case once and render a single message; downstream components should render skeletons or "—" for their individual stats.

---

## 🐛 BUG #29 — `/branding` has 4 ColorWells defaulting to `#000000` with empty text fields

### Severity: **LOW** (visual inconsistency)

### Reproduction
`/branding` → scroll to colors section.

| Field | ColorWell shows | Text input value |
|-------|-----------------|------------------|
| اللون الرئيسي | `#354fd8` | `#354FD8` ✓ |
| اللون الرئيسي الفاتح | `#000000` | **empty** |
| اللون الرئيسي الداكن | `#000000` | **empty** |
| اللون الثانوي | `#82cc17` | `#82CC17` ✓ |
| لون التمييز الداكن | `#000000` | **empty** |
| لون الخلفية | `#000000` | **empty** |

### Problem
The user sees 4 color wells that look like "black is selected" even though the DB value is `null`. The native `<input type="color">` defaults to `#000000` when the value is missing — which **looks like a deliberate black choice** but isn't.

### Fix
When the branding config field is null/undefined:
- Derive the default from CSS custom properties (`var(--primary-light)` etc.) and populate the ColorWell with the computed value, OR
- Visually mark the input as "not set" (e.g., dashed border + "افتراضي" chip) so it's obvious it inherits from the theme.

---

## ✅ Working

### /users
- Stats cards present (إجمالي 7, نشط 7, الأدوار 0, غير نشط ...) — anatomy correct aside from Bug #23/#25.
- Users tab + Roles tab + Activity tab — good grouping.
- "إضافة مستخدم" button present.
- Rows render avatar initials + name + email + role + phone + status + registration date.

### /branding
- Full-form page with save. Color preview box with live contrast computation (6.1:1 AA, 16.5:1 AAA). Font + website domain + design theme inputs. Solid.

### /settings (structural)
- 8 top-level tabs cover all important areas (General, Booking Policy, Cancellation, Hours, Payment, Integrations, ZATCA, Email templates).

---

## Next phase

Phase 7 — Tools (Notifications, Contact Messages, Chatbot, Activity Log).
