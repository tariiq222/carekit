# خطة اختبار E2E — صفحة الحجوزات (Bookings)

> **المسار:** `/bookings` — الصفحة الرئيسية + `/bookings/create` (ويزارد الإنشاء)
> **الأداة:** Chrome DevTools MCP (manual QA gate)
> **آخر تحديث:** 2026-04-17

---

## 1. التحضير قبل الاختبار

### 1.1 تشغيل البيئة
```bash
# في terminal 1
cd apps/backend && npm run dev        # :5100

# في terminal 2
cd apps/dashboard && npm run dev      # :5103

# إذا الـ worktree جديد
cp /c/pro/carekit/apps/backend/.env apps/backend/.env
cp /c/pro/carekit/apps/dashboard/.env apps/dashboard/.env
cd apps/backend && npx prisma generate && npm run seed
```

### 1.2 بيانات السيد المطلوبة
- 3+ موظفين مع specialties
- 3+ خدمات
- 2+ عملاء
- `bookingSettings.waitlistEnabled = true` (لاختبار تبويب الانتظار)
- `bookingSettings.flowOrder = "service_first"` (افتراضي)
- feature flag `walk_in` مفعّل

### 1.3 تسجيل الدخول
- دور owner/admin — كل الأزرار ظاهرة بدون قيود CASL

---

## 2. خريطة الصفحة — Page Anatomy

```text
Breadcrumbs  (الرئيسية › الحجوزات)
PageHeader   [عنوان + وصف]                      [+ حجز جديد]
Tabs         [الحجوزات] [قائمة الانتظار*]       * إذا waitlistEnabled
ErrorBanner  (only on error)
FilterBar    [بحث] [كل الأوقات|اليوم|الأسبوع|الشهر] [النوع▼] [الموظف▼] [الحالة▼] [من▼] [إلى▼] [إعادة تعيين]
DataTable    [#] [المريض] [الممارس] [النوع] [التاريخ/الوقت] [المبلغ] [الحالة] [إجراءات]
Pagination   (if totalPages > 1)
Dialogs      BookingCreateDialog · BookingDetailSheet · AdminCancelDialog · ApproveCancelDialog · RejectCancelDialog
```

**ملاحظة:** لا يوجد StatsGrid في هذه الصفحة (استثناء من Page Anatomy Law — الحجوزات صفحة عمليات لا لوحة قياس).

---

## 3. سيناريوهات التحميل الأولي

### 3.1 تحميل الصفحة من بارد
**خطوات MCP:**
```
navigate_page → http://localhost:5103/bookings
take_snapshot
list_network_requests (filter: /dashboard/bookings)
list_console_messages
```

**التوقعات:**
- [ ] Breadcrumbs تظهر: `الرئيسية / الحجوزات`
- [ ] PageHeader يعرض العنوان + وصف + زر `+ حجز جديد` (primary)
- [ ] التبويبات تظهر: `الحجوزات` (نشط) — `قائمة الانتظار` (إذا مفعّل)
- [ ] FilterBar يعرض 7 عناصر: بحث، تبويبات الوقت، النوع، الموظف، الحالة، من، إلى، reset
- [ ] الجدول يحمّل 8 أعمدة + صف skeleton (5× `h-12`) أثناء التحميل
- [ ] Network: `GET /dashboard/bookings?page=1&limit=20` مع Status 200
- [ ] لا يوجد أي خطأ في console
- [ ] الـ locale عربي بشكل افتراضي — كل النصوص RTL

**أوامر تحقق (curl):**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:5100/dashboard/bookings?page=1&limit=20" | jq
```
- تحقق أن `meta.totalItems` و `meta.totalPages` متوافقة مع الـ UI

### 3.2 الحالة الفارغة (Empty State)
**خطوات:** استخدم فلتر بحث لا يطابق أي حجز (`search=zzzxxx999`)
**التوقعات:**
- [ ] جدول يعرض "لا توجد حجوزات"
- [ ] لا يوجد pagination
- [ ] زر إعادة التعيين يعيد الجدول لحالته الأصلية

### 3.3 حالة الخطأ
**خطوات:** أوقف الـ backend مؤقتاً، ثم reload
**التوقعات:**
- [ ] ErrorBanner يظهر مع رسالة واضحة
- [ ] زر إعادة المحاولة موجود
- [ ] لا يوجد crash في UI

---

## 4. FilterBar — اختبار كل فلتر

### 4.1 البحث (Search)
- **أين:** FilterBar (ليس PageHeader)
- **السلوك:** debounced ~300ms، يرسل `search=<value>`

| السيناريو | المدخل | التوقع |
|-----------|-------|--------|
| بحث باسم | `أحمد` | Request يحتوي `search=%D8%A3...`، الجدول يحدّث |
| بحث ID | أول 8 أحرف من booking ID | الجدول يظهر الحجز الواحد فقط |
| حرف واحد | `ا` | لا يرسل request حتى 2+ أحرف (تحقق!) |
| مسح البحث | delete all | request جديد بدون `search=` |

**MCP:**
```
fill <search_uid> "أحمد"
wait_for network idle
list_network_requests → آخر request: search param موجود؟
```

### 4.2 تبويبات الوقت (Time Tabs)
| التبويب | dateFrom | dateTo | اختبار DB |
|---------|----------|--------|-----------|
| كل الأوقات (افتراضي) | `""` | `""` | لا يوجد query |
| اليوم | `2026-04-17` | `2026-04-17` | `fromDate=2026-04-17&toDate=2026-04-17` |
| هذا الأسبوع | بداية الأسبوع (حسب `weekStartDayNumber`) | نهاية الأسبوع | تحقق من `weekStartDayNumber` في clinic config |
| هذا الشهر | `2026-04-01` | `2026-04-30` | range كامل |

**Edge case حرج:** `weekStartDayNumber` قد يكون سبت (6) في السعودية — تحقق أن الأسبوع يبدأ يوم سبت لا أحد.

### 4.3 فلتر النوع (Type)
- القيم: `all | in_person | online | walk_in`
- `walk_in` يختفي إذا feature flag معطل
- كل قيمة ترسل `bookingType=<value>` عدا `all` (لا يرسل)

**اختبار حرج (Boolean bug guard):** جرّب `all` بعد `in_person` — تأكد أن الـ request يحذف الـ param تماماً، لا يرسل `bookingType=all`.

### 4.4 فلتر الموظف
- Dropdown ديناميكي من `/hooks/use-employees`
- `all` افتراضي، `<uuid>` يرسل `employeeId=<uuid>`
- اختبر: اختر موظف → تحقق أن كل الصفوف الظاهرة تحمل اسمه

### 4.5 فلتر الحالة
القيم الـ 9: `pending | confirmed | completed | cancelled | pending_cancellation | no_show | checked_in | in_progress | expired`

**لكل حالة:**
- [ ] اختر الحالة
- [ ] request يحمل `status=<value>`
- [ ] كل الصفوف تعرض نفس الحالة في شارة الحالة
- [ ] شارة الحالة بالألوان الصحيحة (success/warning/muted/accent)

### 4.6 فلترا من/إلى (dateFrom / dateTo)
- [ ] اختر date fromdate picker → request يرسل `fromDate=YYYY-MM-DD`
- [ ] اختر toDate أقل من fromDate → لازم error أو swap تلقائي
- [ ] اختبر تاريخ مستقبلي (بعد 6 أشهر) — يرجع empty أو حجوزات مجدولة

### 4.7 زر إعادة التعيين (Reset)
- [ ] بعد تطبيق 3+ فلاتر، اضغط Reset
- [ ] كل الفلاتر ترجع للافتراضي، tab الوقت يرجع `كل الأوقات`
- [ ] Request واحد `GET /dashboard/bookings?page=1&limit=20`

---

## 5. الجدول — الأعمدة والصفوف

### 5.1 أعمدة الجدول
| # | العمود | المحتوى | ملاحظات |
|---|--------|---------|---------|
| 1 | `#` | أول 8 أحرف من ID | monospace |
| 2 | المريض | avatar + اسم كامل + booking ID | قابل للنقر → يفتح DetailSheet |
| 3 | الممارس | `د. <الاسم>` | |
| 4 | النوع | نقطة ملونة + نص | primary/accent/success |
| 5 | التاريخ والوقت | `ar-SA` format | |
| 6 | المبلغ | `SAR` currency | |
| 7 | الحالة | Badge + أزرار inline | pending فقط يعرض [تأكيد][لم يحضر] |
| 8 | إجراءات | icon-only dropdown | size-9 rounded-sm |

**اختبر:**
- [ ] تاريخ مثل: `١٧ أبر، ٢٠٢٦` (تنسيق `toLocaleDateString("ar-SA")`)
- [ ] المبلغ: `120.00 ر.س` (أو ما يعادله — تحقق من تنسيق العملة)
- [ ] زر الإجراءات: icon فقط + Tooltip، بدون نص
- [ ] النقر على اسم المريض يفتح DetailSheet (ليس صفحة جديدة)

### 5.2 الأزرار inline للحالة pending
- [ ] زر `تأكيد` → `PATCH /dashboard/bookings/{id}/confirm` → الحالة تصبح `confirmed`
- [ ] زر `لم يحضر` → `PATCH /dashboard/bookings/{id}/no-show` → الحالة `no_show`
- [ ] toast نجاح بالعربي
- [ ] الصف يحدّث بدون reload (optimistic update)

### 5.3 قائمة الإجراءات (ActionsCell)
- [ ] `عرض` → يفتح DetailSheet تبويب "تفاصيل"
- [ ] `تعديل` → يفتح DetailSheet تبويب "إعادة جدولة"
- [ ] `حذف/إلغاء` → يفتح AdminCancelDialog

---

## 6. إنشاء حجز — BookingWizard (6 خطوات)

### 6.1 فتح الويزارد
- [ ] اضغط `+ حجز جديد`
- [ ] Dialog يفتح مع مؤشر الخطوات (6 نقاط) ومؤشر الخطوة الأولى مضاء

### 6.2 الخطوة 1 — اختيار العميل
**تبويب البحث:**
- [ ] اكتب في البحث — list تظهر مع avatar + اسم + رقم
- [ ] اضغط عميل → ينتقل للخطوة 2
- [ ] البحث فارغ → يعرض كل العملاء

**تبويب إنشاء walk-in:**
- انتقل لتبويب `إنشاء` → BookingWalkInForm (خطوتين فرعيتين)

**الخطوة الفرعية 1 — معلومات شخصية:**
| الحقل | نوع | مطلوب | validation |
|-------|-----|-------|------------|
| firstName | text | ✓ | min 1, max 255 |
| middleName | text | — | max 255 |
| lastName | text | ✓ | min 1, max 255 |
| gender | buttons | — | male/female |
| dateOfBirth | date picker | — | — |
| nationality | text | — | default `السعودية` |
| nationalId | text | — | max 20 |
| phone | text | ✓ | regex `/^\+[1-9]\d{6,14}$/` |
| emergencyName | text | — | — |
| emergencyPhone | text | — | same regex |

**اختبارات validation (مطلوبة):**
- [ ] submit فارغ → أخطاء بالعربي على firstName/lastName/phone
- [ ] phone بدون `+` → خطأ "رقم غير صحيح"
- [ ] phone `+966` فقط → خطأ (أقل من 7 أرقام)
- [ ] phone `+9665012345678` → مقبول
- [ ] رسالة الخطأ بالعربي (ليس إنجليزي — red flag!)

**الخطوة الفرعية 2 — معلومات طبية:**
| الحقل | نوع | مطلوب | validation |
|-------|-----|-------|------------|
| bloodType | dropdown | — | enum 12 قيمة عدا UNKNOWN |
| allergies | textarea | — | max 1000 |
| chronicConditions | textarea | — | max 1000 |

- [ ] كل 12 قيمة لـ bloodType متاحة (A, B, AB, O, +/-/بدون)
- [ ] textarea يعرض العداد `0/1000`

### 6.3 الخطوة 2-3 — الخدمة/الموظف (حسب flowOrder)
**إذا flowOrder = "service_first":**
- الخطوة 2: اختر خدمة
- الخطوة 3: اختر موظف (يفلتر حسب specialty الخدمة)

**إذا "employee_first":** العكس
**إذا "both":** StepChoosePath يظهر أولاً

اختبارات:
- [ ] قائمة الخدمات تظهر مع السعر والمدة
- [ ] اختيار خدمة → قائمة الموظفين يفلتر تلقائي (موظفين عندهم specialty فقط)
- [ ] زر رجوع يعيد للخطوة السابقة بدون فقدان الاختيار

### 6.4 الخطوة 4 — نوع الحجز + المدة
- [ ] أزرار النوع: in_person / online / walk_in (حسب `availableTypes`)
- [ ] إذا `hasDurationOptions = true` → dropdown المدة يظهر
- [ ] لا يمكن التقدم بدون اختيار نوع

### 6.5 الخطوة 5 — التاريخ والوقت
**Network trace:**
```
POST /dashboard/bookings/availability
body: { employeeId, serviceId, date }
```

- [ ] اختر تاريخ → request تلقائي لـ availability
- [ ] قائمة الأوقات المتاحة تظهر بتنسيق `HH:MM - HH:MM`
- [ ] اختر تاريخ في الماضي → كل الأوقات disabled أو قائمة فارغة
- [ ] اختر تاريخ يوم إجازة → `لا توجد أوقات متاحة`
- [ ] اختبر يوم مزدحم — تحقق أن الأوقات المحجوزة لا تظهر

### 6.6 الخطوة 6 — التأكيد والدفع
- [ ] ملخص يعرض: العميل، الخدمة، الموظف، النوع، التاريخ، الوقت، السعر
- [ ] Toggle `الدفع في العيادة` (payAtClinic) — default false
- [ ] زر `تأكيد الحجز` → `POST /dashboard/bookings`
- [ ] toast نجاح + Dialog يقفل + جدول يحدّث

**تحقق DB:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:5100/dashboard/bookings?page=1&limit=5" | jq '.data[0]'
```
- [ ] `clientId`, `employeeId`, `serviceId`, `type`, `date`, `startTime` كلها محفوظة
- [ ] `status = "pending"` افتراضي
- [ ] `payAtClinic` يطابق اختيار المستخدم

---

## 7. تفاصيل الحجز — BookingDetailSheet

### 7.1 فتح الـ sheet
- [ ] اضغط اسم العميل من الجدول
- [ ] Sheet يفتح من اليمين (RTL)
- [ ] تبويبان: `تفاصيل` | `إعادة جدولة` (إذا قابل للجدولة)

### 7.2 تبويب التفاصيل
يعرض: اسم العميل، الموظف، التخصص، التاريخ/الوقت، الخدمة، المدة، النوع، الحالة، معلومات الدفع، الملاحظات، روابط Zoom (إذا online)

- [ ] كل الحقول تعرض قيم حقيقية (لا "null" أو "undefined")
- [ ] روابط Zoom تظهر فقط إذا النوع `online`
- [ ] BookingStatusLog يعرض كل انتقالات الحالة مع timestamps

### 7.3 تبويب إعادة الجدولة
- الحقول: `date` (مطلوب)، `startTime` (مطلوب)
- [ ] نفس منطق availability من الخطوة 5 في الويزارد
- [ ] اضغط `حفظ` → `PATCH /dashboard/bookings/{id}/reschedule`
- [ ] toast نجاح + sheet يحدّث + صف الجدول يعكس التاريخ الجديد

### 7.4 الحالات غير القابلة لإعادة الجدولة
الحالات: `completed, cancelled, no_show, pending_cancellation, in_progress, expired`
- [ ] تبويب "إعادة جدولة" **لا يظهر**
- [ ] View-only فقط

---

## 8. إلغاء الحجز — AdminCancelDialog

### 8.1 فتح dialog الإلغاء
- [ ] من قائمة الإجراءات → `حذف/إلغاء`
- [ ] Sheet يفتح مع 4 حقول

### 8.2 الحقول
| الحقل | نوع | مطلوب | validation |
|-------|-----|-------|------------|
| cancelReason | textarea | ✓ | min 1 |
| refundType | dropdown | ✓ | `full | partial | none` |
| refundAmount | number | إذا partial | min 1 |
| adminNotes | textarea | — | — |

### 8.3 اختبارات validation
- [ ] submit فارغ → خطأ على cancelReason (`reasonRequired`)
- [ ] refundType = `partial` + refundAmount = `` → خطأ (`refundAmountRequired`)
- [ ] refundAmount = `0` → خطأ (`refundAmountError`)
- [ ] refundAmount = `-5` → خطأ
- [ ] refundAmount = `abc` → خطأ (NaN)
- [ ] refundType = `full` → حقل المبلغ يختفي أو disabled
- [ ] refundType = `none` → نفس الشي

### 8.4 تنفيذ الإلغاء
- [ ] اضغط `إلغاء الحجز` → `PATCH /dashboard/bookings/{id}/cancel`
- [ ] toast نجاح + dialog يقفل
- [ ] الحالة في الجدول تصبح `cancelled`
- [ ] تحقق DB: `cancelReason`, `refundType`, `refundAmount`, `cancelledBy = "admin"`

### 8.5 حالة pending_cancellation (طلب إلغاء من العميل)
- ApproveCancelDialog: يعرض `suggestedRefundType` من النظام — يمكن تعديله
- [ ] اضغط `موافقة` → refundType + refundAmount + adminNotes → حالة `cancelled`
- RejectCancelDialog:
- [ ] اضغط `رفض` → adminNotes فقط → الحالة ترجع `confirmed`

---

## 9. Pagination

- [ ] إذا `totalPages > 1` → pagination يظهر
- [ ] زر السابق disabled في page 1
- [ ] زر التالي disabled في آخر page
- [ ] النقر يرسل `page=N` ويحدّث الجدول
- [ ] pagination يحافظ على الفلاتر الحالية

---

## 10. اختبارات RTL و Dark Mode

### 10.1 RTL
- [ ] `take_screenshot` على الصفحة — تحقق:
  - [ ] Breadcrumbs من اليمين لليسار
  - [ ] زر `+ حجز جديد` في الجهة اليسرى من PageHeader
  - [ ] Sheet يفتح من اليمين
  - [ ] الجدول: `#` العمود الأول من اليمين
  - [ ] أيقونات الإجراءات في نهاية الصف (يسار في RTL)
  - [ ] لا يوجد `left-X`/`right-X` حرفي — لازم logical (`start`/`end`)

### 10.2 Dark Mode
- [ ] فعّل dark mode من الـ topbar
- [ ] `take_screenshot` — تحقق:
  - [ ] Glass surfaces شفافة صحيحة (ليست opaque gray)
  - [ ] النصوص contrast AAA
  - [ ] شارات الحالة ظاهرة بوضوح
  - [ ] Dialog/Sheet glass effect سليم
  - [ ] لا hex colors — كل الألوان من tokens

---

## 11. حالات خاصة (Edge Cases)

### 11.1 Walk-in feature flag off
- [ ] عطّل feature flag → خيار `walk_in` يختفي من فلتر النوع
- [ ] الويزارد: الخطوة 4 لا تعرض walk_in كخيار
- [ ] تبويب `إنشاء` في الخطوة 1 يختفي (أو يعطّل)

### 11.2 Waitlist feature off
- [ ] `bookingSettings.waitlistEnabled = false` → تبويب "قائمة الانتظار" يختفي

### 11.3 تضارب بيانات
- [ ] افتح سطر A في DetailSheet، ثم بدون إغلاق افتح إجراءات سطر B
- [ ] Dialog لا يعرض بيانات السطر A بالخطأ (red flag معروف!)

### 11.4 Network timeout/offline
- [ ] اقطع الإنترنت قبل submit booking → رسالة خطأ واضحة
- [ ] بعد submit فاشل — البيانات لا تضيع في الـ form

### 11.5 Recurring bookings (إذا ظاهر في UI)
- [ ] `repeatEvery = weekly`, `repeatCount = 4` → إنشاء 4 حجوزات
- [ ] تحقق DB: كل الحجوزات الأربعة بنفس العميل/الموظف/الخدمة
- [ ] حذف واحد منها → لا يؤثر على الباقي

### 11.6 Timezone
- [ ] أنشئ حجز في 23:30 — تحقق أن `date` لا ينزاح ليوم التالي في DB
- [ ] التاريخ في الجدول يطابق التاريخ المختار في الويزارد

### 11.7 أرقام كبيرة
- [ ] 1000+ حجز في DB → pagination يعمل، load < 2s
- [ ] refundAmount = 999999.99 → مقبول
- [ ] refundAmount = 1000000000 → لازم حد أقصى من backend

---

## 12. Screenshots مطلوبة

احفظ في `docs/superpowers/qa/screenshots/bookings/`:
1. `list-light-rtl.png` — الصفحة الكاملة light mode
2. `list-dark-rtl.png` — نفسها dark mode
3. `wizard-step1.png` — اختيار العميل
4. `wizard-step6.png` — التأكيد
5. `detail-sheet.png` — sheet مفتوح
6. `cancel-dialog-validation.png` — أخطاء validation ظاهرة
7. `empty-state.png` — جدول فارغ
8. `pagination.png` — صفحة 2 من 3

---

## 13. أوامر curl للتحقق من الـ backend

```bash
# متغيرات
TOKEN="<jwt-من-localStorage>"
API="http://localhost:5100"

# قائمة مع كل الفلاتر
curl -H "Authorization: Bearer $TOKEN" \
  "$API/dashboard/bookings?page=1&limit=20&status=pending&bookingType=in_person&employeeId=<uuid>&fromDate=2026-04-01&toDate=2026-04-30" | jq

# حجز واحد
curl -H "Authorization: Bearer $TOKEN" "$API/dashboard/bookings/<id>" | jq

# تأكيد
curl -X PATCH -H "Authorization: Bearer $TOKEN" \
  "$API/dashboard/bookings/<id>/confirm" | jq

# إلغاء
curl -X PATCH -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason":"test","refundType":"partial","refundAmount":50,"adminNotes":"x"}' \
  "$API/dashboard/bookings/<id>/cancel" | jq

# availability
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"employeeId":"<uuid>","serviceId":"<uuid>","date":"2026-04-20"}' \
  "$API/dashboard/bookings/availability" | jq
```

---

## 14. Red Flags خاصة بهذه الصفحة

- ⚠️ **`@Type(() => Boolean)` bug:** `isActive=false` قد يُفسَّر `true` في backend — اختبر كل قيمة boolean صراحة
- ⚠️ **Stale dialog data:** فتح dialog بعد hover صف مختلف قد يعرض بيانات خاطئة
- ⚠️ **Select onChange silent fail:** بعد refundType change، افتح الـ dialog ثانية وتأكد أن القيمة محفوظة
- ⚠️ **Validation بالإنجليزي على UI عربي:** كل رسائل Zod لازم i18n keys، ليس strings
- ⚠️ **Filter query param ghost:** `status=all` ما يجب أن يُرسل، فقط يُحذف الـ param
- ⚠️ **Timezone drift:** حجوزات بعد 22:00 قد تُحفظ باليوم التالي بسبب UTC conversion
- ⚠️ **weekStartDayNumber:** الأسبوع السعودي يبدأ سبت، ليس أحد/اثنين

---

## 15. معايير النجاح

الصفحة جاهزة للـ merge إذا وفقط إذا:

- [ ] كل السيناريوهات في الأقسام 3-9 passed
- [ ] كل validation في القسم 6 و 8 passed
- [ ] RTL + Dark mode screenshots مراجعة
- [ ] كل الـ red flags في القسم 14 محقق منها
- [ ] Network requests كلها تحمل params صحيحة (لا ghost params)
- [ ] DB state يطابق UI state بعد كل Create/Edit/Delete
- [ ] لا يوجد console errors في أي سيناريو
- [ ] Screenshots مطلوبة محفوظة في المجلد
