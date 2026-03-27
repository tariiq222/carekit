# بطاقات الهدايا (Gift Cards)

---

## Scenario Audit Summary

- Total scenarios (original): ~20
- Valid: 12
- Fixed: 5
- Removed: 0
- Added: 14
- **Total (final)**: 40

---

## Major Issues Found

- الصلاحيات تستخدم نقطة: `gift-cards.view` / `gift-cards.create` / `gift-cards.edit` / `gift-cards.delete`
- POST /gift-cards يعيد 201 وليس 200
- الاستجابة مُغلَّفة: `{ success: true, data: ... }`
- DELETE /gift-cards/:id يُعطِّل البطاقة (soft delete — isActive=false) ويعيد `{ deactivated: true }` وليس `{ deleted: true }`
- POST /gift-cards/check-balance عام بدون مصادقة — يعيد دائماً 200 (لا 404) مع `{ balance, isValid }`
- POST /gift-cards/:id/credit يعيد 200 وليس 201
- الكود المخصص: regex `[A-Z0-9-]` (وليس underscore) + min 3 max 20
- كود الخطأ للكود المكرر: 400 CODE_EXISTS (وليس 409 CONFLICT)
- param في list: `limit` وليس `perPage`
- إضافة رصيد يعيد البطاقة المحدَّثة (وليس `{ credited: true }`)
- سيناريوهات 401 و 403 مفقودة كلياً

---

## إنشاء بطاقة هدية

> Endpoint: `POST /gift-cards` — يتطلب صلاحية `gift-cards.create` — يعيد 201

| # | الاسم | الوصف | النتيجة المتوقعة |
| --- | --- | --- | --- |
| GC-C1 | إنشاء أساسي | initialAmount=10000 | 201 + { id, code (GC-XXXXXXXX), initialAmount:10000, balance:10000, isActive:true } |
| GC-C2 | كود مخصص | code="GIFT-2026" | 201 + code="GIFT-2026" |
| GC-C3 | مع تاريخ انتهاء | expiresAt=2026-12-31 | 201 + expiresAt محفوظ |
| GC-C4 | initialAmount=0 | أقل من min=1 | 400 VALIDATION_ERROR |
| GC-C5 | كود مكرر | code="GIFT-2026" موجود مسبقاً | 400 CODE_EXISTS |
| GC-C6 | كود قصير | code="AB" (أقل من 3) | 400 VALIDATION_ERROR |
| GC-C7 | كود بأحرف خاطئة | code="MY_CODE" (underscore غير مسموح) | 400 VALIDATION_ERROR |
| GC-C8 | بدون initialAmount | حقل إلزامي | 400 VALIDATION_ERROR |
| GC-C9 | بدون مصادقة | POST /gift-cards بدون token | 401 Unauthorized |
| GC-C10 | بدون صلاحية | مستخدم بدون gift-cards.create | 403 FORBIDDEN |

---

## قراءة بطاقات الهدايا

> يتطلب صلاحية `gift-cards.view`

| # | الاسم | الوصف | النتيجة المتوقعة |
| --- | --- | --- | --- |
| GC-L1 | قراءة الكل | GET /gift-cards | 200 + { success: true, data: { items, meta } } مرتبة بـ createdAt DESC |
| GC-L2 | فلترة نشطة | GET /gift-cards?status=active | 200 + isActive=true وبها رصيد وغير منتهية |
| GC-L3 | فلترة منتهية | GET /gift-cards?status=expired | 200 + expiresAt ≤ NOW |
| GC-L4 | فلترة مستنفدة | GET /gift-cards?status=depleted | 200 + balance=0 و isActive=true |
| GC-L5 | فلترة غير نشطة | GET /gift-cards?status=inactive | 200 + isActive=false |
| GC-L6 | pagination | GET /gift-cards?page=1&limit=10 | 200 + الصفحة الأولى (param: limit وليس perPage) |
| GC-L7 | بطاقة بـ ID | GET /gift-cards/:id | 200 + تفاصيل + آخر 10 معاملات |
| GC-L8 | ID وهمي | GET /gift-cards/:uuid-غير-موجود | 404 NOT_FOUND |
| GC-L9 | بدون صلاحية | مستخدم بدون gift-cards.view | 403 FORBIDDEN |

---

## تعديل بطاقة هدية

> Endpoint: `PATCH /gift-cards/:id` — يتطلب صلاحية `gift-cards.edit`
> لا يُعدِّل code أو balance أو initialAmount

| # | الاسم | الوصف | النتيجة المتوقعة |
| --- | --- | --- | --- |
| GC-U1 | تعطيل | isActive=false | 200 + isActive=false |
| GC-U2 | تمديد الصلاحية | expiresAt جديد | 200 + expiresAt محدَّث |
| GC-U3 | تسجيل المشتري | purchasedBy="اسم المشتري" | 200 + purchasedBy محفوظ |
| GC-U4 | ID وهمي | UUID غير موجود | 404 NOT_FOUND |
| GC-U5 | بدون صلاحية | مستخدم بدون gift-cards.edit | 403 FORBIDDEN |

---

## تعطيل بطاقة هدية (Soft Delete)

> Endpoint: `DELETE /gift-cards/:id` — يتطلب صلاحية `gift-cards.delete`
> يُعطِّل البطاقة (isActive=false) — لا يحذفها

| # | الاسم | الوصف | النتيجة المتوقعة |
| --- | --- | --- | --- |
| GC-D1 | تعطيل ناجح | DELETE /gift-cards/:id | 200 + { success: true, data: { deactivated: true } } |
| GC-D2 | ID وهمي | UUID غير موجود | 404 NOT_FOUND |
| GC-D3 | بدون صلاحية | مستخدم بدون gift-cards.delete | 403 FORBIDDEN |

---

## إضافة رصيد

> Endpoint: `POST /gift-cards/:id/credit` — يتطلب صلاحية `gift-cards.edit`

| # | الاسم | الوصف | النتيجة المتوقعة |
| --- | --- | --- | --- |
| GC-CR1 | إضافة رصيد | amount=5000 | 200 + بطاقة محدَّثة مع balance جديد + سجل معاملة |
| GC-CR2 | مع ملاحظة | amount=5000 + note="تعويض عميل" | 200 + balance محدَّث + note محفوظ في المعاملة |
| GC-CR3 | بدون ملاحظة | amount=5000 فقط | 200 + تُضاف note="Manual credit" تلقائياً |
| GC-CR4 | amount=0 | أقل من min=1 | 400 VALIDATION_ERROR |
| GC-CR5 | ID وهمي | UUID غير موجود | 404 NOT_FOUND |
| GC-CR6 | بدون صلاحية | مستخدم بدون gift-cards.edit | 403 FORBIDDEN |

---

## التحقق من الرصيد

> Endpoint: `POST /gift-cards/check-balance` — عام بدون مصادقة
> يعيد دائماً 200 — لا يُعيد 404

| # | الاسم | الوصف | النتيجة المتوقعة |
| --- | --- | --- | --- |
| GC-CB1 | بطاقة نشطة | code لبطاقة نشطة بها رصيد | 200 + { success: true, data: { balance, isValid: true } } |
| GC-CB2 | بطاقة منتهية | expiresAt < NOW | 200 + { balance: 0, isValid: false } |
| GC-CB3 | بطاقة معطَّلة | isActive=false | 200 + { balance: 0, isValid: false } |
| GC-CB4 | كود غير موجود | code غير مسجَّل | 200 + { balance: 0, isValid: false } |
| GC-CB5 | بدون كود | حقل إلزامي | 400 VALIDATION_ERROR |
