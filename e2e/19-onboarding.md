# الإعداد السريع (Onboarding)

| # | الاسم | الوصف | النتيجة المتوقعة |
|---|-------|-------|-----------------|
| O1 | إعداد كامل | إنشاء طبيب + مستخدم في خطوة واحدة | 201 + employee + user.id |
| O2 | مع avatarUrl | تضمين رابط الصورة | 201 + user موجود |
| O3 | تحقق من إنشاء المستخدم | الـ userId قابل للجلب بعد الإعداد | 200 من GET /users/:id |
| O4 | إيميل مكرر | نفس الإيميل مرتين | 409 CONFLICT |
| O5 | بدون nameEn | حقل إلزامي مفقود | 400 VALIDATION_ERROR |
| O6 | بدون email | حقل إلزامي مفقود | 400 VALIDATION_ERROR |
| O7 | إيميل غير صالح | `email: 'not-an-email'` | 400 VALIDATION_ERROR |
| O8 | سعر سالب | `priceClinic: -500` | 400 VALIDATION_ERROR |
| O9 | رفض مريض | مريض يحاول الإعداد | 403 FORBIDDEN |
| O10 | بدون توكن | طلب بدون Authorization | 401 AUTH_TOKEN_INVALID |
