# Deqah Dashboard — API Contracts & Frontend Architecture

> **STATUS: Pre-SaaS historical record.** This spec was written before the
> multi-tenant SaaS refactor and the API surface has drifted significantly:
> dashboard endpoints now live under `/api/v1/dashboard/<cluster>/...`
> (audience-prefixed), tenant context is enforced via `X-Tenant-ID` + JWT
> tenant binding (TENANT_ENFORCEMENT=strict), and the cluster split (org-config
> vs org-experience, finance vs platform billing, etc.) is not reflected
> below. The OpenAPI snapshot at `apps/backend/openapi.json` is the live
> source of truth — regenerate via `npm run openapi:build-and-snapshot`.
> Kept here for historical context on naming/intent only.


## جدول المحتويات
1. [API Endpoints](#1-api-endpoints)
2. [Frontend Hooks](#2-frontend-hooks)
3. [State Management](#3-state-management)
4. [Data Flow](#4-data-flow)
5. [Component Structure](#5-component-structure)

---

## 1. API Endpoints

### 1.1 Authentication (`/api/v1/auth`)
```
POST   /auth/login              → { email, password } → { accessToken, refreshToken, user }
POST   /auth/register           → { email, password, name, role } → { user }
POST   /auth/refresh            → { refreshToken } → { accessToken }
POST   /auth/logout             → {} → { success }
GET    /auth/me                 → {} → { user }
POST   /auth/change-password    → { oldPassword, newPassword } → { success }
POST   /auth/forgot-password    → { email } → { success }
POST   /auth/reset-password     → { token, newPassword } → { success }
```

### 1.2 Bookings (`/api/v1/bookings`)
```
GET    /bookings                → Query: { page, limit, status?, clientId?, employeeId?, dateFrom?, dateTo?, branchId? } → { data: Booking[], meta: PaginationMeta }
GET    /bookings/:id            → {} → { booking: Booking }
POST   /bookings                → CreateBookingDto → { booking: Booking }
PATCH  /bookings/:id            → UpdateBookingDto → { booking: Booking }
DELETE /bookings/:id            → {} → { success }
POST   /bookings/:id/cancel     → { reason?, cancellationFee? } → { booking: Booking }
POST   /bookings/:id/reschedule → { newDate, newTime, newEmployeeId? } → { booking: Booking }
POST   /bookings/:id/check-in   → {} → { booking: Booking }
POST   /bookings/:id/no-show    → {} → { booking: Booking }
GET    /bookings/:id/history    → {} → { history: BookingHistory[] }
GET    /bookings/slots          → Query: { employeeId, serviceId, date, branchId } → { slots: TimeSlot[] }
GET    /bookings/walk-in        → Query: { branchId, date } → { bookings: Booking[] }
```

### 1.3 Clients (`/api/v1/clients`)
```
GET    /clients                → Query: { page, limit, search?, status?, branchId? } → { data: Client[], meta: PaginationMeta }
GET    /clients/:id            → {} → { client: Client }
POST   /clients                → CreateClientDto → { client: Client }
PATCH  /clients/:id            → UpdateClientDto → { client: Client }
DELETE /clients/:id            → {} → { success }
GET    /clients/:id/bookings   → Query: { page, limit, status? } → { data: Booking[], meta: PaginationMeta }
GET    /clients/:id/payments    → Query: { page, limit } → { data: Payment[], meta: PaginationMeta }
GET    /clients/:id/balance     → {} → { balance: number }
POST   /clients/:id/balance    → { amount, type: 'add'|'subtract', reason } → { balance: number }
GET    /clients/:id/documents   → {} → { documents: Document[] }
POST   /clients/:id/documents   → FormData → { document: Document }
DELETE /clients/:id/documents/:docId → {} → { success }
```

### 1.4 Employees (`/api/v1/employees`)
```
GET    /employees                    → Query: { page, limit, search?, specialtyId?, branchId?, status? } → { data: Employee[], meta: PaginationMeta }
GET    /employees/:id               → {} → { employee: Employee }
POST   /employees                   → CreateEmployeeDto → { employee: Employee }
PATCH  /employees/:id               → UpdateEmployeeDto → { employee: Employee }
DELETE /employees/:id               → {} → { success }
GET    /employees/:id/schedule      → Query: { dateFrom, dateTo } → { schedule: ScheduleBlock[] }
POST   /employees/:id/schedule      → { blocks: ScheduleBlock[] } → { schedule: ScheduleBlock[] }
GET    /employees/:id/availability   → Query: { serviceId, date } → { slots: TimeSlot[] }
GET    /employees/:id/bookings       → Query: { page, limit, dateFrom?, dateTo?, status? } → { data: Booking[], meta: PaginationMeta }
GET    /employees/:id/ratings        → Query: { page, limit } → { data: Rating[], meta: PaginationMeta }
GET    /employees/:id/stats         → Query: { period? } → { stats: EmployeeStats }
```

### 1.5 Services (`/api/v1/services`)
```
GET    /services                       → Query: { page, limit, categoryId?, status?, search? } → { data: Service[], meta: PaginationMeta }
GET    /services/:id                   → {} → { service: Service }
POST   /services                       → CreateServiceDto → { service: Service }
PATCH  /services/:id                   → UpdateServiceDto → { service: Service }
DELETE /services/:id                   → {} → { success }
GET    /services/categories            → {} → { categories: ServiceCategory[] }
POST   /services/categories            → { name, description, icon } → { category: ServiceCategory }
PATCH  /services/categories/:id        → { name?, description?, icon? } → { category: ServiceCategory }
DELETE /services/categories/:id        → {} → { success }
```

### 1.6 Payments (`/api/v1/payments`)
```
GET    /payments                       → Query: { page, limit, status?, method?, bookingId?, clientId?, dateFrom?, dateTo? } → { data: Payment[], meta: PaginationMeta }
GET    /payments/:id                   → {} → { payment: Payment }
POST   /payments                       → CreatePaymentDto → { payment: Payment }
POST   /ayments/:id/refund             → { amount?, reason? } → { payment: Payment }
GET    /payments/:id/invoice           → {} → { invoice: Invoice }
POST   /payments/webhook/moyasar       → MoyasarWebhookPayload → { received: true }
```

### 1.7 Invoices (`/api/v1/invoices`)
```
GET    /invoices                       → Query: { page, limit, status?, clientId?, bookingId? } → { data: Invoice[], meta: PaginationMeta }
GET    /invoices/:id                   → {} → { invoice: Invoice }
GET    /invoices/:id/pdf               → {} → PDF
POST   /invoices/:id/send              → { email? } → { success }
```

### 1.8 Branches (`/api/v1/branches`)
```
GET    /branches                       → Query: { page, limit, status? } → { data: Branch[], meta: PaginationMeta }
GET    /branches/:id                   → {} → { branch: Branch }
POST   /branches                       → CreateBranchDto → { branch: Branch }
PATCH  /branches/:id                   → UpdateBranchDto → { branch: Branch }
DELETE /branches/:id                   → {} → { success }
GET    /branches/:id/hours            → {} → { hours: BranchHours[] }
PATCH  /branches/:id/hours             → { hours: BranchHours[] } → { hours: BranchHours[] }
GET    /branches/:id/holidays         → {} → { holidays: Holiday[] }
POST   /branches/:id/holidays         → { date, name } → { holiday: Holiday }
DELETE /branches/:id/holidays/:holId   → {} → { success }
```

### 1.9 Departments (`/api/v1/departments`)
```
GET    /departments                     → Query: { page, limit, status? } → { data: Department[], meta: PaginationMeta }
GET    /departments/:id                → {} → { department: Department }
POST   /departments                    → CreateDepartmentDto → { department: Department }
PATCH  /departments/:id                → UpdateDepartmentDto → { department: Department }
DELETE /departments/:id                → {} → { success }
```

### 1.10 Specialties (`/api/v1/specialties`)
```
GET    /specialties                     → Query: { page, limit } → { data: Specialty[], meta: PaginationMeta }
GET    /specialties/:id                → {} → { specialty: Specialty }
POST   /specialties                    → CreateSpecialtyDto → { specialty: Specialty }
PATCH  /specialties/:id                → UpdateSpecialtyDto → { specialty: Specialty }
DELETE /specialties/:id                → {} → { success }
```

### 1.11 Ratings (`/api/v1/ratings`)
```
GET    /ratings                        → Query: { page, limit, employeeId?, bookingId?, rating? } → { data: Rating[], meta: PaginationMeta }
POST   /ratings                        → { bookingId, rating, comment? } → { rating: Rating }
GET    /ratings/employee/:id       → Query: { period? } → { average: number, distribution: number[], total: number }
```

### 1.12 Notifications (`/api/v1/notifications`)
```
GET    /notifications                  → Query: { page, limit, isRead? } → { data: Notification[], meta: PaginationMeta }
PATCH  /notifications/:id/read          → {} → { notification: Notification }
PATCH  /notifications/read-all          → {} → { success }
DELETE /notifications/:id               → {} → { success }
POST   /notifications/test-fcm         → { token } → { success }
```

### 1.13 Activity Log (`/api/v1/activity-log`)
```
GET    /activity-log                   → Query: { page, limit, entityType?, entityId?, userId?, action?, dateFrom?, dateTo? } → { data: ActivityLogEntry[], meta: PaginationMeta }
GET    /activity-log/:entityType/:id   → {} → { logs: ActivityLogEntry[] }
```

### 1.14 Reports (`/api/v1/reports`)
```
GET    /reports/revenue                → Query: { dateFrom, dateTo, branchId?, groupBy: 'day'|'week'|'month' } → { data: RevenueReportItem[] }
GET    /reports/appointments          → Query: { dateFrom, dateTo, branchId?, status? } → { data: AppointmentReportItem[] }
GET    /reports/employees          → Query: { dateFrom, dateTo, branchId? } → { data: EmployeeReportItem[] }
GET    /reports/clients              → Query: { dateFrom, dateTo, branchId? } → { data: ClientReportItem[] }
GET    /reports/services               → Query: { dateFrom, dateTo, branchId? } → { data: ServiceReportItem[] }
GET    /reports/no-shows               → Query: { dateFrom, dateTo, branchId? } → { data: NoShowReportItem[] }
POST   /reports/export                 → { reportType, format: 'pdf'|'excel', filters } → { downloadUrl: string }
```

### 1.15 Settings (`/api/v1/settings`)
```
GET    /settings                       → {} → { settings: Settings }
PATCH  /settings                       → Partial<Settings> → { settings: Settings }
GET    /settings/clinic                → {} → { clinic: ClinicInfo }
PATCH  /settings/clinic                → Partial<ClinicInfo> → { clinic: ClinicInfo }
GET    /settings/business-hours         → {} → { hours: BusinessHours }
PATCH  /settings/business-hours         → { hours: BusinessHours } → { hours: BusinessHours }
GET    /settings/booking-rules        → {} → { rules: BookingRules }
PATCH  /settings/booking-rules        → Partial<BookingRules> → { rules: BookingRules }
GET    /settings/notifications         → {} → { preferences: NotificationPreferences }
PATCH  /settings/notifications         → Partial<NotificationPreferences> → { preferences: NotificationPreferences }
```

### 1.16 Whitelabel (`/api/v1/whitelabel`)
```
GET    /whitelabel/config              → {} → { config: BrandingConfig }
PATCH  /whitelabel/config              → Partial<BrandingConfig> → { config: BrandingConfig }
GET    /whitelabel/themes              → {} → { themes: Theme[] }
POST   /whitelabel/themes              → CreateThemeDto → { theme: Theme }
PATCH  /whitelabel/themes/:id         → UpdateThemeDto → { theme: Theme }
DELETE /whitelabel/themes/:id         → {} → { success }
GET    /whitelabel/logo                → {} → { logo: string }
POST   /whitelabel/logo                → FormData → { logo: string }
```

### 1.17 Users (`/api/v1/users`)
```
GET    /users                          → Query: { page, limit, role?, branchId?, status? } → { data: User[], meta: PaginationMeta }
GET    /users/:id                      → {} → { user: User }
POST   /users                          → CreateUserDto → { user: User }
PATCH  /users/:id                      → UpdateUserDto → { user: User }
DELETE /users/:id                      → {} → { success }
PATCH  /users/:id/status               → { status: 'active'|'inactive' } → { user: User }
```

### 1.18 Roles & Permissions (`/api/v1/roles`)
```
GET    /roles                          → {} → { roles: Role[] }
GET    /roles/:id                      → {} → { role: Role }
POST   /roles                          → CreateRoleDto → { role: Role }
PATCH  /roles/:id                      → UpdateRoleDto → { role: Role }
DELETE /roles/:id                      → {} → { success }
GET    /permissions                    → {} → { permissions: Permission[] }
```

### 1.19 Coupons (`/api/v1/coupons`)
```
GET    /coupons                        → Query: { page, limit, status? } → { data: Coupon[], meta: PaginationMeta }
GET    /coupons/:id                    → {} → { coupon: Coupon }
POST   /coupons                        → CreateCouponDto → { coupon: Coupon }
PATCH  /coupons/:id                    → UpdateCouponDto → { coupon: Coupon }
DELETE /coupons/:id                    → {} → { success }
POST   /coupons/:id/validate           → { code, amount } → { valid: boolean, discount: number }
```

### 1.20 Gift Cards (`/api/v1/gift-cards`)
```
GET    /gift-cards                      → Query: { page, limit, status? } → { data: GiftCard[], meta: PaginationMeta }
GET    /gift-cards/:id                  → {} → { giftCard: GiftCard }
POST   /gift-cards                      → CreateGiftCardDto → { giftCard: GiftCard }
PATCH  /gift-cards/:id                  → UpdateGiftCardDto → { giftCard: GiftCard }
POST   /gift-cards/:id/redeem           → { amount, bookingId? } → { giftCard: GiftCard }
GET    /gift-cards/:id/transactions     → {} → { transactions: GiftCardTransaction[] }
```

### 1.21 Intake Forms (`/api/v1/intake-forms`)
```
GET    /intake-forms                    → Query: { page, limit, status? } → { data: IntakeForm[], meta: PaginationMeta }
GET    /intake-forms/:id                → {} → { form: IntakeForm }
POST   /intake-forms                    → CreateIntakeFormDto → { form: IntakeForm }
PATCH  /intake-forms/:id               → UpdateIntakeFormDto → { form: IntakeForm }
DELETE /intake-forms/:id               → {} → { success }
GET    /intake-forms/:id/submissions    → Query: { page, limit, clientId? } → { data: IntakeFormSubmission[], meta: PaginationMeta }
POST   /intake-forms/:id/submit         → { clientId, answers } → { submission: IntakeFormSubmission }
```

### 1.22 ZATCA (`/api/v1/zatca`)
```
GET    /zatca/invoices                  → Query: { page, limit, status? } → { data: ZatcaInvoice[], meta: PaginationMeta }
GET    /zatca/invoices/:id              → {} → { invoice: ZatcaInvoice }
POST   /zatca/invoices/:id/issue       → {} → { invoice: ZatcaInvoice }
POST   /zatca/invoices/:id/cancel      → { reason } → { invoice: ZatcaInvoice }
GET    /zatca/invoices/:id/validate    → {} → { valid: boolean, errors: string[] }
POST   /zatca/invoices/bulk-issue      → { invoiceIds: string[] } → { results: ZatcaInvoiceIssueResult[] }
```

### 1.23 Chatbot (`/api/v1/chatbot`)
```
POST   /chatbot/message                 → { message, sessionId?, context? } → { reply: string, sessionId: string }
GET    /chatbot/sessions                → Query: { page, limit } → { data: ChatSession[], meta: PaginationMeta }
GET    /chatbot/sessions/:id            → {} → { session: ChatSession, messages: Message[] }
DELETE /chatbot/sessions/:id            → {} → { success }
```

### 1.24 Integrations (`/api/v1/integrations`)
```
GET    /integrations                    → {} → { integrations: Integration[] }
GET    /integrations/:id               → {} → { integration: Integration }
POST   /integrations/:id/connect       → { credentials } → { integration: Integration }
POST   /integrations/:id/disconnect     → {} → { integration: Integration }
POST   /integrations/:id/sync          → {} → { syncResult: SyncResult }
GET    /integrations/:id/status         → {} → { status: IntegrationStatus }
```

### 1.25 Health (`/api/v1/health`)
```
GET    /health                         → {} → { status: 'ok', timestamp: string }
GET    /health/ready                   → {} → { ready: boolean, checks: HealthCheck[] }
GET    /health/live                    → {} → { alive: boolean }
```

---

## 2. Frontend Hooks

### 2.1 Authentication Hooks
```typescript
// hooks/useAuth.ts
export function useAuth() {
  const { data: user, isLoading, error } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => api.get<User>('/auth/me').then(r => r.data),
  });
  
  const login = useMutation({
    mutationFn: (credentials: LoginDto) => 
      api.post<AuthResponse>('/auth/login', credentials).then(r => r.data),
    onSuccess: (data) => {
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });

  const logout = useMutation({
    mutationFn: () => api.post('/auth/logout'),
    onSuccess: () => {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      queryClient.invalidateQueries();
    },
  });

  return { user, isLoading, error, login, logout };
}

// hooks/usePermissions.ts
export function usePermissions() {
  const { user } = useAuth();
  return {
    can: (action: string, subject: string) => checkPermission(user?.role, action, subject),
    isOwner: user?.role === 'OWNER',
    isAdmin: user?.role === 'ADMIN',
    isReceptionist: user?.role === 'RECEPTIONIST',
    isEmployee: user?.role === 'EMPLOYEE',
  };
}
```

### 2.2 Bookings Hooks
```typescript
// hooks/useBookings.ts
export function useBookings(filters: BookingFilters) {
  return useQuery({
    queryKey: ['bookings', filters],
    queryFn: () => api.get<Booking[]>('/bookings', { params: filters }).then(r => r.data),
  });
}

export function useBooking(id: string) {
  return useQuery({
    queryKey: ['bookings', id],
    queryFn: () => api.get<Booking>(`/bookings/${id}`).then(r => r.data),
    enabled: !!id,
  });
}

// hooks/useBookingMutations.ts
export function useCreateBooking() {
  return useMutation({
    mutationFn: (data: CreateBookingDto) => 
      api.post<Booking>('/bookings', data).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      toast.success('تم إنشاء الحجز بنجاح');
    },
    onError: (error: ApiError) => {
      toast.error(error.response?.data?.message || 'فشل في إنشاء الحجز');
    },
  });
}

export function useCancelBooking() {
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => 
      api.post(`/bookings/${id}/cancel`, { reason }).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      toast.success('تم إلغاء الحجز');
    },
  });
}

export function useRescheduleBooking() {
  return useMutation({
    mutationFn: ({ id, newDate, newTime, newEmployeeId }: RescheduleDto) => 
      api.post(`/bookings/${id}/reschedule`, { newDate, newTime, newEmployeeId }).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      toast.success('تم إعادة جدولة الحجز');
    },
  });
}

export function useAvailableSlots(employeeId: string, serviceId: string, date: string) {
  return useQuery({
    queryKey: ['bookings', 'slots', employeeId, serviceId, date],
    queryFn: () => api.get<TimeSlot[]>(`/bookings/slots`, { 
      params: { employeeId, serviceId, date, branchId: activeBranchId } 
    }).then(r => r.data),
    enabled: !!employeeId && !!serviceId && !!date,
  });
}
```

### 2.3 Clients Hooks
```typescript
// hooks/useClients.ts
export function useClients(filters: ClientFilters) {
  return useQuery({
    queryKey: ['clients', filters],
    queryFn: () => api.get<Client[]>('/clients', { params: filters }).then(r => r.data),
  });
}

export function useClient(id: string) {
  return useQuery({
    queryKey: ['clients', id],
    queryFn: () => api.get<Client>(`/clients/${id}`).then(r => r.data),
    enabled: !!id,
  });
}

export function useClientBookings(clientId: string, filters?: PaginationFilters) {
  return useQuery({
    queryKey: ['clients', clientId, 'bookings', filters],
    queryFn: () => api.get<Booking[]>(`/clients/${clientId}/bookings`, { params: filters }).then(r => r.data),
    enabled: !!clientId,
  });
}

export function useClientBalance(clientId: string) {
  return useQuery({
    queryKey: ['clients', clientId, 'balance'],
    queryFn: () => api.get<{ balance: number }>(`/clients/${clientId}/balance`).then(r => r.data),
    enabled: !!clientId,
  });
}

// hooks/useClientMutations.ts
export function useCreateClient() {
  return useMutation({
    mutationFn: (data: CreateClientDto) => 
      api.post<Client>('/clients', data).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('تم إضافة المريض بنجاح');
    },
  });
}

export function useUpdateClient() {
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateClientDto }) => 
      api.patch<Client>(`/clients/${id}`, data).then(r => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['clients', data.id] });
      toast.success('تم تحديث بيانات المريض');
    },
  });
}

export function useAdjustBalance() {
  return useMutation({
    mutationFn: ({ clientId, amount, type, reason }: AdjustBalanceDto) => 
      api.post(`/clients/${clientId}/balance`, { amount, type, reason }).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('تم تعديل الرصيد');
    },
  });
}
```

### 2.4 Employees Hooks
```typescript
// hooks/useEmployees.ts
export function useEmployees(filters: EmployeeFilters) {
  return useQuery({
    queryKey: ['employees', filters],
    queryFn: () => api.get<Employee[]>('/employees', { params: filters }).then(r => r.data),
  });
}

export function useEmployee(id: string) {
  return useQuery({
    queryKey: ['employees', id],
    queryFn: () => api.get<Employee>(`/employees/${id}`).then(r => r.data),
    enabled: !!id,
  });
}

export function useEmployeeSchedule(employeeId: string, dateFrom: string, dateTo: string) {
  return useQuery({
    queryKey: ['employees', employeeId, 'schedule', dateFrom, dateTo],
    queryFn: () => api.get<ScheduleBlock[]>(`/employees/${employeeId}/schedule`, {
      params: { dateFrom, dateTo }
    }).then(r => r.data),
    enabled: !!employeeId && !!dateFrom && !!dateTo,
  });
}

export function useEmployeeAvailability(employeeId: string, serviceId: string, date: string) {
  return useQuery({
    queryKey: ['employees', employeeId, 'availability', serviceId, date],
    queryFn: () => api.get<TimeSlot[]>(`/employees/${employeeId}/availability`, {
      params: { serviceId, date }
    }).then(r => r.data),
    enabled: !!employeeId && !!serviceId && !!date,
  });
}

export function useEmployeeStats(employeeId: string, period?: string) {
  return useQuery({
    queryKey: ['employees', employeeId, 'stats', period],
    queryFn: () => api.get<EmployeeStats>(`/employees/${employeeId}/stats`, {
      params: { period }
    }).then(r => r.data),
    enabled: !!employeeId,
  });
}
```

### 2.5 Services Hooks
```typescript
// hooks/useServices.ts
export function useServices(filters: ServiceFilters) {
  return useQuery({
    queryKey: ['services', filters],
    queryFn: () => api.get<Service[]>('/services', { params: filters }).then(r => r.data),
  });
}

export function useService(id: string) {
  return useQuery({
    queryKey: ['services', id],
    queryFn: () => api.get<Service>(`/services/${id}`).then(r => r.data),
    enabled: !!id,
  });
}

export function useServiceCategories() {
  return useQuery({
    queryKey: ['services', 'categories'],
    queryFn: () => api.get<ServiceCategory[]>('/services/categories').then(r => r.data),
  });
}

// hooks/useServiceMutations.ts
export function useCreateService() {
  return useMutation({
    mutationFn: (data: CreateServiceDto) => 
      api.post<Service>('/services', data).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast.success('تم إضافة الخدمة بنجاح');
    },
  });
}

export function useUpdateService() {
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateServiceDto }) => 
      api.patch<Service>(`/services/${id}`, data).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast.success('تم تحديث الخدمة');
    },
  });
}
```

### 2.6 Payments Hooks
```typescript
// hooks/usePayments.ts
export function usePayments(filters: PaymentFilters) {
  return useQuery({
    queryKey: ['payments', filters],
    queryFn: () => api.get<Payment[]>('/payments', { params: filters }).then(r => r.data),
  });
}

export function usePayment(id: string) {
  return useQuery({
    queryKey: ['payments', id],
    queryFn: () => api.get<Payment>(`/payments/${id}`).then(r => r.data),
    enabled: !!id,
  });
}

// hooks/usePaymentMutations.ts
export function useRefundPayment() {
  return useMutation({
    mutationFn: ({ id, amount, reason }: RefundDto) => 
      api.post(`/payments/${id}/refund`, { amount, reason }).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      toast.success('تم استرداد المبلغ');
    },
  });
}
```

### 2.7 Reports Hooks
```typescript
// hooks/useReports.ts
export function useRevenueReport(filters: ReportFilters) {
  return useQuery({
    queryKey: ['reports', 'revenue', filters],
    queryFn: () => api.get<RevenueReportItem[]>('/reports/revenue', { params: filters }).then(r => r.data),
  });
}

export function useAppointmentsReport(filters: ReportFilters) {
  return useQuery({
    queryKey: ['reports', 'appointments', filters],
    queryFn: () => api.get<AppointmentReportItem[]>('/reports/appointments', { params: filters }).then(r => r.data),
  });
}

export function useEmployeesReport(filters: ReportFilters) {
  return useQuery({
    queryKey: ['reports', 'employees', filters],
    queryFn: () => api.get<EmployeeReportItem[]>('/reports/employees', { params: filters }).then(r => r.data),
  });
}

export function useExportReport() {
  return useMutation({
    mutationFn: (data: ExportReportDto) => 
      api.post<{ downloadUrl: string }>('/reports/export', data).then(r => r.data),
    onSuccess: (data) => {
      window.open(data.downloadUrl, '_blank');
    },
  });
}
```

### 2.8 Settings Hooks
```typescript
// hooks/useSettings.ts
export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<Settings>('/settings').then(r => r.data),
  });
}

export function useClinicInfo() {
  return useQuery({
    queryKey: ['settings', 'clinic'],
    queryFn: () => api.get<ClinicInfo>('/settings/clinic').then(r => r.data),
  });
}

export function useBookingRules() {
  return useQuery({
    queryKey: ['settings', 'booking-rules'],
    queryFn: () => api.get<BookingRules>('/settings/booking-rules').then(r => r.data),
  });
}

// hooks/useSettingsMutations.ts
export function useUpdateSettings() {
  return useMutation({
    mutationFn: (data: Partial<Settings>) => 
      api.patch<Settings>('/settings', data).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('تم حفظ الإعدادات');
    },
  });
}

export function useUpdateClinicInfo() {
  return useMutation({
    mutationFn: (data: Partial<ClinicInfo>) => 
      api.patch<ClinicInfo>('/settings/clinic', data).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'clinic'] });
      toast.success('تم تحديث معلومات العيادة');
    },
  });
}
```

### 2.9 Notifications Hooks
```typescript
// hooks/useNotifications.ts
export function useNotifications(filters?: NotificationFilters) {
  return useQuery({
    queryKey: ['notifications', filters],
    queryFn: () => api.get<Notification[]>('/notifications', { params: filters }).then(r => r.data),
  });
}

export function useUnreadNotificationsCount() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => api.get<{ count: number }>('/notifications', { 
      params: { isRead: false } 
    }).then(r => r.data),
    refetchInterval: 30000, // Poll every 30 seconds
  });
}

// hooks/useNotificationMutations.ts
export function useMarkNotificationRead() {
  return useMutation({
    mutationFn: (id: string) => 
      api.patch(`/notifications/${id}/read`).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  return useMutation({
    mutationFn: () => api.patch('/notifications/read-all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
```

---

## 3. State Management

### 3.1 Global State (Redux Toolkit)

```typescript
// stores/authSlice.ts
interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
}

const authSlice = createSlice({
  name: 'auth',
  initialState: { user: null, accessToken: null, isAuthenticated: false },
  reducers: {
    setUser: (state, action: PayloadAction<User>) => { state.user = action.payload; state.isAuthenticated = true; },
    setToken: (state, action: PayloadAction<string>) => { state.accessToken = action.payload; },
    logout: (state) => { state.user = null; state.accessToken = null; state.isAuthenticated = false; },
  },
});

// stores/branchSlice.ts
interface BranchState {
  activeBranch: Branch | null;
  branches: Branch[];
}

const branchSlice = createSlice({
  name: 'branch',
  initialState: { activeBranch: null, branches: [] },
  reducers: {
    setActiveBranch: (state, action: PayloadAction<Branch>) => { state.activeBranch = action.payload; },
    setBranches: (state, action: PayloadAction<Branch[]>) => { state.branches = action.payload; },
  },
});

// stores/uiSlice.ts
interface UIState {
  sidebarCollapsed: boolean;
  direction: 'rtl' | 'ltr';
  theme: 'light' | 'dark';
  locale: 'ar' | 'en';
}

const uiSlice = createSlice({
  name: 'ui',
  initialState: { sidebarCollapsed: false, direction: 'rtl', theme: 'light', locale: 'ar' },
  reducers: {
    toggleSidebar: (state) => { state.sidebarCollapsed = !state.sidebarCollapsed; },
    setDirection: (state, action: PayloadAction<'rtl' | 'ltr'>) => { state.direction = action.payload; },
    setTheme: (state, action: PayloadAction<'light' | 'dark'>) => { state.theme = action.payload; },
    setLocale: (state, action: PayloadAction<'ar' | 'en'>) => { state.locale = action.payload; },
  },
});
```

### 3.2 Server State (TanStack Query)

```typescript
// lib/queryClient.ts
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)
      retry: 2,
      refetchOnWindowFocus: true,
    },
  },
});

// lib/apiClient.ts
export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1',
  timeout: 30000,
});

// Request interceptor for auth
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const { data } = await api.post('/auth/refresh', { refreshToken });
          localStorage.setItem('accessToken', data.accessToken);
          error.config.headers.Authorization = `Bearer ${data.accessToken}`;
          return api(error.config);
        } catch {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);
```

---

## 4. Data Flow

### 4.1 Page Data Flow (Example: Bookings List)

```
┌─────────────────────────────────────────────────────────────────┐
│                         Page Component                          │
│                   app/(dashboard)/bookings/page.tsx            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    useBookings(filters) ──────────────┐
                              │                        │
                              ▼                        ▼
                    TanStack Query              queryClient
                    queryKey: ['bookings', filters]  cache
                              │
                              ▼
                    api.get('/bookings', { params: filters })
                              │
                              ▼
                    API Response Interceptor
                    │                        │
                    ▼                        ▼
              success                    error
              │                        │
              ▼                        ▼
        { data: Booking[],      Error Banner Component
          meta: PaginationMeta }    │
        │                        │
        ▼                        │
  DataTable Component            │
  with bookings data            │
        │                        │
        ▼                        ▼
  User interactions ────────► Mutation calls
  - Filter change ──────────► useBookings with new filters
  - Pagination ────────────► useBookings with new page
  - Row click ─────────────► useBooking(id) for details
  - Action button ────────► useCancelBooking/useRescheduleBooking
                              │
                              ▼
                    queryClient.invalidateQueries
                    → Refetch bookings list
                    → Show success toast
```

### 4.2 Form Submission Flow (Example: Create Booking)

```
┌─────────────────────────────────────────────────────────────────┐
│                      CreateBookingPage                          │
│                  app/(dashboard)/bookings/new/page.tsx          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    react-hook-form + zod
                    validation schema
                              │
                              ▼
                    onSubmit(formData)
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        Step 1           Step 2           Step 3
      Client ID       Service +         Time Slot
      validation      Employee      Selection
                              │
                              ▼
                    useCreateBooking mutation
                              │
                              ▼
                    POST /api/v1/bookings
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
        success                             error
              │                               │
              ▼                               ▼
        Redirect to                    Show validation errors
        /bookings/:id                 in form fields
              │
              ▼
        queryClient.invalidateQueries
        → ['bookings']
```

### 4.3 Real-time Updates (Notifications)

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Backend   │ ──────► │   FCM/APNs  │ ──────► │    PWA      │
│  BullMQ Job │         │   Push      │         │  Service    │
└─────────────┘         └─────────────┘         │  Worker     │
                                                  └─────────────┘
                                                          │
                                                          ▼
                                                  Show Browser
                                                  Notification
                                                          │
                                                          ▼
                                                  useUnreadNotificationsCount
                                                  → refetchInterval: 30000
                                                          │
                                                          ▼
                                                  UI Badge Updates
                                                  + Toast Notification
```

---

## 5. Component Structure

### 5.1 Page Anatomy

```
app/(dashboard)/[module]/page.tsx          # ≤120 lines - orchestration only
  │
  ├── components/features/[module]/
  │   ├── [module]-list.tsx               # List page with DataTable
  │   ├── [module]-form.tsx               # Create/Edit form (separate page)
  │   ├── [module]-detail.tsx             # Detail view
  │   ├── [module]-filters.tsx            # FilterBar component
  │   ├── [module]-stats.tsx              # StatsGrid for dashboard pages
  │   └── [module]-actions.tsx            # Bulk actions component
  │
  └── components/ui/                      # shadcn/ui primitives
      ├── data-table.tsx
      ├── filter-bar.tsx
      ├── pagination.tsx
      ├── sheet.tsx
      ├── dialog.tsx
      └── ...
```

### 5.2 File Naming Conventions

| Type | Naming | Example |
|------|--------|---------|
| Pages | `page.tsx` | `bookings/page.tsx` |
| Feature Components | `kebab-case` | `booking-list.tsx`, `client-form.tsx` |
| Hooks | `use[kebab-case].ts` | `use-bookings.ts`, `use-client-mutations.ts` |
| API Layer | `[kebab-case].ts` | `bookings.ts`, `clients.ts` |
| Schemas | `[kebab-case].schema.ts` | `booking.schema.ts`, `client.schema.ts` |
| Types | `[kebab-case].ts` | `booking.types.ts`, `client.types.ts` |
| Translations | `[lang].[module].ts` | `ar.bookings.ts`, `en.bookings.ts` |

### 5.3 Component Props Pattern

```typescript
// ❌ Bad - props drilling beyond 2 levels
<Page>
  <List>
    <FilterBar>
      <DatePicker />  // 3 levels - too deep
    </FilterBar>
  </List>
</Page>

// ✅ Good - context or direct props
<Page>
  <List filters={filters} onFiltersChange={setFilters} />  // direct
  <FilterBar 
    filters={filters} 
    onChange={handleFilterChange}
    ref={filterBarRef}  // if needed for focus
  />
</Page>

// Or use context for deeply shared state
<BookingProvider>  // context for booking-related state
  <Page>
    <BookingList />
    <BookingDetail />
  </Page>
</BookingProvider>
```

### 5.4 Data Flow Between Components

```
Parent Component (Page)
    │
    ├── state: filters, selectedItems, currentPage
    │
    ▼
useQuery / useMutation hooks
    │
    ▼
Child Component (List)
    │ props: { data, isLoading, error, onPageChange }
    │
    ▼
Grandchild Components
    │ (no hooks, just display)
    │
    ▼
Action Handlers → Mutation Hooks → Server → Invalidate Queries → UI Update
```

---

## 6. API Response Types

### 6.1 Standard Response Wrappers

```typescript
// Success Response
interface ApiResponse<T> {
  success: true;
  data: T;
  error: null;
}

// Error Response
interface ApiErrorResponse {
  success: false;
  data: null;
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}

// Paginated Response
interface PaginatedResponse<T> {
  success: true;
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  error: null;
}
```

### 6.2 Entity Types

```typescript
// Booking
interface Booking {
  id: string;
  clientId: string;
  client: Client;
  employeeId: string;
  employee: Employee;
  serviceId: string;
  service: Service;
  branchId: string;
  date: string; // ISO date
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  status: BookingStatus;
  type: BookingType;
  notes?: string;
  noShowReason?: string;
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
}

enum BookingStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CHECKED_IN = 'checked_in',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  PENDING_CANCELLATION = 'pending_cancellation',
  NO_SHOW = 'no_show',
  EXPIRED = 'expired',
}

enum BookingType {
  IN_PERSON = 'in_person',
  ONLINE = 'online',
  WALK_IN = 'walk_in',
}

// Client
interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone: string;
  dateOfBirth?: string;
  gender?: Gender;
  address?: string;
  notes?: string;
  balance: number; // in halalat
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

// Employee
interface Employee {
  id: string;
  userId: string;
  user: User;
  specialtyId: string;
  specialty: Specialty;
  branchIds: string[];
  title?: string;
  bio?: string;
  consultationDuration: number; // minutes
  status: 'available' | 'busy' | 'offline';
  rating: number;
  totalRatings: number;
  createdAt: string;
  updatedAt: string;
}

// Service
interface Service {
  id: string;
  categoryId: string;
  category: ServiceCategory;
  nameAr: string;
  nameEn: string;
  descriptionAr?: string;
  descriptionEn?: string;
  price: number; // halalat
  duration: number; // minutes
  color?: string;
  icon?: string;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

// Payment
interface Payment {
  id: string;
  bookingId: string;
  booking?: Booking;
  clientId: string;
  client: Client;
  amount: number; // halalat
  method: PaymentMethod;
  status: PaymentStatus;
  moyasarId?: string;
  invoiceId?: string;
  refundedAt?: string;
  refundReason?: string;
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

---

## 7. Error Handling Patterns

### 7.1 API Error Handling

```typescript
// lib/errors.ts
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number,
    public details?: Record<string, string[]>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// lib/apiClient.ts - Error transformation
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const { status, data } = error.response;
      
      if (status === 422 && data.details) {
        return Promise.reject(new ApiError(
          'VALIDATION_ERROR',
          data.message || 'Validation failed',
          status,
          data.details
        ));
      }
      
      if (status === 403) {
        return Promise.reject(new ApiError(
          'FORBIDDEN',
          'ليس لديك صلاحية لهذا الإجراء',
          status
        ));
      }
      
      if (status === 404) {
        return Promise.reject(new ApiError(
          'NOT_FOUND',
          'المورد غير موجود',
          status
        ));
      }
    }
    
    return Promise.reject(new ApiError(
      'NETWORK_ERROR',
      'حدث خطأ في الاتصال بالخادم',
      0
    ));
  }
);
```

### 7.2 Form Error Handling

```typescript
// Using react-hook-form with API errors
const form = useForm<BookingFormData>({
  resolver: zodResolver(bookingSchema),
});

useEffect(() => {
  if (apiError && apiError.details) {
    // Map API errors to form fields
    Object.entries(apiError.details).forEach(([field, messages]) => {
      form.setError(field as keyof BookingFormData, {
        type: 'server',
        message: messages[0],
      });
    });
  }
}, [apiError]);
```

### 7.3 Global Error Boundary

```typescript
// components/error-boundary.tsx
export class ErrorBoundary extends React.Component<Props, State> {
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-destructive">حدث خطأ غير متوقع</h2>
            <p className="text-muted-foreground mt-2">{this.state.error.message}</p>
            <Button onClick={() => window.location.reload()} className="mt-4">
              إعادة تحميل الصفحة
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
```

---

## 8. Validation Schemas

### 8.1 Zod Schemas

```typescript
// schemas/booking.schema.ts
export const createBookingSchema = z.object({
  clientId: z.string().min(1, 'المريض مطلوب'),
  employeeId: z.string().min(1, 'الطبيب مطلوب'),
  serviceId: z.string().min(1, 'الخدمة مطلوبة'),
  branchId: z.string().min(1, 'الفرع مطلوب'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'التاريخ غير صحيح'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'الوقت غير صحيح'),
  type: z.nativeEnum(BookingType),
  notes: z.string().optional(),
});

export const rescheduleBookingSchema = z.object({
  newDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  newTime: z.string().regex(/^\d{2}:\d{2}$/),
  newEmployeeId: z.string().optional(),
});

export type CreateBookingDto = z.infer<typeof createBookingSchema>;
export type RescheduleBookingDto = z.infer<typeof rescheduleBookingSchema>;

// schemas/client.schema.ts
export const createClientSchema = z.object({
  firstName: z.string().min(1, 'الاسم الأول مطلوب').max(100),
  lastName: z.string().min(1, 'اسم العائلة مطلوب').max(100),
  email: z.string().email('البريد الإلكتروني غير صحيح').optional().or(z.literal('')),
  phone: z.string().min(10, 'رقم الهاتف غير صحيح').max(20),
  dateOfBirth: z.string().optional(),
  gender: z.nativeEnum(Gender).optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});

export type CreateClientDto = z.infer<typeof createClientSchema>;
```

---

## 9. Pagination Patterns

### 9.1 Infinite Query (Load More)

```typescript
// hooks/useClientsInfinite.ts
export function useClientsInfinite(filters: ClientFilters) {
  return useInfiniteQuery({
    queryKey: ['clients', 'infinite', filters],
    queryFn: ({ pageParam = 1 }) => 
      api.get<Client[]>('/clients', { 
        params: { ...filters, page: pageParam, limit: 20 } 
      }).then(r => r.data),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const meta = lastPage.meta;
      return meta.page < meta.totalPages ? meta.page + 1 : undefined;
    },
  });
}

// Component usage
const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useClientsInfinite(filters);

return (
  <>
    {data.pages.flatMap(page => page.data).map(client => (
      <ClientRow key={client.id} client={client} />
    ))}
    {hasNextPage && (
      <Button onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
        {isFetchingNextPage ? 'جاري التحميل...' : 'تحميل المزيد'}
      </Button>
    )}
  </>
);
```

### 9.2 Cursor-based Pagination

```typescript
// For large datasets
export function useBookingsCursor(filters: BookingFilters) {
  return useQuery({
    queryKey: ['bookings', 'cursor', filters],
    queryFn: ({ pageParam }) => 
      api.get<Booking[]>('/bookings', { 
        params: { ...filters, cursor: pageParam, limit: 50 } 
      }).then(r => r.data),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.meta?.nextCursor ?? undefined,
  });
}
```

---

## 10. Optimistic Updates

```typescript
// useCancelBooking with optimistic update
export function useCancelBooking() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => 
      api.post(`/bookings/${id}/cancel`, { reason }).then(r => r.data),
    
    onMutate: async ({ id }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['bookings'] });
      
      // Snapshot previous value
      const previousBookings = queryClient.getQueryData(['bookings']);
      
      // Optimistically update
      queryClient.setQueryData(['bookings'], (old: any) => ({
        ...old,
        data: old.data.map(booking => 
          booking.id === id 
            ? { ...booking, status: BookingStatus.CANCELLED }
            : booking
        ),
      }));
      
      return { previousBookings };
    },
    
    onError: (err, variables, context) => {
      // Rollback on error
      queryClient.setQueryData(['bookings'], context?.previousBookings);
      toast.error('فشل في إلغاء الحجز');
    },
    
    onSettled: () => {
      // Always refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });
}
```

---

## 11. Dependent Queries

```typescript
// Booking form - service options depend on branch
export function useServiceOptions(branchId: string | null) {
  return useQuery({
    queryKey: ['services', 'by-branch', branchId],
    queryFn: () => api.get<Service[]>('/services', { 
      params: { branchId, status: 'active' } 
    }).then(r => r.data),
    enabled: !!branchId, // Won't run until branchId is set
  });
}

// Employee options depend on selected service
export function useEmployeeOptions(serviceId: string | null, branchId: string | null) {
  return useQuery({
    queryKey: ['employees', 'by-service', serviceId, branchId],
    queryFn: () => api.get<Employee[]>('/employees', {
      params: { serviceId, branchId, status: 'available' }
    }).then(r => r.data),
    enabled: !!serviceId && !!branchId, // Won't run until both are set
  });
}
```

---

## 12. API Module Structure (lib/api/)

```
lib/api/
├── client.ts              # axios instance with interceptors
├── types.ts               # API-specific types (request/response)
├── errors.ts              # ApiError class
│
├── auth.ts                # Auth API calls
├── bookings.ts            # Booking API calls
├── clients.ts            # Client API calls
├── employees.ts       # Employee API calls
├── services.ts            # Service API calls
├── payments.ts            # Payment API calls
├── invoices.ts            # Invoice API calls
├── branches.ts            # Branch API calls
├── departments.ts         # Department API calls
├── specialties.ts         # Specialty API calls
├── ratings.ts             # Rating API calls
├── notifications.ts       # Notification API calls
├── activity-log.ts        # Activity Log API calls
├── reports.ts             # Report API calls
├── settings.ts           # Settings API calls
├── users.ts               # User API calls
├── roles.ts               # Role API calls
├── coupons.ts             # Coupon API calls
├── gift-cards.ts          # Gift Card API calls
├── intake-forms.ts        # Intake Form API calls
├── zatca.ts              # ZATCA API calls
├── chatbot.ts            # Chatbot API calls
└── integrations.ts        # Integration API calls
```

Each API file follows this pattern:

```typescript
// lib/api/bookings.ts
export const bookingsApi = {
  list: (filters?: BookingFilters) =>
    api.get<PaginatedResponse<Booking>>('/bookings', { params: filters }),
  
  get: (id: string) =>
    api.get<{ data: Booking }>(`/bookings/${id}`),
  
  create: (data: CreateBookingDto) =>
    api.post<{ data: Booking }>('/bookings', data),
  
  update: (id: string, data: UpdateBookingDto) =>
    api.patch<{ data: Booking }>(`/bookings/${id}`, data),
  
  delete: (id: string) =>
    api.delete<void>(`/bookings/${id}`),
  
  cancel: (id: string, reason?: string) =>
    api.post<{ data: Booking }>(`/bookings/${id}/cancel`, { reason }),
  
  reschedule: (id: string, data: RescheduleDto) =>
    api.post<{ data: Booking }>(`/bookings/${id}/reschedule`, data),
  
  checkIn: (id: string) =>
    api.post<{ data: Booking }>(`/bookings/${id}/check-in`),
  
  noShow: (id: string) =>
    api.post<{ data: Booking }>(`/bookings/${id}/no-show`),
  
  slots: (params: SlotsParams) =>
    api.get<{ data: TimeSlot[] }>('/bookings/slots', { params }),
};
```
