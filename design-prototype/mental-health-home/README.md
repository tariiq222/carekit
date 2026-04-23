# Mental Health Home — Prototype

شاشة رئيسية لتطبيق صحة نفسية (React Native / Expo، RTL، عربي) مطابقة للصورة المرجعية.

> **مجلد قابل للحذف بالكامل** — غير مرتبط بأي شيء في المشروع الأساسي.
> للحذف: `rm -rf design-prototype/mental-health-home`

## التشغيل

```bash
cd design-prototype/mental-health-home
npm install
npm run ios      # أو: npm run android / npm run web
```

## ما يحويه

- `App.tsx` — الشاشة بالكامل (Header + Quick Actions زجاجية + عياداتنا + جلسات الدعم + المعالجين + Tab Bar زجاجي)
- خلفية Linear Gradient فيروزية، RTL مفعّل قسرياً عبر `I18nManager.forceRTL`
- أيقونات من `@expo/vector-icons`، تأثير الزجاج عبر `expo-blur`
- بدون أي صور حقيقية — تم استبدال الصور بمربعات ملونة + أيقونات (سهل استبدالها لاحقاً بصور حقيقية)
