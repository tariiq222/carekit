# الفواتير وZATCA (Invoices · ZATCA)

---

## Scenario Audit Summary

- Total scenarios (original): ~15
- Valid: 8
- Fixed: 4
- Removed: 0
- Added: 22
- **Total (final)**: 44

---

## Major Issues Found

- POST /invoices يعيد 201 وليس 200
- الصلاحيات تستخدم نقطتين: `invoices:view` / `invoices:create` / `invoices:edit`
- إنشاء فاتورة يتطلب `payment.status=paid` — الدفعات غير المدفوعة تعيد 400 VALIDATION_ERROR
- إذا وُجدت فاتورة للدفعة نفسها → 409 CONFLICT (ليس 400)
- GET /invoices/:id/html يعيد HTML وليس JSON — Content-Type: text/html
- PATCH /invoices/:id/send يعيد 200 (مع @HttpCode) + timestamp sentAt
- صلاحيات ZATCA config/onboard تستخدم `whitelabel:view` و `whitelabel:edit`
- صلاحية sandbox/stats و sandbox/report تستخدم `invoices:view` و `invoices:edit`
- Invoice hash chaining يستخدم Serializable transaction (مهم لمنع race conditions)
- Phase 2: يُضاف job تلقائياً لـ zatca-submit queue عند إنشاء فاتورة
- سيناريوهات 401 و 403 مفقودة كلياً

---

## إنشاء فاتورة

> Endpoint: `POST /invoices` — يتطلب صلاحية `invoices:create` — يعيد 201

| # | الاسم | الوصف | النتيجة المتوقعة |
| --- | --- | --- | --- |
| INV-C1 | إنشاء ناجح | paymentId لدفعة status=paid | 201 + { id, invoiceNumber, qrCodeData, invoiceHash, vatAmount, zatcaStatus } |
| INV-C2 | رقم الفاتورة | التنسيق التلقائي | invoiceNumber يطابق INV-YYYYMMDD-TTSSSS |
| INV-C3 | بدون paymentId | حقل إلزامي | 400 VALIDATION_ERROR |
| INV-C4 | paymentId وهمي | UUID غير موجود | 404 NOT_FOUND |
| INV-C5 | دفعة غير مدفوعة | payment.status=pending أو failed | 400 VALIDATION_ERROR |
| INV-C6 | فاتورة مكررة | فاتورة موجودة لهذه الدفعة | 409 CONFLICT |
| INV-C7 | بدون مصادقة | POST /invoices بدون token | 401 Unauthorized |
| INV-C8 | بدون صلاحية | مستخدم بدون invoices:create | 403 FORBIDDEN |

---

## قراءة الفواتير

> يتطلب صلاحية `invoices:view`

| # | الاسم | الوصف | النتيجة المتوقعة |
| --- | --- | --- | --- |
| INV-L1 | قراءة الكل | GET /invoices | 200 + { items, meta: { total, page, perPage, pages } } |
| INV-L2 | بحث | GET /invoices?search=INV-2026 | 200 + نتائج تطابق رقم الفاتورة أو اسم المريض |
| INV-L3 | فلترة بالتاريخ | GET /invoices?dateFrom=2026-04-01&dateTo=2026-04-30 | 200 + ضمن الفترة |
| INV-L4 | فلترة بحالة ZATCA | GET /invoices?zatcaStatus=pending | 200 + الفواتير بحالة pending فقط |
| INV-L5 | فاتورة بـ ID | GET /invoices/:id | 200 + تفاصيل كاملة |
| INV-L6 | فاتورة بـ paymentId | GET /invoices/payment/:paymentId | 200 + الفاتورة المرتبطة بالدفعة |
| INV-L7 | ID وهمي | GET /invoices/:uuid-غير-موجود | 404 NOT_FOUND |
| INV-L8 | paymentId بدون فاتورة | دفعة لا تملك فاتورة | 404 NOT_FOUND |
| INV-L9 | إحصائيات | GET /invoices/stats | 200 + { total, sent, pending, zatca: { ... } } |
| INV-L10 | بدون مصادقة | GET /invoices بدون token | 401 Unauthorized |
| INV-L11 | بدون صلاحية | مستخدم بدون invoices:view | 403 FORBIDDEN |

---

## HTML الفاتورة وإرسالها

| # | الاسم | الوصف | النتيجة المتوقعة |
| --- | --- | --- | --- |
| INV-H1 | HTML الفاتورة | GET /invoices/:id/html | 200 + HTML كامل (Content-Type: text/html) مع QR Code وبيانات العيادة |
| INV-H2 | ID وهمي | GET /invoices/:uuid-غير-موجود/html | 404 NOT_FOUND |
| INV-S1 | تحديد كمُرسَلة | PATCH /invoices/:id/send | 200 + invoice مع sentAt محدَّث |
| INV-S2 | ID وهمي | PATCH /invoices/:uuid-غير-موجود/send | 404 NOT_FOUND |
| INV-S3 | بدون صلاحية | مستخدم بدون invoices:edit | 403 FORBIDDEN |

---

## إعدادات ZATCA

> الصلاحيات: `whitelabel:view` للقراءة، `whitelabel:edit` للتعديل

| # | الاسم | الوصف | النتيجة المتوقعة |
| --- | --- | --- | --- |
| ZATCA-C1 | قراءة الإعدادات | GET /zatca/config | 200 + { phase, vatRate, vatRegistrationNumber, businessRegistration, sellerName, sellerAddress, city } |
| ZATCA-C2 | حالة التسجيل | GET /zatca/onboarding/status | 200 + { phase, hasCredentials, csidConfigured, privateKeyStored } |
| ZATCA-C3 | تسجيل Phase 2 | POST /zatca/onboard + { otp: "123456" } | 200 + { success: true, message, phase: "phase2" } |
| ZATCA-C4 | otp فارغ | otp بدون قيمة | 400 VALIDATION_ERROR |
| ZATCA-C5 | بيانات ناقصة | sellerName أو VAT مفقود من الإعدادات | 400 VALIDATION_ERROR |
| ZATCA-C6 | بدون صلاحية (قراءة) | مستخدم بدون whitelabel:view | 403 FORBIDDEN |
| ZATCA-C7 | بدون صلاحية (تسجيل) | مستخدم بدون whitelabel:edit | 403 FORBIDDEN |

---

## Sandbox ZATCA (Phase 2)

> يتطلب صلاحية `invoices:view` للإحصائيات، `invoices:edit` للإرسال

| # | الاسم | الوصف | النتيجة المتوقعة |
| --- | --- | --- | --- |
| ZATCA-S1 | إحصائيات Sandbox | GET /zatca/sandbox/stats | 200 + { pending, reported, failed, notApplicable } |
| ZATCA-S2 | إرسال فاتورة للـ Sandbox | POST /zatca/sandbox/report/:invoiceId | 200 + { success, status, reportingStatus, validationResults, message } |
| ZATCA-S3 | فاتورة بدون XML | فاتورة Phase 1 بدون xmlContent | 400 BAD_REQUEST |
| ZATCA-S4 | بدون CSID | zatca_csid غير مُعيَّن | 400 BAD_REQUEST |
| ZATCA-S5 | ID وهمي | invoiceId غير موجود | 404 NOT_FOUND |
| ZATCA-S6 | بدون صلاحية (إرسال) | مستخدم بدون invoices:edit | 403 FORBIDDEN |

---

## ملاحظات تقنية

- **رقم الفاتورة**: تلقائي بتنسيق `INV-YYYYMMDD-TTSSSS` (timestamp + رقم عشوائي)
- **QR Code**: ترميز TLV — يتضمن اسم البائع، رقم الضريبة، تاريخ الفاتورة، المبلغ الإجمالي، مبلغ الضريبة
- **Hash Chaining**: كل فاتورة تخزن hash الفاتورة السابقة — Serializable transaction لمنع race conditions
- **Phase 1**: zatcaStatus="not_applicable" — QR Code فقط
- **Phase 2**: zatcaStatus="pending" تلقائياً + job في zatca-submit queue (3 محاولات، exponential backoff 30s)
- **ضريبة القيمة المضافة**: `vatAmount = Math.round(amount * vatRate / 100)` — المعدل من `vat_rate` في WhiteLabelConfig
