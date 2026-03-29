/**
 * Services API — CareKit Dashboard
 */

import { api, getAccessToken } from "@/lib/api"

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
  downloadFile("/services/export?format=csv", "services.csv")
}

export function exportServicesExcel() {
  downloadFile("/services/export?format=xlsx", "services.xlsx")
}
import type { PaginatedResponse } from "@/lib/types/common"
import type {
  Service,
  ServiceCategory,
  ServiceBookingType,
  ServiceDurationOption,
  ServiceListQuery,
  IntakeForm,
  IntakeResponse,
  CreateCategoryPayload,
  UpdateCategoryPayload,
  CreateServicePayload,
  UpdateServicePayload,
  SetDurationOptionsPayload,
  SetServiceBookingTypesPayload,
  CreateIntakeFormPayload,
  UpdateIntakeFormPayload,
  SetFieldsPayload,
  ServicePractitioner,
} from "@/lib/types/service"

/* ─── Categories ─── */

export async function fetchCategories(): Promise<ServiceCategory[]> {
  return api.get<ServiceCategory[]>("/services/categories")
}

export async function createCategory(
  payload: CreateCategoryPayload,
): Promise<ServiceCategory> {
  return api.post<ServiceCategory>(
    "/services/categories",
    payload,
  )
}

export async function updateCategory(
  id: string,
  payload: UpdateCategoryPayload,
): Promise<ServiceCategory> {
  return api.patch<ServiceCategory>(
    `/services/categories/${id}`,
    payload,
  )
}

export async function deleteCategory(id: string): Promise<void> {
  await api.delete(`/services/categories/${id}`)
}

/* ─── Services ─── */

export async function fetchServices(
  query: ServiceListQuery = {},
): Promise<PaginatedResponse<Service>> {
  return api.get<PaginatedResponse<Service>>("/services", {
    page: query.page,
    perPage: query.perPage,
    categoryId: query.categoryId,
    isActive: query.isActive,
    includeHidden: query.includeHidden,
    search: query.search,
  })
}

export async function fetchService(id: string): Promise<Service> {
  return api.get<Service>(`/services/${id}`)
}

export async function createService(
  payload: CreateServicePayload,
): Promise<Service> {
  return api.post<Service>("/services", payload)
}

export async function updateService(
  id: string,
  payload: UpdateServicePayload,
): Promise<Service> {
  return api.patch<Service>(`/services/${id}`, payload)
}

export async function deleteService(id: string): Promise<void> {
  await api.delete(`/services/${id}`)
}

/* ─── Duration Options ─── */

export async function fetchDurationOptions(
  serviceId: string,
): Promise<ServiceDurationOption[]> {
  return api.get<ServiceDurationOption[]>(
    `/services/${serviceId}/duration-options`,
  )
}

export async function setDurationOptions(
  serviceId: string,
  payload: SetDurationOptionsPayload,
): Promise<ServiceDurationOption[]> {
  return api.put<ServiceDurationOption[]>(
    `/services/${serviceId}/duration-options`,
    payload,
  )
}

/* ─── Booking Types ─── */

export async function fetchServiceBookingTypes(
  serviceId: string,
): Promise<ServiceBookingType[]> {
  return api.get<ServiceBookingType[]>(
    `/services/${serviceId}/booking-types`,
  )
}

export async function setServiceBookingTypes(
  serviceId: string,
  payload: SetServiceBookingTypesPayload,
): Promise<ServiceBookingType[]> {
  return api.put<ServiceBookingType[]>(
    `/services/${serviceId}/booking-types`,
    payload,
  )
}

/* ─── Intake Forms ─── */

export async function fetchIntakeForms(
  serviceId: string,
): Promise<IntakeForm[]> {
  return api.get<IntakeForm[]>(
    `/services/${serviceId}/intake-forms/all`,
  )
}

export async function createIntakeForm(
  serviceId: string,
  payload: CreateIntakeFormPayload,
): Promise<IntakeForm> {
  return api.post<IntakeForm>(
    `/services/${serviceId}/intake-forms`,
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
  const res = await fetch(`${API_BASE}/services/${serviceId}/avatar`, {
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

/* ─── Service Practitioners ─── */

export async function fetchServicePractitioners(
  serviceId: string,
): Promise<ServicePractitioner[]> {
  return api.get<ServicePractitioner[]>(`/services/${serviceId}/practitioners`)
}
