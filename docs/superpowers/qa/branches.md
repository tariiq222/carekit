# خطة اختبار E2E — صفحة الفروع (Branches)

> **المسار:** `/branches` · `/branches/create` · `/branches/[id]/edit`
> **آخر تحديث:** 2026-04-17

---

## 1. التحضير

```bash
cd apps/backend && npm run dev
cd apps/dashboard && npm run dev
```

**البيانات:**
- 3+ فروع (فرع رئيسي واحد `isMain=true`)
- 5+ موظفين (بعضهم معيّن لفروع، بعضهم لا)
- فرع inactive للاختبار

---

## 2. خريطة الصفحة

```text
Breadcrumbs
PageHeader   [عنوان+وصف]                 [+ إضافة فرع]
StatsGrid    [إجمالي] [نشط] [غير نشط] [الرئيسي]
FilterBar    [بحث] [الحالة▼] [إعادة تعيين]
DataTable    [الاسم] [العنوان] [الهاتف] [رئيسي] [الحالة] [إجراءات]
Dialogs      DeleteBranchDialog · BranchEmployeesDialog
```

---

## 3. التحميل الأولي

```
navigate_page → /branches
```
- [ ] `GET /dashboard/organization/branches?page=1&limit=20` → 200
- [ ] StatsGrid: Total/Active/Inactive من meta، **Main** = عدد `isMain=true`
- [ ] أيقونات: Building06/CheckmarkCircle02/Cancel01/Star
- [ ] لا console errors

### Empty / Error
- [ ] بحث بلا نتائج → empty state
- [ ] backend off → ErrorBanner

---

## 4. FilterBar

### 4.1 البحث
- debounced، backend
- يبحث: nameAr, nameEn, address
- [ ] `الرياض` → request `search=الرياض`

### 4.2 الحالة
- `all | active | inactive`
- [ ] boolean bug check (`isActive=false` فعلاً يفلتر)
- [ ] `all` → لا param

### 4.3 Reset
- [ ] يمسح كل فلاتر

---

## 5. الجدول

| # | العمود | المحتوى |
|---|--------|---------|
| 1 | الاسم | nameAr (primary) + nameEn (muted) |
| 2 | العنوان | addressAr أو addressEn |
| 3 | الهاتف | tabular-nums، ltr |
| 4 | رئيسي | badge `Main` (primary) فقط إذا isMain |
| 5 | الحالة | badge |
| 6 | إجراءات | dropdown (MoreHorizontal) |

اختبارات:
- [ ] `Main` badge يظهر **فقط** للفرع الرئيسي
- [ ] الهاتف ltr حتى في UI عربي
- [ ] فرع بدون phone → `—`
- [ ] فرع بدون address → `—`

### 5.1 قائمة الإجراءات
| خيار | التوقع |
|------|--------|
| إدارة الموظفين | يفتح BranchEmployeesDialog |
| تعديل | `/branches/{id}/edit` |
| تفعيل/تعطيل | `PATCH` مع `isActive` toggle |
| تعيين كرئيسي | `PATCH` مع `isMain=true` (يلغي الرئيسي السابق) |
| حذف | DeleteBranchDialog |

**اختبار "تعيين كرئيسي":**
- [ ] الخيار يظهر **فقط** إذا الفرع ليس main حالياً
- [ ] اضغط → confirm → `PATCH {isMain: true}`
- [ ] الفرع القديم تلقائياً `isMain: false`
- [ ] StatsGrid `الرئيسي` يبقى 1

**Toggle active:**
- [ ] فرع active → toggle → inactive
- [ ] إذا الفرع هو main و active — هل يسمح بتعطيله؟ تحقق

---

## 6. إدارة موظفي الفرع — BranchEmployeesDialog

- [ ] العنوان: `إدارة الموظفين — <اسم الفرع>`
- [ ] قسمان: `المعيّنون` + `المتاحون`

**المعيّنون:**
- [ ] قائمة موظفي الفرع مع زر `X` (إلغاء تعيين)
- [ ] `DELETE /dashboard/organization/branches/{branchId}/employees/{employeeId}` → 204

**المتاحون:**
- [ ] بحث + قائمة موظفين غير معيّنين
- [ ] زر `+` → `POST /dashboard/organization/branches/{branchId}/employees` body `{employeeId}`

اختبارات:
- [ ] موظف منقول من "متاح" إلى "معيّن" مباشرة
- [ ] skeleton أثناء التحميل
- [ ] إغلاق dialog ثم إعادة فتح → القائمة محدّثة
- [ ] موظف معيّن في فرعين — يظهر في كلاهما "معيّن"

---

## 7. إنشاء فرع — `/branches/create`

### 7.1 البطاقات
**البطاقة 1 — الأسماء:**
| الحقل | نوع | مطلوب | validation |
|-------|-----|-------|------------|
| nameEn | text | ✓ | min 1, max 255 |
| nameAr | text | ✓ | min 1, max 255 (RTL input) |

**البطاقة 2 — الإعدادات:**
| الحقل | نوع | مطلوب | validation |
|-------|-----|-------|------------|
| timezone | select | ✓ | IANA: Asia/Riyadh (default), Dubai, Kuwait, Bahrain, Qatar, Cairo, London, New_York |
| isMain | switch | ✓ | — |
| isActive | switch | ✓ | default true |

**البطاقة 3 — الاتصال:**
| الحقل | نوع | مطلوب | validation |
|-------|-----|-------|------------|
| address | text | — | max 500 |
| phone | PhoneInput | — | regex `/^\+[1-9]\d{6,14}$/` |

### 7.2 Validation
- [ ] submit فارغ → أخطاء على nameAr/nameEn/timezone
- [ ] nameAr = 256 حرف → خطأ
- [ ] phone `+0966` → خطأ (البداية لازم 1-9)
- [ ] phone `+1` → خطأ (< 7 أرقام)
- [ ] phone `+966501234567` → مقبول
- [ ] isMain = true وفيه فرع main آخر → backend يلغي الرئيسي السابق
- [ ] timezone غير موجود في القائمة → رفض

### 7.3 Submit
- [ ] `POST /dashboard/organization/branches`
- [ ] redirect → `/branches`
- [ ] toast

---

## 8. تعديل — `/branches/[id]/edit`

- [ ] كل الحقول prefilled
- [ ] غيّر timezone → save → `GET` يعكس
- [ ] toggle isMain — إذا من true إلى false، لازم فرع آخر يصير main، أو رفض؟
- [ ] غيّر address بالعربي + الإنجليزي
- [ ] city/country/latitude/longitude — في DTO لكن قد لا يكون في UI

---

## 9. حذف — DeleteBranchDialog

- [ ] اسم الفرع في description يطابق الصف
- [ ] loading state على زر الحذف
- [ ] `DELETE /dashboard/organization/branches/{id}` → 204
- [ ] فرع فيه موظفين — backend يرفض أو يفصلهم؟
- [ ] فرع فيه حجوزات قادمة — رفض
- [ ] حذف الفرع الرئيسي — رفض أو يعيّن رئيسي آخر تلقائياً؟

---

## 10. RTL + Dark

### RTL
- [ ] nameAr input RTL
- [ ] nameEn input LTR
- [ ] phone input — كود الدولة يمين
- [ ] timezone dropdown بالعربي

### Dark
- [ ] Main badge مرئي
- [ ] glass cards

---

## 11. Edge Cases

### 11.1 فرع بدون موظفين
- [ ] BranchEmployeesDialog `المعيّنون` فارغ → empty state

### 11.2 فرع بدون phone/address
- [ ] يعرض `—`

### 11.3 timezone change
- [ ] تغيير timezone — حجوزات الفرع القديمة تبقى بنفس الوقت UTC؟ تحقق

### 11.4 GPS coordinates
- [ ] إذا UI يدعم latitude/longitude — validation: lat [-90, 90], lng [-180, 180]
- [ ] map preview؟

### 11.5 فرع واحد فقط في النظام
- [ ] لا يمكن حذفه؟ لا يمكن تعطيله؟ — تحقق

### 11.6 تحويل main من فرع لآخر
- [ ] transaction atomic (لا يوجد لحظة بلا main)
- [ ] StatsGrid `الرئيسي` = 1 دائماً

### 11.7 phone international
- [ ] regex `/^\+[1-9]\d{6,14}$/` يسمح بأي كود دولي — اختبر +971 / +20 / +44

---

## 12. Screenshots

`screenshots/branches/`:
1. `list-light-rtl.png`
2. `list-dark-rtl.png`
3. `create-form.png`
4. `employees-dialog.png` (مع معيّنين ومتاحين)
5. `delete-dialog.png`
6. `main-badge.png` (close-up)
7. `set-primary-action.png`

---

## 13. curl

```bash
TOKEN="<jwt>"
API="http://localhost:5100"

# قائمة
curl -H "Authorization: Bearer $TOKEN" \
  "$API/dashboard/organization/branches?page=1&limit=20" | jq

# فرع واحد
curl -H "Authorization: Bearer $TOKEN" \
  "$API/dashboard/organization/branches/<id>" | jq

# إنشاء
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nameAr":"فرع الرياض","nameEn":"Riyadh Branch","timezone":"Asia/Riyadh","isMain":false,"isActive":true,"phone":"+966112345678"}' \
  "$API/dashboard/organization/branches" | jq

# تعيين رئيسي
curl -X PATCH -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"isMain":true}' \
  "$API/dashboard/organization/branches/<id>" | jq

# موظفو الفرع
curl -H "Authorization: Bearer $TOKEN" \
  "$API/dashboard/organization/branches/<id>/employees" | jq

# تعيين موظف
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"employeeId":"<uuid>"}' \
  "$API/dashboard/organization/branches/<id>/employees" | jq
```

---

## 14. Red Flags

- ⚠️ isMain transition — lost state (صفر فروع main في لحظة)
- ⚠️ Phone regex intl — ليس سعودي فقط (مختلف عن clients!)
- ⚠️ Boolean filter ghost
- ⚠️ Stale dialog employee list بعد assign/unassign
- ⚠️ حذف الفرع الوحيد/الرئيسي
- ⚠️ Timezone على مستوى الفرع — حجوزات يجب أن تحترم timezone الفرع لا المستخدم
- ⚠️ city/country/lat/lng في DTO لكن غير مستخدمة في UI — dead fields؟

---

## 15. معايير النجاح
- [ ] 3-9 passed
- [ ] BranchEmployeesDialog (6) full
- [ ] تعيين رئيسي + transaction صحيح
- [ ] RTL + Dark + screenshots
- [ ] curl fidelity
