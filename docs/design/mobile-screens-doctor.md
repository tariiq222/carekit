# CareKit Mobile — Doctor (Employee) Screens Specification

8 screens for the employee experience. All screens support RTL-first (Arabic primary) and LTR (English).

---

## Screen Index

| # | Screen | Route | Tab |
|---|--------|-------|-----|
| D01 | Today's Schedule | `/(doctor)/today` | Today |
| D02 | Appointment Detail (Doctor) | `/(doctor)/appointments/[id]` | Today |
| D03 | Calendar View | `/(doctor)/calendar` | Calendar |
| D04 | Availability Editor | `/(doctor)/availability` | Calendar |
| D05 | Client List | `/(doctor)/clients` | Clients |
| D06 | Client Record | `/(doctor)/clients/[id]` | Clients |
| D07 | Doctor Profile | `/(doctor)/profile` | Profile |
| D08 | Ratings & Reviews | `/(doctor)/ratings` | Profile |

---

## D01 — Today's Schedule

**Purpose:** Overview of today's appointments and quick stats

**Layout:**
```
┌──────────────────────────────┐
│ [🔔]  مرحباً، د. أحمد  [Logo]│
│──────────────────────────────│
│                              │
│  اليوم، 22 مارس 2026         │
│                              │
│  ┌─────────┐ ┌─────────┐    │
│  │    8    │ │    5    │    │
│  │ الإجمالي│ │ المتبقي │    │
│  │  Total  │ │Remaining│    │
│  └─────────┘ └─────────┘    │
│  ┌─────────┐ ┌─────────┐    │
│  │    3    │ │    0    │    │
│  │ مكتمل   │ │ ملغي    │    │
│  │Completed│ │Cancelled│    │
│  └─────────┘ └─────────┘    │
│                              │
│──────────────────────────────│
│  جدول اليوم / Today's Schedule│
│                              │
│  09:00 ─────────────────     │
│  ┌──────────────────────┐    │
│  │ 🏥 أحمد سالم          │    │
│  │    تنظيف أسنان        │    │
│  │    09:00 - 09:30      │    │
│  │    مؤكد ✅            │    │
│  └──────────────────────┘    │
│                              │
│  09:30 ─────────────────     │
│  ┌──────────────────────┐    │
│  │ ✅ فاطمة علي    مكتمل │    │
│  │    حشو أسنان          │    │
│  │    09:30 - 10:15      │    │
│  └──────────────────────┘    │
│                              │
│  10:30 ─────────────────     │
│  ┌──────────────────────┐    │
│  │ 📹 خالد محمد          │    │
│  │    استشارة مرئية       │    │
│  │    10:30 - 11:00      │    │
│  │    [بدء الاجتماع]      │    │
│  └──────────────────────┘    │
│                              │
│  14:30 ─────────────────     │
│  ┌──────────────────────┐    │
│  │ 📞 سارة أحمد          │    │
│  │    استشارة هاتفية      │    │
│  │    14:30 - 15:00      │    │
│  │    📱 +966 50 123 4567│    │
│  └──────────────────────┘    │
│                              │
└──────────────────────────────┘
```

**Sections:**
1. **Header:** Greeting with doctor name, notification bell, clinic logo
2. **Stats cards:** Total, remaining, completed, cancelled (today)
3. **Timeline list:** Chronological appointments with time markers

**Card variations:**
- **Clinic visit:** Building icon, client name, service, time, status
- **Video consultation:** Camera icon + "Start Meeting" button (links to Zoom)
- **Phone consultation:** Phone icon + client phone number displayed
- **Completed:** Checkmark overlay, muted styling
- **Cancelled:** Strikethrough styling, grey text

**Behavior:**
- Tap appointment → D02
- Pull-to-refresh
- Auto-refresh every 5 minutes
- "Start Meeting" button visible 15 minutes before video appointment

**RTL:** Timeline on right side. Stats cards flow RTL.

---

## D02 — Appointment Detail (Doctor View)

**Purpose:** Full appointment details with doctor-specific actions

**Layout:**
```
┌──────────────────────────────┐
│ ←    تفاصيل الموعد           │
│──────────────────────────────│
│                              │
│  ┌──────────────────────┐    │
│  │ مؤكد ✅              │    │
│  │                      │    │
│  │ معلومات المريض        │    │
│  │ الاسم: أحمد سالم      │    │
│  │ الهاتف: +966501234567 │    │
│  │ البريد: ahmed@email.com│   │
│  │                      │    │
│  │ معلومات الموعد        │    │
│  │ النوع: 🏥 زيارة عيادة │    │
│  │ الخدمة: تنظيف أسنان   │    │
│  │ التاريخ: 22/03/2026   │    │
│  │ الوقت: 09:00 - 09:30  │    │
│  │                      │    │
│  │ ملاحظات المريض:       │    │
│  │ "أعاني من ألم في ضرس  │    │
│  │  العقل السفلي"        │    │
│  └──────────────────────┘    │
│                              │
│  (for video appointments)     │
│  [بدء اجتماع Zoom]           │
│                              │
│  (for phone appointments)     │
│  [اتصال بالمريض 📞]          │
│                              │
│──────────────────────────────│
│  سجل المريض / Client History │
│  ┌──────────────────────┐    │
│  │ 15/02/2026 - حشو أسنان│   │
│  │ 01/01/2026 - فحص شامل │    │
│  └──────────────────────┘    │
│──────────────────────────────│
│                              │
│  [تم ✅ / Mark Completed]     │
│                              │
└──────────────────────────────┘
```

**Doctor-specific features:**
- Client contact info visible (phone, email)
- Client visit history with this doctor
- "Mark as Completed" button (only for confirmed appointments)
- "Start Zoom" for video appointments (deep link)
- "Call Client" for phone appointments (opens dialer)

**Behavior:**
- Mark completed → confirmation dialog → status updates → triggers rating prompt for client
- Phone number tappable → opens dialer
- Email tappable → opens mail app
- Client history shows previous appointments with this doctor only

---

## D03 — Calendar View

**Purpose:** Monthly/weekly calendar with appointments

**Layout:**
```
┌──────────────────────────────┐
│    التقويم / Calendar         │
│──────────────────────────────│
│                              │
│  ◀ مارس 2026 ▶              │
│  ┌──────────────────────┐    │
│  │ ح  ن  ث  ر  خ  ج  س │    │
│  │          1  2  3  4  5│    │
│  │ 6  7  8  9 10 11 12  │    │
│  │13 14 15 16 17 18 19  │    │
│  │20 21 [22]23 24 25 26 │    │
│  │27 28 29 30 31        │    │
│  └──────────────────────┘    │
│                              │
│  Dots under dates with appointments │
│                              │
│  22 مارس — 5 مواعيد          │
│                              │
│  ┌──────────────────────┐    │
│  │ 09:00  أحمد سالم      │    │
│  │        تنظيف أسنان    │    │
│  └──────────────────────┘    │
│  ┌──────────────────────┐    │
│  │ 10:30  خالد محمد      │    │
│  │        استشارة مرئية   │    │
│  └──────────────────────┘    │
│  ... more appointments ...   │
│                              │
│──────────────────────────────│
│  [إدارة الأوقات / Manage Availability]│
│                              │
└──────────────────────────────┘
```

**Behavior:**
- Monthly calendar with dots under dates that have appointments
- Tap date → shows day's appointments below calendar
- Tap appointment → D02
- Vacation dates highlighted (different color)
- "Manage Availability" → D04
- Swipe month navigation

**RTL:** Calendar day headers Arabic. Navigation arrows swap.

---

## D04 — Availability Editor

**Purpose:** Set weekly schedule and vacation dates

**Layout:**
```
┌──────────────────────────────┐
│ ←    إدارة الأوقات           │
│──────────────────────────────│
│                              │
│  الجدول الأسبوعي              │
│  Weekly Schedule              │
│                              │
│  ┌──────────────────────┐    │
│  │ الأحد / Sunday       │    │
│  │ ✅ 09:00 — 17:00     │    │
│  │              [تعديل]  │    │
│  └──────────────────────┘    │
│  ┌──────────────────────┐    │
│  │ الاثنين / Monday     │    │
│  │ ✅ 09:00 — 17:00     │    │
│  │              [تعديل]  │    │
│  └──────────────────────┘    │
│  ┌──────────────────────┐    │
│  │ الثلاثاء / Tuesday    │    │
│  │ ✅ 09:00 — 13:00     │    │
│  │              [تعديل]  │    │
│  └──────────────────────┘    │
│  ┌──────────────────────┐    │
│  │ الأربعاء / Wednesday  │    │
│  │ ❌ عطلة / Off         │    │
│  │              [تعديل]  │    │
│  └──────────────────────┘    │
│  ... remaining days ...      │
│                              │
│──────────────────────────────│
│  الإجازات / Vacations         │
│                              │
│  ┌──────────────────────┐    │
│  │ 1-5 أبريل 2026       │    │
│  │ إجازة شخصية     [حذف] │    │
│  └──────────────────────┘    │
│                              │
│  [+ إضافة إجازة / Add Vacation]│
│                              │
└──────────────────────────────┘
```

**Edit Day Bottom Sheet:**
```
┌──────────────────────────────┐
│  الأحد / Sunday              │
│                              │
│  ○ متاح / Available          │
│  ○ عطلة / Day Off             │
│                              │
│  وقت البدء / Start Time       │
│  ┌──────────────────────┐    │
│  │ 09:00             ▼  │    │
│  └──────────────────────┘    │
│                              │
│  وقت الانتهاء / End Time      │
│  ┌──────────────────────┐    │
│  │ 17:00             ▼  │    │
│  └──────────────────────┘    │
│                              │
│  [حفظ / Save]  [إلغاء / Cancel]│
└──────────────────────────────┘
```

**Add Vacation Bottom Sheet:**
```
┌──────────────────────────────┐
│  إضافة إجازة / Add Vacation  │
│                              │
│  من / From                    │
│  ┌──────────────────────┐    │
│  │ 01/04/2026        📅  │    │
│  └──────────────────────┘    │
│                              │
│  إلى / To                    │
│  ┌──────────────────────┐    │
│  │ 05/04/2026        📅  │    │
│  └──────────────────────┘    │
│                              │
│  السبب / Reason (optional)    │
│  ┌──────────────────────┐    │
│  │ إجازة شخصية          │    │
│  └──────────────────────┘    │
│                              │
│  [حفظ / Save]                │
└──────────────────────────────┘
```

**Behavior:**
- Weekly schedule: 7 rows, one per day
- Toggle available/off per day
- Time pickers for start/end (15-minute increments)
- Vacation list with delete option
- Add vacation with date range picker
- Changes saved immediately (with confirmation toast)
- Warn if existing bookings conflict with new vacation dates

---

## D05 — Client List

**Purpose:** Browse clients who have visited this doctor

**Layout:**
```
┌──────────────────────────────┐
│    المرضى / My Clients       │
│──────────────────────────────│
│                              │
│  ┌──────────────────────┐    │
│  │ 🔍 بحث بالاسم...      │    │
│  └──────────────────────┘    │
│                              │
│  ┌──────────────────────┐    │
│  │ [A] أحمد سالم         │    │
│  │     آخر زيارة: 22/03  │    │
│  │     3 زيارات          │    │
│  └──────────────────────┘    │
│                              │
│  ┌──────────────────────┐    │
│  │ [F] فاطمة علي         │    │
│  │     آخر زيارة: 20/03  │    │
│  │     5 زيارات          │    │
│  └──────────────────────┘    │
│                              │
│  ┌──────────────────────┐    │
│  │ [K] خالد محمد         │    │
│  │     آخر زيارة: 18/03  │    │
│  │     2 زيارات          │    │
│  └──────────────────────┘    │
│                              │
└──────────────────────────────┘
```

**Behavior:**
- Shows only clients who have had appointments with this doctor
- Search by name
- Sorted by last visit date (most recent first)
- Shows visit count and last visit date
- Avatar: first letter of name with colored background
- Tap → D06 (Client Record)

---

## D06 — Client Record

**Purpose:** Client details and visit history with this doctor

**Layout:**
```
┌──────────────────────────────┐
│ ←    سجل المريض              │
│──────────────────────────────│
│                              │
│       [Avatar]               │
│      أحمد سالم               │
│   📞 +966 50 123 4567        │
│   ✉️  ahmed@email.com         │
│                              │
│──────────────────────────────│
│  سجل الزيارات                │
│  Visit History                │
│                              │
│  ┌──────────────────────┐    │
│  │ 22/03/2026           │    │
│  │ 🏥 تنظيف أسنان       │    │
│  │ مؤكد ✅              │    │
│  └──────────────────────┘    │
│                              │
│  ┌──────────────────────┐    │
│  │ 15/02/2026           │    │
│  │ 🏥 حشو أسنان        │    │
│  │ مكتمل ✅             │    │
│  │ ⭐⭐⭐⭐⭐ "ممتاز"     │    │
│  └──────────────────────┘    │
│                              │
│  ┌──────────────────────┐    │
│  │ 01/01/2026           │    │
│  │ 📹 فحص شامل         │    │
│  │ مكتمل ✅             │    │
│  │ ⭐⭐⭐⭐ "جيد جداً"    │    │
│  └──────────────────────┘    │
│                              │
└──────────────────────────────┘
```

**Behavior:**
- Client contact info (phone tappable, email tappable)
- Visit history: all appointments with this doctor, chronological (newest first)
- Completed visits show rating if given
- Tap visit → D02 (Appointment Detail)

---

## D07 — Doctor Profile

**Purpose:** Doctor's own profile and settings

**Layout:**
```
┌──────────────────────────────┐
│    الملف الشخصي / Profile     │
│──────────────────────────────│
│                              │
│        [Avatar]              │
│       د. أحمد محمد           │
│       طب أسنان               │
│       ⭐ 4.8 (120 تقييم)     │
│                              │
│──────────────────────────────│
│                              │
│  👤 بياناتي الشخصية     [>]  │
│  ⭐ التقييمات والمراجعات [>]  │
│  🌐 اللغة: العربية      [>]  │
│  🔔 إعدادات الإشعارات   [>]  │
│──────────────────────────────│
│  ℹ️  عن العيادة         [>]   │
│  📋 سياسة الخصوصية      [>]  │
│──────────────────────────────│
│  🔴 تسجيل الخروج             │
│                              │
│  الإصدار 1.0.0               │
│                              │
└──────────────────────────────┘
```

**Behavior:**
- View profile info (bio, qualifications — read-only in app, edited by admin)
- Ratings & Reviews → D08
- Language toggle
- Notification settings
- About clinic (same as client)
- Logout

**Note:** Doctor cannot edit their own pricing, schedule display name, or specialty from the app — those are managed by admin via dashboard.

---

## D08 — Ratings & Reviews

**Purpose:** View all ratings received by this doctor

**Layout:**
```
┌──────────────────────────────┐
│ ←    التقييمات / Ratings      │
│──────────────────────────────│
│                              │
│  ┌──────────────────────┐    │
│  │     ⭐ 4.8            │    │
│  │  من 5.0 (120 تقييم)   │    │
│  │                      │    │
│  │ ⭐⭐⭐⭐⭐  85%  ████████│    │
│  │ ⭐⭐⭐⭐     10%  ██    │    │
│  │ ⭐⭐⭐       3%   █    │    │
│  │ ⭐⭐         1%        │    │
│  │ ⭐           1%        │    │
│  └──────────────────────┘    │
│                              │
│  المراجعات / Reviews          │
│                              │
│  ┌──────────────────────┐    │
│  │ سعاد م.              │    │
│  │ ⭐⭐⭐⭐⭐ • 20/03/2026 │    │
│  │ "طبيب ممتاز ومحترف   │    │
│  │  أنصح بزيارته"         │    │
│  └──────────────────────┘    │
│                              │
│  ┌──────────────────────┐    │
│  │ أحمد س.              │    │
│  │ ⭐⭐⭐⭐ • 15/03/2026   │    │
│  │ "خدمة جيدة جداً"      │    │
│  └──────────────────────┘    │
│                              │
│  ... more reviews ...        │
│                              │
└──────────────────────────────┘
```

**Behavior:**
- Overall rating with star breakdown chart
- Reviews list (newest first)
- Client name shown as first name + initial (privacy)
- Pagination / infinite scroll
- No reply feature for doctor (out of scope for v1)

**RTL:** Rating bars fill from right. Star breakdown labels on right.
