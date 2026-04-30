# 📊 Deqah Test Reports

**الاختبارات نفسها هي مصدر الحقيقة.** كل اختبار يُضيف metadata في اسمه،
والسكريبت يستخرجها تلقائياً ويولّد تقرير HTML تفاعلي.

## البنية

```
test-reports/
├── README.md                          ← هذا الملف
├── scripts/
│   ├── generate_html_report.py        ← مُولِّد التقرير
│   └── tag_tests.py                   ← أداة وسم الاختبارات الموجودة بـ metadata
└── output/
    └── test-report.html               ← التقرير الأخير (standalone)
```

## 🏷️ تنسيق اسم الاختبار

كل اختبار يجب أن يكتب بهذا الشكل:

```ts
it('[TestID][Module/slice][Priority] العنوان العربي', ...)
```

مثال:
```ts
it('[CL-001][Clients/create-client][P1-High] إنشاء walk-in بالحد الأدنى', ...)
it('[CL-UI-045][Clients/list-page-ui][P1-High] الصفحة تحمل بدون redirect', ...)
it('[EM-001][Employees/list-employees][P2-Medium] عرض قائمة الممارسين', ...)
```

### القواعد

| الحقل | الصيغة | مطلوب؟ | المعالجة لو غاب |
|------|--------|--------|-----------------|
| TestID | `[A-Z]{2,3}-###[a-z]?` | نعم | يُتجاهل الاختبار |
| Module/slice | `Module/slice-name` | لا | `Uncategorized/general` |
| Priority | `P1-High` / `P2-Medium` / `P3-Low` | لا | `P3` |
| العنوان | نص حر (عربي مفضّل) | نعم | — |

### الموديولات المعتمدة

| Prefix | Module |
|--------|--------|
| `CL-` | Clients |
| `EM-` | Employees |
| `BK-` | Bookings |
| `PY-` | Payments |
| `AU-` | Auth |

### كيف يعمل التجميع

- اختبارات بنفس `Module/slice` تُجمَّع معاً في قسم واحد في التقرير
- `CL-UI-046a` و `CL-UI-046b` يُربطان بالسيناريو الأب `CL-046` تلقائياً
- عدة اختبارات لنفس السيناريو تُظهَر كـ sub-tests داخل الصف

## 🚀 workflow الاستخدام

### إضافة اختبار جديد

1. اكتب الاختبار بالتنسيق المطلوب في أي spec تحت `apps/*/test/e2e/`:
   ```ts
   it('[CL-100][Clients/create-client][P1-High] وصف الاختبار', async () => {
     // ...
   });
   ```
2. شغّل الاختبارات → التقرير يُحدّث تلقائياً
3. لا حاجة لتعديل أي ملف آخر!

### تشغيل الاختبارات (Hook تلقائي)

**Backend Jest:**
```bash
cd apps/backend && npm run test:e2e
```
يُنتج `test-results-clients.json` ثم يُشغّل `test:report` تلقائياً.

**Dashboard E2E:** Playwright was removed 2026-04-16. Dashboard QA is now
manual via Chrome DevTools MCP — those runs land in Kiwi TCMS via
`npm run kiwi:sync-manual`, not in this HTML report.

### فتح التقرير
```bash
# من الجذر:
npm run test:report:open        # يولّد التقرير ويفتحه في المتصفح
npm run test:report             # يولّد فقط
```

أو مباشرة افتح: `data/test-reports/output/test-report.html`

## 🛠️ وسم اختبارات قديمة دفعة واحدة

إذا كان عندك اختبارات قديمة بدون metadata:

```bash
py test-reports/scripts/tag_tests.py
```

السكريبت يضيف metadata لأسماء الاختبارات تلقائياً بناءً على:
- ID prefix (CL → Clients)
- اسم `describe()` المحيط
- قوائم P1/P3 المحددة مسبقاً

## 🎨 مميزات التقرير

- **Standalone** — ملف HTML واحد، لا dependencies
- **تجميع Module → Slice** — توسعة/طيّ كل مجموعة
- **بطاقات الموديولات** — اضغط أي موديول للفلترة
- **فلاتر** — حالة، أولوية، مصدر (Jest/Playwright)، بحث نصي
- **Dark/Light** تلقائي
- **RTL + عربي** — IBM Plex Sans Arabic
- **تفاصيل موسّعة** — اضغط أي صف لرؤية الاختبارات المرتبطة + رسائل الفشل
- **معلومات المصدر** — يظهر مسار ملف الاختبار لكل sub-test

## 📈 آخر نتيجة (2026-04-15)

| | عدد |
|---|---|
| الاختبارات الآلية | 76 |
| السيناريوهات (بعد الضمّ) | 73 |
| ✅ Pass | 71 |
| ❌ Fail | 1 |
| ⏭️ Skipped | 1 |
| الموديولات | 1 (Clients) |
| Slices في Clients | 12 |

## 🔍 كيف يجد السكريبت نتائج الاختبارات

السكريبت يمسح `apps/**/*` عن:
- أي ملف يطابق `test-results-*.json` (Jest)

إذا أضفت موديول جديد (مثل Employees)، فقط شغّل اختبارات E2E له بأي اسم:
```bash
cd apps/backend && npx jest test/e2e/people/employees.e2e-spec.ts \
  --json --outputFile=test-results-employees.json
```
السكريبت سيلتقطه تلقائياً ويُظهر "Employees" كموديول جديد في التقرير.
