# Dashboard Pages — API Map

> مرجع كامل: كل صفحة + كل endpoint تحتاجه + وش يسوي
> استخدم هذا الملف عند تصميم Figma وعند ربط الفرونت بالباك

---

## 1. الصفحة الرئيسية (Dashboard Home)

### البيانات المعروضة
- 4 بطاقات إحصائية: إيرادات اليوم، حجوزات اليوم، إجراءات معلقة، مرضى جدد
- جدول مواعيد اليوم (آخر 5-10)
- إجراءات معلقة (طلبات إلغاء + تحويلات بنكية)
- chart إيرادات آخر 30 يوم
- chart توزيع أنواع الحجوزات
- آخر النشاطات

### الـ Endpoints

| Method | Path | الوظيفة |
|--------|------|---------|
| GET | `/reports/revenue?dateFrom=&dateTo=` | إيرادات: إجمالي + حسب الشهر + حسب الممارس + حسب الخدمة |
| GET | `/reports/bookings?dateFrom=&dateTo=` | حجوزات: عدد حسب الحالة + حسب النوع + حسب اليوم |
| GET | `/payments/stats` | إحصائيات المدفوعات: عدد حسب الحالة + إجمالي الإيرادات + عدد التحويلات المعلقة |
| GET | `/bookings?status=confirmed&dateFrom=today&dateTo=today` | مواعيد اليوم المؤكدة |

### إجراءات المستخدم
لا يوجد — صفحة عرض فقط. الأزرار تنقل لصفحات أخرى.

---

## 2. المواعيد (Appointments)

### البيانات المعروضة
- جدول كل المواعيد مع فلاتر (حالة، نوع، ممارس، تاريخ)
- عرض تقويم شهري (calendar view)
- panel تفاصيل الموعد (sheet جانبي)
- فورم إنشاء موعد جديد

### الـ Endpoints

| Method | Path | الوظيفة |
|--------|------|---------|
| GET | `/bookings` | كل المواعيد — يدعم فلاتر: `status`, `type`, `employeeId`, `clientId`, `dateFrom`, `dateTo`, `page`, `perPage` |
| GET | `/bookings/:id` | تفاصيل موعد واحد (مريض + ممارس + خدمة + دفع + تقييم) |
| POST | `/bookings` | إنشاء موعد جديد — يحتاج: `clientId`, `employeeServiceId`, `type`, `date`, `startTime`. يتحقق من عدم التعارض + ينشئ رابط Zoom لو video |
| PATCH | `/bookings/:id` | إعادة جدولة — يرسل `date` + `startTime` جديدة. ينشئ موعد جديد ويلغي القديم وينقل الدفع |
| POST | `/bookings/:id/confirm` | تأكيد الموعد — يتحقق إن الدفع تم. يغير الحالة من pending → confirmed |
| POST | `/bookings/:id/complete` | إكمال الموعد — يغير من confirmed → completed |
| POST | `/bookings/:id/no-show` | عدم حضور — يغير من confirmed → no_show |
| POST | `/bookings/:id/cancel-request` | طلب إلغاء من المريض — يغير من confirmed → pending_cancellation |
| POST | `/bookings/:id/cancel/approve` | الأدمن يوافق على الإلغاء — يرسل: `refundAmount` (كامل/جزئي/صفر). يغير → cancelled + ينفذ الاسترداد |
| POST | `/bookings/:id/cancel/reject` | الأدمن يرفض الإلغاء — يعيد الحالة → confirmed |

### بيانات الفورم تحتاج
| Method | Path | الوظيفة |
|--------|------|---------|
| GET | `/clients?search=` | قائمة المرضى للاختيار |
| GET | `/employees` | قائمة الممارسين للاختيار |
| GET | `/employees/:id/services` | خدمات الممارس المحدد مع الأسعار |
| GET | `/employees/:id/slots?date=` | الأوقات المتاحة في تاريخ محدد |

---

## 3. الممارسون (Employees)

### البيانات المعروضة
- جدول كل الممارسين مع فلاتر (تخصص، حالة، بحث)
- صفحة تفاصيل: ملف شخصي، خدمات، جدول أسبوعي، إجازات، مواعيد، تقييمات
- فورم إنشاء/تعديل

### الـ Endpoints

| Method | Path | الوظيفة |
|--------|------|---------|
| GET | `/employees` | كل الممارسين — فلاتر: `specialtyId`, `search`, `isActive`, `minRating` |
| GET | `/employees/:id` | تفاصيل الممارس + user info + تخصص + تقييم متوسط |
| POST | `/employees` | إنشاء ممارس — ينشئ user + employee + يربط بالتخصص |
| PATCH | `/employees/:id` | تعديل بيانات الممارس (سيرة، تخصص، حالة) |
| DELETE | `/employees/:id` | حذف ناعم |
| GET | `/employees/:id/availability` | الجدول الأسبوعي (أيام + أوقات) |
| PUT | `/employees/:id/availability` | تحديث الجدول الأسبوعي (يستبدل الكل) |
| GET | `/employees/:id/vacations` | قائمة الإجازات |
| POST | `/employees/:id/vacations` | إضافة إجازة — `startDate`, `endDate`, `reason` |
| DELETE | `/employees/:id/vacations/:vacationId` | حذف إجازة |
| GET | `/employees/:id/services` | الخدمات المعينة للممارس مع أسعاره |
| POST | `/employees/:id/services` | تعيين خدمة — `serviceId`, `clinicVisitPrice`, `phonePrice`, `videoPrice`, `duration` |
| PATCH | `/employees/:id/services/:serviceId` | تعديل سعر/مدة خدمة |
| DELETE | `/employees/:id/services/:serviceId` | إلغاء تعيين خدمة |
| GET | `/employees/:id/ratings` | تقييمات الممارس (مجهولة الهوية) |

### بيانات الفورم تحتاج
| Method | Path | الوظيفة |
|--------|------|---------|
| GET | `/specialties` | كل التخصصات — لـ dropdown في فورم الإنشاء |
| GET | `/services` | كل الخدمات — لتعيين خدمة لممارس |

---

## 4. المرضى (Clients)

### البيانات المعروضة
- جدول كل المرضى مع بحث + server-side pagination
- صفحة تفاصيل: ملف شخصي، مواعيد، مدفوعات

### الـ Endpoints

| Method | Path | الوظيفة |
|--------|------|---------|
| GET | `/clients` | كل المرضى — فلاتر: `search`, `page`, `perPage`. يجيب المستخدمين بدور client |
| GET | `/clients/:id` | تفاصيل المريض + آخر 10 حجوزات |
| GET | `/clients/:id/stats` | إحصائيات: عدد الحجوزات حسب الحالة + إجمالي المدفوعات |
| PATCH | `/users/:id` | تعديل بيانات المريض (الاسم، الجوال، الجنس، تاريخ الميلاد) |
| PATCH | `/users/:id/activate` | تفعيل حساب المريض |
| PATCH | `/users/:id/deactivate` | تعطيل حساب المريض |

---

## 5. المدفوعات (Payments)

### البيانات المعروضة
- 4 بطاقات إحصائية: إجمالي، مدفوع، معلق، مسترد
- جدول كل المدفوعات مع فلاتر
- modal مراجعة التحويل البنكي (صورة الإيصال + تقييم AI + قبول/رفض)

### الـ Endpoints

| Method | Path | الوظيفة |
|--------|------|---------|
| GET | `/payments/stats` | إحصائيات: عدد حسب الحالة + إجمالي الإيرادات + عدد التحويلات المعلقة + عدد المبالغ المستردة |
| GET | `/payments` | كل المدفوعات — فلاتر: `status`, `method`, `dateFrom`, `dateTo`, `page`, `perPage` |
| GET | `/payments/:id` | تفاصيل دفعة واحدة (مع بيانات الحجز والمريض) |
| POST | `/payments/moyasar` | إنشاء دفعة Moyasar — يرسل للـ Moyasar API ويعيد رابط الدفع |
| POST | `/payments/moyasar/webhook` | Webhook من Moyasar — يتحقق HMAC + يحدث الحالة + ينشئ فاتورة تلقائياً |
| POST | `/payments/bank-transfer` | رفع إيصال تحويل بنكي — يرسل الصورة لـ AI Vision للتحليل |
| POST | `/payments/bank-transfer/:id/verify` | الأدمن يقبل/يرفض التحويل — `action: 'approve' | 'reject'`, `adminNotes` |
| POST | `/payments/:id/refund` | استرداد — `amount` (كامل أو جزئي). لو Moyasar يستدعي API الاسترداد |
| PATCH | `/payments/:id/status` | تحديث حالة يدوي |

---

## 6. الفواتير (Invoices)

### البيانات المعروضة
- 4 بطاقات: إجمالي الفواتير، المرسلة، غير المرسلة، المبلغ الإجمالي
- جدول الفواتير مع فلتر ZATCA
- badge حالة ZATCA (QR/pending/reported/failed)

### الـ Endpoints

| Method | Path | الوظيفة |
|--------|------|---------|
| GET | `/invoices/stats` | إحصائيات: عدد إجمالي + مرسلة + غير مرسلة + إجمالي المبلغ + تفصيل ZATCA |
| GET | `/invoices` | كل الفواتير — فلاتر: `dateFrom`, `dateTo`, `zatcaStatus` |
| GET | `/invoices/:id` | تفاصيل فاتورة |
| POST | `/invoices` | إنشاء فاتورة يدوياً (عادةً تُنشأ تلقائياً عند الدفع) |
| GET | `/invoices/:id/html` | عرض الفاتورة كـ HTML (للطباعة) |
| PATCH | `/invoices/:id/send` | تعليم الفاتورة كـ "مرسلة" |
| POST | `/zatca/sandbox/report/:invoiceId` | إبلاغ ZATCA عن الفاتورة (sandbox) |

---

## 7. الخدمات (Services)

### البيانات المعروضة
- فئات الخدمات (collapsible)
- خدمات داخل كل فئة مع الأسعار
- فورم إنشاء/تعديل فئة وخدمة

### الـ Endpoints

| Method | Path | الوظيفة |
|--------|------|---------|
| GET | `/services/categories` | كل الفئات النشطة |
| POST | `/services/categories` | إنشاء فئة — `nameAr`, `nameEn`, `description` |
| PATCH | `/services/categories/:id` | تعديل فئة |
| DELETE | `/services/categories/:id` | حذف فئة (يفشل لو فيها خدمات) |
| GET | `/services` | كل الخدمات — فلتر: `categoryId`, `isActive`, `search` |
| GET | `/services/:id` | تفاصيل خدمة |
| POST | `/services` | إنشاء خدمة — `nameAr`, `nameEn`, `categoryId`, `defaultClinicPrice`, `defaultPhonePrice`, `defaultVideoPrice`, `durationMinutes` |
| PATCH | `/services/:id` | تعديل خدمة |
| DELETE | `/services/:id` | حذف ناعم |

---

## 8. المستخدمون (Users)

### البيانات المعروضة
- جدول المستخدمين (staff فقط — غير المرضى) مع بحث وفلاتر
- فورم إنشاء/تعديل مستخدم
- تعيين أدوار

### الـ Endpoints

| Method | Path | الوظيفة |
|--------|------|---------|
| GET | `/users` | كل المستخدمين — فلاتر: `search`, `role`, `isActive`, `page`, `perPage` |
| GET | `/users/:id` | تفاصيل مستخدم |
| POST | `/users` | إنشاء مستخدم — `email`, `password`, `nameAr`, `nameEn`, `phone`, `roleSlug`. لو `roleSlug: 'employee'` ينشئ ممارس تلقائياً |
| PATCH | `/users/:id` | تعديل بيانات المستخدم |
| DELETE | `/users/:id` | حذف ناعم |
| PATCH | `/users/:id/activate` | تفعيل |
| PATCH | `/users/:id/deactivate` | تعطيل |
| POST | `/users/:id/roles` | إعطاء دور — `roleId` أو `roleSlug` |
| DELETE | `/users/:id/roles/:roleId` | سحب دور |

---

## 9. الأدوار (Roles) — مدمجة في صفحة المستخدمين

### الـ Endpoints

| Method | Path | الوظيفة |
|--------|------|---------|
| GET | `/roles` | كل الأدوار مع صلاحياتها |
| POST | `/roles` | إنشاء دور — `name`, `nameAr`, `slug`, `description` |
| DELETE | `/roles/:id` | حذف دور (يفشل لو system role) |
| POST | `/roles/:id/permissions` | إضافة صلاحية — `module`, `action` (مثل: `bookings`, `create`) |
| DELETE | `/roles/:id/permissions` | إزالة صلاحية — `module`, `action` |
| GET | `/permissions` | كل الصلاحيات المتاحة في النظام |

---

## 10. التقارير (Reports)

### البيانات المعروضة
- فلتر نطاق تاريخ
- bar chart إيرادات شهرية
- pie chart حالات الحجوزات
- جدول تفصيلي

### الـ Endpoints

| Method | Path | الوظيفة |
|--------|------|---------|
| GET | `/reports/revenue?dateFrom=&dateTo=` | إيرادات: `total`, `byMonth[{month, total, count}]`, `byEmployee[{name, total}]`, `byService[{name, total}]` |
| GET | `/reports/bookings?dateFrom=&dateTo=` | حجوزات: `total`, `byStatus{pending, confirmed, completed, cancelled, pendingCancellation}`, `byType{clinic, phone, video}`, `byDay[{date, count}]` |
| GET | `/reports/employees/:id?dateFrom=&dateTo=` | تقرير ممارس فردي |

---

## 11. الإعدادات (Settings)

### 7 تبويبات — كلها تستخدم نفس الـ API

### الـ Endpoints

| Method | Path | الوظيفة |
|--------|------|---------|
| GET | `/whitelabel/config/map` | كل الإعدادات كـ `{ key: value }` |
| PUT | `/whitelabel/config` | حفظ إعدادات — `entries: [{ key, value, type }]` |
| GET | `/whitelabel/config/:key` | إعداد واحد |
| DELETE | `/whitelabel/config/:key` | حذف إعداد |

### مفاتيح كل تبويب

**البراندنج:** `clinic_name`, `clinic_name_ar`, `primary_color`, `secondary_color`, `logo_url`, `font_arabic`, `font_english`

**التواصل:** `clinic_email`, `clinic_phone`, `clinic_address`, `clinic_address_ar`, `clinic_city`, `clinic_website`, `social_twitter`, `social_instagram`

**الدفع:** `moyasar_publishable_key`, `moyasar_secret_key`, `moyasar_callback_url`, `bank_transfer_enabled`, `bank_name`, `bank_iban`, `bank_account_name`

**الإشعارات:** `email_provider` (resend/sendgrid), `email_api_key`, `email_from`, `fcm_enabled`, `fcm_server_key`

**الإلغاء:** `cancellation_policy_ar`, `cancellation_policy_en`

**التكاملات:** `zoom_account_id`, `zoom_client_id`, `zoom_client_secret`, `openrouter_api_key`, `minio_endpoint`, `minio_access_key`, `minio_secret_key`, `minio_bucket`

**ZATCA:** `vat_enabled`, `vat_rate`, `vat_registration_number`, `zatca_environment` (sandbox/production), `zatca_csid`, `zatca_private_key`

---

## 12. المساعد الذكي (Chatbot)

### تبويب المحادثات
| Method | Path | الوظيفة |
|--------|------|---------|
| GET | `/chatbot/sessions` | كل المحادثات — الأدمن يشوف الكل |
| GET | `/chatbot/sessions/:id` | محادثة واحدة مع كل الرسائل |
| POST | `/chatbot/sessions/:id/end` | إنهاء محادثة |

### تبويب التحليلات
| Method | Path | الوظيفة |
|--------|------|---------|
| GET | `/chatbot/analytics` | إحصائيات: عدد المحادثات، الـ handoffs، حسب اللغة |
| GET | `/chatbot/analytics/questions` | أكثر الأسئلة شيوعاً |

### تبويب الإعدادات
| Method | Path | الوظيفة |
|--------|------|---------|
| GET | `/chatbot/config` | كل إعدادات البوت |
| PUT | `/chatbot/config` | حفظ إعدادات — `entries: [{ category, key, value }]` |

### قاعدة المعرفة (صفحة منفصلة)
| Method | Path | الوظيفة |
|--------|------|---------|
| GET | `/chatbot/knowledge-base` | كل المدخلات |
| POST | `/chatbot/knowledge-base` | إضافة مدخلة — `title`, `content`, `category` |
| PATCH | `/chatbot/knowledge-base/:id` | تعديل مدخلة |
| DELETE | `/chatbot/knowledge-base/:id` | حذف مدخلة |
| POST | `/chatbot/knowledge-base/sync` | مزامنة من قاعدة البيانات (يسحب الممارسين والخدمات تلقائياً) |

---

## 13. الإشعارات (Notifications) — تحتاج بناء من الصفر

### الـ Endpoints الجاهزة

| Method | Path | الوظيفة |
|--------|------|---------|
| GET | `/notifications` | إشعارات المستخدم الحالي — `page`, `perPage` |
| GET | `/notifications/unread-count` | عدد غير المقروءة |
| PATCH | `/notifications/read-all` | قراءة الكل |
| PATCH | `/notifications/:id/read` | قراءة واحد |

### أنواع الإشعارات (NotificationType)
- `booking_confirmed` — تأكيد موعد
- `booking_completed` — اكتمال موعد
- `booking_cancelled` — إلغاء موعد
- `reminder` — تذكير
- `payment_received` — استلام دفعة
- `new_rating` — تقييم جديد
- `problem_report` — بلاغ مشكلة

---

## 14. تسجيل الدخول (Login)

| Method | Path | الوظيفة |
|--------|------|---------|
| POST | `/auth/login` | دخول بـ email + password — يرجع `accessToken` + `refreshToken` |
| POST | `/auth/login/otp/send` | إرسال OTP للبريد |
| POST | `/auth/login/otp/verify` | تحقق من OTP — يرجع tokens |
| POST | `/auth/refresh-token` | تجديد الـ access token |
| POST | `/auth/logout` | تسجيل خروج — يبطل الـ refresh token |
| GET | `/auth/me` | بيانات المستخدم الحالي + أدواره |
| POST | `/auth/password/forgot` | نسيت كلمة المرور — يرسل OTP |
| POST | `/auth/password/reset` | إعادة تعيين كلمة المرور بالـ OTP |
| PATCH | `/auth/password/change` | تغيير كلمة المرور (يحتاج القديمة) |

---

## ملاحظة: Base URL

```
Development: http://localhost:3100/api/v1
Production:  https://api.{domain}/api/v1
```

كل الـ endpoints تحتاج `Authorization: Bearer <token>` ما عدا:
- `POST /auth/login` + `/auth/register` + `/auth/login/otp/*`
- `POST /auth/password/forgot` + `/auth/password/reset`
- `POST /payments/moyasar/webhook`
- `GET /employees` + `/employees/:id` + `/services` + `/specialties` (public)
