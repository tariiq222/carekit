# خطة اختبار E2E — نماذج التقييم (Intake Forms)

> **المسار:** `/intake-forms` · `/intake-forms/create` · `/intake-forms/[id]/edit`
> **آخر تحديث:** 2026-04-17

---

## 1. التحضير

```bash
cd apps/backend && npm run dev
cd apps/dashboard && npm run dev
```

**البيانات:**
- 4+ نماذج — واحد لكل type (pre_booking/pre_session/post_session/registration)
- نموذج scope=global
- نموذج scope=service مرتبط بخدمة موجودة
- نموذج scope=employee
- نموذج scope=branch
- نموذج فيه field بـ condition (conditional visibility)
- نموذج له submissions (> 0)

---

## 2. خريطة الصفحة

```text
Breadcrumbs
PageHeader   [عنوان+وصف]                 [+ إنشاء نموذج]
StatsGrid    [إجمالي النماذج] [نشط] [الإجابات]
FilterBar    [بحث] [إعادة تعيين]    (لا فلاتر dropdown!)
DataTable    [الاسم] [النوع] [النطاق] [الحقول] [الإجابات] [النشاط] [إجراءات]
Dialogs      FormPreviewDialog · DeleteAlert (inline)
Routes       /intake-forms/create, /intake-forms/[id]/edit
```

**ملاحظة:** StatsGrid هنا 3 بطاقات فقط (ليس 4 — استثناء من القاعدة).

---

## 3. التحميل

- [ ] `GET /dashboard/organization/intake-forms` → 200
- [ ] StatsGrid:
  - إجمالي = `forms.length`
  - نشط = عدد isActive=true
  - الإجابات = مجموع `submissionsCount` (ليس عدد النماذج!)
- [ ] أيقونات: DocumentValidation/CheckmarkCircle01/FileEdit

---

## 4. FilterBar

- بحث فقط — يطابق nameEn, nameAr, scopeLabel
- لا dropdown filters في صفحة القائمة (مختلف عن باقي الصفحات)
- [ ] reset يمسح البحث

---

## 5. الجدول

| # | العمود | المحتوى |
|---|--------|---------|
| 1 | الاسم | nameAr (primary) + nameEn (muted) |
| 2 | النوع | Badge بلون حسب TYPE_BADGE_STYLES |
| 3 | النطاق | label + scopeLabel (اسم الخدمة/الموظف/الفرع) |
| 4 | الحقول | عدد (numeric) |
| 5 | الإجابات | `submissionsCount` مع locale |
| 6 | النشاط | Toggle switch inline + "نشط/غير نشط" |
| 7 | إجراءات | Preview (eye), Edit (pencil), Delete (trash) |

اختبارات:
- [ ] كل 4 أنواع تظهر بألوان مختلفة:
  - `pre_booking` - لون X
  - `pre_session` - لون Y
  - `post_session` - لون Z
  - `registration` - لون W
- [ ] scope=global → scopeLabel = "عام"
- [ ] scope=service → scopeLabel = اسم الخدمة
- [ ] scope=employee → اسم الموظف
- [ ] scope=branch → اسم الفرع

### 5.1 Toggle Active inline
- [ ] اضغط switch → `PATCH /dashboard/organization/intake-forms/{id}` body `{isActive: !current}`
- [ ] toast + الصف يحدّث بدون reload
- [ ] حالة متزامنة مع backend

---

## 6. المعاينة — FormPreviewDialog

- [ ] يعرض الحقول read-only
- [ ] لكل حقل: labelEn/labelAr + fieldType + required indicator + options (للـ radio/checkbox/select)
- [ ] condition إذا موجود — يعرض `يظهر إذا <fieldX> <operator> <value>`
- [ ] يحترم locale UI الحالي

---

## 7. إنشاء — `/intake-forms/create`

### 7.1 Form Info Panel
| الحقل | نوع | مطلوب | validation |
|-------|-----|-------|------------|
| nameEn | text | ✓ | min 1 |
| nameAr | text | ✓ | min 1 |
| type | select | ✓ | enum 4 |
| scope | select | ✓ | enum 4 |
| scopeId | select | conditional | مطلوب إذا scope ≠ global |
| isActive | switch | — | default true |

اختبارات:
- [ ] scope = global → scopeId يختفي أو disabled
- [ ] scope = service → scopeId dropdown الخدمات يظهر
- [ ] scope = employee → dropdown الموظفين
- [ ] scope = branch → dropdown الفروع
- [ ] تبديل scope يعيد scopeId للفراغ

### 7.2 Field Editor
لكل حقل:
| الحقل | نوع | مطلوب | validation |
|-------|-----|-------|------------|
| labelEn | text | ✓ | min 1 |
| labelAr | text | ✓ | min 1 |
| fieldType | select | ✓ | 9 قيم |
| isRequired | switch | — | — |
| options[] | list | ✓ إذا radio/checkbox/select | ≥ 1 option |
| condition.fieldId | select | — | من الحقول السابقة |
| condition.operator | select | — | equals/not_equals/contains |
| condition.value | text | — | — |
| sortOrder | number | — | — |

**أنواع الحقول (9):** text, textarea, number, radio, checkbox, select, date, rating, file

اختبارات:
- [ ] أضف 5+ حقول من أنواع مختلفة
- [ ] radio بدون options → خطأ
- [ ] checkbox مع option واحد → خطأ أو مقبول؟
- [ ] rating — نطاق (1-5)؟
- [ ] file — أنواع مسموحة؟ حجم؟
- [ ] condition: حقل 3 يظهر فقط إذا حقل 1 = "نعم"
  - [ ] في preview — حقل 3 مخفي افتراضياً
  - [ ] غيّر حقل 1 إلى "نعم" → حقل 3 يظهر
- [ ] condition على حقل يأتي بعد الحالي → خطأ (forward reference)
- [ ] حذف حقل له dependents — dependents تتعطل أو تبقى orphaned؟

### 7.3 Submit
- [ ] Create يستخدم endpointin:
  1. `POST /dashboard/organization/intake-forms` (info)
  2. `PUT /dashboard/organization/intake-forms/{id}/fields` (الحقول)
- [ ] atomic — إذا الثاني فشل، الأول يُعكس؟
- [ ] redirect → `/intake-forms`

---

## 8. تعديل — `/intake-forms/[id]/edit`

- [ ] معلومات النموذج prefilled
- [ ] الحقول محملة من GET
- [ ] إضافة حقل جديد + تعديل قديم + حذف حقل — كلها في submit واحد
- [ ] `PATCH /intake-forms/{id}` للـ info
- [ ] `PUT /intake-forms/{id}/fields` للحقول (full replace)
- [ ] submissions السابقة تبقى صالحة؟ أم يتم invalidate؟

⚠️ **Red flag:** PUT full replace — إذا مستخدم حذف كل الحقول بالخطأ، الإجابات القديمة تحتوي fieldIds لا يعرفها النموذج الحالي.

---

## 9. حذف — Delete Alert (inline)

- [ ] Title + confirm message
- [ ] اسم النموذج في الوصف يطابق الصف
- [ ] `DELETE /dashboard/organization/intake-forms/{id}`
- [ ] نموذج له submissions — cascade؟ soft delete؟

---

## 10. عرض الإجابات (Responses)

- [ ] `GET /dashboard/organization/intake-forms/responses/{bookingId}`
- [ ] هل هناك UI في صفحة الحجز يعرض الإجابة؟ تحقق

---

## 11. Edge Cases

### 11.1 نموذج بـ 0 حقول
- [ ] UI يسمح؟ أم required ≥ 1؟
- [ ] Preview dialog يعرض empty state

### 11.2 scope=service مع خدمة محذوفة
- [ ] scopeLabel كيف يظهر؟
- [ ] النموذج يصبح orphaned؟

### 11.3 Type = registration
- [ ] يُعرض في أي flow؟ تسجيل العميل؟
- [ ] scope يجب أن يكون global؟

### 11.4 Type = pre_booking + scope = service
- [ ] هل يظهر في flow الحجز للخدمة المحددة فقط؟

### 11.5 Condition معقد
- [ ] حقل يعتمد على حقل يعتمد على حقل (chain)
- [ ] contains operator على رقم — السلوك؟

### 11.6 isActive = false
- [ ] النموذج لا يظهر في flow العميل
- [ ] لكن موجود في admin list

---

## 12. RTL + Dark
- [ ] field editor يعمل RTL
- [ ] badges بألوان مختلفة لكل type
- [ ] Preview dialog glass صحيح

---

## 13. Screenshots
`screenshots/intake-forms/`:
1. `list.png`
2. `preview-dialog.png`
3. `create-info-panel.png`
4. `field-editor-all-types.png`
5. `condition-editor.png`
6. `edit-page.png`
7. `delete-confirm.png`

---

## 14. curl

```bash
# قائمة
curl -H "Authorization: Bearer $TOKEN" \
  "$API/dashboard/organization/intake-forms?scope=service&type=pre_booking" | jq

# إنشاء
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nameAr":"تقييم قبل الحجز","nameEn":"Pre-booking","type":"pre_booking","scope":"global","isActive":true}' \
  "$API/dashboard/organization/intake-forms" | jq

# حفظ الحقول
curl -X PUT -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fields":[{"labelAr":"العمر","labelEn":"Age","fieldType":"number","isRequired":true,"sortOrder":1}]}' \
  "$API/dashboard/organization/intake-forms/<id>/fields" | jq

# تبديل النشاط
curl -X PATCH -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"isActive":false}' \
  "$API/dashboard/organization/intake-forms/<id>" | jq

# إجابة حجز
curl -H "Authorization: Bearer $TOKEN" \
  "$API/dashboard/organization/intake-forms/responses/<bookingId>" | jq
```

---

## 15. Red Flags

- ⚠️ **PUT fields = full replace** — حذف حقل يفصل submissions قديمة
- ⚠️ **Two-step save** (info ثم fields) — atomic؟
- ⚠️ **Condition forward reference** — حقل يعتمد على حقل لاحق
- ⚠️ **Conditional scopeId** — تبديل scope بدون مسح scopeId
- ⚠️ **File fieldType** — أنواع/حجم/تخزين غير موثق
- ⚠️ **Orphaned scope** — خدمة محذوفة تترك النموذج
- ⚠️ **Boolean isActive** في inline toggle
- ⚠️ No dropdown filters — بحث فقط، قد يكون بطيء لـ 100+ نموذج

---

## 16. النجاح
- [ ] كل 4 types × 4 scopes covered
- [ ] كل 9 fieldTypes مختبرة
- [ ] Condition editor passes
- [ ] Inline toggle passes
- [ ] Two-step save atomic
- [ ] Screenshots + curl
