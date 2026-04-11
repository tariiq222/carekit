# الفروع (Branches)

---

## Scenario Audit Summary

- Total scenarios (original): ~15
- Valid: 8
- Fixed: 4
- Removed: 0
- Added: 18
- **Total (final)**: 38

---

## Major Issues Found

- الاستجابة مُغلَّفة: `{ success: true, data: ... }` (وليس البيانات مباشرة)
- POST /branches يعيد 201 وليس 200
- الصلاحيات تستخدم نقطتين: `branches:view` / `branches:create` / `branches:edit` / `branches:delete`
- GET /branches يُعيد الفروع النشطة فقط (يستثني soft-deleted) مرتبة: isMain أولاً ثم createdAt
- PATCH /branches/:id/employees يُضيف/يحدّث (upsert) ولا يستبدل الكل
- DELETE /branches/:id/employees/:employeeId يعيد `{ removed: true }` (داخل data wrapper)
- سيناريوهات 401 و 403 مفقودة كلياً
- PATCH /branches/:id/employees يقبل `employeeIds` (مصفوفة)
- خطأ تعيين طبيب غير موجود: 400 EMPLOYEE_NOT_FOUND (وليس 404)

---

## قراءة الفروع

> يتطلب صلاحية `branches:view`

| # | الاسم | الوصف | النتيجة المتوقعة |
| --- | --- | --- | --- |
| BR-L1 | قراءة الكل | GET /branches | 200 + { success: true, data: { items, meta } } — الرئيسي أولاً |
| BR-L2 | بحث بالاسم | GET /branches?search=الرياض | 200 + فروع تطابق nameEn أو nameAr أو address |
| BR-L3 | فلترة النشطة | GET /branches?isActive=false | 200 + فروع غير نشطة |
| BR-L4 | pagination | GET /branches?page=2&perPage=10 | 200 + الصفحة الثانية |
| BR-L5 | فرع بـ ID | GET /branches/:id | 200 + { success: true, data: { ... } } |
| BR-L6 | ID وهمي | GET /branches/:uuid-غير-موجود | 404 NOT_FOUND |
| BR-L7 | بدون مصادقة | GET /branches بدون token | 401 Unauthorized |
| BR-L8 | بدون صلاحية | مستخدم بدون branches:view | 403 FORBIDDEN |

---

## إنشاء فرع

> Endpoint: `POST /branches` — يتطلب صلاحية `branches:create` — يعيد 201

| # | الاسم | الوصف | النتيجة المتوقعة |
| --- | --- | --- | --- |
| BR-C1 | إنشاء أساسي | nameAr + nameEn | 201 + { success: true, data: { id, nameAr, nameEn, isMain:false, isActive:true, timezone:"Asia/Riyadh" } } |
| BR-C2 | مع جميع الحقول | nameAr + nameEn + address + phone + email + isMain=true + timezone | 201 + كل الحقول محفوظة |
| BR-C3 | بريد غير صالح | email="not-email" | 400 VALIDATION_ERROR |
| BR-C4 | nameAr يتجاوز 255 | 256 حرف | 400 VALIDATION_ERROR |
| BR-C5 | address يتجاوز 500 | 501 حرف | 400 VALIDATION_ERROR |
| BR-C6 | بدون nameAr | حقل إلزامي | 400 VALIDATION_ERROR |
| BR-C7 | بدون nameEn | حقل إلزامي | 400 VALIDATION_ERROR |
| BR-C8 | بدون مصادقة | POST /branches بدون token | 401 Unauthorized |
| BR-C9 | بدون صلاحية | مستخدم بدون branches:create | 403 FORBIDDEN |

---

## تعديل فرع

> Endpoint: `PATCH /branches/:id` — يتطلب صلاحية `branches:edit`

| # | الاسم | الوصف | النتيجة المتوقعة |
| --- | --- | --- | --- |
| BR-U1 | تعديل الاسم | nameAr جديد | 200 + { success: true, data: { nameAr محدَّث } } |
| BR-U2 | تعيين كرئيسي | isMain=true | 200 + isMain=true |
| BR-U3 | تعطيل | isActive=false | 200 + isActive=false |
| BR-U4 | ID وهمي | UUID غير موجود | 404 NOT_FOUND |
| BR-U5 | بدون صلاحية | مستخدم بدون branches:edit | 403 FORBIDDEN |

---

## حذف فرع (Soft Delete)

> Endpoint: `DELETE /branches/:id` — يتطلب صلاحية `branches:delete`

| # | الاسم | الوصف | النتيجة المتوقعة |
| --- | --- | --- | --- |
| BR-D1 | حذف ناجح | DELETE /branches/:id | 200 + { success: true, data: { deleted: true } } + يختفي من GET /branches |
| BR-D2 | ID وهمي | UUID غير موجود | 404 NOT_FOUND |
| BR-D3 | بدون صلاحية | مستخدم بدون branches:delete | 403 FORBIDDEN |

---

## إدارة الأطباء في الفرع

> يتطلب صلاحية `branches:view` للقراءة، `branches:edit` للتعديل

| # | الاسم | الوصف | النتيجة المتوقعة |
| --- | --- | --- | --- |
| BR-PR1 | قراءة أطباء الفرع | GET /branches/:id/employees | 200 + { success: true, data: [...] } — isPrimary أولاً |
| BR-PR2 | تعيين طبيب | PATCH /branches/:id/employees + { employeeIds: ["uuid"] } | 200 + قائمة الأطباء المحدَّثة |
| BR-PR3 | تعيين متعدد | employeeIds=[uuid1, uuid2] | 200 + الطبيبان مُضافان (upsert) |
| BR-PR4 | طبيب غير موجود | employeeIds=[uuid-وهمي] | 400 EMPLOYEE_NOT_FOUND |
| BR-PR5 | مصفوفة فارغة | employeeIds=[] | 400 VALIDATION_ERROR (ArrayMinSize=1) |
| BR-PR6 | فرع وهمي | branchId غير موجود | 404 NOT_FOUND |
| BR-PR7 | إزالة طبيب | DELETE /branches/:id/employees/:employeeId | 200 + { success: true, data: { removed: true } } |
| BR-PR8 | إزالة طبيب غير مُعيَّن | employeeId غير مرتبط بهذا الفرع | 404 NOT_FOUND |
| BR-PR9 | بدون صلاحية (قراءة) | مستخدم بدون branches:view | 403 FORBIDDEN |
| BR-PR10 | بدون صلاحية (تعيين) | مستخدم بدون branches:edit | 403 FORBIDDEN |
