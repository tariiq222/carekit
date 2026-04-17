# خطة اختبار E2E — صفحة الخدمات (Services)

> **المسار:** `/services` · `/services/create` · `/services/[id]/edit`
> **آخر تحديث:** 2026-04-17

---

## 1. التحضير

```bash
cd apps/backend && npm run dev
cd apps/dashboard && npm run dev
```

**بيانات السيد:**
- 15+ خدمة (مزيج active/inactive/hidden)
- 4+ فئات (categories)
- 2+ فروع (لاختبار multi_branch إذا مفعّل)
- خدمة مع deposit مفعّل
- خدمة تسمح recurring
- خدمة بـ hidden price/duration

---

## 2. خريطة الصفحة

```text
Breadcrumbs
PageHeader   [عنوان+وصف]                   [+ إضافة خدمة]
StatsGrid    [إجمالي] [نشط] [غير نشط] [الفئات]
FilterBar    [بحث] [الحالة▼] [الفئة▼] [الفرع▼ *] [إعادة تعيين]
             * فقط إذا multi_branch مفعّل
DataTable    [الخدمة] [الفئة] [السعر] [المدة] [الحالة] [إجراءات]
Dialogs      ServiceDetailSheet · DeleteAlertDialog
```

---

## 3. التحميل الأولي

```
navigate_page → /services
take_snapshot
list_network_requests
```
- [ ] `GET /dashboard/organization/services?page=1&limit=20` → 200
- [ ] StatsGrid: Total/Active/Inactive من `listStats`، Categories من `categories.length`
- [ ] أيقونات: GridIcon/CheckmarkCircle02/Cancel01/Layers01
- [ ] لا console errors

### StatsGrid curl
```bash
curl -H "Authorization: Bearer $TOKEN" "$API/dashboard/organization/services?page=1&limit=1" | jq
```

### Empty / Error
- [ ] بحث بدون نتائج → empty state
- [ ] backend off → ErrorBanner

---

## 4. FilterBar

### 4.1 البحث
- debounced 300ms، backend
- يبحث في nameAr/nameEn/description
- [ ] `فحص` → request `search=فحص`

### 4.2 الحالة
- `all | active | inactive`
- [ ] `active` → `isActive=true`
- [ ] `all` → **param يُحذف**
- ⚠️ boolean bug check

### 4.3 الفئة
- dropdown من `/dashboard/categories`
- [ ] كل category تظهر باللغة الصحيحة (AR/EN)
- [ ] `all` → no `categoryId` param
- [ ] اختيار category → `categoryId=<uuid>` → جدول يفلتر

### 4.4 الفرع (feature flag)
- [ ] إذا `multi_branch` معطل → الفلتر لا يظهر
- [ ] إذا مفعّل → dropdown بالفروع
- [ ] اختيار فرع → request يحمل `branchId`

### 4.5 Reset
- [ ] يمسح كل الفلاتر، request نظيف

---

## 5. الجدول

| # | العمود | المحتوى |
|---|--------|---------|
| 1 | الخدمة | avatar/icon + nameAr + description مقطوع |
| 2 | الفئة | nameAr |
| 3 | السعر | `120.00` tabular-nums + `ر.س` |
| 4 | المدة | `30 دقيقة` |
| 5 | الحالة | badge |
| 6 | إجراءات | view/edit/delete icons |

اختبارات:
- [ ] خدمة بدون description → ما تظهر سطر ثاني
- [ ] السعر بـ 2 decimal دائماً
- [ ] icon مع iconBgColor صحيح
- [ ] delete icon بلون destructive (أحمر)

---

## 6. عرض التفاصيل — ServiceDetailSheet

- [ ] اضغط view → sheet يفتح (read-only)
- [ ] يعرض:
  - avatar + name + status badges
  - Basic: nameEn, nameAr, descAr, descEn, category
  - Pricing: price, duration
  - Booking settings: deposit (إذا مفعّل)، recurring، buffer (إذا >0)، minLead، maxAdvance، maxParticipants
  - Dates: created, updated (date-fns)
- [ ] زر `Edit` في footer → `/services/{id}/edit`

---

## 7. إنشاء خدمة — `/services/create`

### 7.1 الحقول الأساسية
| الحقل | نوع | مطلوب | validation |
|-------|-----|-------|------------|
| nameEn | text | ✓ | min 1 |
| nameAr | text | ✓ | min 1 |
| descriptionEn | textarea | — | — |
| descriptionAr | textarea | — | — |
| categoryId | select | ✓ | UUID |
| price | number | ✓ | > 0 |
| duration | number | ✓ | > 0 minutes |

### 7.2 إعدادات الأيقونة
- iconName: select من مكتبة أيقونات، max 100
- iconBgColor: color picker، regex `#[0-9A-Fa-f]{6}`
- imageUrl: upload بديل

### 7.3 Booking Settings
| الحقل | نوع | validation |
|-------|-----|------------|
| isActive | switch | default true |
| isHidden | switch | default false |
| hidePriceOnBooking | switch | default false |
| hideDurationOnBooking | switch | default false |
| bufferMinutes | number | 0-120 |
| depositEnabled | switch | default false |
| depositPercent | number | 1-100 (فقط إذا depositEnabled) |
| allowRecurring | switch | default false |
| allowedRecurringPatterns | multi-select | DAILY/WEEKLY/BIWEEKLY/MONTHLY |
| maxRecurrences | number | 1-52 default 12 |
| maxParticipants | number | 1-100 default 1 |
| minLeadMinutes | number | 0-1440 nullable |
| maxAdvanceDays | number | 1-365 nullable |
| branchIds[] | multi-select | UUIDs (إذا multi_branch) |
| calendarColor | color | regex hex |

### 7.4 Validation
- [ ] submit فارغ → أخطاء على nameAr/nameEn/categoryId/price/duration
- [ ] bufferMinutes = 121 → خطأ
- [ ] depositPercent = 0 → خطأ (min 1)
- [ ] depositPercent = 101 → خطأ
- [ ] depositPercent ظاهر فقط إذا depositEnabled = true
- [ ] maxRecurrences = 0 → خطأ
- [ ] maxRecurrences = 53 → خطأ
- [ ] minLeadMinutes = 1441 → خطأ (max 1440 = يوم واحد)
- [ ] iconBgColor = `red` → خطأ (لازم hex)
- [ ] allowedRecurringPatterns فارغ لكن allowRecurring=true → تحقق السلوك

### 7.5 Submit
- [ ] `POST /dashboard/organization/services`
- [ ] redirect → `/services`
- [ ] toast نجاح

**curl verify:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "$API/dashboard/organization/services?search=<name>" | jq '.data[0]'
```
- تحقق depositPercent, allowRecurring, bufferMinutes كلها محفوظة

---

## 8. تعديل — `/services/[id]/edit`

- [ ] كل الحقول prefilled
- [ ] toggle `depositEnabled` off → depositPercent يختفي (UI) لكن DB قد يحتفظ بالقيمة
- [ ] تعديل calendarColor → save → reload → اللون محفوظ
- [ ] تعديل branchIds — multi-select double check

⚠️ **Red flag:** toggles (isHidden/hidePriceOnBooking) — أعد فتح edit للتأكد

---

## 9. Booking Types (خدمة × نوع)

- [ ] `GET /dashboard/organization/services/{id}/booking-types`
- [ ] UI يسمح تكوين in_person/online لكل خدمة:
  - السعر المخصص
  - duration مخصص
  - buffer مخصص
- [ ] `PUT /dashboard/organization/services/{id}/booking-types`
- [ ] حفظ array كامل في كل submit

---

## 10. حذف — DeleteAlertDialog

- [ ] اسم الخدمة يظهر في description
- [ ] تحذير `non-recoverable`
- [ ] `DELETE` → 204
- [ ] خدمة لها حجوزات قادمة → backend يرفض

---

## 11. RTL + Dark

- [ ] Icon picker يعمل RTL
- [ ] color picker في المكان الصحيح
- [ ] glass cards في dark mode

---

## 12. Edge Cases

- [ ] سعر = 0 — مقبول؟ (خدمة مجانية)
- [ ] duration = 5 دقائق — حد أدنى؟
- [ ] maxParticipants > 1 → UI يظهر group booking toggle
- [ ] iconBgColor + imageUrl معاً — أيهما يفوز؟
- [ ] recurring + recurring patterns الكل فارغ → invalid state
- [ ] خدمة مرتبطة بموظفين (EmployeeService) — حذف يؤثر عليهم
- [ ] تغيير categoryId لخدمة لها حجوزات — no side effects

---

## 13. Screenshots

`screenshots/services/`:
1. `list-light-rtl.png`
2. `list-dark-rtl.png`
3. `create-form-full.png` (كل الـ settings ظاهرة)
4. `detail-sheet.png`
5. `delete-dialog.png`
6. `booking-types-config.png`

---

## 14. curl

```bash
TOKEN="<jwt>"
API="http://localhost:5100"

# قائمة
curl -H "Authorization: Bearer $TOKEN" \
  "$API/dashboard/organization/services?page=1&limit=20&isActive=true&categoryId=<uuid>" | jq

# إنشاء
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nameEn":"Test","nameAr":"اختبار","categoryId":"<uuid>","price":100,"duration":30,"isActive":true}' \
  "$API/dashboard/organization/services" | jq

# booking types
curl -H "Authorization: Bearer $TOKEN" \
  "$API/dashboard/organization/services/<id>/booking-types" | jq

# حذف (archive)
curl -X DELETE -H "Authorization: Bearer $TOKEN" \
  "$API/dashboard/organization/services/<id>"
```

---

## 15. Red Flags

- ⚠️ depositPercent visibility — يختفي من UI لكن قد يبقى في DB
- ⚠️ iconBgColor hex validation strict — regex case-sensitive؟
- ⚠️ allowedRecurringPatterns empty + allowRecurring=true
- ⚠️ branchIds=[] — يعني كل الفروع أم لا فرع؟
- ⚠️ Boolean filter ghost params
- ⚠️ Archive vs hard delete — خدمة "deleted" قد ترجع في list إذا فلتر خاطئ

---

## 16. معايير النجاح
- [ ] 3-10 passed
- [ ] Validation (7.4) كامل
- [ ] Booking types (9) full CRUD
- [ ] curl fidelity
- [ ] RTL + Dark + Screenshots
