# CareKit Navigation & User Flows

---

## 1. Mobile App — Navigation Architecture

### 1.1 Auth Flow (Shared)

```
App Launch
  │
  ├─→ [Splash Screen] → check token
  │     │
  │     ├─→ Token valid → check role → route to correct tab navigator
  │     │
  │     └─→ No token → [Onboarding] (first launch only)
  │           │
  │           └─→ [Auth Screen]
  │                 │
  │                 ├─→ [Login — Email + Password]
  │                 │     │
  │                 │     ├─→ Success → check role → route
  │                 │     └─→ Forgot password → [Reset Password via OTP]
  │                 │
  │                 ├─→ [Login — Email + OTP]
  │                 │     │
  │                 │     ├─→ Enter email → [OTP Verification Screen]
  │                 │     └─→ OTP verified → check role → route
  │                 │
  │                 └─→ [Register] (clients only)
  │                       │
  │                       └─→ Fill form → verify email OTP → logged in
```

### 1.2 Client Tab Navigator

```
Client Tabs (Bottom Navigation — 4 tabs):
┌──────────┬──────────┬──────────┬──────────┐
│  Home    │Bookings  │  Chat    │ Profile  │
│ الرئيسية │ المواعيد  │ المحادثة │ الملف    │
└──────────┴──────────┴──────────┴──────────┘

Tab 1: Home
  ├─→ [Home Screen]
  │     ├─→ Upcoming appointment card → [Appointment Detail]
  │     ├─→ Browse specialties → [Specialty List] → [Employee List] → [Employee Profile]
  │     ├─→ Browse services → [Service List] → [Service Detail]
  │     ├─→ Quick book CTA → [Booking Flow]
  │     └─→ Notification bell → [Notifications]
  │
  ├─→ [Specialty List]
  │     └─→ [Employee List]
  │           └─→ [Employee Profile]
  │                 └─→ Book button → [Booking Flow]
  │
  └─→ [Booking Flow] (modal/stack)
        ├─→ Step 1: Select type (clinic/phone/video)
        ├─→ Step 2: Select employee (if not pre-selected)
        ├─→ Step 3: Select date
        ├─→ Step 4: Select time slot
        ├─→ Step 5: Confirm details
        └─→ Step 6: Payment
              ├─→ [Moyasar Payment Screen]
              └─→ [Bank Transfer Upload Screen]
                    └─→ [Upload Receipt → Confirmation]

Tab 2: Bookings (المواعيد)
  ├─→ [Appointments List] (tabs: upcoming / past / cancelled)
  │     └─→ [Appointment Detail]
  │           ├─→ View Zoom link (video) → opens Zoom
  │           ├─→ View employee phone (phone consultation)
  │           ├─→ Request cancellation → [Cancellation Request Form]
  │           ├─→ Modify appointment → [Modify Booking Flow]
  │           ├─→ View invoice → [Invoice Detail]
  │           └─→ Rate appointment (after completed) → [Rating Screen]
  │
  └─→ [Rating Screen]
        ├─→ Star rating (1-5)
        ├─→ Optional text feedback
        └─→ Report problem → [Problem Report Form]

Tab 3: Chat (المحادثة)
  └─→ [Chat Screen] (AI Chatbot)
        ├─→ Text conversation with AI
        ├─→ AI suggests booking → deep link to [Booking Flow]
        ├─→ AI shows appointments → inline cards
        └─→ Handoff → Live Chat or contact number

Tab 4: Profile (الملف الشخصي)
  ├─→ [Profile Screen]
  │     ├─→ Edit profile → [Edit Profile Form]
  │     ├─→ My payments → [Payment History]
  │     │     └─→ [Payment Detail] → [Invoice Detail]
  │     ├─→ Language → toggle Arabic/English
  │     ├─→ Notification settings → [Notification Preferences]
  │     ├─→ About clinic → [About Screen]
  │     │     └─→ FAQ → [FAQ Screen]
  │     ├─→ Privacy policy → [Privacy Policy Screen]
  │     ├─→ Terms of service → [Terms Screen]
  │     └─→ Logout → confirm → [Auth Screen]
```

### 1.3 Employee (Doctor) Tab Navigator

```
Doctor Tabs (Bottom Navigation — 4 tabs):
┌──────────┬──────────┬──────────┬──────────┐
│  Today   │ Calendar │ Clients │ Profile  │
│  اليوم   │ التقويم  │ المرضى   │ الملف    │
└──────────┴──────────┴──────────┴──────────┘

Tab 1: Today (اليوم)
  └─→ [Today's Schedule]
        ├─→ List of today's appointments (chronological)
        │     └─→ [Appointment Detail — Doctor View]
        │           ├─→ View client info
        │           ├─→ View client phone (phone consultation)
        │           ├─→ Start Zoom call (video) → opens Zoom
        │           ├─→ Mark as completed
        │           └─→ View client history
        └─→ Stats: total today, completed, remaining

Tab 2: Calendar (التقويم)
  └─→ [Calendar View]
        ├─→ Month view → tap date → day view
        ├─→ Day view: time slots with appointments
        ├─→ Tap appointment → [Appointment Detail — Doctor View]
        └─→ Manage availability → [Availability Editor]
              ├─→ Set weekly schedule (day + start/end time)
              └─→ Set vacation dates

Tab 3: Clients (المرضى)
  └─→ [Client List]
        ├─→ Search by name
        └─→ [Client Record]
              ├─→ Client info (name, phone, email)
              ├─→ Visit history (all appointments with this client)
              └─→ Tap visit → [Appointment Detail]

Tab 4: Profile (الملف الشخصي)
  └─→ [Doctor Profile Screen]
        ├─→ View/edit bio
        ├─→ View ratings & reviews
        ├─→ Language → toggle Arabic/English
        ├─→ Notification settings
        ├─→ About clinic → [About Screen]
        └─→ Logout
```

---

## 2. Dashboard — Navigation Architecture

### 2.1 Sidebar Navigation

```
Dashboard Sidebar (RTL — right side):
┌─────────────────────┐
│ [Logo] CareKit      │
│─────────────────────│
│ ● الرئيسية (Home)    │
│─────────────────────│
│ 📋 المواعيد          │
│    (Appointments)    │
│ 👨‍⚕️ الأطباء          │
│    (Employees)   │
│ 👥 المرضى           │
│    (Clients)        │
│ 🏥 الخدمات          │
│    (Services)        │
│─────────────────────│
│ 💰 المالية           │
│    (Finance)         │
│   ├─ المدفوعات       │
│   │  (Payments)      │
│   ├─ الفواتير        │
│   │  (Invoices)      │
│   └─ التقارير        │
│      (Reports)       │
│─────────────────────│
│ 🤖 الشات بوت        │
│    (Chatbot)         │
│ 👤 المستخدمين        │
│    (Users & Roles)   │
│ ⚙️ الإعدادات         │
│    (Settings)        │
│   └─ White Label     │
│─────────────────────│
│ 🔔 الإشعارات        │
│    (Notifications)   │
│─────────────────────│
│ [Admin Name]         │
│ تسجيل خروج (Logout) │
└─────────────────────┘
```

### 2.2 Dashboard Page Flows

```
Home (Dashboard)
  ├─→ Stats cards (today's appointments, revenue, pending actions)
  ├─→ Today's appointments mini-list → click → Appointment Detail
  ├─→ Pending cancellation requests → click → Cancellation Review
  ├─→ Pending bank transfers → click → Transfer Verification
  └─→ Revenue chart (last 30 days)

Appointments
  ├─→ Calendar view (day/week/month) ← toggle
  ├─→ Table view with filters (status, employee, date range, type)
  ├─→ Click appointment → Appointment Detail (slide-over panel)
  │     ├─→ View full details
  │     ├─→ Change status
  │     ├─→ View payment
  │     └─→ Process cancellation (if pending_cancellation)
  └─→ Create appointment button → Create Appointment Form (modal)

Employees
  ├─→ Table: name, specialty, status, rating, actions
  ├─→ Add employee → Create Employee Form (modal/page)
  ├─→ Click employee → Employee Detail (page)
  │     ├─→ Profile info (edit)
  │     ├─→ Schedule editor (weekly availability grid)
  │     ├─→ Vacation manager
  │     ├─→ Appointment history
  │     └─→ Ratings & reviews
  └─→ Filter by specialty, status

Clients
  ├─→ Table: name, email, phone, total visits, last visit, actions
  ├─→ Search by name/email/phone
  ├─→ Click client → Client Detail (page)
  │     ├─→ Profile info
  │     ├─→ Visit history
  │     ├─→ Payment history
  │     └─→ Ratings given
  └─→ Export client list

Services
  ├─→ Categories (accordion or tabs)
  │     └─→ Services within category
  ├─→ Add category → Create Category Form (modal)
  ├─→ Add service → Create Service Form (modal)
  ├─→ Edit service → inline or modal
  └─→ Drag to reorder (sort order)

Payments
  ├─→ Table: invoice #, client, amount, method, status, date
  ├─→ Filter by: status, method, date range
  ├─→ Bank transfer tab → pending transfers
  │     └─→ Click transfer → Transfer Verification Panel
  │           ├─→ View receipt image
  │           ├─→ AI verification tags + confidence
  │           ├─→ Approve / Reject buttons
  │           └─→ Notes field
  └─→ Click payment → Payment Detail

Invoices
  ├─→ Table: invoice #, client, amount, date, sent status
  ├─→ Click invoice → Invoice Detail
  │     ├─→ View PDF
  │     └─→ Resend to client email
  └─→ Export invoices (date range)

Financial Reports
  ├─→ Revenue overview chart (line/bar)
  ├─→ Revenue by employee (table)
  ├─→ Revenue by service (table)
  ├─→ Payment method breakdown (pie chart)
  ├─→ Date range selector
  └─→ Export to Excel / PDF

Chatbot Management
  ├─→ Conversation log (list of sessions)
  │     └─→ Click session → full chat transcript
  ├─→ Most-asked questions (analytics)
  ├─→ Knowledge base editor
  │     ├─→ Add/edit/delete FAQ entries
  │     ├─→ Add/edit/delete service info
  │     └─→ Re-index embeddings button
  └─→ Chatbot settings (fallback mode, greeting message)

Users & Roles
  ├─→ Users tab
  │     ├─→ Table: name, email, role, status, last login
  │     ├─→ Add user → Create User Form (modal)
  │     └─→ Edit user → Edit User Form (modal)
  ├─→ Roles tab
  │     ├─→ Table: role name, users count, permissions count
  │     ├─→ Add role → Role Creator (page/modal)
  │     │     └─→ Permission matrix (modules x actions checkboxes)
  │     └─→ Edit role → Permission matrix editor
  └─→ System roles marked as non-deletable

White Label Settings
  ├─→ Branding section
  │     ├─→ Logo upload (preview)
  │     ├─→ Color picker (primary, secondary, accent)
  │     ├─→ Font selector
  │     └─→ App name
  ├─→ Contact section
  │     ├─→ Phone, email, address
  │     └─→ Social media links
  ├─→ Integration keys section
  │     ├─→ Moyasar API keys
  │     ├─→ Zoom API keys
  │     ├─→ OpenRouter API key
  │     └─→ Firebase config
  ├─→ Content section
  │     ├─→ About text (AR + EN)
  │     ├─→ Cancellation policy (AR + EN)
  │     ├─→ Privacy policy (AR + EN)
  │     └─→ Terms of service (AR + EN)
  └─→ System section
        ├─→ Default language
        ├─→ Timezone
        ├─→ Session duration
        └─→ Reminder timing (minutes before)

Notifications
  ├─→ List of system notifications
  ├─→ Mark read/unread
  └─→ Click notification → navigate to relevant page
```

---

## 3. Key User Journeys

### 3.1 Client Books Appointment (Happy Path)

```
1. Client opens app → Home screen
2. Taps specialty (e.g., "Dentistry" / "طب الأسنان")
3. Sees list of employees in that specialty
4. Taps employee → sees profile, rating, prices
5. Taps "Book Appointment" / "حجز موعد"
6. Selects type: Clinic Visit
7. Selects date from available calendar
8. Selects time slot from available slots
9. Reviews booking summary (employee, date, time, price)
10. Confirms → redirected to payment
11. Pays via Moyasar (Mada) → payment confirmed
12. Sees confirmation screen with booking details
13. Receives push notification + email confirmation
14. Booking appears in "My Appointments" / "مواعيدي"
```

### 3.2 Client Cancels Appointment

```
1. Client opens Bookings tab
2. Taps upcoming appointment
3. Taps "Request Cancellation" / "طلب إلغاء"
4. Fills cancellation reason
5. Submits → status changes to "pending_cancellation"
6. Sees message: "Your cancellation request is under review"
7. Admin receives notification in dashboard
8. Admin reviews and approves/rejects with refund decision
9. Client receives notification with result
10. If approved: booking status → cancelled, refund processed
```

### 3.3 Bank Transfer Payment

```
1. Client reaches payment step in booking flow
2. Selects "Bank Transfer" / "تحويل بنكي"
3. Sees bank account details (from White Label config)
4. Makes transfer via their bank app
5. Returns to CareKit app
6. Taps "Upload Receipt" / "رفع الإيصال"
7. Takes photo or selects from gallery
8. Uploads receipt → stored in MinIO
9. AI Vision API reads receipt → generates verification tags
10. Status: pending review
11. Admin sees transfer in dashboard with AI tags
12. Admin reviews receipt + AI analysis
13. Admin approves → booking confirmed, client notified
    OR Admin rejects → client notified to re-upload or contact support
```

### 3.4 Doctor's Daily Workflow

```
1. Doctor opens app → Today tab
2. Sees today's schedule: 8 appointments
3. First appointment: clinic visit at 9:00 AM
4. Taps appointment → sees client info
5. Client arrives → doctor conducts visit
6. Doctor marks appointment as "completed"
7. Next: video consultation at 10:00 AM
8. Taps appointment → taps "Start Zoom" → opens Zoom app
9. Conducts video call
10. Returns to app → marks as completed
11. At end of day: checks tomorrow's schedule in Calendar tab
12. Notices a conflict → contacts admin
13. Checks Clients tab → reviews client history before next day
```

### 3.5 Admin Manages Cancellation

```
1. Admin logs into dashboard
2. Sees notification: "New cancellation request" on Home
3. Clicks → goes to Appointments page, filtered to pending_cancellation
4. Opens appointment detail panel
5. Reviews: client name, appointment date, cancellation reason
6. Reviews payment: amount paid, payment method
7. Decides: full refund (client had valid reason)
8. Clicks "Approve Cancellation" → selects "Full Refund"
9. System processes refund via original payment method
10. Client receives notification: "Cancellation approved, full refund processed"
11. Booking status → cancelled
```
