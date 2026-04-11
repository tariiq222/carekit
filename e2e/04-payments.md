# المدفوعات (Payments)

---

## Scenario Audit Summary

- Total scenarios (original): 26
- Valid: 16
- Fixed: 7
- Removed: 1
- Added: 22
- **Total (final)**: 47

---

## Major Issues Found

- PAY-M1/M2: status code خاطئ — الـ endpoint يعيد 200 (ليس 201) لأنه @Post بدون @HttpCode(201)
- PAY-M6: error code خاطئ — الصحيح `DUPLICATE_PAYMENT` وليس `CONFLICT`
- PAY-BT9/BT10: المسار خاطئ — الصحيح `POST /payments/bank-transfer/:id/verify` بـ body `{ action: 'approve'|'reject' }`
- PAY-RF4: error code مبهم — الصحيح `INVALID_PAYMENT_STATUS` و `BOOKING_NOT_CANCELLED`
- PAY-RF1/RF2: الـ `reason` حقل إلزامي — مفقود من الوثيقة الأصلية
- PAY-ST1: يجب تحديد الانتقالات الصالحة (state machine صارم)
- PAY-M7: Rate limit 5 طلبات/60 ثانية (وليس دقيقة كاملة — فارق تقني)
- سيناريوهات 401 و 403 مفقودة كلياً
- سيناريوهات دفع Moyasar مكرر مع إعادة محاولة (retry on failed) مفقودة

---

## دفع Moyasar

> Endpoint: `POST /payments/moyasar` — أي مستخدم مصادَق عليه — Rate limit: 5 req/60s

| # | الاسم | الوصف | النتيجة المتوقعة |
| --- | --- | --- | --- |
| PAY-M1 | دفع ببطاقة ائتمان | bookingId + source.type=creditcard + بيانات البطاقة | 200 + { payment, redirectUrl } |
| PAY-M2 | دفع Mada | source.type=mada | 200 + { payment, redirectUrl } |
| PAY-M3 | دفع بـ token محفوظ | source.type=creditcard + source.token | 200 + { payment, redirectUrl } |
| PAY-M4 | بدون bookingId | حقل إلزامي مفقود | 400 VALIDATION_ERROR |
| PAY-M5 | bookingId وهمي | UUID غير موجود | 404 NOT_FOUND |
| PAY-M6 | حجز مدفوع مسبقاً | payment.status=paid موجود للحجز | 400 DUPLICATE_PAYMENT |
| PAY-M7 | إعادة محاولة بعد فشل | payment.status=failed موجود → يُحذف ويُنشأ جديد | 200 + payment جديد |
| PAY-M8 | بدون source | حقل إلزامي مفقود | 400 VALIDATION_ERROR |
| PAY-M9 | خطأ من Moyasar API | Moyasar يعيد error | 400 MOYASAR_ERROR |
| PAY-M10 | Rate limit | أكثر من 5 طلبات/60 ثانية | 429 TOO_MANY_REQUESTS |
| PAY-M11 | بدون مصادقة | POST /payments/moyasar بدون token | 401 Unauthorized |

---

## Moyasar Webhook

> Endpoint: `POST /payments/moyasar/webhook` — **عام بدون JWT** — التحقق عبر `x-moyasar-signature`

| # | الاسم | الوصف | النتيجة المتوقعة |
| --- | --- | --- | --- |
| PAY-WH1 | webhook paid — نجاح | status=paid + amount يطابق totalAmount | 200 + { success: true } + payment.status=paid + booking.status=confirmed |
| PAY-WH2 | webhook failed | status=failed | 200 + { success: true } + payment.status=failed |
| PAY-WH3 | webhook مكرر (idempotent) | نفس event_id مرتين | 200 + { success: true } (لا يُعالَج مرتين) |
| PAY-WH4 | توقيع خاطئ | x-moyasar-signature غير صالح | 401 INVALID_SIGNATURE |
| PAY-WH5 | بدون توقيع | header مفقود | 401 INVALID_SIGNATURE |
| PAY-WH6 | مبلغ لا يطابق | amount في الـ webhook ≠ payment.totalAmount | 200 + { success: true } + payment.status=failed (يُسجَّل كـ warning) |

---

## تحويل بنكي (Bank Transfer)

> Upload: `POST /payments/bank-transfer` — أي مستخدم مصادَق — Rate limit: 5 req/60s
> Verify: `POST /payments/bank-transfer/:receiptId/verify` — يتطلب صلاحية `payments:edit`

| # | الاسم | الوصف | النتيجة المتوقعة |
| --- | --- | --- | --- |
| PAY-BT1 | رفع إيصال JPEG | multipart: receipt (JPEG) + bookingId | 200 + { payment, receipt } + receipt.aiVerificationStatus=pending |
| PAY-BT2 | رفع إيصال PNG | ملف PNG | 200 + محفوظ في MinIO |
| PAY-BT3 | رفع إيصال PDF | ملف PDF | 200 + محفوظ في MinIO |
| PAY-BT4 | رفع إيصال WebP | image/webp | 200 + محفوظ في MinIO |
| PAY-BT5 | نوع ملف غير مسموح | ملف .exe أو .zip | 400 INVALID_FILE_TYPE |
| PAY-BT6 | ملف كبير | أكبر من 10 MB | 400 FILE_TOO_LARGE |
| PAY-BT7 | بدون ملف | multipart بدون حقل receipt | 400 MISSING_FILE |
| PAY-BT8 | bookingId وهمي | UUID غير موجود | 404 NOT_FOUND |
| PAY-BT9 | دفعة مدفوعة مسبقاً | payment.status=paid موجود | 400 DUPLICATE_PAYMENT |
| PAY-BT10 | إعادة رفع بعد رفض | payment.status=failed أو awaiting → يُستبدَل | 200 + payment جديد |
| PAY-BT11 | قبول الإيصال (admin) | POST /payments/bank-transfer/:receiptId/verify + action=approve | 200 + payment.status=paid + booking.status=confirmed |
| PAY-BT12 | رفض الإيصال (admin) | POST /payments/bank-transfer/:receiptId/verify + action=reject | 200 + payment.status=rejected + booking.status=cancelled |
| PAY-BT13 | adminNotes تتجاوز 2000 | adminNotes=2001 حرف في verify | 400 VALIDATION_ERROR |
| PAY-BT14 | receiptId وهمي في verify | UUID غير موجود | 404 NOT_FOUND |
| PAY-BT15 | Rate limit | أكثر من 5 طلبات/60 ثانية على upload | 429 TOO_MANY_REQUESTS |
| PAY-BT16 | بدون مصادقة | POST /payments/bank-transfer بدون token | 401 Unauthorized |

---

## الاسترداد (Refund)

> Endpoint: `POST /payments/:id/refund` — يتطلب صلاحية `payments:edit`

| # | الاسم | الوصف | النتيجة المتوقعة |
| --- | --- | --- | --- |
| PAY-RF1 | استرداد كامل | POST /payments/:id/refund + reason (بدون amount) | 200 + payment.status=refunded + refundAmount=totalAmount |
| PAY-RF2 | استرداد جزئي | amount=5000 (هللة) + reason | 200 + payment.refundAmount=5000 |
| PAY-RF3 | بدون reason | reason حقل إلزامي | 400 VALIDATION_ERROR |
| PAY-RF4 | دفعة غير موجودة | ID وهمي | 404 NOT_FOUND |
| PAY-RF5 | دفعة ليست paid | payment.status=pending أو failed | 400 INVALID_PAYMENT_STATUS |
| PAY-RF6 | الحجز غير ملغى | booking.status=confirmed (ليس cancelled/no_show) | 400 BOOKING_NOT_CANCELLED |
| PAY-RF7 | استرداد متزامن | طلبان في نفس الوقت | 400 ALREADY_REFUNDED (الثاني يفشل) |
| PAY-RF8 | reason يتجاوز 1000 حرف | 1001 حرف | 400 VALIDATION_ERROR |
| PAY-RF9 | بدون صلاحية payments:edit | مستخدم بدون الصلاحية | 403 FORBIDDEN |

---

## قراءة المدفوعات

| # | الاسم | الوصف | النتيجة المتوقعة |
| --- | --- | --- | --- |
| PAY-L1 | دفعاتي (مريض) | GET /payments/my | 200 + دفعات المستخدم الحالي فقط (scoped) |
| PAY-L2 | كل الدفعات (admin) | GET /payments (بصلاحية payments:view) | 200 + { items, meta: { total, page, perPage, pages } } |
| PAY-L3 | دفعة بـ bookingId | GET /payments/booking/:bookingId | 200 + تفاصيل الدفعة مع الإيصال والفاتورة |
| PAY-L4 | دفعة بـ ID | GET /payments/:id | 200 + تفاصيل كاملة |
| PAY-L5 | ID وهمي | GET /payments/:uuid-غير-موجود | 404 NOT_FOUND |
| PAY-L6 | إحصائيات | GET /payments/stats | 200 + { total, paid, pending, failed, refunded, totalRevenue } |
| PAY-L7 | فلترة بالحالة | GET /payments?status=paid | 200 + paid فقط |
| PAY-L8 | فلترة بنطاق تاريخ | GET /payments?dateFrom=2026-04-01&dateTo=2026-04-30 | 200 + ضمن الفترة |
| PAY-L9 | فلترة بطريقة الدفع | GET /payments?method=bank_transfer | 200 + bank_transfer فقط |
| PAY-L10 | perPage خارج النطاق | GET /payments?perPage=101 (أكبر من 100) | 400 VALIDATION_ERROR |
| PAY-L11 | بدون مصادقة | GET /payments بدون token | 401 Unauthorized |

---

## تحديث حالة الدفعة (Admin)

> Endpoint: `PATCH /payments/:id/status` — يتطلب صلاحية `payments:edit`

| # | الاسم | الوصف | النتيجة المتوقعة |
| --- | --- | --- | --- |
| PAY-ST1 | pending → paid | status=paid على دفعة pending | 200 + payment.status=paid + booking.status=confirmed |
| PAY-ST2 | awaiting → paid | status=paid على دفعة awaiting | 200 + payment.status=paid |
| PAY-ST3 | failed → pending | status=pending على دفعة failed | 200 + payment.status=pending |
| PAY-ST4 | paid → refunded | status=refunded على دفعة paid | 200 + payment.status=refunded |
| PAY-ST5 | انتقال غير مسموح | status=paid على دفعة refunded | 400 INVALID_STATUS_TRANSITION |
| PAY-ST6 | انتقال غير مسموح | status=pending على دفعة rejected | 400 INVALID_STATUS_TRANSITION |
| PAY-ST7 | ID وهمي | UUID غير موجود | 404 NOT_FOUND |
| PAY-ST8 | بدون صلاحية | مستخدم بدون payments:edit | 403 FORBIDDEN |

---

## ملاحظات تقنية

- **الأسعار**: تُحفَظ بالهللة (halalat) — `amount: 10000` = 100 ريال سعودي
- **ضريبة القيمة المضافة**: 15% تُحتسَب تلقائياً على كل مدفوعة (`vatAmount = round(amount × 0.15)`)
- **Rate limiting**: Moyasar و bank-transfer: 5 طلبات/60 ثانية لكل مستخدم
- **Webhook**: endpoint عام بدون JWT — التحقق عبر HMAC-SHA256 في header `x-moyasar-signature`
- **Idempotency**: يُستخدَم جدول `ProcessedWebhook` مع `eventId` فريد لمنع معالجة webhook مرتين
- **الإيصالات**: تُرفَع إلى MinIO bucket `carekit` تحت مسار `receipts/{uuid}.{ext}`
