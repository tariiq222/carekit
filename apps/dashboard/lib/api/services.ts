/**
 * Services API — CareKit Dashboard
 */

import { api, getAccessToken } from "@/lib/api"
import type { PaginatedResponse } from "@/lib/types/common"
import type {
  Service,
  ServiceCategory,
  ServiceBookingType,
  ServiceDurationOption,
  ServiceListQuery,
  IntakeForm,
  IntakeResponse,
  ServiceEmployee,
  SetServiceBranchesPayload,
} from "@/lib/types/service"
import type {
  CreateCategoryPayload,
  UpdateCategoryPayload,
  CreateServicePayload,
  UpdateServicePayload,
  SetDurationOptionsPayload,
  SetServiceBookingTypesPayload,
  CreateIntakeFormPayload,
  UpdateIntakeFormPayload,
  SetFieldsPayload,
} from "@/lib/types/service-payloads"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5100/api/v1"

function downloadFile(url: string, filename: string) {
  const token = getAccessToken()
  const a = document.createElement("a")
  fetch(`${API_BASE}${url}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: "include",
  })
    .then((res) => res.blob())
    .then((blob) => {
      a.href = URL.createObjectURL(blob)
      a.download = filename
      a.click()
      URL.revokeObjectURL(a.href)
    })
}

export function exportServicesCsv() {
  downloadFile("/dashboard/organization/services/export?format=csv", "services.csv")
}

export function exportServicesExcel() {
  downloadFile("/dashboard/organization/services/export?format=xlsx", "services.xlsx")
}

/* ─── Categories ─── */

export async function fetchCategories(): Promise<ServiceCategory[]> {
  return api.get<ServiceCategory[]>("/dashboard/organization/categories")
}

export async function createCategory(
  payload: CreateCategoryPayload,
): Promise<ServiceCategory> {
  return api.post<ServiceCategory>(
    "/dashboard/organization/categories",
    payload,
  )
}

export async function updateCategory(
  id: string,
  payload: UpdateCategoryPayload,
): Promise<ServiceCategory> {
  return api.patch<ServiceCategory>(
    `/dashboard/organization/services/categories/${id}`,
    payload,
  )
}

export async function deleteCategory(id: string): Promise<void> {
  await api.delete(`/dashboard/organization/categories/${id}`)
}

/* ─── Services ─── */

export async function fetchServices(
  query: ServiceListQuery = {},
): Promise<PaginatedResponse<Service>> {
  return api.get<PaginatedResponse<Service>>("/dashboard/organization/services", {
    page: query.page,
    perPage: query.perPage,
    categoryId: query.categoryId,
    isActive: query.isActive,
    includeHidden: query.includeHidden,
    search: query.search,
    branchId: query.branchId,
  })
}

export async function fetchService(id: string): Promise<Service> {
  return api.get<Service>(`/dashboard/organization/services/${id}`)
}

export async function createService(
  payload: CreateServicePayload,
): Promise<Service> {
  return api.post<Service>("/dashboard/organization/services", payload)
}

export async function updateService(
  id: string,
  payload: UpdateServicePayload,
): Promise<Service> {
  return api.patch<Service>(`/dashboard/organization/services/${id}`, payload)
}

export async function deleteService(id: string): Promise<void> {
  await api.delete(`/dashboard/organization/services/${id}`)
}

/* ─── Duration Options ─── */

export async function fetchDurationOptions(
  serviceId: string,
): Promise<ServiceDurationOption[]> {
  return api.get<ServiceDurationOption[]>(
    `/dashboard/organization/services/${serviceId}/duration-options`,
  )
}

export async function setDurationOptions(
  serviceId: string,
  payload: SetDurationOptionsPayload,
): Promise<ServiceDurationOption[]> {
  return api.put<ServiceDurationOption[]>(
    `/dashboard/organization/services/${serviceId}/duration-options`,
    payload,
  )
}

/* ─── Booking Types ─── */

export async function fetchServiceBookingTypes(
  serviceId: string,
): Promise<ServiceBookingType[]> {
  return api.get<ServiceBookingType[]>(
    `/dashboard/organization/services/${serviceId}/booking-types`,
  )
}

export async function setServiceBookingTypes(
  serviceId: string,
  payload: SetServiceBookingTypesPayload,
): Promise<ServiceBookingType[]> {
  return api.put<ServiceBookingType[]>(
    `/dashboard/organization/services/${serviceId}/booking-types`,
    payload,
  )
}

/* ─── Intake Forms ─── */

export async function fetchIntakeForms(
  serviceId: string,
): Promise<IntakeForm[]> {
  return api.get<IntakeForm[]>(
    `/dashboard/organization/services/${serviceId}/intake-forms/all`,
  )
}

export async function createIntakeForm(
  serviceId: string,
  payload: CreateIntakeFormPayload,
): Promise<IntakeForm> {
  return api.post<IntakeForm>(
    `/dashboard/organization/services/${serviceId}/intake-forms`,
    payload,
  )
}

export async function updateIntakeForm(
  formId: string,
  payload: UpdateIntakeFormPayload,
): Promise<IntakeForm> {
  return api.patch<IntakeForm>(
    `/intake-forms/${formId}`,
    payload,
  )
}

export async function deleteIntakeForm(formId: string): Promise<void> {
  await api.delete(`/intake-forms/${formId}`)
}

export async function setIntakeFields(
  formId: string,
  payload: SetFieldsPayload,
): Promise<unknown> {
  return api.put<unknown>(
    `/intake-forms/${formId}/fields`,
    payload,
  )
}

export async function fetchIntakeResponses(
  bookingId: string,
): Promise<IntakeResponse[]> {
  return api.get<IntakeResponse[]>(
    `/intake-forms/responses/${bookingId}`,
  )
}

/* ─── Service Avatar ─── */

export async function uploadServiceImage(serviceId: string, file: File): Promise<Service> {
  const formData = new FormData()
  formData.append("image", file)

  const token = getAccessToken()
  const res = await fetch(`${API_BASE}/dashboard/organization/services/${serviceId}/avatar`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string }
    throw new Error(body?.message ?? res.statusText)
  }

  return res.json() as Promise<Service>
}

/* ─── Service Employees ─── */

export async function fetchServiceEmployees(
  serviceId: string,
): Promise<ServiceEmployee[]> {
  return api.get<ServiceEmployee[]>(`/dashboard/organization/services/${serviceId}/employees`)
}

/* ─── Service List Stats ─── */

export interface ServiceListStats {
  total: number;
  active: number;
  inactive: number;
}

export async function fetchServicesListStats(): Promise<ServiceListStats> {
  return api.get<ServiceListStats>('/dashboard/organization/services/list-stats')
}

/* ─── Service Branches ─── */

export async function setServiceBranches(
  serviceId: string,
  payload: SetServiceBranchesPayload,
): Promise<{ updated: boolean }> {
  return api.put<{ updated: boolean }>(`/dashboard/organization/services/${serviceId}/branches`, payload)
}

export async function clearServiceBranches(
  serviceId: string,
): Promise<{ cleared: boolean }> {
  return api.delete<{ cleared: boolean }>(`/dashboard/organization/services/${serviceId}/branches`)
}
