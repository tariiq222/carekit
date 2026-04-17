# خطة اختبار E2E — الإعدادات (Settings)

> **المسار:** `/settings` — 8 tabs
> **آخر تحديث:** 2026-04-17

---

## 1. التحضير

```bash
cd apps/backend && npm run dev
cd apps/dashboard && npm run dev
```

**البيانات:** clinic config موجود، bookingSettings، workingHours، payment providers، integrations.

---

## 2. خريطة الصفحة

```text
Breadcrumbs
PageHeader   [عنوان+وصف]
TabsList (8): [عام] [الحجز] [الإلغاء] [ساعات العمل] [الدفع] [التكاملات] [ZATCA] [قوالب الإيميل]
TabsContent: حسب tab
```

---

## 3. Tab 1: عام (General)

### 3.1 Contact Info
| الحقل | نوع | validation |
|-------|-----|-----|
| email | email | valid format |
| phone | PhoneInput | intl regex |
| address | text | max 500 |

### 3.2 Regional Settings
- **weekStartDay:** اختر: السبت/الأحد/الاثنين
- **dateFormat:** `Y-m-d | d/m/Y | m/d/Y`
- **timeFormat:** `24h | 12h`
- **timezone:** TIMEZONE_OPTIONS (12 خيار، Asia/Riyadh default)

اختبارات:
- [ ] weekStartDay=saturday → calendars/ reports تبدأ السبت
- [ ] dateFormat change → كل التواريخ في الداشبورد تستخدم الصيغة الجديدة (بعد reload)
- [ ] timeFormat 12h → `3:30 PM` vs 24h → `15:30`
- [ ] timezone change → حجوزات قديمة لا تنزاح، جديدة تأخذ الـ TZ الجديد

### 3.3 Save
- [ ] `PATCH /dashboard/organization/settings`

---

## 4. Tab 2: الحجز (Booking)

### 4.1 Policies
| الحقل | نوع | validation |
|-------|-----|-----|
| leadMinutes | number | min 0, max 1440 |
| paymentTimeout | number | min 1 (minutes) |
| bufferMinutes | number | 0-120 |
| maxAdvanceDays | number | 1-365 |

### 4.2 Flags
- walkInEnabled (switch)
- waitlistEnabled (switch)
- recurringEnabled (switch)
- allowedRecurringPatterns (multi-select)
- flowOrder: `service_first | employee_first | both`

### 4.3 Save
- [ ] `PATCH /dashboard/organization/booking-settings`
- [ ] bookings page يعكس التغيير (walk_in filter يظهر/يختفي)

---

## 5. Tab 3: الإلغاء (Cancellation)

- cancellation lead time
- noShow penalty
- rescheduling allowed count
- refund rules (full/partial/none) حسب الوقت قبل الحجز

اختبارات:
- [ ] تعديل rule → حجز موجود يطبّق القيمة الجديدة في الـ cancellation
- [ ] كل rule له validation (hours/percent)

---

## 6. Tab 4: ساعات العمل (Working Hours)

### 6.1 Hours Grid
7 أيام (السبت-الجمعة حسب weekStartDay):
- [ ] كل يوم: toggle closed + start + end
- [ ] multiple windows per day (shift مقسّم)
- [ ] start >= end → خطأ
- [ ] windows متداخلة → خطأ

### 6.2 Holidays
- [ ] إضافة holiday: date, reason
- [ ] endDate optional (إذا range)
- [ ] حذف holiday
- [ ] `PATCH /dashboard/organization/holidays`

---

## 7. Tab 5: الدفع (Payment)

### 7.1 Moyasar
- API key (secret, لا يظهر بعد save)
- secret key
- Test mode toggle

اختبارات:
- [ ] حفظ → key يُشفّر في DB، لا يُرجَع في GET
- [ ] UI يعرض `***...1234` (masked)
- [ ] Test mode → حجوزات تستخدم sandbox

### 7.2 Bank Transfer Accounts
**إضافة account:**
| الحقل | نوع | validation |
|-------|-----|-----|
| bankId | select | SAUDI_BANKS enum |
| IBAN | text | SA + 22 digits |
| holderName | text | required |

- [ ] IBAN validation مع checksum
- [ ] IBAN خاطئ → خطأ
- [ ] multiple accounts allowed

### 7.3 At-clinic toggle
- [ ] switch → payAtClinic feature في booking flow

---

## 8. Tab 6: التكاملات (Integrations)

### 8.1 Zoom
- client ID
- client secret (masked)
- account ID
- [ ] حفظ → `PATCH /integrations`
- [ ] test connection button؟

### 8.2 Email Provider
select: SendGrid | Brevo | Mailgun
- [ ] كل provider: API key مطلوب
- [ ] from email
- [ ] test email button → يرسل test email

---

## 9. Tab 7: ZATCA

انظر `zatca.md` للتفاصيل الكاملة. هنا فقط:
- [ ] VAT number
- [ ] Seller name
- [ ] Environment (sandbox/production)
- [ ] Onboard button

---

## 10. Tab 8: قوالب الإيميل (Email Templates)

### 10.1 Sidebar list
- قائمة القوالب (booking_confirmation, cancellation, etc.)
- اختيار → editor

### 10.2 Editor
| الحقل | نوع | validation |
|-------|-----|-----|
| subjectEn | text | — |
| subjectAr | text | — |
| bodyEn | textarea (rich أو plain) | — |
| bodyAr | textarea | — |
| isActive | switch | — |

اختبارات:
- [ ] variables insertion: `{{client.firstName}}`, `{{booking.date}}`
- [ ] invalid variable `{{xxx}}` → warning؟
- [ ] preview button → rendered email
- [ ] `PATCH /dashboard/email-templates/{id}`
- [ ] toggle isActive → القالب يُستخدم أم لا

---

## 11. Edge Cases

### 11.1 Concurrent edits
- [ ] user A يحفظ، user B كان يعدّل — الـ change من B يُفقد؟

### 11.2 Payment key rotation
- [ ] تغيير Moyasar key — الحجوزات pending تفشل؟

### 11.3 Timezone change mid-day
- [ ] حجوزات اليوم — موعدها يتغير؟

### 11.4 Holiday retroactive
- [ ] holiday في تاريخ فيه حجوزات — السلوك؟

### 11.5 Email template variable typo
- [ ] `{{firstName}}` بدل `{{client.firstName}}` → email يرسل `{{firstName}}` نصي

### 11.6 Integration API key invalid
- [ ] save بـ key خاطئ → UI لا يتحقق، فقط تفشل في runtime

---

## 12. RTL + Dark
- [ ] tabs ترتيب RTL
- [ ] email editor RTL للعربي
- [ ] masked keys LTR

---

## 13. Screenshots
`screenshots/settings/`:
1. `general-tab.png`
2. `booking-tab.png`
3. `working-hours.png`
4. `holidays-section.png`
5. `payment-moyasar.png`
6. `payment-bank-accounts.png`
7. `integrations-zoom.png`
8. `email-template-editor.png`
9. `zatca-onboard-sheet.png`

---

## 14. curl

```bash
TOKEN="<jwt>"
API="http://localhost:5100"

# general
curl -X PATCH -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"timezone":"Asia/Riyadh","weekStartDay":6,"dateFormat":"d/m/Y","timeFormat":"24h"}' \
  "$API/dashboard/organization/settings" | jq

# booking
curl -X PATCH -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"walkInEnabled":true,"waitlistEnabled":true,"flowOrder":"service_first"}' \
  "$API/dashboard/organization/booking-settings" | jq

# hours
curl -X PATCH -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"monday":{"open":"09:00","close":"21:00"}}' \
  "$API/dashboard/organization/hours" | jq

# email template
curl -X PATCH -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"subjectAr":"تأكيد الحجز","bodyAr":"مرحباً {{client.firstName}}","isActive":true}' \
  "$API/dashboard/email-templates/<id>" | jq
```

---

## 15. Red Flags

- ⚠️ **Key masking** — API keys في response لازم masked
- ⚠️ **IBAN validation** — checksum الفعلي
- ⚠️ **Concurrent edits** — last-write-wins بلا تحذير
- ⚠️ **Timezone cascading** — كل الحجوزات تتأثر
- ⚠️ **Email variables** — no validation على placeholders
- ⚠️ **Sandbox vs production** — toggle ZATCA/Moyasar حرج
- ⚠️ **Working hours atomic save** — إذا failed جزئياً
- ⚠️ **Feature flags** (walkIn, waitlist) — تأثير فوري على bookings page

---

## 16. النجاح
- [ ] كل 8 tabs passed
- [ ] validation لكل حقل
- [ ] keys masked
- [ ] changes تنعكس على باقي الصفحات
- [ ] screenshots + curl
