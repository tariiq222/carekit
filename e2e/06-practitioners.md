# الأطباء (Employees)

---

## Scenario Audit Summary

- Total scenarios (original): 118
- Valid: 89
- Fixed: 18
- Removed: 3
- Added: 14
- **Total (final)**: 132

---

## Major Issues Found

- O4: error code خاطئ — الصحيح `USER_EMAIL_EXISTS` وليس `CONFLICT`
- P16: error code خاطئ — الصحيح `ALREADY_ASSIGNED` وليس `CONFLICT`
- P18: error code خاطئ — الصحيح `NOT_FOUND` وليس `SERVICE_NOT_FOUND`
- P34: سيناريو مفقود — حذف خدمة ذات حجوزات نشطة يعيد `400 ACTIVE_BOOKINGS_EXIST`
- B8: سيناريو مفقود — استراحة خارج وقت العمل يعيد `400 BREAK_OUTSIDE_AVAILABILITY`
- V3: تصحيح — startDate == endDate مقبول (يوم واحد)، الخطأ فقط عند endDate < startDate
- P54 (أصلي): breaks GET يتطلب `employees:view` (ليس عاماً) — تحديد الـ auth مهم

---

## إنشاء طبيب — `POST /employees`

> يتطلب صلاحية `employees:create`

| # | الاسم | الوصف | النتيجة المتوقعة |
|---|-------|-------|-----------------|
| PR-C1 | إنشاء أساسي | userId + specialty | 201 + employee.id |
| PR-C2 | إنشاء كامل | جميع الحقول: specialty, bio, experience, education, prices | 201 + كل الحقول محفوظة |
| PR-C3 | ثنائي اللغة | specialtyAr + bioAr + educationAr | 201 + الحقول العربية موجودة |
| PR-C4 | أسعار الأنواع الثلاثة | priceClinic + pricePhone + priceVideo | 201 + كل الأسعار محفوظة |
| PR-C5 | بدون userId | حقل إلزامي مفقود | 400 VALIDATION_ERROR |
| PR-C6 | بدون specialty | حقل إلزامي مفقود | 400 VALIDATION_ERROR |
| PR-C7 | userId وهمي | UUID غير موجود | 404 NOT_FOUND |
| PR-C8 | سعر سالب | priceClinic=-500 | 400 VALIDATION_ERROR |
| PR-C9 | بدون صلاحية | مستخدم بدون employees:create | 403 FORBIDDEN |
| PR-C10 | بدون مصادقة | POST /employees بدون token | 401 AUTH_TOKEN_INVALID |

---

## الإعداد السريع — `POST /employees/onboard`

> يتطلب صلاحية `employees:create` — يُنشئ مستخدماً وطبيباً في خطوة واحدة

| # | الاسم | الوصف | النتيجة المتوقعة |
|---|-------|-------|-----------------|
| O1 | إعداد كامل | nameEn + nameAr + email + specialty | 200 + { success: true, employee } |
| O2 | مع avatarUrl | تضمين رابط صورة صالح | 200 + employee.user.avatarUrl محفوظ |
| O3 | التحقق من إنشاء المستخدم | GET /users/:id بعد الإعداد | 200 + المستخدم موجود |
| O4 | إيميل مكرر | email موجود مسبقاً | 409 USER_EMAIL_EXISTS |
| O5 | بدون nameEn | حقل إلزامي مفقود | 400 VALIDATION_ERROR |
| O6 | بدون nameAr | حقل إلزامي مفقود | 400 VALIDATION_ERROR |
| O7 | بدون email | حقل إلزامي مفقود | 400 VALIDATION_ERROR |
| O8 | إيميل غير صالح | email="not-an-email" | 400 VALIDATION_ERROR |
| O9 | سعر سالب | priceClinic=-500 | 400 VALIDATION_ERROR |
| O10 | بدون صلاحية | مستخدم بدون employees:create | 403 FORBIDDEN |
| O11 | بدون مصادقة | POST /employees/onboard بدون token | 401 AUTH_TOKEN_INVALID |

---

## قراءة الأطباء — `GET /employees` (عام، بدون JWT)

| # | الاسم | الوصف | النتيجة المتوقعة |
|---|-------|-------|-----------------|
| PR-L1 | قائمة بدون توكن | GET /employees | 200 + مصفوفة مع pagination |
| PR-L2 | pagination | page=2&perPage=10 | الصفحة الثانية |
| PR-L3 | perPage > 100 | perPage=200 | 400 VALIDATION_ERROR |
| PR-L4 | بحث بالاسم | search=أحمد | الأطباء المطابقون فقط |
| PR-L5 | فلترة بالتخصص | specialty=dermatology | أطباء التخصص المحدد فقط |
| PR-L6 | فلترة بالحالة | isActive=false | الأطباء المعطّلون فقط |
| PR-L7 | فلترة بالفرع | branchId=X | أطباء الفرع المحدد فقط |
| PR-L8 | فلترة بالتقييم | minRating=4 | تقييم ≥ 4 فقط |
| PR-L9 | ترتيب بالتقييم | sortBy=rating&sortOrder=desc | الأعلى تقييماً أولاً |
| PR-L10 | بحث + فلترة معاً | search + specialty + isActive | تقاطع كل الفلاتر |
| PR-L11 | نص غير موجود | نص عشوائي في search | 200 + قائمة فارغة |
| PR-L12 | تفاصيل طبيب | GET /employees/:id | 200 + ملف كامل مع services + ratings |
| PR-L13 | طبيب وهمي | GET /employees/:fakeUUID | 404 EMPLOYEE_NOT_FOUND |

---

## تعديل الطبيب — `PATCH /employees/:id`

> يتطلب صلاحية `employees:edit` — الطبيب يستطيع تعديل ملفه فقط

| # | الاسم | الوصف | النتيجة المتوقعة |
|---|-------|-------|-----------------|
| PR-U1 | تعديل التخصص | specialty + specialtyAr | 200 + القيم الجديدة |
| PR-U2 | تعديل السيرة | bio + bioAr | 200 + المحتوى الجديد |
| PR-U3 | تعديل الأسعار | priceClinic + pricePhone + priceVideo | 200 + الأسعار الجديدة |
| PR-U4 | تعطيل الطبيب | isActive=false | 200 + لا يظهر في قائمة isActive=true |
| PR-U5 | إيقاف قبول الحجوزات | isAcceptingBookings=false | 200 + حجز جديد يعيد NOT_ACCEPTING_BOOKINGS |
| PR-U6 | تعديل جزئي | حقل واحد فقط | 200 + بقية الحقول كما هي |
| PR-U7 | سعر سالب | priceClinic=-100 | 400 VALIDATION_ERROR |
| PR-U8 | طبيب يعدّل ملف طبيب آخر | employeeId مختلف | 403 FORBIDDEN |
| PR-U9 | بدون صلاحية | مستخدم بدون employees:edit | 403 FORBIDDEN |
| PR-U10 | طبيب وهمي | UUID وهمي | 404 EMPLOYEE_NOT_FOUND |

---

## حذف الطبيب — `DELETE /employees/:id`

> يتطلب صلاحية `employees:delete` — soft delete

| # | الاسم | الوصف | النتيجة المتوقعة |
|---|-------|-------|-----------------|
| PR-D1 | حذف ناجح | المدير يحذف طبيباً | 200 + يختفي من GET /employees |
| PR-D2 | GET بعد الحذف | GET /employees/:id المحذوف | 404 EMPLOYEE_NOT_FOUND |
| PR-D3 | حذف مرتين | UUID لطبيب محذوف مسبقاً | 404 EMPLOYEE_NOT_FOUND |
| PR-D4 | طبيب وهمي | UUID غير موجود | 404 EMPLOYEE_NOT_FOUND |
| PR-D5 | بدون صلاحية | مستخدم بدون employees:delete | 403 FORBIDDEN |
| PR-D6 | بدون مصادقة | DELETE بدون token | 401 AUTH_TOKEN_INVALID |

---

## خدمات الطبيب — تعيين `POST /employees/:id/services`

> يتطلب صلاحية `employees:edit`

| # | الاسم | الوصف | النتيجة المتوقعة |
|---|-------|-------|-----------------|
| P1 | تعيين أساسي | serviceId + availableTypes=["clinic_visit"] | 201 + employeeService.id |
| P2 | سعر مخصص | priceClinic=18000 | 201 + priceClinic=18000 |
| P3 | مدة مخصصة | customDuration=45 | 201 + customDuration=45 |
| P4 | bufferMinutes | bufferMinutes=10 | 201 + bufferMinutes=10 |
| P5 | types مفصلة | types[{ bookingType, price, duration }] | 201 + تفاصيل النوع محفوظة |
| P6 | durationOptions | types[{ durationOptions: [{ label, durationMinutes, price }] }] | 201 + خيارات المدة محفوظة |
| P7 | تعيين غير نشط | isActive=false | 201 + isActive=false |
| P8 | availableTypes فارغ | availableTypes=[] | 400 VALIDATION_ERROR |
| P9 | نوع حجز غير صالح | availableTypes=["invalid_type"] | 400 VALIDATION_ERROR |
| P10 | سعر سالب | priceClinic=-500 | 400 VALIDATION_ERROR |
| P11 | customDuration=0 | أقل من الحد الأدنى (min 1) | 400 VALIDATION_ERROR |
| P12 | durationMinutes < 5 | durationOptions[{ durationMinutes: 4 }] | 400 VALIDATION_ERROR |
| P13 | durationMinutes > 480 | durationOptions[{ durationMinutes: 481 }] | 400 VALIDATION_ERROR |
| P14 | serviceId وهمي | UUID وهمي للخدمة | 404 NOT_FOUND |
| P15 | employeeId وهمي | UUID وهمي للطبيب | 404 EMPLOYEE_NOT_FOUND |
| P16 | تكرار التعيين | تعيين نفس الخدمة مرتين | 409 ALREADY_ASSIGNED |
| P17 | طبيب يعيّن لملف طبيب آخر | employeeId مختلف عن المستخدم الحالي | 403 FORBIDDEN |
| P18 | بدون صلاحية | مستخدم بدون employees:edit | 403 FORBIDDEN |

---

## خدمات الطبيب — قراءة `GET /employees/:id/services` (عام)

| # | الاسم | الوصف | النتيجة المتوقعة |
|---|-------|-------|-----------------|
| P19 | قراءة عامة | بدون توكن | 200 + خدمات isActive=true فقط |
| P20 | شكل الاستجابة | service.nameEn + availableTypes + prices | الحقول موجودة |
| P21 | سعر مخصص | الطبيب ذو السعر المخصص | priceClinic=18000 في الرد |
| P22 | إخفاء غير النشطة | خدمة isActive=false | غائبة من القائمة العامة |
| P23 | طبيب وهمي | UUID غير موجود | 404 EMPLOYEE_NOT_FOUND |

---

## خدمات الطبيب — تعديل `PATCH /employees/:id/services/:serviceId`

> يتطلب صلاحية `employees:edit`

| # | الاسم | الوصف | النتيجة المتوقعة |
|---|-------|-------|-----------------|
| P24 | تحديث سعر العيادة | priceClinic=28000 | 200 + القيمة الجديدة |
| P25 | مسح السعر | priceClinic=null | 200 + priceClinic=null (fallback لسعر الخدمة) |
| P26 | تحديث المدة | customDuration=60 | 200 + customDuration=60 |
| P27 | تعطيل التعيين | isActive=false | 200 + لا تظهر في GET العام |
| P28 | تحديث bufferMinutes | bufferMinutes=5 | 200 + bufferMinutes=5 |
| P29 | سعر سالب | priceClinic=-1000 | 400 VALIDATION_ERROR |
| P30 | نوع حجز غير صالح | types[{ bookingType: "invalid" }] | 400 VALIDATION_ERROR |
| P31 | تعيين غير موجود | serviceId وهمي في URL | 404 NOT_FOUND |
| P32 | طبيب يعدّل ملف طبيب آخر | employeeId مختلف عن المستخدم الحالي | 403 FORBIDDEN |

---

## خدمات الطبيب — حذف `DELETE /employees/:id/services/:serviceId`

> يتطلب صلاحية `employees:edit`

| # | الاسم | الوصف | النتيجة المتوقعة |
|---|-------|-------|-----------------|
| P33 | حذف ناجح | المدير يحذف تعيين خدمة | 200 + الخدمة غائبة من GET |
| P34 | حذف مع حجوزات نشطة | الخدمة لها حجوزات مفتوحة | 400 ACTIVE_BOOKINGS_EXIST |
| P35 | حذف مرتين | UUID محذوف مسبقاً | 404 NOT_FOUND |
| P36 | طبيب يحذف من ملف آخر | employeeId مختلف عن المستخدم الحالي | 403 FORBIDDEN |
| P37 | بدون صلاحية | مستخدم بدون employees:edit | 403 FORBIDDEN |

---

## خدمات الطبيب — أنواع الحجز `GET /employees/:id/services/:serviceId/types`

> يتطلب صلاحية `employees:view`

| # | الاسم | الوصف | النتيجة المتوقعة |
|---|-------|-------|-----------------|
| P38 | قراءة الأنواع | المدير يقرأ الأنواع المعيّنة | 200 + مصفوفة |
| P39 | شكل الاستجابة | bookingType + price + duration + isActive + durationOptions[] | الحقول موجودة |
| P40 | بدون مصادقة | GET بدون token | 401 AUTH_TOKEN_INVALID |
| P41 | بدون صلاحية | مستخدم بدون employees:view | 403 FORBIDDEN |
| P42 | تعيين غير موجود | serviceId غير معيّن للطبيب | 404 NOT_FOUND |
| P43 | طبيب وهمي | UUID وهمي | 404 EMPLOYEE_NOT_FOUND |

---

## جدول المتاحية — `GET/PUT /employees/:id/availability`

> GET عام — PUT يتطلب `employees:edit`

| # | الاسم | الوصف | النتيجة المتوقعة |
|---|-------|-------|-----------------|
| AV1 | قراءة بدون توكن | GET /employees/:id/availability | 200 + مصفوفة slots أسبوعية |
| AV2 | شكل الاستجابة | dayOfWeek + startTime + endTime + isActive | الحقول موجودة |
| AV3 | تعيين جدول أسبوعي | PUT + schedule[] لـ 5 أيام عمل (dayOfWeek 0-4) | 200 + الجدول محدَّث |
| AV4 | مع branchId | branchId مختلف لكل يوم | 200 + كل slot مرتبط بالفرع |
| AV5 | تعطيل يوم | isActive=false ليوم محدد | 200 + اليوم لا يُنتج slots |
| AV6 | استبدال كامل | PUT بأيام جديدة يحذف القديمة | فقط الجديدة موجودة |
| AV7 | صيغة وقت غير صالحة | startTime="9am" | 400 VALIDATION_ERROR |
| AV8 | endTime قبل startTime | start="17:00", end="09:00" | 400 VALIDATION_ERROR |
| AV9 | dayOfWeek خارج النطاق | dayOfWeek=7 | 400 VALIDATION_ERROR |
| AV10 | مسح الجدول | PUT + schedule=[] | 200 + قائمة فارغة |
| AV11 | بدون صلاحية | مستخدم بدون employees:edit | 403 FORBIDDEN |
| AV12 | بدون مصادقة | PUT بدون token | 401 AUTH_TOKEN_INVALID |
| AV13 | طبيب وهمي | UUID وهمي | 404 EMPLOYEE_NOT_FOUND |

---

## المواعيد المتاحة — `GET /employees/:id/slots` (عام)

| # | الاسم | الوصف | النتيجة المتوقعة |
|---|-------|-------|-----------------|
| SL1 | قراءة بدون توكن | GET /employees/:id/slots?date=2026-04-15 | 200 + slots[] |
| SL2 | date إلزامي — مفقود | طلب بدون ?date | 400 VALIDATION_ERROR |
| SL3 | تنسيق تاريخ خاطئ | date="27-03-2026" | 400 VALIDATION_ERROR |
| SL4 | فلترة بـ serviceId | ?serviceId=X | 200 + slots متوافقة مع مدة الخدمة |
| SL5 | duration مخصص | ?duration=60 | 200 + slots كل منها 60 دقيقة |
| SL6 | duration < 5 | ?duration=4 | 400 VALIDATION_ERROR |
| SL7 | duration > 240 | ?duration=241 | 400 VALIDATION_ERROR |
| SL8 | تأثير الاستراحة | استراحة 12:00-13:00 | slot 12:00 غائب/غير متاح |
| SL9 | تأثير الإجازة | يوم ضمن إجازة الطبيب | 200 + قائمة فارغة |
| SL10 | يوم غير نشط | isActive=false لذلك اليوم | 200 + قائمة فارغة |
| SL11 | bookingType غير صالح | ?bookingType=invalid | 400 VALIDATION_ERROR |
| SL12 | طبيب وهمي | UUID وهمي | 404 EMPLOYEE_NOT_FOUND |

---

## الاستراحات — `GET/PUT /employees/:id/breaks`

> GET يتطلب `employees:view` — PUT يتطلب `employees:edit`

| # | الاسم | الوصف | النتيجة المتوقعة |
|---|-------|-------|-----------------|
| B1 | تعيين استراحات | PUT + breaks[] لأيام متعددة | 200 + الاستراحات محفوظة |
| B2 | قراءة الاستراحات | GET /employees/:id/breaks | 200 + مصفوفة |
| B3 | شكل الاستجابة | dayOfWeek + startTime + endTime | الحقول موجودة |
| B4 | تأثير على Slots | استراحة 12:00-13:00 | slot 12:00 غائب من GET /slots |
| B5 | مسح الاستراحات | PUT + breaks=[] | 200 + قائمة فارغة |
| B6 | صيغة وقت غير صالحة | startTime="12pm" | 400 VALIDATION_ERROR |
| B7 | استراحتان متداخلتان | 11:00-13:00 و 12:00-14:00 نفس اليوم | 400 VALIDATION_ERROR |
| B8 | استراحة خارج وقت العمل | breakTime خارج availability window | 400 BREAK_OUTSIDE_AVAILABILITY |
| B9 | بدون صلاحية | مستخدم بدون employees:edit | 403 FORBIDDEN |
| B10 | بدون مصادقة | PUT بدون token | 401 AUTH_TOKEN_INVALID |
| B11 | طبيب وهمي | UUID وهمي | 404 EMPLOYEE_NOT_FOUND |

---

## الإجازات — `/employees/:id/vacations`

> POST + DELETE يتطلبان `employees:edit` — GET يتطلب `employees:view`

| # | الاسم | الوصف | النتيجة المتوقعة |
|---|-------|-------|-----------------|
| V1 | إجازة أساسية | POST + startDate + endDate | 201 + vacation.id |
| V2 | مع سبب | reason="مؤتمر طبي" (max 1000) | 201 + reason محفوظ |
| V3 | يوم واحد | startDate == endDate | 201 + مقبول |
| V4 | بدون startDate | حقل إلزامي | 400 VALIDATION_ERROR |
| V5 | بدون endDate | حقل إلزامي | 400 VALIDATION_ERROR |
| V6 | endDate قبل startDate | start="2026-05-10", end="2026-05-05" | 400 VALIDATION_ERROR |
| V7 | reason أطول من 1000 حرف | 1001 حرف | 400 VALIDATION_ERROR |
| V8 | قراءة الإجازات | GET /employees/:id/vacations | 200 + مصفوفة |
| V9 | تأثير على Slots | يوم ضمن الإجازة | 200 + قائمة slots فارغة |
| V10 | حذف ناجح | DELETE /employees/:id/vacations/:vacationId | 200 |
| V11 | Slots تعود بعد الحذف | GET /slots بعد حذف الإجازة | slots موجودة مجدداً |
| V12 | حذف مرتين | vacationId محذوف مسبقاً | 404 VACATION_NOT_FOUND |
| V13 | vacationId وهمي | UUID وهمي | 404 VACATION_NOT_FOUND |
| V14 | بدون صلاحية | مستخدم بدون employees:edit | 403 FORBIDDEN |
| V15 | بدون مصادقة | POST بدون token | 401 AUTH_TOKEN_INVALID |
