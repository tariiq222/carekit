# تقارير المشاكل (Problem Reports)

## إنشاء تقرير

| # | الاسم | الوصف | النتيجة المتوقعة |
|---|-------|-------|-----------------|
| PR-C1 | تقرير أساسي | bookingId + type + description | 201 + reportId |
| PR-C2 | نوع WAIT_TIME | وقت الانتظار طويل | 201 + محفوظ |
| PR-C3 | نوع STAFF_BEHAVIOR | مشكلة سلوك | 201 + محفوظ |
| PR-C4 | نوع BILLING | مشكلة فوترة | 201 + محفوظ |
| PR-C5 | نوع OTHER | `type: OTHER` | 201 + محفوظ |
| PR-C6 | بدون bookingId | حقل إلزامي | 400 VALIDATION_ERROR |
| PR-C7 | bookingId وهمي | UUID غير موجود | 404 NOT_FOUND |
| PR-C8 | حجز غير مكتمل | booking بحالة pending أو confirmed | 400 VALIDATION_ERROR |
| PR-C9 | بدون type | حقل إلزامي | 400 VALIDATION_ERROR |
| PR-C10 | نوع غير صالح | `type: "OTHER_ISSUE"` | 400 VALIDATION_ERROR |
| PR-C11 | بدون description | حقل إلزامي | 400 VALIDATION_ERROR |
| PR-C12 | description طويلة | أكثر من 2000 حرف | 400 VALIDATION_ERROR |

---

## قراءة التقارير (admin)

| # | الاسم | الوصف | النتيجة المتوقعة |
|---|-------|-------|-----------------|
| PR-L1 | قراءة الكل | GET /problem-reports | 200 + قائمة مع pagination |
| PR-L2 | تقرير بـ ID | GET /problem-reports/:id | 200 + التفاصيل |
| PR-L3 | ID وهمي | UUID غير موجود | 404 NOT_FOUND |

---

## حل التقرير

| # | الاسم | الوصف | النتيجة المتوقعة |
|---|-------|-------|-----------------|
| PR-R1 | حل التقرير | PATCH /problem-reports/:id/resolve + `status: RESOLVED` | 200 + محلول |
| PR-R2 | رفض التقرير | `status: DISMISSED` | 200 + مرفوض |
| PR-R3 | مع ملاحظات المدير | `adminNotes: "تم التواصل مع المريض"` | 200 + الملاحظات محفوظة |
| PR-R4 | تقرير محلول مسبقاً | محاولة حل تقرير محلول | 400 |
| PR-R5 | status غير صالح | `status: "PENDING"` | 400 VALIDATION_ERROR |
| PR-R6 | adminNotes طويلة | أكثر من 2000 حرف | 400 VALIDATION_ERROR |
| PR-R7 | ID وهمي | UUID غير موجود | 404 NOT_FOUND |
