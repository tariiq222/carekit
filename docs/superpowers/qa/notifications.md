# خطة اختبار E2E — الإشعارات (Notifications)

> **المسار:** `/notifications` (قراءة فقط + mark-all-read)
> **آخر تحديث:** 2026-04-17

---

## 1. التحضير

```bash
cd apps/backend && npm run dev
cd apps/dashboard && npm run dev
```

**البيانات:**
- 10+ إشعارات للمستخدم الحالي (مزيج read/unread)
- إشعارات بأنواع مختلفة (booking_created, payment_received, etc.)
- إشعارات قديمة (> أسبوع) و حديثة

---

## 2. خريطة الصفحة

```text
Breadcrumbs
PageHeader    [عنوان+وصف]              [وضع علامة "مقروء" على الكل]
StatsGrid     [غير مقروء] [الإجمالي]        (بطاقتان فقط، ليس 4)
Content       قائمة NotificationCards (لا جدول، لا فلاتر)
Pagination    إذا موجود
```

**ملاحظة:** صفحة مبسّطة — استثناء من Page Anatomy Law.

---

## 3. التحميل

- [ ] `GET /dashboard/comms/notifications?page=1&limit=20` → 200
- [ ] `GET /dashboard/comms/notifications/unread-count` → 200
- [ ] StatsGrid: `غير مقروء` = count من endpoint، `الإجمالي` = meta.total
- [ ] لا console errors

---

## 4. زر Mark All Read

- [ ] إذا unread = 0 → الزر disabled
- [ ] إذا unread > 0 → enabled
- [ ] اضغط → `PATCH /dashboard/comms/notifications/mark-read` → void
- [ ] كل النقاط الحمراء تختفي
- [ ] StatsGrid `غير مقروء` يصبح 0
- [ ] الزر يصبح disabled بعد النقر

---

## 5. NotificationCards

لكل card:
- [ ] نقطة حمراء صغيرة إذا unread
- [ ] titleAr (بالعربي) أو titleEn (حسب locale)
- [ ] bodyAr / bodyEn
- [ ] timestamp نسبي `قبل 3 دقائق` أو مطلق
- [ ] clickable → يضع `isRead=true`

اختبارات:
- [ ] اضغط بطاقة unread → نقطة تختفي، `غير مقروء` ينقص
- [ ] اضغط بطاقة مقروءة مسبقاً → لا تغيير
- [ ] content طويل → wrap صحيح
- [ ] النقر على بطاقة عندها `data.url` — هل ينقل؟ (تحقق من `data` field)

---

## 6. Pagination

- [ ] إذا > 20 → pagination يظهر
- [ ] الفلاتر لا توجد، فقط صفحة

---

## 7. Real-time updates

- [ ] افتح الصفحة، أنشئ إشعار جديد من backend (trigger حجز مثلاً)
- [ ] هل يظهر تلقائياً؟ أم بعد refresh فقط؟
- [ ] SSE/WebSocket؟ تحقق

---

## 8. Edge Cases

### 8.1 Empty state
- [ ] لا إشعارات → `لا توجد إشعارات`

### 8.2 النوع غير معروف
- [ ] type غديد لا يعرفه UI — يعرض افتراضي؟

### 8.3 data field يحتوي URL مكسور
- [ ] النقر لا يكسر الصفحة

### 8.4 Title/body فارغ
- [ ] fallback

### 8.5 localized fields
- [ ] locale = ar → titleAr/bodyAr
- [ ] locale = en → titleEn/bodyEn
- [ ] ar fallback إلى en إذا فارغ؟

---

## 9. RTL + Dark
- [ ] unread dot في الجهة الصحيحة (start — يمين في RTL)
- [ ] timestamp ltr
- [ ] cards glass effect

---

## 10. Screenshots
`screenshots/notifications/`:
1. `list-with-unread.png`
2. `list-all-read.png`
3. `empty-state.png`
4. `mark-all-read-button.png`

---

## 11. curl

```bash
TOKEN="<jwt>"
API="http://localhost:5100"

curl -H "Authorization: Bearer $TOKEN" \
  "$API/dashboard/comms/notifications?page=1&limit=20" | jq

curl -H "Authorization: Bearer $TOKEN" \
  "$API/dashboard/comms/notifications/unread-count" | jq

curl -X PATCH -H "Authorization: Bearer $TOKEN" \
  "$API/dashboard/comms/notifications/mark-read"
```

---

## 12. Red Flags

- ⚠️ **Mark read on click** — سلوك optimistic قد يختلف مع backend
- ⚠️ **data payload** — أي navigation URL لازم تحقق من XSS
- ⚠️ **No filters** — UX: 100+ إشعار صعب التصفح
- ⚠️ **Real-time** — لو مفقود، الإشعار الجديد لا يظهر حتى reload
- ⚠️ **per-user scope** — تحقق أن المستخدم X لا يرى إشعارات Y

---

## 13. النجاح
- [ ] Mark all read يعمل
- [ ] Click single مقروء
- [ ] Unread count سليم
- [ ] Pagination
- [ ] RTL + Dark
