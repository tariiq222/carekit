# خطة اختبار E2E — صفحة الفئات (Categories)

> **المسار:** `/categories` (قائمة بديالوجات Create/Edit، بدون صفحات منفصلة)
> **آخر تحديث:** 2026-04-17

---

## 1. التحضير

```bash
cd apps/backend && npm run dev
cd apps/dashboard && npm run dev
```

**البيانات:** 10+ فئات (مزيج active/inactive)، 3+ departments، بعض الفئات مربوطة بخدمات.

---

## 2. خريطة الصفحة

```text
Breadcrumbs
PageHeader   [عنوان+وصف]                 [+ إضافة فئة]
StatsGrid    [إجمالي] [نشط] [غير نشط] [جديد هذا الشهر]
FilterBar    [بحث] [الحالة▼] [إعادة تعيين]
DataTable    [الاسم] [الخدمات] [الترتيب] [الحالة] [إجراءات]
Dialogs      CreateCategoryDialog · EditCategoryDialog · DeleteCategoryDialog
```

---

## 3. التحميل الأولي

- [ ] `GET /dashboard/organization/categories?page=1&limit=20` → 200
- [ ] StatsGrid: Total/Active/Inactive/New This Month
- [ ] أيقونات: Tag01/CheckmarkCircle02/Cancel01/CalendarAdd02
- [ ] `New This Month` = عدد حيث `createdAt` في الشهر الحالي (تحقق curl)
- [ ] لا console errors

---

## 4. FilterBar

### 4.1 البحث
- debounced، backend
- يبحث في nameAr/nameEn

### 4.2 الحالة
- `all | active | inactive`
- [ ] `all` → param يُحذف (ghost check)
- [ ] Boolean bug check

### 4.3 Reset
- [ ] يمسح البحث + يرجع `all`

---

## 5. الجدول

| # | العمود | المحتوى |
|---|--------|---------|
| 1 | الاسم | nameAr (primary) + nameEn (muted) |
| 2 | الخدمات | `_count.services` |
| 3 | الترتيب | sortOrder رقم |
| 4 | الحالة | badge (success/10 أو muted) |
| 5 | إجراءات | dropdown: Edit, Delete |

- [ ] فئة بدون خدمات → `0`
- [ ] sortOrder = 0 يعرض `0` (ليس `—`)

---

## 6. إنشاء — CreateCategoryDialog

### 6.1 الحقول
| الحقل | نوع | مطلوب | validation |
|-------|-----|-------|------------|
| nameAr | text | ✓ | min 1, max 200, trim |
| nameEn | text | — | max 200 |
| departmentId | select | — | UUID (من `/dashboard/departments`) |
| sortOrder | number | — | 0-999 |

### 6.2 Validation
- [ ] submit فارغ → خطأ على nameAr
- [ ] nameAr 201 حرف → خطأ
- [ ] nameAr مع spaces فقط → خطأ (trim يرجع فارغ)
- [ ] sortOrder = -1 → خطأ
- [ ] sortOrder = 1000 → خطأ
- [ ] sortOrder = 1.5 → خطأ (int only)

### 6.3 Submit
- [ ] `POST /dashboard/organization/categories`
- [ ] Dialog يقفل، toast، جدول يحدّث
- [ ] فئة جديدة تظهر في أعلى أو حسب sortOrder

**⚠️ Bug history:** sortOrder كان unfillable — اختبر صراحة!

---

## 7. تعديل — EditCategoryDialog

نفس الحقول + `isActive` (switch)
- [ ] prefilled صحيح
- [ ] تبديل isActive → save → شارة الحالة تتغير
- [ ] تغيير departmentId → save → reload → يحفظ القيمة

⚠️ Red flag: `@Type(() => Boolean)` bug على isActive في PATCH

---

## 8. حذف — DeleteCategoryDialog

- [ ] اسم الفئة يطابق الصف (stale check)
- [ ] `DELETE` → 204
- [ ] فئة لها خدمات → backend يرفض أو يحذف cascade

---

## 9. Edge Cases

- [ ] sortOrder مكرر لفئتين — يُسمح؟ الجدول يرتّب كيف؟
- [ ] departmentId = null → تحقق السلوك
- [ ] فئة نشطة لكن department معطل — تظهر في dropdown خدمات؟
- [ ] حذف department → الفئات المرتبطة تصبح يتيمة أم تُحذف cascade؟

---

## 10. RTL + Dark
- [ ] nameAr RTL، nameEn LTR
- [ ] glass dialog

---

## 11. Screenshots
`screenshots/categories/`:
1. `list.png`
2. `create-dialog.png`
3. `edit-dialog.png`
4. `validation-errors.png`

---

## 12. curl

```bash
TOKEN="<jwt>"
API="http://localhost:5100"

curl -H "Authorization: Bearer $TOKEN" \
  "$API/dashboard/organization/categories?page=1&limit=20&isActive=true" | jq

curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nameAr":"تجميل","nameEn":"Cosmetic","sortOrder":10}' \
  "$API/dashboard/organization/categories" | jq

curl -X PATCH -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"isActive":false}' \
  "$API/dashboard/organization/categories/<id>" | jq
```

---

## 13. Red Flags

- ⚠️ **sortOrder unfillable** (bug تاريخي — اختبر!)
- ⚠️ Boolean isActive في PATCH
- ⚠️ Ghost param `status=all`
- ⚠️ stale delete dialog
- ⚠️ department cascade behavior

---

## 14. النجاح
- [ ] كل CRUD passed
- [ ] sortOrder يُقبل ويُحفظ
- [ ] validation كامل
- [ ] curl matches UI
