# المستخدمون والأدوار والصلاحيات (Users · Roles · Permissions)

---

## Scenario Audit Summary

- Total scenarios (original): 31
- Valid: 19
- Fixed: 8
- Removed: 1
- Added: 20
- **Total (final)**: 51

---

## Major Issues Found

- USR-C3: error code خاطئ — الصحيح `USER_EMAIL_EXISTS` وليس `CONFLICT`
- USR-C7/C8: الحقل `roleSlug` صحيح (ليس `roleId`) — VALID لكن يُكمَّل بمزيد من التفاصيل
- USR-DA2: محاولة الدخول بحساب معطّل يعيد 401 (ليس 403) — الـ login guard يعيد Unauthorized
- USR-C1: status code خاطئ — يعيد 200 وليس 201 (لا يوجد @HttpCode(201) على POST /users)
- ROLE-C2: error code خاطئ — يستخدم `CONFLICT` (ConflictException) — صحيح لكن بدون error string صريح
- USR-RL1: body خاطئ — يقبل `roleId` أو `roleSlug` (أحدهما إلزامي) وليس `roleSlug` فقط
- USR-DA1: تعطيل المستخدم لنفسه يعيد 400 VALIDATION_ERROR — مفقود
- USR-D1: حذف المستخدم لنفسه يعيد 400 VALIDATION_ERROR — مفقود
- سيناريوهات privilege escalation مفقودة
- سيناريوهات 401 مفقودة كلياً

---

## إنشاء مستخدم

> Endpoint: `POST /users` — يتطلب صلاحية `users:create` — يعيد 200

| # | الاسم | الوصف | النتيجة المتوقعة |
| --- | --- | --- | --- |
| USR-C1 | إنشاء أساسي | email + password + firstName + lastName + roleSlug | 200 + { success: true, data: { id, email, firstName, lastName, roles } } |
| USR-C2 | مع phone | رقم E.164 صحيح | 200 + phone محفوظ |
| USR-C3 | كلمة مرور ضعيفة — بدون حرف كبير | password="password1" | 400 VALIDATION_ERROR |
| USR-C4 | كلمة مرور أقل من 8 أحرف | password="Ab1" | 400 VALIDATION_ERROR |
| USR-C5 | بريد مكرر | email موجود مسبقاً | 409 USER_EMAIL_EXISTS |
| USR-C6 | بريد غير صالح | email="not-email" | 400 VALIDATION_ERROR |
| USR-C7 | بدون firstName | حقل إلزامي | 400 VALIDATION_ERROR |
| USR-C8 | phone بدون كود دولة | phone="0501234567" | 400 VALIDATION_ERROR |
| USR-C9 | بدون roleSlug | حقل إلزامي | 400 VALIDATION_ERROR |
| USR-C10 | roleSlug غير موجود | قيمة غير مرتبطة بدور | 404 NOT_FOUND |
| USR-C11 | تعيين دور super_admin من غير super_admin | roleSlug="super_admin" من مستخدم عادي | 403 PRIVILEGE_ESCALATION |
| USR-C12 | بدون مصادقة | POST /users بدون token | 401 Unauthorized |

---

## قراءة المستخدمين

> يتطلب صلاحية `users:view`

| # | الاسم | الوصف | النتيجة المتوقعة |
| --- | --- | --- | --- |
| USR-L1 | قراءة الكل | GET /users | 200 + { items, meta } (بدون passwordHash) |
| USR-L2 | بحث بالاسم | GET /users?search=أحمد | 200 + مستخدمون يطابقون الاسم |
| USR-L3 | بحث بالبريد | GET /users?search=@clinic | 200 + مستخدمون يطابقون البريد |
| USR-L4 | فلترة بالنشاط | GET /users?isActive=false | 200 + مستخدمون معطَّلون فقط |
| USR-L5 | مستخدم بـ ID | GET /users/:id | 200 + تفاصيل كاملة + roles (array of slugs) |
| USR-L6 | ID وهمي | GET /users/:uuid-غير-موجود | 404 USER_NOT_FOUND |
| USR-L7 | بدون مصادقة | GET /users بدون token | 401 Unauthorized |

---

## تعديل المستخدم

> Endpoint: `PATCH /users/:id` — يتطلب صلاحية `users:edit`

| # | الاسم | الوصف | النتيجة المتوقعة |
| --- | --- | --- | --- |
| USR-U1 | تعديل الاسم | firstName + lastName جديدان | 200 + الاسم المحدَّث |
| USR-U2 | تعديل البريد | email جديد صالح غير مكرر | 200 + البريد الجديد |
| USR-U3 | تعديل الهاتف | phone بتنسيق E.164 | 200 + الرقم الجديد |
| USR-U4 | بريد مكرر | email موجود لدى مستخدم آخر | 409 USER_EMAIL_EXISTS |
| USR-U5 | مستخدم غير موجود | ID وهمي | 404 USER_NOT_FOUND |
| USR-U6 | بدون صلاحية | مستخدم بدون users:edit | 403 FORBIDDEN |

---

## تفعيل وتعطيل المستخدم

> يتطلب صلاحية `users:edit`

| # | الاسم | الوصف | النتيجة المتوقعة |
| --- | --- | --- | --- |
| USR-DA1 | تعطيل مستخدم | PATCH /users/:id/deactivate | 200 + isActive=false |
| USR-DA2 | تعطيل نفسه | المستخدم يعطّل حسابه الخاص | 400 VALIDATION_ERROR |
| USR-DA3 | محاولة دخول بعد التعطيل | login بحساب معطّل | 401 Unauthorized |
| USR-DA4 | إعادة تفعيل | PATCH /users/:id/activate | 200 + isActive=true |
| USR-DA5 | ID وهمي | UUID غير موجود في deactivate/activate | 404 USER_NOT_FOUND |

---

## حذف المستخدم (Soft Delete)

> Endpoint: `DELETE /users/:id` — يتطلب صلاحية `users:delete`

| # | الاسم | الوصف | النتيجة المتوقعة |
| --- | --- | --- | --- |
| USR-D1 | حذف ناجح | DELETE /users/:id | 200 + { deleted: true } + يختفي من GET /users |
| USR-D2 | حذف نفسه | المستخدم يحذف حسابه الخاص | 400 VALIDATION_ERROR |
| USR-D3 | ID وهمي | UUID غير موجود | 404 USER_NOT_FOUND |

---

## إدارة الأدوار على المستخدم

> يتطلب صلاحية `roles:edit`

| # | الاسم | الوصف | النتيجة المتوقعة |
| --- | --- | --- | --- |
| USR-RL1 | إضافة دور بـ roleSlug | POST /users/:id/roles + { roleSlug: "receptionist" } | 200 + { success: true, message } |
| USR-RL2 | إضافة دور بـ roleId | POST /users/:id/roles + { roleId: "uuid" } | 200 + { success: true, message } |
| USR-RL3 | بدون roleId أو roleSlug | body فارغ | 400 VALIDATION_ERROR |
| USR-RL4 | دور وهمي | roleSlug غير موجود | 404 ROLE_NOT_FOUND |
| USR-RL5 | تعيين super_admin من غير super_admin | roleSlug="super_admin" | 403 PRIVILEGE_ESCALATION |
| USR-RL6 | حذف دور | DELETE /users/:id/roles/:roleId | 200 + { removed: true } |
| USR-RL7 | حذف الدور الأخير | المستخدم يملك دوراً واحداً فقط | 400 VALIDATION_ERROR |
| USR-RL8 | مستخدم وهمي | userId غير موجود | 404 USER_NOT_FOUND |

---

## إنشاء الأدوار

> Endpoint: `POST /roles` — يتطلب صلاحية `roles:create` — يعيد 200

| # | الاسم | الوصف | النتيجة المتوقعة |
| --- | --- | --- | --- |
| ROLE-C1 | إنشاء دور | name + description | 200 + { id, name, slug (auto-generated), description, permissions: [] } |
| ROLE-C2 | مع slug صريح | name + slug | 200 + slug المُرسَل محفوظ |
| ROLE-C3 | اسم مكرر | name موجود مسبقاً | 409 CONFLICT |
| ROLE-C4 | بدون name | حقل إلزامي | 400 VALIDATION_ERROR |
| ROLE-C5 | name يتجاوز 255 حرف | 256 حرف | 400 VALIDATION_ERROR |
| ROLE-C6 | description يتجاوز 500 حرف | 501 حرف | 400 VALIDATION_ERROR |
| ROLE-C7 | بدون مصادقة | POST /roles بدون token | 401 Unauthorized |

---

## حذف الأدوار

> Endpoint: `DELETE /roles/:id` — يتطلب صلاحية `roles:delete`

| # | الاسم | الوصف | النتيجة المتوقعة |
| --- | --- | --- | --- |
| ROLE-D1 | حذف دور مخصص | دور أنشأه المستخدم (isSystem=false) | 200 + { deleted: true } |
| ROLE-D2 | حذف دور system | دور مدمج (isSystem=true) | 400 SYSTEM_ROLE |
| ROLE-D3 | ID وهمي | UUID غير موجود | 404 NOT_FOUND |

---

## إدارة الصلاحيات على الأدوار

> يتطلب صلاحية `roles:edit`

| # | الاسم | الوصف | النتيجة المتوقعة |
| --- | --- | --- | --- |
| ROLE-P1 | إضافة صلاحية | POST /roles/:id/permissions + { module: "bookings", action: "create" } | 200 + { id, roleId, permissionId, permission: { module, action } } |
| ROLE-P2 | module/action فارغ | حقول إلزامية مفقودة | 400 VALIDATION_ERROR |
| ROLE-P3 | حذف صلاحية | DELETE /roles/:id/permissions + { module, action } | 200 + { deleted: true } |
| ROLE-P4 | تعديل صلاحيات دور system | ROLE-P1 أو P3 على دور isSystem=true | 400 SYSTEM_ROLE |
| ROLE-P5 | دور وهمي | roleId غير موجود | 404 NOT_FOUND |

---

## قراءة الصلاحيات والأدوار

| # | الاسم | الوصف | النتيجة المتوقعة |
| --- | --- | --- | --- |
| PERM-L1 | قراءة كل الصلاحيات | GET /permissions (يتطلب roles:view) | 200 + مصفوفة { id, module, action } مرتبة أبجدياً |
| PERM-L2 | قراءة كل الأدوار | GET /roles (يتطلب roles:view) | 200 + مصفوفة بأدوار مع permissions[] لكل دور |

---

## التحقق من تطبيق الصلاحيات (RBAC)

| # | الاسم | الوصف | النتيجة المتوقعة |
| --- | --- | --- | --- |
| RBAC-1 | دور بدون صلاحية | محاولة وصول لـ endpoint يحتاج bookings:create | 403 FORBIDDEN |
| RBAC-2 | دور بـ view فقط | محاولة create أو delete | 403 FORBIDDEN |
| RBAC-3 | منح صلاحية ثم اختبارها | إضافة صلاحية → الوصول ينجح فوراً (cache invalidated) | 200 |
| RBAC-4 | سحب صلاحية ثم اختبارها | حذف صلاحية → الوصول يُرفض فوراً (cache invalidated) | 403 FORBIDDEN |
