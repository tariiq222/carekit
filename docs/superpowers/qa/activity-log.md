# خطة اختبار E2E — سجل النشاط (Activity Log)

> **المسار:** `/activity-log` أو `/users?tab=activityLog` (قد يكون مدمج في Users)
> **آخر تحديث:** 2026-04-17

---

## 1. التحضير

```bash
cd apps/backend && npm run dev
cd apps/dashboard && npm run dev
```

**البيانات:**
- 50+ activity entries من modules مختلفة
- entries بـ user = null (system actions)
- entries من أيام مختلفة
- كل action type ممثّل

---

## 2. خريطة الصفحة

```text
Breadcrumbs
PageHeader    [عنوان+وصف]
FilterBar     [الوحدة▼] [الإجراء▼] [من▼] [إلى▼] [إعادة تعيين]
DataTable     [المستخدم] [الإجراء] [الوحدة] [الوصف] [ID المرجع] [الوقت]
Pagination
```

**ملاحظة:** read-only — لا إضافة/تعديل/حذف.

---

## 3. التحميل

- [ ] `GET /dashboard/ops/activity?page=1&limit=20&sortBy=createdAt&sortOrder=desc` → 200
- [ ] الجدول يعرض 6 أعمدة
- [ ] الترتيب default: الأحدث أولاً

---

## 4. FilterBar

### 4.1 فلتر الوحدة (Module)
القيم: `all | bookings | users | employees | payments | invoices | services | roles | branding | ratings`

- [ ] اختيار وحدة → request يحمل `module=<value>`
- [ ] `all` → لا param
- [ ] كل صف يعرض badge الوحدة المختارة

### 4.2 فلتر الإجراء (Action)
القيم: `all | created | updated | deleted | login | logout | approved | rejected`

- [ ] اختيار → `action=<value>`
- [ ] كل action بلون badge مختلف:
  - created → success
  - updated → info/primary
  - deleted → destructive
  - login/logout → muted
  - approved → success
  - rejected → destructive

### 4.3 Date range
- [ ] from + to DatePickers
- [ ] `fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD`
- [ ] tomorrow → لا نتائج

### 4.4 Reset
- [ ] يظهر فقط إذا فلتر مفعّل
- [ ] يمسح كل 4 فلاتر

---

## 5. الجدول

| # | العمود | المحتوى |
|---|--------|---------|
| 1 | المستخدم | Avatar + name (أو "System" إذا user=null) |
| 2 | الإجراء | Badge ملوّن |
| 3 | الوحدة | Badge |
| 4 | الوصف | line-clamp-1, max-width 300px |
| 5 | ID المرجع | أول 8 من resourceId أو `—` |
| 6 | الوقت | `MMM d, yyyy HH:mm` (ar/en locale) |

اختبارات:
- [ ] user null → avatar بـ "S" أو robot icon + "System"
- [ ] وصف طويل → truncate + tooltip للنص الكامل
- [ ] resourceId null → `—` (مثل login/logout)
- [ ] الوقت بـ locale ar → `١٧ أبر ٢٠٢٦ ١٥:٣٠`
- [ ] sort desc — entry جديد في أعلى

---

## 6. لا dialogs / row actions

- [ ] read-only — لا زر حذف
- [ ] ربما "عرض التفاصيل" لـ oldValues/newValues؟ تحقق UI

---

## 7. Edge Cases

### 7.1 Entry بدون user
- [ ] "System" يظهر
- [ ] ما في crash

### 7.2 Entry قديم جداً
- [ ] تنسيق التاريخ صحيح
- [ ] pagination يصل

### 7.3 Description بـ HTML
- [ ] escape — لا يُنفَّذ
- [ ] special chars ظاهرة

### 7.4 ipAddress / userAgent ظاهرة؟
- [ ] قد تظهر في detail view فقط

### 7.5 oldValues / newValues diff
- [ ] إذا UI يعرضها — JSON diff clean
- [ ] sensitive fields (password) — masked

### 7.6 Module غير مسجل في enum
- [ ] backend يرسل module جديد — UI يتعامل؟

### 7.7 Rapid entries
- [ ] 100 entries في ثانية — pagination يتعامل؟

---

## 8. Performance

- [ ] جدول كبير (10K+ entries) — pagination يعمل بسرعة
- [ ] filtering سريع (index على module/action/createdAt)

---

## 9. Security / Audit

- [ ] user يرى activity لكل النظام أم فقط لنفسه؟
- [ ] permission check
- [ ] sensitive data (passwords) لا تظهر في oldValues/newValues

---

## 10. RTL + Dark
- [ ] user avatar في الجهة الصحيحة
- [ ] action/module badges dark contrast
- [ ] الوقت: الأرقام ltr

---

## 11. Screenshots
`screenshots/activity-log/`:
1. `list.png`
2. `filtered-by-bookings-module.png`
3. `filtered-by-deleted-action.png`
4. `date-range-filter.png`
5. `system-user-entry.png`
6. `dark-mode.png`

---

## 12. curl

```bash
TOKEN="<jwt>"
API="http://localhost:5100"

# كل الـ entries
curl -H "Authorization: Bearer $TOKEN" \
  "$API/dashboard/ops/activity?page=1&limit=20" | jq

# فلتر بوحدة
curl -H "Authorization: Bearer $TOKEN" \
  "$API/dashboard/ops/activity?module=bookings&action=deleted" | jq

# date range
curl -H "Authorization: Bearer $TOKEN" \
  "$API/dashboard/ops/activity?fromDate=2026-04-01&toDate=2026-04-17" | jq

# فلتر بمستخدم
curl -H "Authorization: Bearer $TOKEN" \
  "$API/dashboard/ops/activity?userId=<uuid>" | jq
```

---

## 13. Red Flags

- ⚠️ **Sensitive fields in oldValues/newValues** — password, apiKey لازم masked
- ⚠️ **ipAddress privacy** — قد يكون GDPR-sensitive
- ⚠️ **Module enum sync** — backend يضيف module جديد، UI لا يعرض في dropdown
- ⚠️ **action badge colors** — consistency مع باقي الداشبورد
- ⚠️ **user null rendering** — "System" label بعربي/إنجليزي
- ⚠️ **Pagination على datasets كبيرة** — cursor-based أفضل من offset
- ⚠️ **permission scope** — admin يرى كل شي، receptionist يرى محدود؟
- ⚠️ **resourceId link** — هل قابل للنقر للانتقال للـ resource؟

---

## 14. النجاح
- [ ] كل 4 فلاتر تعمل
- [ ] كل 10 modules + 8 actions ممثّلة في dropdown
- [ ] System entries تُعرض صحيح
- [ ] Performance مقبول
- [ ] Sensitive data masked
- [ ] Screenshots + curl
