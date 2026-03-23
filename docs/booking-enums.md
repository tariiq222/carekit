# Booking System — Enums Reference

> مرجع لجميع الـ Enums المستخدمة في نظام المواعيد.
> للمخطط الكامل وتدفقات العمل: [booking-erd.md](booking-erd.md)

## BookingType

| القيمة                 | الوصف                                        |
| ---------------------- | -------------------------------------------- |
| `clinic_visit`         | زيارة عيادة — حضوري                          |
| `phone_consultation`   | استشارة هاتفية — الطبيب يتصل خارج المنصة     |
| `video_consultation`   | استشارة مرئية — Zoom auto-generated          |

## BookingStatus

| القيمة                  | الوصف                                              |
| ----------------------- | -------------------------------------------------- |
| `pending`               | بانتظار الدفع                                      |
| `confirmed`             | مؤكد (الدفع تم)                                    |
| `completed`             | مكتمل                                              |
| `cancelled`             | ملغي (بموافقة الإدارة أو بسبب إعادة جدولة)         |
| `pending_cancellation`  | بانتظار قرار الإدارة                               |
| `no_show`               | المريض لم يحضر                                     |

## PaymentMethod

| القيمة            | الوصف                                        |
| ----------------- | -------------------------------------------- |
| `moyasar`         | دفع إلكتروني (Mada, Apple Pay, Visa/MC)     |
| `bank_transfer`   | تحويل بنكي + إيصال + تحقق AI                |

## PaymentStatus

| القيمة      | الوصف                     |
| ----------- | ------------------------- |
| `pending`   | بانتظار الدفع             |
| `paid`      | مدفوع                     |
| `refunded`  | مسترد (كامل أو جزئي)     |
| `failed`    | فشل                       |

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

| القيمة               | الوصف          |
| -------------------- | -------------- |
| `booking_confirmed`  | تأكيد موعد    |
| `booking_completed`  | اكتمال موعد   |
| `booking_cancelled`  | إلغاء موعد    |
| `reminder`           | تذكير          |
| `payment_received`   | استلام دفعة   |
| `new_rating`         | تقييم جديد     |
| `problem_report`     | بلاغ مشكلة    |

## ProblemReportType

| القيمة       | الوصف                     |
| ------------ | ------------------------- |
| `no_call`    | الطبيب لم يتصل/ينضم      |
| `late`       | تأخر الطبيب               |
| `technical`  | مشاكل تقنية               |
| `other`      | أخرى                      |

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
