# الإشعارات (Notifications)

---

## Scenario Audit Summary

- Total scenarios (original): ~18
- Valid: 10
- Fixed: 4
- Removed: 2
- Added: 12
- **Total (final)**: 34

---

## Major Issues Found

- جميع endpoints الإشعارات لا تتطلب صلاحية إضافية — فقط JWT
- PATCH /notifications/read-all يعيد `{ updated: true }` وليس `{ success: true }`
- DELETE /notifications/fcm-token يعيد دائماً `{ deleted: true }` حتى لو لم يُوجَد التوكن (deleteMany لا تُخطئ)
- POST /notifications/fcm-token يُنفِّذ upsert (لا 409) — إذا وُجد التوكن يحدِّث الـ platform
- PATCH /notifications/:id/read: يعيد 403 FORBIDDEN إذا كان الإشعار لمستخدم آخر (بعد التحقق من الوجود)
- الإشعارات مرتبة بـ createdAt DESC
- userId مخفي من استجابة GET /notifications
- سيناريوهات 401 مفقودة كلياً

---

## قراءة الإشعارات

> جميع endpoints تتطلب JWT فقط — لا صلاحية إضافية

| # | الاسم | الوصف | النتيجة المتوقعة |
| --- | --- | --- | --- |
| NT-L1 | قراءة الكل | GET /notifications | 200 + { items, meta } مرتبة بـ createdAt DESC — بدون userId في النتائج |
| NT-L2 | pagination | GET /notifications?page=2&perPage=10 | 200 + الصفحة الثانية |
| NT-L3 | scoped للمستخدم | مستخدم A لا يرى إشعارات مستخدم B | 200 + إشعارات المستخدم الحالي فقط |
| NT-L4 | عدد غير المقروءة | GET /notifications/unread-count | 200 + { count: number } |
| NT-L5 | بدون مصادقة | GET /notifications بدون token | 401 Unauthorized |

---

## تحديث حالة القراءة

| # | الاسم | الوصف | النتيجة المتوقعة |
| --- | --- | --- | --- |
| NT-R1 | تحديد واحد كمقروء | PATCH /notifications/:id/read | 200 + إشعار مع isRead=true + readAt محدَّث |
| NT-R2 | تحديد الكل كمقروء | PATCH /notifications/read-all | 200 + { updated: true } |
| NT-R3 | إشعار غير موجود | PATCH /notifications/:uuid-غير-موجود/read | 404 NOT_FOUND |
| NT-R4 | إشعار لمستخدم آخر | id لإشعار يخص مستخدماً آخر | 403 FORBIDDEN |
| NT-R5 | بدون مصادقة | PATCH /notifications/:id/read بدون token | 401 Unauthorized |

---

## تسجيل توكن FCM

> Endpoint: `POST /notifications/fcm-token` — JWT فقط
> يُنفِّذ upsert — إذا وُجد التوكن يحدِّث platform (لا يُعيد 409)

| # | الاسم | الوصف | النتيجة المتوقعة |
| --- | --- | --- | --- |
| NT-FCM1 | تسجيل iOS | token + platform="ios" | 200 + { id, userId, token, platform:"ios" } |
| NT-FCM2 | تسجيل Android | platform="android" | 200 + platform="android" |
| NT-FCM3 | تسجيل مكرر (upsert) | نفس token مرة ثانية بـ platform مختلف | 200 + platform محدَّث (upsert وليس 409) |
| NT-FCM4 | platform خاطئ | platform="web" | 400 VALIDATION_ERROR |
| NT-FCM5 | بدون token | حقل إلزامي | 400 VALIDATION_ERROR |
| NT-FCM6 | بدون platform | حقل إلزامي | 400 VALIDATION_ERROR |
| NT-FCM7 | بدون مصادقة | POST /notifications/fcm-token بدون token | 401 Unauthorized |

---

## إلغاء تسجيل توكن FCM

> Endpoint: `DELETE /notifications/fcm-token` — JWT فقط
> يعيد `{ deleted: true }` دائماً — حتى لو لم يُوجَد التوكن

| # | الاسم | الوصف | النتيجة المتوقعة |
| --- | --- | --- | --- |
| NT-UFM1 | إلغاء تسجيل ناجح | body: { token: "..." } | 200 + { deleted: true } |
| NT-UFM2 | توكن غير موجود | token غير مسجَّل | 200 + { deleted: true } (deleteMany لا تُخطئ) |
| NT-UFM3 | بدون token | حقل إلزامي | 400 VALIDATION_ERROR |
| NT-UFM4 | بدون مصادقة | DELETE /notifications/fcm-token بدون token | 401 Unauthorized |

---

## ملاحظات تقنية

- **إنشاء الإشعارات**: داخلي فقط — غير مُعرَّض كـ endpoint
- **Push FCM**: fire-and-forget — الفشل لا يمنع حفظ الإشعار في قاعدة البيانات
- **SMS**: يُرسَل تلقائياً لأنواع محددة: booking_reminder، booking_confirmed، booking_cancelled، cancellation_rejected
- **الأنواع المدعومة**: booking_confirmed | booking_completed | booking_rescheduled | booking_expired | booking_cancelled | cancellation_requested | cancellation_rejected | payment_received | new_rating | booking_reminder | booking_reminder_urgent | waitlist_slot_available | problem_report | system_alert
