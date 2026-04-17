# خطة اختبار E2E — صفحة العملاء (Clients)

> **المسار:** `/clients` (قائمة) · `/clients/create` · `/clients/[id]` · `/clients/[id]/edit`
> **الأداة:** Chrome DevTools MCP
> **آخر تحديث:** 2026-04-17

---

## 1. التحضير قبل الاختبار

### 1.1 تشغيل البيئة
```bash
cd apps/backend && npm run dev        # :5100
cd apps/dashboard && npm run dev      # :5103
```

### 1.2 بيانات السيد المطلوبة
- 20+ عميل (مزيج active/inactive)
- 3+ عملاء walk_in (`accountType = "WALK_IN"`)
- 2+ عملاء مع `emailVerified = true`
- 5+ عملاء عندهم حجوزات (lastBooking/nextBooking تظهر)
- 5+ عملاء بدون حجوزات (يعرضون `—`)

### 1.3 تسجيل الدخول
- دور owner/admin

---

## 2. خريطة الصفحة

```text
Breadcrumbs  (الرئيسية › العملاء)
PageHeader   [عنوان + وصف]         [تصدير (disabled)] [+ إضافة عميل]
StatsGrid    [إجمالي] [نشط] [غير نشط] [جديد هذا الشهر]
FilterBar    [بحث] [الحالة▼] [إعادة تعيين]
DataTable    [العميل] [الهاتف] [تاريخ الانضمام] [آخر حجز] [الحجز القادم] [الحالة] [إجراءات]
Pagination   (if totalPages > 1)
Dialogs      DeleteClientDialog
```

---

## 3. سيناريوهات التحميل الأولي

### 3.1 تحميل الصفحة
```
navigate_page → http://localhost:5103/clients
take_snapshot
list_network_requests (filter: /dashboard/people/clients)
list_console_messages
```

**التوقعات:**
- [ ] Breadcrumbs: `الرئيسية / العملاء`
- [ ] PageHeader: زر `تصدير` (outline, disabled) + `+ إضافة عميل` (primary)
- [ ] StatsGrid: 4 بطاقات `h-[100px]` أثناء skeleton
- [ ] FilterBar glass يحمل بحث + حالة + reset
- [ ] DataTable **بدون Card wrapper**
- [ ] Network: `GET /dashboard/people/clients?page=1&limit=20` status 200
- [ ] لا console errors
- [ ] StatsGrid قيم تطابق DB (احسب عبر curl)

**curl verification:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "$API/dashboard/people/clients?page=1&limit=1000" | jq '.meta.total'
# = عدد "إجمالي العملاء" في StatsGrid
```

### 3.2 StatsGrid — قيم البطاقات
- [ ] **إجمالي**: يطابق `meta.total`
- [ ] **نشط**: عدد حيث `isActive = true`
- [ ] **غير نشط**: `isActive = false`
- [ ] **جديد هذا الشهر**: `createdAt` داخل الشهر الحالي

### 3.3 الحالة الفارغة
- بحث `zzzxxx999` → `لا يوجد عملاء`
- [ ] لا pagination
- [ ] زر reset يعيد القائمة

### 3.4 حالة الخطأ
- أوقف backend → ErrorBanner يظهر
- [ ] لا crash، رسالة بالعربي

---

## 4. FilterBar

### 4.1 البحث
- debounced ~300ms، backend-driven
- البحث يشمل: name, firstName, lastName, phone, email

| المدخل | التوقع |
|--------|--------|
| `أحمد` | `search=%D8%A3...` في request |
| `+9665` | يطابق أرقام الهواتف |
| `@gmail` | يطابق إيميلات |
| حرف واحد | لا request حتى 2+ |
| مسح | request بدون `search=` |

### 4.2 فلتر الحالة
- القيم: `all | active | inactive`
- افتراضي: `all` (undefined → لا يرسل param)

**اختبارات:**
- [ ] `active` → request `isActive=true` → كل الصفوف شارة خضراء
- [ ] `inactive` → `isActive=false` → كل الصفوف شارة رمادية
- [ ] `all` → **لا param** (تحقق — ghost param bug!)

**⚠️ Red flag:** `@Type(() => Boolean)` bug — تحقق أن `isActive=false` يرجع فعلاً غير النشطين، ليس الكل.

### 4.3 إعادة تعيين
- [ ] بعد بحث + active → Reset → كل شي يرجع افتراضي
- [ ] request واحد `GET ?page=1&limit=20`

---

## 5. الجدول

### 5.1 الأعمدة
| # | العمود | الترتيب؟ | المحتوى |
|---|--------|----------|---------|
| 1 | العميل | ✓ | avatar + الاسم الكامل + email + `Walk In` badge + ✓ email verified |
| 2 | الهاتف | ✗ | `+9665...` أو `—` |
| 3 | تاريخ الانضمام | ✓ | `١٧ أبر، ٢٠٢٦` |
| 4 | آخر حجز | ✓ | تاريخ أو `—` |
| 5 | الحجز القادم | ✓ | تاريخ أو `—` |
| 6 | الحالة | ✓ | `نشط` (success/10) أو `غير نشط` (muted) |
| 7 | إجراءات | ✗ | icon-only + Tooltip |

**اختبارات:**
- [ ] اضغط عمود قابل للترتيب → request يحمل `sortBy` + `sortOrder`
- [ ] `Walk In` badge يظهر فقط لـ `accountType = "WALK_IN"`
- [ ] ✓ verified يظهر فقط لـ `emailVerified = true`
- [ ] صف بدون حجوزات → `—` في آخر/قادم
- [ ] النقر على اسم → يتنقل لـ `/clients/{id}`

### 5.2 قائمة الإجراءات
- [ ] `عرض` → `/clients/{id}`
- [ ] `تعديل` → `/clients/{id}/edit`
- [ ] `تعطيل/تفعيل` → `PATCH /dashboard/people/clients/{id}` body `{isActive: !current}`
- [ ] `حذف` → DeleteClientDialog

**Toggle Active:**
- [ ] اضغط على عميل نشط → `PATCH` مع `isActive: false` → toast + صف يحدّث + شارة تتغير
- [ ] اضغط ثاني → يرجع نشط
- [ ] تحقق DB:
  ```bash
  curl -H "Authorization: Bearer $TOKEN" \
    "$API/dashboard/people/clients/<id>" | jq '.isActive'
  ```

---

## 6. إنشاء عميل — `/clients/create`

### 6.1 التنقل
- [ ] اضغط `+ إضافة عميل` → `/clients/create` يفتح
- [ ] Layout: 3 أعمدة (2 على موبايل)

### 6.2 البطاقة 1 — معلومات شخصية
| الحقل | نوع | مطلوب (create) | validation |
|-------|-----|---------------|------------|
| firstName | text | ✓ | min 1, max 255 |
| middleName | text | — | max 255 |
| lastName | text | ✓ | min 1, max 255 |
| gender | radio (toggle) | — | male/female |
| dateOfBirth | date | — | max = اليوم |
| nationality | select | — | default `السعودية`، max 100 |
| nationalId | text | — | max 20, placeholder `1XXXXXXXXX` |

### 6.3 البطاقة 2 — الاتصال والطوارئ
| الحقل | نوع | مطلوب | validation |
|-------|-----|-------|------------|
| phone | PhoneInput | ✓ | regex `/^\+9665\d{8}$/` |
| emergencyName | text | — | max 255 |
| emergencyPhone | PhoneInput | — | نفس regex |

**اختبارات validation:**
- [ ] submit فارغ → أخطاء على firstName/lastName/phone بالعربي
- [ ] phone `+96650` → خطأ `رقم سعودي غير صحيح`
- [ ] phone `+9715012345` (إمارات) → خطأ (الregex سعودي فقط)
- [ ] phone `+966501234567` → مقبول
- [ ] emergencyPhone نفس قواعد phone

**⚠️ Red flag:** رسالة الخطأ لازم بالعربي — إذا ظهرت `Invalid phone` بالإنجليزي فهو bug في i18n.

### 6.4 البطاقة 3 — طبي
- bloodType: grid 4×2 عدا UNKNOWN (8 خيارات: A/B/AB/O × +/−)
- allergies: textarea max 1000، 3 rows، counter `0/1000`
- chronicConditions: نفس allergies

**اختبارات:**
- [ ] كل 8 فصائل قابلة للاختيار + زر clear
- [ ] textarea > 1000 حرف → قص أو خطأ
- [ ] counter يحدّث لحظياً

### 6.5 تقديم الـ Form
- [ ] اضغط `حفظ` → `POST /dashboard/people/clients`
- [ ] payload يحمل كل الحقول المملوءة فقط
- [ ] نجاح → redirect لـ `/clients` أو `/clients/{newId}`
- [ ] toast بالعربي

**تحقق DB:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "$API/dashboard/people/clients/<newId>" | jq
# تحقق: firstName, lastName, phone, gender, bloodType, nationality = السعودية
```

---

## 7. تعديل عميل — `/clients/[id]/edit`

### 7.1 تحميل البيانات
- [ ] الصفحة تحمّل `GET /dashboard/people/clients/{id}`
- [ ] كل الحقول prefilled بالقيم الحالية
- [ ] إذا bloodType = null → لا اختيار
- [ ] `isActive` switch يظهر (create لا يعرضه)

### 7.2 تعديل + حفظ
- [ ] غيّر firstName → `PATCH` يرسل فقط `firstName`
- [ ] غيّر phone لقيمة غير صحيحة → validation error
- [ ] غيّر bloodType من A+ إلى O− → save → reload → قيمة جديدة محفوظة
- [ ] Toggle `isActive` → يعمل

**⚠️ Red flag:** بعد Select onChange (gender/bloodType/nationality) — أعد فتح الـ edit وتحقق أن القيمة الجديدة هي المعروضة، ليس القديمة.

### 7.3 schema على Edit
كل الحقول optional، لكن إذا مُرسلة فلها validation

- [ ] امسح firstName → save → هل يسمح؟ (الـ schema optional لكن backend قد يرفض)
- [ ] phone فارغ مُرسل → تحقق السلوك

---

## 8. صفحة التفاصيل — `/clients/[id]`

**ملاحظة:** تفاصيل كاملة (صفحة مستقلة، ليس sheet).

- [ ] يعرض: الاسم، الاتصال، الطوارئ، الطبي، تاريخ الانضمام
- [ ] tab/section للحجوزات المرتبطة
- [ ] زر `تعديل` → `/clients/{id}/edit`
- [ ] زر `حذف` يفتح DeleteClientDialog

---

## 9. حذف عميل — DeleteClientDialog

### 9.1 Dialog
- Title: `clients.delete.title`
- Description: `سيتم حذف <اسم العميل> بشكل دائم`
- Buttons: `إلغاء` + `حذف` (destructive)

### 9.2 اختبارات
- [ ] الاسم في الوصف يطابق الصف المختار (ليس صف آخر — red flag!)
- [ ] زر `إلغاء` يغلق بدون request
- [ ] زر `حذف` → `DELETE /dashboard/people/clients/{id}` → 204
- [ ] zaid disabled أثناء pending
- [ ] toast نجاح + صف يختفي

### 9.3 حذف عميل له حجوزات
- [ ] backend قد يرجع 409 أو يمنع
- [ ] رسالة خطأ واضحة بالعربي
- [ ] لا يحذف Dialog تلقائياً لو فشل

---

## 10. Pagination

- [ ] 21+ عميل → pagination يظهر
- [ ] previous disabled في page 1
- [ ] next يحدّث الجدول
- [ ] الفلاتر تبقى عند تغيير الصفحة

---

## 11. RTL + Dark Mode

### RTL
- [ ] Breadcrumbs RTL
- [ ] zar `+ إضافة عميل` يسار PageHeader
- [ ] أيقونات الإجراءات في نهاية الصف
- [ ] PhoneInput — كود الدولة في اليمين، الرقم يسار

### Dark
- [ ] StatsGrid بطاقات glass شفافة
- [ ] شارات Walk In / Active / Inactive contrast سليم
- [ ] email verified ✓ ظاهر

---

## 12. Edge Cases

### 12.1 عميل walk_in
- [ ] يظهر `Walk In` badge في العمود 1
- [ ] DeleteClientDialog يعمل
- [ ] Edit يعمل بنفس الحقول

### 12.2 حقول optional فارغة
- [ ] nationalId فارغ → يحفظ null
- [ ] reload → الحقل فارغ (ليس "null" نصي)

### 12.3 nationalId مكرر
- [ ] أنشئ عميل بـ nationalId موجود → backend يرفض؟ تحقق ورسالة خطأ

### 12.4 phone مكرر
- [ ] نفس الاختبار للـ phone

### 12.5 اسم طويل جداً
- [ ] 255 حرف → مقبول
- [ ] 256 → خطأ "اسم طويل"

### 12.6 allergies/chronic > 1000
- [ ] textarea يمنع الكتابة أو يعرض خطأ

### 12.7 dateOfBirth في المستقبل
- [ ] date picker يحظر التواريخ المستقبلية (max = today)

### 12.8 emailVerified toggle
- [ ] لا يوجد في UI — تأكد أنه backend-only

---

## 13. Screenshots مطلوبة

احفظ في `docs/superpowers/qa/screenshots/clients/`:
1. `list-light-rtl.png`
2. `list-dark-rtl.png`
3. `create-form.png`
4. `edit-form.png`
5. `detail-page.png`
6. `delete-dialog.png`
7. `empty-state.png`
8. `validation-errors.png` — phone + required errors ظاهرة

---

## 14. أوامر curl

```bash
TOKEN="<jwt>"
API="http://localhost:5100"

# قائمة
curl -H "Authorization: Bearer $TOKEN" \
  "$API/dashboard/people/clients?page=1&limit=20&isActive=true&search=أحمد" | jq

# عميل واحد
curl -H "Authorization: Bearer $TOKEN" "$API/dashboard/people/clients/<id>" | jq

# إنشاء
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"firstName":"اختبار","lastName":"التجربة","phone":"+966501234567","gender":"male","nationality":"السعودية"}' \
  "$API/dashboard/people/clients" | jq

# تعديل
curl -X PATCH -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"bloodType":"O_POS","allergies":"بنسلين"}' \
  "$API/dashboard/people/clients/<id>" | jq

# تعطيل
curl -X PATCH -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"isActive":false}' \
  "$API/dashboard/people/clients/<id>" | jq

# حذف
curl -X DELETE -H "Authorization: Bearer $TOKEN" \
  "$API/dashboard/people/clients/<id>"
```

---

## 15. Red Flags

- ⚠️ **Boolean param:** `isActive=false` لازم يرجع غير النشطين فعلاً
- ⚠️ **Ghost param:** `status=all` ما يرسل param، فقط يحذفه
- ⚠️ **Stale dialog:** اسم العميل في DeleteDialog يطابق الصف المختار (ليس hover)
- ⚠️ **Select onChange:** bloodType/gender/nationality — أعد فتح edit بعد save للتأكد
- ⚠️ **Phone regex سعودي فقط:** `+9665` فقط — هل المتطلب هذا؟ أو دولي؟
- ⚠️ **i18n:** كل validation messages بالعربي
- ⚠️ **Walk-in accountType:** قد يكون `"WALK_IN"` أو `"walk_in"` — تحقق case consistency
- ⚠️ **Soft delete:** backend يفلتر `deletedAt: null` — عميل محذوف لا يظهر في GET

---

## 16. معايير النجاح

- [ ] كل سيناريوهات 3-10 passed
- [ ] Validation (قسم 6 + 7) كامل
- [ ] DB fidelity (curl checks) يطابق UI
- [ ] RTL + Dark screenshots مراجعة
- [ ] كل red flags في 15 محقق منها
- [ ] لا console errors
- [ ] Screenshots محفوظة
