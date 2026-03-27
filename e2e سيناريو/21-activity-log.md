# سجل النشاط (Activity Log)

## قراءة السجل

| # | الاسم | الوصف | النتيجة المتوقعة |
|---|-------|-------|-----------------|
| AL-L1 | قراءة الكل | GET /activity-log | 200 + قائمة مع pagination |
| AL-L2 | فلترة بالموديول | `module=bookings` | أحداث الحجوزات فقط |
| AL-L3 | فلترة بالإجراء | `action=create` | إجراءات الإنشاء فقط |
| AL-L4 | فلترة بالمستخدم | `userId=X` | أحداث المستخدم X فقط |
| AL-L5 | فلترة بنطاق تاريخ | `dateFrom + dateTo` | ضمن الفترة فقط |
| AL-L6 | pagination | `page + perPage` | الصفحة المحددة |
| AL-L7 | فلترة مركّبة | module + action + userId | تقاطع الفلاتير |
| AL-L8 | سجل بـ ID | GET /activity-log/:id | 200 + التفاصيل الكاملة |
| AL-L9 | ID وهمي | UUID غير موجود | 404 NOT_FOUND |

---

## التحقق من التسجيل التلقائي

| # | الاسم | الوصف | النتيجة المتوقعة |
|---|-------|-------|-----------------|
| AL-T1 | إنشاء حجز يُسجَّل | بعد POST /bookings | يظهر في السجل `module=bookings, action=create` |
| AL-T2 | إلغاء حجز يُسجَّل | بعد admin-cancel | يظهر `action=cancel` مع userId المدير |
| AL-T3 | تعديل مستخدم يُسجَّل | بعد PATCH /users/:id | يظهر `module=users, action=update` |
