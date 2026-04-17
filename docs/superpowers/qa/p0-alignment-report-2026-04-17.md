# P0 Alignment Fixes — QA Report 2026-04-17

**Status:** All 4 P0 clusters fixed and verified  
**Branch:** `feat/phase0-p0-alignment`  
**Audit reference:** [UNIFIED-AUDIT-2026-04-17.md](empirical/UNIFIED-AUDIT-2026-04-17.md)  
**Spec reference:** [2026-04-17-backend-db-alignment.md](../specs/2026-04-17-backend-db-alignment.md)

---

## What Was Broken

From the empirical audit, 4 clusters were returning 400 on every save:

| # | Cluster | Root cause |
|---|---|---|
| 1 | POST `/dashboard/organization/branding` | Form sent `{systemName, systemNameAr, colorPrimary, ...}`; DTO accepted `{clinicNameAr, primaryColor, ...}`; 10 field names wrong |
| 2 | POST/PATCH `/dashboard/finance/coupons` | Form sent `discountType: "percentage"` (lowercase) and `minAmount`; DTO expects `"PERCENTAGE"` and `minOrderAmt` |
| 3 | POST/PATCH `/dashboard/organization/services` (deposit) | Form sent `depositAmount: data.depositPercent` (1-100 range); DTO validates amount ≤ price |
| 4 | GET `/dashboard/comms/notifications` | Dashboard type declared `{titleAr, titleEn, bodyAr, bodyEn, userId, data}`; API returns `{title, body, recipientId, metadata}` |

All caused by `forbidNonWhitelisted: true` + hand-written dashboard types drifting from backend DTOs. Silent failures because mutations had no `onError` handlers.

---

## Fixes Applied (9 commits)

| Commit | Fix |
|---|---|
| `56f1311` | Branding: DB migration (RENAME 4 cols + ADD 6 cols) + DTO + handler + dashboard types |
| `e6b96aa` | Branding quality: remove duplicate toasts, fix UpdateBrandingPayload type, add translation keys, semantic tokens |
| `d73cf62` | Coupons: uppercase enum + minOrderAmt rename in form + schema + types |
| `48227e0` | Coupons quality: remove duplicate error toast, fix UseFormReturn<any> |
| `6959ac4` | Services: depositPercent → depositAmount, remove ÷100 read, remove percent constraints |
| `9331db5` | Services quality: UseFormReturn<any> fix, translation copy, detail-sheet display bug |
| `85736c0` | Notifications: dashboard type aligned to wire shape |
| `9398713` | Notifications: add staleTime to all notification queries |
| `7aa4576` | Dashboard-wide: create toastApiError helper; audit confirmed all mutations already had error handlers |

---

## Browser Console Verification Scripts

### Branding (was broken — now fixed)

```js
const { accessToken } = await fetch('/api/proxy/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
  body: JSON.stringify({ email: 'admin@carekit-test.com', password: 'Admin@1234' }),
}).then(r => r.json());

const res = await fetch('http://localhost:5100/api/v1/dashboard/organization/branding', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
  body: JSON.stringify({
    organizationNameAr: 'اختبار',
    organizationNameEn: 'Test',
    colorPrimary: '#354FD8',
  }),
});
console.log(res.status, await res.json()); // Expected: 200
```

### Coupons (was broken — now fixed)

```js
const res = await fetch('http://localhost:5100/api/v1/dashboard/finance/coupons', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
  body: JSON.stringify({
    code: 'LIVE_TEST',
    discountType: 'PERCENTAGE',
    discountValue: 20,
    minOrderAmt: 10000,
    isActive: true,
  }),
});
console.log(res.status, await res.json()); // Expected: 201
```

### Services with deposit (was broken — now fixed)

```js
const cats = await fetch('http://localhost:5100/api/v1/dashboard/organization/categories', {
  headers: { Authorization: `Bearer ${accessToken}` },
}).then(r => r.json());
const categoryId = cats.data?.items?.[0]?.id ?? cats.items?.[0]?.id;

const res = await fetch('http://localhost:5100/api/v1/dashboard/organization/services', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
  body: JSON.stringify({
    nameAr: 'خدمة اختبار',
    nameEn: 'Test Service',
    categoryId,
    durationMins: 30,
    price: 100,
    depositEnabled: true,
    depositAmount: 20,
  }),
});
console.log(res.status, await res.json()); // Expected: 201
```

---

## Test Results

- **Backend unit tests:** 794 PASS / 3 FAIL (pre-existing on `main`, unrelated to this PR — `bookings/get-booking`, `bookings/list-bookings`, `employees/list-get-employees`)
- **Branding specs:** 5/5 PASS
- **Dashboard typecheck:** 0 new errors introduced

---

## Kiwi TCMS

- **Plan:** https://localhost:6443/plan/54/
- **Run:** https://localhost:6443/runs/140/

8 test cases, all PASS.

---

## What's NOT in This PR (Phase 1+)

- Notifications bilingual columns (`titleAr`/`titleEn` DB migration + every emitter rewrite)
- Migration drift cleanup: `website_phase1` orphan still needs proper resolution
- Invoice/Payment phantom dashboard type fields (P1)
- Employee legacy `name` deprecation (P3)
- Money unit unification (Decimal → Int halalat)
