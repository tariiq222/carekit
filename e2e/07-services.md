# الخدمات (Services)

---

## Scenario Audit Summary

- Total scenarios (original): ~20
- Valid: 10
- Fixed: 6
- Removed: 0
- Added: 24
- **Total (final)**: 50

---

## Major Issues Found

- POST /services يعيد 201 وليس 200
- GET /services و GET /services/:id عامان بدون مصادقة (@Public)
- الصلاحيات تستخدم نقطة: `services.create` وليس `services:create`
- `calendarColor` يجب أن يطابق `/^#[0-9A-Fa-f]{6}$/`
- `depositPercent` min 1 max 100 (ليس 0)
- `bufferMinutes` max 120
- `durationMinutes` في duration options: min 5 max 480
- `duration` في booking types: min 5 max 480
- PUT /services/:id/booking-types يُعيد `{ success: true, data: [...] }` (مُغلَّف)
- PUT /services/:id/booking-types و PUT /services/:id/duration-options يستبدلان الكل (delete + create)
- GET /services/:id/booking-types و GET /services/:id/duration-options عامان بدون مصادقة
- سيناريوهات 401 و 403 مفقودة كلياً

---

## إنشاء خدمة

> Endpoint: `POST /services` — يتطلب صلاحية `services.create` — يعيد 201

| # | الاسم | الوصف | النتيجة المتوقعة |
| --- | --- | --- | --- |
| SVC-C1 | إنشاء أساسي | nameEn + nameAr + categoryId | 201 + كائن الخدمة الكامل مع category مدمجة |
| SVC-C2 | مع وصف | descriptionEn + descriptionAr | 201 + الوصف محفوظ |
| SVC-C3 | مع سعر | price=10000 (هللة) | 201 + price=10000 |
| SVC-C4 | مع مدة | duration=45 | 201 + duration=45 |
| SVC-C5 | مع لون تقويم | calendarColor="#FF5733" | 201 + calendarColor="#FF5733" |
| SVC-C6 | لون تقويم خاطئ | calendarColor="red" أو "#GGG" | 400 VALIDATION_ERROR |
| SVC-C7 | مع إيداع | depositEnabled=true + depositPercent=30 | 201 + depositEnabled=true |
| SVC-C8 | depositPercent=0 | أقل من الحد الأدنى (min=1) | 400 VALIDATION_ERROR |
| SVC-C9 | depositPercent=101 | أكبر من الحد الأقصى (max=100) | 400 VALIDATION_ERROR |
| SVC-C10 | مع حجز متكرر | allowRecurring=true + allowedRecurringPatterns=["weekly"] + maxRecurrences=8 | 201 + الحقول محفوظة |
| SVC-C11 | maxRecurrences=53 | أكبر من max=52 | 400 VALIDATION_ERROR |
| SVC-C12 | bufferMinutes=121 | أكبر من max=120 | 400 VALIDATION_ERROR |
| SVC-C13 | categoryId وهمي | UUID غير موجود | 404 NOT_FOUND |
| SVC-C14 | بدون nameEn | حقل إلزامي | 400 VALIDATION_ERROR |
| SVC-C15 | بدون categoryId | حقل إلزامي | 400 VALIDATION_ERROR |
| SVC-C16 | بدون مصادقة | POST /services بدون token | 401 Unauthorized |
| SVC-C17 | بدون صلاحية | مستخدم بدون services.create | 403 FORBIDDEN |

---

## قراءة الخدمات

> `GET /services` و `GET /services/:id` عامان بدون مصادقة (@Public)

| # | الاسم | الوصف | النتيجة المتوقعة |
| --- | --- | --- | --- |
| SVC-L1 | قراءة الكل | GET /services | 200 + { items, meta: { total, page, perPage, totalPages } } |
| SVC-L2 | فلترة بالفئة | GET /services?categoryId=:uuid | 200 + خدمات الفئة فقط |
| SVC-L3 | بحث بالاسم | GET /services?search=عيادة | 200 + نتائج مطابقة (nameEn أو nameAr) |
| SVC-L4 | تضمين المخفي | GET /services?includeHidden=true | 200 + يشمل isHidden=true |
| SVC-L5 | pagination | GET /services?page=2&perPage=10 | 200 + الصفحة الثانية |
| SVC-L6 | خدمة بـ ID | GET /services/:id | 200 + تفاصيل كاملة + category |
| SVC-L7 | ID وهمي | GET /services/:uuid-غير-موجود | 404 NOT_FOUND |

---

## تعديل خدمة

> Endpoint: `PATCH /services/:id` — يتطلب صلاحية `services.edit`

| # | الاسم | الوصف | النتيجة المتوقعة |
| --- | --- | --- | --- |
| SVC-U1 | تعديل الاسم | nameEn جديد | 200 + nameEn محدَّث |
| SVC-U2 | تعديل السعر | price=20000 | 200 + price=20000 |
| SVC-U3 | تعديل الفئة | categoryId جديد موجود | 200 + category الجديدة |
| SVC-U4 | تعديل جزئي | حقل واحد فقط | 200 + فقط الحقل المُرسَل يتغير |
| SVC-U5 | فئة وهمية | categoryId غير موجود | 404 NOT_FOUND |
| SVC-U6 | ID وهمي | UUID غير موجود | 404 NOT_FOUND |
| SVC-U7 | بدون صلاحية | مستخدم بدون services.edit | 403 FORBIDDEN |

---

## حذف خدمة (Soft Delete)

> Endpoint: `DELETE /services/:id` — يتطلب صلاحية `services.delete`

| # | الاسم | الوصف | النتيجة المتوقعة |
| --- | --- | --- | --- |
| SVC-D1 | حذف ناجح | DELETE /services/:id | 200 + { deleted: true } + تختفي من GET /services |
| SVC-D2 | ID وهمي | UUID غير موجود | 404 NOT_FOUND |
| SVC-D3 | بدون صلاحية | مستخدم بدون services.delete | 403 FORBIDDEN |

---

## أنواع الحجز (Booking Types)

> GET: عام بدون مصادقة — PUT: يتطلب `services.edit`
> PUT يستبدل الكل (delete + create في transaction)

| # | الاسم | الوصف | النتيجة المتوقعة |
| --- | --- | --- | --- |
| SVC-BT1 | قراءة أنواع الحجز | GET /services/:id/booking-types | 200 + { success: true, data: [...] } + durationOptions لكل نوع |
| SVC-BT2 | تعيين نوع واحد | PUT + types=[{bookingType:"clinic_visit", price:1000, duration:30}] | 200 + { success: true, data: [نوع واحد] } |
| SVC-BT3 | تعيين أنواع متعددة | clinic_visit + video_consultation + phone_consultation | 200 + ثلاثة أنواع |
| SVC-BT4 | مع duration options | durationOptions داخل كل نوع | 200 + durationOptions محفوظة |
| SVC-BT5 | استبدال كامل | PUT بعد PUT أول | 200 + فقط الأنواع الجديدة (الأقدم محذوف) |
| SVC-BT6 | قائمة فارغة | types=[] | 200 + { success: true, data: [] } |
| SVC-BT7 | bookingType خاطئ | bookingType="home_visit" (غير موجود في enum) | 400 VALIDATION_ERROR |
| SVC-BT8 | duration=4 | أقل من min=5 | 400 VALIDATION_ERROR |
| SVC-BT9 | duration=481 | أكبر من max=480 | 400 VALIDATION_ERROR |
| SVC-BT10 | خدمة وهمية | serviceId غير موجود | 404 NOT_FOUND |
| SVC-BT11 | بدون صلاحية | مستخدم بدون services.edit | 403 FORBIDDEN |

---

## خيارات المدة (Duration Options)

> GET: عام بدون مصادقة — PUT: يتطلب `services.edit`
> PUT يستبدل الكل (delete + create في transaction)

| # | الاسم | الوصف | النتيجة المتوقعة |
| --- | --- | --- | --- |
| SVC-DO1 | قراءة الخيارات | GET /services/:id/duration-options | 200 + مصفوفة مرتبة بـ sortOrder |
| SVC-DO2 | بدون خيارات | خدمة لا تملك خيارات مدة | 200 + [] (مصفوفة فارغة) |
| SVC-DO3 | تعيين خيارات | PUT + options=[{label:"30 دقيقة", durationMinutes:30, price:500, isDefault:true}] | 200 + الخيارات محفوظة |
| SVC-DO4 | durationMinutes=4 | أقل من min=5 | 400 VALIDATION_ERROR |
| SVC-DO5 | durationMinutes=481 | أكبر من max=480 | 400 VALIDATION_ERROR |
| SVC-DO6 | خدمة وهمية | serviceId غير موجود | 404 NOT_FOUND |
| SVC-DO7 | بدون صلاحية | مستخدم بدون services.edit | 403 FORBIDDEN |
