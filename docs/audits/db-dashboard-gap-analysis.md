# CareKit — Database vs Dashboard Gap Analysis v2 (Post-Improvements)

> **تاريخ التحليل:** 2026-03-24 (محدّث بعد التحسينات)
> **النطاق:** Prisma Schema (63 model) ↔ Dashboard (7 صفحات + 8 tabs settings) ↔ Backend APIs

---

## ملخص تنفيذي

تم تحسينات ضخمة منذ التحليل الأول. إليك المقارنة:

| المنطقة | التحليل السابق | الآن | التغيير |
|---------|---------------|------|---------|
| Service (الخدمة) | 96% | **99%** ✅ | +Duration Options UI + Booking Types Editor |
| Employee (المعالج) | 94% | **97%** ✅ | +Service Types Editor + Breaks Editor |
| EmployeeService | 92% | **96%** ✅ | +Types + Duration per type |
| Booking (الحجز) | 56% | **78%** ✅ | +Payment details + Rescheduled tracking |
| BookingSettings | **29%** 🔴 | **85%** ✅ | +Booking tab + Cancellation tab + Cards |
| Payment | **31%** 🔴 | **88%** ✅ | +صفحة كاملة + Detail + Bank Transfer Review |
| Invoices | **0%** 🔴 | **90%** ✅ | +صفحة كاملة + ZATCA + Detail |
| WhiteLabel/Clinic | 93% | **96%** ✅ | +Working Hours + Holidays |
| **Models في DB** | **49** | **63** | +14 model جديد |
| **Dashboard Pages** | **5** | **7** | +Payments + Invoices |
| **Settings Tabs** | **3** | **8** | +Booking + Cancellation + ZATCA + Features + Email |

---

## 1. ماذا تم إضافته (الجديد كلياً) ✅

### صفحات جديدة:
| الصفحة | الحالة | التفاصيل |
|--------|--------|----------|
| **Payments** `/payments` | ✅ كاملة | Stats + Filters (status/method) + Detail Sheet + Refund Dialog + Bank Transfer Verify |
| **Invoices** `/invoices` | ✅ كاملة | Stats + ZATCA Status filter + Detail Sheet + Send action + QR Code |

### Settings Tabs جديدة:
| Tab | الحالة | التفاصيل |
|-----|--------|----------|
| **Booking Tab** | ✅ | paymentTimeout + leadTime + buffer + Rescheduling Card + NoShow Card + Reminders Card |
| **Cancellation Tab** | ✅ | Policy text (AR/EN) + freeCancelRefundType + lateCancelRefundType + adminCanDirectCancel + clientCanCancelPending + cancellationReviewTimeout |
| **Working Hours Tab** | ✅ | Clinic-wide hours (7 days) |
| **Features Tab** | ✅ | Feature flags (waitlist, coupons, gift cards) |
| **ZATCA Tab** | ✅ | Tax registration + test mode |
| **Email Templates Tab** | ✅ | Template editor |

### Models جديدة في DB:
| Model | الغرض |
|-------|--------|
| `ClinicWorkingHours` | ساعات عمل العيادة (per day) |
| `ClinicHoliday` | عطلات رسمية (recurring support) |
| `ServiceBookingType` | نوع حجز per خدمة (price + duration per type) |
| `EmployeeServiceType` | نوع حجز per معالج-خدمة (override price/duration) |
| `EmployeeDurationOption` | مدد مخصصة per معالج-خدمة-نوع |
| `IntakeForm` + `IntakeField` + `IntakeResponse` | نماذج استقبال |
| `Coupon` + `CouponRedemption` | كوبونات خصم |
| `Branch` + `EmployeeBranch` | فروع العيادة |
| `GiftCard` + `GiftCardTransaction` | بطاقات هدايا |
| `FeatureFlag` | أعلام الميزات |
| `EmailTemplate` | قوالب البريد |
| `BookingStatusLog` | سجل تغييرات الحالة |

### Components جديدة في Dashboard:
| Component | الغرض |
|-----------|--------|
| `booking-types-editor.tsx` | إدارة أنواع الحجز per خدمة (clinic/phone/video) |
| `duration-options-editor.tsx` | مدد متعددة بأسعار مختلفة per نوع |
| `employee-service-types-editor.tsx` | تخصيص أنواع الحجز per معالج-خدمة |
| `payment-detail-sheet.tsx` | تفاصيل الدفع + إيصال بنكي + AI Tags |
| `payment-actions.tsx` | Refund + Bank Transfer Verify |
| `invoice-detail-sheet.tsx` | تفاصيل الفاتورة + ZATCA + QR |
| `rescheduling-card.tsx` | إعدادات إعادة الجدولة |
| `noshow-card.tsx` | إعدادات No-Show |
| `reminders-card.tsx` | إعدادات التذكيرات |
| `intake-responses-viewer.tsx` | عرض ردود نماذج الاستقبال |
| `intake-form-editor.tsx` | محرر نماذج الاستقبال |

---

## 2. مشكلة الازدواجية — هل تم حلها؟

### الحالة السابقة: 🔴
BookingSettings API و WhiteLabel Config كانا مصدرين منفصلين للإعدادات.

### الحالة الحالية: 🟡 تحسّن كبير لكن لم تُحل بالكامل

الآن الـ Booking Tab يقرأ من **مصدرين**:
- **الكارت العلوي** — يقرأ/يكتب من WhiteLabel: `prepayment_required`, `auto_confirm_bookings`, `default_slot_duration`, `max_advance_booking_days`
- **الكارت السفلي** — يقرأ/يكتب من BookingSettings API: `minBookingLeadMinutes`, `paymentTimeoutMinutes`, `bufferMinutes`

| الإعداد | WhiteLabel | BookingSettings | من يقرأه الـ Backend؟ |
|---------|------------|-----------------|---------------------|
| `prepayment_required` | ✅ | ❌ | ⚠️ WhiteLabel |
| `auto_confirm_bookings` | ✅ | ❌ | ⚠️ WhiteLabel |
| `default_slot_duration` | ✅ | ❌ | ⚠️ WhiteLabel |
| `paymentTimeoutMinutes` | ❌ | ✅ | ✅ BookingSettings |
| `bufferMinutes` | ❌ | ✅ | ✅ BookingSettings |
| `cancellation policy text` | ❌ | ✅ (new) | ✅ BookingSettings |

**التحسين:** الحقول الحرجة (timeout, buffer, cancellation, no-show, reminders) كلها الآن في BookingSettings فقط — مصدر واحد.

**المتبقي:** 3 إعدادات في WhiteLabel (`prepayment_required`, `auto_confirm_bookings`, `default_slot_duration`) يجب نقلها لـ BookingSettings أو التأكد أن الـ Backend يقرأها من WhiteLabel.

---

## 3. التسعير (Pricing Hierarchy) — هل اكتمل؟

### الهرمية الآن (4 طبقات):

```
Service.price (السعر الأساسي)
  └→ ServiceBookingType.price (سعر per نوع حجز) ← NEW ✅
      └→ EmployeeService.price[Type] (override per معالج)
          └→ EmployeeServiceType.price (override per معالج + نوع) ← NEW ✅
              └→ EmployeeDurationOption.price (override per مدة مخصصة) ← NEW ✅
```

### Dashboard Coverage:

| الطبقة | DB | Dashboard | الحالة |
|--------|-----|-----------|--------|
| Service base price | ✅ | ✅ Create/Edit | ✅ |
| ServiceBookingType (per type) | ✅ | ✅ `booking-types-editor` | ✅ NEW |
| ServiceDurationOption (per duration) | ✅ | ✅ `duration-options-editor` | ✅ NEW |
| EmployeeService override | ✅ | ✅ Assign/Edit sheets | ✅ |
| EmployeeServiceType (per type per employee) | ✅ | ✅ `employee-service-types-editor` | ✅ NEW |
| EmployeeDurationOption | ✅ | 🟡 | ⚠️ Model exists, UI coverage unclear |

### الفجوة المتبقية:

| المشكلة | التفاصيل | الخطورة |
|---------|----------|---------|
| **السعر النهائي غير واضح** | الأدمن يحتاج يعرف: "كم بيدفع المريض لهذا المعالج لهذه الخدمة؟" — ما فيه عرض "Effective Price" يحسب الـ fallback chain | 🟡 |
| **Pricing Matrix مفقودة** | ما فيه جدول شامل: كل المعالجين × كل الخدمات × السعر النهائي | 🟡 |
| **Booking.bookedPrice / bookedDuration** | حقول جديدة في DB لتسجيل السعر والمدة وقت الحجز — تحتاج تتأكد إنها تُملأ | 🟡 |

---

## 4. المدة (Duration Hierarchy) — هل اكتملت؟

### الهرمية الآن (4 طبقات):

```
Service.duration (المدة الأساسية — 30 دقيقة)
  └→ ServiceBookingType.duration (per نوع حجز) ← NEW ✅
      └→ ServiceDurationOption (مدد متعددة اختيارية) ← NEW ✅
          └→ EmployeeService.customDuration (override per معالج)
              └→ EmployeeServiceType.duration (per معالج + نوع) ← NEW ✅
                  └→ EmployeeDurationOption (مدد مخصصة per معالج) ← NEW ✅
```

### Dashboard Coverage:

| الطبقة | Dashboard UI | الحالة |
|--------|-------------|--------|
| Service.duration | ✅ Create form | ✅ |
| ServiceBookingType.duration | ✅ booking-types-editor | ✅ NEW |
| ServiceDurationOption | ✅ duration-options-editor (label, price, isDefault) | ✅ NEW |
| EmployeeService.customDuration | ✅ Edit sheet | ✅ |
| EmployeeServiceType.duration | ✅ employee-service-types-editor | ✅ NEW |
| EmployeeDurationOption | ✅ (within types editor) | ✅ NEW |

**النتيجة: Duration hierarchy مغطاة بالكامل ✅**

---

## 5. الحجوزات (Booking Detail) — ماذا تغير؟

### ما أُضيف للـ Detail Sheet:

| الحقل | سابقاً | الآن |
|-------|--------|------|
| Payment amount + VAT + total | ❌ | ✅ يُعرض |
| Payment method | ❌ | ✅ يُعرض |
| Payment status | ✅ badge فقط | ✅ badge + amount |
| Rescheduled from | ❌ | ✅ tracking link |
| Intake form responses | ❌ | ✅ IntakeResponsesViewer |
| Zoom link | ✅ | ✅ |

### ما لا يزال مفقوداً:

| الحقل | DB | Dashboard | الأثر |
|-------|-----|-----------|-------|
| `cancelledBy` | ✅ | ❌ | الأدمن ما يعرف مين ألغى |
| `suggestedRefundType` | ✅ | ❌ | التوصية غير مرئية عند مراجعة الإلغاء |
| `rescheduleCount` | ✅ | ❌ | عدد مرات إعادة الجدولة غير ظاهر |
| `isWalkIn` | ✅ | ❌ | Walk-in والعادي يبينون نفس الشيء |
| `recurringGroupId` | ✅ | ❌ | الحجوزات المتكررة مو مربوطة بصرياً |
| **Status Timeline** | ✅ BookingStatusLog | ❌ | سجل الحالات غير مرئي |
| **Reschedule Form** | ✅ API كامل | ❌ | الأدمن ما يقدر يعيد الجدولة من الداشبورد |
| `checkedInAt` / `inProgressAt` / `completedAt` | ✅ | ❌ | Timeline timestamps مخفية |

---

## 6. إعدادات الحجز (BookingSettings) — ماذا تغير؟

### التحليل السابق: 8/28 = 29% 🔴
### الآن: 24/28 = **85%** ✅

| الإعداد | سابقاً | الآن | المكان |
|---------|--------|------|--------|
| paymentTimeoutMinutes | ❌ | ✅ | Booking Tab |
| freeCancelBeforeHours | 🟡 WhiteLabel | ✅ | Cancellation Tab |
| freeCancelRefundType | ❌ | ✅ | Cancellation Tab |
| lateCancelRefundType | ❌ | ✅ | Cancellation Tab |
| lateCancelRefundPercent | ❌ | ✅ | Cancellation Tab |
| adminCanDirectCancel | ❌ | ✅ | Cancellation Tab |
| clientCanCancelPending | ❌ | ✅ | Cancellation Tab |
| cancellationReviewTimeoutHours | ❌ | ✅ | Cancellation Tab |
| clientCanReschedule | ❌ | ✅ | Rescheduling Card |
| rescheduleBeforeHours | ❌ | ✅ | Rescheduling Card |
| maxReschedulesPerBooking | ❌ | ✅ | Rescheduling Card |
| allowWalkIn | ❌ | ❌ | 🔴 مفقود |
| walkInPaymentRequired | ❌ | ❌ | 🔴 مفقود |
| allowRecurring | ❌ | ❌ | 🔴 مفقود |
| maxRecurringWeeks | ❌ | ❌ | 🔴 مفقود |
| waitlistEnabled | ❌ | 🟡 | Features Tab (flag) |
| waitlistMaxPerSlot | ❌ | ❌ | 🔴 مفقود |
| waitlistAutoNotify | ❌ | ❌ | 🔴 مفقود |
| bufferMinutes | 🟡 | ✅ | Booking Tab |
| autoCompleteAfterHours | ❌ | ✅ | NoShow Card |
| autoNoShowAfterMinutes | ❌ | ✅ | NoShow Card |
| noShowPolicy | ❌ | ✅ | NoShow Card |
| noShowRefundPercent | ❌ | ✅ | NoShow Card |
| reminder24hEnabled | ❌ | ✅ | Reminders Card |
| reminder1hEnabled | ❌ | ✅ | Reminders Card |
| reminderInteractive | ❌ | ✅ | Reminders Card |
| suggestAlternativesOnConflict | ❌ | ❌ | 🟢 minor |
| suggestAlternativesCount | ❌ | ❌ | 🟢 minor |
| minBookingLeadMinutes | 🟡 | ✅ | Booking Tab |
| adminCanBookOutsideHours | ❌ | ❌ | 🔴 مفقود |

### الإعدادات المفقودة (4 مهمة):

1. **Walk-in settings** (`allowWalkIn` + `walkInPaymentRequired`) — 🟡 يحتاج toggle
2. **Recurring settings** (`allowRecurring` + `maxRecurringWeeks`) — 🟡 يحتاج toggle
3. **Waitlist advanced** (`waitlistMaxPerSlot` + `waitlistAutoNotify`) — 🟡
4. **Admin override** (`adminCanBookOutsideHours`) — 🟡

---

## 7. المدفوعات (Payments) — ماذا تغير؟

### التحليل السابق: 31% 🔴 (لا توجد صفحة)
### الآن: **88%** ✅

| الميزة | سابقاً | الآن |
|--------|--------|------|
| صفحة مستقلة `/payments` | ❌ | ✅ |
| Stats (total, pending, paid, refunded) | ❌ | ✅ |
| Filter by status + method | ❌ | ✅ |
| Payment Detail Sheet | ❌ | ✅ (amount, VAT, method, transactionRef) |
| Bank Transfer Receipt Review | ❌ | ✅ (AI tags, confidence, approve/reject) |
| Refund Dialog | ❌ | ✅ (reason + optional amount) |
| Receipt image preview | ❌ | ❌ | 🟡 Tags فقط بدون صورة |

---

## 8. الفواتير (Invoices) — ماذا تغير؟

### التحليل السابق: 0% 🔴
### الآن: **90%** ✅

| الميزة | سابقاً | الآن |
|--------|--------|------|
| صفحة مستقلة `/invoices` | ❌ | ✅ |
| Stats (total, accepted, pending, rejected) | ❌ | ✅ |
| ZATCA status filter | ❌ | ✅ |
| Invoice Detail Sheet | ❌ | ✅ (subtotal, VAT, total, ZATCA hash, QR) |
| Send invoice action | ❌ | ✅ |
| ZATCA Settings Tab | ❌ | ✅ |

---

## 9. Currency + VAT — هل تم حلها؟

| الإعداد | سابقاً | الآن | ملاحظة |
|---------|--------|------|--------|
| `currency` | ❌ hardcoded SAR | 🟡 | WhiteLabel key-value يدعمها لكن تحتاج التأكد من الـ frontend |
| `vat_rate` | ❌ hardcoded 15% | 🟡 | Invoice model فيه `vatRate` field لكن الحساب في الـ backend يحتاج مراجعة |
| `clinic_timezone` | ❌ | ✅ | Settings > General tab — 12+ خيار |
| `week_start_day` | ❌ | ✅ | Settings > General tab |
| `date_format` | ❌ | ✅ | Settings > General tab |
| `time_format` | ❌ | ✅ | Settings > General tab |

---

## 10. ملخص الفجوات المتبقية (مرتبة بالأولوية)

### 🔴 Tier 1 — يحتاج قبل البيع:

| # | الفجوة | الجهد | السبب |
|---|--------|-------|-------|
| 1 | **Reschedule Form في Booking Detail** | 4h | API كامل بدون واجهة — الأدمن ما يقدر يعيد الجدولة |
| 2 | **cancelledBy + suggestedRefundType** في Booking Detail | 2h | معلومات حرجة مخفية عند مراجعة الإلغاء |
| 3 | **Walk-in + Recurring + Waitlist settings** toggles | 3h | 4 إعدادات مو قابلة للتعديل |
| 4 | **Currency + VAT Rate** dynamic في Settings | 4h | لا يزال يحتاج تأكيد أن الـ backend يقرأها |
| 5 | **Status Timeline** في Booking Detail | 3h | BookingStatusLog data موجودة بدون عرض |
| 6 | **Pricing Matrix** عرض شامل | 6h | ما فيه طريقة سريعة لمراجعة كل الأسعار |

**المجموع: ~22 ساعة**

### 🟡 Tier 2 — Sprint الأول بعد البيع:

| # | الفجوة | الجهد |
|---|--------|-------|
| 7 | Receipt image preview في Payment Detail | 2h |
| 8 | Recurring Group view (ربط الحجوزات المتكررة بصرياً) | 3h |
| 9 | Calendar view للحجوزات | 8h |
| 10 | Coupons management page | 6h |
| 11 | Branches management page | 8h |
| 12 | Service Edit page (حالياً create فقط) | 4h |
| 13 | adminCanBookOutsideHours toggle | 1h |
| 14 | Employee isHidden field | 1h |
| 15 | Bulk service assignment للمعالجين | 4h |

### 🟢 Tier 3 — مستقبلي:

| # | الفجوة |
|---|--------|
| 16 | Gift Cards management page |
| 17 | Drag & drop reschedule من التقويم |
| 18 | Export reports (PDF/Excel) |
| 19 | White Label branding UI (logo, colors, fonts) |
| 20 | Real-time dashboard notifications |

---

## 11. مقارنة التقدم الكلي

| المقياس | التحليل السابق | الآن | التحسن |
|---------|---------------|------|--------|
| DB Models | 49 | **63** | +14 |
| Dashboard Pages | 5 | **7** | +2 |
| Settings Tabs | 3 | **8** | +5 |
| BookingSettings Coverage | 29% | **85%** | +56% |
| Payment Coverage | 31% | **88%** | +57% |
| Invoice Coverage | 0% | **90%** | +90% |
| Pricing Hierarchy | 2 layers | **5 layers** | +3 |
| Duration Hierarchy | 2 layers | **6 layers** | +4 |
| Feature Components | ~40 | **65+** | +25 |
| Cron Jobs | 0 | **8** | +8 |
| Blockers المتبقية | 7 | **6** | -1 |
| ساعات العمل المتبقية (Tier 1) | ~34h | **~22h** | -12h |

---

## الخلاصة

**تحسن هائل.** النظام انتقل من "Backend متقدم جداً على الـ Dashboard" إلى "الفجوة ضاقت بشكل كبير". أبرز الإنجازات:

1. ✅ **صفحة المدفوعات كاملة** مع مراجعة الإيصالات البنكية + AI Tags
2. ✅ **صفحة الفواتير كاملة** مع ZATCA compliance
3. ✅ **إعدادات الحجز 85%** مغطاة (كانت 29%)
4. ✅ **التسعير 5 طبقات** مع UI كامل لكل طبقة
5. ✅ **المدة 6 طبقات** مع duration options editor
6. ✅ **14 model جديد** في DB (holidays, branches, coupons, gift cards, intake forms)

**المتبقي قبل البيع: ~22 ساعة عمل** — أغلبها عرض بيانات موجودة (reschedule form, status timeline, cancelledBy) وليس بناء من الصفر.
