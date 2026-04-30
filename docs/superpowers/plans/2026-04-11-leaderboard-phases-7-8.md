# Leaderboard Phases 7–8: Engagement & Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Engagement (intake forms, notifications, chatbot admin) and Operations (reports, groups) sections of the Deqah Leaderboard dashboard.

**Architecture:** Each domain follows the established leaderboard pattern — api-client module + types → hooks → route pages. New API modules get wired into `packages/api-client/src/index.ts` and `packages/api-client/src/types/index.ts`. All UI uses shared components (PageHeader, StatsGrid, FilterBar, DataTable) and semantic CSS tokens.

**Tech Stack:** Vite + React 19, TanStack Router v1 (file-based routes), TanStack Query v5, @deqah/api-client (typed fetch), Tailwind 4, shadcn/ui

**Sidebar status:** All 5 new routes are already present in `sidebar-config.ts`:
- `/intake-forms` → key `intakeForms`, flag `intakeForms`
- `/notifications` → key `notifications`, flag `notifications`
- `/chatbot` → key `chatbot`, flag `chatbot`
- `/reports` → key `reports`, flag `reports`
- `/group-sessions` → key `groupSessions`, flag `groupSessions`

No sidebar changes needed. Task 11 is therefore a typecheck-only verification task.

---

## Task 1 — Wire api-client for new domains

**Files:**
- Create `packages/api-client/src/types/intake-form.ts`
- Create `packages/api-client/src/types/notification.ts`
- Create `packages/api-client/src/types/report.ts`
- Create `packages/api-client/src/types/chatbot-admin.ts`
- Create `packages/api-client/src/types/group.ts`
- Create `packages/api-client/src/modules/intake-forms.ts`
- Create `packages/api-client/src/modules/notifications.ts`
- Create `packages/api-client/src/modules/reports.ts`
- Create `packages/api-client/src/modules/chatbot-admin.ts`
- Create `packages/api-client/src/modules/groups.ts`
- Modify `packages/api-client/src/types/index.ts`
- Modify `packages/api-client/src/index.ts`
- Modify `apps/leaderboard/src/lib/query-keys.ts`

### Steps

- [ ] Create `packages/api-client/src/types/intake-form.ts`:

```ts
export type FormType = 'pre_booking' | 'pre_session' | 'post_session' | 'registration'
export type FormScope = 'global' | 'service' | 'employee' | 'branch'

export interface IntakeFormField {
  id: string
  labelAr: string
  labelEn: string
  type: 'text' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'date'
  required: boolean
  order: number
  options?: string[]
}

export interface IntakeFormListItem {
  id: string
  nameAr: string
  nameEn: string
  type: FormType
  scope: FormScope
  isActive: boolean
  fieldCount: number
  createdAt: string
}

export interface IntakeFormDetail extends IntakeFormListItem {
  serviceId?: string
  employeeId?: string
  branchId?: string
  fields: IntakeFormField[]
}

export interface IntakeFormListQuery {
  page?: number
  perPage?: number
  search?: string
  type?: FormType
  scope?: FormScope
  isActive?: boolean
}

export interface CreateIntakeFormPayload {
  nameAr: string
  nameEn: string
  type: FormType
  scope: FormScope
  serviceId?: string
  employeeId?: string
  branchId?: string
}

export type UpdateIntakeFormPayload = Partial<CreateIntakeFormPayload & { isActive: boolean }>
```

- [ ] Create `packages/api-client/src/types/notification.ts`:

```ts
export interface NotificationListItem {
  id: string
  title: string
  body: string
  type: string
  isRead: boolean
  createdAt: string
  data?: Record<string, unknown>
}

export interface NotificationListQuery {
  page?: number
  perPage?: number
}

export interface UnreadCountResponse {
  count: number
}
```

- [ ] Create `packages/api-client/src/types/report.ts`:

```ts
export interface RevenueByMonth {
  month: string
  revenue: number
  bookings: number
}

export interface RevenueByEmployee {
  employeeId: string
  name: string
  revenue: number
  bookings: number
}

export interface RevenueByService {
  serviceId: string
  name: string
  revenue: number
  bookings: number
}

export interface RevenueReport {
  totalRevenue: number
  totalBookings: number
  paidBookings: number
  averagePerBooking: number
  byMonth: RevenueByMonth[]
  byEmployee: RevenueByEmployee[]
  byService: RevenueByService[]
}

export interface BookingReport {
  total: number
  byStatus: {
    pending: number
    confirmed: number
    completed: number
    cancelled: number
    pending_cancellation: number
  }
  byType: {
    in_person: number
    online: number
    walk_in: number
  }
  byDay: Array<{ date: string; count: number }>
}

export interface DashboardStats {
  totalRevenue: number
  totalBookings: number
  totalClients: number
  totalEmployees: number
}

export interface ReportDateParams {
  dateFrom?: string
  dateTo?: string
}
```

- [ ] Create `packages/api-client/src/types/chatbot-admin.ts`:

```ts
export interface ChatbotConfig {
  category: string
  key: string
  value: string
  updatedAt: string
}

export interface ChatbotAnalytics {
  totalSessions: number
  activeSessions: number
  avgMessagesPerSession: number
  satisfactionRate: number
}

export interface ChatbotTopQuestion {
  question: string
  count: number
}

export interface UpdateChatbotConfigPayload {
  configs: Array<{ key: string; value: string }>
}
```

- [ ] Create `packages/api-client/src/types/group.ts`:

```ts
export type GroupStatus = 'active' | 'completed' | 'cancelled'

export interface GroupListItem {
  id: string
  nameAr: string
  nameEn: string
  status: GroupStatus
  maxCapacity: number
  enrolledCount: number
  startDate: string
  endDate?: string
  service: { id: string; nameAr: string }
  employee: { id: string; user: { firstName: string; lastName: string } }
  createdAt: string
}

export interface GroupListQuery {
  page?: number
  perPage?: number
  search?: string
  status?: string
}
```

- [ ] Create `packages/api-client/src/modules/intake-forms.ts`:

```ts
import { apiRequest } from '../client.js'
import { buildQueryString } from '../types/api.js'
import type {
  IntakeFormListItem,
  IntakeFormDetail,
  IntakeFormListQuery,
  CreateIntakeFormPayload,
  UpdateIntakeFormPayload,
} from '../types/intake-form.js'
import type { PaginatedResponse } from '../types/api.js'

export async function list(query: IntakeFormListQuery = {}): Promise<PaginatedResponse<IntakeFormListItem>> {
  return apiRequest<PaginatedResponse<IntakeFormListItem>>(
    `/intake-forms${buildQueryString(query as Record<string, unknown>)}`,
  )
}

export async function get(id: string): Promise<IntakeFormDetail> {
  return apiRequest<IntakeFormDetail>(`/intake-forms/${id}`)
}

export async function create(payload: CreateIntakeFormPayload): Promise<IntakeFormDetail> {
  return apiRequest<IntakeFormDetail>('/intake-forms', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function update(id: string, payload: UpdateIntakeFormPayload): Promise<IntakeFormDetail> {
  return apiRequest<IntakeFormDetail>(`/intake-forms/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function remove(id: string): Promise<void> {
  return apiRequest<void>(`/intake-forms/${id}`, { method: 'DELETE' })
}
```

- [ ] Create `packages/api-client/src/modules/notifications.ts`:

```ts
import { apiRequest } from '../client.js'
import { buildQueryString } from '../types/api.js'
import type {
  NotificationListItem,
  NotificationListQuery,
  UnreadCountResponse,
} from '../types/notification.js'
import type { PaginatedResponse } from '../types/api.js'

export async function list(query: NotificationListQuery = {}): Promise<PaginatedResponse<NotificationListItem>> {
  return apiRequest<PaginatedResponse<NotificationListItem>>(
    `/notifications${buildQueryString(query as Record<string, unknown>)}`,
  )
}

export async function unreadCount(): Promise<UnreadCountResponse> {
  return apiRequest<UnreadCountResponse>('/notifications/unread-count')
}

export async function markRead(id: string): Promise<void> {
  return apiRequest<void>(`/notifications/${id}/read`, { method: 'PATCH' })
}

export async function markAllRead(): Promise<void> {
  return apiRequest<void>('/notifications/read-all', { method: 'PATCH' })
}
```

- [ ] Create `packages/api-client/src/modules/reports.ts`:

```ts
import { apiRequest } from '../client.js'
import { buildQueryString } from '../types/api.js'
import type { RevenueReport, BookingReport, DashboardStats, ReportDateParams } from '../types/report.js'

export async function revenue(params: ReportDateParams = {}): Promise<RevenueReport> {
  return apiRequest<RevenueReport>(`/reports/revenue${buildQueryString(params as Record<string, unknown>)}`)
}

export async function bookings(params: ReportDateParams = {}): Promise<BookingReport> {
  return apiRequest<BookingReport>(`/reports/bookings${buildQueryString(params as Record<string, unknown>)}`)
}

export async function dashboard(): Promise<DashboardStats> {
  return apiRequest<DashboardStats>('/reports/dashboard')
}

export async function exportRevenue(params: ReportDateParams = {}): Promise<Blob> {
  return apiRequest<Blob>(`/reports/revenue/export${buildQueryString(params as Record<string, unknown>)}`)
}

export async function exportBookings(params: ReportDateParams = {}): Promise<Blob> {
  return apiRequest<Blob>(`/reports/bookings/export${buildQueryString(params as Record<string, unknown>)}`)
}

export async function exportClients(): Promise<Blob> {
  return apiRequest<Blob>('/reports/clients/export')
}
```

- [ ] Create `packages/api-client/src/modules/chatbot-admin.ts`:

```ts
import { apiRequest } from '../client.js'
import type {
  ChatbotConfig,
  ChatbotAnalytics,
  ChatbotTopQuestion,
  UpdateChatbotConfigPayload,
} from '../types/chatbot-admin.js'

export async function getConfig(): Promise<ChatbotConfig[]> {
  return apiRequest<ChatbotConfig[]>('/chatbot/admin/config')
}

export async function updateConfig(payload: UpdateChatbotConfigPayload): Promise<ChatbotConfig[]> {
  return apiRequest<ChatbotConfig[]>('/chatbot/admin/config', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function seedConfig(): Promise<void> {
  return apiRequest<void>('/chatbot/admin/config/seed', { method: 'POST' })
}

export async function analytics(): Promise<ChatbotAnalytics> {
  return apiRequest<ChatbotAnalytics>('/chatbot/admin/analytics')
}

export async function topQuestions(): Promise<ChatbotTopQuestion[]> {
  return apiRequest<ChatbotTopQuestion[]>('/chatbot/admin/analytics/questions')
}
```

- [ ] Create `packages/api-client/src/modules/groups.ts`:

```ts
import { apiRequest } from '../client.js'
import { buildQueryString } from '../types/api.js'
import type { GroupListItem, GroupListQuery } from '../types/group.js'
import type { PaginatedResponse } from '../types/api.js'

export async function list(query: GroupListQuery = {}): Promise<PaginatedResponse<GroupListItem>> {
  return apiRequest<PaginatedResponse<GroupListItem>>(
    `/groups${buildQueryString(query as Record<string, unknown>)}`,
  )
}

export async function get(id: string): Promise<GroupListItem> {
  return apiRequest<GroupListItem>(`/groups/${id}`)
}
```

- [ ] Append to `packages/api-client/src/types/index.ts` (after last export):

```ts
export type {
  FormType,
  FormScope,
  IntakeFormField,
  IntakeFormListItem,
  IntakeFormDetail,
  IntakeFormListQuery,
  CreateIntakeFormPayload,
  UpdateIntakeFormPayload,
} from './intake-form.js'
export type {
  NotificationListItem,
  NotificationListQuery,
  UnreadCountResponse,
} from './notification.js'
export type {
  RevenueByMonth,
  RevenueByEmployee,
  RevenueByService,
  RevenueReport,
  BookingReport,
  DashboardStats,
  ReportDateParams,
} from './report.js'
export type {
  ChatbotConfig,
  ChatbotAnalytics,
  ChatbotTopQuestion,
  UpdateChatbotConfigPayload,
} from './chatbot-admin.js'
export type {
  GroupStatus,
  GroupListItem,
  GroupListQuery,
} from './group.js'
```

- [ ] Append to `packages/api-client/src/index.ts` (after last export line):

```ts
export * as intakeFormsApi from './modules/intake-forms.js'
export * as notificationsApi from './modules/notifications.js'
export * as reportsApi from './modules/reports.js'
export * as chatbotAdminApi from './modules/chatbot-admin.js'
export * as groupsApi from './modules/groups.js'
```

- [ ] Append to `apps/leaderboard/src/lib/query-keys.ts` (before the closing `} as const`):

```ts
  intakeForms: {
    all: ['intake-forms'] as const,
    list: (params: Record<string, unknown>) => ['intake-forms', 'list', params] as const,
    detail: (id: string) => ['intake-forms', id] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    list: (params: Record<string, unknown>) => ['notifications', 'list', params] as const,
    unreadCount: ['notifications', 'unread-count'] as const,
  },
  reports: {
    revenue: (params: Record<string, unknown>) => ['reports', 'revenue', params] as const,
    bookings: (params: Record<string, unknown>) => ['reports', 'bookings', params] as const,
    dashboard: ['reports', 'dashboard'] as const,
  },
  chatbot: {
    config: ['chatbot', 'config'] as const,
    analytics: ['chatbot', 'analytics'] as const,
    topQuestions: ['chatbot', 'top-questions'] as const,
  },
  groups: {
    all: ['groups'] as const,
    list: (params: Record<string, unknown>) => ['groups', 'list', params] as const,
    detail: (id: string) => ['groups', id] as const,
  },
```

- [ ] Run: `cd /Users/tariq/Documents/my_programs/Deqah && npm run typecheck --filter=@deqah/api-client 2>&1 | tail -5`
  Expected: no errors

- [ ] Commit:
  ```
  feat(api-client): add intake-forms, notifications, reports, chatbot-admin, groups modules
  ```

---

## Task 2 — Intake Forms hooks

**Files:**
- Create `apps/leaderboard/src/hooks/use-intake-forms.ts`

### Steps

- [ ] Create `apps/leaderboard/src/hooks/use-intake-forms.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { intakeFormsApi } from '@deqah/api-client'
import type {
  IntakeFormListQuery,
  CreateIntakeFormPayload,
  UpdateIntakeFormPayload,
} from '@deqah/api-client'
import { QUERY_KEYS } from '@/lib/query-keys'

export function useIntakeForms(query: IntakeFormListQuery = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.intakeForms.list(query as Record<string, unknown>),
    queryFn: () => intakeFormsApi.list(query),
  })
}

export function useIntakeForm(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.intakeForms.detail(id),
    queryFn: () => intakeFormsApi.get(id),
    enabled: !!id,
  })
}

export function useCreateIntakeForm() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: CreateIntakeFormPayload) => intakeFormsApi.create(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.intakeForms.all }),
  })
}

export function useUpdateIntakeForm(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: UpdateIntakeFormPayload) => intakeFormsApi.update(id, p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.intakeForms.detail(id) })
      qc.invalidateQueries({ queryKey: QUERY_KEYS.intakeForms.all })
    },
  })
}

export function useDeleteIntakeForm() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => intakeFormsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.intakeForms.all }),
  })
}
```

- [ ] Run: `cd /Users/tariq/Documents/my_programs/Deqah/apps/leaderboard && npm run typecheck 2>&1 | tail -5`
  Expected: no errors

- [ ] Commit:
  ```
  feat(leaderboard): add use-intake-forms hooks
  ```

---

## Task 3 — Intake Forms list page

**Files:**
- Create `apps/leaderboard/src/routes/_dashboard/intake-forms/index.tsx`

### Steps

- [ ] Create `apps/leaderboard/src/routes/_dashboard/intake-forms/index.tsx`:

```tsx
import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import type { IntakeFormListItem, IntakeFormListQuery, FormType, FormScope } from '@deqah/api-client'
import { useIntakeForms, useDeleteIntakeForm } from '@/hooks/use-intake-forms'
import { PageHeader } from '@/components/shared/page-header'
import { StatsGrid } from '@/components/shared/stats-grid'
import { FilterBar } from '@/components/shared/filter-bar'
import { DataTable } from '@/components/shared/data-table'
import { SkeletonPage } from '@/components/shared/skeleton-page'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export const Route = createFileRoute('/_dashboard/intake-forms/')({
  component: IntakeFormsPage,
})

const TYPE_LABELS: Record<FormType, string> = {
  pre_booking: 'قبل الحجز',
  pre_session: 'قبل الجلسة',
  post_session: 'بعد الجلسة',
  registration: 'تسجيل',
}

const SCOPE_LABELS: Record<FormScope, string> = {
  global: 'عام',
  service: 'خدمة',
  employee: 'ممارس',
  branch: 'فرع',
}

function IntakeFormsPage() {
  const [query, setQuery] = useState<IntakeFormListQuery>({ page: 1, perPage: 20 })
  const listQuery = useIntakeForms(query)
  const deleteMutation = useDeleteIntakeForm()

  if (listQuery.isLoading) return <SkeletonPage />

  const forms = listQuery.data?.items ?? []
  const meta = listQuery.data?.meta

  const total = meta?.total ?? 0
  const active = forms.filter((f) => f.isActive).length
  const inactive = forms.filter((f) => !f.isActive).length

  const statCards = [
    { label: 'إجمالي النماذج', value: total, icon: 'hgi-file-01', variant: 'primary' as const },
    { label: 'نشطة', value: active, icon: 'hgi-checkmark-circle-02', variant: 'success' as const },
    { label: 'معطّلة', value: inactive, icon: 'hgi-cancel-circle', variant: 'warning' as const },
    { label: 'نماذج عامة', value: forms.filter((f) => f.scope === 'global').length, icon: 'hgi-globe-02', variant: 'accent' as const },
  ]

  const columns = [
    {
      key: 'name',
      header: 'الاسم',
      render: (f: IntakeFormListItem) => (
        <span className="font-medium text-[var(--fg)]">{f.nameAr}</span>
      ),
    },
    {
      key: 'type',
      header: 'النوع',
      render: (f: IntakeFormListItem) => (
        <span className="text-sm text-[var(--fg-2)]">{TYPE_LABELS[f.type]}</span>
      ),
    },
    {
      key: 'scope',
      header: 'النطاق',
      render: (f: IntakeFormListItem) => (
        <span className="text-sm text-[var(--fg-2)]">{SCOPE_LABELS[f.scope]}</span>
      ),
    },
    {
      key: 'fieldCount',
      header: 'الحقول',
      render: (f: IntakeFormListItem) => (
        <span className="text-sm text-[var(--fg-2)]">{f.fieldCount}</span>
      ),
    },
    {
      key: 'status',
      header: 'الحالة',
      render: (f: IntakeFormListItem) =>
        f.isActive ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs border bg-[var(--success-bg)] text-[var(--success)] border-[color:var(--success)]/30">
            نشط
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs border bg-[var(--surface)] text-[var(--muted)] border-[var(--border-soft)]">
            معطّل
          </span>
        ),
    },
    {
      key: 'createdAt',
      header: 'تاريخ الإنشاء',
      render: (f: IntakeFormListItem) => (
        <span className="text-sm text-[var(--fg-2)]">
          {new Date(f.createdAt).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' })}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (f: IntakeFormListItem) => (
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to="/intake-forms/$id"
                params={{ id: f.id }}
                className="inline-flex items-center justify-center size-9 rounded-[var(--radius-sm)] hover:bg-[var(--surface)] text-[var(--fg-2)] transition-colors"
              >
                <i className="hgi hgi-edit-02" />
              </Link>
            </TooltipTrigger>
            <TooltipContent>تعديل</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => { if (confirm('حذف النموذج؟')) deleteMutation.mutate(f.id) }}
                className="inline-flex items-center justify-center size-9 rounded-[var(--radius-sm)] hover:bg-[var(--danger-bg)] text-[var(--fg-2)] hover:text-[var(--danger)] transition-colors"
              >
                <i className="hgi hgi-delete-02" />
              </button>
            </TooltipTrigger>
            <TooltipContent>حذف</TooltipContent>
          </Tooltip>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="نماذج الاستقبال"
        description="إدارة نماذج البيانات المرتبطة بالحجوزات والجلسات"
        actions={
          <div className="flex items-center gap-2">
            <Link to="/intake-forms/new">
              <Button>
                <i className="hgi hgi-add-01 me-2" />
                نموذج جديد
              </Button>
            </Link>
          </div>
        }
      />
      <StatsGrid stats={statCards} loading={listQuery.isLoading} />
      <FilterBar
        search={query.search ?? ''}
        onSearchChange={(s) => setQuery((q) => ({ ...q, search: s || undefined, page: 1 }))}
        onReset={() => setQuery({ page: 1, perPage: 20 })}
        placeholder="ابحث باسم النموذج..."
      />
      <DataTable
        columns={columns}
        data={forms}
        keyExtractor={(f) => f.id}
        loading={listQuery.isFetching}
        emptyMessage="لا توجد نماذج"
      />
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-[var(--muted)]">الصفحة {meta.page} من {meta.totalPages}</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setQuery((q) => ({ ...q, page: Math.max(1, (q.page ?? 1) - 1) }))}
              disabled={meta.page <= 1}
              className="glass h-9 px-4 rounded-[var(--radius-sm)] text-sm text-[var(--fg)] disabled:opacity-50"
            >
              السابق
            </button>
            <button
              onClick={() => setQuery((q) => ({ ...q, page: (q.page ?? 1) + 1 }))}
              disabled={meta.page >= meta.totalPages}
              className="glass h-9 px-4 rounded-[var(--radius-sm)] text-sm text-[var(--fg)] disabled:opacity-50"
            >
              التالي
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] Run: `cd /Users/tariq/Documents/my_programs/Deqah/apps/leaderboard && npm run typecheck 2>&1 | tail -5`
  Expected: no errors

- [ ] Commit:
  ```
  feat(leaderboard): add intake-forms list page
  ```

---

## Task 4 — Intake Form new page

**Files:**
- Create `apps/leaderboard/src/routes/_dashboard/intake-forms/new.tsx`

### Steps

- [ ] Create `apps/leaderboard/src/routes/_dashboard/intake-forms/new.tsx`:

```tsx
import { useState } from 'react'
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import type { CreateIntakeFormPayload, FormType, FormScope } from '@deqah/api-client'
import { useCreateIntakeForm } from '@/hooks/use-intake-forms'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/_dashboard/intake-forms/new')({
  component: NewIntakeFormPage,
})

function NewIntakeFormPage() {
  const navigate = useNavigate()
  const createMutation = useCreateIntakeForm()

  const [form, setForm] = useState<CreateIntakeFormPayload>({
    nameAr: '',
    nameEn: '',
    type: 'pre_booking',
    scope: 'global',
  })

  const [errors, setErrors] = useState<Partial<Record<keyof CreateIntakeFormPayload, string>>>({})

  function validate(): boolean {
    const next: typeof errors = {}
    if (!form.nameAr.trim()) next.nameAr = 'الاسم العربي مطلوب'
    if (!form.nameEn.trim()) next.nameEn = 'الاسم الإنجليزي مطلوب'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    await createMutation.mutateAsync(form)
    navigate({ to: '/intake-forms' })
  }

  const typeOptions: Array<{ value: FormType; label: string }> = [
    { value: 'pre_booking', label: 'قبل الحجز' },
    { value: 'pre_session', label: 'قبل الجلسة' },
    { value: 'post_session', label: 'بعد الجلسة' },
    { value: 'registration', label: 'تسجيل' },
  ]

  const scopeOptions: Array<{ value: FormScope; label: string }> = [
    { value: 'global', label: 'عام' },
    { value: 'service', label: 'خدمة' },
    { value: 'employee', label: 'ممارس' },
    { value: 'branch', label: 'فرع' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="نموذج جديد"
        description="إنشاء نموذج استقبال جديد"
        actions={
          <Link to="/intake-forms">
            <Button variant="outline">رجوع</Button>
          </Link>
        }
      />
      <form onSubmit={handleSubmit} className="glass rounded-[var(--radius)] p-6 space-y-5 max-w-2xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[var(--fg)]">الاسم العربي</label>
            <input
              value={form.nameAr}
              onChange={(e) => setForm((f) => ({ ...f, nameAr: e.target.value }))}
              className="w-full h-10 px-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] text-[var(--fg)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
              placeholder="نموذج قبل الجلسة"
              dir="rtl"
            />
            {errors.nameAr && <p className="text-xs text-[var(--danger)]">{errors.nameAr}</p>}
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[var(--fg)]">الاسم الإنجليزي</label>
            <input
              value={form.nameEn}
              onChange={(e) => setForm((f) => ({ ...f, nameEn: e.target.value }))}
              className="w-full h-10 px-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] text-[var(--fg)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
              placeholder="Pre-session Form"
              dir="ltr"
            />
            {errors.nameEn && <p className="text-xs text-[var(--danger)]">{errors.nameEn}</p>}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[var(--fg)]">نوع النموذج</label>
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as FormType }))}
              className="w-full h-10 px-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] text-[var(--fg)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
            >
              {typeOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[var(--fg)]">النطاق</label>
            <select
              value={form.scope}
              onChange={(e) => setForm((f) => ({ ...f, scope: e.target.value as FormScope }))}
              className="w-full h-10 px-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] text-[var(--fg)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
            >
              {scopeOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
        {form.scope === 'service' && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[var(--fg)]">معرّف الخدمة</label>
            <input
              value={form.serviceId ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, serviceId: e.target.value || undefined }))}
              className="w-full h-10 px-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] text-[var(--fg)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
              placeholder="service-id"
              dir="ltr"
            />
          </div>
        )}
        {form.scope === 'employee' && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[var(--fg)]">معرّف الممارس</label>
            <input
              value={form.employeeId ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value || undefined }))}
              className="w-full h-10 px-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] text-[var(--fg)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
              placeholder="employee-id"
              dir="ltr"
            />
          </div>
        )}
        {form.scope === 'branch' && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[var(--fg)]">معرّف الفرع</label>
            <input
              value={form.branchId ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, branchId: e.target.value || undefined }))}
              className="w-full h-10 px-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] text-[var(--fg)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
              placeholder="branch-id"
              dir="ltr"
            />
          </div>
        )}
        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'جاري الحفظ...' : 'حفظ النموذج'}
          </Button>
          <Link to="/intake-forms">
            <Button type="button" variant="outline">إلغاء</Button>
          </Link>
        </div>
        {createMutation.isError && (
          <p className="text-sm text-[var(--danger)]">حدث خطأ أثناء الحفظ. حاول مرة أخرى.</p>
        )}
      </form>
    </div>
  )
}
```

- [ ] Run: `cd /Users/tariq/Documents/my_programs/Deqah/apps/leaderboard && npm run typecheck 2>&1 | tail -5`
  Expected: no errors

- [ ] Commit:
  ```
  feat(leaderboard): add intake-forms new page
  ```

---

## Task 5 — Intake Form edit page

**Files:**
- Create `apps/leaderboard/src/routes/_dashboard/intake-forms/$id.tsx`

### Steps

- [ ] Create `apps/leaderboard/src/routes/_dashboard/intake-forms/$id.tsx`:

```tsx
import { useState, useEffect } from 'react'
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import type { UpdateIntakeFormPayload, FormType, FormScope, IntakeFormField } from '@deqah/api-client'
import { useIntakeForm, useUpdateIntakeForm, useDeleteIntakeForm } from '@/hooks/use-intake-forms'
import { PageHeader } from '@/components/shared/page-header'
import { SkeletonPage } from '@/components/shared/skeleton-page'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/_dashboard/intake-forms/$id')({
  component: EditIntakeFormPage,
})

const FIELD_TYPE_LABELS: Record<IntakeFormField['type'], string> = {
  text: 'نص قصير',
  textarea: 'نص طويل',
  select: 'قائمة منسدلة',
  checkbox: 'مربع اختيار',
  radio: 'اختيار واحد',
  date: 'تاريخ',
}

const TYPE_OPTIONS: Array<{ value: FormType; label: string }> = [
  { value: 'pre_booking', label: 'قبل الحجز' },
  { value: 'pre_session', label: 'قبل الجلسة' },
  { value: 'post_session', label: 'بعد الجلسة' },
  { value: 'registration', label: 'تسجيل' },
]

const SCOPE_OPTIONS: Array<{ value: FormScope; label: string }> = [
  { value: 'global', label: 'عام' },
  { value: 'service', label: 'خدمة' },
  { value: 'employee', label: 'ممارس' },
  { value: 'branch', label: 'فرع' },
]

function EditIntakeFormPage() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const formQuery = useIntakeForm(id)
  const updateMutation = useUpdateIntakeForm(id)
  const deleteMutation = useDeleteIntakeForm()

  const [form, setForm] = useState<UpdateIntakeFormPayload>({})

  useEffect(() => {
    if (formQuery.data) {
      const d = formQuery.data
      setForm({
        nameAr: d.nameAr,
        nameEn: d.nameEn,
        type: d.type,
        scope: d.scope,
        isActive: d.isActive,
        serviceId: d.serviceId,
        employeeId: d.employeeId,
        branchId: d.branchId,
      })
    }
  }, [formQuery.data])

  if (formQuery.isLoading) return <SkeletonPage />
  if (!formQuery.data) return <p className="text-[var(--muted)]">النموذج غير موجود</p>

  const data = formQuery.data

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await updateMutation.mutateAsync(form)
    navigate({ to: '/intake-forms' })
  }

  async function handleDelete() {
    if (!confirm('حذف هذا النموذج نهائياً؟')) return
    await deleteMutation.mutateAsync(id)
    navigate({ to: '/intake-forms' })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={data.nameAr}
        description="تعديل نموذج الاستقبال"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleDelete} disabled={deleteMutation.isPending}>
              <i className="hgi hgi-delete-02 me-2" />
              حذف
            </Button>
            <Link to="/intake-forms">
              <Button variant="outline">رجوع</Button>
            </Link>
          </div>
        }
      />
      <form onSubmit={handleSubmit} className="glass rounded-[var(--radius)] p-6 space-y-5 max-w-2xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[var(--fg)]">الاسم العربي</label>
            <input
              value={form.nameAr ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, nameAr: e.target.value }))}
              className="w-full h-10 px-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] text-[var(--fg)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
              dir="rtl"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[var(--fg)]">الاسم الإنجليزي</label>
            <input
              value={form.nameEn ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, nameEn: e.target.value }))}
              className="w-full h-10 px-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] text-[var(--fg)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
              dir="ltr"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[var(--fg)]">نوع النموذج</label>
            <select
              value={form.type ?? 'pre_booking'}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as FormType }))}
              className="w-full h-10 px-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] text-[var(--fg)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
            >
              {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[var(--fg)]">النطاق</label>
            <select
              value={form.scope ?? 'global'}
              onChange={(e) => setForm((f) => ({ ...f, scope: e.target.value as FormScope }))}
              className="w-full h-10 px-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] text-[var(--fg)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
            >
              {SCOPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive ?? false}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              className="w-4 h-4 accent-[var(--primary)]"
            />
            <span className="text-sm text-[var(--fg)]">نموذج نشط</span>
          </label>
        </div>
        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'جاري الحفظ...' : 'حفظ التغييرات'}
          </Button>
          <Link to="/intake-forms">
            <Button type="button" variant="outline">إلغاء</Button>
          </Link>
        </div>
        {updateMutation.isError && (
          <p className="text-sm text-[var(--danger)]">حدث خطأ أثناء الحفظ. حاول مرة أخرى.</p>
        )}
      </form>

      {data.fields.length > 0 && (
        <div className="glass rounded-[var(--radius)] p-6 max-w-2xl space-y-3">
          <h3 className="text-sm font-semibold text-[var(--fg)]">حقول النموذج ({data.fields.length})</h3>
          <p className="text-xs text-[var(--muted)]">تعديل الحقول متاح عبر API مباشرة (PUT /intake-forms/{id}/fields)</p>
          <div className="space-y-2">
            {[...data.fields].sort((a, b) => a.order - b.order).map((field) => (
              <div key={field.id} className="flex items-center gap-3 p-3 rounded-[var(--radius-sm)] bg-[var(--surface)] border border-[var(--border-soft)]">
                <span className="text-xs text-[var(--muted)] w-6 text-center">{field.order}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--fg)] truncate">{field.labelAr}</p>
                  <p className="text-xs text-[var(--muted)]">{FIELD_TYPE_LABELS[field.type]}{field.required ? ' · مطلوب' : ''}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] Run: `cd /Users/tariq/Documents/my_programs/Deqah/apps/leaderboard && npm run typecheck 2>&1 | tail -5`
  Expected: no errors

- [ ] Commit:
  ```
  feat(leaderboard): add intake-forms edit page
  ```

---

## Task 6 — Notifications hooks + list page

**Files:**
- Create `apps/leaderboard/src/hooks/use-notifications.ts`
- Create `apps/leaderboard/src/routes/_dashboard/notifications/index.tsx`

### Steps

- [ ] Create `apps/leaderboard/src/hooks/use-notifications.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { notificationsApi } from '@deqah/api-client'
import type { NotificationListQuery } from '@deqah/api-client'
import { QUERY_KEYS } from '@/lib/query-keys'

export function useNotifications(query: NotificationListQuery = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.notifications.list(query as Record<string, unknown>),
    queryFn: () => notificationsApi.list(query),
  })
}

export function useUnreadCount() {
  return useQuery({
    queryKey: QUERY_KEYS.notifications.unreadCount,
    queryFn: () => notificationsApi.unreadCount(),
    refetchInterval: 60_000,
  })
}

export function useMarkRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.notifications.all })
    },
  })
}

export function useMarkAllRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.notifications.all })
    },
  })
}
```

- [ ] Create `apps/leaderboard/src/routes/_dashboard/notifications/index.tsx`:

```tsx
import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import type { NotificationListItem, NotificationListQuery } from '@deqah/api-client'
import { useNotifications, useUnreadCount, useMarkRead, useMarkAllRead } from '@/hooks/use-notifications'
import { PageHeader } from '@/components/shared/page-header'
import { StatsGrid } from '@/components/shared/stats-grid'
import { FilterBar } from '@/components/shared/filter-bar'
import { DataTable } from '@/components/shared/data-table'
import { SkeletonPage } from '@/components/shared/skeleton-page'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export const Route = createFileRoute('/_dashboard/notifications/')({
  component: NotificationsPage,
})

function NotificationsPage() {
  const [query, setQuery] = useState<NotificationListQuery>({ page: 1, perPage: 20 })
  const listQuery = useNotifications(query)
  const unreadQuery = useUnreadCount()
  const markRead = useMarkRead()
  const markAllRead = useMarkAllRead()

  if (listQuery.isLoading) return <SkeletonPage />

  const notifications = listQuery.data?.items ?? []
  const meta = listQuery.data?.meta
  const unread = unreadQuery.data?.count ?? 0

  const statCards = [
    { label: 'الإجمالي', value: meta?.total ?? 0, icon: 'hgi-notification-02', variant: 'primary' as const },
    { label: 'غير مقروءة', value: unread, icon: 'hgi-alert-circle', variant: 'warning' as const },
    { label: 'مقروءة', value: (meta?.total ?? 0) - unread, icon: 'hgi-checkmark-circle-02', variant: 'success' as const },
    { label: 'اليوم', value: notifications.filter((n) => new Date(n.createdAt).toDateString() === new Date().toDateString()).length, icon: 'hgi-clock-02', variant: 'accent' as const },
  ]

  const columns = [
    {
      key: 'status',
      header: '',
      render: (n: NotificationListItem) => (
        <span className={`inline-block w-2 h-2 rounded-full ${n.isRead ? 'bg-[var(--border)]' : 'bg-[var(--primary)]'}`} />
      ),
    },
    {
      key: 'title',
      header: 'العنوان',
      render: (n: NotificationListItem) => (
        <span className={`font-medium ${n.isRead ? 'text-[var(--fg-2)]' : 'text-[var(--fg)]'}`}>{n.title}</span>
      ),
    },
    {
      key: 'body',
      header: 'المحتوى',
      render: (n: NotificationListItem) => (
        <span className="text-sm text-[var(--fg-2)] line-clamp-1">{n.body}</span>
      ),
    },
    {
      key: 'type',
      header: 'النوع',
      render: (n: NotificationListItem) => (
        <span className="text-xs text-[var(--muted)] bg-[var(--surface)] px-2 py-0.5 rounded-full border border-[var(--border-soft)]">{n.type}</span>
      ),
    },
    {
      key: 'createdAt',
      header: 'التاريخ',
      render: (n: NotificationListItem) => (
        <span className="text-sm text-[var(--fg-2)]">
          {new Date(n.createdAt).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' })}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (n: NotificationListItem) =>
        !n.isRead ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => markRead.mutate(n.id)}
                disabled={markRead.isPending}
                className="inline-flex items-center justify-center size-9 rounded-[var(--radius-sm)] hover:bg-[var(--surface)] text-[var(--fg-2)] transition-colors"
              >
                <i className="hgi hgi-checkmark-circle-02" />
              </button>
            </TooltipTrigger>
            <TooltipContent>تحديد كمقروء</TooltipContent>
          </Tooltip>
        ) : null,
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="الإشعارات"
        description="إشعارات النظام والتنبيهات"
        actions={
          unread > 0 ? (
            <Button variant="outline" onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending}>
              <i className="hgi hgi-checkmark-double-02 me-2" />
              تحديد الكل كمقروء
            </Button>
          ) : undefined
        }
      />
      <StatsGrid stats={statCards} loading={listQuery.isLoading} />
      <FilterBar
        search={''}
        onSearchChange={() => undefined}
        onReset={() => setQuery({ page: 1, perPage: 20 })}
        placeholder="بحث..."
      />
      <DataTable
        columns={columns}
        data={notifications}
        keyExtractor={(n) => n.id}
        loading={listQuery.isFetching}
        emptyMessage="لا توجد إشعارات"
      />
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-[var(--muted)]">الصفحة {meta.page} من {meta.totalPages}</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setQuery((q) => ({ ...q, page: Math.max(1, (q.page ?? 1) - 1) }))}
              disabled={meta.page <= 1}
              className="glass h-9 px-4 rounded-[var(--radius-sm)] text-sm text-[var(--fg)] disabled:opacity-50"
            >
              السابق
            </button>
            <button
              onClick={() => setQuery((q) => ({ ...q, page: (q.page ?? 1) + 1 }))}
              disabled={meta.page >= meta.totalPages}
              className="glass h-9 px-4 rounded-[var(--radius-sm)] text-sm text-[var(--fg)] disabled:opacity-50"
            >
              التالي
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] Run: `cd /Users/tariq/Documents/my_programs/Deqah/apps/leaderboard && npm run typecheck 2>&1 | tail -5`
  Expected: no errors

- [ ] Commit:
  ```
  feat(leaderboard): add notifications hooks and list page
  ```

---

## Task 7 — Chatbot Admin page

**Files:**
- Create `apps/leaderboard/src/hooks/use-chatbot-admin.ts`
- Create `apps/leaderboard/src/routes/_dashboard/chatbot/index.tsx`

### Steps

- [ ] Create `apps/leaderboard/src/hooks/use-chatbot-admin.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { chatbotAdminApi } from '@deqah/api-client'
import type { UpdateChatbotConfigPayload } from '@deqah/api-client'
import { QUERY_KEYS } from '@/lib/query-keys'

export function useChatbotConfig() {
  return useQuery({
    queryKey: QUERY_KEYS.chatbot.config,
    queryFn: () => chatbotAdminApi.getConfig(),
  })
}

export function useChatbotAnalytics() {
  return useQuery({
    queryKey: QUERY_KEYS.chatbot.analytics,
    queryFn: () => chatbotAdminApi.analytics(),
  })
}

export function useChatbotTopQuestions() {
  return useQuery({
    queryKey: QUERY_KEYS.chatbot.topQuestions,
    queryFn: () => chatbotAdminApi.topQuestions(),
  })
}

export function useUpdateChatbotConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: UpdateChatbotConfigPayload) => chatbotAdminApi.updateConfig(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.chatbot.config }),
  })
}

export function useSeedChatbotConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => chatbotAdminApi.seedConfig(),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.chatbot.config }),
  })
}
```

- [ ] Create `apps/leaderboard/src/routes/_dashboard/chatbot/index.tsx`:

```tsx
import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import type { ChatbotConfig } from '@deqah/api-client'
import {
  useChatbotConfig,
  useChatbotAnalytics,
  useChatbotTopQuestions,
  useUpdateChatbotConfig,
  useSeedChatbotConfig,
} from '@/hooks/use-chatbot-admin'
import { PageHeader } from '@/components/shared/page-header'
import { StatsGrid } from '@/components/shared/stats-grid'
import { SkeletonPage } from '@/components/shared/skeleton-page'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/_dashboard/chatbot/')({
  component: ChatbotAdminPage,
})

function ChatbotAdminPage() {
  const configQuery = useChatbotConfig()
  const analyticsQuery = useChatbotAnalytics()
  const topQuestionsQuery = useChatbotTopQuestions()
  const updateConfig = useUpdateChatbotConfig()
  const seedConfig = useSeedChatbotConfig()

  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  if (configQuery.isLoading || analyticsQuery.isLoading) return <SkeletonPage />

  const configs = configQuery.data ?? []
  const analytics = analyticsQuery.data
  const topQuestions = topQuestionsQuery.data ?? []

  const statCards = [
    { label: 'إجمالي الجلسات', value: analytics?.totalSessions ?? 0, icon: 'hgi-bot', variant: 'primary' as const },
    { label: 'جلسات نشطة', value: analytics?.activeSessions ?? 0, icon: 'hgi-activity-02', variant: 'success' as const },
    { label: 'متوسط الرسائل', value: analytics?.avgMessagesPerSession ?? 0, icon: 'hgi-message-02', variant: 'accent' as const },
    { label: 'معدل الرضا', value: analytics ? `${Math.round(analytics.satisfactionRate * 100)}%` : '—', icon: 'hgi-star', variant: 'warning' as const },
  ]

  function startEdit(cfg: ChatbotConfig) {
    setEditingKey(cfg.key)
    setEditValue(cfg.value)
  }

  function cancelEdit() {
    setEditingKey(null)
    setEditValue('')
  }

  async function saveEdit(key: string) {
    await updateConfig.mutateAsync({ configs: [{ key, value: editValue }] })
    setEditingKey(null)
    setEditValue('')
  }

  const groupedConfigs = configs.reduce<Record<string, ChatbotConfig[]>>((acc, cfg) => {
    const cat = cfg.category ?? 'عام'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(cfg)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <PageHeader
        title="إعدادات الشاتبوت"
        description="إدارة إعدادات وتحليلات مساعد الذكاء الاصطناعي"
        actions={
          <Button variant="outline" onClick={() => seedConfig.mutate()} disabled={seedConfig.isPending}>
            <i className="hgi hgi-refresh me-2" />
            إعادة تهيئة الإعدادات
          </Button>
        }
      />
      <StatsGrid stats={statCards} loading={analyticsQuery.isLoading} />

      {topQuestions.length > 0 && (
        <div className="glass rounded-[var(--radius)] p-5 space-y-3">
          <h3 className="text-sm font-semibold text-[var(--fg)]">الأسئلة الأكثر تكراراً</h3>
          <div className="space-y-2">
            {topQuestions.slice(0, 10).map((q, i) => (
              <div key={q.question} className="flex items-center gap-3">
                <span className="text-xs text-[var(--muted)] w-5 text-center">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-sm text-[var(--fg)] truncate">{q.question}</p>
                    <span className="text-xs text-[var(--muted)] flex-shrink-0">{q.count}</span>
                  </div>
                  <div className="h-1 rounded-full bg-[var(--surface)] overflow-hidden">
                    <div
                      className="h-full bg-[var(--primary)] rounded-full transition-all"
                      style={{ width: `${(q.count / (topQuestions[0]?.count ?? 1)) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {Object.entries(groupedConfigs).map(([category, items]) => (
        <div key={category} className="glass rounded-[var(--radius)] p-5 space-y-3">
          <h3 className="text-sm font-semibold text-[var(--fg)]">{category}</h3>
          <div className="space-y-2">
            {items.map((cfg) => (
              <div key={cfg.key} className="flex items-center gap-3 p-3 rounded-[var(--radius-sm)] bg-[var(--surface)] border border-[var(--border-soft)]">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[var(--muted)] mb-0.5">{cfg.key}</p>
                  {editingKey === cfg.key ? (
                    <input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="w-full h-8 px-2 rounded-[var(--radius-sm)] border border-[var(--primary)] bg-[var(--bg)] text-[var(--fg)] text-sm focus:outline-none"
                      autoFocus
                    />
                  ) : (
                    <p className="text-sm text-[var(--fg)]">{cfg.value}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {editingKey === cfg.key ? (
                    <>
                      <button
                        onClick={() => saveEdit(cfg.key)}
                        disabled={updateConfig.isPending}
                        className="h-8 px-3 rounded-[var(--radius-sm)] bg-[var(--primary)] text-white text-xs hover:opacity-90 transition-opacity disabled:opacity-50"
                      >
                        حفظ
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="h-8 px-3 rounded-[var(--radius-sm)] border border-[var(--border)] text-[var(--fg-2)] text-xs hover:bg-[var(--surface)] transition-colors"
                      >
                        إلغاء
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => startEdit(cfg)}
                      className="inline-flex items-center justify-center size-8 rounded-[var(--radius-sm)] hover:bg-[var(--bg)] text-[var(--fg-2)] transition-colors"
                    >
                      <i className="hgi hgi-edit-02 text-sm" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {configs.length === 0 && !configQuery.isLoading && (
        <div className="glass rounded-[var(--radius)] p-10 text-center space-y-3">
          <i className="hgi hgi-bot text-4xl text-[var(--muted)]" />
          <p className="text-[var(--muted)]">لا توجد إعدادات. اضغط "إعادة تهيئة" لتحميل الإعدادات الافتراضية.</p>
        </div>
      )}
    </div>
  )
}
```

- [ ] Run: `cd /Users/tariq/Documents/my_programs/Deqah/apps/leaderboard && npm run typecheck 2>&1 | tail -5`
  Expected: no errors

- [ ] Commit:
  ```
  feat(leaderboard): add chatbot admin page
  ```

---

## Task 8 — Reports hooks + Revenue page

**Files:**
- Create `apps/leaderboard/src/hooks/use-reports.ts`
- Create `apps/leaderboard/src/routes/_dashboard/reports/index.tsx`

### Steps

- [ ] Create `apps/leaderboard/src/hooks/use-reports.ts`:

```ts
import { useQuery } from '@tanstack/react-query'
import { reportsApi } from '@deqah/api-client'
import type { ReportDateParams } from '@deqah/api-client'
import { QUERY_KEYS } from '@/lib/query-keys'

export function useRevenueReport(params: ReportDateParams = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.reports.revenue(params as Record<string, unknown>),
    queryFn: () => reportsApi.revenue(params),
  })
}

export function useBookingReport(params: ReportDateParams = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.reports.bookings(params as Record<string, unknown>),
    queryFn: () => reportsApi.bookings(params),
  })
}

export function useDashboardStats() {
  return useQuery({
    queryKey: QUERY_KEYS.reports.dashboard,
    queryFn: () => reportsApi.dashboard(),
  })
}

export async function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
```

- [ ] Create `apps/leaderboard/src/routes/_dashboard/reports/index.tsx`:

```tsx
import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import type { RevenueByMonth } from '@deqah/api-client'
import { useRevenueReport, useBookingReport, useDashboardStats, downloadBlob } from '@/hooks/use-reports'
import { reportsApi } from '@deqah/api-client'
import { PageHeader } from '@/components/shared/page-header'
import { StatsGrid } from '@/components/shared/stats-grid'
import { SkeletonPage } from '@/components/shared/skeleton-page'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/_dashboard/reports/')({
  component: ReportsPage,
})

function RevenueBarChart({ data }: { data: RevenueByMonth[] }) {
  const max = Math.max(...data.map((d) => d.revenue), 1)
  return (
    <div className="flex items-end gap-2 h-32">
      {data.map((d) => (
        <div key={d.month} className="flex flex-col items-center flex-1 gap-1">
          <div
            className="w-full bg-[var(--primary)] rounded-t-[var(--radius-sm)] min-h-[4px] transition-all"
            style={{ height: `${(d.revenue / max) * 100}%` }}
          />
          <span className="text-[10px] text-[var(--muted)] truncate w-full text-center">{d.month}</span>
        </div>
      ))}
    </div>
  )
}

function ReportsPage() {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [exporting, setExporting] = useState<'revenue' | 'bookings' | 'clients' | null>(null)

  const params = {
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  }

  const dashboardQuery = useDashboardStats()
  const revenueQuery = useRevenueReport(params)
  const bookingQuery = useBookingReport(params)

  if (dashboardQuery.isLoading || revenueQuery.isLoading || bookingQuery.isLoading) return <SkeletonPage />

  const dash = dashboardQuery.data
  const revenue = revenueQuery.data
  const booking = bookingQuery.data

  const statCards = [
    { label: 'إجمالي الإيرادات', value: `${(dash?.totalRevenue ?? 0).toLocaleString('ar-SA')} ر.س`, icon: 'hgi-money-bag-02', variant: 'primary' as const },
    { label: 'إجمالي الحجوزات', value: dash?.totalBookings ?? 0, icon: 'hgi-calendar-03', variant: 'success' as const },
    { label: 'المرضى', value: dash?.totalClients ?? 0, icon: 'hgi-user-multiple-02', variant: 'accent' as const },
    { label: 'الممارسون', value: dash?.totalEmployees ?? 0, icon: 'hgi-doctor-01', variant: 'warning' as const },
  ]

  async function handleExport(type: 'revenue' | 'bookings' | 'clients') {
    setExporting(type)
    try {
      let blob: Blob
      let filename: string
      if (type === 'revenue') {
        blob = await reportsApi.exportRevenue(params)
        filename = 'revenue-report.csv'
      } else if (type === 'bookings') {
        blob = await reportsApi.exportBookings(params)
        filename = 'bookings-report.csv'
      } else {
        blob = await reportsApi.exportClients()
        filename = 'clients-report.csv'
      }
      await downloadBlob(blob, filename)
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="التقارير والإحصاء"
        description="تقارير الإيرادات والحجوزات والنشاط"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => handleExport('revenue')} disabled={exporting === 'revenue'}>
              <i className="hgi hgi-download-02 me-2" />
              {exporting === 'revenue' ? 'جاري التصدير...' : 'تصدير الإيرادات'}
            </Button>
            <Button variant="outline" onClick={() => handleExport('bookings')} disabled={exporting === 'bookings'}>
              <i className="hgi hgi-download-02 me-2" />
              {exporting === 'bookings' ? 'جاري التصدير...' : 'تصدير الحجوزات'}
            </Button>
          </div>
        }
      />
      <StatsGrid stats={statCards} loading={dashboardQuery.isLoading} />

      <div className="glass rounded-[var(--radius)] p-4 flex items-center gap-4 flex-wrap">
        <label className="flex items-center gap-2 text-sm text-[var(--fg)]">
          <span>من</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-9 px-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] text-[var(--fg)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-[var(--fg)]">
          <span>إلى</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-9 px-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] text-[var(--fg)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
          />
        </label>
        {(dateFrom || dateTo) && (
          <button
            onClick={() => { setDateFrom(''); setDateTo('') }}
            className="text-sm text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
          >
            إعادة تعيين
          </button>
        )}
      </div>

      {revenue && (
        <div className="glass rounded-[var(--radius)] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--fg)]">الإيرادات الشهرية</h3>
            <div className="flex items-center gap-4 text-xs text-[var(--muted)]">
              <span>متوسط الحجز: {revenue.averagePerBooking.toLocaleString('ar-SA')} ر.س</span>
              <span>حجوزات مدفوعة: {revenue.paidBookings} / {revenue.totalBookings}</span>
            </div>
          </div>
          {revenue.byMonth.length > 0 ? (
            <RevenueBarChart data={revenue.byMonth} />
          ) : (
            <p className="text-sm text-[var(--muted)] text-center py-8">لا توجد بيانات للفترة المحددة</p>
          )}
        </div>
      )}

      {revenue && revenue.byService.length > 0 && (
        <div className="glass rounded-[var(--radius)] p-5 space-y-3">
          <h3 className="text-sm font-semibold text-[var(--fg)]">الإيرادات حسب الخدمة</h3>
          <div className="space-y-2">
            {revenue.byService.slice(0, 8).map((s) => (
              <div key={s.serviceId} className="flex items-center gap-3">
                <p className="text-sm text-[var(--fg)] flex-1 truncate">{s.name}</p>
                <span className="text-xs text-[var(--muted)]">{s.bookings} حجز</span>
                <span className="text-sm font-medium text-[var(--fg)] w-28 text-end">{s.revenue.toLocaleString('ar-SA')} ر.س</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {revenue && revenue.byEmployee.length > 0 && (
        <div className="glass rounded-[var(--radius)] p-5 space-y-3">
          <h3 className="text-sm font-semibold text-[var(--fg)]">الإيرادات حسب الممارس</h3>
          <div className="space-y-2">
            {revenue.byEmployee.slice(0, 8).map((p) => (
              <div key={p.employeeId} className="flex items-center gap-3">
                <p className="text-sm text-[var(--fg)] flex-1 truncate">{p.name}</p>
                <span className="text-xs text-[var(--muted)]">{p.bookings} حجز</span>
                <span className="text-sm font-medium text-[var(--fg)] w-28 text-end">{p.revenue.toLocaleString('ar-SA')} ر.س</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {booking && (
        <BookingBreakdown booking={booking} onExport={() => handleExport('bookings')} exporting={exporting === 'bookings'} />
      )}
    </div>
  )
}

import type { BookingReport } from '@deqah/api-client'

function BookingBreakdown({ booking, onExport, exporting }: { booking: BookingReport; onExport: () => void; exporting: boolean }) {
  const statusLabels: Record<string, string> = {
    pending: 'معلّق',
    confirmed: 'مؤكد',
    completed: 'مكتمل',
    cancelled: 'ملغي',
    pending_cancellation: 'في انتظار الإلغاء',
  }
  const typeLabels: Record<string, string> = {
    in_person: 'حضوري',
    online: 'عن بُعد',
    walk_in: 'زيارة مباشرة',
  }

  const statusEntries = Object.entries(booking.byStatus) as Array<[string, number]>
  const typeEntries = Object.entries(booking.byType) as Array<[string, number]>
  const maxDay = Math.max(...booking.byDay.map((d) => d.count), 1)

  return (
    <div className="glass rounded-[var(--radius)] p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--fg)]">تحليل الحجوزات · الإجمالي: {booking.total}</h3>
        <button
          onClick={onExport}
          disabled={exporting}
          className="text-xs text-[var(--primary)] hover:underline disabled:opacity-50"
        >
          {exporting ? 'جاري التصدير...' : 'تصدير CSV'}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <p className="text-xs font-medium text-[var(--muted)]">حسب الحالة</p>
          {statusEntries.map(([key, count]) => (
            <div key={key} className="flex items-center gap-2">
              <p className="text-sm text-[var(--fg)] flex-1">{statusLabels[key] ?? key}</p>
              <span className="text-sm font-medium text-[var(--fg)]">{count}</span>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <p className="text-xs font-medium text-[var(--muted)]">حسب النوع</p>
          {typeEntries.map(([key, count]) => (
            <div key={key} className="flex items-center gap-2">
              <p className="text-sm text-[var(--fg)] flex-1">{typeLabels[key] ?? key}</p>
              <span className="text-sm font-medium text-[var(--fg)]">{count}</span>
            </div>
          ))}
        </div>
      </div>
      {booking.byDay.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-[var(--muted)]">الحجوزات اليومية</p>
          <div className="flex items-end gap-1 h-16">
            {booking.byDay.map((d) => (
              <div key={d.date} className="flex flex-col items-center flex-1 gap-0.5" title={`${d.date}: ${d.count}`}>
                <div
                  className="w-full bg-[var(--accent)] rounded-t-sm min-h-[2px] transition-all"
                  style={{ height: `${(d.count / maxDay) * 100}%` }}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

> Note: This file is ~220 lines, within the 350-line limit. The `BookingBreakdown` component is colocated since it is route-specific and ~80 lines. If future enhancements push this over 350 lines, extract `BookingBreakdown` to `@/components/reports/booking-breakdown.tsx`.

- [ ] Run: `cd /Users/tariq/Documents/my_programs/Deqah/apps/leaderboard && npm run typecheck 2>&1 | tail -5`
  Expected: no errors

- [ ] Commit:
  ```
  feat(leaderboard): add reports hooks and revenue/booking report page
  ```

---

## Task 9 — (Merged into Task 8)

The booking breakdown and export buttons were fully implemented in Task 8 within `ReportsPage` and `BookingBreakdown`. No additional files needed. This task is a verification step only.

- [ ] Verify line count of reports/index.tsx: `wc -l apps/leaderboard/src/routes/_dashboard/reports/index.tsx`
  Expected: ≤ 350 lines

- [ ] Run: `cd /Users/tariq/Documents/my_programs/Deqah/apps/leaderboard && npm run typecheck 2>&1 | tail -5`
  Expected: no errors

---

## Task 10 — Groups list page (read-only)

**Files:**
- Create `apps/leaderboard/src/hooks/use-groups.ts`
- Create `apps/leaderboard/src/routes/_dashboard/group-sessions/index.tsx`

### Steps

- [ ] Create `apps/leaderboard/src/hooks/use-groups.ts`:

```ts
import { useQuery } from '@tanstack/react-query'
import { groupsApi } from '@deqah/api-client'
import type { GroupListQuery } from '@deqah/api-client'
import { QUERY_KEYS } from '@/lib/query-keys'

export function useGroups(query: GroupListQuery = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.groups.list(query as Record<string, unknown>),
    queryFn: () => groupsApi.list(query),
  })
}

export function useGroup(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.groups.detail(id),
    queryFn: () => groupsApi.get(id),
    enabled: !!id,
  })
}
```

- [ ] Create `apps/leaderboard/src/routes/_dashboard/group-sessions/index.tsx`:

```tsx
import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import type { GroupListItem, GroupListQuery, GroupStatus } from '@deqah/api-client'
import { useGroups } from '@/hooks/use-groups'
import { PageHeader } from '@/components/shared/page-header'
import { StatsGrid } from '@/components/shared/stats-grid'
import { FilterBar } from '@/components/shared/filter-bar'
import { DataTable } from '@/components/shared/data-table'
import { SkeletonPage } from '@/components/shared/skeleton-page'

export const Route = createFileRoute('/_dashboard/group-sessions/')({
  component: GroupSessionsPage,
})

const STATUS_LABELS: Record<GroupStatus, string> = {
  active: 'نشط',
  completed: 'مكتمل',
  cancelled: 'ملغي',
}

function GroupSessionsPage() {
  const [query, setQuery] = useState<GroupListQuery>({ page: 1, perPage: 20 })
  const listQuery = useGroups(query)

  if (listQuery.isLoading) return <SkeletonPage />

  const groups = listQuery.data?.items ?? []
  const meta = listQuery.data?.meta

  const activeCount = groups.filter((g) => g.status === 'active').length
  const completedCount = groups.filter((g) => g.status === 'completed').length
  const cancelledCount = groups.filter((g) => g.status === 'cancelled').length
  const fullCount = groups.filter((g) => g.enrolledCount >= g.maxCapacity).length

  const statCards = [
    { label: 'إجمالي الجلسات', value: meta?.total ?? 0, icon: 'hgi-user-group', variant: 'primary' as const },
    { label: 'نشطة', value: activeCount, icon: 'hgi-activity-02', variant: 'success' as const },
    { label: 'مكتملة', value: completedCount, icon: 'hgi-checkmark-circle-02', variant: 'accent' as const },
    { label: 'ممتلئة', value: fullCount, icon: 'hgi-alert-circle', variant: 'warning' as const },
  ]

  const columns = [
    {
      key: 'name',
      header: 'اسم الجلسة',
      render: (g: GroupListItem) => (
        <span className="font-medium text-[var(--fg)]">{g.nameAr}</span>
      ),
    },
    {
      key: 'service',
      header: 'الخدمة',
      render: (g: GroupListItem) => (
        <span className="text-sm text-[var(--fg-2)]">{g.service.nameAr}</span>
      ),
    },
    {
      key: 'employee',
      header: 'الممارس',
      render: (g: GroupListItem) => (
        <span className="text-sm text-[var(--fg-2)]">
          {g.employee.user.firstName} {g.employee.user.lastName}
        </span>
      ),
    },
    {
      key: 'capacity',
      header: 'الطاقة',
      render: (g: GroupListItem) => (
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--fg-2)]">{g.enrolledCount} / {g.maxCapacity}</span>
          <div className="w-16 h-1.5 rounded-full bg-[var(--surface)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--primary)] transition-all"
              style={{ width: `${Math.min((g.enrolledCount / g.maxCapacity) * 100, 100)}%` }}
            />
          </div>
        </div>
      ),
    },
    {
      key: 'startDate',
      header: 'تاريخ البدء',
      render: (g: GroupListItem) => (
        <span className="text-sm text-[var(--fg-2)]">
          {new Date(g.startDate).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' })}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'الحالة',
      render: (g: GroupListItem) => {
        if (g.status === 'active') {
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs border bg-[var(--success-bg)] text-[var(--success)] border-[color:var(--success)]/30">
              {STATUS_LABELS[g.status]}
            </span>
          )
        }
        if (g.status === 'cancelled') {
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs border bg-[var(--danger-bg)] text-[var(--danger)] border-[color:var(--danger)]/30">
              {STATUS_LABELS[g.status]}
            </span>
          )
        }
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs border bg-[var(--surface)] text-[var(--muted)] border-[var(--border-soft)]">
            {STATUS_LABELS[g.status]}
          </span>
        )
      },
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="الجلسات الجماعية"
        description="عرض وتتبع جلسات المجموعات النشطة"
      />
      <StatsGrid stats={statCards} loading={listQuery.isLoading} />
      <FilterBar
        search={query.search ?? ''}
        onSearchChange={(s) => setQuery((q) => ({ ...q, search: s || undefined, page: 1 }))}
        onReset={() => setQuery({ page: 1, perPage: 20 })}
        placeholder="ابحث باسم الجلسة..."
      />
      <DataTable
        columns={columns}
        data={groups}
        keyExtractor={(g) => g.id}
        loading={listQuery.isFetching}
        emptyMessage="لا توجد جلسات جماعية"
      />
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-[var(--muted)]">الصفحة {meta.page} من {meta.totalPages}</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setQuery((q) => ({ ...q, page: Math.max(1, (q.page ?? 1) - 1) }))}
              disabled={meta.page <= 1}
              className="glass h-9 px-4 rounded-[var(--radius-sm)] text-sm text-[var(--fg)] disabled:opacity-50"
            >
              السابق
            </button>
            <button
              onClick={() => setQuery((q) => ({ ...q, page: (q.page ?? 1) + 1 }))}
              disabled={meta.page >= meta.totalPages}
              className="glass h-9 px-4 rounded-[var(--radius-sm)] text-sm text-[var(--fg)] disabled:opacity-50"
            >
              التالي
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] Run: `cd /Users/tariq/Documents/my_programs/Deqah/apps/leaderboard && npm run typecheck 2>&1 | tail -5`
  Expected: no errors

- [ ] Commit:
  ```
  feat(leaderboard): add group-sessions read-only list page
  ```

---

## Task 11 — Final typecheck verification

The sidebar already contains all 5 new routes (confirmed in `sidebar-config.ts` lines 36, 59, 60, 68, 83). No sidebar changes needed.

**Verify all routes are registered by TanStack Router file-based routing:**

| Route file | Sidebar path |
|---|---|
| `_dashboard/intake-forms/index.tsx` | `/intake-forms` ✓ |
| `_dashboard/intake-forms/new.tsx` | N/A (linked from list) |
| `_dashboard/intake-forms/$id.tsx` | N/A (linked from list) |
| `_dashboard/notifications/index.tsx` | `/notifications` ✓ |
| `_dashboard/chatbot/index.tsx` | `/chatbot` ✓ |
| `_dashboard/reports/index.tsx` | `/reports` ✓ |
| `_dashboard/group-sessions/index.tsx` | `/group-sessions` ✓ |

### Steps

- [ ] Run full typecheck:
  ```
  cd /Users/tariq/Documents/my_programs/Deqah/apps/leaderboard && npm run typecheck 2>&1
  ```
  Expected: `Found 0 errors.`

- [ ] Run api-client typecheck:
  ```
  cd /Users/tariq/Documents/my_programs/Deqah/packages/api-client && npm run typecheck 2>&1
  ```
  Expected: `Found 0 errors.`

- [ ] Verify no file exceeds 350 lines:
  ```
  wc -l \
    apps/leaderboard/src/routes/_dashboard/intake-forms/index.tsx \
    apps/leaderboard/src/routes/_dashboard/intake-forms/new.tsx \
    apps/leaderboard/src/routes/_dashboard/intake-forms/'$id'.tsx \
    apps/leaderboard/src/routes/_dashboard/notifications/index.tsx \
    apps/leaderboard/src/routes/_dashboard/chatbot/index.tsx \
    apps/leaderboard/src/routes/_dashboard/reports/index.tsx \
    apps/leaderboard/src/routes/_dashboard/group-sessions/index.tsx
  ```
  Expected: all values ≤ 350

- [ ] Commit (if any minor fixes were needed during verification):
  ```
  fix(leaderboard): typecheck fixes for phases 7-8
  ```

---

## Summary

| Task | Domain | Files | Commit |
|---|---|---|---|
| 1 | api-client wiring | 10 new + 3 modified | `feat(api-client): add intake-forms, notifications, reports, chatbot-admin, groups modules` |
| 2 | Intake Forms hooks | 1 new | `feat(leaderboard): add use-intake-forms hooks` |
| 3 | Intake Forms list | 1 new | `feat(leaderboard): add intake-forms list page` |
| 4 | Intake Forms new | 1 new | `feat(leaderboard): add intake-forms new page` |
| 5 | Intake Forms edit | 1 new | `feat(leaderboard): add intake-forms edit page` |
| 6 | Notifications | 2 new | `feat(leaderboard): add notifications hooks and list page` |
| 7 | Chatbot Admin | 2 new | `feat(leaderboard): add chatbot admin page` |
| 8 | Reports | 2 new | `feat(leaderboard): add reports hooks and revenue/booking report page` |
| 9 | Reports verification | — | (merged into Task 8) |
| 10 | Groups | 2 new | `feat(leaderboard): add group-sessions read-only list page` |
| 11 | Final typecheck | — | `fix(leaderboard): typecheck fixes for phases 7-8` |

**Total new files:** 22 (10 api-client + 12 leaderboard)
**Total modified files:** 3 (api-client/index.ts, types/index.ts, query-keys.ts)
