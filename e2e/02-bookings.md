# الحجوزات (Bookings)

---

## Scenario Audit Summary

- Total scenarios (original): 71
- Valid: 44
- Fixed: 14
- Removed: 5
- Added: 28
- **Total (final)**: 94

---

## Major Issues Found

- BK-CX1: status name wrong — `cancellation_requested` does not exist; correct is `pending_cancellation`
- BK-C5: wrong response — `payAtClinic=true` is input, not output; actual output is `status=confirmed` + payment.method=cash
- BK-SM1: confirm requires `payment.status=paid`; scenario was missing this precondition — must test PAYMENT_REQUIRED error
- BK-SM3: wrong error — start from `confirmed` (not checked_in) returns `CHECKIN_REQUIRED`, not generic CONFLICT
- BK-SM4: wrong error — complete from `checked_in` (not in_progress) returns `CHECKIN_AND_SESSION_REQUIRED`
- BK-REC7: wrong behavior — recurring is ALL-OR-NOTHING (full transaction); no partial success
- BK-REC3: `monthly` is valid enum value; VALID but note `maxRecurrences` default is 12, so repeatCount: 6 is fine
- BK-RS7: wrong status code — should be `400 INVALID_STATUS_FOR_RESCHEDULE` (already correct), but original said "completed أو ملغى" — actually applies to all non-reschedulable statuses
- BK-CX8: admin-cancel from `in_progress`, `completed`, `cancelled`, etc. returns `409 INVALID_STATUS_FOR_ADMIN_CANCEL` — missing scenario
- BK-SET7: read-only permission requires `whitelabel:edit`, not `bookings:edit` — doc was silent on this
- Walk-in confirmation: walk_in bookings get `status=confirmed` on creation — missing scenario
- payAtClinic: only owner/admin/staff roles can use; patient calling returns 403 — missing scenario
- No-show: only from `confirmed`, not from `checked_in` — missing forbidden transition
- Missing all 401 unauthorized scenarios
- Missing all state machine invalid transition scenarios

---

## إنشاء حجز

| # | الاسم | الوصف | النتيجة المتوقعة |
|---|-------|-------|-----------------|
| BK-C1 | حجز أساسي | POST /bookings — practitionerId + serviceId + type=clinic_visit + date + startTime (مريض مسجّل) | 201 + bookingId + status=pending + payment.status=awaiting |
| BK-C2 | حجز مع ملاحظات | notes بحد أقصى 1000 حرف | 201 + notes محفوظة في الحجز |
| BK-C3 | حجز لمريض آخر (admin) | patientId صريح من المدير | 201 + booking.patientId يساوي patientId المُرسَل |
| BK-C4 | حجز مع فرع | branchId اختياري مع حجز عادي | 201 + booking.branchId محفوظ |
| BK-C5 | payAtClinic — نجاح (admin) | payAtClinic=true من admin أو owner أو staff | 201 + status=confirmed + payment.method=cash + payment.status=paid |
| BK-C6 | payAtClinic — ممنوع (مريض) | مريض يرسل payAtClinic=true | 403 FORBIDDEN |
| BK-C7 | walk_in — نجاح | type=walk_in و allowWalkIn=true في الإعدادات | 201 + status=confirmed (مؤكد فوراً) |
| BK-C8 | بدون practitionerId | حقل إلزامي مفقود | 400 VALIDATION_ERROR |
| BK-C9 | بدون serviceId | حقل إلزامي مفقود | 400 VALIDATION_ERROR |
| BK-C10 | بدون type | حقل إلزامي مفقود | 400 VALIDATION_ERROR |
| BK-C11 | تاريخ في الماضي | date قبل اليوم | 400 VALIDATION_ERROR |
| BK-C12 | صيغة تاريخ خاطئة | date="2026/03/27" (ليس YYYY-MM-DD) | 400 VALIDATION_ERROR |
| BK-C13 | وقت غير صالح | startTime="25:00" | 400 VALIDATION_ERROR |
| BK-C14 | طبيب غير موجود | practitionerId وهمي (UUID صالح لكن غير موجود) | 404 NOT_FOUND |
| BK-C15 | طبيب لا يقبل الحجوزات | practitioner.isAcceptingBookings=false | 400 NOT_ACCEPTING_BOOKINGS |
| BK-C16 | خدمة غير موجودة | serviceId وهمي | 404 NOT_FOUND |
| BK-C17 | خدمة غير مقدَّمة من الطبيب | serviceId غير مرتبط بـ practitioner | 400 SERVICE_NOT_OFFERED |
| BK-C18 | خدمة معطّلة | practitionerService.isActive=false | 400 SERVICE_INACTIVE |
| BK-C19 | نوع الحجز غير متاح للخدمة | type غير موجود في service.availableTypes | 400 TYPE_NOT_AVAILABLE |
| BK-C20 | walk_in معطّل | type=walk_in و allowWalkIn=false في الإعدادات | 400 WALK_IN_NOT_ALLOWED |
| BK-C21 | تعارض الموعد | الفترة الزمنية محجوزة مسبقاً للطبيب | 409 BOOKING_CONFLICT (+ alternatives إذا suggestAlternativesOnConflict=true) |
| BK-C22 | حجز مبكر جداً | الوقت أقل من minBookingLeadMinutes من الآن | 400 BOOKING_LEAD_TIME_VIOLATION |
| BK-C23 | حجز بعيد جداً | يتجاوز maxAdvanceBookingDays من اليوم | 400 BOOKING_TOO_FAR_IN_ADVANCE |
| BK-C24 | بدون مصادقة | POST /bookings بدون Authorization header | 401 Unauthorized |
| BK-C25 | notes تتجاوز الحد | notes بطول 1001 حرف | 400 VALIDATION_ERROR |

---

## الحجز المتكرر (Recurring)

> Endpoint: `POST /bookings/recurring`

| # | الاسم | الوصف | النتيجة المتوقعة |
|---|-------|-------|-----------------|
| BK-REC1 | متكرر أسبوعي | repeatEvery=weekly + repeatCount=4 | 200 + مصفوفة 4 حجوزات تشترك في recurringGroupId |
| BK-REC2 | كل يومين | repeatEvery=every_2_days + repeatCount=3 | 200 + 3 حجوزات |
| BK-REC3 | شهري | repeatEvery=monthly + repeatCount=6 | 200 + 6 حجوزات |
| BK-REC4 | repeatCount أقل من 2 | repeatCount=1 | 400 VALIDATION_ERROR |
| BK-REC5 | repeatCount أكثر من 52 | repeatCount=53 | 400 VALIDATION_ERROR |
| BK-REC6 | نوع walk_in | type=walk_in في recurring | 400 VALIDATION_ERROR (walk_in محظور في recurring) |
| BK-REC7 | تعارض في أحد المواعيد | أحد المواعيد محجوز مسبقاً | 409 BOOKING_CONFLICT — الطلب بالكامل يُرفض (لا يوجد نجاح جزئي) |
| BK-REC8 | recurring معطّل | allowRecurring=false في الإعدادات | 400 VALIDATION_ERROR |
| BK-REC9 | تجاوز maxRecurrences | repeatCount أكبر من maxRecurrences المُعيَّن | 400 VALIDATION_ERROR |
| BK-REC10 | نمط غير مسموح | repeatEvery غير موجود في allowedRecurringPatterns | 400 VALIDATION_ERROR |
| BK-REC11 | بدون مصادقة | POST /bookings/recurring بدون token | 401 Unauthorized |

---

## قراءة الحجوزات

| # | الاسم | الوصف | النتيجة المتوقعة |
|---|-------|-------|-----------------|
| BK-L1 | قراءة حجوزاتي (مريض) | GET /bookings/my | 200 + حجوزات المريض الحالي فقط (scoped) |
| BK-L2 | حجوزات اليوم (طبيب) | GET /bookings/today | 200 + حجوزات اليوم للطبيب الحالي فقط |
| BK-L3 | قراءة الكل (admin) | GET /bookings | 200 + مصفوفة + بيانات pagination (total, page, limit) |
| BK-L4 | فلترة بالحالة | GET /bookings?status=confirmed | 200 + حجوزات بحالة confirmed فقط |
| BK-L5 | فلترة بالطبيب | GET /bookings?practitionerId=X | 200 + حجوزات الطبيب X فقط |
| BK-L6 | فلترة بنطاق تاريخ | GET /bookings?dateFrom=2026-04-01&dateTo=2026-04-30 | 200 + حجوزات ضمن الفترة فقط |
| BK-L7 | فلترة بالفرع | GET /bookings?branchId=X | 200 + حجوزات الفرع X فقط |
| BK-L8 | pagination الصفحة الثانية | GET /bookings?page=2&limit=10 | 200 + مجموعة مختلفة عن الصفحة الأولى |
| BK-L9 | حجز بـ ID | GET /bookings/:id | 200 + تفاصيل كاملة (booking + payment + practitioner + service) |
| BK-L10 | ID وهمي | GET /bookings/:uuid-غير-موجود | 404 NOT_FOUND |
| BK-L11 | إحصائيات | GET /bookings/stats | 200 + أرقام ملخصة (total, byStatus, today, etc.) |
| BK-L12 | حالة الدفع | GET /bookings/:id/payment-status | 200 + payment.status + payment.method + refundAmount |
| BK-L13 | مريض يقرأ حجز شخص آخر | GET /bookings/:id لحجز لا يملكه | 403 FORBIDDEN |
| BK-L14 | بدون مصادقة | GET /bookings/my بدون token | 401 Unauthorized |

---

## إعادة جدولة

| # | الاسم | الوصف | النتيجة المتوقعة |
|---|-------|-------|-----------------|
| BK-RS1 | إعادة جدولة (admin) | PATCH /bookings/:id بـ date و startTime جديدين | 200 + booking.date و startTime محدَّثان + rescheduleCount لا يتغير |
| BK-RS2 | إعادة جدولة (مريض) — نجاح | POST /bookings/:id/patient-reschedule من صاحب الحجز | 200 + booking.date و startTime محدَّثان + rescheduleCount يزداد بـ 1 |
| BK-RS3 | بدون date أو startTime | إرسال body فارغ | 400 VALIDATION_ERROR |
| BK-RS4 | مريض يعيد جدولة حجز غيره | patientId مختلف عن صاحب الطلب | 403 FORBIDDEN |
| BK-RS5 | إعادة جدولة معطّلة | patientCanReschedule=false في الإعدادات | 400 RESCHEDULE_NOT_ALLOWED |
| BK-RS6 | تجاوز حد الإعادة | rescheduleCount >= maxReschedulesPerBooking | 400 RESCHEDULE_LIMIT_REACHED |
| BK-RS7 | قريب جداً من الموعد | الوقت حتى الموعد أقل من rescheduleBeforeHours | 400 RESCHEDULE_TOO_LATE |
| BK-RS8 | حالة لا تسمح | حجز بحالة completed أو cancelled أو no_show | 400 INVALID_STATUS_FOR_RESCHEDULE |
| BK-RS9 | تعارض في الموعد الجديد | الفترة الجديدة محجوزة | 409 BOOKING_CONFLICT |
| BK-RS10 | بدون مصادقة | POST /bookings/:id/patient-reschedule بدون token | 401 Unauthorized |

---

## دورة حياة الحجز — الانتقالات الصالحة

| # | الاسم | الوصف | المتطلبات الأولية | النتيجة المتوقعة |
| --- | --- | --- | --- | --- |
| BK-SM1 | تأكيد الحجز — نجاح | POST /bookings/:id/confirm | status=pending + payment.status=paid | 200 + status=confirmed + confirmedAt محدَّث |
| BK-SM2 | تأكيد بدون دفع | POST /bookings/:id/confirm | status=pending + payment.status=awaiting | 409 PAYMENT_REQUIRED |
| BK-SM3 | تسجيل الحضور | POST /bookings/:id/check-in | status=confirmed | 200 + status=checked_in + checkedInAt محدَّث |
| BK-SM4 | بدء الجلسة | POST /bookings/:id/start | status=checked_in | 200 + status=in_progress + inProgressAt محدَّث |
| BK-SM5 | إتمام الجلسة | POST /bookings/:id/complete | status=in_progress | 200 + status=completed + completedAt محدَّث |
| BK-SM6 | إتمام مع ملاحظات | POST /bookings/:id/complete + completionNotes (max 2000) | status=in_progress | 200 + status=completed + completionNotes محفوظة |
| BK-SM7 | تغيب المريض | POST /bookings/:id/no-show | status=confirmed | 200 + status=no_show + noShowAt محدَّث |

---

## دورة حياة الحجز — الانتقالات المحظورة

| # | الاسم | الوصف | الحالة الحالية | النتيجة المتوقعة |
| --- | --- | --- | --- | --- |
| BK-INV1 | تأكيد بعد الإتمام | POST /bookings/:id/confirm | status=completed | 409 CONFLICT |
| BK-INV2 | تأكيد بعد الإلغاء | POST /bookings/:id/confirm | status=cancelled | 409 CONFLICT |
| BK-INV3 | check-in من pending | POST /bookings/:id/check-in | status=pending | 409 CONFLICT |
| BK-INV4 | start من confirmed (بدون check-in) | POST /bookings/:id/start | status=confirmed | 400 CHECKIN_REQUIRED |
| BK-INV5 | complete من checked_in (بدون start) | POST /bookings/:id/complete | status=checked_in | 400 CHECKIN_AND_SESSION_REQUIRED |
| BK-INV6 | complete من confirmed | POST /bookings/:id/complete | status=confirmed | 400 CHECKIN_AND_SESSION_REQUIRED |
| BK-INV7 | no-show من checked_in | POST /bookings/:id/no-show | status=checked_in | 409 INVALID_STATUS_FOR_NO_SHOW |
| BK-INV8 | no-show من in_progress | POST /bookings/:id/no-show | status=in_progress | 409 INVALID_STATUS_FOR_NO_SHOW |
| BK-INV9 | أي انتقال من completed | أي endpoint على حجز completed | status=completed | 409 CONFLICT |
| BK-INV10 | أي انتقال من cancelled | أي endpoint على حجز cancelled | status=cancelled | 409 CONFLICT |

---

## الإلغاء

| # | الاسم | الوصف | النتيجة المتوقعة |
|---|-------|-------|-----------------|
| BK-CX1 | طلب إلغاء (مريض) من confirmed | POST /bookings/:id/cancel-request | 200 + status=pending_cancellation + suggestedRefundType محفوظ |
| BK-CX2 | طلب إلغاء من pending (مع patientCanCancelPending=true) | مريض يلغي حجز pending | 200 + status=cancelled مباشرة (بدون موافقة) |
| BK-CX3 | طلب إلغاء من pending (مع patientCanCancelPending=false) | مريض يلغي حجز pending | 409 CONFLICT |
| BK-CX4 | طلب إلغاء من in_progress | POST /bookings/:id/cancel-request | 409 INVALID_STATUS_FOR_CANCELLATION |
| BK-CX5 | طلب إلغاء من completed | POST /bookings/:id/cancel-request | 409 INVALID_STATUS_FOR_CANCELLATION |
| BK-CX6 | طلب مع سبب | cancellationReason (max 1000) | 200 + cancellationReason محفوظ |
| BK-CX7 | قبول الإلغاء (استرداد كامل) | POST /bookings/:id/cancel/approve + refundType=full | 200 + status=cancelled + payment.status=refunded + refundAmount=totalAmount |
| BK-CX8 | قبول الإلغاء (استرداد جزئي) | refundType=partial + refundAmount محدَّد | 200 + status=cancelled + payment.refundAmount يساوي القيمة المُرسَلة |
| BK-CX9 | partial بدون refundAmount | refundType=partial بدون refundAmount | 400 VALIDATION_ERROR |
| BK-CX10 | refundAmount يتجاوز المبلغ المدفوع | refundAmount > payment.totalAmount | 400 VALIDATION_ERROR |
| BK-CX11 | قبول بدون استرداد | refundType=none | 200 + status=cancelled + payment لا يتغير |
| BK-CX12 | رفض طلب الإلغاء | POST /bookings/:id/cancel/reject | 200 + status يعود إلى confirmed + cancellationReason=null |
| BK-CX13 | قبول/رفض على حجز غير pending_cancellation | approve أو reject على status=confirmed | 409 CONFLICT |
| BK-CX14 | إلغاء مباشر (admin) — نجاح | POST /bookings/:id/admin-cancel + refundType=full | 200 + status=cancelled + cancelledBy=admin |
| BK-CX15 | إلغاء admin من in_progress | POST /bookings/:id/admin-cancel على in_progress | 409 INVALID_STATUS_FOR_ADMIN_CANCEL |
| BK-CX16 | إلغاء admin من completed | POST /bookings/:id/admin-cancel على completed | 409 INVALID_STATUS_FOR_ADMIN_CANCEL |
| BK-CX17 | إلغاء من الطبيب — نجاح | POST /bookings/:id/practitioner-cancel من الطبيب المالك | 200 + status=cancelled + cancelledBy=practitioner + استرداد كامل تلقائي |
| BK-CX18 | طبيب يلغي حجز طبيب آخر | practitioner غير مالك للحجز | 403 FORBIDDEN |

---

## قائمة الانتظار (Waitlist)

| # | الاسم | الوصف | النتيجة المتوقعة |
|---|-------|-------|-----------------|
| BK-WL1 | الانضمام للقائمة | POST /bookings/waitlist + practitionerId | 200 + waitlist entry بحالة waiting |
| BK-WL2 | مع تفضيل الوقت | preferredDate + preferredTime=morning | 200 + preferredDate و preferredTime محفوظان |
| BK-WL3 | الانضمام مرتين لنفس الطبيب | نفس المريض + نفس practitionerId | 409 ALREADY_ON_WAITLIST |
| BK-WL4 | Waitlist معطّلة | waitlistEnabled=false في الإعدادات | 400 WAITLIST_NOT_ENABLED |
| BK-WL5 | القائمة ممتلئة | عدد الإدخالات وصل waitlistMaxPerSlot | 400 WAITLIST_FULL |
| BK-WL6 | قراءة قائمتي (مريض) | GET /bookings/waitlist/my | 200 + إدخالات المريض الحالي فقط |
| BK-WL7 | قراءة الكل (admin) | GET /bookings/waitlist | 200 + جميع الإدخالات + pagination |
| BK-WL8 | فلترة بالطبيب | GET /bookings/waitlist?practitionerId=X | 200 + إدخالات الطبيب X فقط |
| BK-WL9 | فلترة بالحالة | GET /bookings/waitlist?status=waiting | 200 + إدخالات waiting فقط |
| BK-WL10 | مغادرة القائمة | DELETE /bookings/waitlist/:id | 200 + الإدخال يُحذف |
| BK-WL11 | حذف ID وهمي | DELETE /bookings/waitlist/:uuid-غير-موجود | 404 NOT_FOUND |
| BK-WL12 | مريض يحذف إدخال شخص آخر | DELETE على إدخال لا يملكه | 403 FORBIDDEN |
| BK-WL13 | بدون مصادقة | POST /bookings/waitlist بدون token | 401 Unauthorized |

---

## إعدادات الحجز

| # | الاسم | الوصف | النتيجة المتوقعة |
|---|-------|-------|-----------------|
| BK-SET1 | قراءة الإعدادات | GET /booking-settings | 200 + جميع الإعدادات الافتراضية والمخصصة |
| BK-SET2 | تحديث paymentTimeoutMinutes — صالح | PATCH /booking-settings + paymentTimeoutMinutes=30 | 200 + القيمة محفوظة |
| BK-SET3 | paymentTimeoutMinutes خارج النطاق | paymentTimeoutMinutes=2 (أقل من 5) | 400 VALIDATION_ERROR |
| BK-SET4 | paymentTimeoutMinutes=1440 (الحد الأعلى) | paymentTimeoutMinutes=1440 | 200 + القيمة محفوظة |
| BK-SET5 | تفعيل walk_in | allowWalkIn=true | 200 + allowWalkIn=true محفوظ |
| BK-SET6 | تفعيل recurring | allowRecurring=true | 200 + allowRecurring=true محفوظ |
| BK-SET7 | تفعيل waitlist | waitlistEnabled=true | 200 + waitlistEnabled=true محفوظ |
| BK-SET8 | lateCancelRefundPercent خارج النطاق | lateCancelRefundPercent=101 | 400 VALIDATION_ERROR |
| BK-SET9 | freeCancelBeforeHours=168 (الحد الأعلى) | freeCancelBeforeHours=168 | 200 + القيمة محفوظة |
| BK-SET10 | freeCancelBeforeHours خارج النطاق | freeCancelBeforeHours=169 | 400 VALIDATION_ERROR |
| BK-SET11 | waitlistMaxPerSlot خارج النطاق | waitlistMaxPerSlot=51 (أكبر من 50) | 400 VALIDATION_ERROR |
| BK-SET12 | تحديث بدون صلاحية | مستخدم بدون whitelabel:edit يستدعي PATCH | 403 FORBIDDEN |
| BK-SET13 | بدون مصادقة | PATCH /booking-settings بدون token | 401 Unauthorized |

---

## حدود ومعطيات الحافة (Boundaries)

| # | الاسم | الوصف | النتيجة المتوقعة |
|---|-------|-------|-----------------|
| BK-BND1 | UUID غير صالح | practitionerId="not-a-uuid" | 400 VALIDATION_ERROR |
| BK-BND2 | date="2026-02-30" | تاريخ غير موجود | 400 VALIDATION_ERROR |
| BK-BND3 | notes بالضبط 1000 حرف | عند الحد المسموح | 201 — يُقبل |
| BK-BND4 | completionNotes بالضبط 2000 حرف | عند الحد المسموح | 200 — يُقبل |
| BK-BND5 | completionNotes تتجاوز 2000 | 2001 حرف | 400 VALIDATION_ERROR |
| BK-BND6 | حجز خدمة مجانية (price=0) | سعر الخدمة صفر | 201 + لا يُنشأ سجل payment |
| BK-BND7 | maxAdvanceBookingDays=0 | الحد=0 يعني لا حد أعلى | 201 — يُقبل أي تاريخ مستقبلي |
