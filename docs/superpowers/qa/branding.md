# خطة اختبار E2E — الهوية البصرية (Branding)

> **المسار:** `/branding` (form واحد، بدون قائمة)
> **آخر تحديث:** 2026-04-17

---

## 1. التحضير

```bash
cd apps/backend && npm run dev
cd apps/dashboard && npm run dev
```

**البيانات:** config branding موجود (CareKit defaults: Royal Blue + Lime Green).

**Permission check:** `branding:edit` مطلوب.

---

## 2. خريطة الصفحة

```text
Breadcrumbs
PageHeader   [عنوان+وصف]
Form (single page, no tabs):
  Identity section       [systemName] [systemNameAr] [productTagline]
  Colors section         [primary + light/dark] [accent + dark] [background]
                         + WCAG contrast badges (live)
  Typography section     [fontFamily] [fontUrl]
  Assets section         [logoUrl] [faviconUrl]
Button:        [حفظ]
```

---

## 3. التحميل

- [ ] `GET /dashboard/organization/branding` → 200
- [ ] كل الحقول prefilled
- [ ] permission check — غير مسموح يرجع 403 أو disable form

---

## 4. Identity Section

| الحقل | نوع | validation |
|-------|-----|-----|
| systemName | text (LTR) | max 200 |
| systemNameAr | text (RTL) | max 200 |
| productTagline | text | max 200 |

اختبارات:
- [ ] systemName = 201 حرف → خطأ
- [ ] systemNameAr فارغ → optional أم required؟
- [ ] حفظ → reload header topbar يعرض الاسم الجديد؟

---

## 5. Colors Section

### 5.1 الحقول
- colorPrimary + colorPrimaryLight + colorPrimaryDark
- colorAccent + colorAccentDark
- colorBackground

### 5.2 Input
- [ ] ColorSwatchInput: color picker + hex text
- [ ] regex: `/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/`
- [ ] 3-digit hex `#FFF` مقبول
- [ ] 6-digit `#FFFFFF` مقبول
- [ ] 8-digit (with alpha) مقبول
- [ ] `red` → خطأ
- [ ] `#GGG` → خطأ

### 5.3 WCAG contrast badges
- [ ] بدائل live — لما يتغير لون، badge يحدّث
- [ ] يعرض contrast ratio (مثل `7.2:1`)
- [ ] AAA / AA / FAIL labels

### 5.4 Live preview
- [ ] تغيير colorPrimary → هل الـ sidebar/button يتغير فورياً؟
- [ ] أو فقط بعد save + reload؟

---

## 6. Typography Section

| الحقل | نوع | validation |
|-------|-----|-----|
| fontFamily | text | max 200 |
| fontUrl | text (LTR) | URL? |

- [ ] fontFamily فارغ → fallback لـ IBM Plex Sans Arabic
- [ ] fontUrl غير صالح → خطأ
- [ ] حفظ + reload → الخط يتغير فعلاً في الصفحة

---

## 7. Assets Section

| الحقل | نوع | validation |
|-------|-----|-----|
| logoUrl | text (LTR) | URL max 200 |
| faviconUrl | text (LTR) | URL max 200 |

- [ ] URL غير صالح → خطأ
- [ ] حفظ logoUrl → sidebar/topbar يعرض اللوقو الجديد
- [ ] faviconUrl → tab icon يحدّث (بعد reload)

---

## 8. زر الحفظ

- [ ] `POST /dashboard/organization/branding` body = كل الحقول
- [ ] disabled أثناء pending
- [ ] toast نجاح
- [ ] بعد حفظ — reload تلقائي للصفحة أو كل الصفحات؟
- [ ] CSS custom properties تتحدّث في `:root`

---

## 9. Permission gate

- [ ] المستخدم بدون `branding:edit`:
  - [ ] الصفحة تظهر لكن disabled؟
  - [ ] أو redirect 403؟

---

## 10. Edge Cases

### 10.1 Alpha channel
- [ ] `#FF000080` (50% red) — يُقبل وينطبق؟

### 10.2 Same color primary/accent
- [ ] تحذير UX؟

### 10.3 Very dark background + dark text
- [ ] WCAG يُظهر FAIL بوضوح

### 10.4 Custom font not loading
- [ ] fontUrl خاطئ — fallback للخط الافتراضي
- [ ] لا crash

### 10.5 Logo / Favicon 404
- [ ] broken image — placeholder

### 10.6 Reset to defaults
- [ ] هل يوجد زر "إعادة الافتراضي"؟

### 10.7 Multi-tenancy (ليست) — لكن single-org
- [ ] كل التغييرات على مستوى النظام كله

---

## 11. RTL + Dark
- [ ] systemNameAr input RTL
- [ ] color swatches — الـ preview في الاتجاه الصحيح
- [ ] WCAG badges بلغة UI
- [ ] dark mode preview يعمل مع colors الجديدة

---

## 12. Screenshots
`screenshots/branding/`:
1. `form-full.png`
2. `color-picker-expanded.png`
3. `wcag-aaa-pass.png`
4. `wcag-fail.png`
5. `typography-section.png`
6. `before-after-colors.png` (قبل/بعد تغيير)

---

## 13. curl

```bash
TOKEN="<jwt>"
API="http://localhost:5100"

# GET
curl -H "Authorization: Bearer $TOKEN" \
  "$API/dashboard/organization/branding" | jq

# UPDATE
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "systemName":"Clinic Pro",
    "systemNameAr":"العيادة برو",
    "colorPrimary":"#354FD8",
    "colorAccent":"#82CC17",
    "fontFamily":"IBM Plex Sans Arabic"
  }' \
  "$API/dashboard/organization/branding" | jq
```

---

## 14. Red Flags

- ⚠️ **Hex regex strict** — lower/upper case, 3/6/8 digits
- ⚠️ **WCAG calculation** — يجب أن يطابق المعايير الحقيقية
- ⚠️ **Live preview** vs **on save** — UX expectation
- ⚠️ **Cache invalidation** — بعد save، كل المستخدمين المفتوحين يجب يرون التغيير
- ⚠️ **CareKit defaults لا تُعرض كـ universal** — كل deployment له ألوانه
- ⚠️ **Semantic tokens** — لا hex hardcoded في الكود، كل شي via CSS vars
- ⚠️ **fontUrl CORS** — tested with external fonts
- ⚠️ **Permission edge:** owner-only أم branding:edit أيضاً لـ admin؟

---

## 15. النجاح
- [ ] كل الـ inputs validate صحيح
- [ ] WCAG badges live
- [ ] Save + reload يعكس التغيير
- [ ] permission gate
- [ ] screenshots + curl
