# التقارير (Reports)

## تقرير الإيرادات

| # | الاسم | الوصف | النتيجة المتوقعة |
|---|-------|-------|-----------------|
| RPT-RV1 | تقرير بنطاق تاريخ | GET /reports/revenue + dateFrom + dateTo | 200 + بيانات الإيرادات |
| RPT-RV2 | فلترة بالطبيب | `practitionerId=X` | إيرادات الطبيب X فقط |
| RPT-RV3 | فلترة بالفرع | `branchId=X` | إيرادات الفرع X فقط |
| RPT-RV4 | بدون dateFrom | حقل إلزامي | 400 VALIDATION_ERROR |
| RPT-RV5 | بدون dateTo | حقل إلزامي | 400 VALIDATION_ERROR |
| RPT-RV6 | practitionerId وهمي | UUID غير صالح | 400 VALIDATION_ERROR |

---

## تصدير الإيرادات (CSV)

| # | الاسم | الوصف | النتيجة المتوقعة |
|---|-------|-------|-----------------|
| RPT-RE1 | تصدير CSV | GET /reports/revenue/export + dateFrom + dateTo | ملف CSV |
| RPT-RE2 | فلترة بالفرع | `branchId=X` | CSV لبيانات الفرع |
| RPT-RE3 | بدون dateFrom | حقل إلزامي | 400 VALIDATION_ERROR |

---

## تقرير الحجوزات

| # | الاسم | الوصف | النتيجة المتوقعة |
|---|-------|-------|-----------------|
| RPT-BK1 | تقرير حجوزات | GET /reports/bookings + dateFrom + dateTo | 200 + بيانات الحجوزات |
| RPT-BK2 | فلترة بالفرع | `branchId=X` | حجوزات الفرع فقط |
| RPT-BK3 | بدون dateFrom | حقل إلزامي | 400 VALIDATION_ERROR |

---

## تصدير الحجوزات (CSV)

| # | الاسم | الوصف | النتيجة المتوقعة |
|---|-------|-------|-----------------|
| RPT-BE1 | تصدير CSV | GET /reports/bookings/export + dateFrom + dateTo | ملف CSV |
| RPT-BE2 | بدون dateFrom | حقل إلزامي | 400 VALIDATION_ERROR |

---

## تصدير المرضى (CSV)

| # | الاسم | الوصف | النتيجة المتوقعة |
|---|-------|-------|-----------------|
| RPT-PT1 | تصدير كل المرضى | GET /reports/patients/export | ملف CSV بكل المرضى |

---

## تقرير الطبيب

| # | الاسم | الوصف | النتيجة المتوقعة |
|---|-------|-------|-----------------|
| RPT-PR1 | تقرير طبيب محدد | GET /reports/practitioners/:id + dateFrom + dateTo | 200 + بيانات الطبيب |
| RPT-PR2 | بدون dateFrom | حقل إلزامي | 400 VALIDATION_ERROR |
| RPT-PR3 | practitionerId وهمي | UUID غير موجود | 404 NOT_FOUND |
| RPT-PR4 | UUID غير صالح | تنسيق خاطئ | 400 VALIDATION_ERROR |
