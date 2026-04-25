# E2E QA Report — Phase 5: Finance (المدفوعات / الفواتير / الكوبونات / التقارير / ZATCA)

**Date:** 2026-04-24
**Tester:** Claude (Chrome DevTools MCP)
**Routes tested:** `/payments`, `/invoices`, `/coupons`, `/reports`, `/zatca`

## Results Summary

| # | Route | Status | Severity |
|---|-------|--------|----------|
| 5.1 | `/payments` | ✅ PASS (empty data) | — |
| 5.2 | `/invoices` | 🐛 Minimal — spec violation | Medium |
| 5.3 | `/coupons` | 🛑 Empty main area | High |
| 5.4 | `/reports` | 🛑 Empty main area | High |
| 5.5 | `/zatca` | 🐛 Redirects but no tab UI | Medium |

---

## 🐛 BUG #20 — `/coupons` and `/reports` render completely blank main area

### Severity: **HIGH** (dead routes)

### Reproduction
1. Navigate to `/coupons` — the sidebar, top bar, and command-palette render fine, but the `<main>` area contains **zero content nodes**.
2. Same for `/reports`.

### A11y snapshot evidence (main area for /coupons):
```
uid=67_26 main
  uid=67_27 button "Toggle Sidebar"
  uid=67_28 button "الوضع الداكن"
  uid=67_29 button "Settings" ...
  uid=67_30 button "Notifications" ...
  uid=67_31 button "A Admin مدير العيادة" ...
  uid=67_32 heading "Command Palette" level="2"
  uid=67_33 StaticText "Search for a command to run..."
```

No `<PageHeader>`, no `<Breadcrumbs>`, no content at all. `/reports` shows the same pattern.

### Expected (per `CLAUDE.md`: Feature Flags — Plan-Gated)
Both `COUPONS` and `ADVANCED_REPORTS` are plan-gated. When the flag is off for the current subscription:
- Show a **FeatureGate fallback** (e.g., "هذه الميزة متاحة في الخطة الاحترافية · [ترقية الخطة]"), OR
- Redirect to a dedicated upsell page, OR
- Hide the route from the sidebar (current sidebar already omits these — check `sidebar-config.ts`).

Silently rendering nothing is the worst of all options — the user sees a broken page.

### Probable root cause
`app/(dashboard)/coupons/page.tsx` and `app/(dashboard)/reports/page.tsx` likely use a `<FeatureGate>` component with **no fallback prop**:

```tsx
// BAD (current)
<FeatureGate feature="coupons">
  <CouponsListPage />
</FeatureGate>

// GOOD
<FeatureGate feature="coupons" fallback={<FeatureDisabledState feature="coupons" />}>
  <CouponsListPage />
</FeatureGate>
```

### Fix
Add a shared `<FeatureDisabledState />` component (title + description + upgrade CTA) and wire it as the fallback for every gated page.

---

## 🐛 BUG #21 — `/invoices` is skeletal — missing StatsGrid / FilterBar / Table

### Severity: **MEDIUM** (spec violation — Page Anatomy — The Law)

### Reproduction
1. Open `/invoices`.
2. All you see is:
   - Breadcrumbs: الرئيسية › الفواتير
   - H1: "الفواتير"
   - Subtitle: "الفواتير والتوافق مع فاتورة"
   - Single text node: **"لا توجد فواتير للعرض."**

### Missing per spec
- StatsGrid (4× StatCard: إجمالي الفواتير, مدفوعة, معلقة, متأخرة)
- FilterBar (search, status dropdown, date range)
- DataTable with column headers (even if empty)
- "إنشاء فاتورة" button in PageHeader (unless feature-flagged)

### Fix
Implement the full Page Anatomy. The empty state ("لا توجد فواتير للعرض") should live **inside** the table body, not replace the whole page.

### File
`apps/dashboard/app/(dashboard)/invoices/page.tsx` (and its feature components under `components/features/invoices/`).

---

## 🐛 BUG #22 — `/zatca` redirects to `/invoices?tab=zatca` but no tab UI renders

### Severity: **MEDIUM** (broken route)

### Reproduction
1. Click "ZATCA" from the sidebar (or navigate directly to `/zatca`).
2. URL becomes `/invoices?tab=zatca`.
3. Page renders identically to `/invoices` — no `<Tabs>` visible, no ZATCA-specific content, same "لا توجد فواتير للعرض" empty state.

### Expected
Either:
- A real `/zatca` route with its own page (VAT submission status, e-invoicing config, XML signing test).
- Or, if intentionally merged into `/invoices`, a `<Tabs>` component with "الفواتير" and "ZATCA" tabs visible — current page has no tabs.

### Sidebar mismatch
The sidebar doesn't have a ZATCA entry at all in the default nav (not shown in the tested build) — so the `/zatca` URL exists only to be navigated to directly (deep link), but it is effectively dead.

### Fix
Either implement the dedicated `/zatca` route with ZATCA compliance UI, or remove the route entirely. Don't silently redirect to a page that doesn't know the query param.

### File
- `apps/dashboard/app/(dashboard)/zatca/page.tsx` — either expand or delete.
- `apps/dashboard/app/(dashboard)/invoices/page.tsx` — if merging, add Tabs and render ZATCA content.

---

## ✅ /payments works correctly (empty-state baseline)

### Observations
- Breadcrumbs ✓
- PageHeader (title + subtitle) ✓
- StatsGrid: 4 cards — إجمالي الإيرادات (0 · 0 معاملة) · معلقة (0 · 0) · مدفوعة (0 · 0) · مستردة (0 · 0) ✓
- FilterBar: search + status dropdown + method dropdown ✓
- DataTable with full column headers: # · المستفيد · المبلغ (ر.س) · الطريقة · الحالة · التاريخ ✓
- Empty state inside table body: "لا توجد مدفوعات · لا توجد مدفوعات تطابق معايير البحث." ✓
- No "Add" button in PageHeader — correct, payments are created via Moyasar webhook, not manually.

This is the correct template the other finance pages should follow.

### Related to Bug #16
The existing 17 bookings each show a price like "250.00 ر.س" but **zero** matching payment records exist. Either the seed needs to generate Payment rows when it generates Bookings, or the booking-payment link runs only after a user-driven pay action. Worth clarifying with the product owner.

---

## Next phase

Phase 6 — Settings (users, roles, branding, SMS, billing).
