# Deqah Dashboard — Complete Redesign Specification

> **STATUS: Pre-SaaS historical record.** This redesign brief was written
> before the SaaS multi-tenancy work and before the dashboard's "Page Anatomy
> — The Law" was codified in root `CLAUDE.md`. The page anatomy in root
> `CLAUDE.md` (Breadcrumbs → PageHeader → StatsGrid → FilterBar → DataTable)
> supersedes any layout described here. Kept for narrative on flows and
> intent only — do not treat API shapes / page structures below as current.

> توثيق شامل لجميع صفحات Dashboard مع التصميم وربط الـ API (تاريخي)

---

## 📋 جدول الصفحات والمراحل

| # | المرحلة | الصفحات | الحالة |
|---|---------|---------|--------|
| 1 | **Authentication** | Login | ✅ موجود |
| 2 | **Dashboard Overview** | لوحة التحكم | 🔄 إعادة تصميم |
| 3 | **Bookings** | الحجوزات, تفاصيل الحجز, إنشاء/تعديل | 📋 مخطط |
| 4 | **Clients** | قائمة المرضى, تفاصيل المريض, إنشاء | 📋 مخطط |
| 5 | **Employees** | قائمة الممارسين, الجدول, الإعدادات | 📋 مخطط |
| 6 | **Services** | الخدمات, الفئات, التسعير | 📋 مخطط |
| 7 | **Payments** | المدفوعات, الفواتير, الاسترداد | 📋 مخطط |
| 8 | **Reports** | التقارير, الإحصائيات, التصدير | 📋 مخطط |
| 9 | **Settings** | الإعدادات العامة, الفرعية, الهوية | 📋 مخطط |
| 10 | **Integrations** | ZATCA, الإشعارات, التكاملات | 📋 مخطط |

---

## ════════════════════════════════════════════════════════════════
# المرحلة 1: Authentication
## ════════════════════════════════════════════════════════════════

### 📄 صفحة تسجيل الدخول (`/login`)

#### API Endpoints
| Method | Endpoint | الوصف |
|--------|---------|------|
| POST | `/api/v1/auth/login` | تسجيل الدخول |
| POST | `/api/v1/auth/logout` | تسجيل الخروج |
| POST | `/api/v1/auth/refresh` | تجديد الـ token |
| GET | `/api/v1/auth/me` | معلومات المستخدم الحالي |

#### Request/Response
```typescript
// POST /api/v1/auth/login
Request:  { email: string, password: string }
Response: { 
  success: true,
  data: { 
    accessToken: string,
    user: { id, email, firstName, lastName, role, clinic }
  }
}
```

#### التصميم
- **Background**: متحرك مع Orbs
- **Card**: 420px max-width, glassmorphism
- **Elements**: 
  - Logo + Title
  - Email input
  - Password input + toggle
  - Submit button (gradient primary)
  - Forgot password link
  - Dev login (development only)

#### Component: `LoginForm`
```
Props: { onSuccess: () => void }
States: idle | loading | error
```

---

## ════════════════════════════════════════════════════════════════
# المرحلة 2: Dashboard Overview
## ════════════════════════════════════════════════════════════════

### 📄 لوحة التحكم (`/dashboard`)

#### API Endpoints
| Method | Endpoint | الوصف |
|--------|---------|------|
| GET | `/api/v1/dashboard/stats` | إحصائيات عامة |
| GET | `/api/v1/bookings?date=today&limit=10` | آخر الحجوزات |
| GET | `/api/v1/clients?limit=5&sort=createdAt` | آخر المرضى |

#### Response: Dashboard Stats
```typescript
{
  success: true,
  data: {
    todayStats: {
      totalBookings: number,
      confirmedBookings: number,
      pendingBookings: number,
      completedBookings: number,
      cancelledBookings: number,
      noShowBookings: number,
      totalRevenue: number,        // halalat
      totalClients: number,
    },
    weekStats: {
      bookingsChange: number,        // percentage
      revenueChange: number,
    },
    upcomingAppointments: BookingWithRelations[],
    recentClients: Client[],
    popularServices: { service: Service, count: number }[],
  }
}
```

#### التصميم

```
┌─────────────────────────────────────────────────────────────────┐
│  Header (64px)                                                 │
├──────────────┬──────────────────────────────────────────────────┤
│             │                                                   │
│  Sidebar   │  Page Header                                    │
│  (240px)   │  "مرحباً، أحمد" + التاريخ                       │
│             │                                                  │
│             │  Stats Grid (4 columns)                         │
│             │  ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐     │
│             │  │Today's│ │Revenue│ │Pending│ │Clients│     │
│             │  │ Bookings│ │ Today │ │Count  │ │ Today │     │
│             │  └───────┘ └───────┘ └───────┘ └───────┘     │
│             │                                                  │
│             │  Content Grid (2 columns)                      │
│             │  ┌────────────────┐ ┌────────────┐            │
│             │  │ Recent         │ │ Quick     │            │
│             │  │ Appointments   │ │ Stats     │            │
│             │  │ (list)        │ │           │            │
│             │  └────────────────┘ └────────────┘            │
│             │                                                  │
│             │  Recent Clients Table                         │
│             │  ┌─────────────────────────────────────────┐  │
│             │  │ Name | ID | Phone | Date | Actions      │  │
│             │  └─────────────────────────────────────────┘  │
└──────────────┴──────────────────────────────────────────────────┘
```

#### Stats Grid
| Stat | Icon | Color | Format |
|------|------|-------|--------|
| إجمالي الحجوزات | CalendarCheck | primary | number |
| الإيرادات | Wallet | success | 1,234.50 ر.س |
| في الانتظار | Clock | warning | number |
| المرضى اليوم | Users | info | number |

#### Components Required
| Component | الوصف |
|-----------|------|
| `DashboardStats` | StatsGrid with 4 StatCards |
| `RecentAppointments` | List of today's appointments |
| `QuickStats` | Side panel with quick metrics |
| `RecentClients` | Table of recently registered clients |

---

## ════════════════════════════════════════════════════════════════
# المرحلة 3: Bookings
## ════════════════════════════════════════════════════════════════

### 📄 قائمة الحجوزات (`/bookings`)

#### API Endpoints
| Method | Endpoint | الوصف |
|--------|---------|------|
| GET | `/api/v1/bookings` | قائمة الحجوزات (paginated) |
| GET | `/api/v1/bookings/:id` | تفاصيل الحجز |
| POST | `/api/v1/bookings` | إنشاء حجز جديد |
| PATCH | `/api/v1/bookings/:id` | تعديل الحجز |
| POST | `/api/v1/bookings/:id/cancel` | إلغاء الحجز |
| POST | `/api/v1/bookings/:id/confirm` | تأكيد الحجز |
| POST | `/api/v1/bookings/:id/check-in` | تسجيل حضور |
| POST | `/api/v1/bookings/:id/complete` | إكمال الحجز |
| POST | `/api/v1/bookings/:id/no-show` | تسجيل لم يحضر |

#### Query Parameters
```
GET /api/v1/bookings?
  page=1
  limit=20
  status=pending,confirmed
  type=in_person,online
  employeeId=uuid
  serviceId=uuid
  branchId=uuid
  dateFrom=2026-04-01
  dateTo=2026-04-30
  search=clientName
```

#### Response: Paginated Bookings
```typescript
{
  success: true,
  data: BookingWithRelations[],
  meta: {
    total: number,
    page: number,
    limit: number,
    totalPages: number
  }
}
```

#### Booking Types
```typescript
enum BookingType {
  IN_PERSON = 'in_person',    // حضوري
  ONLINE = 'online',          // أونلاين
  WALK_IN = 'walk_in',        // دخول مباشر
}

enum BookingStatus {
  PENDING = 'pending',                    // في الانتظار
  CONFIRMED = 'confirmed',                // مأكد
  CHECKED_IN = 'checked_in',             // تم الحضور
  IN_PROGRESS = 'in_progress',           // جاري
  COMPLETED = 'completed',                // مكتمل
  CANCELLED = 'cancelled',               // ملغي
  PENDING_CANCELLATION = 'pending_cancellation', // بانتظار الإلغاء
  NO_SHOW = 'no_show',                  // لم يحضر
  EXPIRED = 'expired',                  // منتهي
}
```

#### التصميم

```
┌─────────────────────────────────────────────────────────────────┐
│  Header                                                         │
├──────────────┬──────────────────────────────────────────────────┤
│  Sidebar     │  Page Header                                    │
│              │  "الحجوزات" + [تصدير] [+ حجز جديد]              │
│              │                                                  │
│              │  Filter Bar                                      │
│              │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────┐│
│              │  │ 🔍 بحث │ │ الحالة ▼ │ │ النوع ▼  │ │ ممارس ││
│              │  └──────────┘ └──────────┘ └──────────┘ └──────┘│
│              │                                                  │
│              │  Stats Row (mini)                                │
│              │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐     │
│              │  │ الكل │ │تأكيد│ │انتظار│ │مكتمل│ │ملغي │     │
│              │  │ 156 │ │ 89  │ │  23 │ │  42 │ │  2  │     │
│              │  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘     │
│              │                                                  │
│              │  Data Table                                      │
│              │  ┌────────────────────────────────────────────┐  │
│              │  │ المريض │ الوقت │ الخدمة │ النوع │ الحالة │ ⚙️ │  │
│              │  ├────────────────────────────────────────────┤  │
│              │  │ محمد   │ 09:00 │ فحص    │ حضوري │ مؤكد   │ 👁️ │  │
│              │  │ فاطمة │ 10:30 │ علاج   │ أونلاين│ انتظار│ 👁️ │  │
│              │  └────────────────────────────────────────────┘  │
│              │                                                  │
│              │  Pagination                                     │
│              │  [◀] 1 2 3 ... 10 [▶]                         │
└──────────────┴──────────────────────────────────────────────────┘
```

#### Status Badges
| الحالة | Style |
|--------|-------|
| مأكد | `bg-success/10 text-success` |
| في الانتظار | `bg-warning/10 text-warning` |
| مكتمل | `bg-primary/10 text-primary` |
| ملغي | `bg-destructive/10 text-destructive` |
| لم يحضر | `bg-muted text-muted-foreground` |
| جاري | `bg-accent/10 text-accent` |

#### Components Required
| Component | الوصف |
|-----------|------|
| `BookingsTable` | TanStack Table مع الأعمدة |
| `BookingFilters` | FilterBar مع الفلاتر |
| `BookingStatusBadge` | Badge للحالة |
| `BookingTypeBadge` | Badge للنوع |
| `CreateBookingDialog` | Dialog لإنشاء حجز |
| `BookingDetailsDrawer` | Drawer لعرض التفاصيل |

---

### 📄 تفاصيل الحجز (`/bookings/[id]`)

#### Layout
```
┌─────────────────────────────────────────────────────────────────┐
│  Back Button + "تفاصيل الحجز #BKG-1234"          [تعديل] [إلغاء]│
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────┐  ┌─────────────────────────┐   │
│  │  معلومات الحجز           │  │  معلومات المريض          │   │
│  │  ────────────────────    │  │  ────────────────────    │   │
│  │  التاريخ: 10 أبريل 2026  │  │  الاسم: محمد العمري      │   │
│  │  الوقت: 09:00 - 09:30  │  │  الهاتف: +966 55 1234567 │   │
│  │  النوع: حضوري           │  │  البريد: moh@email.com  │   │
│  │  الحالة: مأكد           │  │  [عرض الملف الشخصي]     │   │
│  └─────────────────────────┘  └─────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────┐  ┌─────────────────────────┐   │
│  │  الخدمة المطلوبة         │  │  معلومات الدفع           │   │
│  │  ────────────────────    │  │  ────────────────────    │   │
│  │  فحص أسنان شامل         │  │  المبلغ: 150.00 ر.س     │   │
│  │  د. أحمد محمد           │  │  الحالة: مدفوع         │   │
│  │  30 دقيقة              │  │  الطريقة: بطاقة ائتمانية│   │
│  └─────────────────────────┘  └─────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  Timeline النشاط                                      │ │
│  │  ────────────────────────────────────────────        │ │
│  │  ✅ تم الحجز — 10 أبريل 08:00                       │ │
│  │  ✅ تم التأكيد — 10 أبريل 08:15                     │ │
│  │  ⏳ في الانتظار — 10 أبريل 09:00                    │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## ════════════════════════════════════════════════════════════════
# المرحلة 4: Clients
## ════════════════════════════════════════════════════════════════

### 📄 قائمة المرضى (`/clients`)

#### API Endpoints
| Method | Endpoint | الوصف |
|--------|---------|------|
| GET | `/api/v1/clients` | قائمة المرضى (paginated) |
| GET | `/api/v1/clients/:id` | تفاصيل المريض |
| POST | `/api/v1/clients` | إنشاء مريض جديد |
| PATCH | `/api/v1/clients/:id` | تعديل بيانات المريض |
| DELETE | `/api/v1/clients/:id` | حذف المريض (soft delete) |
| GET | `/api/v1/clients/:id/bookings` | حجوزات المريض |

#### Client Type
```typescript
interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string;
  dateOfBirth: string | null;
  gender: 'male' | 'female';
  nationality: string | null;
  idNumber: string | null;
  isVerified: boolean;
  totalBookings: number;
  completedBookings: number;
  noShowCount: number;
  createdAt: string;
  lastVisitAt: string | null;
}
```

#### التصميم

```
┌─────────────────────────────────────────────────────────────────┐
│  "المرضى" + [تصدير] [+ مريض جديد]                               │
├─────────────────────────────────────────────────────────────────┤
│  Filter Bar                                                     │
│  ┌──────────┐ ┌──────────┐ ┌────────────────────┐           │
│  │ 🔍 بحث  │ │ الجنس ▼ │ │ الحالة (نشط/محذوف)▼│           │
│  └──────────┘ └──────────┘ └────────────────────┘           │
│                                                                 │
│  Stats Row                                                     │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐              │
│  │إجمالي   │ │本月新規  │ │_active  │ │ نسبة    │              │
│  │ 1,234   │ │   156   │ │ 1,189   │ │ 96.3%  │              │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘              │
│                                                                 │
│  Clients Table                                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ المريض │الجنس│الهاتف│الحجوزات│آخر زيارة│ الإجراءات │    │
│  ├────────────────────────────────────────────────────────────┤ │
│  │ 👤 محمد  │ ذكر  │055123│   12   │ 10 أبريل │ 👁️ ✏️ 🗑️ │    │
│  │ 👤 فاطمة │ أنثى│055987│    8   │  9 أبريل │ 👁️ ✏️ 🗑️ │    │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

#### Components Required
| Component | الوصف |
|-----------|------|
| `ClientsTable` | جدول المرضى |
| `ClientFilters` | فلاتر البحث |
| `ClientStats` | إحصائيات المرضى |
| `CreateClientDialog` | Dialog إنشاء مريض |
| `ClientDetailsDrawer` | عرض تفاصيل المريض |

---

## ════════════════════════════════════════════════════════════════
# المرحلة 5: Employees
## ════════════════════════════════════════════════════════════════

### 📄 قائمة الممارسين (`/employees`)

#### API Endpoints
| Method | Endpoint | الوصف |
|--------|---------|------|
| GET | `/api/v1/employees` | قائمة الممارسين |
| GET | `/api/v1/employees/:id` | تفاصيل الممارس |
| POST | `/api/v1/employees` | إضافة ممارس |
| PATCH | `/api/v1/employees/:id` | تعديل الممارس |
| GET | `/api/v1/employees/:id/schedule` | جدول الممارس |
| GET | `/api/v1/employees/:id/vacations` | إجازات الممارس |
| POST | `/api/v1/employees/:id/vacations` | إضافة إجازة |

#### Employee Type
```typescript
interface EmployeeWithUser {
  id: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    avatarUrl: string | null;
  };
  specialty: {
    id: string;
    nameAr: string;
    nameEn: string;
    iconUrl: string | null;
  };
  bio: string | null;
  rating: number;
  reviewCount: number;
  isActive: boolean;
  todayBookings: number;
  weekBookings: number;
}
```

#### التصميم

```
┌─────────────────────────────────────────────────────────────────┐
│  "الممارسون" + [تصدير] [+ ممارس جديد]                            │
├─────────────────────────────────────────────────────────────────┤
│  Filter Bar                                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                       │
│  │ 🔍 بحث  │ │ التخصص ▼ │ │ الحالة ▼ │                       │
│  └──────────┘ └──────────┘ └──────────┘                       │
│                                                                 │
│  Employees Grid (Cards)                                      │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐        │
│  │  🖼️ د. أحمد   │ │  🖼️ د. سارة   │ │  🖼️ د. خالد   │        │
│  │  طب أسنان     │ │  تقويم        │ │  جراحة        │        │
│  │  ⭐ 4.8 (124) │ │  ⭐ 4.9 (89)  │ │  ⭐ 4.7 (56)  │        │
│  │  اليوم: 8     │ │  اليوم: 6     │ │  اليوم: 4     │        │
│  │  [الجدول]     │ │  [الجدول]     │ │  [الجدول]     │        │
│  └───────────────┘ └───────────────┘ └───────────────┘        │
│                                                                 │
│  Employee Card States:                                      │
│  - Active: border-success                                       │
│  - On Vacation: border-warning + badge                         │
│  - Inactive: opacity-60                                       │
└─────────────────────────────────────────────────────────────────┘
```

---

### 📄 جدول الممارس (`/employees/[id]/schedule`)

#### API Endpoints
| Method | Endpoint | الوصف |
|--------|---------|------|
| GET | `/api/v1/employees/:id/availability` | ساعات العمل |
| GET | `/api/v1/employees/:id/bookings?date=YYYY-MM-DD` | حجوزات يوم معين |

#### التصميم

```
┌─────────────────────────────────────────────────────────────────┐
│  ← د. أحمد محمد — جدول العمل                                    │
├─────────────────────────────────────────────────────────────────┤
│  Date Navigation                                                │
│  [◀] 10 أبريل 2026 [▶]                    [اليوم] [الأسبوع]   │
│                                                                 │
│  Schedule Grid                                                 │
│  ┌─────┬─────┬─────┬─────┬─────┬─────┬─────┐              │
│  │     │ إثنين│ ثلاثاء│أربعاء│ خميس │ جمعة │ سبت  │              │
│  ├─────┼─────┼─────┼─────┼─────┼─────┼─────┤              │
│  │ 09:00│██████│      │██████│      │██████│      │              │
│  │ 10:00│██████│██████│██████│      │██████│      │              │
│  │ 11:00│      │██████│      │██████│      │      │              │
│  │ 12:00│      │      │      │██████│      │      │              │
│  └─────┴─────┴─────┴─────┴─────┴─────┴─────┘              │
│                                                                 │
│  Legend:                                                       │
│  ████ حجز    ┤ ┤ متاح                                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## ════════════════════════════════════════════════════════════════
# المرحلة 6: Services
## ════════════════════════════════════════════════════════════════

### 📄 قائمة الخدمات (`/services`)

#### API Endpoints
| Method | Endpoint | الوصف |
|--------|---------|------|
| GET | `/api/v1/services` | قائمة الخدمات |
| GET | `/api/v1/services/:id` | تفاصيل الخدمة |
| POST | `/api/v1/services` | إنشاء خدمة |
| PATCH | `/api/v1/services/:id` | تعديل الخدمة |
| DELETE | `/api/v1/services/:id` | حذف الخدمة |
| GET | `/api/v1/service-categories` | فئات الخدمات |

#### Service Type
```typescript
interface ServiceWithCategory {
  id: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string | null;
  descriptionEn: string | null;
  category: {
    id: string;
    nameAr: string;
  };
  price: number;           // halalat (100 = 1 SAR)
  duration: number;        // minutes
  isActive: boolean;
  isHidden: boolean;
  depositEnabled: boolean;
  depositPercent: number | null;
  allowRecurring: boolean;
  maxParticipants: number;
  bookingCount: number;    // هذا الشهر
  revenue: number;         // هذا الشهر
}
```

#### التصميم

```
┌─────────────────────────────────────────────────────────────────┐
│  "الخدمات" + [تصدير] [+ خدمة جديدة]                            │
├─────────────────────────────────────────────────────────────────┤
│  Stats Row                                                     │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐              │
│  │إجمالي   │ │نشطة     │ │حجوزات   │ │إيرادات   │              │
│  │  24     │ │  18     │ │  142    │ │4,520 ر.س│              │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘              │
│                                                                 │
│  Category Tabs                                                 │
│  [الكل] [طب الأسنان] [تقويم] [جراحة] [تجميل] [وقاية]          │
│                                                                 │
│  Services Grid                                                 │
│  ┌─────────────────────┐ ┌─────────────────────┐              │
│  │ 🦷 فحص أسنان شامل   │ │ 🔧 استشارة تقويم     │              │
│  │ طب الأسنان          │ │ تقويم الأسنان       │              │
│  │ ─────────────────  │ │ ─────────────────  │              │
│  │ 💰 150 ر.س         │ │ 💰 200 ر.س         │              │
│  │ ⏱️ 30 دقيقة        │ │ ⏱️ 45 دقيقة        │              │
│  │ 📅 12 حجز          │ │ 📅 8 حجز           │              │
│  │ [✏️] [🗑️]          │ │ [✏️] [🗑️]          │              │
│  └─────────────────────┘ └─────────────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

#### Components Required
| Component | الوصف |
|-----------|------|
| `ServicesGrid` | Grid من ServiceCards |
| `ServiceCard` | Card للخدمة مع السعر والمدة |
| `CategoryTabs` | تبويبات الفئات |
| `ServiceFilters` | فلاتر البحث |
| `CreateServiceDialog` | Dialog إنشاء/تعديل خدمة |

---

## ════════════════════════════════════════════════════════════════
# المرحلة 7: Payments
## ════════════════════════════════════════════════════════════════

### 📄 المدفوعات (`/payments`)

#### API Endpoints
| Method | Endpoint | الوصف |
|--------|---------|------|
| GET | `/api/v1/payments` | قائمة المدفوعات |
| GET | `/api/v1/payments/:id` | تفاصيل الدفع |
| GET | `/api/v1/invoices` | قائمة الفواتير |
| GET | `/api/v1/invoices/:id` | تفاصيل الفاتورة |
| POST | `/api/v1/payments/:id/refund` | استرداد |

#### Payment Type
```typescript
interface Payment {
  id: string;
  bookingId: string;
  amount: number;           // halalat
  vatAmount: number;        // halalat
  totalAmount: number;      // halalat
  method: PaymentMethod;
  status: PaymentStatus;
  moyasarPaymentId: string | null;
  transactionRef: string | null;
  createdAt: string;
}

enum PaymentMethod {
  CARD = 'card',
  CASH = 'cash',
  BANK_TRANSFER = 'bank_transfer',
  APPLE_PAY = 'apple_pay',
}

enum PaymentStatus {
  PENDING = 'pending',
  CAPTURED = 'captured',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  PARTIALLY_REFUNDED = 'partially_refunded',
}
```

#### التصميم

```
┌─────────────────────────────────────────────────────────────────┐
│  "المدفوعات" + [تصدير]                                          │
├─────────────────────────────────────────────────────────────────┤
│  Stats Row                                                     │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐              │
│  │إجمالي اليوم │ │ مدفوع      │ │ معلق       │              │
│  │ 12,450 ر.س │ │ 11,200 ر.س │ │  1,250 ر.س │              │
│  └─────────────┘ └─────────────┘ └─────────────┘              │
│                                                                 │
│  Tabs: [ المدفوعات ] [ الفواتير ] [ الاستردادات ]              │
│                                                                 │
│  Payments Table                                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ المبلغ │ الطريقة │ الحالة │ الحجز │ التاريخ │            │ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │150.00 │ 💳 بطاقة│ ✅ مدفوع│ #BKG-1│ 10 أبريل│ 👁️ │     │
│  │200.00 │ 💵 نقدي │ ✅ مدفوع│ #BKG-2│ 10 أبريل│ 👁️ │     │
│  │75.00  │ 🔄 تحويل│ ⏳ بانتظار│ #BKG-3│ 10 أبريل│ 👁️ │     │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## ════════════════════════════════════════════════════════════════
# المرحلة 8: Reports
## ════════════════════════════════════════════════════════════════

### 📄 التقارير (`/reports`)

#### API Endpoints
| Method | Endpoint | الوصف |
|--------|---------|------|
| GET | `/api/v1/reports/bookings` | تقرير الحجوزات |
| GET | `/api/v1/reports/revenue` | تقرير الإيرادات |
| GET | `/api/v1/reports/employees` | تقرير الممارسين |
| GET | `/api/v1/reports/services` | تقرير الخدمات |

#### Report Types
| التقرير | الوصف |
|--------|-------|
| Bookings Report | الحجوزات اليومية/الشهرية |
| Revenue Report | الإيرادات مفصلة |
| Employee Performance | أداء الممارسين |
| Service Popularity | الخدمات الأكثر طلباً |
| Client Analytics | تحليل المرضى |

#### التصميم

```
┌─────────────────────────────────────────────────────────────────┐
│  "التقارير" + [تصدير PDF] [تصدير Excel]                         │
├─────────────────────────────────────────────────────────────────┤
│  Report Type Tabs                                              │
│  [الحجوزات] [الإيرادات] [الممارسين] [الخدمات] [المرضى]      │
│                                                                 │
│  Date Range Picker                                             │
│  من: [10 مارس 2026 📅]  إلى: [10 أبريل 2026 📅]              │
│                                                                 │
│  Summary Cards                                                 │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐     │
│  │إجمالي     │ │ مكتمل     │ │ملغي      │ │لم يحضر   │     │
│  │  1,234    │ │   892     │ │   198    │ │   144    │     │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘     │
│                                                                 │
│  Charts                                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │            📊 رسم بياني                                  │   │
│  │                                                         │   │
│  │     📈 اتجاه الحجوزات خلال الفترة                        │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## ════════════════════════════════════════════════════════════════
# المرحلة 9: Settings
## ════════════════════════════════════════════════════════════════

### 📄 الإعدادات (`/settings`)

#### Sub-pages
| المسار | الوصف |
|--------|-------|
| `/settings/general` | الإعدادات العامة |
| `/settings/working-hours` | ساعات العمل |
| `/settings/branch` | معلومات الفرع |
| `/settings/taxes` | الإعدادات الضريبية |
| `/settings/notifications` | إعدادات الإشعارات |
| `/settings/backup` | النسخ الاحتياطي |

#### API Endpoints
| Method | Endpoint | الوصف |
|--------|---------|------|
| GET | `/api/v1/clinic` | معلومات العيادة |
| PATCH | `/api/v1/clinic` | تعديل معلومات العيادة |
| GET | `/api/v1/branches/:id` | معلومات الفرع |
| PATCH | `/api/v1/branches/:id` | تعديل الفرع |
| GET | `/api/v1/organization-settings` | إعدادات العيادة |
| PATCH | `/api/v1/organization-settings` | تعديل الإعدادات |

#### التصميم

```
┌─────────────────────────────────────────────────────────────────┐
│  "الإعدادات"                                                   │
├─────────────────────────────────────────────────────────────────┤
│  Settings Navigation                                           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 📋 الإعدادات العامة                                     │   │
│  │ 🕐 ساعات العمل                                         │   │
│  │ 🏥 معلومات الفرع                                       │   │
│  │ 💰 الإعدادات الضريبية                                 │   │
│  │ 🔔 الإشعارات                                          │   │
│  │ 💾 النسخ الاحتياطي                                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Settings Form                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  اسم العيادة                                           │   │
│  │  ┌─────────────────────────────────────────────────┐│   │
│  │  │ عيادة الأسنان التخصصية                           ││   │
│  │  └─────────────────────────────────────────────────┘│   │
│  │                                                          │   │
│  │  رقم السجل التجاري                                     │   │
│  │  ┌─────────────────────────────────────────────────┐│   │
│  │  │ 1234567890                                    ││   │
│  │  └─────────────────────────────────────────────────┘│   │
│  │                                                          │   │
│  │  [حفظ التعديلات]                                        │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## ════════════════════════════════════════════════════════════════
# المرحلة 10: Integrations
## ════════════════════════════════════════════════════════════════

### 📄 ZATCA Integration (`/zatca`)

#### API Endpoints
| Method | Endpoint | الوصف |
|--------|---------|------|
| GET | `/api/v1/zatca/invoices` | قائمة الفواتير الضريبية |
| POST | `/api/v1/zatca/invoices/:id/submit` | إرسال لـ ZATCA |
| GET | `/api/v1/zatca/invoices/:id/status` | حالة الفاتورة |

#### ZATCA Status
```typescript
enum ZatcaStatus {
  DRAFT = 'draft',
  READY = 'ready',
  SUBMITTED = 'submitted',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
}
```

### 📄 White Label (`/white-label`)

#### API Endpoints
| Method | Endpoint | الوصف |
|--------|---------|------|
| GET | `/api/v1/whitelabel` | إعدادات الهوية |
| PATCH | `/api/v1/whitelabel` | تعديل إعدادات الهوية |
| POST | `/api/v1/whitelabel/logo` | رفع الشعار |
| POST | `/api/v1/whitelabel/favicon` | رفع Favicon |

#### White Label Settings
```typescript
interface WhiteLabelSettings {
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;     // hex
  accentColor: string;      // hex
  clinicName: string;
  clinicNameAr: string;
  poweredBy: boolean;
  customFooterText: string | null;
}
```

---

## ════════════════════════════════════════════════════════════════
# Component Architecture
## ════════════════════════════════════════════════════════════════

### Global Components
```
components/
├── ui/                    # shadcn primitives
│   ├── button.tsx
│   ├── input.tsx
│   ├── select.tsx
│   ├── dialog.tsx
│   ├── drawer.tsx
│   ├── table.tsx
│   ├── badge.tsx
│   ├── card.tsx
│   ├── avatar.tsx
│   └── ...
│
└── features/              # Domain components
    ├── shared/
    │   ├── PageHeader.tsx
    │   ├── StatsGrid.tsx
    │   ├── StatCard.tsx
    │   ├── DataTable.tsx
    │   ├── FilterBar.tsx
    │   ├── Pagination.tsx
    │   ├── EmptyState.tsx
    │   └── LoadingSkeleton.tsx
    │
    ├── bookings/
    │   ├── BookingsTable.tsx
    │   ├── BookingFilters.tsx
    │   ├── BookingStatusBadge.tsx
    │   ├── BookingTypeBadge.tsx
    │   ├── BookingDetailsDrawer.tsx
    │   └── CreateBookingDialog.tsx
    │
    ├── clients/
    │   ├── ClientsTable.tsx
    │   ├── ClientFilters.tsx
    │   ├── ClientStats.tsx
    │   └── CreateClientDialog.tsx
    │
    ├── employees/
    │   ├── EmployeesGrid.tsx
    │   ├── EmployeeCard.tsx
    │   ├── EmployeeSchedule.tsx
    │   └── CreateEmployeeDialog.tsx
    │
    ├── services/
    │   ├── ServicesGrid.tsx
    │   ├── ServiceCard.tsx
    │   ├── CategoryTabs.tsx
    │   └── CreateServiceDialog.tsx
    │
    ├── payments/
    │   ├── PaymentsTable.tsx
    │   ├── PaymentFilters.tsx
    │   └── RefundDialog.tsx
    │
    └── settings/
        ├── SettingsNavigation.tsx
        └── SettingsForm.tsx
```

---

## ════════════════════════════════════════════════════════════════
# Hooks Structure
## ════════════════════════════════════════════════════════════════

```
hooks/
├── useBookings.ts              # TanStack Query hooks
├── useClients.ts
├── useEmployees.ts
├── useServices.ts
├── usePayments.ts
├── useAuth.ts
│
└── mutations/
    ├── useCreateBooking.ts
    ├── useUpdateBooking.ts
    ├── useCancelBooking.ts
    ├── useCreateClient.ts
    └── ...
```

---

## ════════════════════════════════════════════════════════════════
# API Layer
## ════════════════════════════════════════════════════════════════

```
lib/
├── api/
│   ├── client.ts              # Axios instance
│   ├── bookings.ts            # Booking API calls
│   ├── clients.ts
│   ├── employees.ts
│   ├── services.ts
│   ├── payments.ts
│   └── auth.ts
│
├── types/
│   └── ...                   # Type definitions
│
├── schemas/
│   ├── booking.schema.ts      # Zod schemas
│   ├── client.schema.ts
│   └── ...
│
└── query-keys.ts             # TanStack Query keys
```

---

## ════════════════════════════════════════════════════════════════
# Design Tokens (CSS Variables)
## ════════════════════════════════════════════════════════════════

```css
:root {
  /* Brand Colors */
  --primary: #354FD8;
  --primary-light: #5B72E8;
  --primary-dark: #2A3FA8;
  --primary-ultra-light: rgba(53, 79, 216, 0.08);
  --primary-glow: rgba(53, 79, 216, 0.25);
  
  --accent: #82CC17;
  --accent-light: #9FE035;
  
  /* Neutrals */
  --background: #F2F4F8;
  --foreground: #1B2026;
  --muted: #667085;
  
  /* States */
  --success: #16A34A;
  --warning: #D97706;
  --error: #DC2626;
  --info: #2563EB;
  
  /* Typography */
  --font-family: 'IBM Plex Sans Arabic', sans-serif;
  
  /* Spacing (8px grid) */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  
  /* Radius */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;
  --radius-2xl: 24px;
}
```

---

## ════════════════════════════════════════════════════════════════
# RTL Implementation
## ════════════════════════════════════════════════════════════════

### Rules
| ❌ ممنوع | ✅ استخدم |
|---------|---------|
| `ml-*` | `ms-*` |
| `mr-*` | `me-*` |
| `pl-*` | `ps-*` |
| `pr-*` | `pe-*` |
| `left` | `start` |
| `right` | `end` |
| `text-left` | `text-start` |
| `text-right` | `text-end` |

### Icon Mirroring
```tsx
// Directional icons must flip in RTL
<ChevronRight className="rtl:rotate-180" />
<ArrowRight className="rtl:rotate-180" />
```

---

## ════════════════════════════════════════════════════════════════
# Status Checklist
## ════════════════════════════════════════════════════════════════

| المرحلة | الصفحة | التصميم | API | Components | Hooks | Testing |
|---------|--------|---------|------|------------|-------|---------|
| 1 | Login | ✅ | ✅ | ✅ | ✅ | ⏳ |
| 2 | Dashboard | 🔄 | 🔄 | 🔄 | 🔄 | ⏳ |
| 3 | Bookings | 📋 | 📋 | 📋 | 📋 | ⏳ |
| 4 | Clients | 📋 | 📋 | 📋 | 📋 | ⏳ |
| 5 | Employees | 📋 | 📋 | 📋 | 📋 | ⏳ |
| 6 | Services | 📋 | 📋 | 📋 | 📋 | ⏳ |
| 7 | Payments | 📋 | 📋 | 📋 | 📋 | ⏳ |
| 8 | Reports | 📋 | 📋 | 📋 | ⏳ |
| 9 | Settings | 📋 | 📋 | 📋 | ⏳ |
| 10 | Integrations | 📋 | 📋 | 📋 | ⏳ |

---

**Legend:**
- ✅ = مكتمل
- 🔄 = قيد العمل
- 📋 = مخطط
- ⏳ = لم يبدا

---

*Generated: April 2026*
*Deqah Dashboard Redesign Documentation v1.0*
