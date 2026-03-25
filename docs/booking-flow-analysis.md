# CareKit — Booking Flow Analysis v2 (Post-Fixes)

> **تاريخ التحليل الأول:** 2026-03-24
> **تاريخ المراجعة:** 2026-03-24 (بعد التعديلات)
> **الملف المرجعي:** `carekit-booking-flow.drawio` (v2)

---

## أولاً: ملخص الفلو

الفلو يتكون من 7 أقسام (كانت 5، أُضيف قسمان):

1. **إنشاء الحجز** — اختيار الخدمة والممارس والنوع والوقت + Serializable Isolation
2. **الدفع** — Moyasar أو تحويل بنكي مع تحقق AI
3. **دورة حياة الحجز** — confirmed → checked_in → in_progress → completed
4. **الإلغاء والاسترجاع** — من المريض أو الإدارة أو الممارس
5. **إعادة الجدولة** — تغيير الموعد مع الضوابط
6. **الأتمتة (Cron Jobs)** — ✅ جديد: 8 وظائف مجدولة
7. **Audit Trail (StatusLog)** — ✅ جديد: تسجيل كل تغيير حالة

### حالات الحجز (9 حالات):
`pending` → `confirmed` → `checked_in` → `in_progress` → `completed`
مع فروع: `pending_cancellation` → `cancelled` | `no_show` | `expired`

---

## ثانياً: مراجعة الكسور السابقة — ماذا تم إصلاحه؟

### ✅ كسر 1 — تم الإصلاح: Cron Job لـ `pending` → `expired`

**الإصلاح:** `expirePendingBookings()` — cron كل 5 دقائق
- يتحقق من `paymentTimeoutMinutes`
- Race-condition safe: يعيد فحص الدفعات قبل الإنهاء
- يُخطر المريض ويفحص Waitlist
- **التقييم:** ممتاز — حل شامل ومتين

### ✅ كسر 3 — تم الإصلاح: `no_show` + سياسة مالية

**الإصلاح:** `autoNoShow()` — cron كل 10 دقائق + `noShowPolicy` setting
- ثلاث سياسات: `keep_full` | `partial_refund` | `admin_decides`
- `noShowRefundPercent` للاسترجاع الجزئي
- `autoNoShowAfterMinutes` (default 30 دقيقة بعد الموعد)
- يُخطر المريض والممارس + Waitlist
- **التقييم:** ممتاز — حل كامل مع مرونة في السياسة

### ✅ كسر 4 — تم الإصلاح: `in_progress` → `no_show`

**الإصلاح:** `markNoShow()` يقبل الآن `['confirmed', 'in_progress']`
- يحل مشكلة الاستشارات عن بعد (فيديو/هاتف)
- **التقييم:** صحيح ومباشر

### ✅ كسر 7 — تم الإصلاح: `pending_cancellation` timeout

**الإصلاح:** `autoExpirePendingCancellations()` — cron كل ساعة
- `cancellationReviewTimeoutHours` (default 48 ساعة)
- Auto-approve مع full refund (خطأ العيادة في عدم الرد)
- يُخطر المريض
- **التقييم:** جيد — يحمي المريض من الانتظار اللانهائي

### ✅ تحسين 2 — تم التطبيق: Reminder Escalation

**الإصلاح:** 4 cron jobs للتذكيرات:
- 24 ساعة قبل: Push + Email (كل ساعة)
- 2 ساعة قبل: Push (كل 15 دقيقة)
- 1 ساعة قبل: Push (كل 15 دقيقة)
- 15 دقيقة قبل: Push عاجل (كل 5 دقائق)
- **التقييم:** ممتاز — تغطية كاملة ومتدرجة

### ✅ تحسين 3 — تم التطبيق: Auto-complete

**الإصلاح:** `autoCompleteBookings()` — cron كل 15 دقيقة
- `autoCompleteAfterHours` (default 2 ساعة بعد الموعد)
- يعالج confirmed/in_progress/checked_in
- **التقييم:** ممتاز — يمنع الحجوزات المعلقة

### ✅ تحسين 6 — تم التطبيق: BookingStatusLog (Audit Trail)

**الإصلاح:** `BookingStatusLogService` + model جديد
- يسجل: `fromStatus`, `toStatus`, `changedBy`, `reason`, `createdAt`
- مربوط بكل transition في `BookingStatusService`
- Indexes على `bookingId` و `createdAt`
- **التقييم:** ممتاز — audit trail كامل ومستقل عن ActivityLog

---

## ثالثاً: ما بقي مفتوحاً 🟡

### 🟡 مشكلة 1: Payment `failed` — لا يوجد retry واضح

**الحالة:** لم يُعالج — `PaymentsService` لم يتغير (230 سطر)
**المشكلة:** عند فشل Moyasar webhook، الـ Payment = `failed` والـ Booking = `pending`. المريض لا يملك مسار واضح لإعادة الدفع.
**الأثر:** المريض يحتاج يلغي ويحجز من جديد — تجربة سيئة.
**الحل المقترح:** إضافة `retryPayment()` endpoint:
- يتحقق أن الـ Booking لا يزال `pending`
- ينشئ Payment جديد لنفس الـ Booking
- يربطه بـ Moyasar link جديد

**الأولوية:** 🟡 متوسط — الـ Cron سيحول الحجز لـ `expired` بعد المهلة، لكن المريض يخسر الـ slot

### 🟡 مشكلة 2: Bank Transfer `rejected` — إشعار بدون إجراء

**الحالة:** لم يُعالج بالكامل
**المشكلة:** عند رفض الإيصال، الـ Booking يبقى `pending` بدون توجيه واضح للمريض.
**الأثر:** المريض قد لا يعلم أن إيصاله رُفض → الحجز يتحول لـ `expired` لاحقاً.
**الحل المقترح:**
- إشعار فوري للمريض بالرفض + السبب
- زر "رفع إيصال جديد" في التطبيق
- أو خيار التحول لـ Moyasar

**الأولوية:** 🟡 متوسط — `expirePendingBookings` يعمل كشبكة أمان لكن التجربة ليست مثالية

### 🟡 مشكلة 3: `booking-automation.service.ts` = 351 سطر

**الحالة:** يتجاوز الحد بسطر واحد (قاعدة 350 سطر)
**الحل:** تقسيم لملفين: `booking-expiry.service.ts` + `booking-auto-actions.service.ts`

**الأولوية:** 🟢 بسيط — مخالفة طفيفة

---

## رابعاً: نقاط قوة جديدة (بعد التعديلات) ✅

التحسينات أضافت طبقات حماية مهمة. إليك القائمة الكاملة:

1. **State Machine محمي بـ guard clauses** — كل transition يتحقق من الحالة
2. **Serializable Isolation** — حماية من race conditions عند الحجز
3. **Double Booking Protection** — فحص التوفر قبل الإنشاء
4. **فصل مسارات الدفع** — Moyasar webhook + Bank Transfer AI + Admin
5. **AI Tags (5 تصنيفات)** — human-in-the-loop دائماً
6. **3 مسارات إلغاء** — مريض/إدارة/ممارس بقواعد مختلفة
7. **cancelledBy tracking** — يُسجل من ألغى (patient/practitioner/admin/system)
8. **suggestedRefundType** — حساب تلقائي لنوع الاسترجاع المقترح
9. **Waitlist Integration** — عند الإلغاء/expired/no_show
10. **Walk-in مدعوم** — يتجاوز الدفع مباشرة
11. **Activity Logging** — عام لكل العمليات
12. **BookingStatusLog** — ✅ جديد: audit trail مخصص لتغييرات الحالة
13. **8 Cron Jobs** — ✅ جديد: أتمتة شاملة
14. **4 Reminder Levels** — ✅ جديد: 24h/2h/1h/15min
15. **Auto-expire pending** — ✅ جديد: تحرير المواعيد تلقائياً
16. **Auto No-Show + Policy** — ✅ جديد: 3 سياسات مالية
17. **Auto-complete** — ✅ جديد: إنهاء الحجوزات المنتهية
18. **Cancel timeout** — ✅ جديد: حماية المريض من انتظار لانهائي
19. **Bot لا ينفذ الإلغاء** — يرسل طلب فقط
20. **Practitioner Cancel = Full Refund** — قاعدة عادلة

---

## خامساً: جدول التقييم المحدث

| # | المشكلة | الحالة | الخطورة | ملاحظات |
|---|---------|--------|---------|---------|
| 1 | Cron Job لـ expired | ✅ تم | — | expirePendingBookings كل 5 دقائق |
| 2 | checked_in لا يُلغى من المريض | ✅ مقبول | 🟢 | adminDirectCancel يعمل |
| 3 | no_show بدون سياسة مالية | ✅ تم | — | noShowPolicy + autoNoShow |
| 4 | in_progress → no_show | ✅ تم | — | markNoShow يقبل الحالتين |
| 5 | Payment failed بدون retry | 🟡 مفتوح | متوسط | يحتاج retryPayment endpoint |
| 6 | Bank transfer rejected | 🟡 مفتوح | متوسط | يحتاج إشعار + retry receipt |
| 7 | pending_cancellation timeout | ✅ تم | — | autoExpirePendingCancellations |

### تحسينات مقترحة سابقاً:

| # | التحسين | الحالة |
|---|---------|--------|
| 1 | Waitlist عند expired/no_show | ✅ تم |
| 2 | Reminder Escalation | ✅ تم — 4 مستويات |
| 3 | Auto-complete | ✅ تم |
| 4 | Partial Check-in للاستشارات عن بعد | 🟡 مفتوح — مستقبلي |
| 5 | Grace Period للـ No-Show | ✅ تم — autoNoShowAfterMinutes |
| 6 | BookingStatusLog | ✅ تم |
| 7 | Multi-service Booking | 🟡 مفتوح — مستقبلي |

---

## سادساً: Cron Jobs Summary

| الوظيفة | التكرار | المهمة |
|---------|---------|--------|
| `expire-pending-bookings` | كل 5 دقائق | تحويل الحجوزات بدون دفع لـ expired |
| `auto-no-show` | كل 10 دقائق | وسم عدم الحضور + سياسة مالية |
| `auto-complete-bookings` | كل 15 دقائق | إنهاء الحجوزات المنتهية |
| `expire-pending-cancellations` | كل ساعة | حل طلبات الإلغاء المعلقة |
| `reminder-24h` | كل ساعة | تذكير قبل 24 ساعة |
| `reminder-2h` | كل 15 دقيقة | تذكير قبل ساعتين |
| `reminder-1h` | كل 15 دقيقة | تذكير قبل ساعة |
| `reminder-15min` | كل 5 دقائق | تذكير عاجل قبل 15 دقيقة |

---

## الخلاصة

**الفلو أصبح متين وشامل بعد التعديلات.** من 7 مشاكل مكتشفة في التحليل الأول، تم حل 5 بالكامل وبقيت مشكلتان بسيطتان:

- ✅ **5/7 كسور أُصلحت** — Cron Jobs, No-Show Policy, StatusLog, Cancel Timeout, in_progress→no_show
- ✅ **5/7 تحسينات طُبقت** — Reminders, Auto-complete, Waitlist, Grace Period, Audit Trail
- 🟡 **2 مشاكل متبقية** — Payment retry + Bank transfer rejection notification (أولوية متوسطة)

**التقييم العام: 9/10** — فلو ناضج وجاهز للإنتاج مع حماية متعددة الطبقات.
