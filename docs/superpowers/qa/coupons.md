# خطة اختبار E2E — صفحة الكوبونات (Coupons)

> **المسار:** `/coupons` · `/coupons/create` · `/coupons/[id]/edit`
> **آخر تحديث:** 2026-04-17

---

## 1. التحضير

```bash
cd apps/backend && npm run dev
cd apps/dashboard && npm run dev
```

**البيانات:**
- 10+ كوبونات (active / inactive / expired)
- كوبون percentage (20%)
- كوبون fixed (50 ر.س)
- كوبون مع maxUses = 3، و `usedCount` = 3 (مستنفد)
- كوبون بتاريخ انتهاء في الماضي
- كوبون مربوط بـ serviceIds

---

## 2. خريطة الصفحة

```text
Breadcrumbs
PageHeader   [عنوان+وصف]                  [+ إضافة كوبون]
StatsGrid    [إجمالي] [نشط] [غير نشط] [منتهي]
FilterBar    [بحث] [الحالة▼] [إعادة تعيين]
DataTable    [الكود] [الخصم] [الاستخدام] [تاريخ الانتهاء] [الحالة] [إجراءات]
Dialogs      DeleteCouponDialog (Delete)
Routes       /coupons/create, /coupons/[id]/edit (full pages)
```

---

## 3. التحميل

- [ ] `GET /dashboard/finance/coupons?page=1&limit=20` → 200
- [ ] StatsGrid: 4 (total/active/inactive/expired)
- [ ] أيقونات: Coupon01/CheckmarkCircle02/Cancel01/PercentCircle
- [ ] قيمة `expired` = عدد حيث `expiresAt < now`

**curl verify:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "$API/dashboard/finance/coupons?page=1&limit=500" | jq \
  '[.data[] | select(.expiresAt != null and (.expiresAt|fromdateiso8601) < (now))] | length'
```

---

## 4. FilterBar

### 4.1 البحث
- يبحث في `code` (case-insensitive)

### 4.2 الحالة
- `all | active | inactive | expired` (4 قيم، ليس 3!)
- [ ] `expired` يرجع كل اللي `expiresAt < now`، بغض النظر عن `isActive`
- [ ] `active` يشترط `isActive=true AND expiresAt > now`
- [ ] Boolean + ghost param checks

---

## 5. الجدول

| # | العمود | المحتوى |
|---|--------|---------|
| 1 | الكود | monospace, semibold (مثل `SAVE20`) |
| 2 | الخصم | `20%` أو `50.00 ر.س` |
| 3 | الاستخدام | `3` أو `3/10` (إذا maxUses set) |
| 4 | تاريخ الانتهاء | `17 أبر 2026` أو `بدون انتهاء` |
| 5 | الحالة | badge: expired=red, active=green, inactive=gray |
| 6 | إجراءات | Edit, Delete |

اختبارات:
- [ ] percentage → `value + %`
- [ ] fixed → `value/100 SAR` (stored as cents!) — تحقق التحويل صحيح
- [ ] maxUses = null → فقط `usedCount` بدون كسر
- [ ] expiresAt = null → `بدون انتهاء`
- [ ] كوبون منتهي لكن isActive=true → badge `expired` (يغلب)
- [ ] كوبون مستنفد (usedCount >= maxUses) → UI يعرض كيف؟ مختلف عن expired؟

---

## 6. إنشاء — `/coupons/create`

### 6.1 الحقول
| الحقل | نوع | مطلوب | validation |
|-------|-----|-------|------------|
| code | text | ✓ | min 3, max 20, regex `/^[A-Z0-9_-]+$/i` |
| descriptionEn | text | — | — |
| descriptionAr | text | — | — |
| discountType | radio/select | ✓ | `percentage | fixed` |
| discountValue | number | ✓ | int, min 1 |
| minAmount | number | — | min 0 (cents) |
| maxUses | number | — | int, min 1 |
| maxUsesPerUser | number | — | int, min 1 |
| serviceIds[] | multi-select | — | UUIDs |
| expiresAt | datetime | — | ISO, مستقبل |
| isActive | switch | — | default true |

### 6.2 Validation
- [ ] code = `ab` → خطأ (min 3)
- [ ] code = `SAVE 20` → خطأ (space غير مسموح)
- [ ] code = `save20` → مقبول (regex case-insensitive)، هل يُحفظ uppercase؟
- [ ] code مكرر → backend 409
- [ ] discountValue = 0 → خطأ
- [ ] discountType = percentage + discountValue = 150 → خطأ أو مسموح؟ (منطقياً max 100)
- [ ] discountValue = 1.5 → خطأ (int)
- [ ] minAmount منطقياً cents — UI يعرض SAR لكن يرسل cents
- [ ] expiresAt في الماضي → خطأ أو تحذير
- [ ] maxUsesPerUser > maxUses → تحقق السلوك

**⚠️ Red flag:** discountValue cents vs SAR — UI shows SAR لكن يحفظ cents. اختبر: أدخل 50 ر.س → DB يعرض 5000 → reload → UI يعرض 50

### 6.3 Submit
- [ ] `POST /dashboard/finance/coupons`
- [ ] redirect → `/coupons`

---

## 7. تعديل — `/coupons/[id]/edit`

- [ ] كل الحقول prefilled
- [ ] code قابل للتعديل؟ (عادةً يُمنع)
- [ ] discountValue UI يعرض SAR صحيح (تحويل cents)
- [ ] serviceIds multi-select محفوظ
- [ ] تعديل expiresAt من null إلى تاريخ → save → reload → محفوظ

---

## 8. حذف

- [ ] `DELETE /dashboard/finance/coupons/{id}`
- [ ] كوبون مستخدم في حجوزات → backend يرفض أو cascade؟

---

## 9. Edge Cases

- [ ] كوبون بدون expiresAt + بدون maxUses → infinite use
- [ ] كوبون مرتبط بخدمات محذوفة — يظهر كيف؟
- [ ] خصم percentage = 100% → مجاني (مقبول؟)
- [ ] خصم fixed > سعر الخدمة → المجموع = 0 أو سالب؟
- [ ] تطبيق كوبون + deposit — تفاعل؟
- [ ] case-sensitivity: عميل يكتب `save20` على كوبون `SAVE20` — يُقبل؟

---

## 10. RTL + Dark
- [ ] code input LTR (حتى في UI عربي)
- [ ] خصم `20%` — الـ % على اليمين في RTL؟
- [ ] expired badge أحمر مرئي في dark

---

## 11. Screenshots
`screenshots/coupons/`:
1. `list-light.png`
2. `list-dark.png`
3. `create-form.png`
4. `expired-badge.png`
5. `delete-dialog.png`

---

## 12. curl

```bash
# قائمة
curl -H "Authorization: Bearer $TOKEN" \
  "$API/dashboard/finance/coupons?page=1&limit=20" | jq

# إنشاء
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"code":"SAVE20","discountType":"percentage","discountValue":20,"maxUses":100,"isActive":true}' \
  "$API/dashboard/finance/coupons" | jq

# إنشاء fixed (cents)
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"code":"FIX50","discountType":"fixed","discountValue":5000,"isActive":true}' \
  "$API/dashboard/finance/coupons" | jq

# تعديل
curl -X PATCH -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"isActive":false}' \
  "$API/dashboard/finance/coupons/<id>" | jq

# حذف
curl -X DELETE -H "Authorization: Bearer $TOKEN" \
  "$API/dashboard/finance/coupons/<id>"
```

---

## 13. Red Flags

- ⚠️ **Cents vs SAR:** discountValue/minAmount في cents لكن UI بـ SAR — bug محتمل في التحويل
- ⚠️ discountType + discountValue > 100 للـ percentage
- ⚠️ expiresAt timezone — UTC vs local
- ⚠️ Case-insensitive code regex لكن DB قد يحفظ lowercase
- ⚠️ Boolean filter ghost
- ⚠️ Status `expired` محسوب client-side — قد يختلف مع backend filter
- ⚠️ maxUsesPerUser > maxUses — منطق غير صالح

---

## 14. النجاح
- [ ] 4 حالات status (active/inactive/expired/exhausted) passed
- [ ] Cents↔SAR round-trip صحيح
- [ ] Validation كل الحقول
- [ ] Screenshots + curl
