# خطة اختبار E2E — الفواتير (Invoices)

> **المسار:** `/invoices` (قائمة + DetailSheet فقط — لا إنشاء من UI)
> **آخر تحديث:** 2026-04-17

---

## 1. التحضير

```bash
cd apps/backend && npm run dev
cd apps/dashboard && npm run dev
```

**البيانات:**
- 10+ فواتير (توليد تلقائي من payments مكتملة)
- فواتير بحالات ZATCA مختلفة: pending / reported / failed / not_applicable
- فاتورة مع QR code
- فاتورة لم تُرسل (`sentAt = null`)

---

## 2. خريطة الصفحة

```text
Breadcrumbs
PageHeader   [عنوان+وصف]          (لا زر إنشاء — تُنشأ من backend)
StatsGrid    (تحقق وجوده — قد لا يكون في هذه الصفحة)
FilterBar    [بحث] [حالة ZATCA▼] [من▼] [إلى▼] [إعادة تعيين]
DataTable    [#الفاتورة] [العميل] [المجموع] [الضريبة] [ZATCA] [التاريخ] [إجراءات]
Dialogs      InvoiceDetailSheet
```

---

## 3. التحميل

- [ ] `GET /dashboard/finance/invoices?page=1&limit=20` → 200
- [ ] كل صف يعرض `invoiceNumber` (unique، ليس id)
- [ ] لا console errors

---

## 4. FilterBar

### 4.1 البحث
- يبحث في invoiceNumber / client name

### 4.2 حالة ZATCA
القيم: `all | not_applicable | pending | reported | failed`

**⚠️ ملاحظة:** Explore ذكر `submitted/accepted/rejected/warning` في عمود الحالة و`not_applicable/pending/reported/failed` في الـ type — تحقق أي القيمتين هي النهائية.

- [ ] كل قيمة ترسل `zatcaStatus=<value>`
- [ ] Boolean bug لا يطبق (هذا enum string)

### 4.3 dateFrom/dateTo
- [ ] `fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD`

---

## 5. الجدول

| # | العمود | المحتوى |
|---|--------|---------|
| 1 | #الفاتورة | invoiceNumber (monospace، clickable) |
| 2 | العميل | booking.client.firstName + lastName |
| 3 | المجموع | totalAmount مع currency |
| 4 | الضريبة | taxAmount |
| 5 | ZATCA | badge ملوّن |
| 6 | التاريخ | createdAt format |
| 7 | إجراءات | View Details · Send Invoice (إذا !sentAt) |

اختبارات:
- [ ] اضغط invoiceNumber → يفتح DetailSheet
- [ ] ZATCA badges بألوان مختلفة:
  - pending/not_applicable → neutral
  - reported/accepted → success
  - failed/rejected → destructive
  - warning → warning
- [ ] `Send Invoice` يظهر فقط إذا sentAt = null

### 5.1 زر Send Invoice
- [ ] اضغط → يرسل فاتورة للعميل (email؟)
- [ ] بعد الإرسال — الزر يختفي
- [ ] sentAt يُحدَّث في DB

---

## 6. DetailSheet

قسم **Amounts:**
- subtotal
- taxAmount
- totalAmount

قسم **ZATCA:**
- status
- hash (truncated)
- sentAt

قسم **QR Code** (إذا موجود):
- صورة 128px

قسم **Booking:**
- client
- employee
- service name
- date

قسم **Payment:**
- method
- status

اختبارات:
- [ ] QR code يظهر فقط إذا موجود في البيانات
- [ ] hash truncated مع tooltip للنص الكامل
- [ ] sentAt = null → يعرض `—` أو `لم تُرسل`
- [ ] ZATCA status متطابق مع الجدول

---

## 7. Edge Cases

### 7.1 ZATCA failed
- [ ] Badge destructive
- [ ] DetailSheet يعرض سبب الفشل (إذا موجود)
- [ ] إعادة المحاولة — هل يوجد زر؟

### 7.2 QR code مفقود
- [ ] القسم يختفي أو يعرض placeholder

### 7.3 invoiceNumber بصيغة خاصة
- [ ] عرض RTL/LTR صحيح

### 7.4 taxAmount = 0
- [ ] يعرض `0.00` أو يختفي؟

### 7.5 فاتورة لدفعة ملغاة/مستردة
- [ ] السلوك؟ الفاتورة تُلغى تلقائياً؟

---

## 8. RTL + Dark
- [ ] أرقام currency ltr حتى في RTL
- [ ] QR code image في المكان الصحيح
- [ ] glass sheet

---

## 9. Screenshots
`screenshots/invoices/`:
1. `list.png`
2. `detail-sheet-full.png` (مع QR)
3. `detail-sheet-no-qr.png`
4. `zatca-badges.png` (كل الألوان)
5. `filter-by-zatca.png`

---

## 10. curl

```bash
TOKEN="<jwt>"
API="http://localhost:5100"

# قائمة
curl -H "Authorization: Bearer $TOKEN" \
  "$API/dashboard/finance/invoices?page=1&limit=20&zatcaStatus=reported" | jq

# واحدة
curl -H "Authorization: Bearer $TOKEN" \
  "$API/dashboard/finance/invoices/<id>" | jq

# إنشاء (backend — للتحقق فقط)
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"paymentId":"<uuid>"}' \
  "$API/dashboard/finance/invoices" | jq
```

---

## 11. Red Flags

- ⚠️ **ZATCA status mismatch** بين column enum و filter enum — توحيد مطلوب
- ⚠️ Send Invoice يعمل بلا تأكيد — confirmation؟
- ⚠️ لا إنشاء من UI — احتمال bug: إذا payment مكتمل بلا invoice مقابلة، UI يخفي هذه الحالة
- ⚠️ QR code load — CDN/MinIO؟
- ⚠️ Owner-only module — التأكد أن غير owner يرجع 403 صحيح

---

## 12. النجاح
- [ ] كل 4-5 حالات ZATCA في الجدول
- [ ] DetailSheet كامل
- [ ] Send Invoice E2E
- [ ] curl fidelity
