# نماذج الاستقبال (Intake Forms)

---

## Scenario Audit Summary

- Total scenarios (original): ~20
- Valid: 11
- Fixed: 5
- Removed: 2
- Added: 18
- **Total (final)**: 42

---

## Major Issues Found

- الصلاحيات تستخدم نقطتين: `intake_forms:view` / `intake_forms:create` / `intake_forms:edit` / `intake_forms:delete`
- POST /intake-forms يعيد 201 وليس 200
- DELETE /intake-forms/:formId: hard delete (وليس soft delete)
- PUT /intake-forms/:formId/fields يستبدل الكل في transaction (delete + create)
- POST /intake-forms/:formId/responses لا تتطلب صلاحية — أي مستخدم مصادَق
- GET /intake-forms/responses/:bookingId يتطلب `bookings:view` (وليس intake_forms:view)
- عدم وجود bookingId في الـ response: 201 يُنشأ بدون التحقق من وجود الـ booking
- GET /intake-forms/responses/:bookingId لبوكينج بدون ردود: 200 + [] (وليس 404)
- scope=service يتطلب serviceId — يتحقق من وجود الخدمة (404 إذا لم تُوجَد)
- fieldType options مطلوبة فقط لـ radio/select
- سيناريوهات 401 و 403 مفقودة كلياً

---

## إنشاء نموذج

> Endpoint: `POST /intake-forms` — يتطلب صلاحية `intake_forms:create` — يعيد 201

| # | الاسم | الوصف | النتيجة المتوقعة |
| --- | --- | --- | --- |
| IF-C1 | نموذج global | nameAr + nameEn + type=pre_booking + scope=global | 201 + { id, fields:[], submissionsCount:0, isActive:true } |
| IF-C2 | نموذج service | scope=service + serviceId | 201 + serviceId محفوظ |
| IF-C3 | نموذج employee | scope=employee + employeeId | 201 + employeeId محفوظ |
| IF-C4 | نموذج branch | scope=branch + branchId | 201 + branchId محفوظ |
| IF-C5 | scope=service بدون serviceId | serviceId مطلوب | 422 VALIDATION_ERROR |
| IF-C6 | serviceId وهمي | UUID غير موجود | 404 NOT_FOUND |
| IF-C7 | بدون nameAr | حقل إلزامي | 400 VALIDATION_ERROR |
| IF-C8 | type خاطئ | type="unknown" | 400 VALIDATION_ERROR |
| IF-C9 | scope خاطئ | scope="clinic" | 400 VALIDATION_ERROR |
| IF-C10 | بدون مصادقة | POST /intake-forms بدون token | 401 Unauthorized |
| IF-C11 | بدون صلاحية | مستخدم بدون intake_forms:create | 403 FORBIDDEN |

---

## قراءة النماذج

> يتطلب صلاحية `intake_forms:view`

| # | الاسم | الوصف | النتيجة المتوقعة |
| --- | --- | --- | --- |
| IF-L1 | قراءة الكل | GET /intake-forms | 200 + { items: [...] } — مرتبة بـ createdAt DESC |
| IF-L2 | فلترة بالنطاق | GET /intake-forms?scope=global | 200 + global فقط |
| IF-L3 | فلترة بالنوع | GET /intake-forms?type=pre_booking | 200 + pre_booking فقط |
| IF-L4 | فلترة بالخدمة | GET /intake-forms?serviceId=:uuid | 200 + نماذج الخدمة |
| IF-L5 | نموذج بـ ID | GET /intake-forms/:formId | 200 + تفاصيل + fields مرتبة بـ sortOrder |
| IF-L6 | ID وهمي | GET /intake-forms/:uuid-غير-موجود | 404 NOT_FOUND |
| IF-L7 | بدون صلاحية | مستخدم بدون intake_forms:view | 403 FORBIDDEN |

---

## تعديل نموذج

> Endpoint: `PATCH /intake-forms/:formId` — يتطلب صلاحية `intake_forms:edit`
> يمكن تعديل: nameAr، nameEn، isActive فقط (لا يمكن تغيير type أو scope)

| # | الاسم | الوصف | النتيجة المتوقعة |
| --- | --- | --- | --- |
| IF-U1 | تعديل الاسم | nameAr جديد | 200 + nameAr محدَّث |
| IF-U2 | تعطيل | isActive=false | 200 + isActive=false |
| IF-U3 | ID وهمي | UUID غير موجود | 404 NOT_FOUND |
| IF-U4 | بدون صلاحية | مستخدم بدون intake_forms:edit | 403 FORBIDDEN |

---

## حذف نموذج

> Endpoint: `DELETE /intake-forms/:formId` — يتطلب صلاحية `intake_forms:delete` — حذف دائم

| # | الاسم | الوصف | النتيجة المتوقعة |
| --- | --- | --- | --- |
| IF-D1 | حذف ناجح | DELETE /intake-forms/:formId | 200 + { deleted: true } |
| IF-D2 | ID وهمي | UUID غير موجود | 404 NOT_FOUND |
| IF-D3 | بدون صلاحية | مستخدم بدون intake_forms:delete | 403 FORBIDDEN |

---

## إدارة الحقول

> Endpoint: `PUT /intake-forms/:formId/fields` — يتطلب صلاحية `intake_forms:edit`
> يستبدل جميع الحقول (delete + create في transaction)

| # | الاسم | الوصف | النتيجة المتوقعة |
| --- | --- | --- | --- |
| IF-F1 | تعيين حقول | fields=[{labelAr, labelEn, fieldType:"text", isRequired:true}] | 200 + الحقول المحدَّثة مرتبة بـ sortOrder |
| IF-F2 | أنواع متعددة | text + textarea + number + date | 200 + أربعة حقول |
| IF-F3 | حقل radio مع options | fieldType="radio" + options=["خيار1","خيار2"] | 200 + options محفوظة |
| IF-F4 | حقل select مع options | fieldType="select" + options=[...] | 200 + options محفوظة |
| IF-F5 | حقل مشروط | condition: { fieldId, operator:"equals", value:"نعم" } | 200 + condition محفوظة |
| IF-F6 | قائمة فارغة | fields=[] | 200 + [] (يحذف جميع الحقول) |
| IF-F7 | fieldType خاطئ | fieldType="slider" | 400 VALIDATION_ERROR |
| IF-F8 | operator خاطئ | condition.operator="greater_than" | 400 VALIDATION_ERROR |
| IF-F9 | بدون labelAr | حقل إلزامي | 400 VALIDATION_ERROR |
| IF-F10 | نموذج وهمي | formId غير موجود | 404 NOT_FOUND |

---

## تقديم الردود

> Endpoint: `POST /intake-forms/:formId/responses` — أي مستخدم مصادَق (بدون صلاحية إضافية)

| # | الاسم | الوصف | النتيجة المتوقعة |
| --- | --- | --- | --- |
| IF-S1 | تقديم ناجح | bookingId + answers={fieldId: "قيمة"} | 201 + { id, formId, bookingId, clientId, answers } + submissionsCount++ |
| IF-S2 | نموذج وهمي | formId غير موجود | 404 NOT_FOUND |
| IF-S3 | بدون bookingId | حقل إلزامي | 400 VALIDATION_ERROR |
| IF-S4 | بدون مصادقة | POST /intake-forms/:formId/responses بدون token | 401 Unauthorized |

---

## قراءة الردود

> Endpoint: `GET /intake-forms/responses/:bookingId` — يتطلب صلاحية `bookings:view`

| # | الاسم | الوصف | النتيجة المتوقعة |
| --- | --- | --- | --- |
| IF-R1 | ردود الحجز | GET /intake-forms/responses/:bookingId | 200 + مصفوفة الردود مع النموذج المدمج وحقوله |
| IF-R2 | حجز بدون ردود | bookingId لحجز لا تملك ردوداً | 200 + [] (مصفوفة فارغة) |
| IF-R3 | بدون صلاحية | مستخدم بدون bookings:view | 403 FORBIDDEN |
