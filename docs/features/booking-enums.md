# Booking System — Enums Reference

> **STATUS: Pre-SaaS historical record (2026-03-26).** The values below were the
> original lowercase enum strings used before the SaaS multi-tenancy refactor.
> The **live** Prisma enums are now UPPERCASE and partially renamed — see
> `apps/backend/prisma/schema/bookings.prisma` for the source of truth
> (`BookingStatus.PENDING|CONFIRMED|...`, `BookingType.INDIVIDUAL|WALK_IN|GROUP|ONLINE`,
> `WaitlistStatus.WAITING|PROMOTED|EXPIRED|REMOVED`, plus `CancellationReason`,
> `RecurringFrequency`, `ZoomMeetingStatus`, `GroupSessionStatus`, `RefundType`).
> Kept for narrative/i18n value mapping only — do NOT treat as authoritative.
>
> مرجع لجميع الـ Enums المستخدمة في نظام المواعيد (تاريخي).
> للمخطط الكامل وتدفقات العمل: [booking-erd.md](booking-erd.md)

## BookingType

| القيمة                 | الوصف                                        |
| ---------------------- | -------------------------------------------- |
| `clinic_visit`         | زيارة عيادة — حضوري                          |
| `phone_consultation`   | استشارة هاتفية — الطبيب يتصل خارج المنصة     |
| `video_consultation`   | استشارة مرئية — Zoom auto-generated          |
| `walk_in`              | حضور مباشر بدون حجز مسبق                     |

## BookingStatus

| القيمة                  | الوصف                                              |
| ----------------------- | -------------------------------------------------- |
| `pending`               | بانتظار الدفع                                      |
| `confirmed`             | مؤكد (الدفع تم)                                    |
| `checked_in`            | المريض وصل للعيادة                                 |
| `in_progress`           | الموعد جارٍ حالياً                                 |
| `completed`             | مكتمل                                              |
| `cancelled`             | ملغي (بموافقة الإدارة أو بسبب إعادة جدولة)         |
| `pending_cancellation`  | بانتظار قرار الإدارة                               |
| `no_show`               | المريض لم يحضر                                     |
| `expired`               | انتهت صلاحيته (لم يُدفع في الوقت المحدد)           |

## WaitlistStatus

| القيمة      | الوصف                              |
| ----------- | ---------------------------------- |
| `waiting`   | في قائمة الانتظار                  |
| `notified`  | أُشعر بتوفر موعد                   |
| `booked`    | حجز موعد من القائمة                |
| `expired`   | انتهت الصلاحية                     |
| `cancelled` | ألغى المريض طلب الانتظار           |

## PaymentMethod

| القيمة            | الوصف                                        |
| ----------------- | -------------------------------------------- |
| `moyasar`         | دفع إلكتروني (Mada, Apple Pay, Visa/MC)     |
| `bank_transfer`   | تحويل بنكي + إيصال + تحقق AI                |

## PaymentStatus

| القيمة      | الوصف                             |
| ----------- | --------------------------------- |
| `pending`   | بانتظار الدفع                     |
| `awaiting`  | بانتظار تأكيد (تحويل بنكي)        |
| `paid`      | مدفوع                             |
| `refunded`  | مسترد (كامل أو جزئي)             |
| `failed`    | فشل                               |

## TransferVerificationStatus

| القيمة            | الوصف                       |
| ----------------- | --------------------------- |
| `pending`         | بانتظار تحليل AI            |
| `matched`         | مطابق للمبلغ المطلوب        |
| `amount_differs`  | المبلغ مختلف                |
| `suspicious`      | مشبوه                       |
| `old_date`        | تاريخ قديم                  |
| `unreadable`      | غير مقروء                   |
| `approved`        | موافقة يدوية من الإدارة     |
| `rejected`        | رفض يدوي من الإدارة         |

## NotificationType

| القيمة                        | الوصف                         |
| ----------------------------- | ----------------------------- |
| `booking_confirmed`           | تأكيد موعد                    |
| `booking_completed`           | اكتمال موعد                   |
| `booking_cancelled`           | إلغاء موعد                    |
| `booking_reminder`            | تذكير بموعد قادم              |
| `reminder`                    | تذكير عام                     |
| `payment_received`            | استلام دفعة                   |
| `payment_failed`              | فشل الدفع                     |
| `bank_transfer_approved`      | موافقة على تحويل بنكي         |
| `bank_transfer_rejected`      | رفض تحويل بنكي                |
| `cancellation_request`        | طلب إلغاء جديد (للإدارة)      |
| `cancellation_rejected`       | رفض الإلغاء (للمريض)          |
| `new_rating`                  | تقييم جديد                    |
| `problem_report`              | بلاغ مشكلة                    |

## KbFileStatus

| القيمة        | الوصف                              |
| ------------- | ---------------------------------- |
| `pending`     | بانتظار المعالجة                   |
| `processing`  | قيد المعالجة وإنشاء الـ embeddings |
| `processed`   | مُعالج وجاهز للاستخدام             |
| `failed`      | فشل المعالجة                       |

## SessionLanguage

| القيمة  | الوصف   |
| ------- | ------- |
| `ar`    | عربي    |
| `en`    | إنجليزي |

## DevicePlatform

| القيمة    | الوصف   |
| --------- | ------- |
| `ios`     | iOS     |
| `android` | Android |
| `web`     | ويب     |

## ProblemReportType

| القيمة              | الوصف                        |
| ------------------- | ---------------------------- |
| `no_call`           | الطبيب لم يتصل/ينضم         |
| `late`              | تأخر الطبيب                  |
| `technical`         | مشاكل تقنية                  |
| `wrong_diagnosis`   | تشخيص خاطئ                   |
| `unprofessional`    | سلوك غير مهني                |
| `billing_issue`     | مشكلة في الفاتورة             |
| `other`             | أخرى                         |

## ZatcaStatus

| القيمة            | الوصف                   |
| ----------------- | ----------------------- |
| `not_applicable`  | غير منطبق              |
| `pending`         | بانتظار الإبلاغ        |
| `reported`        | تم الإبلاغ لـ ZATCA    |
| `failed`          | فشل الإبلاغ            |

## ProblemReportStatus

| القيمة       | الوصف              |
| ------------ | ------------------ |
| `open`       | مفتوح — لم يُراجع |
| `reviewing`  | قيد المراجعة       |
| `resolved`   | تم الحل            |

## UserGender

| القيمة   | الوصف |
| -------- | ----- |
| `male`   | ذكر   |
| `female` | أنثى  |
