# خطة اختبار E2E — التقارير (Reports)

> **المسار:** `/reports` — 3 tabs (Revenue / Bookings / Employees)
> **آخر تحديث:** 2026-04-17

---

## 1. التحضير

```bash
cd apps/backend && npm run dev
cd apps/dashboard && npm run dev
```

**البيانات:**
- حجوزات موزعة على 30+ يوم
- دفعات مكتملة (لإحصاءات الإيرادات)
- حجوزات بكل الحالات (pending/completed/cancelled/etc.)
- موظفون لديهم حجوزات + ratings

---

## 2. خريطة الصفحة

```text
Breadcrumbs
PageHeader    [عنوان+وصف]                  [تصدير CSV]
FilterBar     [من▼] [إلى▼] [إعادة تعيين]
Tabs:         [الإيرادات] [الحجوزات] [الموظفون]

Revenue:      StatsGrid (3) + byMethod chart + byDay chart
Bookings:     Stats + byStatus + byType + byDay
Employees:    EmployeeCombobox + Stats + byDay
```

---

## 3. التحميل الأولي

- [ ] افتح الصفحة — بدون date range، هل تحمل بيانات؟ أو تطلب تاريخ؟
- [ ] زر `تصدير CSV` disabled إذا لا date range
- [ ] كل tab يطلب `POST /dashboard/ops/reports` مع `type` مختلف

---

## 4. FilterBar — Date Range

- [ ] dateFrom + dateTo
- [ ] تغيير التاريخ → request تلقائي
- [ ] dateFrom > dateTo → خطأ أو swap
- [ ] range > سنة — تحذير performance؟
- [ ] Reset يمسح التواريخ

---

## 5. Tab: الإيرادات (Revenue)

### 5.1 StatsGrid (3 cards)
- [ ] إجمالي الإيرادات (currency formatted)
- [ ] متوسط الحجز
- [ ] إجمالي الحجوزات

### 5.2 byMethod breakdown
- [ ] pie/bar chart: moyasar / bank_transfer / cash
- [ ] كل method مع amount + count
- [ ] hover → tooltip

### 5.3 byDay chart
- [ ] line chart بالأيام
- [ ] x-axis: التواريخ
- [ ] y-axis: الإيرادات
- [ ] نقطة لكل يوم (حتى لو 0)

### 5.4 API
```
POST /dashboard/ops/reports
{ "type": "REVENUE", "from": "2026-04-01", "to": "2026-04-17" }
```

---

## 6. Tab: الحجوزات (Bookings)

### 6.1 Stats
- [ ] total
- [ ] byStatus: pending/confirmed/completed/cancelled/no_show/etc.
- [ ] byType: in_person/online/walk_in
- [ ] byDay

### 6.2 Charts
- [ ] stacked bar لـ byStatus
- [ ] pie لـ byType
- [ ] line لـ byDay

### 6.3 API
```
POST /dashboard/ops/reports
{ "type": "BOOKINGS", "from": "...", "to": "..." }
```

---

## 7. Tab: الموظفون (Employees)

### 7.1 EmployeeCombobox
- [ ] dropdown للموظفين
- [ ] اختيار موظف → `employeeId` يُرسل مع request

### 7.2 Stats (لموظف محدد)
- totalBookings
- completedBookings
- totalRevenue
- averageRating (1-5)
- byDay breakdown

اختبارات:
- [ ] بدون اختيار موظف — يعرض aggregate أم empty؟
- [ ] averageRating = 0 (لا تقييمات) — يعرض `—`
- [ ] completionRate = completed/total — يعرض %؟

### 7.3 API
```
POST /dashboard/ops/reports
{ "type": "EMPLOYEES", "from": "...", "to": "...", "employeeId": "..." }
```

---

## 8. تصدير CSV

- [ ] اضغط `تصدير CSV`
- [ ] download file
- [ ] الاسم: `report-<type>-<from>-<to>.csv`
- [ ] المحتوى يطابق البيانات الظاهرة
- [ ] encoding UTF-8 (عربي صحيح في Excel)

---

## 9. Edge Cases

### 9.1 Date range فارغ
- [ ] zero data → empty state لكل tab

### 9.2 Range يوم واحد
- [ ] byDay = نقطة واحدة
- [ ] charts تعرض؟

### 9.3 Range مستقبلي
- [ ] كل الإحصاءات = 0

### 9.4 Range > عام
- [ ] performance — loading طويل؟
- [ ] timeout؟

### 9.5 Branch filter
- [ ] إذا UI يدعم branchId — اختبر
- [ ] بدون branch = aggregate كل الفروع

### 9.6 Currency في CSV
- [ ] fixed لرقمين decimal
- [ ] separator (comma/dot)

### 9.7 byMethod بدون cash
- [ ] breakdown يعرض فقط methods الموجودة

---

## 10. RTL + Dark
- [ ] charts axis labels RTL
- [ ] tooltips باللغة الحالية
- [ ] legend RTL
- [ ] currency في dark بـ contrast جيد

---

## 11. Screenshots
`screenshots/reports/`:
1. `revenue-tab-light.png`
2. `revenue-tab-dark.png`
3. `bookings-tab.png`
4. `employees-tab.png`
5. `date-range-picker.png`
6. `csv-export-filename.png`

---

## 12. curl

```bash
TOKEN="<jwt>"
API="http://localhost:5100"

# Revenue
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"REVENUE","from":"2026-04-01","to":"2026-04-17"}' \
  "$API/dashboard/ops/reports" | jq

# Bookings
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"BOOKINGS","from":"2026-04-01","to":"2026-04-17"}' \
  "$API/dashboard/ops/reports" | jq

# Employee specific
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"EMPLOYEES","from":"2026-04-01","to":"2026-04-17","employeeId":"<uuid>"}' \
  "$API/dashboard/ops/reports" | jq
```

---

## 13. Red Flags

- ⚠️ **Timezone drift** — `from/to` بدون timezone قد يحسب اليوم خطأ
- ⚠️ **Large range performance** — sentry timeout
- ⚠️ **CSV encoding** — BOM للعربي في Excel
- ⚠️ **Method breakdown null** — cash/bank_transfer قد يكون 0 — chart يتعامل؟
- ⚠️ **Employee aggregate** — بدون employeeId السلوك؟
- ⚠️ **Rating calculation** — average 0 vs null
- ⚠️ **Refunded payments** — يُحسب في الإيرادات أم يُخصم؟

---

## 14. النجاح
- [ ] 3 tabs تحمل وتعرض البيانات
- [ ] Date range filtering يغيّر كل الـ tabs
- [ ] CSV export يفتح في Excel صحيح
- [ ] Charts interactive (hover/tooltip)
- [ ] Screenshots + curl
