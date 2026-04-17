# خطة اختبار E2E — المساعد الذكي (Chatbot)

> **المسار:** `/chatbot` — 4 tabs (Sessions / Knowledge Base / Config / Analytics)
> **آخر تحديث:** 2026-04-17

---

## 1. التحضير

```bash
cd apps/backend && npm run dev
cd apps/dashboard && npm run dev
```

**البيانات:**
- 5+ جلسات (active/ended/handedOff)
- جلسات بلغة ar + en
- 10+ KB entries (sources: manual/auto_sync/file_upload)
- 2+ files uploaded (status: pending/completed/failed)
- config entries لكل category
- بيانات analytics (7+ أيام)

---

## 2. خريطة الصفحة

```text
Breadcrumbs
PageHeader    [عنوان+وصف]
Tabs:         [الجلسات] [قاعدة المعرفة] [الإعدادات] [التحليلات]

Sessions:     DataTable + SessionDetailSheet
KB:           Actions Bar + Entries Table + Files Card + CreateKbEntryDialog
Config:       Category Cards (personality/rules/handoff/sync/ai/general)
Analytics:    SessionStats + charts
```

---

## 3. Tab: الجلسات (Sessions)

### 3.1 التحميل
- [ ] `GET /dashboard/ai/chatbot/sessions?page=1&limit=20` → 200
- [ ] الجدول يعرض 7 أعمدة

### 3.2 الأعمدة
| # | العمود | المحتوى |
|---|--------|---------|
| 1 | id | أول 8 أحرف (clickable) |
| 2 | المستخدم | user.firstName + lastName |
| 3 | الحالة | badge: active/ended/handedOff |
| 4 | الرسائل | _count.messages |
| 5 | اللغة | AR/EN/— (uppercase) |
| 6 | بدأت | `MMM d, yyyy HH:mm` |
| 7 | المدة | `Xm` أو `Xh Ym` (محسوبة من startedAt+endedAt) |

اختبارات:
- [ ] session active بلا endedAt → المدة = from startedAt to now
- [ ] handedOff → badge مميز (أصفر/برتقالي)
- [ ] language null → `—`

### 3.3 SessionDetailSheet
- [ ] اضغط id → sheet يفتح
- [ ] يعرض ChatMessage[] بالترتيب الزمني
- [ ] لكل رسالة: role (user/assistant/system/staff) + content + intent + toolName + tokenCount
- [ ] role بألوان مختلفة
- [ ] code blocks / markdown مُعَرَّض صحيح
- [ ] long messages scroll

---

## 4. Tab: قاعدة المعرفة (Knowledge Base)

### 4.1 Actions Bar
- زر `+ إضافة مدخل` → CreateKbEntryDialog
- زر `مزامنة` → `POST /dashboard/ai/knowledge-base/sync`

### 4.2 KB Entries Table
- Columns: title, content (truncated), category, source (badge), isActive (toggle), actions (edit/delete)
- source values: `manual | auto_sync | file_upload`

اختبارات:
- [ ] كل source بلون badge مختلف
- [ ] isActive toggle inline → `PATCH` immediate
- [ ] content truncated بـ `...` + tooltip

### 4.3 CreateKbEntryDialog
| الحقل | نوع | مطلوب | validation |
|-------|-----|-------|------------|
| title | text | ✓ | min 1 |
| content | textarea | ✓ | min 1 |
| category | text | — | — |

- [ ] submit فارغ → أخطاء
- [ ] `POST /dashboard/ai/knowledge-base` → toast + جدول يحدّث

### 4.4 EditKbEntry
- [ ] كل الحقول قابلة للتعديل + isActive
- [ ] `PATCH /dashboard/ai/knowledge-base/{id}`

### 4.5 Delete KB
- [ ] Dialog confirm
- [ ] `DELETE /dashboard/ai/knowledge-base/{id}`
- [ ] entry من source=file_upload — تحذير (يرتبط بـ chunks)

### 4.6 Sync
- [ ] اضغط Sync → loading
- [ ] `POST /dashboard/ai/knowledge-base/sync` → `{synced: N}`
- [ ] toast يعرض العدد
- [ ] KB Entries جديدة تظهر (source=auto_sync)

### 4.7 Files Section
**Upload:**
- [ ] input يقبل: .txt, .pdf, .md, .csv, .json
- [ ] ملف غير مدعوم → رفض + خطأ
- [ ] ملف > حد الحجم → خطأ
- [ ] `POST /dashboard/ai/knowledge-base/files` (multipart)
- [ ] Status بعد upload: `pending`

**File rows:**
| حقل | عرض |
|-----|-----|
| fileName | نص |
| fileSize | KB/MB |
| chunksCount | رقم |
| status | badge: pending/processing/completed/failed |
| actions | Process / Delete |

اختبارات:
- [ ] Process pending file → `POST /files/{id}/process` → status → processing → completed
- [ ] failed file → error visible + retry
- [ ] Delete file → cascades chunks in KB entries
- [ ] completed file → chunksCount > 0

---

## 5. Tab: الإعدادات (Config)

### 5.1 Category Cards
Categories: `personality | rules | handoff | sync | ai | general`

لكل category → Card مع key-value pairs:
- [ ] input type نص (auto-parse JSON إذا صالح)
- [ ] زر `حفظ` per-category

### 5.2 تعديل config
- [ ] غيّر قيمة → `PATCH /dashboard/ai/chatbot/config` body `{configs: [{key, value, category}]}`
- [ ] toast نجاح
- [ ] JSON غير صالح → خطأ parse
- [ ] قيمة فارغة — تحذف الـ config أم تحفظها فارغة؟

### 5.3 Category-specific tests
- **personality**: tone, persona — نصوص طويلة
- **rules**: قائمة rules (array) — JSON
- **handoff**: threshold, contact — arrays/objects
- **sync**: cron schedule
- **ai**: model name, temperature (number in string)
- **general**: misc

---

## 6. Tab: التحليلات (Analytics)

### 6.1 تحميل
- [ ] `GET /dashboard/ai/chatbot/analytics?from=<date>&to=<date>` → 200
- [ ] SessionStats يعرض:
  - totalSessions
  - avgMessagesPerSession
  - handoffRate (%)
  - totalMessages
  - languageDistribution (pie/bar)
  - topIntents (list)
  - topTools (list)
  - estimatedTokens
  - topQuestions (content + count)

اختبارات:
- [ ] date range picker — from/to
- [ ] تغيير range → request جديد + charts تحدّث
- [ ] handoffRate = 0 — يعرض `0%`
- [ ] empty data — empty state لكل widget

---

## 7. Edge Cases

### 7.1 Session بدون messages
- [ ] _count.messages = 0
- [ ] DetailSheet empty state

### 7.2 KB entry orphaned (file deleted)
- [ ] entry لا يزال موجود أم يُحذف cascade؟

### 7.3 Config بدون value
- [ ] default يُستخدم؟

### 7.4 File upload أثناء processing سابق
- [ ] queue أم rejection؟

### 7.5 Sync بينما sync سابق شغال
- [ ] concurrent guard

### 7.6 Analytics بدون بيانات
- [ ] كل widget empty state

### 7.7 Language distribution فقط AR
- [ ] chart يعرض شريحة واحدة

---

## 8. RTL + Dark
- [ ] tabs RTL order
- [ ] SessionDetailSheet — messages bubbles: user يمين، assistant يسار (أو العكس؟)
- [ ] JSON editor font monospace LTR

---

## 9. Screenshots
`screenshots/chatbot/`:
1. `sessions-list.png`
2. `session-detail-sheet.png`
3. `kb-entries.png`
4. `kb-create-dialog.png`
5. `files-upload.png`
6. `config-personality.png`
7. `config-ai.png`
8. `analytics-full.png`

---

## 10. curl

```bash
TOKEN="<jwt>"
API="http://localhost:5100"

# sessions
curl -H "Authorization: Bearer $TOKEN" \
  "$API/dashboard/ai/chatbot/sessions?page=1&limit=20" | jq

# KB
curl -H "Authorization: Bearer $TOKEN" \
  "$API/dashboard/ai/knowledge-base?page=1&limit=20&source=manual" | jq

# إنشاء KB
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"ساعات العمل","content":"من السبت إلى الخميس ٩ص-٩م","category":"general"}' \
  "$API/dashboard/ai/knowledge-base" | jq

# Sync
curl -X POST -H "Authorization: Bearer $TOKEN" \
  "$API/dashboard/ai/knowledge-base/sync" | jq

# Upload file (multipart)
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -F "file=@./test.pdf" \
  "$API/dashboard/ai/knowledge-base/files" | jq

# Process
curl -X POST -H "Authorization: Bearer $TOKEN" \
  "$API/dashboard/ai/knowledge-base/files/<id>/process" | jq

# Config GET
curl -H "Authorization: Bearer $TOKEN" \
  "$API/dashboard/ai/chatbot/config" | jq

# Config update
curl -X PATCH -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"configs":[{"key":"tone","value":"friendly","category":"personality"}]}' \
  "$API/dashboard/ai/chatbot/config" | jq

# Analytics
curl -H "Authorization: Bearer $TOKEN" \
  "$API/dashboard/ai/chatbot/analytics?from=2026-04-01&to=2026-04-17" | jq
```

---

## 11. Red Flags

- ⚠️ **File upload security:** PDF/CSV/JSON parsing — malicious payload؟
- ⚠️ **Sync concurrency** — two sync requests في آن واحد
- ⚠️ **Config JSON parse** — قيمة خاطئة قد تكسر chatbot
- ⚠️ **KB chunks orphan** بعد حذف file
- ⚠️ **Session endedAt null** — مدة تحسب live، reload يغير القيمة
- ⚠️ **Token counting drift** — estimatedTokens approximate فقط
- ⚠️ **Language detection** — ar/en misclassification
- ⚠️ **Handoff flow** — live_chat vs contact_number
- ⚠️ **Owner-only؟** — AI module قد يكون حساس

---

## 12. النجاح
- [ ] كل 4 tabs passed
- [ ] KB CRUD + file upload + process + sync
- [ ] Config edit لكل 6 categories
- [ ] Analytics date range filtering
- [ ] Session detail messages render correctly
- [ ] Screenshots + curl
