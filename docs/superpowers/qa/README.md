# خطط اختبار E2E — لوحة التحكم

> **الأداة:** Chrome DevTools MCP (manual QA gate)
> **المرجع:** `C:\Users\tarii\.claude\projects\c--pro-deqah\memory\chrome_devtools_mcp_qa_gate.md`

كل صفحة في الداشبورد لها خطة اختبار مستقلة تغطي:
- كل الفلاتر وقيمها
- كل عمود وزر وإجراء
- كل حقل في الـ dialogs/sheets مع validation
- أوامر curl للتحقق من الـ backend
- اختبارات RTL + Dark mode
- Edge cases + Red flags خاصة بالصفحة
- Screenshots مطلوبة

---

## الخطط حسب الأولوية اليومية

### عمليات يومية (Daily Operations)
| # | الصفحة | الملف |
|---|--------|-------|
| 1 | الحجوزات | [bookings.md](bookings.md) |
| 2 | العملاء | [clients.md](clients.md) |
| 3 | الموظفون | [employees.md](employees.md) |
| 4 | الخدمات | [services.md](services.md) |
| 5 | الفروع | [branches.md](branches.md) |

### كتالوج وتسعير
| # | الصفحة | الملف |
|---|--------|-------|
| 6 | الفئات | [categories.md](categories.md) |
| 7 | الأقسام | [departments.md](departments.md) |
| 8 | الكوبونات | [coupons.md](coupons.md) |
| 9 | نماذج التقييم | [intake-forms.md](intake-forms.md) |

### مالية (Finance)
| # | الصفحة | الملف |
|---|--------|-------|
| 10 | الفواتير | [invoices.md](invoices.md) |
| 11 | المدفوعات ⚠️ Owner-only | [payments.md](payments.md) |
| 12 | ZATCA ⚠️ Owner-only | [zatca.md](zatca.md) |

### تفاعل العملاء
| # | الصفحة | الملف |
|---|--------|-------|
| 13 | التقييمات | [ratings.md](ratings.md) |
| 14 | المساعد الذكي (Chatbot) | [chatbot.md](chatbot.md) |
| 15 | الإشعارات | [notifications.md](notifications.md) |

### إدارة النظام
| # | الصفحة | الملف |
|---|--------|-------|
| 16 | التقارير | [reports.md](reports.md) |
| 17 | الهوية البصرية | [branding.md](branding.md) |
| 18 | المستخدمون والأدوار | [users.md](users.md) |
| 19 | الإعدادات (8 tabs) | [settings.md](settings.md) |
| 20 | سجل النشاط | [activity-log.md](activity-log.md) |

---

## التحضير العام (قبل بدء أي خطة)

```bash
# تشغيل البيئة
cd apps/backend && npm run dev        # :5100
cd apps/dashboard && npm run dev      # :5103

# إذا الـ worktree جديد
cp /c/pro/deqah/apps/backend/.env apps/backend/.env
cp /c/pro/deqah/apps/dashboard/.env apps/dashboard/.env
cd apps/backend && npx prisma generate && npm run seed
```

**قاعدة البيانات:** Postgres على port `5999` (ليس 5432 — pgvector via Docker).

**JWT Token للـ curl:**
```bash
# سجل دخول في الـ dashboard، افتح DevTools → Application → LocalStorage
# انسخ `accessToken` → استخدم كـ $TOKEN
```

---

## سير العمل لكل خطة

1. **اقرأ الخطة كاملة** قبل البدء
2. **حضّر بيانات السيد** المطلوبة في قسم 1
3. **شغّل الخطة خطوة بخطوة:**
   - `navigate_page` → URL الصفحة
   - `take_snapshot` → اقرأ a11y tree
   - `click / fill / press_key` على uids
   - `list_network_requests` → تحقق من الـ params
   - `list_console_messages` → لا errors
4. **تحقق DB** عبر curl بعد كل Create/Edit/Delete
5. **التقط Screenshots** في `screenshots/<page>/`
6. **راجع Red Flags** في آخر الخطة
7. **سجّل البقس** في جدول قبل أي fix

---

## قاعدة الـ Red Flags الشاملة

كل خطة فيها red flags خاصة بها. هذه الـ flags العامة:

- ⚠️ **`@Type(() => Boolean)` bug** — `isActive=false` قد يُفسَّر `true`
- ⚠️ **Ghost param** — `status=all` ما يجب أن يُرسل، فقط يُحذف
- ⚠️ **Stale dialog data** — فتح dialog بعد hover صف مختلف
- ⚠️ **Select onChange silent fail** — UI يعرض قيمة لكن DB لا يتغير
- ⚠️ **Validation بالإنجليزي على UI عربي** — i18n keys مطلوبة
- ⚠️ **Timezone drift** — UTC vs local، خصوصاً `weekStartDayNumber` (سبت في السعودية)

---

## معايير النجاح لكل خطة

صفحة جاهزة للـ merge إذا:
- [ ] كل السيناريوهات في الخطة passed
- [ ] كل validation passed
- [ ] RTL + Dark mode screenshots مراجعة
- [ ] كل red flags محقق منها
- [ ] Network requests بدون ghost params
- [ ] DB state يطابق UI state بعد كل CRUD
- [ ] لا console errors
- [ ] Screenshots محفوظة في `screenshots/<page>/`

---

## بنية screenshots

```
docs/superpowers/qa/screenshots/
├── bookings/
├── clients/
├── employees/
├── services/
├── branches/
├── categories/
├── departments/
├── coupons/
├── intake-forms/
├── invoices/
├── payments/
├── zatca/
├── ratings/
├── chatbot/
├── notifications/
├── reports/
├── branding/
├── users/
├── settings/
└── activity-log/
```

كل مجلد يحتوي على screenshots مطلوبة حسب قسم `Screenshots` في الخطة المقابلة.
