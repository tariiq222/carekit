# CareKit Mobile — Client Screens Specification

Client-app screens (Expo Router `apps/mobile/app/(client)/` route group). All screens support RTL-first (Arabic primary) and LTR (English). The `(client)` group is gated by `_layout.tsx` and contains `(tabs)/` for the bottom-tab surfaces plus modal/stack routes for chat, therapists, video calls, booking, and appointment detail.

---

## Screen Index

Routes below match the live folder structure under `apps/mobile/app/(client)/`. Auth screens live outside the group under `apps/mobile/app/auth/` (and `(auth)` for OTP). OTPs are issued via Authentica (SMS/WhatsApp).

| # | Screen | Route | Tab |
|---|--------|-------|-----|
| P01 | Splash | `/` | — |
| P02 | Onboarding | `/onboarding` | — |
| P03 | Login (Password) | `/auth/login` | — |
| P04 | Login (OTP — phone via Authentica) | `/auth/login-otp` | — |
| P05 | OTP Verification | `/auth/verify-otp` | — |
| P06 | Register | `/auth/register` | — |
| P07 | Forgot Password | `/auth/forgot-password` | — |
| P08 | Home | `/(client)/(tabs)/index` | Home |
| P09 | Notifications | `/(client)/(tabs)/notifications` | Notifications |
| P10 | Specialty List | `/(client)/(tabs)/specialties` | Home |
| P11 | Employee List (Therapists) | `/(client)/therapists` | Home |
| P12 | Employee Profile | `/(client)/employee/[id]` | Home |
| P13 | Service List | `/(client)/(tabs)/services` | Home |
| P14 | Booking — Type | `/(client)/booking/type` | Home |
| P15 | Booking — Date & Time | `/(client)/booking/schedule` | Home |
| P16 | Booking — Confirm | `/(client)/booking/confirm` | Home |
| P17 | Payment | `/(client)/booking/payment` | Home |
| P18 | Bank Transfer Upload | `/(client)/booking/bank-transfer` | Home |
| P19 | Booking Confirmation | `/(client)/booking/success` | Home |
| P20 | My Appointments | `/(client)/(tabs)/appointments` | Bookings |
| P21 | Appointment Detail | `/(client)/appointment/[id]` | Bookings |
| P22 | Video Call (Zoom join) | `/(client)/video-call` | — (modal) |
| P23 | Chat (AI) | `/(client)/chat` | Chat |
| P24 | Profile / Settings | `/(client)/settings` | Profile |
| P25 | Rate Appointment | `/(client)/rate/[id]` | — (modal) |
| P26 | Clinic / About & FAQ | `/(client)/clinic` | Profile |

---

## P01 — Splash Screen

**Purpose:** App initialization, token check, theme loading

**Layout:**
```
┌──────────────────────────────┐
│                              │
│                              │
│                              │
│         [Client Logo]        │
│                              │
│         [App Name]           │
│                              │
│                              │
│        [Loading spinner]     │
│                              │
│                              │
└──────────────────────────────┘
```

**Behavior:**
- Background: White (or client primary color light)
- Logo: From WhiteLabelConfig
- On load: check stored JWT → valid? route to home : route to onboarding/login
- Duration: max 2 seconds, then auto-navigate
- Fetch White Label theme config in parallel

**RTL:** No direction-specific elements.

---

## P02 — Onboarding

**Purpose:** First-launch introduction (3 slides)

**Layout:**
```
┌──────────────────────────────┐
│                    [تخطي/Skip]│
│                              │
│       [Illustration]         │
│                              │
│    حجز المواعيد بسهولة       │
│    Book appointments easily   │
│                              │
│    احجز مع أفضل الأطباء      │
│    في أي وقت ومن أي مكان      │
│                              │
│         ● ○ ○                │
│                              │
│    [التالي / Next]           │
└──────────────────────────────┘
```

**Slides:**
1. Booking — "Book appointments easily" / "حجز المواعيد بسهولة"
2. Payment — "Pay securely online" / "ادفع بأمان إلكترونياً"
3. AI Chat — "Chat with our assistant" / "تحدث مع مساعدنا الذكي"

**Behavior:**
- Swipe between slides (RTL: swipe right = next)
- Skip button: goes directly to login
- Last slide: "Get Started" / "ابدأ الآن" button → login
- Show only on first launch (AsyncStorage flag)

**RTL:** Dot indicators flow RTL. Swipe direction reversed.

---

## P03 — Login (Email + Password)

**Purpose:** Standard email/password login

**Layout:**
```
┌──────────────────────────────┐
│         [Client Logo]        │
│                              │
│    مرحباً بك / Welcome       │
│    سجل دخولك للمتابعة        │
│                              │
│    البريد الإلكتروني / Email  │
│    ┌──────────────────────┐  │
│    │ ahmed@email.com      │  │
│    └──────────────────────┘  │
│                              │
│    كلمة المرور / Password     │
│    ┌──────────────────────┐  │
│    │ ••••••••        [👁]  │  │
│    └──────────────────────┘  │
│    نسيت كلمة المرور؟         │
│                              │
│    [تسجيل الدخول / Login]    │
│                              │
│    ─── أو ───                │
│                              │
│    [الدخول برمز OTP]          │
│    [إنشاء حساب جديد]         │
│                              │
└──────────────────────────────┘
```

**Form Validation (Zod):**
- Email: required, valid email format
- Password: required, min 8 characters

**Behavior:**
- On success: store tokens (expo-secure-store) → check role → route
- On error: show inline error message
- Loading state: button disabled + spinner
- "Forgot password" → P07

**RTL:** Labels right-aligned. Email input always `dir="ltr"`.

---

## P04 — Login (OTP via Authentica)

**Purpose:** Passwordless login with phone OTP delivered through Authentica (SMS/WhatsApp). See the `authentica-sa` skill for endpoint contract.

**Layout:**
```
┌──────────────────────────────┐
│    ← (back)                  │
│                              │
│    الدخول برمز التحقق        │
│    Login with OTP            │
│                              │
│    أدخل بريدك الإلكتروني     │
│    وسنرسل لك رمز التحقق      │
│                              │
│    البريد الإلكتروني / Email  │
│    ┌──────────────────────┐  │
│    │ ahmed@email.com      │  │
│    └──────────────────────┘  │
│                              │
│    [إرسال الرمز / Send Code] │
│                              │
│    ─── أو ───                │
│                              │
│    [الدخول بكلمة المرور]      │
│                              │
└──────────────────────────────┘
```

**Behavior:**
- On submit: backend calls Authentica `/api/v2/send-otp` (channel: SMS or WhatsApp) → navigate to P05
- Loading state on button
- Rate limiting: disable resend for 60 seconds (also enforced server-side via Authentica)

**RTL:** Back arrow → ChevronRight in RTL.

---

## P05 — OTP Verification

**Purpose:** Enter the 6-digit OTP code

**Layout:**
```
┌──────────────────────────────┐
│    ← (back)                  │
│                              │
│    أدخل رمز التحقق           │
│    Enter verification code    │
│                              │
│    أرسلنا رمزاً إلى           │
│    ahmed@email.com            │
│                              │
│    ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ │
│    │  │ │  │ │  │ │  │ │  │ │  │ │
│    └──┘ └──┘ └──┘ └──┘ └──┘ └──┘ │
│                              │
│    لم يصلك الرمز؟             │
│    [إعادة الإرسال (45)]       │
│                              │
│    [تأكيد / Verify]          │
│                              │
└──────────────────────────────┘
```

**Behavior:**
- 6 individual digit inputs, auto-focus next on input
- Auto-submit when all 6 digits entered
- Countdown timer for resend (60 seconds)
- On verify: backend calls Authentica `/api/v2/verify-otp`; on success store tokens → check role → route
- OTP digits always LTR regardless of language

**RTL:** OTP boxes remain LTR. Labels right-aligned.

---

## P06 — Register

**Purpose:** New client registration

**Layout:**
```
┌──────────────────────────────┐
│    ← (back)                  │
│                              │
│    إنشاء حساب جديد           │
│    Create new account         │
│                              │
│    الاسم الكامل / Full Name   │
│    ┌──────────────────────┐  │
│    │                      │  │
│    └──────────────────────┘  │
│                              │
│    البريد الإلكتروني / Email  │
│    ┌──────────────────────┐  │
│    │                      │  │
│    └──────────────────────┘  │
│                              │
│    رقم الهاتف / Phone         │
│    ┌──────────────────────┐  │
│    │ +966                 │  │
│    └──────────────────────┘  │
│                              │
│    كلمة المرور / Password     │
│    ┌──────────────────────┐  │
│    │                 [👁]  │  │
│    └──────────────────────┘  │
│    8 أحرف على الأقل          │
│                              │
│    تأكيد كلمة المرور          │
│    ┌──────────────────────┐  │
│    │                 [👁]  │  │
│    └──────────────────────┘  │
│                              │
│    ☐ أوافق على الشروط والأحكام│
│                              │
│    [إنشاء الحساب / Register] │
│                              │
│    لديك حساب؟ سجل دخولك      │
└──────────────────────────────┘
```

**Form Validation (Zod):**
- Name: required, min 2 chars
- Email: required, valid email
- Phone: required, valid Saudi phone format
- Password: required, min 8, must contain letter + number
- Confirm password: must match
- Terms checkbox: must be checked

**Behavior:**
- On success: send OTP to email for verification → P05
- Phone input: country code prefix (+966), numeric keyboard
- Email and phone inputs always LTR

---

## P07 — Forgot Password

**Purpose:** Reset password via email OTP

**Layout:**
```
┌──────────────────────────────┐
│    ← (back)                  │
│                              │
│    نسيت كلمة المرور           │
│    Forgot Password            │
│                              │
│    أدخل بريدك وسنرسل لك      │
│    رمز لإعادة تعيين كلمة المرور│
│                              │
│    البريد الإلكتروني / Email  │
│    ┌──────────────────────┐  │
│    │                      │  │
│    └──────────────────────┘  │
│                              │
│    [إرسال الرمز / Send Code] │
│                              │
└──────────────────────────────┘
```

Then after OTP verification, show new password form:
```
┌──────────────────────────────┐
│    كلمة المرور الجديدة        │
│    ┌──────────────────────┐  │
│    │                      │  │
│    └──────────────────────┘  │
│                              │
│    تأكيد كلمة المرور          │
│    ┌──────────────────────┐  │
│    │                      │  │
│    └──────────────────────┘  │
│                              │
│    [إعادة التعيين / Reset]   │
└──────────────────────────────┘
```

---

## P08 — Home

**Purpose:** Client landing page with quick actions and overview

**Layout:**
```
┌──────────────────────────────┐
│ [🔔] مرحباً، أحمد     [Logo] │
│──────────────────────────────│
│                              │
│ ┌────────────────────────┐   │
│ │ موعدك القادم            │   │
│ │ د. سارة أحمد            │   │
│ │ طب أسنان                │   │
│ │ اليوم، 2:30 م           │   │
│ │ [عرض التفاصيل]          │   │
│ └────────────────────────┘   │
│                              │
│ [🏥 حجز موعد]               │
│                              │
│ التخصصات / Specialties       │
│ ┌─────┐ ┌─────┐ ┌─────┐    │
│ │🦷   │ │👁   │ │❤️   │    │
│ │أسنان│ │عيون │ │قلب  │    │
│ └─────┘ └─────┘ └─────┘    │
│ ← scroll                    │
│                              │
│ الأطباء المميزون             │
│ ┌────────────────────────┐   │
│ │ [Avatar] د. أحمد محمد  │   │
│ │ طب أسنان   ⭐ 4.8      │   │
│ └────────────────────────┘   │
│ ┌────────────────────────┐   │
│ │ [Avatar] د. سارة خالد  │   │
│ │ طب عيون    ⭐ 4.9      │   │
│ └────────────────────────┘   │
│                              │
│ خدماتنا / Our Services       │
│ ┌────────────────────────┐   │
│ │ تنظيف أسنان  150 ر.س   │   │
│ │ فحص شامل    200 ر.س    │   │
│ └────────────────────────┘   │
│                              │
└──────────────────────────────┘
```

**Sections:**
1. **Header:** Greeting + notification bell + clinic logo
2. **Next appointment card:** (if exists) Shows next upcoming appointment with quick view
3. **Book appointment CTA:** Prominent button
4. **Specialties carousel:** Horizontal scroll of specialty icons
5. **Featured employees:** Top-rated employees
6. **Services preview:** Popular services with prices

**Data:** All from API. Pull-to-refresh supported.

**RTL:** Carousels scroll from right. Greeting on right side. Bell on left side.

---

## P09 — Notifications

**Purpose:** All notifications for the client

**Layout:**
```
┌──────────────────────────────┐
│ ←    الإشعارات / Notifications│
│──────────────────────────────│
│                              │
│ اليوم                        │
│ ┌────────────────────────┐   │
│ │ 🟢 تم تأكيد موعدك       │   │
│ │    مع د. أحمد            │   │
│ │    منذ 5 دقائق           │   │
│ └────────────────────────┘   │
│                              │
│ ┌────────────────────────┐   │
│ │ 💳 تم استلام الدفع       │   │
│ │    150 ر.س               │   │
│ │    منذ ساعة              │   │
│ └────────────────────────┘   │
│                              │
│ الأسبوع الماضي               │
│ ┌────────────────────────┐   │
│ │ 📅 تذكير بموعدك          │   │
│ │    غداً الساعة 10:00 ص   │   │
│ │    منذ يوم               │   │
│ └────────────────────────┘   │
│                              │
└──────────────────────────────┘
```

**Behavior:**
- Grouped by date (today, yesterday, this week, older)
- Unread notifications have accent background
- Tap notification → navigate to relevant screen
- Pull-to-refresh

**Notification types with icons:**
| Type | Icon | Color |
|------|------|-------|
| booking_confirmed | CheckCircle | Green |
| booking_cancelled | XCircle | Red |
| reminder | Clock | Blue |
| payment_received | CreditCard | Green |
| new_rating | Star | Amber |
| problem_report | AlertTriangle | Red |

---

## P10 — Specialty List

**Purpose:** Browse all available specialties

**Layout:**
```
┌──────────────────────────────┐
│ ←    التخصصات / Specialties   │
│──────────────────────────────│
│                              │
│ ┌──────────────────────────┐ │
│ │ 🔍 بحث...               │ │
│ └──────────────────────────┘ │
│                              │
│ ┌────────────┐ ┌────────────┐│
│ │    🦷      │ │    👁      ││
│ │   أسنان    │ │   عيون     ││
│ │  Dentistry │ │ Ophthalmology││
│ │  12 طبيب   │ │  8 أطباء   ││
│ └────────────┘ └────────────┘│
│                              │
│ ┌────────────┐ ┌────────────┐│
│ │    ❤️      │ │    🧠      ││
│ │   قلب      │ │   أعصاب    ││
│ │ Cardiology │ │ Neurology  ││
│ │  5 أطباء   │ │  3 أطباء   ││
│ └────────────┘ └────────────┘│
│                              │
└──────────────────────────────┘
```

**Behavior:**
- Grid layout (2 columns)
- Search filters by name (Arabic or English)
- Tap specialty → P11 (Employee List filtered by specialty)
- Shows employee count per specialty

---

## P11 — Employee List

**Purpose:** Browse employees (filtered by specialty or all)

**Layout:**
```
┌──────────────────────────────┐
│ ←    الأطباء / Employees  │
│──────────────────────────────│
│ [فلتر: طب أسنان ×]           │
│                              │
│ ┌──────────────────────────┐ │
│ │ 🔍 بحث بالاسم...         │ │
│ └──────────────────────────┘ │
│                              │
│ ┌──────────────────────────┐ │
│ │ [Avatar]  د. أحمد محمد    │ │
│ │           طب أسنان        │ │
│ │           ⭐ 4.8 (120)    │ │
│ │           🏥 150  📞 100  │ │
│ │           📹 200  ر.س     │ │
│ └──────────────────────────┘ │
│                              │
│ ┌──────────────────────────┐ │
│ │ [Avatar]  د. سارة خالد    │ │
│ │           طب أسنان        │ │
│ │           ⭐ 4.9 (95)     │ │
│ │           🏥 180  📞 120  │ │
│ │           📹 250  ر.س     │ │
│ └──────────────────────────┘ │
│                              │
└──────────────────────────────┘
```

**Behavior:**
- List sorted by rating (descending) by default
- Sort options: rating, name, price
- Filter chip for active specialty filter (removable)
- Shows prices for all consultation types
- Tap employee → P12

**Prices:** Displayed in halalat converted to SAR (ر.س). Three price tags for clinic/phone/video.

---

## P12 — Employee Profile

**Purpose:** Detailed employee info + book button

**Layout:**
```
┌──────────────────────────────┐
│ ←    الملف الشخصي            │
│──────────────────────────────│
│                              │
│        [Large Avatar]        │
│       د. أحمد محمد           │
│       طب أسنان               │
│       ⭐ 4.8 (120 تقييم)     │
│                              │
│──────────────────────────────│
│  نبذة / About                │
│  طبيب أسنان متخصص بخبرة     │
│  15 سنة في طب الأسنان        │
│  التجميلي والعلاجي...        │
│──────────────────────────────│
│  المؤهلات / Qualifications    │
│  • بكالوريوس طب أسنان        │
│  • ماجستير تقويم أسنان       │
│──────────────────────────────│
│  الأسعار / Prices             │
│  🏥 زيارة عيادة:   150 ر.س   │
│  📞 استشارة هاتفية: 100 ر.س  │
│  📹 استشارة مرئية:  200 ر.س  │
│──────────────────────────────│
│  أوقات العمل / Working Hours  │
│  الأحد - الخميس              │
│  9:00 ص - 5:00 م             │
│──────────────────────────────│
│  التقييمات / Reviews          │
│  ┌────────────────────────┐  │
│  │ ⭐⭐⭐⭐⭐ سعاد م.       │  │
│  │ طبيب ممتاز ومحترف      │  │
│  └────────────────────────┘  │
│──────────────────────────────│
│                              │
│  [حجز موعد / Book Appointment]│
│                              │
└──────────────────────────────┘
```

**Behavior:**
- Scrollable content
- Fixed "Book Appointment" button at bottom
- Reviews section shows latest 3, with "View all" link
- Tap "Book" → P14 with employee pre-selected

---

## P13 — Service List

**Purpose:** Browse services grouped by category

**Layout:**
```
┌──────────────────────────────┐
│ ←    الخدمات / Services       │
│──────────────────────────────│
│                              │
│ ┌──────────────────────────┐ │
│ │ 🔍 بحث...               │ │
│ └──────────────────────────┘ │
│                              │
│ طب الأسنان                   │
│ ┌──────────────────────────┐ │
│ │ تنظيف أسنان              │ │
│ │ 30 دقيقة  •  150 ر.س     │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ حشو أسنان               │ │
│ │ 45 دقيقة  •  300 ر.س     │ │
│ └──────────────────────────┘ │
│                              │
│ طب العيون                    │
│ ┌──────────────────────────┐ │
│ │ فحص نظر شامل             │ │
│ │ 30 دقيقة  •  200 ر.س     │ │
│ └──────────────────────────┘ │
│                              │
└──────────────────────────────┘
```

**Behavior:**
- Services grouped by ServiceCategory
- Each service shows: name (AR/EN), duration, price
- Tap service → show detail bottom sheet with description + "Book" button

---

## P14 — Booking: Select Type

**Purpose:** Choose consultation type

**Layout:**
```
┌──────────────────────────────┐
│ ×    حجز موعد / Book         │
│──────────────────────────────│
│  الخطوة 1 من 4              │
│  ════════░░░░░░░░░░░░░      │
│                              │
│  اختر نوع الزيارة            │
│  Select visit type           │
│                              │
│  ┌──────────────────────┐    │
│  │ 🏥                   │    │
│  │ زيارة عيادة           │    │
│  │ Clinic Visit          │    │
│  │ 150 ر.س              │    │
│  └──────────────────────┘    │
│                              │
│  ┌──────────────────────┐    │
│  │ 📞                   │    │
│  │ استشارة هاتفية        │    │
│  │ Phone Consultation    │    │
│  │ 100 ر.س              │    │
│  └──────────────────────┘    │
│                              │
│  ┌──────────────────────┐    │
│  │ 📹                   │    │
│  │ استشارة مرئية         │    │
│  │ Video Consultation    │    │
│  │ 200 ر.س              │    │
│  └──────────────────────┘    │
│                              │
└──────────────────────────────┘
```

**Behavior:**
- If employee is pre-selected, show their prices
- Selection highlights card with primary color border
- Tapping a card → navigate to P15
- Progress bar: step 1 of 4

---

## P15 — Booking: Date & Time

**Purpose:** Select date and available time slot

**Layout:**
```
┌──────────────────────────────┐
│ ←    حجز موعد / Book         │
│──────────────────────────────│
│  الخطوة 2 من 4              │
│  ═══════════════░░░░░░░     │
│                              │
│  اختر التاريخ / Select Date  │
│  ┌──────────────────────┐    │
│  │   مارس 2026          │    │
│  │ ح  ن  ث  ر  خ  ج  س │    │
│  │          1  2  3  4  5│    │
│  │ 6  7  8  9 10 11 12  │    │
│  │13 14 15 16 17 18 19  │    │
│  │20 21 [22]23 24 25 26 │    │
│  │27 28 29 30 31        │    │
│  └──────────────────────┘    │
│                              │
│  الأوقات المتاحة             │
│  Available Times              │
│                              │
│  ┌─────┐ ┌─────┐ ┌─────┐    │
│  │09:00│ │09:30│ │10:00│    │
│  └─────┘ └─────┘ └─────┘    │
│  ┌─────┐ ┌─────┐ ┌─────┐    │
│  │10:30│ │11:00│ │[2:30]│    │
│  └─────┘ └─────┘ └─────┘    │
│                              │
│  [التالي / Next]             │
│                              │
└──────────────────────────────┘
```

**Behavior:**
- Calendar: past dates disabled, unavailable dates grayed out
- Time slots: fetched based on employee availability - existing bookings
- Booked slots hidden or disabled
- Employee vacation days disabled
- Selected date highlighted with primary color
- Selected time slot highlighted
- "Next" enabled only when both date and time selected

**RTL:** Calendar day headers in Arabic abbreviations (ح ن ث ر خ ج س). Week starts on Sunday.

---

## P16 — Booking: Confirmation

**Purpose:** Review and confirm booking details before payment

**Layout:**
```
┌──────────────────────────────┐
│ ←    حجز موعد / Book         │
│──────────────────────────────│
│  الخطوة 3 من 4              │
│  ══════════════════════░░░  │
│                              │
│  ملخص الحجز                  │
│  Booking Summary              │
│                              │
│  ┌──────────────────────┐    │
│  │ الطبيب: د. أحمد محمد  │    │
│  │ التخصص: طب أسنان      │    │
│  │ النوع: زيارة عيادة     │    │
│  │ التاريخ: 22/03/2026   │    │
│  │ الوقت: 2:30 م - 3:00 م│    │
│  │────────────────────── │    │
│  │ المبلغ:      150.00   │    │
│  │ الضريبة (15%): 22.50  │    │
│  │ الإجمالي:    172.50 ر.س│    │
│  └──────────────────────┘    │
│                              │
│  ملاحظات (اختياري)            │
│  ┌──────────────────────┐    │
│  │                      │    │
│  └──────────────────────┘    │
│                              │
│  [تأكيد والدفع / Confirm & Pay]│
│                              │
└──────────────────────────────┘
```

**Behavior:**
- Display all booking details for review
- VAT calculated at 15%
- Optional notes field
- "Confirm & Pay" → P17
- Amounts displayed as SAR (converted from halalat)

---

## P17 — Payment

**Purpose:** Select payment method and pay

**Layout:**
```
┌──────────────────────────────┐
│ ←    الدفع / Payment          │
│──────────────────────────────│
│  الخطوة 4 من 4              │
│  ═══════════════════════════│
│                              │
│  المبلغ الإجمالي: 172.50 ر.س │
│                              │
│  اختر طريقة الدفع            │
│  Select Payment Method        │
│                              │
│  ┌──────────────────────┐    │
│  │ [mada logo]          │    │
│  │ مدى / Mada           │    │
│  └──────────────────────┘    │
│                              │
│  ┌──────────────────────┐    │
│  │ [ logo]              │    │
│  │ Apple Pay             │    │
│  └──────────────────────┘    │
│                              │
│  ┌──────────────────────┐    │
│  │ [visa/mc logo]       │    │
│  │ بطاقة ائتمانية       │    │
│  │ Credit Card           │    │
│  └──────────────────────┘    │
│                              │
│  ┌──────────────────────┐    │
│  │ [bank icon]          │    │
│  │ تحويل بنكي           │    │
│  │ Bank Transfer         │    │
│  └──────────────────────┘    │
│                              │
└──────────────────────────────┘
```

**Behavior:**
- Moyasar options (Mada, Apple Pay, Card): opens Moyasar payment form
- Bank Transfer: navigates to P18
- On Moyasar success: navigate to P19 (confirmation)
- On Moyasar failure: show error, allow retry

---

## P18 — Bank Transfer Upload

**Purpose:** Show bank details + upload transfer receipt

**Layout:**
```
┌──────────────────────────────┐
│ ←    تحويل بنكي              │
│──────────────────────────────│
│                              │
│  حول المبلغ 172.50 ر.س       │
│  إلى الحساب التالي:           │
│                              │
│  ┌──────────────────────┐    │
│  │ البنك: بنك الراجحي    │    │
│  │ الاسم: عيادة الشفاء   │    │
│  │ الحساب: 1234567890    │    │
│  │ الآيبان:              │    │
│  │ SA12345678901234567890│    │
│  │           [نسخ / Copy]│    │
│  └──────────────────────┘    │
│                              │
│  بعد إتمام التحويل،          │
│  ارفع صورة الإيصال:           │
│                              │
│  ┌──────────────────────┐    │
│  │                      │    │
│  │    📷 التقاط صورة     │    │
│  │    🖼 اختيار من المعرض │    │
│  │                      │    │
│  └──────────────────────┘    │
│                              │
│  [OR: receipt preview here]  │
│                              │
│  [إرسال الإيصال / Submit]    │
│                              │
└──────────────────────────────┘
```

**Behavior:**
- Bank details from WhiteLabelConfig
- Copy button for IBAN
- Camera or gallery picker (expo-image-picker)
- Preview uploaded image before submitting
- On submit: upload to MinIO → create payment record → navigate to P19 with "pending review" status
- Max file size: 5MB

---

## P19 — Booking Confirmation

**Purpose:** Success screen after booking + payment

**Layout (Moyasar success):**
```
┌──────────────────────────────┐
│                              │
│          ✅                  │
│                              │
│    تم الحجز بنجاح!           │
│    Booking Confirmed!         │
│                              │
│  ┌──────────────────────┐    │
│  │ رقم الحجز: #1234     │    │
│  │ الطبيب: د. أحمد محمد  │    │
│  │ التاريخ: 22/03/2026   │    │
│  │ الوقت: 2:30 م         │    │
│  │ النوع: زيارة عيادة    │    │
│  └──────────────────────┘    │
│                              │
│  ستتلقى تأكيداً عبر البريد   │
│  الإلكتروني                  │
│                              │
│  [عرض مواعيدي / My Appointments]│
│  [العودة للرئيسية / Home]     │
│                              │
└──────────────────────────────┘
```

**Layout (Bank transfer - pending):**
```
┌──────────────────────────────┐
│                              │
│          ⏳                  │
│                              │
│    تم إرسال الإيصال           │
│    Receipt Submitted          │
│                              │
│    حجزك قيد المراجعة          │
│    سنخبرك عند تأكيد الدفع     │
│                              │
│  [عرض مواعيدي / My Appointments]│
│  [العودة للرئيسية / Home]     │
│                              │
└──────────────────────────────┘
```

---

## P20 — My Appointments

**Purpose:** View all client appointments

**Layout:**
```
┌──────────────────────────────┐
│    مواعيدي / My Appointments  │
│──────────────────────────────│
│ ┌────────┐┌────────┐┌───────┐│
│ │القادمة ││السابقة ││الملغاة ││
│ │Upcoming││  Past  ││Cancelled││
│ └────────┘└────────┘└───────┘│
│                              │
│ ┌──────────────────────────┐ │
│ │ 🏥 د. أحمد محمد          │ │
│ │    طب أسنان              │ │
│ │    22 مارس • 2:30 م       │ │
│ │    مؤكد ✅               │ │
│ └──────────────────────────┘ │
│                              │
│ ┌──────────────────────────┐ │
│ │ 📹 د. سارة خالد          │ │
│ │    طب عيون               │ │
│ │    25 مارس • 10:00 ص      │ │
│ │    قيد الانتظار ⏳        │ │
│ └──────────────────────────┘ │
│                              │
│ (empty state if no appointments)│
│ "لا توجد مواعيد"             │
│ [حجز موعد جديد]             │
│                              │
└──────────────────────────────┘
```

**Behavior:**
- 3 tabs: upcoming (default), past, cancelled
- Each card shows: type icon, employee, specialty, date/time, status badge
- Tap → P21 (Appointment Detail)
- Pull-to-refresh
- Empty state with CTA to book

---

## P21 — Appointment Detail

**Purpose:** Full appointment details with actions

**Layout:**
```
┌──────────────────────────────┐
│ ←    تفاصيل الموعد           │
│──────────────────────────────│
│                              │
│  ┌──────────────────────┐    │
│  │ مؤكد ✅              │    │
│  │                      │    │
│  │ 🏥 زيارة عيادة       │    │
│  │                      │    │
│  │ الطبيب: د. أحمد محمد  │    │
│  │ التخصص: طب أسنان      │    │
│  │ التاريخ: 22/03/2026   │    │
│  │ الوقت: 2:30 - 3:00 م  │    │
│  │                      │    │
│  │ المبلغ: 172.50 ر.س    │    │
│  │ طريقة الدفع: مدى      │    │
│  │ حالة الدفع: مدفوع ✅   │    │
│  └──────────────────────┘    │
│                              │
│  (for video: opens P22 video-call screen)│
│  [انضم للاجتماع / Join Video Call] │
│                              │
│  (for completed appointments) │
│  [تقييم الموعد / Rate]       │
│                              │
│  ┌──────────────────────┐    │
│  │ [عرض الفاتورة]        │    │
│  │ [تعديل الموعد]        │    │
│  │ [طلب إلغاء]           │    │
│  └──────────────────────┘    │
│                              │
└──────────────────────────────┘
```

**Conditional elements:**
- **Video booking:** Show "Join Video Call" button — opens P22 (`/(client)/video-call`) which embeds the Zoom SDK / falls back to Zoom deep link
- **Phone booking:** Show employee phone number
- **Completed:** Show "Rate" button (if not yet rated) → navigates to `/(client)/rate/[id]`
- **Pending cancellation:** Show "Cancellation under review" message
- **Cancelled:** Show cancellation reason + refund status

---

## P22 — Video Call (Zoom)

**Purpose:** In-app Zoom video consultation surface for video-type bookings.

**Route:** `/(client)/video-call` (modal, opened from P21 with the booking id as a param).

**Behavior:**
- Joins the Zoom meeting bound to the booking via the `JoinVideoCallButton` flow (see backend `zoom/` module).
- Pre-call checks: camera + microphone permission, network status.
- Falls back to launching the native Zoom app via deep link if the embedded SDK is unavailable.
- Available 15 minutes before scheduled start; closes the screen on call end and returns to P21.

---

## P22 — Chat (AI Chatbot)

**Purpose:** AI assistant for booking, inquiries, and support

**Layout:**
```
┌──────────────────────────────┐
│    المساعد الذكي / AI Assistant│
│──────────────────────────────│
│                              │
│  ┌──────────────────────┐    │
│  │ 🤖 مرحباً! كيف يمكنني │    │
│  │    مساعدتك؟           │    │
│  └──────────────────────┘    │
│                              │
│         ┌──────────────────┐ │
│         │ أريد حجز موعد    │ │
│         │ مع طبيب أسنان    │ │
│         └──────────────────┘ │
│                              │
│  ┌──────────────────────┐    │
│  │ 🤖 بالتأكيد! لدينا   │    │
│  │    الأطباء التاليون:  │    │
│  │                      │    │
│  │ ┌────────────────┐   │    │
│  │ │ د. أحمد - 150 ر.س│  │    │
│  │ │ [حجز]          │   │    │
│  │ └────────────────┘   │    │
│  │ ┌────────────────┐   │    │
│  │ │ د. سارة - 180 ر.س│  │    │
│  │ │ [حجز]          │   │    │
│  │ └────────────────┘   │    │
│  └──────────────────────┘    │
│                              │
│ ┌──────────────────────┐ [→] │
│ │ اكتب رسالتك...       │     │
│ └──────────────────────┘     │
└──────────────────────────────┘
```

**Behavior:**
- Chat bubble UI (react-native-gifted-chat or custom)
- Bot messages: left-aligned (RTL: right-aligned)
- User messages: right-aligned (RTL: left-aligned)
- Bot can show inline action cards (book, view appointment)
- Streaming responses (typing indicator)
- Session persists until explicit end or timeout
- Handoff option: show "Talk to human" / "تحدث مع شخص" based on WhiteLabelConfig

**RTL:** Message bubbles swap sides. Send button position swaps.

---

## P23 — Profile

**Purpose:** Client profile and settings

**Layout:**
```
┌──────────────────────────────┐
│    الملف الشخصي / Profile     │
│──────────────────────────────│
│                              │
│        [Avatar]              │
│       أحمد محمد              │
│    ahmed@email.com           │
│    [تعديل الملف / Edit]      │
│                              │
│──────────────────────────────│
│                              │
│  👤 بياناتي الشخصية          │
│  💳 مدفوعاتي                 │
│  🌐 اللغة: العربية     [>]   │
│  🔔 إعدادات الإشعارات   [>]  │
│──────────────────────────────│
│  ℹ️  عن العيادة         [>]   │
│  ❓ الأسئلة الشائعة     [>]   │
│  📋 سياسة الخصوصية      [>]  │
│  📋 شروط الاستخدام       [>]  │
│──────────────────────────────│
│  🔴 تسجيل الخروج             │
│                              │
│  الإصدار 1.0.0               │
│                              │
└──────────────────────────────┘
```

**Behavior:**
- Edit profile: name, phone, avatar
- Language toggle: switches app language, triggers RTL/LTR switch, requires restart
- Payment history: list of all payments → tap for detail
- Notification settings: toggle per notification type
- About/FAQ/Privacy/Terms: content from WhiteLabelConfig
- Logout: confirmation dialog → clear tokens → navigate to auth

---

## P24 — About & FAQ

**Purpose:** Clinic info and frequently asked questions

**Layout:**
```
┌──────────────────────────────┐
│ ←    عن العيادة / About       │
│──────────────────────────────│
│                              │
│       [Clinic Logo]          │
│      عيادة الشفاء            │
│                              │
│  (about text from WhiteLabelConfig)│
│  عيادة الشفاء متخصصة في      │
│  تقديم أفضل الخدمات الطبية   │
│  في مجال طب الأسنان...        │
│                              │
│──────────────────────────────│
│  معلومات التواصل              │
│  📞 +966 11 234 5678         │
│  ✉️  info@alshifa.com         │
│  📍 حي الملقا، الرياض         │
│──────────────────────────────│
│  تابعنا                      │
│  [Twitter] [Instagram] [Snap]│
│──────────────────────────────│
│                              │
│  الأسئلة الشائعة / FAQ        │
│  ┌──────────────────────┐    │
│  │ ▼ كيف أحجز موعد؟     │    │
│  │   يمكنك الحجز من خلال │    │
│  │   التطبيق أو...       │    │
│  └──────────────────────┘    │
│  ┌──────────────────────┐    │
│  │ ▶ ما هي طرق الدفع؟   │    │
│  └──────────────────────┘    │
│  ┌──────────────────────┐    │
│  │ ▶ كيف ألغي موعدي؟    │    │
│  └──────────────────────┘    │
│                              │
└──────────────────────────────┘
```

**Behavior:**
- Content from WhiteLabelConfig (aboutAr/aboutEn)
- FAQ from KnowledgeBase table or WhiteLabelConfig
- Accordion-style FAQ items
- Contact info tappable (phone → dialer, email → mail app, address → maps)
- Social media icons link to client's accounts
