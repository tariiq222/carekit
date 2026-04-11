# المصادقة (Auth)

## تسجيل حساب جديد

| # | الاسم | الوصف | النتيجة المتوقعة |
|---|-------|-------|-----------------|
| AU-R1 | تسجيل أساسي | email + password + firstName + lastName | 201 + userId |
| AU-R2 | كلمة مرور ضعيفة | بدون حرف كبير أو رقم | 400 VALIDATION_ERROR |
| AU-R3 | كلمة مرور قصيرة | أقل من 8 أحرف | 400 VALIDATION_ERROR |
| AU-R4 | بريد مكرر | email موجود مسبقاً | 409 CONFLICT |
| AU-R5 | بريد غير صالح | `email: "notanemail"` | 400 VALIDATION_ERROR |
| AU-R6 | بدون firstName | حقل إلزامي مفقود | 400 VALIDATION_ERROR |
| AU-R7 | مع phone | رقم E.164 صحيح `+966501234567` | 201 + الرقم محفوظ |
| AU-R8 | phone غير صالح | `phone: "0501234567"` بدون كود الدولة | 400 VALIDATION_ERROR |
| AU-R9 | مع gender | `gender: male` أو `female` | 201 + الجنس محفوظ |
| AU-R10 | gender غير صالح | `gender: "other"` | 400 VALIDATION_ERROR |

---

## تسجيل الدخول (بريد + كلمة مرور)

| # | الاسم | الوصف | النتيجة المتوقعة |
|---|-------|-------|-----------------|
| AU-L1 | دخول ناجح | بريد وكلمة مرور صحيحان | 200 + accessToken (refreshToken عبر HTTP-only cookie) |
| AU-L2 | كلمة مرور خاطئة | نفس البريد + كلمة مرور خاطئة | 401 UNAUTHORIZED |
| AU-L3 | بريد غير موجود | email وهمي | 401 UNAUTHORIZED |
| AU-L4 | بريد بأحرف كبيرة | `EMAIL@DOMAIN.COM` → يُطابق lowercase | 200 (normalization) |
| AU-L5 | حساب معطّل | مستخدم deactivated | 403 FORBIDDEN |

---

## تسجيل الدخول بـ OTP

| # | الاسم | الوصف | النتيجة المتوقعة |
|---|-------|-------|-----------------|
| AU-O1 | إرسال OTP | POST /auth/login/otp/send بريد صحيح | 200 + رسالة تأكيد الإرسال |
| AU-O2 | OTP لبريد وهمي | بريد غير مسجّل | 200 OK (أمان: منع تعداد البريد) |
| AU-O3 | تحقق صحيح | الكود الصحيح خلال المهلة | 200 + accessToken (refreshToken عبر HTTP-only cookie) |
| AU-O4 | كود خاطئ | كود عشوائي | 400 AUTH_OTP_INVALID |
| AU-O5 | كود منتهي | الكود بعد انتهاء صلاحيته | 400 AUTH_OTP_EXPIRED |
| AU-O6 | إرسال متكرر | إرسال OTP أكثر من مرة لنفس البريد | throttle بعد الحد المسموح |

---

## تجديد الـ Token

| # | الاسم | الوصف | النتيجة المتوقعة |
|---|-------|-------|-----------------|
| AU-RT1 | تجديد ناجح | refreshToken صالح | 200 + accessToken جديد (refreshToken جديد عبر HTTP-only cookie) |
| AU-RT2 | token مزوّر | قيمة عشوائية | 401 UNAUTHORIZED |
| AU-RT3 | token ملغى | بعد تسجيل الخروج | 401 UNAUTHORIZED |

---

## تسجيل الخروج

| # | الاسم | الوصف | النتيجة المتوقعة |
|---|-------|-------|-----------------|
| AU-LO1 | خروج ناجح | refreshToken صالح | 200 + Token يُلغى |
| AU-LO2 | استخدام بعد الخروج | refreshToken بعد الخروج | 401 UNAUTHORIZED |

---

## الملف الشخصي (GET /auth/me)

| # | الاسم | الوصف | النتيجة المتوقعة |
|---|-------|-------|-----------------|
| AU-ME1 | قراءة الملف | JWT صالح | 200 + بيانات المستخدم + الأدوار |
| AU-ME2 | بدون token | لا يوجد Authorization header | 401 UNAUTHORIZED |
| AU-ME3 | token منتهي | accessToken منتهي الصلاحية | 401 UNAUTHORIZED |

---

## نسيان كلمة المرور

| # | الاسم | الوصف | النتيجة المتوقعة |
|---|-------|-------|-----------------|
| AU-FP1 | طلب إعادة تعيين | POST /auth/password/forgot ببريد صحيح | 200 + OTP مُرسل |
| AU-FP2 | بريد وهمي | بريد غير مسجّل | 200 OK (أمان: منع تعداد البريد) |
| AU-FP3 | إعادة التعيين بكود صحيح | كود صالح + newPassword مطابق للمتطلبات | 200 + كلمة المرور تتغير |
| AU-FP4 | كود خاطئ | كود عشوائي | 401 INVALID_OTP |
| AU-FP5 | كلمة مرور جديدة ضعيفة | بدون حرف كبير | 400 VALIDATION_ERROR |
| AU-FP6 | تسجيل الدخول بالكلمة الجديدة | بعد إعادة التعيين | 200 ناجح |
| AU-FP7 | الكلمة القديمة لا تعمل | بعد إعادة التعيين | 401 UNAUTHORIZED |

---

## تغيير كلمة المرور (مسجّل الدخول)

| # | الاسم | الوصف | النتيجة المتوقعة |
|---|-------|-------|-----------------|
| AU-CP1 | تغيير ناجح | currentPassword صحيحة + newPassword جديدة | 200 + جميع الجلسات تُلغى |
| AU-CP2 | كلمة المرور الحالية خاطئة | currentPassword خاطئة | 401 INVALID_CREDENTIALS |
| AU-CP3 | newPassword ضعيفة | بدون رقم أو حرف كبير | 400 VALIDATION_ERROR |
| AU-CP4 | استخدام refreshToken القديم بعد التغيير | الجلسات القديمة مُلغاة | 401 UNAUTHORIZED |

---

## التحقق من البريد الإلكتروني

| # | الاسم | الوصف | النتيجة المتوقعة |
|---|-------|-------|-----------------|
| AU-EV1 | طلب OTP التحقق | POST /auth/email/verify/send | 200 + OTP مُرسل |
| AU-EV2 | تحقق ناجح | كود صحيح | 200 + `emailVerified=true` |
| AU-EV3 | كود خاطئ | كود عشوائي | 400 AUTH_OTP_INVALID |

---

## نتائج التغطية

| # | النوع | الملف | الحالة |
|---|-------|-------|--------|
| AU-R1 | E2E | `auth.e2e-spec.ts` | ✅ مغطى |
| AU-R2 | Unit + E2E | `auth.register-dto.spec.ts` + `auth.e2e-spec.ts` + `auth-coverage.e2e-spec.ts` | ✅ مغطى |
| AU-R3 | Unit | `auth.register-dto.spec.ts` | ✅ مغطى |
| AU-R4 | E2E | `auth.e2e-spec.ts` | ✅ مغطى |
| AU-R5 | E2E | `auth.e2e-spec.ts` | ✅ مغطى |
| AU-R6 | E2E | `auth.e2e-spec.ts` | ✅ مغطى |
| AU-R7 | E2E | `auth.e2e-spec.ts` | ✅ مغطى |
| AU-R8 | E2E | `auth.e2e-spec.ts` | ✅ مغطى |
| AU-R9 | E2E | `auth.e2e-spec.ts` | ✅ مغطى |
| AU-R10 | E2E | `auth.e2e-spec.ts` | ✅ مغطى |
| AU-L1 | E2E | `auth.e2e-spec.ts` | ✅ مغطى |
| AU-L2 | E2E | `auth.e2e-spec.ts` | ✅ مغطى |
| AU-L3 | E2E | `auth.e2e-spec.ts` | ✅ مغطى |
| AU-L4 | E2E | `auth.e2e-spec.ts` | ✅ مغطى |
| AU-L5 | E2E | `auth-coverage.e2e-spec.ts` | ✅ مغطى |
| AU-O1 | E2E | `auth.e2e-spec.ts` | ✅ مغطى |
| AU-O2 | E2E | `auth-coverage.e2e-spec.ts` | ✅ مغطى — **تصحيح سيناريو**: السلوك الصحيح 200 لا 404 (منع تعداد البريد) |
| AU-O3 | E2E | `auth-coverage.e2e-spec.ts` | ✅ مغطى |
| AU-O4 | E2E | `auth.e2e-spec.ts` | ✅ مغطى |
| AU-O5 | E2E | `auth-coverage.e2e-spec.ts` | ✅ مغطى — **تصحيح سيناريو**: الخطأ 400 لا 401 |
| AU-O6 | E2E | `auth.e2e-spec.ts` | ✅ مغطى |
| AU-RT1 | E2E | `auth.e2e-spec.ts` | ✅ مغطى |
| AU-RT2 | E2E | `auth.e2e-spec.ts` | ✅ مغطى |
| AU-RT3 | E2E | `auth.e2e-spec.ts` | ✅ مغطى |
| AU-LO1 | E2E | `auth.e2e-spec.ts` | ✅ مغطى |
| AU-LO2 | E2E | `auth.e2e-spec.ts` | ✅ مغطى |
| AU-ME1 | E2E | `auth.e2e-spec.ts` | ✅ مغطى |
| AU-ME2 | E2E | `auth.e2e-spec.ts` | ✅ مغطى |
| AU-ME3 | E2E | `auth.e2e-spec.ts` | ✅ مغطى |
| AU-FP1 | E2E | `auth.e2e-spec.ts` | ✅ مغطى |
| AU-FP2 | E2E | `auth.e2e-spec.ts` | ✅ مغطى — **تصحيح سيناريو**: السلوك الصحيح 200 لا 404 (منع تعداد البريد) |
| AU-FP3 | E2E | `auth-coverage.e2e-spec.ts` | ✅ مغطى |
| AU-FP4 | E2E | `auth.e2e-spec.ts` | ✅ مغطى |
| AU-FP5 | E2E | `auth.e2e-spec.ts` | ✅ مغطى |
| AU-FP6 | E2E | `auth-coverage.e2e-spec.ts` | ✅ مغطى |
| AU-FP7 | E2E | `auth-coverage.e2e-spec.ts` | ✅ مغطى |
| AU-CP1 | E2E | `auth.e2e-spec.ts` | ✅ مغطى |
| AU-CP2 | E2E | `auth.e2e-spec.ts` | ✅ مغطى |
| AU-CP3 | E2E | `auth.e2e-spec.ts` | ✅ مغطى |
| AU-CP4 | E2E | `auth-coverage.e2e-spec.ts` | ✅ مغطى |
| AU-EV1 | E2E | `auth.e2e-spec.ts` | ✅ مغطى |
| AU-EV2 | E2E | `auth-coverage.e2e-spec.ts` | ✅ مغطى |
| AU-EV3 | E2E | `auth.e2e-spec.ts` | ✅ مغطى |
| AU-FP3-DB | E2E | `auth-db-assertions.e2e-spec.ts` | ✅ passwordHash تغير في DB + لا يُقبل القديم |
| AU-CP1-DB | E2E | `auth-db-assertions.e2e-spec.ts` | ✅ جميع صفوف refreshToken حُذفت من DB |
| AU-CP1-MULTI | E2E | `auth-multi-session.e2e-spec.ts` | ✅ كلا الجلستين مرفوضتان بعد تغيير كلمة المرور |
| AU-CP1-MULTI-RESET | E2E | `auth-multi-session.e2e-spec.ts` | ✅ كلا الجلستين مرفوضتان بعد إعادة التعيين |
| Boundary-PW-7 | Unit | `auth.register-dto.spec.ts` | ✅ 7 أحرف → فشل |
| Boundary-PW-8 | Unit | `auth.register-dto.spec.ts` | ✅ 8 أحرف صالحة → نجاح |
| Boundary-Email-Trim | Unit | `auth.register-dto.spec.ts` | ✅ @Transform يزيل المسافات |
| Boundary-Phone-Null | Unit | `auth.register-dto.spec.ts` | ✅ null/undefined → مقبول (@IsOptional) |
| Boundary-Gender-Null | Unit | `auth.register-dto.spec.ts` | ✅ null/undefined → مقبول (@IsOptional) |

---

## سيناريوهات الداشبورد (السلوك الرسمي)

> **ملاحظة معمارية**: لا يوجد صفحة `/login` مستقلة — حماية الصفحات تتم عبر `AuthGate` الذي يعرض `LoginForm` **في نفس الصفحة** بدلاً من redirect. جميع السلوكيات أدناه معتمدة على الكود الفعلي.

### الجلسة والحماية

| # | الاسم | الوصف | النتيجة المتوقعة |
|---|-------|-------|-----------------|
| DA-S1 | حماية الصفحات | مستخدم غير مسجل يزور صفحة محمية | LoginForm تظهر في نفس الصفحة (لا redirect) |
| DA-S2 | بقاء الجلسة بعد تحديث الصفحة | reload بعد الدخول | AuthProvider يستعيد الجلسة عبر refreshToken عند mount |
| DA-S3 | logout ناجح | الضغط على تسجيل الخروج | تنظيف حالة المستخدم + LoginForm تظهر مكان المحتوى |
| DA-S4 | منع الوصول بعد logout | محاولة الوصول لمحتوى محمي | AuthGate يعرض LoginForm |
| DA-S5 | access token منتهي | طلب API مع token منتهي | refresh تلقائي صامت — إذا فشل تظهر LoginForm |
| DA-S6 | refresh ناجح | token منتهي وrefresh صالح | يكمل المستخدم بدون انقطاع ظاهر |
| DA-S7 | refresh فاشل | token منتهي وrefresh غير صالح | logout إجباري + LoginForm تظهر في نفس الصفحة |
| DA-S9 | تغيير كلمة المرور من جهاز آخر | الجلسة القديمة على الداشبورد | api.ts يمسح token عند 401 → AuthProvider يُصفّر user → LoginForm |

### حالة المستخدم والواجهة

| # | الاسم | الوصف | النتيجة المتوقعة |
|---|-------|-------|-----------------|
| DA-U1 | تحميل بيانات المستخدم | بعد الدخول | بيانات المستخدم تظهر بشكل صحيح |
| DA-U2 | loading state | أثناء التحقق من الجلسة عند mount | spinner يظهر — المحتوى محجوب حتى انتهاء التحقق |
| DA-U3 | session expired | فشل refreshToken عند mount | تصفير user + LoginForm (لا redirect) |
| DA-U4 | رسالة خطأ عند فشل login | بيانات خاطئة | رسالة واضحة وغير تقنية من LoginForm |
| DA-U5 | إخفاء المحتوى قبل auth check | فتح صفحة محمية مع session غير مؤكدة | لا يظهر المحتوى الحساس حتى انتهاء التحقق |

### صلاحيات الوصول (UI-level فقط)

> **تنبيه**: لا يوجد route-level permission guard — الصلاحيات تُطبَّق على مستوى الواجهة فقط (إخفاء sidebar items). Backend يتولى الحماية الفعلية.

| # | الاسم | الوصف | النتيجة المتوقعة |
|---|-------|-------|-----------------|
| DA-P1 | مستخدم بصلاحية صحيحة | role مناسب | عناصر sidebar المرتبطة تظهر |
| DA-P2 | مستخدم بدون صلاحية | role غير مناسب | عناصر sidebar المحظورة مخفية |
| DA-P3 | wildcard permission | `module:*` | جميع عمليات الـ module مسموح بها |

### خارج الـ scope (غير موجود في الداشبورد)

| السيناريو | السبب |
|-----------|-------|
| DA-S8 (/login redirect للمستخدم المسجل) | لا توجد صفحة /login مستقلة |
| DA-P4 (deep link block بالصلاحية) | لا يوجد route-level permission guard |
| DA-F1 → DA-F5 (Forgot Password) | غير موجود في الداشبورد |
| DA-E1 → DA-E3 (Email Verification UI) | غير موجود في الداشبورد |

---

## تغطية الداشبورد (Unit — Vitest + Testing Library)

### `api-client.spec.ts` — `dashboard/lib/api.ts`

| # | الاسم | النتيجة المتوقعة |
|---|-------|-----------------|
| DA-API-1 | Authorization header موجود عند وجود token | `Bearer <token>` في الـ header |
| DA-API-2 | Authorization header غائب عند عدم وجود token | لا يوجد header |
| DA-API-3 | Cookie endpoints تستخدم `/api/proxy/` | URL يبدأ بـ `/api/proxy/auth/login` |
| DA-API-4 | Non-cookie endpoints تستخدم URL مباشر | URL لا يحتوي `/api/proxy/` |
| DA-API-5 | Unwrap envelope `{ success, data }` | النتيجة هي `data` مباشرة |
| DA-API-6 | ApiError عند non-2xx مع status + code | `err.status === 401`, `err.code` صحيح |
| DA-API-7 | ApiError.code = UNKNOWN عند JSON غير صالح | `err.code === 'UNKNOWN'` |
| DA-API-8 | 401 → refresh → retry (3 استدعاءات) | النتيجة صحيحة + `fetchMock` استُدعي 3 مرات |
| DA-API-9 | 401 + فشل refresh → مسح token + localStorage | `getAccessToken() === null` + localStorage فارغ |
| DA-API-10 | طلبات متزامنة 401 → refresh مرة واحدة فقط | استدعاء refresh = 1 |

### `auth-provider.spec.tsx` — `AuthProvider`

| # | الاسم | النتيجة المتوقعة |
|---|-------|-----------------|
| DA-AP-1 | استعادة الجلسة عند mount (نجاح) | `loading → ready` + user محدد |
| DA-AP-2 | استعادة الجلسة تفشل → user null | `user === null`, `isAuthenticated === false` |
| DA-AP-3 | فشل الاستعادة يمسح localStorage | `carekit_user` محذوف |
| DA-AP-4 | login() يضبط user + isAuthenticated | `user.email` صحيح، `isAuthenticated === true` |
| DA-AP-5 | login() يستدعي API بالبيانات الصحيحة | `mockLogin` استُدعي بـ email + password |
| DA-AP-6 | logout() يمسح user + isAuthenticated | `user === null`, `isAuthenticated === false` |
| DA-AP-7 | logout() يستدعي logoutApi | `mockLogoutApi` استُدعي مرة واحدة |
| DA-AP-8 | canDo() — تطابق صريح | `canDo('bookings', 'read') === true` |
| DA-AP-9 | canDo() — صلاحية غير موجودة | `canDo('invoices', 'delete') === false` |
| DA-AP-10 | canDo() — wildcard (`clients:*`) | `canDo('clients', 'anything') === true` |
| DA-AP-11 | scheduleRefresh يستدعي refresh بعد 780 ثانية | `mockRefreshToken` استُدعي مرتين |
| DA-AP-12 | scheduleRefresh فاشل يمسح user | `user === null` بعد انتهاء المؤقت |

### `auth-gate.spec.tsx` — `AuthGate`

| # | الاسم | النتيجة المتوقعة |
|---|-------|-----------------|
| DA-AG-1 | Spinner أثناء تحميل الجلسة | `.animate-spin` موجود، المحتوى مخفي |
| DA-AG-2 | LoginForm عند عدم المصادقة | حقلا email + password ظاهران |
| DA-AG-3 | Children تُعرض عند المصادقة | المحتوى المحمي ظاهر، LoginForm مخفي |
| DA-AG-4 | login() يُستدعى بالبيانات الصحيحة | `mockLogin('email', 'password')` |
| DA-AG-5 | رسالة خطأ عند فشل login() | النص ظاهر في الـ DOM |
| DA-AG-6 | زر تسجيل الدخول معطّل أثناء الإرسال | `button.disabled === true` |

---

## ملخص

| الفئة | العدد |
|-------|-------|
| إجمالي السيناريوهات Backend | 44 |
| مغطى بالكامل | 44 |
| غير مغطى | 0 |
| اختبارات E2E (Backend) | 77 |
| اختبارات Unit (Backend) | 57 |
| اختبارات Unit (Dashboard) | 28 |
| **الإجمالي** | **162** |

جميع الاختبارات تمر ✅

---

## أخطاء المنتج المكتشفة

### BUG-AUTH-001: `OtpService.verifyEmail()` لا تُبطل الكاش بعد التحقق من البريد

**الملف**: `backend/src/modules/auth/otp.service.ts`
**الوضع**: ثابت

بعد تحديث `emailVerified = true` في قاعدة البيانات، لم يكن `AuthCacheService.invalidate()` يُستدعى.
النتيجة: بيانات `/me` تظل تُظهر `emailVerified: false` حتى انتهاء صلاحية الكاش (15 دقيقة).

**الإصلاح المُطبّق**: إضافة `await this.authCache.invalidate(userId)` بعد تحديث `emailVerified`.

---

## ملاحظات

- **AU-O2 و AU-FP2**: السيناريو يذكر 404، لكن التنفيذ يُعيد 200 عمداً لمنع تعداد البريد — السلوك صحيح، السيناريو يحتاج تحديث.
- **AU-O4 و AU-EV3**: السيناريو يذكر 401، لكن التنفيذ يُعيد 400 — هذا صحيح لأن `BadRequestException` هو الأنسب للكود الخاطئ.
- **AU-O5**: السيناريو يذكر 401، لكن التنفيذ يُعيد 400 — نفس السبب أعلاه.
- **refreshToken**: يُرسَل دائماً عبر HTTP-only cookie فقط، ولا يظهر في body الاستجابة — سلوك صحيح أمنياً.
- **تزامن OTP**: التحقق من OTP يستخدم `updateMany` الذري لمنع استخدام نفس الكود مرتين في طلبات متزامنة.
- **تدوير refresh token**: يستخدم معاملة Serializable وآلية كشف السرقة — إعادة استخدام token ملغى تُلغي جميع الجلسات.
