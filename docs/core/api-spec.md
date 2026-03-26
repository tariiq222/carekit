# CareKit API Specification

> Version: 1.0.0
> Base URL: `/api/v1`
> Last Updated: 2026-03-22

---

## Table of Contents

1. [Conventions](#conventions)
2. [Auth Module](#1-auth-module)
3. [Users Module](#2-users-module)
4. [Practitioners Module](#3-practitioners-module)
5. [Specialties Module](#4-specialties-module)
6. [Services Module](#5-services-module)
7. [Bookings Module](#6-bookings-module)
8. [Payments Module](#7-payments-module)
9. [Invoices Module](#8-invoices-module)
10. [Ratings Module](#9-ratings-module)
11. [Problem Reports Module](#10-problem-reports-module)
12. [Chatbot Module](#11-chatbot-module)
13. [Knowledge Base Module](#12-knowledge-base-module)
14. [Notifications Module](#13-notifications-module)
15. [White Label Module](#14-white-label-module)
16. [Reports Module](#15-reports-module)
17. [Activity Logs Module](#16-activity-logs-module)
18. [CASL Permission Matrix](#casl-permission-matrix)
19. [Error Codes](#error-codes)
20. [Rate Limiting](#rate-limiting)
21. [File Upload Specs](#file-upload-specs)
22. [WebSocket Events](#websocket-events)

---

## Conventions

### Authentication Header

```
Authorization: Bearer <jwt_token>
```

### Auth Levels

| Level | Meaning |
|-------|---------|
| `PUBLIC` | No authentication required |
| `JWT` | Any authenticated user |
| `ROLE:<role>` | Specific role required |
| `PERMISSION:<module>:<action>` | CASL permission check |
| `OWNER` | Resource owner (e.g., patient's own booking) |

### Success Response

```json
{
  "success": true,
  "data": { ... },
  "message": "Optional success message"
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error description"
  }
}
```

### Paginated Response

All list endpoints accept: `?page=1&perPage=20&sortBy=createdAt&sortOrder=desc`

```json
{
  "success": true,
  "data": {
    "items": [ ... ],
    "meta": {
      "total": 150,
      "page": 1,
      "perPage": 20,
      "totalPages": 8,
      "hasNextPage": true,
      "hasPreviousPage": false
    }
  }
}
```

### Common Query Parameters

| Param | Type | Description |
|-------|------|-------------|
| `page` | number | Page number (default: 1) |
| `perPage` | number | Items per page (default: 20, max: 100) |
| `sortBy` | string | Field to sort by (default: createdAt) |
| `sortOrder` | string | `asc` or `desc` (default: desc) |
| `search` | string | Full-text search (where applicable) |

### Data Conventions

- All dates: ISO 8601 UTC (`2026-04-01T09:00:00.000Z`)
- All time slots: `HH:mm` format (`"09:00"`, `"14:30"`)
- All money amounts: Integer in halalat (1 SAR = 100 halalat). Display conversion on frontend.
- All IDs: UUID v4

---

## 1. Auth Module

**Base path:** `/api/v1/auth`

### Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/register` | PUBLIC | Register new patient account |
| POST | `/login` | PUBLIC | Login with email + password |
| POST | `/login/otp/send` | PUBLIC | Send OTP code to email |
| POST | `/login/otp/verify` | PUBLIC | Verify OTP and get tokens |
| POST | `/refresh-token` | PUBLIC | Refresh JWT using refresh token |
| POST | `/logout` | JWT | Invalidate refresh token |
| GET | `/me` | JWT | Get current user with roles and permissions |
| POST | `/password/forgot` | PUBLIC | Send password reset OTP |
| POST | `/password/reset` | PUBLIC | Reset password using OTP |
| PATCH | `/password/change` | JWT | Change password (requires current) |
| POST | `/email/verify/send` | JWT | Send email verification OTP |
| POST | `/email/verify` | JWT | Verify email with OTP |

### `POST /register`

Register a new patient account. Automatically assigns the `patient` role.

**Request:**
```json
{
  "email": "patient@example.com",
  "password": "StrongP@ss1",
  "firstName": "Ahmed",
  "lastName": "Al-Rashid",
  "phone": "+966501234567",
  "gender": "male"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "patient@example.com",
      "firstName": "Ahmed",
      "lastName": "Al-Rashid",
      "phone": "+966501234567",
      "gender": "male",
      "isActive": true,
      "emailVerified": false,
      "createdAt": "2026-04-01T09:00:00.000Z"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 900
  },
  "message": "Registration successful"
}
```

### `POST /login`

**Request:**
```json
{
  "email": "patient@example.com",
  "password": "StrongP@ss1"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "patient@example.com",
      "firstName": "Ahmed",
      "lastName": "Al-Rashid",
      "roles": ["patient"],
      "permissions": ["bookings:view", "bookings:create", "ratings:view", "ratings:create", "ratings:edit"]
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 900
  }
}
```

### `POST /login/otp/send`

**Request:**
```json
{
  "email": "patient@example.com"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "OTP sent to patient@example.com"
}
```

### `POST /login/otp/verify`

**Request:**
```json
{
  "email": "patient@example.com",
  "code": "123456"
}
```

**Response (200):** Same as `/login` response.

### `POST /refresh-token`

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 900
  }
}
```

### `POST /logout`

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### `GET /me`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "patient@example.com",
    "firstName": "Ahmed",
    "lastName": "Al-Rashid",
    "phone": "+966501234567",
    "gender": "male",
    "avatarUrl": null,
    "isActive": true,
    "emailVerified": true,
    "roles": [
      {
        "id": "uuid",
        "name": "Patient",
        "slug": "patient"
      }
    ],
    "permissions": ["bookings:view", "bookings:create", "ratings:view", "ratings:create", "ratings:edit"],
    "createdAt": "2026-04-01T09:00:00.000Z"
  }
}
```

### `POST /password/forgot`

**Request:**
```json
{
  "email": "patient@example.com"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password reset OTP sent"
}
```

### `POST /password/reset`

**Request:**
```json
{
  "email": "patient@example.com",
  "code": "123456",
  "newPassword": "NewStr0ngP@ss"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password reset successful"
}
```

### `PATCH /password/change`

**Request:**
```json
{
  "currentPassword": "OldP@ss1",
  "newPassword": "NewStr0ngP@ss"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

### `POST /email/verify/send`

**Response (200):**
```json
{
  "success": true,
  "message": "Verification OTP sent"
}
```

### `POST /email/verify`

**Request:**
```json
{
  "code": "123456"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Email verified successfully"
}
```

---

## 2. Users Module

**Base path:** `/api/v1/users`

### Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | PERMISSION:users:view | List users (paginated) |
| GET | `/:id` | PERMISSION:users:view | Get user by ID |
| POST | `/` | PERMISSION:users:create | Create user (staff/practitioner) |
| PATCH | `/:id` | PERMISSION:users:edit | Update user |
| DELETE | `/:id` | PERMISSION:users:delete | Soft delete user |
| PATCH | `/:id/activate` | PERMISSION:users:edit | Activate user |
| PATCH | `/:id/deactivate` | PERMISSION:users:edit | Deactivate user |
| POST | `/:id/roles` | PERMISSION:roles:edit | Assign role to user |
| DELETE | `/:id/roles/:roleId` | PERMISSION:roles:edit | Remove role from user |

### Query Parameters for `GET /`

| Param | Type | Description |
|-------|------|-------------|
| `role` | string | Filter by role slug |
| `isActive` | boolean | Filter by active status |
| `search` | string | Search by name or email |

### `POST /` (Create User)

Admin creates staff or practitioner accounts. Password is set by admin, user can change later.

**Request:**
```json
{
  "email": "doctor@clinic.com",
  "password": "TempP@ss1",
  "firstName": "Khalid",
  "lastName": "Al-Fahad",
  "phone": "+966509876543",
  "gender": "male",
  "roleSlug": "practitioner"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "doctor@clinic.com",
    "firstName": "Khalid",
    "lastName": "Al-Fahad",
    "roles": ["practitioner"],
    "isActive": true,
    "createdAt": "2026-04-01T09:00:00.000Z"
  },
  "message": "User created successfully"
}
```

### `POST /:id/roles` (Assign Role)

**Request:**
```json
{
  "roleId": "uuid"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Role assigned successfully"
}
```

---

## 3. Practitioners Module

**Base path:** `/api/v1/practitioners`

### Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | PUBLIC | List practitioners (paginated) |
| GET | `/:id` | PUBLIC | Get practitioner profile |
| POST | `/` | PERMISSION:practitioners:create | Create practitioner profile |
| PATCH | `/:id` | PERMISSION:practitioners:edit or OWNER | Update practitioner |
| DELETE | `/:id` | PERMISSION:practitioners:delete | Soft delete |
| GET | `/:id/availability` | PUBLIC | Get availability schedule |
| PUT | `/:id/availability` | PERMISSION:practitioners:edit or OWNER | Set availability |
| GET | `/:id/slots` | PUBLIC | Get available slots for a date |
| POST | `/:id/vacations` | PERMISSION:practitioners:edit or OWNER | Add vacation |
| GET | `/:id/vacations` | PERMISSION:practitioners:view or OWNER | List vacations |
| DELETE | `/:id/vacations/:vacationId` | PERMISSION:practitioners:edit or OWNER | Remove vacation |
| GET | `/:id/ratings` | PUBLIC | List practitioner ratings |

### Query Parameters for `GET /`

| Param | Type | Description |
|-------|------|-------------|
| `specialtyId` | string | Filter by specialty |
| `minRating` | number | Minimum rating filter |
| `isActive` | boolean | Filter by active status |
| `search` | string | Search by name |

### `POST /` (Create Practitioner)

Links a practitioner profile to an existing user account.

**Request:**
```json
{
  "userId": "uuid",
  "specialtyId": "uuid",
  "bio": "Board-certified cardiologist with 15 years experience",
  "bioAr": "طبيب قلب معتمد بخبرة 15 عاما",
  "experience": 15,
  "education": "MBBS, MD Cardiology - King Saud University",
  "educationAr": "بكالوريوس طب وجراحة، ماجستير أمراض القلب - جامعة الملك سعود",
  "priceClinic": 30000,
  "pricePhone": 20000,
  "priceVideo": 25000
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "user": {
      "id": "uuid",
      "firstName": "Khalid",
      "lastName": "Al-Fahad",
      "email": "doctor@clinic.com"
    },
    "specialty": {
      "id": "uuid",
      "nameEn": "Cardiology",
      "nameAr": "أمراض القلب"
    },
    "bio": "Board-certified cardiologist with 15 years experience",
    "bioAr": "طبيب قلب معتمد بخبرة 15 عاما",
    "experience": 15,
    "priceClinic": 30000,
    "pricePhone": 20000,
    "priceVideo": 25000,
    "rating": 0,
    "reviewCount": 0,
    "isActive": true
  }
}
```

### `PUT /:id/availability` (Set Availability)

Replaces the full availability schedule.

**Request:**
```json
{
  "schedule": [
    { "dayOfWeek": 0, "startTime": "09:00", "endTime": "13:00", "isActive": true },
    { "dayOfWeek": 0, "startTime": "16:00", "endTime": "20:00", "isActive": true },
    { "dayOfWeek": 1, "startTime": "09:00", "endTime": "17:00", "isActive": true },
    { "dayOfWeek": 5, "startTime": "09:00", "endTime": "12:00", "isActive": false }
  ]
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "schedule": [ ... ]
  },
  "message": "Availability updated"
}
```

### `GET /:id/slots?date=2026-04-01&duration=30`

Returns available time slots for a specific date, accounting for existing bookings and vacations.

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `date` | string | Yes | Date in YYYY-MM-DD |
| `duration` | number | No | Slot duration in minutes (default: 30) |

**Response (200):**
```json
{
  "success": true,
  "data": {
    "date": "2026-04-01",
    "practitionerId": "uuid",
    "slots": [
      { "startTime": "09:00", "endTime": "09:30", "available": true },
      { "startTime": "09:30", "endTime": "10:00", "available": true },
      { "startTime": "10:00", "endTime": "10:30", "available": false },
      { "startTime": "10:30", "endTime": "11:00", "available": true }
    ]
  }
}
```

### `POST /:id/vacations`

**Request:**
```json
{
  "startDate": "2026-05-01T00:00:00.000Z",
  "endDate": "2026-05-07T23:59:59.000Z",
  "reason": "Annual leave"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "startDate": "2026-05-01T00:00:00.000Z",
    "endDate": "2026-05-07T23:59:59.000Z",
    "reason": "Annual leave"
  }
}
```

---

## 4. Specialties Module

**Base path:** `/api/v1/specialties`

### Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | PUBLIC | List all specialties |
| GET | `/:id` | PUBLIC | Get specialty by ID |
| POST | `/` | PERMISSION:practitioners:create | Create specialty |
| PATCH | `/:id` | PERMISSION:practitioners:edit | Update specialty |
| DELETE | `/:id` | PERMISSION:practitioners:delete | Delete specialty |

### `POST /` (Create Specialty)

**Request:**
```json
{
  "nameEn": "Neurology",
  "nameAr": "طب الأعصاب",
  "descriptionEn": "Diagnosis and treatment of nervous system disorders",
  "descriptionAr": "تشخيص وعلاج اضطرابات الجهاز العصبي",
  "iconUrl": "https://cdn.example.com/icons/neurology.svg",
  "sortOrder": 9
}
```

---

## 5. Services Module

**Base path:** `/api/v1/services`

### Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | PUBLIC | List services (filterable) |
| GET | `/:id` | PUBLIC | Get service by ID |
| POST | `/` | PERMISSION:services:create | Create service |
| PATCH | `/:id` | PERMISSION:services:edit | Update service |
| DELETE | `/:id` | PERMISSION:services:delete | Soft delete service |
| GET | `/categories` | PUBLIC | List service categories |
| POST | `/categories` | PERMISSION:services:create | Create category |
| PATCH | `/categories/:id` | PERMISSION:services:edit | Update category |
| DELETE | `/categories/:id` | PERMISSION:services:delete | Delete category |

### Query Parameters for `GET /`

| Param | Type | Description |
|-------|------|-------------|
| `categoryId` | string | Filter by category |
| `isActive` | boolean | Filter by active status |
| `search` | string | Search by name |

### `POST /` (Create Service)

**Request:**
```json
{
  "nameEn": "General Consultation",
  "nameAr": "استشارة عامة",
  "descriptionEn": "General medical consultation",
  "descriptionAr": "استشارة طبية عامة",
  "categoryId": "uuid",
  "price": 15000,
  "duration": 30
}
```

---

## 6. Bookings Module

**Base path:** `/api/v1/bookings`

### Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | PERMISSION:bookings:view | List bookings (paginated) |
| GET | `/:id` | PERMISSION:bookings:view or OWNER | Get booking details |
| POST | `/` | PERMISSION:bookings:create or ROLE:patient | Create booking |
| PATCH | `/:id` | PERMISSION:bookings:edit | Update booking (reschedule) |
| POST | `/:id/confirm` | PERMISSION:bookings:edit | Confirm booking |
| POST | `/:id/complete` | PERMISSION:bookings:edit | Mark as completed |
| POST | `/:id/cancel-request` | OWNER | Patient requests cancellation |
| POST | `/:id/cancel/approve` | PERMISSION:bookings:edit | Approve cancellation |
| POST | `/:id/cancel/reject` | PERMISSION:bookings:edit | Reject cancellation |
| GET | `/my` | JWT (patient) | Patient's own bookings |
| GET | `/today` | JWT (practitioner) | Today's bookings for practitioner |

### Query Parameters for `GET /`

| Param | Type | Description |
|-------|------|-------------|
| `status` | string | Filter by status |
| `type` | string | Filter by booking type |
| `practitionerId` | string | Filter by practitioner |
| `patientId` | string | Filter by patient |
| `dateFrom` | string | Start date (YYYY-MM-DD) |
| `dateTo` | string | End date (YYYY-MM-DD) |

### `POST /` (Create Booking)

Creates a booking with double-booking protection. For `video_consultation`, auto-generates a Zoom meeting link. Requires prepayment (payment must be created separately via `/api/v1/payments`).

**Request:**
```json
{
  "practitionerId": "uuid",
  "serviceId": "uuid",
  "type": "video_consultation",
  "date": "2026-04-01",
  "startTime": "09:00",
  "notes": "Follow-up consultation"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "patient": {
      "id": "uuid",
      "firstName": "Ahmed",
      "lastName": "Al-Rashid"
    },
    "practitioner": {
      "id": "uuid",
      "user": { "firstName": "Khalid", "lastName": "Al-Fahad" },
      "specialty": { "nameEn": "Cardiology", "nameAr": "أمراض القلب" }
    },
    "service": {
      "id": "uuid",
      "nameEn": "General Consultation",
      "price": 15000
    },
    "type": "video_consultation",
    "date": "2026-04-01T00:00:00.000Z",
    "startTime": "09:00",
    "endTime": "09:30",
    "status": "pending",
    "zoomJoinUrl": "https://zoom.us/j/123456789",
    "zoomHostUrl": "https://zoom.us/s/123456789",
    "createdAt": "2026-03-30T14:00:00.000Z"
  }
}
```

**Error (409 - Conflict):**
```json
{
  "success": false,
  "error": {
    "code": "BOOKING_CONFLICT",
    "message": "Practitioner already has a booking at this time"
  }
}
```

### `POST /:id/cancel-request`

Patient requests cancellation. Status changes to `pending_cancellation`.

**Request:**
```json
{
  "reason": "Schedule conflict"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "pending_cancellation",
    "cancellationReason": "Schedule conflict"
  },
  "message": "Cancellation request submitted"
}
```

### `POST /:id/cancel/approve`

Admin approves cancellation with refund decision.

**Request:**
```json
{
  "refundType": "full",
  "adminNotes": "Approved per clinic policy"
}
```

`refundType`: `"full"` | `"partial"` | `"none"`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "cancelled",
    "cancelledAt": "2026-04-01T10:00:00.000Z"
  },
  "message": "Cancellation approved"
}
```

### `PATCH /:id` (Reschedule)

**Request:**
```json
{
  "date": "2026-04-02",
  "startTime": "10:00"
}
```

---

## 7. Payments Module

**Base path:** `/api/v1/payments`

### Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | PERMISSION:payments:view | List payments (paginated) |
| GET | `/:id` | PERMISSION:payments:view or OWNER | Get payment details |
| POST | `/moyasar` | JWT | Create Moyasar payment |
| POST | `/moyasar/webhook` | PUBLIC (signature verified) | Moyasar webhook |
| POST | `/bank-transfer` | JWT | Upload bank transfer receipt |
| POST | `/bank-transfer/:id/verify` | PERMISSION:payments:edit | Admin verify transfer |
| POST | `/:id/refund` | PERMISSION:payments:edit | Process refund |
| GET | `/my` | JWT | Current user's payments |

### Query Parameters for `GET /`

| Param | Type | Description |
|-------|------|-------------|
| `status` | string | Filter by status |
| `method` | string | Filter by method |
| `dateFrom` | string | Start date |
| `dateTo` | string | End date |
| `bookingId` | string | Filter by booking |

### `POST /moyasar` (Create Moyasar Payment)

**Request:**
```json
{
  "bookingId": "uuid",
  "source": {
    "type": "creditcard",
    "number": "4111111111111111",
    "name": "Ahmed Al-Rashid",
    "cvc": "123",
    "month": "12",
    "year": "2028"
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "bookingId": "uuid",
    "amount": 15000,
    "vatAmount": 2250,
    "totalAmount": 17250,
    "method": "moyasar",
    "status": "pending",
    "moyasarPaymentId": "moy_123456",
    "redirectUrl": "https://api.moyasar.com/v1/payments/moy_123456/redirect"
  }
}
```

### `POST /moyasar/webhook`

Moyasar sends payment status updates. Verified via HMAC signature in `X-Moyasar-Signature` header.

**Webhook Payload (from Moyasar):**
```json
{
  "id": "moy_123456",
  "status": "paid",
  "amount": 17250,
  "currency": "SAR",
  "description": "Booking #uuid",
  "metadata": {
    "bookingId": "uuid",
    "paymentId": "uuid"
  }
}
```

**Response (200):**
```json
{
  "success": true
}
```

### `POST /bank-transfer` (Upload Receipt)

Multipart form data upload. Receipt image is stored in MinIO. AI verification runs asynchronously.

**Request:** `Content-Type: multipart/form-data`

| Field | Type | Description |
|-------|------|-------------|
| `bookingId` | string | Booking UUID |
| `receipt` | file | Receipt image (JPEG/PNG, max 5MB) |

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "bookingId": "uuid",
    "amount": 17250,
    "vatAmount": 2250,
    "totalAmount": 17250,
    "method": "bank_transfer",
    "status": "pending",
    "receipt": {
      "id": "uuid",
      "receiptUrl": "https://minio.example.com/carekit/receipts/uuid.jpg",
      "aiVerificationStatus": "pending"
    }
  },
  "message": "Receipt uploaded. AI verification in progress."
}
```

### `POST /bank-transfer/:id/verify` (Admin Verify)

Admin reviews AI verification result and makes final decision.

**Request:**
```json
{
  "action": "approve",
  "adminNotes": "Amount matches, receipt verified"
}
```

`action`: `"approve"` | `"reject"`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "paid",
    "receipt": {
      "aiVerificationStatus": "approved",
      "reviewedAt": "2026-04-01T10:30:00.000Z"
    }
  },
  "message": "Bank transfer approved"
}
```

### `POST /:id/refund`

**Request:**
```json
{
  "amount": 17250,
  "reason": "Booking cancelled by patient"
}
```

`amount`: Partial or full refund amount in halalat. Omit for full refund.

---

## 8. Invoices Module

**Base path:** `/api/v1/invoices`

### Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | PERMISSION:invoices:view | List invoices (paginated) |
| GET | `/:id` | PERMISSION:invoices:view or OWNER | Get invoice details |
| GET | `/:id/pdf` | PERMISSION:invoices:view or OWNER | Download invoice PDF |
| POST | `/:id/resend` | PERMISSION:invoices:edit | Resend invoice email |

### Invoice Detail Response

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "invoiceNumber": "INV-2026-00001",
    "payment": {
      "id": "uuid",
      "amount": 15000,
      "vatAmount": 2250,
      "totalAmount": 17250,
      "method": "moyasar",
      "status": "paid"
    },
    "booking": {
      "id": "uuid",
      "patient": { "firstName": "Ahmed", "lastName": "Al-Rashid" },
      "practitioner": { "user": { "firstName": "Khalid", "lastName": "Al-Fahad" } },
      "service": { "nameEn": "General Consultation" },
      "date": "2026-04-01T00:00:00.000Z"
    },
    "pdfUrl": "https://minio.example.com/carekit/invoices/INV-2026-00001.pdf",
    "sentAt": "2026-04-01T09:30:00.000Z",
    "createdAt": "2026-04-01T09:30:00.000Z"
  }
}
```

---

## 9. Ratings Module

**Base path:** `/api/v1/ratings`

### Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | PERMISSION:ratings:view | List all ratings (paginated) |
| POST | `/` | JWT (patient, OWNER of booking) | Create rating for completed booking |
| GET | `/:id` | PERMISSION:ratings:view | Get rating by ID |

### `POST /` (Create Rating)

Only allowed for completed bookings. One rating per booking.

**Request:**
```json
{
  "bookingId": "uuid",
  "stars": 5,
  "comment": "Excellent doctor, very professional"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "bookingId": "uuid",
    "stars": 5,
    "comment": "Excellent doctor, very professional",
    "practitioner": {
      "id": "uuid",
      "rating": 4.8,
      "reviewCount": 25
    },
    "createdAt": "2026-04-01T11:00:00.000Z"
  }
}
```

---

## 10. Problem Reports Module

**Base path:** `/api/v1/problem-reports`

### Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | PERMISSION:ratings:view | List reports (paginated) |
| POST | `/` | JWT (patient, OWNER of booking) | Create problem report |
| PATCH | `/:id` | PERMISSION:ratings:edit | Update status |

### Query Parameters for `GET /`

| Param | Type | Description |
|-------|------|-------------|
| `status` | string | Filter: `open`, `reviewing`, `resolved` |
| `type` | string | Filter: `no_call`, `late`, `technical`, `other` |

### `POST /` (Create Problem Report)

Triggers instant notification to admin.

**Request:**
```json
{
  "bookingId": "uuid",
  "type": "no_call",
  "description": "Doctor did not call at the scheduled time"
}
```

### `PATCH /:id` (Update Status)

**Request:**
```json
{
  "status": "resolved",
  "resolvedById": "uuid"
}
```

---

## 11. Chatbot Module

**Base path:** `/api/v1/chatbot`

### Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/message` | JWT | Send message to chatbot |
| GET | `/sessions` | JWT | List user's chat sessions |
| GET | `/sessions/:id` | JWT (OWNER) | Get session with messages |
| GET | `/sessions/:id/messages` | JWT (OWNER) | Get messages (paginated) |

### `POST /message`

Sends a message to the AI chatbot. Response streams via SSE (Server-Sent Events) or returns complete response.

**Request:**
```json
{
  "sessionId": "uuid or null",
  "message": "I want to book an appointment with a cardiologist"
}
```

If `sessionId` is null, a new session is created.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "sessionId": "uuid",
    "message": {
      "id": "uuid",
      "role": "assistant",
      "content": "I can help you book an appointment with a cardiologist. We have Dr. Khalid Al-Fahad available. Would you like to see his available time slots?",
      "functionCall": null,
      "createdAt": "2026-04-01T12:00:00.000Z"
    }
  }
}
```

When the chatbot executes a function (e.g., booking):

```json
{
  "success": true,
  "data": {
    "sessionId": "uuid",
    "message": {
      "id": "uuid",
      "role": "assistant",
      "content": "I've found the following available slots for Dr. Khalid on April 2nd:",
      "functionCall": {
        "name": "getAvailableSlots",
        "arguments": { "practitionerId": "uuid", "date": "2026-04-02" },
        "result": {
          "slots": [
            { "startTime": "09:00", "endTime": "09:30", "available": true },
            { "startTime": "10:00", "endTime": "10:30", "available": true }
          ]
        }
      }
    }
  }
}
```

### Chatbot Capabilities

The chatbot can:
- **Book appointment** — creates booking via internal API
- **Modify appointment time** — reschedules booking
- **View upcoming appointments** — queries user's bookings
- **Request cancellation** — submits cancellation request (does NOT execute directly)
- **Answer FAQ** — queries knowledge base via pgvector similarity search
- **Handoff** — transfers to live chat or shows contact number

---

## 12. Knowledge Base Module

**Base path:** `/api/v1/knowledge-base`

### Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | PERMISSION:chatbot:view | List entries (paginated) |
| POST | `/` | PERMISSION:chatbot:create | Create entry |
| PATCH | `/:id` | PERMISSION:chatbot:edit | Update entry |
| DELETE | `/:id` | PERMISSION:chatbot:delete | Delete entry |

### `POST /` (Create Entry)

Embedding vector is auto-generated from `title` + `content` via OpenRouter.

**Request:**
```json
{
  "title": "Working Hours",
  "content": "Our clinic is open Sunday through Thursday from 8:00 AM to 10:00 PM. We are closed on Fridays and Saturdays.",
  "category": "faq"
}
```

---

## 13. Notifications Module

**Base path:** `/api/v1/notifications`

### Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | JWT | List user's notifications (paginated) |
| GET | `/unread-count` | JWT | Get unread count |
| PATCH | `/:id/read` | JWT (OWNER) | Mark as read |
| PATCH | `/read-all` | JWT | Mark all as read |
| POST | `/fcm-token` | JWT | Register FCM token |
| DELETE | `/fcm-token` | JWT | Unregister FCM token |

### Notification Response

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "titleAr": "تم تأكيد الحجز",
        "titleEn": "Booking Confirmed",
        "bodyAr": "تم تأكيد حجزك مع د. خالد الفهد في 1 أبريل 2026",
        "bodyEn": "Your booking with Dr. Khalid Al-Fahad on April 1, 2026 has been confirmed",
        "type": "booking_confirmed",
        "isRead": false,
        "data": { "bookingId": "uuid" },
        "createdAt": "2026-03-30T14:00:00.000Z"
      }
    ],
    "meta": { ... }
  }
}
```

### `POST /fcm-token`

**Request:**
```json
{
  "token": "fcm-device-token-string",
  "platform": "ios"
}
```

---

## 14. White Label Module

**Base path:** `/api/v1/whitelabel`

### Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/config` | PUBLIC | Get all public config |
| GET | `/config/:key` | PUBLIC | Get specific config value |
| PUT | `/config` | PERMISSION:whitelabel:edit | Bulk update config |
| PUT | `/config/:key` | PERMISSION:whitelabel:edit | Update single config |
| POST | `/config/upload` | PERMISSION:whitelabel:edit | Upload file (logo) |

### `GET /config` (Public Config)

Returns non-sensitive configuration values for branding and content.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "appName": "CareKit Clinic",
    "logo": "https://minio.example.com/carekit/logo.png",
    "primaryColor": "#2563EB",
    "secondaryColor": "#1E40AF",
    "font": "Inter",
    "phone": "+966112345678",
    "email": "info@clinic.com",
    "address": "Riyadh, Saudi Arabia",
    "socialMedia": { "twitter": "@clinic", "instagram": "@clinic" },
    "cancellationPolicyAr": "...",
    "cancellationPolicyEn": "...",
    "aboutAr": "...",
    "aboutEn": "...",
    "defaultLanguage": "ar",
    "timezone": "Asia/Riyadh"
  }
}
```

Sensitive keys (API keys, secrets) are excluded from the public response.

### `PUT /config` (Bulk Update)

**Request:**
```json
{
  "configs": [
    { "key": "primaryColor", "value": "#10B981" },
    { "key": "appName", "value": "My Clinic" },
    { "key": "cancellationPolicyEn", "value": "Cancellations must be made 24 hours in advance." }
  ]
}
```

### `POST /config/upload`

Multipart form data. Uploads file to MinIO and updates the config value with the file URL.

**Request:** `Content-Type: multipart/form-data`

| Field | Type | Description |
|-------|------|-------------|
| `key` | string | Config key (e.g., `logo`) |
| `file` | file | File to upload (PNG/SVG, max 2MB for logo) |

---

## 15. Reports Module

**Base path:** `/api/v1/reports`

### Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/revenue` | PERMISSION:reports:view | Revenue report |
| GET | `/bookings` | PERMISSION:reports:view | Booking statistics |
| GET | `/ratings` | PERMISSION:reports:view | Ratings report |
| GET | `/practitioners` | PERMISSION:reports:view | Practitioner performance |
| GET | `/dashboard` | PERMISSION:reports:view | Dashboard summary |
| GET | `/export/:type` | PERMISSION:reports:view | Export report |

### Common Query Parameters

| Param | Type | Description |
|-------|------|-------------|
| `dateFrom` | string | Start date (YYYY-MM-DD) |
| `dateTo` | string | End date (YYYY-MM-DD) |
| `practitionerId` | string | Filter by practitioner |

### `GET /revenue`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalRevenue": 5000000,
      "totalBookings": 150,
      "averageBookingValue": 33333,
      "totalRefunds": 250000,
      "netRevenue": 4750000
    },
    "byMethod": {
      "moyasar": 4000000,
      "bank_transfer": 1000000
    },
    "byDay": [
      { "date": "2026-04-01", "revenue": 250000, "bookings": 8 },
      { "date": "2026-04-02", "revenue": 300000, "bookings": 10 }
    ]
  }
}
```

### `GET /dashboard`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "today": {
      "bookings": 12,
      "completedBookings": 8,
      "cancelledBookings": 1,
      "revenue": 360000,
      "newPatients": 3
    },
    "thisMonth": {
      "totalBookings": 150,
      "totalRevenue": 5000000,
      "averageRating": 4.6,
      "pendingCancellations": 2,
      "pendingBankTransfers": 5
    },
    "recentBookings": [ ... ],
    "recentProblemReports": [ ... ]
  }
}
```

### `GET /export/:type`

| Param | Values | Description |
|-------|--------|-------------|
| `type` | `revenue`, `bookings`, `ratings` | Report type to export |
| `format` | `excel`, `pdf` | Export format (query param) |

Returns file download (`Content-Type: application/pdf` or `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`).

---

## 16. Activity Logs Module

**Base path:** `/api/v1/activity-logs`

### Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | PERMISSION:users:view | List activity logs (paginated) |

### Query Parameters

| Param | Type | Description |
|-------|------|-------------|
| `userId` | string | Filter by user |
| `action` | string | Filter: `created`, `updated`, `deleted`, `login`, `logout`, `approved`, `rejected` |
| `module` | string | Filter by module |
| `dateFrom` | string | Start date |
| `dateTo` | string | End date |

### Activity Log Response

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "user": { "id": "uuid", "firstName": "Admin", "lastName": "User" },
        "action": "approved",
        "module": "payments",
        "resourceId": "uuid",
        "description": "Approved bank transfer for booking #uuid",
        "oldValues": { "status": "pending" },
        "newValues": { "status": "paid" },
        "ipAddress": "192.168.1.1",
        "createdAt": "2026-04-01T10:30:00.000Z"
      }
    ],
    "meta": { ... }
  }
}
```

---

## CASL Permission Matrix

Full permission matrix showing default role assignments:

| Module | Action | super_admin | receptionist | accountant | practitioner | patient |
|--------|--------|:-----------:|:------------:|:----------:|:------------:|:-------:|
| users | view | x | | | | |
| users | create | x | | | | |
| users | edit | x | | | | |
| users | delete | x | | | | |
| roles | view | x | | | | |
| roles | create | x | | | | |
| roles | edit | x | | | | |
| roles | delete | x | | | | |
| practitioners | view | x | x | | own | x |
| practitioners | create | x | x | | | |
| practitioners | edit | x | x | | own | |
| practitioners | delete | x | | | | |
| bookings | view | x | x | x | own | own |
| bookings | create | x | x | | | x |
| bookings | edit | x | x | | | |
| bookings | delete | x | | | | |
| services | view | x | x | | | x |
| services | create | x | x | | | |
| services | edit | x | x | | | |
| services | delete | x | | | | |
| payments | view | x | x | x | | x |
| payments | create | x | | x | | |
| payments | edit | x | | x | | |
| payments | delete | x | | | | |
| invoices | view | x | x | x | | x |
| invoices | create | x | | x | | |
| invoices | edit | x | | x | | |
| invoices | delete | x | | | | |
| reports | view | x | | x | | |
| reports | create | x | | x | | |
| reports | edit | x | | x | | |
| reports | delete | x | | | | |
| notifications | view | x | x | | | |
| notifications | create | x | x | | | |
| notifications | edit | x | x | | | |
| notifications | delete | x | | | | |
| chatbot | view | x | | | | |
| chatbot | create | x | | | | |
| chatbot | edit | x | | | | |
| chatbot | delete | x | | | | |
| whitelabel | view | x | | | | |
| whitelabel | create | x | | | | |
| whitelabel | edit | x | | | | |
| whitelabel | delete | x | | | | |
| patients | view | x | x | | own | |
| patients | create | x | x | | | |
| patients | edit | x | x | | | |
| patients | delete | x | | | | |
| ratings | view | x | | | own | x |
| ratings | create | x | | | | x |
| ratings | edit | x | | | | x |
| ratings | delete | x | | | | |

**Notes:**
- `x` = has permission
- `own` = has permission only for own resources (enforced by CASL conditions)
- `super_admin` has ALL 52 permissions
- Custom roles can be created from the dashboard with any combination of these permissions

---

## Error Codes

Standard error codes returned in the `error.code` field:

### Authentication Errors

| Code | HTTP | Description |
|------|------|-------------|
| `AUTH_INVALID_CREDENTIALS` | 401 | Wrong email or password |
| `AUTH_TOKEN_EXPIRED` | 401 | JWT access token has expired |
| `AUTH_TOKEN_INVALID` | 401 | JWT is malformed or tampered |
| `AUTH_REFRESH_TOKEN_EXPIRED` | 401 | Refresh token has expired |
| `AUTH_REFRESH_TOKEN_INVALID` | 401 | Refresh token not found or revoked |
| `AUTH_EMAIL_NOT_VERIFIED` | 403 | Email not yet verified |
| `AUTH_ACCOUNT_DEACTIVATED` | 403 | User account is deactivated |
| `AUTH_OTP_INVALID` | 400 | OTP code is wrong |
| `AUTH_OTP_EXPIRED` | 400 | OTP code has expired |

### Authorization Errors

| Code | HTTP | Description |
|------|------|-------------|
| `FORBIDDEN` | 403 | User lacks the required permission |
| `ROLE_REQUIRED` | 403 | Specific role is required for this action |

### Validation Errors

| Code | HTTP | Description |
|------|------|-------------|
| `VALIDATION_ERROR` | 400 | Request body validation failed (includes field-level errors) |
| `INVALID_UUID` | 400 | Provided ID is not a valid UUID |

### Resource Errors

| Code | HTTP | Description |
|------|------|-------------|
| `USER_NOT_FOUND` | 404 | User not found |
| `PRACTITIONER_NOT_FOUND` | 404 | Practitioner not found |
| `SPECIALTY_NOT_FOUND` | 404 | Specialty not found |
| `SERVICE_NOT_FOUND` | 404 | Service not found |
| `BOOKING_NOT_FOUND` | 404 | Booking not found |
| `PAYMENT_NOT_FOUND` | 404 | Payment not found |
| `INVOICE_NOT_FOUND` | 404 | Invoice not found |
| `NOTIFICATION_NOT_FOUND` | 404 | Notification not found |
| `CHAT_SESSION_NOT_FOUND` | 404 | Chat session not found |
| `KNOWLEDGE_BASE_NOT_FOUND` | 404 | Knowledge base entry not found |

### Business Logic Errors

| Code | HTTP | Description |
|------|------|-------------|
| `BOOKING_CONFLICT` | 409 | Time slot already booked for this practitioner |
| `BOOKING_PAST_DATE` | 400 | Cannot book in the past |
| `BOOKING_OUTSIDE_HOURS` | 400 | Time slot outside practitioner working hours |
| `BOOKING_PRACTITIONER_ON_VACATION` | 400 | Practitioner on vacation for this date |
| `BOOKING_ALREADY_CANCELLED` | 400 | Booking is already cancelled |
| `BOOKING_ALREADY_COMPLETED` | 400 | Booking is already completed |
| `BOOKING_INVALID_STATUS_TRANSITION` | 400 | Invalid status transition |
| `BOOKING_CANCEL_NOT_PENDING` | 400 | Cancellation already decided |
| `PAYMENT_ALREADY_PAID` | 400 | Booking already has a paid payment |
| `PAYMENT_FAILED` | 400 | Payment processing failed |
| `PAYMENT_REFUND_EXCEEDS_AMOUNT` | 400 | Refund amount exceeds original payment |
| `RATING_ALREADY_EXISTS` | 409 | Rating already submitted for this booking |
| `RATING_BOOKING_NOT_COMPLETED` | 400 | Can only rate completed bookings |
| `SPECIALTY_HAS_PRACTITIONERS` | 400 | Cannot delete specialty with active practitioners |
| `SERVICE_HAS_BOOKINGS` | 400 | Cannot delete service with active bookings |
| `USER_EMAIL_EXISTS` | 409 | Email already registered |
| `USER_HAS_ACTIVE_BOOKINGS` | 400 | Cannot delete user with active bookings |
| `FILE_TOO_LARGE` | 413 | Upload exceeds max file size |
| `FILE_INVALID_TYPE` | 400 | Upload file type not allowed |

### Server Errors

| Code | HTTP | Description |
|------|------|-------------|
| `INTERNAL_ERROR` | 500 | Unexpected server error |
| `ZOOM_API_ERROR` | 502 | Failed to create Zoom meeting |
| `MOYASAR_API_ERROR` | 502 | Failed to process payment via Moyasar |
| `OPENROUTER_API_ERROR` | 502 | AI chatbot service unavailable |
| `MINIO_UPLOAD_ERROR` | 502 | Failed to upload file to storage |
| `EMAIL_SEND_ERROR` | 502 | Failed to send email |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |

### Validation Error Detail Format

When `code` is `VALIDATION_ERROR`, the error includes field-level details:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      { "field": "email", "message": "Invalid email format" },
      { "field": "password", "message": "Password must be at least 8 characters" },
      { "field": "firstName", "message": "First name is required" }
    ]
  }
}
```

---

## Rate Limiting

Rate limits are enforced per IP address for public endpoints and per user for authenticated endpoints.

| Endpoint Group | Limit | Window |
|----------------|-------|--------|
| Auth endpoints (`/auth/*`) | 5 requests | per minute |
| OTP send (`/auth/login/otp/send`, `/auth/password/forgot`) | 3 requests | per minute |
| General API (authenticated) | 100 requests | per minute |
| File uploads (`*/upload`, `/bank-transfer`) | 10 requests | per minute |
| Chatbot (`/chatbot/message`) | 20 requests | per minute |
| Webhook endpoints | No limit | - |

### Rate Limit Response Headers

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1680000000
```

### Rate Limit Exceeded Response (429)

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again in 45 seconds.",
    "retryAfter": 45
  }
}
```

---

## File Upload Specs

### Receipt Images (Bank Transfer)

| Property | Value |
|----------|-------|
| Max size | 5 MB |
| Formats | JPEG, PNG |
| Endpoint | `POST /api/v1/payments/bank-transfer` |
| Storage | MinIO bucket: `carekit/receipts/` |

### Logo Upload

| Property | Value |
|----------|-------|
| Max size | 2 MB |
| Formats | PNG, SVG |
| Endpoint | `POST /api/v1/whitelabel/config/upload` |
| Storage | MinIO bucket: `carekit/branding/` |

### General File Uploads

| Property | Value |
|----------|-------|
| Max size | 10 MB |
| Formats | JPEG, PNG, PDF |
| Storage | MinIO bucket: `carekit/uploads/` |

### Upload Response

All file uploads return a URL pointing to the MinIO-stored file:

```json
{
  "success": true,
  "data": {
    "url": "https://minio.example.com/carekit/receipts/uuid.jpg",
    "filename": "uuid.jpg",
    "size": 2048576,
    "mimeType": "image/jpeg"
  }
}
```

---

## WebSocket Events

WebSocket connection endpoint: `ws://api.example.com/ws`

Authentication: Pass JWT as query parameter `?token=<jwt>` or via `Authorization` header during upgrade.

### Events (Server to Client)

| Event | Description | Payload |
|-------|-------------|---------|
| `notification:new` | New notification pushed to user | `{ id, titleAr, titleEn, bodyAr, bodyEn, type, data }` |
| `booking:status_changed` | Booking status update | `{ bookingId, oldStatus, newStatus, updatedAt }` |
| `chat:message` | Chatbot message chunk (streaming) | `{ sessionId, messageId, content, done }` |
| `payment:status_changed` | Payment status update | `{ paymentId, bookingId, status }` |
| `transfer:verified` | AI verification completed | `{ receiptId, paymentId, status, confidence }` |

### Events (Client to Server)

| Event | Description | Payload |
|-------|-------------|---------|
| `chat:send` | Send chatbot message | `{ sessionId, message }` |
| `notification:read` | Mark notification as read | `{ notificationId }` |

### Connection Example

```javascript
const ws = new WebSocket('ws://api.example.com/ws?token=eyJhbGci...');

ws.onmessage = (event) => {
  const { event: eventName, data } = JSON.parse(event.data);

  switch (eventName) {
    case 'notification:new':
      showNotification(data);
      break;
    case 'booking:status_changed':
      refreshBooking(data.bookingId);
      break;
    case 'chat:message':
      appendChatMessage(data);
      break;
  }
};
```
