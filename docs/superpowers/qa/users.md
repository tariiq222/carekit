# خطة اختبار E2E — المستخدمون (Users)

> **المسار:** `/users` — 3 tabs (Users / Roles / Activity Log)
> **آخر تحديث:** 2026-04-17

---

## 1. التحضير

```bash
cd apps/backend && npm run dev
cd apps/dashboard && npm run dev
```

**البيانات:**
- 5+ مستخدمين بأدوار مختلفة: SUPER_ADMIN, ADMIN, RECEPTIONIST, ACCOUNTANT, EMPLOYEE
- 3+ roles مخصّصة
- activity log entries

---

## 2. خريطة الصفحة

```text
Breadcrumbs
PageHeader   [عنوان+وصف]                 [+ إضافة مستخدم | إنشاء دور]
StatsGrid    [إجمالي] [نشط] [الأدوار] [غير نشط]
FilterBar    [بحث] [إعادة تعيين]
Tabs:        [المستخدمون] [الأدوار] [سجل النشاط]

Users tab:    DataTable + AddUserDialog + EditUserDialog + DeleteUserDialog
Roles tab:    DataTable + CreateRoleDialog + DeleteRoleDialog
Activity:     Activity log list
```

---

## 3. التحميل

- [ ] `GET /dashboard/identity/users?page=1&limit=20` → 200
- [ ] `GET /dashboard/identity/roles` → 200
- [ ] StatsGrid: Total/Active/Roles count/Inactive

---

## 4. FilterBar

- بحث: name/email/phone
- لا dropdown filters (مختلف عن غيرها)
- [ ] Reset

---

## 5. Tab: المستخدمون

### 5.1 الأعمدة
| # | العمود | المحتوى |
|---|--------|---------|
| 1 | المستخدم | avatar + name + email |
| 2 | الدور | badge |
| 3 | الهاتف | tabular-nums أو `—` |
| 4 | الحالة | Active/Inactive badge |
| 5 | تاريخ الانضمام | date format |
| 6 | إجراءات | dropdown: Edit / Toggle Active / Delete |

اختبارات:
- [ ] role badge بلون حسب الدور (SUPER_ADMIN مميز)
- [ ] phone فارغ → `—`

### 5.2 Toggle Active
- [ ] active → `PATCH /users/{id}/deactivate`
- [ ] inactive → `PATCH /users/{id}/activate`
- [ ] toast + badge يتغير
- [ ] SUPER_ADMIN لا يمكن تعطيله؟ تحقق

### 5.3 AddUserDialog / EditUserDialog

| الحقل | نوع | create | edit | validation |
|-------|-----|--------|------|-------|
| email | email | ✓ | ✓ | valid email format |
| password | password | ✓ | — (create only) | min 8 |
| name | text | ✓ | ✓ | min 1 |
| phone | PhoneInput | — | — | regex intl `/^\+[1-9]\d{6,14}$/` |
| gender | select | — | — | male/female |
| role | select | ✓ | ✓ | enum 6 قيم |

اختبارات:
- [ ] submit فارغ → أخطاء على email/password/name/role
- [ ] password < 8 حرف → خطأ
- [ ] email غير صالح → خطأ
- [ ] email مكرر → backend 409
- [ ] phone intl خاطئ → خطأ
- [ ] role = SUPER_ADMIN — يُسمح إنشاء؟ أو محظور؟
- [ ] edit لا يعرض password (اختبار أمان)

**⚠️ Security:** password حقل sensitive — لازم يكون type=password، ولا يظهر في network (يجب POST HTTPS).

### 5.4 DeleteUserDialog
- [ ] اسم المستخدم bold في description
- [ ] Cancel + Delete (destructive)
- [ ] `DELETE /users/{id}` → void
- [ ] حذف النفس → محظور
- [ ] حذف SUPER_ADMIN الوحيد → محظور
- [ ] مستخدم عنده حجوزات مخصصة (كموظف) — كيف يُعامل؟

---

## 6. Tab: الأدوار (Roles)

### 6.1 الأعمدة
- name (badge)
- description
- users count (كم مستخدم بهذا الدور)
- actions: Delete (no edit من هنا غالباً)

### 6.2 CreateRoleDialog
| الحقل | نوع | مطلوب | validation |
|-------|-----|-------|------|
| name | text | ✓ | min 1 |
| description | textarea | — | — |

- [ ] submit فارغ → خطأ name
- [ ] name مكرر → 409
- [ ] `POST /dashboard/identity/roles` → role جديد

### 6.3 حذف دور
- [ ] `DELETE /dashboard/identity/roles/{id}`
- [ ] دور عنده users → backend يرفض
- [ ] روال system (مثل SUPER_ADMIN) — غير قابل للحذف

---

## 7. Tab: سجل النشاط (Activity Log)

ملاحظة: قد يُدمَج مع `/activity-log` page. تحقق.

- [ ] قائمة activity entries
- [ ] فلتر حسب user/action/date
- [ ] كل entry: user, action, target, timestamp

(انظر `activity-log.md` للتفاصيل الكاملة)

---

## 8. Edge Cases

### 8.1 مستخدم يحذف نفسه
- [ ] محظور — UI يخفي الخيار
- [ ] backend يرفض كـ failsafe

### 8.2 آخر SUPER_ADMIN
- [ ] لا يمكن حذفه/تعطيله

### 8.3 تغيير role للنفس
- [ ] محظور

### 8.4 Custom role vs built-in role
- [ ] built-in غير قابل للحذف (SUPER_ADMIN, ADMIN, etc.)

### 8.5 password reset
- [ ] هل يوجد زر "إعادة تعيين كلمة المرور"؟ من أين؟

### 8.6 email change
- [ ] يُرسل verification؟

### 8.7 phone format
- [ ] intl regex مختلف عن clients (سعودي فقط)

---

## 9. RTL + Dark
- [ ] role badges مقروءة dark
- [ ] tabs ترتيب RTL
- [ ] email input LTR

---

## 10. Screenshots
`screenshots/users/`:
1. `users-tab.png`
2. `roles-tab.png`
3. `add-user-dialog.png`
4. `edit-user-dialog.png`
5. `delete-user-dialog.png`
6. `create-role-dialog.png`
7. `stats-grid.png`

---

## 11. curl

```bash
TOKEN="<jwt>"
API="http://localhost:5100"

# users
curl -H "Authorization: Bearer $TOKEN" \
  "$API/dashboard/identity/users?page=1&limit=20" | jq

# create user
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"secure12","name":"Test User","role":"RECEPTIONIST","phone":"+966501234567"}' \
  "$API/dashboard/identity/users" | jq

# activate
curl -X PATCH -H "Authorization: Bearer $TOKEN" \
  "$API/dashboard/identity/users/<id>/activate"

# deactivate
curl -X PATCH -H "Authorization: Bearer $TOKEN" \
  "$API/dashboard/identity/users/<id>/deactivate"

# roles
curl -H "Authorization: Bearer $TOKEN" \
  "$API/dashboard/identity/roles" | jq

# create role
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"مدير فرع","description":"صلاحيات مدير فرع"}' \
  "$API/dashboard/identity/roles" | jq
```

---

## 12. Red Flags

- ⚠️ **Password handling** — لا يظهر في logs/network response
- ⚠️ **Self-delete** — blocked at UI AND backend
- ⚠️ **Last SUPER_ADMIN** — failsafe لا يُحذف
- ⚠️ **Role elevation** — admin يعدّل SUPER_ADMIN؟ محظور
- ⚠️ **Built-in roles immutable** — لا حذف/تعديل
- ⚠️ **Phone regex differs** — intl هنا vs سعودي فقط في clients
- ⚠️ **Email uniqueness** — case-insensitive؟
- ⚠️ **Password reset** flow — token expiry
- ⚠️ **Activity log** integrated or separate

---

## 13. النجاح
- [ ] 3 tabs passed
- [ ] User CRUD + role assignment
- [ ] Roles CRUD
- [ ] Security edge cases (self-delete, last admin)
- [ ] Screenshots + curl
