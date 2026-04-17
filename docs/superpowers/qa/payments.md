# خطة اختبار E2E — المدفوعات (Payments)

> **المسار:** `/payments`
> **⚠️ Owner-only:** مرتبط بـ Moyasar + ZATCA — حساسية أمنية عالية
> **آخر تحديث:** 2026-04-17

---

## 1. التحضير

```bash
cd apps/backend && npm run dev
cd apps/dashboard && npm run dev
```

**البيانات:**
- 15+ دفعة (مزيج حالات: pending/paid/refunded/failed)
- 3+ Moyasar payments + 3+ bank_transfer + 2+ cash
- دفعة bank_transfer مع receipts (AI verification)
- دفعة paid للاختبار refund
- دفعة refunded سابقاً

### 1.1 Authentication
- **لازم owner role** — اختبر أن admin عادي يرجع 403

---

## 2. خريطة الصفحة

```text
Breadcrumbs
PageHeader   [عنوان+وصف]
StatsGrid    [إجمالي/totalAmount] [معلّق/pendingAmount] [مدفوع/completedAmount] [مسترد/refundedAmount]
FilterBar    [بحث] [الحالة▼] [الطريقة▼] [من▼] [إلى▼] [إعادة تعيين]
DataTable    [#] [العميل] [المبلغ] [الطريقة] [الحالة] [التاريخ] [إجراءات]
Dialogs      PaymentDetailSheet · RefundDialog · VerifyDialog
```

---

## 3. التحميل

- [ ] `GET /dashboard/finance/payments/stats` → 200
- [ ] `GET /dashboard/finance/payments?page=1&limit=20` → 200
- [ ] StatsGrid:
  - الإجمالي: `total` + `totalAmount`
  - المعلّق: `pending` + `pendingAmount`
  - المدفوع: `completed` + `completedAmount`
  - المسترد: `refunded` + `refundedAmount`
- [ ] كل بطاقة تعرض عدد + مبلغ

### 3.1 403 check
- [ ] سجّل دخول كـ admin عادي
- [ ] الصفحة ترجع 403 أو redirect
- [ ] `GET /stats` يرجع 403

---

## 4. FilterBar

### 4.1 البحث
- placeholder "بحث باسم المريض، رقم الفاتورة..."
- يبحث في client name + invoice number + transaction ref

### 4.2 الحالة
القيم: `all | pending | paid | refunded | failed`
- [ ] كل قيمة ترسل `status=<value>`
- [ ] ghost check لـ `all`

**ملاحظة:** enum backend فيه `awaiting | rejected` أيضاً — هل الـ UI يعرضها؟ تحقق.

### 4.3 الطريقة
القيم: `all | moyasar | bank_transfer`
- [ ] `cash` موجود في enum لكن ليس في dropdown — تحقق

### 4.4 dateFrom/dateTo
- [ ] `fromDate` / `toDate`

---

## 5. الجدول

| # | العمود | المحتوى |
|---|--------|---------|
| 1 | # | أول 8 من id (clickable) |
| 2 | العميل | booking.client firstName + lastName |
| 3 | المبلغ | totalAmount مع ر.س |
| 4 | الطريقة | badge: Moyasar / Bank Transfer / Cash |
| 5 | الحالة | badge: pending/paid/refunded/failed |
| 6 | التاريخ | createdAt |
| 7 | إجراءات | View Details · Refund (إذا paid) |

اختبارات:
- [ ] badges بألوان مختلفة لكل حالة
- [ ] Refund يظهر فقط على paid (ليس refunded/failed)
- [ ] currency formatting 2 decimals

---

## 6. DetailSheet

قسم **Payment:**
- id
- totalAmount
- vatAmount
- method
- transactionRef

قسم **Booking:**
- client, employee, service, date

قسم **Bank Transfer Receipts** (إذا موجود):
- لكل receipt:
  - aiVerificationStatus: 8 قيم
  - aiConfidence (%)
  - adminNotes
  - createdAt
  - receiptUrl (صورة)

قسم **Actions** (bottom):
- `Refund` — إذا status=paid
- `Verify Transfer` — إذا method=bank_transfer و receipts.length > 0

اختبارات:
- [ ] AI verification status ظاهر للكل الـ 8 حالات:
  pending / matched / amount_differs / suspicious / old_date / unreadable / approved / rejected
- [ ] aiConfidence يعرض `%`
- [ ] receipt image تحمّل من MinIO أو CDN

---

## 7. RefundDialog

### 7.1 الحقول
| الحقل | نوع | مطلوب | validation |
|-------|-----|-------|------------|
| reason | textarea | ✓ | min 1 char |
| amount | number | — | 0.01+ max=originalAmount |

### 7.2 Validation
- [ ] reason فارغ → خطأ
- [ ] amount = 0 → خطأ (min 0.01)
- [ ] amount > originalAmount → خطأ
- [ ] amount فارغ → refund كامل (افتراضي)
- [ ] amount = originalAmount → full refund

### 7.3 Submit
- [ ] `PATCH /dashboard/finance/payments/{id}/refund` body `{reason, amount?}`
- [ ] toast نجاح
- [ ] الحالة في الجدول → refunded
- [ ] StatsGrid `المسترد` يحدّث

**⚠️ Critical test:** Refund هو عملية irreversible — تأكد من confirmation واضح.

---

## 8. VerifyDialog (Bank Transfer)

### 8.1 الحقول
| الحقل | نوع | مطلوب | validation |
|-------|-----|-------|------------|
| action | select | ✓ | `approve | reject` |
| transferRef | textarea | — | — |

### 8.2 Validation
- [ ] action فارغ → خطأ
- [ ] transferRef يُستحسن على approve — قد يكون optional

### 8.3 Submit
- [ ] `PATCH /dashboard/finance/payments/{id}/verify` body `{action, transferRef?}`
- [ ] approve → status يتحول paid
- [ ] reject → status يتحول rejected
- [ ] toast + DetailSheet يحدّث
- [ ] receipt.aiVerificationStatus يصبح approved/rejected

---

## 9. Edge Cases

### 9.1 Moyasar callback failure
- [ ] payment في حالة pending لفترة طويلة — manual resolve؟
- [ ] transactionRef null على pending — UI يعرض `—`

### 9.2 Refund جزئي ثم آخر
- [ ] هل النظام يدعم refunds متعددة؟ أو refund واحد فقط؟
- [ ] الإجمالي المسترد لا يتجاوز الأصلي

### 9.3 Bank transfer AI suspicious
- [ ] UI يبرز receipts بحالة suspicious/amount_differs
- [ ] admin يراجع ويقرر

### 9.4 Cash payment
- [ ] لا يحتاج verify
- [ ] Refund لـ cash — كيف؟ manual؟

### 9.5 ZATCA linked invoice
- [ ] Refund → invoice تُعكس أيضاً؟
- [ ] تحقق تناسق payment status ↔ invoice status

### 9.6 Currency edge
- [ ] مبلغ 0.01 — يُقبل؟
- [ ] مبلغ > 10,000 — Moyasar limits؟

---

## 10. RTL + Dark
- [ ] أرقام ltr، currency ر.س rtl
- [ ] receipt image preview
- [ ] StatsGrid glass

---

## 11. Screenshots
`screenshots/payments/`:
1. `list-light.png`
2. `list-dark.png`
3. `detail-sheet-moyasar.png`
4. `detail-sheet-bank-transfer.png` (مع receipts)
5. `refund-dialog.png`
6. `verify-dialog.png`
7. `403-admin.png` (owner-only gate)

---

## 12. curl

```bash
TOKEN="<owner-jwt>"
API="http://localhost:5100"

# stats
curl -H "Authorization: Bearer $TOKEN" \
  "$API/dashboard/finance/payments/stats" | jq

# قائمة
curl -H "Authorization: Bearer $TOKEN" \
  "$API/dashboard/finance/payments?page=1&limit=20&status=paid&method=moyasar" | jq

# refund
curl -X PATCH -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason":"customer request","amount":50.00}' \
  "$API/dashboard/finance/payments/<id>/refund" | jq

# verify
curl -X PATCH -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"approve","transferRef":"TRX123456"}' \
  "$API/dashboard/finance/payments/<id>/verify" | jq

# 403 check
curl -H "Authorization: Bearer $NON_OWNER_TOKEN" \
  "$API/dashboard/finance/payments" | jq
```

---

## 13. Red Flags

- ⚠️ **Owner-only gate** — لازم تحقق CASL guard يرفض غير owner
- ⚠️ **Refund irreversible** — UI يجب confirm واضح
- ⚠️ **Partial refund logic** — multiple refunds تراكم؟
- ⚠️ **Moyasar webhook dependency** — status pending قد يعلق بلا webhook
- ⚠️ **ZATCA coupling** — refund يستدعي ZATCA credit note
- ⚠️ **receipt AI status** — 8 قيم لا اختزال، UI يعرضها صح
- ⚠️ **cash method** في enum لكن ليس في filter dropdown — إخفاء مقصود؟
- ⚠️ **transactionRef** على moyasar vs bank_transfer مختلف

---

## 14. النجاح
- [ ] Owner gate passes (non-owner blocked)
- [ ] StatsGrid قيم صحيحة
- [ ] Refund e2e
- [ ] Verify bank transfer e2e
- [ ] 8 AI statuses معالجة
- [ ] Screenshots + curl fidelity
