# خطة اختبار E2E — التقييمات (Ratings)

> **المسار:** `/ratings`
> **آخر تحديث:** 2026-04-17

---

## 1. التحضير

```bash
cd apps/backend && npm run dev
cd apps/dashboard && npm run dev
```

**البيانات:**
- موظف لديه 10+ تقييمات
- موظف بدون تقييمات
- تقييم anonymous (clientId null؟)
- تقييم بدون comment
- تقييمات isPublic=true/false

---

## 2. خريطة الصفحة

```text
Breadcrumbs
PageHeader   [عنوان+وصف]
(لا StatsGrid, لا FilterBar بالشكل المعتاد)
Layout:
  Employee selector (required before data shows)
  Rating cards (list)
  Pagination
```

**ملاحظة:** صفحة مختلفة هيكلياً — card-based ليس table.

---

## 3. التحميل

- [ ] dropdown الموظفين يُحمَّل (من employees endpoint)
- [ ] قبل اختيار موظف — لا بيانات، placeholder "اختر موظف"
- [ ] بعد اختيار → `GET /dashboard/organization-settings/ratings?employeeId=<id>` → 200

---

## 4. Employee Selector

- [ ] قائمة كل الموظفين النشطين
- [ ] اختيار موظف → cards تظهر
- [ ] تغيير موظف → cards تتبدّل
- [ ] مسح الاختيار — السلوك؟ cards تختفي أم تبقى؟

---

## 5. Rating Cards

لكل card:
- [ ] Star display (5 نجوم، ملء حسب score)
- [ ] Badge score `4/5`
- [ ] comment text (طويل → wrap)
- [ ] client name أو `anonymous`
- [ ] createdAt (ISO formatted)

اختبارات:
- [ ] score = 5 → 5 نجوم ملأ
- [ ] score = 3.5 → 3.5 نجوم (نصف)
- [ ] comment فارغ → لا يظهر القسم أو placeholder
- [ ] clientId null → `anonymous`
- [ ] isPublic=false → يظهر في admin UI لكن مع badge `خاص`؟

---

## 6. Pagination

- [ ] Previous/Next buttons
- [ ] `الصفحة X / Y`
- [ ] previous disabled على page 1
- [ ] next disabled على آخر page

---

## 7. إنشاء تقييم (POST)

**ملاحظة:** عادة العميل فقط ينشئ تقييمات (من الموبايل)، ليس admin. لكن endpoint موجود:
- `POST /dashboard/organization-settings/ratings` مع `{bookingId, clientId, employeeId, score, comment?, isPublic?}`

- [ ] هل UI في dashboard يسمح admin بإنشاء؟ تحقق
- [ ] إذا نعم: validation على score (1-5)، bookingId موجود، etc.

---

## 8. Edge Cases

### 8.1 Employee بدون تقييمات
- [ ] empty state واضح: `لا توجد تقييمات`
- [ ] pagination لا يظهر

### 8.2 Anonymous rating
- [ ] clientId null — يعرض `anonymous`
- [ ] لا يعرض بيانات تعريفية

### 8.3 Rating لحجز محذوف
- [ ] bookingId orphan — يعرض كيف؟

### 8.4 Private rating (isPublic=false)
- [ ] في UI العميل (mobile) لا يظهر
- [ ] في admin UI يظهر مع تمييز

### 8.5 Average rating
- [ ] هل يعرض متوسط في header بعد اختيار موظف؟
- [ ] يطابق `avgRating` في employees stats

---

## 9. RTL + Dark
- [ ] نجوم في المكان الصحيح
- [ ] comment RTL/LTR حسب اللغة
- [ ] card glass

---

## 10. Screenshots
`screenshots/ratings/`:
1. `employee-selector.png`
2. `ratings-list.png`
3. `empty-state.png`
4. `anonymous-rating.png`
5. `pagination.png`

---

## 11. curl

```bash
TOKEN="<jwt>"
API="http://localhost:5100"

# قائمة
curl -H "Authorization: Bearer $TOKEN" \
  "$API/dashboard/organization-settings/ratings?page=1&limit=20&employeeId=<uuid>" | jq

# إنشاء (نادر من admin)
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"bookingId":"<uuid>","clientId":"<uuid>","employeeId":"<uuid>","score":5,"comment":"ممتاز","isPublic":true}' \
  "$API/dashboard/organization-settings/ratings" | jq

# تصفية بعميل
curl -H "Authorization: Bearer $TOKEN" \
  "$API/dashboard/organization-settings/ratings?clientId=<uuid>" | jq
```

---

## 12. Red Flags

- ⚠️ **لا StatsGrid/FilterBar معتاد** — exception من Page Anatomy Law
- ⚠️ **employeeId required** قبل عرض البيانات — UX: المستخدم يتوقع لائحة كل التقييمات
- ⚠️ **score decimal** (3.5) — UI يعرض half-star؟
- ⚠️ **anonymous masking** — تحقق أن أي معرف شخصي محذوف
- ⚠️ **orphan bookingId** بعد حذف حجز
- ⚠️ **isPublic filter** غير ظاهر — admin يرى كل شي لكن لا فلتر

---

## 13. النجاح
- [ ] Employee selector يعمل
- [ ] Cards تعرض كل البيانات
- [ ] Pagination
- [ ] Anonymous handling
- [ ] Screenshots
