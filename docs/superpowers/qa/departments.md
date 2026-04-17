# خطة اختبار E2E — صفحة الأقسام (Departments)

> **المسار:** `/departments` (قائمة + dialogs)
> **آخر تحديث:** 2026-04-17

---

## 1. التحضير

```bash
cd apps/backend && npm run dev
cd apps/dashboard && npm run dev
```

**البيانات:** 5+ أقسام، بعضها مع categories مرتبطة.

---

## 2. خريطة الصفحة

```text
Breadcrumbs
PageHeader   [عنوان+وصف]            [+ إضافة قسم]
StatsGrid    [إجمالي] [نشط] [غير نشط] [جديد هذا الشهر]
FilterBar    [بحث] [الحالة▼] [إعادة تعيين]
DataTable    [الاسم AR] [الاسم EN] [الوصف] [الترتيب] [الفئات] [الحالة] [إجراءات]
Dialogs      CreateDepartmentDialog · EditDepartmentDialog · DeleteDepartmentDialog
```

---

## 3. التحميل

- [ ] `GET /dashboard/organization/departments?page=1&limit=20` → 200
- [ ] StatsGrid من `stats` endpoint أو مشتق
- [ ] أيقونات: Building06/CheckmarkCircle02/Cancel01/CalendarAdd02

---

## 4. FilterBar

- بحث: يشمل nameAr/nameEn/description
- حالة: `all | active | inactive`
- [ ] Boolean bug + ghost param checks

---

## 5. الجدول

| # | العمود | المحتوى |
|---|--------|---------|
| 1 | nameAr | اسم عربي |
| 2 | nameEn | اسم إنجليزي (muted) |
| 3 | الوصف | descriptionAr/En مقطوع |
| 4 | الترتيب | sortOrder |
| 5 | الفئات | `_count.categories` |
| 6 | الحالة | badge |
| 7 | إجراءات | Edit, Delete |

---

## 6. Create/Edit Dialog

### الحقول
| الحقل | نوع | مطلوب | validation |
|-------|-----|-------|------------|
| nameAr | text | ✓ | min 1, max 200, trim |
| nameEn | text | ✓ | min 1, max 200, trim |
| descriptionAr | text | — | max 1000 |
| descriptionEn | text | — | max 1000 |
| icon | text | — | max 100 (icon name) |
| sortOrder | number | — | min 0, default 0 |
| isActive | switch | ✓ | default true |

### Validation
- [ ] submit فارغ → أخطاء nameAr + nameEn
- [ ] nameAr = 201 → خطأ
- [ ] description > 1000 → خطأ
- [ ] sortOrder = -1 → خطأ
- [ ] icon name غير موجود في المكتبة → يحفظ لكن لا يعرض
- [ ] regex patterns على الاسم (تحقق من الـ schema)

### Submit
- [ ] `POST /dashboard/organization/departments`
- [ ] `PATCH /dashboard/organization/departments/{id}` للتعديل

---

## 7. حذف — DeleteDepartmentDialog

- [ ] اسم القسم يطابق الصف
- [ ] `DELETE` → `{deleted: true}` (ليس 204!)
- [ ] قسم فيه فئات → رفض أو cascade؟ تحقق

---

## 8. Edge Cases

- [ ] icon فارغ — الجدول يعرض icon افتراضي؟
- [ ] description فارغ — الجدول يعرض `—`
- [ ] sortOrder مكرر — يُسمح، الترتيب متوقع كيف؟
- [ ] department معطل لكن له categories نشطة — ما السلوك في قائمة الخدمات؟

---

## 9. RTL + Dark
- [ ] nameAr RTL input
- [ ] glass cards صحيح

---

## 10. Screenshots
1. `list.png`
2. `create-dialog.png`
3. `edit-dialog.png`
4. `delete-dialog.png`

---

## 11. curl

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "$API/dashboard/organization/departments?page=1&limit=20&isActive=true" | jq

curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nameAr":"أسنان","nameEn":"Dentistry","descriptionAr":"قسم الأسنان","sortOrder":1,"isActive":true}' \
  "$API/dashboard/organization/departments" | jq

curl -X PATCH -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"isActive":false}' \
  "$API/dashboard/organization/departments/<id>" | jq
```

---

## 12. Red Flags

- ⚠️ Delete response `{deleted}` بدل 204 — تحقق UI يفهمها
- ⚠️ Boolean isActive bug
- ⚠️ Ghost param
- ⚠️ Cascade delete categories
- ⚠️ nameAr + nameEn كلاهما required (مختلف عن categories)

---

## 13. النجاح
- [ ] CRUD كامل
- [ ] Validation كل الحقول
- [ ] Cascade categories سلوك واضح
- [ ] curl fidelity
