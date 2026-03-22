# CareKit White Label Theming Guide

Each CareKit deployment is an independent instance for a single clinic. All branding and configuration is customizable through the admin dashboard.

---

## 1. Theming Architecture

### 1.1 Token Flow

```
WhiteLabelConfig (DB)
  │
  ├─→ GET /api/v1/whitelabel/theme
  │
  ├─→ Dashboard (Next.js)
  │     └─→ CSS custom properties on :root
  │
  ├─→ Mobile (Expo)
  │     └─→ React Context → StyleSheet overrides
  │
  └─→ Website (custom per client)
        └─→ CSS custom properties
```

### 1.2 Theme Object Structure

```typescript
interface CareKitTheme {
  // Branding
  logo: string;                  // URL (MinIO)
  logoLight: string;             // Logo for dark backgrounds
  favicon: string;               // URL (MinIO)
  appName: string;               // "عيادة الشفاء" / "Al-Shifa Clinic"
  appNameAr: string;
  appNameEn: string;

  // Colors
  primaryColor: string;          // "#0066CC"
  primaryColorHover: string;     // auto-generated darker shade
  primaryColorLight: string;     // auto-generated lighter shade
  secondaryColor: string;        // "#00B894"
  accentColor: string;           // "#FF6B35"

  // Typography
  fontArabic: string;            // Google Font name or URL
  fontEnglish: string;           // Google Font name or URL

  // Shape
  borderRadiusStyle: 'rounded' | 'sharp' | 'pill';
  // rounded → radius-md (8px)
  // sharp   → radius-sm (4px)
  // pill    → radius-full for buttons, radius-lg for cards

  // Contact
  phone: string;
  email: string;
  address: string;
  addressAr: string;
  addressEn: string;
  socialMedia: {
    twitter?: string;
    instagram?: string;
    snapchat?: string;
    tiktok?: string;
    whatsapp?: string;
  };

  // Content
  aboutAr: string;               // Rich text
  aboutEn: string;
  cancellationPolicyAr: string;
  cancellationPolicyEn: string;
  privacyPolicyAr: string;
  privacyPolicyEn: string;
  termsAr: string;
  termsEn: string;

  // System
  defaultLanguage: 'ar' | 'en';
  timezone: string;              // "Asia/Riyadh"
  sessionDuration: number;       // Default appointment duration in minutes
  reminderBeforeMinutes: number; // e.g., 60 = remind 1 hour before

  // Bank transfer info (displayed to patients)
  bankAccountName: string;
  bankAccountNumber: string;
  bankAccountIban: string;
  bankName: string;
}
```

### 1.3 API Keys (Stored Separately, Not in Theme Response)

These are stored in WhiteLabelConfig but never exposed to client-side:

```
moyasarApiKey         → backend only
moyasarSecretKey      → backend only
zoomApiKey            → backend only
zoomApiSecret         → backend only
openrouterApiKey      → backend only
firebaseConfig        → JSON, used for push notifications setup
```

---

## 2. Dashboard White Label Settings Page

### 2.1 Branding Section

```
┌─────────────────────────────────────────────────────────┐
│ العلامة التجارية / Branding                              │
│─────────────────────────────────────────────────────────│
│                                                         │
│ الشعار / Logo                                           │
│ ┌──────────┐  ┌──────────┐                              │
│ │  [Logo]  │  │ [Light]  │  ← Upload (PNG/SVG, max 2MB)│
│ │ للخلفية  │  │ للخلفية  │                               │
│ │ الفاتحة  │  │ الداكنة   │                               │
│ └──────────┘  └──────────┘                              │
│                                                         │
│ اسم التطبيق / App Name                                  │
│ ┌────────────────────┐ ┌────────────────────┐           │
│ │ عيادة الشفاء       │ │ Al-Shifa Clinic    │           │
│ └────────────────────┘ └────────────────────┘           │
│   العربية                English                        │
│                                                         │
│ الألوان / Colors                                        │
│ ┌──────┐ ┌──────┐ ┌──────┐                              │
│ │██████│ │██████│ │██████│                               │
│ │#0066CC│ │#00B894│ │#FF6B35│                             │
│ │الأساسي│ │الثانوي│ │المميز │                              │
│ └──────┘ └──────┘ └──────┘                              │
│                                                         │
│ الخط / Font                                             │
│ ┌────────────────────┐ ┌────────────────────┐           │
│ │ IBM Plex Arabic  ▼ │ │ Inter            ▼ │           │
│ └────────────────────┘ └────────────────────┘           │
│   الخط العربي            English Font                    │
│                                                         │
│ نمط الحواف / Border Style                                │
│ ○ مستدير (Rounded)  ● حاد (Sharp)  ○ كبسولة (Pill)     │
│                                                         │
│ معاينة / Preview                                        │
│ ┌────────────────────────────────────────────┐          │
│ │  [Live preview of button + card + badge]   │          │
│ │  with selected colors, font, and radius    │          │
│ └────────────────────────────────────────────┘          │
│                                                         │
│                          [حفظ التغييرات / Save Changes]  │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Contact Section

```
┌─────────────────────────────────────────────────────────┐
│ معلومات التواصل / Contact Information                    │
│─────────────────────────────────────────────────────────│
│                                                         │
│ الهاتف / Phone          البريد / Email                   │
│ ┌──────────────────┐    ┌──────────────────┐            │
│ │ +966 11 234 5678 │    │ info@alshifa.com │            │
│ └──────────────────┘    └──────────────────┘            │
│                                                         │
│ العنوان / Address                                       │
│ ┌────────────────────────────────────────────┐          │
│ │ حي الملقا، الرياض، المملكة العربية السعودية │          │
│ └────────────────────────────────────────────┘          │
│ ┌────────────────────────────────────────────┐          │
│ │ Al-Malqa District, Riyadh, Saudi Arabia    │          │
│ └────────────────────────────────────────────┘          │
│                                                         │
│ وسائل التواصل / Social Media                            │
│ 𝕏  ┌──────────────┐  📸  ┌──────────────┐              │
│    │ @alshifa_sa  │      │ @alshifa_sa  │               │
│    └──────────────┘      └──────────────┘              │
│ 👻  ┌──────────────┐  📱  ┌──────────────┐              │
│    │ alshifa_sa   │      │ +966501234567│               │
│    └──────────────┘      └──────────────┘              │
│    Snapchat                WhatsApp                     │
│                                                         │
│                          [حفظ التغييرات / Save Changes]  │
└─────────────────────────────────────────────────────────┘
```

### 2.3 Integration Keys Section

```
┌─────────────────────────────────────────────────────────┐
│ مفاتيح التكامل / Integration Keys                       │
│─────────────────────────────────────────────────────────│
│                                                         │
│ ⚠️ هذه المفاتيح سرية — لا تشاركها مع أحد                │
│                                                         │
│ Moyasar                                                 │
│ API Key    ┌──────────────────────────────┐             │
│            │ ••••••••••••••••3f2a         │             │
│            └──────────────────────────────┘             │
│ Secret Key ┌──────────────────────────────┐             │
│            │ ••••••••••••••••8b1c         │             │
│            └──────────────────────────────┘             │
│                                                         │
│ Zoom                                                    │
│ API Key    ┌──────────────────────────────┐             │
│            │ ••••••••••••••••a5d9         │             │
│            └──────────────────────────────┘             │
│ API Secret ┌──────────────────────────────┐             │
│            │ ••••••••••••••••7e4f         │             │
│            └──────────────────────────────┘             │
│                                                         │
│ OpenRouter                                              │
│ API Key    ┌──────────────────────────────┐             │
│            │ ••••••••••••••••2c8a         │             │
│            └──────────────────────────────┘             │
│                                                         │
│                          [حفظ التغييرات / Save Changes]  │
└─────────────────────────────────────────────────────────┘
```

### 2.4 Content Section

```
┌─────────────────────────────────────────────────────────┐
│ المحتوى / Content                                       │
│─────────────────────────────────────────────────────────│
│                                                         │
│ عن العيادة / About the Clinic                           │
│ ┌── AR ──┐ ┌── EN ──┐                                  │
│ │ [Rich text editor with Arabic content]           │    │
│ │ عيادة الشفاء متخصصة في تقديم أفضل الخدمات        │    │
│ │ الطبية في مجال طب الأسنان والجلدية...             │    │
│ └──────────────────────────────────────────────┘    │    │
│                                                         │
│ سياسة الإلغاء / Cancellation Policy                     │
│ ┌── AR ──┐ ┌── EN ──┐                                  │
│ │ [Rich text editor]                              │     │
│ └─────────────────────────────────────────────────┘     │
│                                                         │
│ سياسة الخصوصية / Privacy Policy                         │
│ ┌── AR ──┐ ┌── EN ──┐                                  │
│ │ [Rich text editor]                              │     │
│ └─────────────────────────────────────────────────┘     │
│                                                         │
│ شروط الاستخدام / Terms of Service                       │
│ ┌── AR ──┐ ┌── EN ──┐                                  │
│ │ [Rich text editor]                              │     │
│ └─────────────────────────────────────────────────┘     │
│                                                         │
│                          [حفظ التغييرات / Save Changes]  │
└─────────────────────────────────────────────────────────┘
```

### 2.5 System Section

```
┌─────────────────────────────────────────────────────────┐
│ إعدادات النظام / System Settings                        │
│─────────────────────────────────────────────────────────│
│                                                         │
│ اللغة الافتراضية / Default Language                      │
│ ● العربية (Arabic)  ○ English                           │
│                                                         │
│ المنطقة الزمنية / Timezone                               │
│ ┌──────────────────────────────┐                        │
│ │ Asia/Riyadh (UTC+3)       ▼ │                        │
│ └──────────────────────────────┘                        │
│                                                         │
│ مدة الجلسة الافتراضية / Default Session Duration         │
│ ┌──────┐                                                │
│ │ 30   │ دقيقة / minutes                                │
│ └──────┘                                                │
│                                                         │
│ التذكير قبل الموعد / Reminder Before Appointment         │
│ ┌──────┐                                                │
│ │ 60   │ دقيقة / minutes                                │
│ └──────┘                                                │
│                                                         │
│ معلومات الحساب البنكي / Bank Account Info                │
│ (تظهر للمرضى عند اختيار التحويل البنكي)                  │
│                                                         │
│ اسم الحساب  ┌──────────────────────────┐               │
│             │ عيادة الشفاء             │                │
│             └──────────────────────────┘               │
│ رقم الحساب  ┌──────────────────────────┐               │
│             │ 1234567890               │                │
│             └──────────────────────────┘               │
│ الآيبان     ┌──────────────────────────┐               │
│             │ SA1234567890123456789012  │               │
│             └──────────────────────────┘               │
│ البنك       ┌──────────────────────────┐               │
│             │ بنك الراجحي            ▼ │                │
│             └──────────────────────────┘               │
│                                                         │
│                          [حفظ التغييرات / Save Changes]  │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Theme Application Per Platform

### 3.1 Dashboard (Next.js + Tailwind)

Theme is applied via CSS custom properties on `:root`:

```css
:root {
  --primary: var(--wl-primary-color, #0066CC);
  --primary-hover: var(--wl-primary-hover, #0052A3);
  --secondary: var(--wl-secondary-color, #00B894);
  --accent: var(--wl-accent-color, #FF6B35);
  --radius: var(--wl-radius, 8px);
  --font-ar: var(--wl-font-arabic, 'IBM Plex Sans Arabic');
  --font-en: var(--wl-font-english, 'Inter');
}
```

Load theme in root layout:
```typescript
// app/layout.tsx
const theme = await fetchWhiteLabelTheme();
// Apply as inline style on <html> element
```

### 3.2 Mobile (Expo + React Native)

Theme is loaded at app start and stored in Redux:

```typescript
// Theme context provider
const ThemeProvider = ({ children }) => {
  const theme = useSelector(selectTheme);

  const colors = {
    primary: theme.primaryColor || '#0066CC',
    secondary: theme.secondaryColor || '#00B894',
    accent: theme.accentColor || '#FF6B35',
    // ... etc
  };

  return (
    <ThemeContext.Provider value={colors}>
      {children}
    </ThemeContext.Provider>
  );
};
```

### 3.3 Splash Screen & App Icon

- Splash screen background: White with client logo centered
- App icon: Generated from client logo + primary color background
- Both configurable via EAS Build config or OTA update for logo

---

## 4. Preview & Validation

The White Label settings page must include a live preview section that shows:

1. **Button preview** — Primary, secondary, ghost buttons with current colors
2. **Card preview** — Sample appointment card with current radius and colors
3. **Badge preview** — Status badges with current theme
4. **Typography preview** — Arabic and English text with selected fonts
5. **Logo preview** — Logo on light and dark backgrounds

Changes should preview instantly (client-side) before saving.
