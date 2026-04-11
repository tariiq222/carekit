# Booking System — State & Flow Diagrams

> مخططات تدفق الحجز والإلغاء وإعادة الجدولة والدفع.
> للمخطط الهيكلي: [booking-erd.md](booking-erd.md) | للقيود: [booking-constraints.md](booking-constraints.md)

---

## تدفق دورة حياة الحجز (Booking Lifecycle)

```mermaid
stateDiagram-v2
    [*] --> pending : إنشاء حجز جديد

    pending --> confirmed : تأكيد الدفع
    pending --> cancelled : إلغاء مباشر (قبل الدفع)

    confirmed --> completed : انتهاء الموعد
    confirmed --> no_show : المريض لم يحضر
    confirmed --> pending_cancellation : طلب إلغاء من المريض
    confirmed --> cancelled_reschedule : إعادة جدولة (يُلغى + يُنشأ حجز جديد)

    pending --> cancelled_reschedule : إعادة جدولة

    pending_cancellation --> cancelled : الإدارة وافقت على الإلغاء
    pending_cancellation --> confirmed : الإدارة رفضت الإلغاء

    state cancelled_reschedule <<choice>>
    cancelled_reschedule --> cancelled : الحجز القديم
    cancelled_reschedule --> pending : الحجز الجديد (rescheduledFromId)

    completed --> [*]
    no_show --> [*]
    cancelled --> [*]

    note right of pending
        ينتظر الدفع
        يمكن إعادة جدولة
    end note

    note right of confirmed
        الموعد مؤكد
        يمكن إعادة جدولة
    end note

    note right of pending_cancellation
        بانتظار قرار الإدارة
        الإدارة تحدد نوع الاسترداد
    end note

    note right of cancelled
        استرداد كامل / جزئي / بدون
        قد يكون بسبب إعادة جدولة (adminNotes)
    end note
```

---

## تدفق إعادة الجدولة (Reschedule Flow)

```mermaid
sequenceDiagram
    participant P as Client/Admin
    participant S as BookingsService
    participant DB as Database (Transaction)

    P->>S: reschedule(bookingId, {date, startTime})
    S->>DB: Find original booking
    S->>S: Validate availability + no double-booking
    S->>DB: BEGIN TRANSACTION
    DB->>DB: 1. Create new Booking (rescheduledFromId = original.id)
    DB->>DB: 2. Cancel original (status=cancelled, adminNotes=rescheduled)
    DB->>DB: 3. Move Payment to new booking
    DB->>DB: COMMIT
    S->>P: Return new Booking (with rescheduledFrom reference)
```

---

## تدفق الدفع (Payment Flow)

```mermaid
stateDiagram-v2
    [*] --> pending_payment : إنشاء سجل الدفع

    state "اختيار طريقة الدفع" as choice
    pending_payment --> choice

    state "مويسر (Moyasar)" as moyasar {
        [*] --> processing : Mada / Apple Pay / Visa
        processing --> paid : نجاح
        processing --> failed : فشل
    }

    state "تحويل بنكي" as bank {
        [*] --> receipt_uploaded : رفع الإيصال
        receipt_uploaded --> ai_analysis : تحليل AI

        state ai_analysis {
            [*] --> matched : مطابق
            [*] --> amount_differs : المبلغ مختلف
            [*] --> suspicious : مشبوه
            [*] --> old_date : تاريخ قديم
            [*] --> unreadable : غير مقروء
        }

        ai_analysis --> admin_review : مراجعة الإدارة
        admin_review --> approved : موافقة
        admin_review --> rejected : رفض
    }

    choice --> moyasar
    choice --> bank

    paid --> invoice_generated : إنشاء فاتورة (ZATCA)
    approved --> paid
    rejected --> failed

    paid --> refunded : بعد إلغاء الحجز

    note right of refunded
        refundAmount:
        - totalAmount = استرداد كامل
        - less than totalAmount = استرداد جزئي
        - null = بدون استرداد
    end note
```
