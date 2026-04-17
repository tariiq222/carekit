# خطة اختبار E2E — صفحة الموظفين (Employees)

> **المسار:** `/employees` · `/employees/create` · `/employees/[id]` · `/employees/[id]/edit`
> **الأداة:** Chrome DevTools MCP
> **آخر تحديث:** 2026-04-17

---

## 1. التحضير

### 1.1 البيئة
```bash
cd apps/backend && npm run dev        # :5100
cd apps/dashboard && npm run dev      # :5103
```

### 1.2 البيانات المطلوبة
- 10+ موظف (مزيج active/inactive)
- 3+ تخصصات (specialties)
- 2+ فروع (branches)
- 5+ خدمات موجودة مسبقاً (ليتم ربطها)
- موظف له ratings (للتحقق من متوسط التقييم)
- موظف بدون experience (يعرض `—`)

---

## 2. خريطة الصفحة

```text
Breadcrumbs
PageHeader    [عنوان+وصف]        [التقييمات (outline)] [+ إضافة موظف]
StatsGrid     [إجمالي] [نشط] [غير نشط] [متوسط التقييم]
FilterBar     [بحث] [الحالة▼] [إعادة تعيين]
DataTable     [الموظف] [البريد] [الخبرة] [التقييم] [الحالة] [إجراءات]
Pagination
Dialogs       DeleteEmployeeDialog · AssignServiceSheet · EditServiceSheet · AvailabilitySheet
```

---

## 3. تحميل الصفحة

### 3.1 تحميل أولي
```
navigate_page → /employees
take_snapshot
list_network_requests
```
- [ ] `GET /dashboard/people/employees?page=1&limit=20` → 200
- [ ] `GET /dashboard/people/employees/stats` → 200
- [ ] StatsGrid قيم `total/active/inactive/avgRating`
- [ ] أيقونات: Stethoscope/UserCheck/UserBlock/Star
- [ ] الألوان: primary/success/warning/accent
- [ ] لا console errors

### 3.2 StatsGrid verification
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "$API/dashboard/people/employees/stats" | jq
```
- [ ] `total` = إجمالي البطاقة
- [ ] `active` = عدد حيث isActive=true
- [ ] `avgRating` يطابق (1-5 decimal)

### 3.3 Empty state / Error
- بحث `zzz` → `لا يوجد موظفون`
- backend معطل → ErrorBanner

---

## 4. FilterBar

### 4.1 البحث
- debounced 300ms، backend
- يبحث: name (AR/EN), email

| مدخل | توقع |
|------|------|
| `د. سعد` | يطابق nameAr |
| `dr.` | يطابق nameEn |
| `@gmail` | يطابق email |

### 4.2 فلتر الحالة
- `all | active | inactive`
- [ ] `active` → `isActive=true` → كل الصفوف شارة خضراء
- [ ] `inactive` → `isActive=false`
- [ ] `all` → param يُحذف تماماً (**ghost param check!**)

**⚠️ تحقق `@Type(() => Boolean)` — `isActive=false` يرجع الفعلي غير النشطين**

### 4.3 زر التقييمات (PageHeader)
- [ ] اضغط `التقييمات` → ينقل لـ `/ratings` أو يفتح sheet
- [ ] variant = outline

---

## 5. الجدول

### 5.1 الأعمدة
| # | العمود | sortable | المحتوى |
|---|--------|----------|---------|
| 1 | الموظف | ✓ | avatar + nameAr + التخصص |
| 2 | البريد | ✗ | email أو `—` |
| 3 | الخبرة | ✓ | سنوات أو `—` |
| 4 | التقييم | ✓ | ⭐ 4.5 |
| 5 | الحالة | ✓ | نشط/غير نشط |
| 6 | إجراءات | ✗ | preview/edit/delete icons + Tooltip |

**اختبارات:**
- [ ] ترتيب بالخبرة تصاعدي/تنازلي → request يحمل `sortBy=experience&sortOrder=asc`
- [ ] موظف بدون رnameAr → يعرض nameEn fallback
- [ ] لا experience → `—`
- [ ] لا ratings → `—` أو `0`

### 5.2 قائمة الإجراءات
- [ ] `عرض` → `/employees/{id}`
- [ ] `تعديل` → `/employees/{id}/edit`
- [ ] `حذف` → DeleteEmployeeDialog

---

## 6. إنشاء موظف — `/employees/create`

### 6.1 الحقول الأساسية
| الحقل | نوع | مطلوب | validation |
|-------|-----|-------|------------|
| title | text | — | د./م./... |
| nameAr | text | ✓ | min 1 |
| nameEn | text | ✓ | min 1 |
| phone | PhoneInput | ✓ | regex دولي |
| email | text | — | email format |
| gender | radio | — | MALE/FEMALE |
| avatarUrl | upload | — | image |
| specialty | text/select | — | — |
| specialtyAr | text | — | — |
| bio | textarea | — | max 1000 |
| bioAr | textarea | — | max 1000 |
| education | textarea | — | — |
| educationAr | textarea | — | — |
| experience | number | — | int, min 0 |
| employmentType | select | — | FULL_TIME/PART_TIME/CONTRACT |

### 6.2 Multi-select حقول
- specialtyIds[] → dropdown multi، من `/dashboard/specialties`
- branchIds[] → dropdown multi، من `/dashboard/branches`
- serviceIds[] → dropdown multi

### 6.3 Validation
- [ ] submit فارغ → أخطاء على nameAr/nameEn/phone
- [ ] experience = -1 → خطأ
- [ ] experience = 1.5 → خطأ (int only)
- [ ] email صيغة خاطئة → خطأ
- [ ] phone غير صحيح → خطأ بالعربي

### 6.4 submit
- [ ] `POST /dashboard/people/employees`
- [ ] payload: name, nameAr, nameEn, phone, email, gender, avatarUrl, bio, employmentType, specialtyIds, branchIds, serviceIds
- [ ] redirect → `/employees/{newId}` أو `/employees`
- [ ] toast نجاح

**curl verify:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "$API/dashboard/people/employees/<id>" | jq
```

---

## 7. تعديل — `/employees/[id]/edit`

- [ ] كل الحقول prefilled
- [ ] `isActive` switch يظهر (create لا يعرضه)
- [ ] عدّل nameAr → `PATCH` → DB يعكس
- [ ] Toggle `isActive` → يعمل
- [ ] غيّر specialtyIds (أضف/احذف) → `PATCH` payload يحمل مصفوفة كاملة

**⚠️ Red flag:** تعديل multi-select — أعد فتح edit وتحقق أن selection محفوظ.

---

## 8. صفحة التفاصيل — `/employees/[id]`

- [ ] header: avatar + nameAr + التخصص + rating
- [ ] tabs/sections:
  - معلومات عامة
  - الخدمات (قائمة + أزرار إدارة)
  - الجدول الأسبوعي (availability)
  - الاستراحات (breaks)
  - الإجازات (exceptions)
  - التقييمات (من العملاء)

### 8.1 إدارة الخدمات
**قائمة الخدمات الحالية:**
- [ ] كل خدمة: الاسم، السعر، bufferMinutes، isActive، زر تعديل، زر إزالة
- [ ] زر `+ إضافة خدمة` → AssignServiceSheet

**AssignServiceSheet:**
| الحقل | نوع | مطلوب | validation |
|-------|-----|-------|------------|
| serviceId | select | ✓ | min 1 (Service is required) |
| bufferMinutes | number | ✓ | int, min 0 |
| isActive | switch | ✓ | boolean |

- [ ] submit فارغ → خطأ على serviceId
- [ ] bufferMinutes = -5 → خطأ
- [ ] نجاح → `POST /dashboard/people/employees/{id}/services` → صف جديد يظهر

**EditServiceSheet:**
| الحقل | نوع | required | validation |
|-------|-----|----------|------------|
| bufferMinutes | number | ✓ | int, min 0 |
| isActive | switch | ✓ | boolean |

- [ ] `PATCH /dashboard/people/employees/{id}/services/{serviceId}` body `{bufferMinutes, isActive}`

**إزالة خدمة:**
- [ ] confirm dialog
- [ ] DELETE endpoint
- [ ] إذا الخدمة مربوطة بحجوزات قادمة — قد يمنع

### 8.2 Availability Scheduler
**7 أيام (السبت - الجمعة حسب weekStartDay):**

- [ ] كل يوم: windows[] (من-إلى)، toggle day off
- [ ] إضافة window ثاني لنفس اليوم (shift مقسّم)
- [ ] تداخل windows في نفس اليوم → validation error
- [ ] حفظ → `POST /dashboard/people/employees/{id}/availability`
- [ ] payload: `{windows: [...], exceptions: [...]}`

**Windows:**
- start: time (HH:MM)
- end: time (HH:MM)
- end > start (validation)

### 8.3 Breaks
- [ ] إضافة break: day + start + end
- [ ] break خارج window → خطأ
- [ ] حفظ → `POST /dashboard/people/employees/{id}/breaks`

### 8.4 Exceptions (إجازات)
- [ ] إضافة: startDate، endDate، reason
- [ ] endDate < startDate → خطأ
- [ ] exception تتداخل مع حجز موجود → تحذير

---

## 9. حذف — DeleteEmployeeDialog

- [ ] اسم الموظف في الوصف يطابق الصف المختار
- [ ] `DELETE /dashboard/people/employees/{id}` → 204
- [ ] موظف له حجوزات قادمة → backend يرفض + رسالة واضحة

---

## 10. RTL + Dark

### RTL
- [ ] Availability grid: السبت يمين، الجمعة يسار
- [ ] أزرار الإجراءات نهاية الصف
- [ ] PhoneInput كود الدولة يمين

### Dark
- [ ] StatsGrid glass شفاف
- [ ] شارات rating نجوم بـ accent color
- [ ] scheduler contrast سليم

---

## 11. Edge Cases

### 11.1 موظف بدون specialty
- [ ] يعرض `—` في العمود
- [ ] backend يسمح

### 11.2 experience = 0
- [ ] يعرض `0` أو `جديد`

### 11.3 rating لم يتلقَّ تقييمات
- [ ] avgRating = null → `—`

### 11.4 تضارب schedule مع حجوزات
- [ ] تعديل availability يقطع حجز — تحذير/منع

### 11.5 تضارب branches
- [ ] موظف في فرعين، كل فرع جدول مختلف — تحقق

### 11.6 حذف خدمة مستخدمة
- [ ] خدمة لها حجوزات قادمة — منع أو تحذير

### 11.7 onboarding workflow
- [ ] `POST /onboarding` endpoint — جرّب إذا ظاهر في UI
- [ ] OnboardingStatus: PENDING → IN_PROGRESS → COMPLETED

---

## 12. Screenshots

`docs/superpowers/qa/screenshots/employees/`:
1. `list-light-rtl.png`
2. `list-dark-rtl.png`
3. `create-form.png`
4. `detail-page.png`
5. `availability-scheduler.png`
6. `assign-service-sheet.png`
7. `edit-service-sheet.png`
8. `delete-dialog.png`
9. `empty-state.png`

---

## 13. curl

```bash
TOKEN="<jwt>"
API="http://localhost:5100"

# قائمة
curl -H "Authorization: Bearer $TOKEN" \
  "$API/dashboard/people/employees?page=1&limit=20&search=سعد&isActive=true" | jq

# stats
curl -H "Authorization: Bearer $TOKEN" \
  "$API/dashboard/people/employees/stats" | jq

# تفاصيل
curl -H "Authorization: Bearer $TOKEN" \
  "$API/dashboard/people/employees/<id>" | jq

# availability
curl -H "Authorization: Bearer $TOKEN" \
  "$API/dashboard/people/employees/<id>/availability" | jq

# إضافة خدمة
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"serviceId":"<uuid>","bufferMinutes":15,"isActive":true}' \
  "$API/dashboard/people/employees/<id>/services" | jq
```

---

## 14. Red Flags

- ⚠️ **Boolean filter:** `isActive=false` bug
- ⚠️ **Ghost param:** `isActive=all` لا يرسل
- ⚠️ **Multi-select onChange:** specialtyIds/branchIds — تحقق double-save
- ⚠️ **Schedule overlap:** windows متداخلة لنفس اليوم
- ⚠️ **Timezone:** start/end times UTC vs local
- ⚠️ **Stale dialog:** DeleteDialog اسم صحيح
- ⚠️ **Service removal cascade:** موظف بدون خدمات — حجوزاته القادمة؟
- ⚠️ **Walk-in flag:** احذر التعامل مع accountType

---

## 15. معايير النجاح

- [ ] 3-9 سيناريوهات passed
- [ ] scheduler (8.2-8.4) full coverage
- [ ] services CRUD (8.1) full
- [ ] RTL + Dark screenshots
- [ ] red flags محقق منها
- [ ] curl matches UI state
