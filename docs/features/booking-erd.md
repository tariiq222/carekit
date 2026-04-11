# Booking System — Entity Relationship Diagram

## مخطط العلاقات الكامل لنظام المواعيد

```mermaid
erDiagram

    %% ═══════════════════════════════════════════
    %%  CORE ENTITIES
    %% ═══════════════════════════════════════════

    User {
        UUID id PK
        string email UK
        string phone
        string firstName
        string lastName
        UserGender gender
        boolean isActive
        boolean emailVerified
        datetime deletedAt "soft delete"
    }

    %% --- RBAC (Dynamic Role-Based Access Control) ---

    Role {
        UUID id PK
        string name UK "super_admin | receptionist | ..."
        string slug UK
        boolean isDefault
        boolean isSystem "system roles cannot be deleted"
    }

    Permission {
        UUID id PK
        string module "bookings | users | payments | ..."
        string action "view | create | edit | delete"
        string description "English description"
        string descriptionAr "وصف بالعربي — للداشبورد"
    }

    RolePermission {
        UUID id PK
        UUID roleId FK "M:1 → Role"
        UUID permissionId FK "M:1 → Permission"
    }

    UserRole {
        UUID id PK
        UUID userId FK "M:1 → User"
        UUID roleId FK "M:1 → Role"
    }

    Employee {
        UUID id PK
        UUID userId FK UK "1:1 → User"
        UUID specialtyId FK "M:1 → Specialty"
        int priceClinic "بالهللات — سعر العيادة"
        int pricePhone "بالهللات — سعر الهاتف"
        int priceVideo "بالهللات — سعر المرئي"
        float rating "معدل التقييم"
        int reviewCount
        boolean isActive
        datetime deletedAt "soft delete"
    }

    Specialty {
        UUID id PK
        string nameAr
        string nameEn UK
        int sortOrder
        boolean isActive
    }

    ServiceCategory {
        UUID id PK
        string nameAr
        string nameEn
        int sortOrder
        boolean isActive
    }

    Service {
        UUID id PK
        UUID categoryId FK "M:1 → ServiceCategory"
        string nameAr
        string nameEn
        int price "بالهللات — السعر الافتراضي"
        int duration "بالدقائق — المدة الافتراضية (default 30)"
        boolean isActive
        datetime deletedAt "soft delete"
    }

    EmployeeService {
        UUID id PK
        UUID employeeId FK "M:1 → Employee"
        UUID serviceId FK "M:1 → Service"
        int priceClinic "nullable — override"
        int pricePhone "nullable — override"
        int priceVideo "nullable — override"
        int customDuration "nullable — override بالدقائق"
        int bufferBefore "دقائق قبل الموعد (default 0)"
        int bufferAfter "دقائق بعد الموعد (default 0)"
        BookingType[] availableTypes "أنواع الحجز المتاحة"
        boolean isActive
    }

    EmployeeAvailability {
        UUID id PK
        UUID employeeId FK "M:1 → Employee"
        int dayOfWeek "0=أحد ... 6=سبت"
        string startTime "HH:mm"
        string endTime "HH:mm"
        boolean isActive
    }

    EmployeeVacation {
        UUID id PK
        UUID employeeId FK "M:1 → Employee"
        datetime startDate
        datetime endDate
        string reason
    }

    %% ═══════════════════════════════════════════
    %%  BOOKING (المحور الرئيسي)
    %% ═══════════════════════════════════════════

    Booking {
        UUID id PK
        UUID clientId FK "M:1 → User — nullable for onDelete:SetNull only"
        UUID employeeId FK "M:1 → Employee"
        UUID serviceId FK "M:1 → Service"
        UUID employeeServiceId FK "M:1 → EmployeeService"
        UUID rescheduledFromId FK UK "1:1 → Booking (self-ref, nullable)"
        BookingType type "clinic_visit | phone | video"
        datetime date
        string startTime "HH:mm"
        string endTime "HH:mm — snapshot محسوب عند الإنشاء"
        BookingStatus status "pending → confirmed → completed | no_show | cancelled"
        string notes "ملاحظات المريض"
        string zoomMeetingId "video فقط"
        string zoomJoinUrl "رابط المريض"
        string zoomHostUrl "رابط الطبيب"
        string cancellationReason
        string adminNotes
        datetime cancelledAt
        datetime confirmedAt
        datetime completedAt
        datetime createdAt
        datetime updatedAt
        datetime deletedAt "soft delete"
    }

    %% ═══════════════════════════════════════════
    %%  PAYMENT & BILLING
    %% ═══════════════════════════════════════════

    Payment {
        UUID id PK
        UUID bookingId FK UK "1:1 → Booking"
        int amount "بالهللات"
        int vatAmount "ضريبة القيمة المضافة"
        int totalAmount "amount + vatAmount"
        int refundAmount "nullable — مبلغ الاسترداد"
        PaymentMethod method "moyasar | bank_transfer"
        PaymentStatus status "pending | paid | refunded | failed"
        string moyasarPaymentId "معرف مويسر"
        string transactionRef "مرجع التحويل"
        datetime createdAt
        datetime updatedAt
    }

    BankTransferReceipt {
        UUID id PK
        UUID paymentId FK UK "1:1 → Payment"
        string receiptUrl "رابط الصورة في MinIO"
        TransferVerificationStatus aiVerificationStatus "نتيجة AI"
        float aiConfidence "0-1"
        string aiNotes
        int extractedAmount "المبلغ المستخرج بالهللات"
        datetime extractedDate
        UUID reviewedById FK "M:1 → User (admin)"
        datetime reviewedAt
        string adminNotes
        datetime createdAt
    }

    Invoice {
        UUID id PK
        UUID paymentId FK UK "1:1 → Payment"
        string invoiceNumber UK
        string pdfUrl
        datetime sentAt
        int vatAmount
        int vatRate "15 في السعودية"
        string invoiceHash "ZATCA chain"
        string previousHash "ZATCA prev"
        string qrCodeData "ZATCA QR"
        ZatcaStatus zatcaStatus
        json zatcaResponse
        string xmlContent "ZATCA XML"
        datetime createdAt
    }

    %% ═══════════════════════════════════════════
    %%  POST-APPOINTMENT
    %% ═══════════════════════════════════════════

    Rating {
        UUID id PK
        UUID bookingId FK UK "1:1 → Booking"
        UUID clientId FK "M:1 → User (nullable — onDelete:SetNull)"
        UUID employeeId FK "M:1 → Employee"
        int stars "1-5"
        string comment
        datetime createdAt
    }

    ProblemReport {
        UUID id PK
        UUID bookingId FK "M:1 → Booking"
        UUID clientId FK "M:1 → User (nullable — onDelete:SetNull)"
        ProblemReportType type "no_call | late | technical | other"
        string description
        ProblemReportStatus status "open | reviewing | resolved"
        UUID resolvedById FK "M:1 → User (admin)"
        datetime resolvedAt
        datetime createdAt
        datetime updatedAt
    }

    %% ═══════════════════════════════════════════
    %%  AUDIT
    %% ═══════════════════════════════════════════

    ActivityLog {
        UUID id PK
        UUID userId FK "M:1 → User (nullable — onDelete:SetNull)"
        string action "created | updated | deleted | login | approved | rejected"
        string module "bookings | users | payments | ..."
        string resourceId "UUID of affected resource"
        string description
        json oldValues "قيم قبل التغيير"
        json newValues "قيم بعد التغيير"
        string ipAddress
        string userAgent
        datetime createdAt
    }

    %% ═══════════════════════════════════════════
    %%  NOTIFICATIONS
    %% ═══════════════════════════════════════════

    Notification {
        UUID id PK
        UUID userId FK "M:1 → User"
        string titleAr
        string titleEn
        string bodyAr
        string bodyEn
        NotificationType type
        boolean isRead "default false"
        datetime readAt "nullable — متى قرأها"
        json data
        datetime createdAt
    }

    %% ═══════════════════════════════════════════
    %%  RELATIONSHIPS
    %% ═══════════════════════════════════════════

    %% --- RBAC ---
    User ||--o{ UserRole : "has roles"
    Role ||--o{ UserRole : "assigned to users"
    Role ||--o{ RolePermission : "has permissions"
    Permission ||--o{ RolePermission : "granted to roles"

    %% --- User & Employee ---
    User ||--o| Employee : "has profile (optional)"
    Employee }o--|| Specialty : "belongs to"

    %% --- Service & Category ---
    ServiceCategory ||--o{ Service : "categorizes"

    %% --- EmployeeService (M:N with payload) ---
    Employee ||--o{ EmployeeService : "offers services"
    Service ||--o{ EmployeeService : "offered by employees"

    %% --- Employee Schedule ---
    Employee ||--o{ EmployeeAvailability : "has schedule"
    Employee ||--o{ EmployeeVacation : "has vacations"

    %% --- Booking Relations (المحور) ---
    User ||--o{ Booking : "books as client"
    Employee ||--o{ Booking : "receives bookings"
    Service ||--o{ Booking : "booked service"
    EmployeeService ||--o{ Booking : "pricing source"
    Booking ||--o| Booking : "rescheduledFrom (self-ref)"

    %% --- Payment Chain ---
    Booking ||--o| Payment : "has payment"
    Payment ||--o| BankTransferReceipt : "has receipt"
    Payment ||--o| Invoice : "generates invoice"
    User ||--o{ BankTransferReceipt : "admin reviews"

    %% --- Post-Appointment ---
    Booking ||--o| Rating : "has rating"
    Rating }o--|| Employee : "rates employee"
    User ||--o{ Rating : "rates as client"

    Booking ||--o{ ProblemReport : "has problems"
    User ||--o{ ProblemReport : "reports problem"
    User ||--o{ ProblemReport : "admin resolves"

    %% --- Audit & Notifications ---
    User ||--o{ ActivityLog : "performed actions"
    User ||--o{ Notification : "receives notifications"
```

---

> **مخططات التدفق (Lifecycle, Reschedule, Payment):** [booking-flows.md](booking-flows.md)
> **جداول العلاقات والقيود والتسعير:** [booking-constraints.md](booking-constraints.md)
> **مرجع الـ Enums:** [booking-enums.md](booking-enums.md)
