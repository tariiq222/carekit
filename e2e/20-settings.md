# الإعدادات (Settings)
> يشمل: Whitelabel · ساعات العمل · الإجازات · قوالب البريد

---

## Whitelabel (هوية العيادة)

### قراءة الإعدادات

| # | الاسم | الوصف | النتيجة المتوقعة |
|---|-------|-------|-----------------|
| WL-L1 | الإعدادات العامة | GET /whitelabel/public (بدون auth) | 200 + شعار + اسم + ألوان |
| WL-L2 | كل الإعدادات (admin) | GET /whitelabel/config | 200 + مصفوفة key/value |
| WL-L3 | خريطة الإعدادات | GET /whitelabel/config/map | 200 + `{ key: value }` |
| WL-L4 | إعداد بمفتاح | GET /whitelabel/config/:key | 200 + القيمة |
| WL-L5 | مفتاح غير موجود | GET /whitelabel/config/unknown_key | 404 NOT_FOUND |

### تحديث الإعدادات

| # | الاسم | الوصف | النتيجة المتوقعة |
|---|-------|-------|-----------------|
| WL-U1 | تحديث متعدد | PUT /whitelabel/config + مصفوفة key/value | 200 + محدّثة |
| WL-U2 | تحديث اسم العيادة | `key: "clinic_name", value: "عيادتي"` | 200 + محفوظ |
| WL-U3 | مصفوفة فارغة | configs: [] | 400 VALIDATION_ERROR (min 1) |
| WL-U4 | value طويلة | أكثر من 2000 حرف | 400 VALIDATION_ERROR |
| WL-U5 | key طويل | أكثر من 255 حرف | 400 VALIDATION_ERROR |

### حذف إعداد

| # | الاسم | الوصف | النتيجة المتوقعة |
|---|-------|-------|-----------------|
| WL-D1 | حذف مفتاح | DELETE /whitelabel/config/:key | 200 + محذوف |
| WL-D2 | مفتاح غير موجود | key وهمي | 404 NOT_FOUND |

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
