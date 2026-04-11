# الفئات (Categories)

---

## Scenario Audit Summary

- Total scenarios (original): ~10
- Valid: 6
- Fixed: 3
- Removed: 0
- Added: 8
- **Total (final)**: 17

---

## Major Issues Found

- الصلاحيات تستخدم نقطة: `services.create` / `services.edit` / `services.delete` (وليس نقطتين `:`)
- GET /services/categories عام بدون مصادقة (@Public) — يُعيد فقط isActive=true مرتبة بـ sortOrder
- POST /services/categories يعيد 201 وليس 200
- DELETE /services/categories/:id يفشل بـ 409 CONFLICT إذا كانت هناك خدمات مرتبطة بالفئة (حتى المحذوفة soft-deleted)
- PATCH /services/categories/:id يعيد 404 NOT_FOUND (وليس CATEGORY_NOT_FOUND) إذا لم تُوجَد الفئة
- سيناريوهات 401 و 403 مفقودة كلياً

---

## قراءة الفئات

> Endpoint: `GET /services/categories` — عام بدون مصادقة (@Public)
> يُعيد فقط الفئات النشطة (isActive=true) مرتبة بـ sortOrder تصاعدياً

| # | الاسم | الوصف | النتيجة المتوقعة |
| --- | --- | --- | --- |
| CAT-L1 | قراءة الكل | GET /services/categories بدون token | 200 + مصفوفة الفئات النشطة مرتبة بـ sortOrder |
| CAT-L2 | فئة معطّلة | فئة isActive=false لا تظهر | 200 + الفئة المعطّلة غير موجودة في النتائج |

---

## إنشاء فئة

> Endpoint: `POST /services/categories` — يتطلب صلاحية `services.create` — يعيد 201

| # | الاسم | الوصف | النتيجة المتوقعة |
| --- | --- | --- | --- |
| CAT-C1 | إنشاء أساسي | nameEn + nameAr | 201 + { id, nameEn, nameAr, sortOrder:0, isActive:true } |
| CAT-C2 | مع sortOrder | nameEn + nameAr + sortOrder=5 | 201 + sortOrder=5 |
| CAT-C3 | بدون nameEn | حقل إلزامي | 400 VALIDATION_ERROR |
| CAT-C4 | بدون nameAr | حقل إلزامي | 400 VALIDATION_ERROR |
| CAT-C5 | nameEn يتجاوز 255 | 256 حرف | 400 VALIDATION_ERROR |
| CAT-C6 | بدون مصادقة | POST /services/categories بدون token | 401 Unauthorized |
| CAT-C7 | بدون صلاحية | مستخدم بدون services.create | 403 FORBIDDEN |

---

## تعديل فئة

> Endpoint: `PATCH /services/categories/:id` — يتطلب صلاحية `services.edit`

| # | الاسم | الوصف | النتيجة المتوقعة |
| --- | --- | --- | --- |
| CAT-U1 | تعديل الاسم | nameAr جديد | 200 + nameAr محدَّث |
| CAT-U2 | تعطيل | isActive=false | 200 + isActive=false |
| CAT-U3 | ID وهمي | UUID غير موجود | 404 NOT_FOUND |
| CAT-U4 | بدون صلاحية | مستخدم بدون services.edit | 403 FORBIDDEN |

---

## حذف فئة

> Endpoint: `DELETE /services/categories/:id` — يتطلب صلاحية `services.delete`

| # | الاسم | الوصف | النتيجة المتوقعة |
| --- | --- | --- | --- |
| CAT-D1 | حذف ناجح | فئة بدون خدمات | 200 + { deleted: true } |
| CAT-D2 | فئة بها خدمات | خدمات مرتبطة (حتى soft-deleted) | 409 CONFLICT |
| CAT-D3 | ID وهمي | UUID غير موجود | 404 NOT_FOUND |
| CAT-D4 | بدون صلاحية | مستخدم بدون services.delete | 403 FORBIDDEN |
