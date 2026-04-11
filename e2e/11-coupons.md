# الكوبونات (Coupons)

---

## Scenario Audit Summary

- Total scenarios (original): ~25
- Valid: 14
- Fixed: 6
- Removed: 0
- Added: 16
- **Total (final)**: 44

---

## Major Issues Found

- الصلاحيات تستخدم نقطة: `coupons.view` / `coupons.create` / `coupons.edit` / `coupons.delete`
- POST /coupons يعيد 201 وليس 200
- الاستجابة مُغلَّفة: `{ success: true, data: ... }`
- كود الكوبون: min 3 max 20 أحرف + regex `[A-Z0-9_-]` + يُحوَّل تلقائياً لحروف كبيرة
- discountValue: min 1 (وليس 0)
- POST /coupons/apply لا تتطلب صلاحية إضافية — أي مستخدم مصادَق عليه
- POST /coupons/apply لا تُسجّل الاستخدام — فقط تحسب الخصم
- حذف الكوبون: hard delete وليس soft delete
- سيناريوهات 401 و 403 مفقودة كلياً
- ترتيب التحقق في apply: انتهاء الصلاحية → حد الاستخدام → حد المستخدم → تقييد الخدمة → الحد الأدنى للمبلغ

---

## إنشاء كوبون

> Endpoint: `POST /coupons` — يتطلب صلاحية `coupons.create` — يعيد 201

| # | الاسم | الوصف | النتيجة المتوقعة |
| --- | --- | --- | --- |
| CPN-C1 | خصم نسبة مئوية | code + discountType=percentage + discountValue=20 | 201 + { id, code (uppercase), discountType, discountValue, usedCount:0 } |
| CPN-C2 | خصم ثابت | discountType=fixed + discountValue=5000 | 201 + الكوبون محفوظ |
| CPN-C3 | مع تاريخ انتهاء | expiresAt=2026-12-31 | 201 + expiresAt محفوظ |
| CPN-C4 | مع حد استخدام | maxUses=100 + maxUsesPerUser=2 | 201 + الحدود محفوظة |
| CPN-C5 | مع خدمات محددة | serviceIds=[uuid1, uuid2] | 201 + مقيَّد بالخدمتين |
| CPN-C6 | كود مكرر | code موجود مسبقاً | 409 CONFLICT |
| CPN-C7 | كود قصير | code="AB" (أقل من 3) | 400 VALIDATION_ERROR |
| CPN-C8 | كود طويل | code أكثر من 20 حرف | 400 VALIDATION_ERROR |
| CPN-C9 | كود بأحرف خاطئة | code="MY CODE!" (مسافة + علامة تعجب) | 400 VALIDATION_ERROR |
| CPN-C10 | discountValue=0 | أقل من min=1 | 400 VALIDATION_ERROR |
| CPN-C11 | بدون discountType | حقل إلزامي | 400 VALIDATION_ERROR |
| CPN-C12 | بدون code | حقل إلزامي | 400 VALIDATION_ERROR |
| CPN-C13 | بدون مصادقة | POST /coupons بدون token | 401 Unauthorized |
| CPN-C14 | بدون صلاحية | مستخدم بدون coupons.create | 403 FORBIDDEN |

---

## قراءة الكوبونات

> يتطلب صلاحية `coupons.view`

| # | الاسم | الوصف | النتيجة المتوقعة |
| --- | --- | --- | --- |
| CPN-L1 | قراءة الكل | GET /coupons | 200 + { success: true, data: { items, meta } } |
| CPN-L2 | فلترة نشطة | GET /coupons?status=active | 200 + isActive=true وغير منتهية وغير مستنفدة |
| CPN-L3 | فلترة غير نشطة | GET /coupons?status=inactive | 200 + isActive=false فقط |
| CPN-L4 | فلترة منتهية | GET /coupons?status=expired | 200 + expiresAt ≤ NOW فقط |
| CPN-L5 | بحث بالكود | GET /coupons?search=SUMMER | 200 + كوبونات تحتوي SUMMER في الكود |
| CPN-L6 | كوبون بـ ID | GET /coupons/:id | 200 + تفاصيل كاملة مع serviceIds |
| CPN-L7 | ID وهمي | GET /coupons/:uuid-غير-موجود | 404 NOT_FOUND |
| CPN-L8 | بدون صلاحية | مستخدم بدون coupons.view | 403 FORBIDDEN |

---

## تعديل كوبون

> Endpoint: `PATCH /coupons/:id` — يتطلب صلاحية `coupons.edit`

| # | الاسم | الوصف | النتيجة المتوقعة |
| --- | --- | --- | --- |
| CPN-U1 | تعديل القيمة | discountValue=30 | 200 + discountValue محدَّث |
| CPN-U2 | تعطيل | isActive=false | 200 + isActive=false |
| CPN-U3 | تمديد الصلاحية | expiresAt جديد | 200 + expiresAt محدَّث |
| CPN-U4 | تحديث الخدمات | serviceIds=[uuid3] | 200 + الخدمات القديمة تُحذف والجديدة تُضاف |
| CPN-U5 | ID وهمي | UUID غير موجود | 404 NOT_FOUND |
| CPN-U6 | بدون صلاحية | مستخدم بدون coupons.edit | 403 FORBIDDEN |

---

## حذف كوبون

> Endpoint: `DELETE /coupons/:id` — يتطلب صلاحية `coupons.delete` — حذف دائم (hard delete)

| # | الاسم | الوصف | النتيجة المتوقعة |
| --- | --- | --- | --- |
| CPN-D1 | حذف ناجح | DELETE /coupons/:id | 200 + { success: true, data: { deleted: true } } |
| CPN-D2 | ID وهمي | UUID غير موجود | 404 NOT_FOUND |
| CPN-D3 | بدون صلاحية | مستخدم بدون coupons.delete | 403 FORBIDDEN |

---

## تطبيق كوبون

> Endpoint: `POST /coupons/apply` — أي مستخدم مصادَق عليه (بدون صلاحية إضافية)
> لا تُسجّل الاستخدام — فقط تحسب الخصم وتُعيد discountAmount + couponId

| # | الاسم | الوصف | النتيجة المتوقعة |
| --- | --- | --- | --- |
| CPN-A1 | كوبون نسبة مئوية صالح | code + amount=10000 + discountValue=20% | 200 + { success: true, data: { discountAmount:2000, couponId } } |
| CPN-A2 | كوبون ثابت صالح | discountType=fixed + discountValue=5000 + amount=10000 | 200 + { discountAmount:5000 } |
| CPN-A3 | ثابت يتجاوز المبلغ | discountValue=15000 + amount=10000 | 200 + { discountAmount:10000 } (محدود بالمبلغ) |
| CPN-A4 | كود غير موجود | code="INVALID" | 404 COUPON_NOT_FOUND |
| CPN-A5 | كوبون معطَّل | isActive=false | 404 COUPON_NOT_FOUND |
| CPN-A6 | كوبون منتهي | expiresAt < NOW | 400 COUPON_EXPIRED |
| CPN-A7 | حد الاستخدام الكلي | usedCount >= maxUses | 400 COUPON_LIMIT_REACHED |
| CPN-A8 | حد استخدام المستخدم | المستخدم استنفد maxUsesPerUser | 400 COUPON_USER_LIMIT_REACHED |
| CPN-A9 | خدمة غير مُصرَّح بها | serviceId غير موجود في couponServices | 400 COUPON_SERVICE_MISMATCH |
| CPN-A10 | أقل من الحد الأدنى | amount < minAmount | 400 COUPON_MIN_AMOUNT |
| CPN-A11 | بدون مصادقة | POST /coupons/apply بدون token | 401 Unauthorized |
