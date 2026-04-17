# خطة اختبار E2E — الفوترة الإلكترونية السعودية (ZATCA)

> **المسار:** `/zatca` أو `/invoices?tab=zatca`
> **⚠️ Owner-only:** ZATCA module حساس قانونياً — Saudi e-invoicing regulation
> **آخر تحديث:** 2026-04-17

---

## 1. التحضير

```bash
cd apps/backend && npm run dev
cd apps/dashboard && npm run dev
```

**البيانات:**
- VAT number صالح (مثال: `310000000003`)
- Seller name = اسم الكيان
- Environment = `sandbox` (افتراضي للاختبار)
- فواتير جاهزة للإرسال (لاختبار submit)

### 1.1 Authentication
- **Owner role مطلوب** — اختبر 403 لـ admin عادي

---

## 2. خريطة الصفحة

```text
Breadcrumbs
PageHeader   [عنوان+وصف]
StatsGrid    [Environment] [Onboarded] [VAT Number] [Seller Name]
Card:
  Sidebar:   [Config] [Status]
  Content:   Config → 2×2 grid cards + Onboard button
             Status → Onboarded badge + onboardedAt

Sheet:       ZatcaOnboardSheet (right-side)
```

---

## 3. التحميل

- [ ] `GET /dashboard/finance/zatca/config` → 200
- [ ] StatsGrid:
  - Environment: badge `sandbox` أو `production`
  - Onboarded: `Yes` / `No` badge
  - VAT Number: القيمة أو `—`
  - Seller: الاسم أو `—`

### 3.1 Permission check
- [ ] admin عادي → 403 أو redirect
- [ ] Owner → الصفحة تحمّل

---

## 4. Config Tab

### 4.1 البطاقات (2×2 grid)
1. **VAT Number card:** yes readonly display
2. **Org name card:** seller name
3. **Environment card:** sandbox/production badge
4. **Onboard button card:**
   - [ ] disabled إذا isOnboarded=true
   - [ ] enabled إذا isOnboarded=false
   - [ ] click → يفتح ZatcaOnboardSheet

---

## 5. ZatcaOnboardSheet

### 5.1 الحقول
| الحقل | نوع | مطلوب | validation |
|-------|-----|-------|------------|
| vatRegistrationNumber | Input (tabular-nums) | ✓ | min 1 (ولكن منطقياً 15 رقم) |
| sellerName | Input | ✓ | min 1 |

اختبارات validation:
- [ ] submit فارغ → خطأ على الحقلين
- [ ] vatRegistrationNumber = `123` (ناقص) — backend يرفض؟ الـ regex على حسب ZATCA spec
- [ ] vatRegistrationNumber = 15 رقم + يبدأ بـ 3 → مقبول (ZATCA format: 15 digits, starts with 3, ends with 03)
- [ ] sellerName بعربي + إنجليزي معاً — هل يُقبل؟

### 5.2 Submit
- [ ] `POST /dashboard/finance/zatca/onboard` body `{vatRegistrationNumber, sellerName}`
- [ ] pending state + button disabled
- [ ] نجاح → sheet يقفل + toast + query invalidate
- [ ] StatsGrid يحدّث: `Onboarded = Yes`
- [ ] onboardedAt يُحفظ بـ timestamp الحالي

### 5.3 فشل onboarding
- [ ] backend 400 (VAT invalid بـ ZATCA) → رسالة واضحة
- [ ] backend 500 (ZATCA down) → retry button
- [ ] Sheet لا يقفل — البيانات محفوظة في form

---

## 6. Status Tab

- [ ] Onboarded: badge `yes/no`
- [ ] Onboarded date: `MMM d, yyyy` بـ `ar-SA` locale (مثل `١٧ أبر، ٢٠٢٦`)
- [ ] إذا !isOnboarded → تاريخ يعرض `—`

---

## 7. Submit Invoice to ZATCA

في صفحة الفواتير، لكل فاتورة:
- `POST /dashboard/finance/zatca/submit` body `{invoiceId}`
- [ ] زر Submit يظهر إذا `zatcaStatus != reported`
- [ ] بعد submit → حالة تتحول إلى `reported/submitted`
- [ ] فشل → `failed` + error message
- [ ] نجاح في sandbox → QR code + hash يُحفظان

**ملاحظة:** هذا قد يكون في `invoices.md` بدل هنا — تحقق.

---

## 8. Edge Cases

### 8.1 Double onboard
- [ ] onboarded بالفعل → button disabled
- [ ] لو بدلاً attempt POST مرتين — backend idempotent؟

### 8.2 VAT number duplicate
- [ ] لن يحدث في single-org، لكن backend constraint check

### 8.3 Environment switch sandbox ↔ production
- [ ] هل UI يسمح بالتغيير؟
- [ ] تغيير production → sandbox يلغي onboarding؟

### 8.4 Sandbox vs production behavior
- [ ] sandbox: ZATCA submit mock/real?
- [ ] production: فواتير حقيقية تُسجَّل

### 8.5 ZATCA API down
- [ ] timeout graceful
- [ ] retry mechanism في backend

### 8.6 Invoice submit خارج window
- [ ] ZATCA يتطلب submission خلال 24h من invoice issue
- [ ] backend يفلتر قديمة؟ UI يبرز؟

### 8.7 Credit note (refund)
- [ ] عندما payment refunded → credit note تُنشأ تلقائياً
- [ ] credit note submit لـ ZATCA

---

## 9. Security

### 9.1 Owner gate
- [ ] `/dashboard/finance/zatca/*` endpoints كلها محمية CASL
- [ ] غير owner → 403

### 9.2 VAT number مرئي
- [ ] VAT number يظهر كامل في admin UI
- [ ] في logs/activity-log لا يُعرض masked

---

## 10. RTL + Dark

- [ ] VAT number font tabular-nums LTR
- [ ] stats grid badges dark contrast
- [ ] onboarding sheet RTL form

---

## 11. Screenshots

`screenshots/zatca/`:
1. `stats-grid-not-onboarded.png`
2. `stats-grid-onboarded.png`
3. `config-tab.png`
4. `status-tab.png`
5. `onboard-sheet.png`
6. `onboard-validation-errors.png`
7. `403-non-owner.png`

---

## 12. curl

```bash
TOKEN="<owner-jwt>"
API="http://localhost:5100"

# config
curl -H "Authorization: Bearer $TOKEN" \
  "$API/dashboard/finance/zatca/config" | jq

# onboard
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"vatRegistrationNumber":"310000000003","sellerName":"Clinic Ltd"}' \
  "$API/dashboard/finance/zatca/onboard" | jq

# submit invoice
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"invoiceId":"<uuid>"}' \
  "$API/dashboard/finance/zatca/submit" | jq

# 403 check
curl -H "Authorization: Bearer $NON_OWNER_TOKEN" \
  "$API/dashboard/finance/zatca/config" | jq
# expected: 403
```

---

## 13. Red Flags

- ⚠️ **Owner-only enforcement** — CASL guard on all endpoints
- ⚠️ **VAT regex/format** — 15 digits, 3..03 — validation frontend + backend
- ⚠️ **Environment switch** — sandbox↔production — data isolation
- ⚠️ **Idempotency** — double POST onboard
- ⚠️ **ZATCA API coupling** — downtime handling
- ⚠️ **24h submission window** — for live invoices
- ⚠️ **Credit notes (refunds)** — auto-submit
- ⚠️ **Audit trail** — كل ZATCA action في activity-log
- ⚠️ **StaleTime 30min** — UI قد يعرض حالة قديمة
- ⚠️ **Submitted invoice editing** — محظور قانونياً

---

## 14. معايير النجاح

- [ ] Owner gate passes
- [ ] Onboarding sheet validation + submit
- [ ] Double onboard prevented
- [ ] Status tab accurate
- [ ] Invoice submit E2E (sandbox)
- [ ] Environment badge correct
- [ ] Screenshots + curl fidelity
- [ ] Audit entries في activity-log لكل pro ZATCA
