# Booking System — Relations, Constraints & Pricing

> **STATUS: Pre-SaaS historical record.** Tables below describe the pre-SaaS
> relational model — they reference deleted/renamed entities (`Role`,
> `Permission`, `RolePermission`, `UserRole`, `Specialty` as separate model,
> `EmployeeVacation`). The current architecture uses CASL with `CustomRole`
> + `Permission` in the `identity` cluster, and bookings have **no Prisma FK
> relations** to `Client`/`Branch`/`Employee`/`Service` (cross-cluster IDs are
> plain strings, integrity is event-driven). Source of truth:
> `apps/backend/prisma/schema/bookings.prisma`,
> `apps/backend/prisma/schema/identity.prisma`, and
> `docs/architecture/module-ownership.md`. Pricing-hierarchy section below
> still reflects intent but the live `EmployeeService`/`Service` shapes have
> shifted — verify against `org-experience` schema before quoting.
>
> جداول تحليلية للعلاقات والقيود وهرمية التسعير (تاريخي).
> للمخططات البصرية: [booking-erd.md](booking-erd.md) | للـ Enums: [booking-enums.md](booking-enums.md)

---

## ملخص أنواع العلاقات

### علاقات واحد-لواحد (1:1)

| العلاقة | الوصف | القيد |
|---------|-------|-------|
| **User ↔ Employee** | كل طبيب له حساب مستخدم واحد | `userId` UNIQUE on Employee |
| **Booking ↔ Payment** | كل حجز له دفعة واحدة فقط | `bookingId` UNIQUE on Payment |
| **Booking ↔ Rating** | كل حجز له تقييم واحد فقط | `bookingId` UNIQUE on Rating |
| **Booking ↔ Booking (self-ref)** | حجز مُعاد جدولته يشير للأصلي | `rescheduledFromId` UNIQUE on Booking |
| **Payment ↔ BankTransferReceipt** | كل دفعة لها إيصال واحد | `paymentId` UNIQUE on BankTransferReceipt |
| **Payment ↔ Invoice** | كل دفعة لها فاتورة واحدة | `paymentId` UNIQUE on Invoice |

### علاقات واحد-لمتعدد (1:M)

| الطرف الواحد | الطرف المتعدد | الوصف |
|-------------|-------------|-------|
| **User (client)** | **Booking[]** | مريض واحد ← حجوزات كثيرة |
| **Employee** | **Booking[]** | طبيب واحد ← مواعيد كثيرة |
| **Service** | **Booking[]** | خدمة واحدة ← حجوزات كثيرة |
| **EmployeeService** | **Booking[]** | تسعيرة واحدة ← حجوزات كثيرة |
| **Employee** | **EmployeeService[]** | طبيب واحد ← خدمات كثيرة |
| **Service** | **EmployeeService[]** | خدمة واحدة ← أطباء كثيرون |
| **ServiceCategory** | **Service[]** | تصنيف واحد ← خدمات كثيرة |
| **Employee** | **EmployeeAvailability[]** | طبيب واحد ← أوقات عمل كثيرة |
| **Employee** | **EmployeeVacation[]** | طبيب واحد ← إجازات كثيرة |
| **Employee** | **Rating[]** | طبيب واحد ← تقييمات كثيرة |
| **Booking** | **ProblemReport[]** | حجز واحد ← بلاغات كثيرة |
| **Specialty** | **Employee[]** | تخصص واحد ← أطباء كثيرون |
| **User** | **ActivityLog[]** | مستخدم واحد ← سجلات كثيرة |
| **User** | **Notification[]** | مستخدم واحد ← إشعارات كثيرة |
| **User** | **BankTransferReceipt[]** | أدمن واحد ← مراجعات كثيرة |
| **User** | **Rating[]** | مريض واحد ← تقييمات كثيرة |
| **User** | **ProblemReport[]** | مريض/أدمن ← بلاغات كثيرة |
| **User** | **UserRole[]** | مستخدم واحد ← أدوار كثيرة |
| **Role** | **UserRole[]** | دور واحد ← مستخدمون كثيرون |
| **Role** | **RolePermission[]** | دور واحد ← صلاحيات كثيرة |
| **Permission** | **RolePermission[]** | صلاحية واحدة ← أدوار كثيرة |

### علاقات متعدد-لمتعدد (M:N) — عبر جدول وسيط

| الطرفان | الجدول الوسيط | الوصف |
|---------|-------------|-------|
| **Employee ↔ Service** | **EmployeeService** | كل طبيب يقدم خدمات محددة بأسعار مخصصة |
| **User ↔ Role** | **UserRole** | RBAC — كل مستخدم له أدوار متعددة |
| **Role ↔ Permission** | **RolePermission** | كل دور له صلاحيات محددة |

> **EmployeeService** ليس مجرد جدول ربط — بل يحمل بيانات إضافية (أسعار مخصصة، مدة مخصصة، buffers، أنواع الحجز المتاحة).
>
> **RBAC** — نظام صلاحيات ديناميكي: الأدمن يُنشئ أدوار مخصصة من الداشبورد ويعيّن صلاحيات (view/create/edit/delete) لكل موديول. 5 أدوار افتراضية: `super_admin`, `receptionist`, `accountant`, `employee`, `client`.

### علاقة ذاتية (Self-referential)

| العلاقة | الوصف | القيد |
|---------|-------|-------|
| **Booking ↔ Booking** | إعادة الجدولة تُنشئ حجز جديد يشير للأصلي عبر `rescheduledFromId` | `rescheduledFromId` UNIQUE — كل حجز أصلي يُعاد جدولته مرة واحدة فقط |

---

## القيود والحدود (Constraints & Boundaries)

### قيود قاعدة البيانات (Database Constraints)

| القيد | الجدول | الأعمدة | الغرض |
|-------|--------|---------|-------|
| **UNIQUE** | Employee | `userId` | حساب واحد لكل طبيب |
| **UNIQUE** | EmployeeService | `[employeeId, serviceId]` | لا يمكن تكرار نفس الخدمة لنفس الطبيب |
| **UNIQUE** | Payment | `bookingId` | دفعة واحدة فقط لكل حجز |
| **UNIQUE** | Rating | `bookingId` | تقييم واحد فقط لكل حجز |
| **UNIQUE** | Booking | `rescheduledFromId` | حجز أصلي يُعاد جدولته مرة واحدة فقط |
| **UNIQUE** | BankTransferReceipt | `paymentId` | إيصال واحد فقط لكل دفعة |
| **UNIQUE** | Invoice | `paymentId` | فاتورة واحدة فقط لكل دفعة |
| **UNIQUE** | Invoice | `invoiceNumber` | أرقام فواتير فريدة |
| **UNIQUE** | UserRole | `[userId, roleId]` | مستخدم لا يأخذ نفس الدور مرتين |
| **UNIQUE** | RolePermission | `[roleId, permissionId]` | دور لا يأخذ نفس الصلاحية مرتين |
| **UNIQUE** | Permission | `[module, action]` | صلاحية فريدة لكل موديول+فعل |
| **INDEX** | Booking | `[employeeId, date]` | تسريع فحص التوفر |
| **INDEX** | Booking | `[clientId, status]` | تسريع قائمة حجوزات المريض |
| **INDEX** | Booking | `[status]` | تسريع الفلترة |
| **INDEX** | Booking | `[employeeServiceId]` | تسريع البحث بالتسعيرة |
| **INDEX** | Rating | `[employeeId]` | تسريع حساب المعدل |
| **INDEX** | ProblemReport | `[bookingId]` | تسريع جلب البلاغات |
| **INDEX** | ProblemReport | `[status]` | تسريع فلترة الحالة |
| **INDEX** | ActivityLog | `[userId]`, `[module]`, `[action]`, `[createdAt]` | تسريع بحث السجلات |
| **INDEX** | Notification | `[userId, isRead]` | تسريع جلب الإشعارات غير المقروءة |
| **INDEX** | EmployeeAvailability | `[employeeId, dayOfWeek]` | تسريع فحص الجدول |

### قيود منطقية (Business Rules)

| القاعدة | التفصيل |
|---------|---------|
| **المريض إلزامي عند الإنشاء** | `clientId` nullable في الـ schema فقط لـ `onDelete:SetNull` — الكود يفرض وجوده عند `create()` |
| **الدفع المسبق إلزامي** | لا يمكن تأكيد الحجز بدون `payment.status === 'paid'` |
| **منع الحجز المزدوج** | فحص التداخل الزمني مع مراعاة `bufferBefore` و `bufferAfter` |
| **فحص جدول العمل** | الموعد يجب أن يكون ضمن `EmployeeAvailability` ليوم الحجز |
| **فحص الإجازات** | لا حجز خلال فترة `EmployeeVacation` |
| **تاريخ مستقبلي فقط** | لا يمكن الحجز في تاريخ ماضٍ |
| **Zoom فقط للمرئي** | `zoomMeetingId/joinUrl/hostUrl` تُنشأ فقط عندما `type = video_consultation` |
| **الإلغاء يحتاج موافقة** | المريض يطلب ← الإدارة تقرر (استرداد كامل/جزئي/بدون) |
| **إعادة الجدولة = حجز جديد** | الحجز القديم يُلغى + حجز جديد مرتبط عبر `rescheduledFromId` + الدفعة تنتقل للجديد |
| **سلاسل إعادة الجدولة مسموحة** | A ← B ← C: كل حجز يشير لسابقه فقط. UNIQUE يمنع إعادة جدولة نفس الحجز مرتين لكن لا يمنع السلسلة |
| **نقل الدفعة عند إعادة الجدولة** | `payment.bookingId` يُحدّث للحجز الجديد. `ActivityLog` يسجل التغيير |
| **تقييم بعد الاكتمال** | لا يمكن تقييم حجز إلا بعد `status = completed` |
| **RBAC ديناميكي** | الصلاحيات عبر `User ← UserRole ← Role ← RolePermission ← Permission`. كل endpoint يتحقق عبر CASL guards |
| **المبالغ بالهللات** | جميع المبالغ مخزنة كأعداد صحيحة (1 ريال = 100 هللة) |
| **التواريخ بـ UTC** | التحويل للتوقيت المحلي يتم في الواجهة فقط |
| **Soft Delete** | الحذف الناعم (`deletedAt`) للحجوزات والكيانات المهمة |

---

## حدود التسعير — 3 مستويات (Pricing Hierarchy)

```
أولوية التسعير (3 طبقات — من payments.helpers.ts):
  ps?.priceClinic ?? pr?.priceClinic ?? service.price

+---------------------------------------------------+
| 1. EmployeeService.priceClinic/Phone/Video     | <-- الأعلى أولوية
|    (nullable — override per service)               |
+---------------------------------------------------+
| 2. Employee.priceClinic/Phone/Video            | <-- السعر العام للطبيب
|    (default 0 — fallback when PS is null)          |
+---------------------------------------------------+
| 3. Service.price                                   | <-- السعر الافتراضي للخدمة
|    (آخر fallback)                                  |
+---------------------------------------------------+

أولوية المدة (طبقتان):
+---------------------------------------------------+
| 1. EmployeeService.customDuration               | <-- الأعلى أولوية
+---------------------------------------------------+
| 2. Service.duration                                 | <-- المدة الافتراضية
+---------------------------------------------------+

حساب وقت النهاية (snapshot عند الإنشاء):
endTime = startTime + duration
Double-booking check = [startTime - bufferBefore, endTime + bufferAfter]
```
