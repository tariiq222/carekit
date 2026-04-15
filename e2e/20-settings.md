# الإعدادات (Settings)
> يشمل: Branding · ساعات العمل · الإجازات · قوالب البريد

---

## Branding (هوية العيادة)

> الصلاحيات: `branding:edit` للكتابة. الـ endpoint العام مفتوح (بدون auth) ومقيّد بـ throttle (30/min).

### قراءة

| # | الاسم | الوصف | النتيجة المتوقعة |
|---|-------|-------|-----------------|
| BR-L1 | الهوية العامة | GET /public/branding/:tenantId (بدون auth) | 200 + BrandingConfig (اسم + شعار + ألوان + خط) |
| BR-L2 | tenantId غير صالح | UUID سيئ الصياغة | 400 VALIDATION_ERROR |
| BR-L3 | هوية admin | GET /dashboard/organization/branding | 200 + BrandingConfig مع defaults لو فارغة |

### تحديث

| # | الاسم | الوصف | النتيجة المتوقعة |
|---|-------|-------|-----------------|
| BR-U1 | تحديث كامل | POST /dashboard/organization/branding + الحقول المنظمة | 200 + BrandingConfig محدّثة |
| BR-U2 | تحديث اسم العيادة | `clinicNameAr: "عيادتي"` | 200 + محفوظ |
| BR-U3 | hex صالح | `primaryColor: "#354FD8"` | 200 + محفوظ |
| BR-U4 | hex غير صالح | `primaryColor: "blue"` | 400 VALIDATION_ERROR |
| BR-U5 | clinicNameAr فارغ | required field | 400 VALIDATION_ERROR |
| BR-U6 | clinicNameAr طويل | أكثر من 200 حرف | 400 VALIDATION_ERROR |
| BR-U7 | بدون صلاحية | مستخدم بدون `branding:edit` | 403 FORBIDDEN |

---

## ساعات العمل (Clinic Hours)

| # | الاسم | الوصف | النتيجة المتوقعة |
|---|-------|-------|-----------------|
| CH-L1 | قراءة ساعات العمل | GET /clinic/hours | 200 + 7 أيام بحالاتها |
| CH-U1 | تحديث ساعات العمل | PUT /clinic/hours + مصفوفة أيام | 200 + محدّثة |
| CH-U2 | يوم نشط مع أوقات | `dayOfWeek: 0, startTime: "09:00", endTime: "17:00", isActive: true` | 200 + محفوظ |
| CH-U3 | يوم معطّل | `isActive: false` | 200 + اليوم عطلة |
| CH-U4 | dayOfWeek خارج النطاق | `dayOfWeek: 7` (يجب 0–6) | 400 VALIDATION_ERROR |
| CH-U5 | تنسيق وقت خاطئ | `startTime: "9:00"` بدون صفر | 400 VALIDATION_ERROR |
| CH-U6 | endTime قبل startTime | أوقات مقلوبة | 400 VALIDATION_ERROR |

---

## الإجازات والعطل (Clinic Holidays)

| # | الاسم | الوصف | النتيجة المتوقعة |
|---|-------|-------|-----------------|
| HOL-L1 | قراءة الإجازات | GET /clinic/holidays | 200 + قائمة |
| HOL-L2 | فلترة بالسنة | `year=2026` | إجازات 2026 فقط |
| HOL-C1 | إضافة إجازة | POST /clinic/holidays + date + nameAr + nameEn | 200 + holiday |
| HOL-C2 | إجازة متكررة | `isRecurring: true` | 200 + تتكرر كل سنة |
| HOL-C3 | بدون nameAr | حقل إلزامي | 400 VALIDATION_ERROR |
| HOL-C4 | بدون nameEn | حقل إلزامي | 400 VALIDATION_ERROR |
| HOL-C5 | تنسيق تاريخ خاطئ | `date: "2026/01/01"` | 400 VALIDATION_ERROR |
| HOL-D1 | حذف إجازة | DELETE /clinic/holidays/:id | 200 + محذوفة |
| HOL-D2 | ID وهمي | string غير موجود | 404 NOT_FOUND |

---

## قوالب البريد الإلكتروني (Email Templates)

### قراءة القوالب

| # | الاسم | الوصف | النتيجة المتوقعة |
|---|-------|-------|-----------------|
| ET-L1 | قراءة الكل | GET /email-templates | 200 + جميع القوالب |
| ET-L2 | قالب بـ slug | GET /email-templates/:slug | 200 + القالب |
| ET-L3 | slug وهمي | slug غير موجود | 404 NOT_FOUND |

### تعديل قالب

| # | الاسم | الوصف | النتيجة المتوقعة |
|---|-------|-------|-----------------|
| ET-U1 | تعديل العنوان | subjectAr + subjectEn جديدان | 200 + محدّث |
| ET-U2 | تعديل المحتوى | bodyAr + bodyEn جديدان | 200 + محدّث |
| ET-U3 | تعطيل القالب | `isActive: false` | 200 + لا يُرسَل |
| ET-U4 | body طويلة | أكثر من 10000 حرف | 400 VALIDATION_ERROR |
| ET-U5 | subject طويل | أكثر من 500 حرف | 400 VALIDATION_ERROR |
| ET-U6 | ID وهمي | UUID غير موجود | 404 NOT_FOUND |

### معاينة قالب

| # | الاسم | الوصف | النتيجة المتوقعة |
|---|-------|-------|-----------------|
| ET-P1 | معاينة عربي | POST /email-templates/:slug/preview + `lang: ar` | 200 + HTML عربي |
| ET-P2 | معاينة إنجليزي | `lang: en` | 200 + HTML إنجليزي |
| ET-P3 | مع context ديناميكي | `context: { clientName: "أحمد" }` | 200 + المتغيرات محلولة |
| ET-P4 | lang غير صالح | `lang: "fr"` | 400 VALIDATION_ERROR |
| ET-P5 | slug وهمي | slug غير موجود | 404 NOT_FOUND |
