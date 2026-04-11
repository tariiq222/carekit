# المرضى (Clients)

---

## Scenario Audit Summary

- Total scenarios (original): 24
- Valid: 14
- Fixed: 6
- Removed: 0
- Added: 16
- **Total (final)**: 40

---

## Major Issues Found

- PT-WI9: خطأ في error code — الكود الصحيح `CLIENT_PHONE_EXISTS` وليس `CONFLICT`
- PT-CL2: خطأ في error code — الكود الصحيح `WALK_IN_NOT_FOUND` وليس `NOT_FOUND`
- PT-CL3: خطأ في error code — الكود الصحيح `USER_EMAIL_EXISTS` وليس `CONFLICT`
- PT-WI12: خطأ في قيمة `bloodType` — القيم الصحيحة هي `A_POS`, `A_NEG`, إلخ، وليس `X+`
- POST /clients/walk-in له سلوك idempotent مفقود — إذا وُجد الرقم كـ walk-in يعيد 200 + بيانات موجودة (ليس 409)
- سيناريوهات 401 و 403 مفقودة كلياً
- chronicConditions max 1000 مفقود من الوثيقة الأصلية
- GET /clients/:id يعيد آخر 10 حجوزات (ليس "آخر الحجوزات" بشكل مبهم)
- PATCH /clients/:id يحدّث User + ClientProfile في transaction واحدة

---

## قراءة المرضى

| # | الاسم | الوصف | النتيجة المتوقعة |
|---|-------|-------|-----------------|
| PT-L1 | قراءة الكل | GET /clients (بصلاحية clients:view) | 200 + { items: [...], meta: { total, page, perPage } } |
| PT-L2 | بحث بالاسم | GET /clients?search=محمد | 200 + مرضى يحتوي اسمهم على "محمد" (firstName أو lastName) |
| PT-L3 | بحث بالهاتف | GET /clients?search=+9665 | 200 + نتائج مطابقة للرقم |
| PT-L4 | بحث بالإيميل | GET /clients?search=@gmail | 200 + نتائج مطابقة |
| PT-L5 | pagination | GET /clients?page=2&perPage=10 | 200 + الصفحة الثانية (مجموعة مختلفة عن الأولى) |
| PT-L6 | مريض بـ ID | GET /clients/:id | 200 + بيانات كاملة + آخر 10 حجوزات (مع اسم الخدمة والطبيب وبيانات الدفع) |
| PT-L7 | ID وهمي | GET /clients/:uuid-غير-موجود | 404 — "Client not found" |
| PT-L8 | إحصائيات المريض | GET /clients/:id/stats | 200 + { totalBookings, byStatus, totalPaid, completedPayments } |
| PT-L9 | بدون صلاحية clients:view | مستخدم بدون الصلاحية يطلب GET /clients | 403 FORBIDDEN |
| PT-L10 | بدون مصادقة | GET /clients بدون token | 401 AUTH_TOKEN_INVALID |

---

## إنشاء مريض Walk-in

> Endpoint: `POST /clients/walk-in` — يتطلب صلاحية `clients:create`

| # | الاسم | الوصف | النتيجة المتوقعة |
|---|-------|-------|-----------------|
| PT-WI1 | walk-in أساسي | firstName + lastName + phone | 201 + { id, firstName, lastName, phone, accountType=walk_in, isExisting=false } |
| PT-WI2 | نفس الرقم مرة ثانية (idempotent) | نفس phone لمريض walk-in موجود | 200 + بيانات المريض الموجود + isExisting=true |
| PT-WI3 | مع بيانات طبية | bloodType=A_POS + allergies + chronicConditions | 201 + كل الحقول محفوظة في ClientProfile |
| PT-WI4 | مع شخص للتواصل | emergencyName + emergencyPhone بتنسيق E.164 | 201 + بيانات الطوارئ محفوظة |
| PT-WI5 | مع بيانات هوية | nationality + nationalId | 201 + محفوظة |
| PT-WI6 | بدون firstName | حقل إلزامي | 400 VALIDATION_ERROR |
| PT-WI7 | بدون lastName | حقل إلزامي | 400 VALIDATION_ERROR |
| PT-WI8 | بدون phone | حقل إلزامي | 400 VALIDATION_ERROR |
| PT-WI9 | phone بدون كود دولة | phone="0501234567" (ليس E.164) | 400 VALIDATION_ERROR |
| PT-WI10 | phone لحساب كامل موجود | الرقم مرتبط بـ accountType=full | 409 CLIENT_PHONE_EXISTS (يتضمن userId في الرد) |
| PT-WI11 | emergencyPhone بتنسيق خاطئ | emergencyPhone="0501234567" | 400 VALIDATION_ERROR |
| PT-WI12 | allergies تتجاوز 1000 حرف | 1001 حرف | 400 VALIDATION_ERROR |
| PT-WI13 | chronicConditions تتجاوز 1000 حرف | 1001 حرف | 400 VALIDATION_ERROR |
| PT-WI14 | bloodType قيمة خاطئة | bloodType="X+" (غير موجود في الـ enum) | 400 VALIDATION_ERROR |
| PT-WI15 | bloodType صالح | bloodType="O_NEG" | 201 + bloodType=O_NEG محفوظ |
| PT-WI16 | بدون صلاحية clients:create | مستخدم بدون الصلاحية | 403 FORBIDDEN |
| PT-WI17 | بدون مصادقة | POST /clients/walk-in بدون token | 401 AUTH_TOKEN_INVALID |

---

## تحويل Walk-in إلى حساب كامل (Claim)

> Endpoint: `POST /clients/claim` — يتطلب صلاحية `clients:create`

| # | الاسم | الوصف | النتيجة المتوقعة |
|---|-------|-------|-----------------|
| PT-CL1 | استرداد ناجح | phone لمريض walk-in + email جديد + password صالح | 200 + { id, email, firstName, lastName, phone, accountType=full, claimedAt } |
| PT-CL2 | phone غير مرتبط بـ walk-in | رقم غير موجود أو لحساب full | 404 WALK_IN_NOT_FOUND |
| PT-CL3 | email مستخدم مسبقاً | email مرتبط بحساب آخر | 409 USER_EMAIL_EXISTS |
| PT-CL4 | password ضعيفة — بدون حرف كبير | password="password1" | 400 VALIDATION_ERROR |
| PT-CL5 | password ضعيفة — بدون رقم | password="Password" | 400 VALIDATION_ERROR |
| PT-CL6 | password أقل من 8 أحرف | password="Ab1" | 400 VALIDATION_ERROR |
| PT-CL7 | password أكثر من 128 حرف | 129 حرف | 400 VALIDATION_ERROR |
| PT-CL8 | phone بتنسيق خاطئ | phone="0501234567" | 400 VALIDATION_ERROR |
| PT-CL9 | email بتنسيق خاطئ | email="not-email" | 400 VALIDATION_ERROR |
| PT-CL10 | بدون مصادقة | POST /clients/claim بدون token | 401 AUTH_TOKEN_INVALID |

---

## تعديل بيانات المريض

> Endpoint: `PATCH /clients/:id` — يتطلب صلاحية `clients:edit`

| # | الاسم | الوصف | النتيجة المتوقعة |
|---|-------|-------|-----------------|
| PT-U1 | تعديل الاسم | firstName جديد | 200 + firstName محدَّث + باقي الحقول كما هي |
| PT-U2 | تعديل رقم الهاتف | phone جديد بتنسيق E.164 | 200 + phone الجديد |
| PT-U3 | تعديل البيانات الطبية | allergies + chronicConditions | 200 + ClientProfile محدَّث |
| PT-U4 | تعديل جزئي | حقل واحد فقط | 200 + فقط الحقل المُرسَل يتغير |
| PT-U5 | phone بتنسيق خاطئ | phone="0501234567" | 400 VALIDATION_ERROR |
| PT-U6 | مريض غير موجود | ID وهمي | 404 — "Client not found" |
| PT-U7 | firstName يتجاوز 255 حرف | 256 حرف | 400 VALIDATION_ERROR |
| PT-U8 | nationalId يتجاوز 20 حرف | 21 حرف | 400 VALIDATION_ERROR |
| PT-U9 | بدون صلاحية clients:edit | مستخدم بدون الصلاحية | 403 FORBIDDEN |
| PT-U10 | بدون مصادقة | PATCH /clients/:id بدون token | 401 AUTH_TOKEN_INVALID |
