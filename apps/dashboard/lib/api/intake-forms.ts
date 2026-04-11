/**
 * Intake Forms API — CareKit Dashboard
 */

import { api } from "@/lib/api"
import type {
  IntakeFormApi,
  IntakeFormListQuery,
  CreateIntakeFormApiPayload,
  UpdateIntakeFormApiPayload,
  SetFieldsApiPayload,
  IntakeResponseApi,
} from "@/lib/types/intake-form-api"

/* ─── List & Get ─── */

export async function fetchIntakeForms(
  query?: IntakeFormListQuery,
): Promise<IntakeFormApi[]> {
  return api.get<IntakeFormApi[]>("/intake-forms", query as Record<string, string | boolean | undefined>)
}

export async function fetchIntakeForm(formId: string): Promise<IntakeFormApi> {
  return api.get<IntakeFormApi>(`/intake-forms/${formId}`)
}

/* ─── Create / Update / Delete ─── */

export async function createIntakeForm(
  payload: CreateIntakeFormApiPayload,
): Promise<IntakeFormApi> {
  return api.post<IntakeFormApi>("/intake-forms", payload)
}

export async function updateIntakeForm(
  formId: string,
  payload: UpdateIntakeFormApiPayload,
): Promise<IntakeFormApi> {
  return api.patch<IntakeFormApi>(`/intake-forms/${formId}`, payload)
}

export async function deleteIntakeForm(formId: string): Promise<void> {
  return api.delete(`/intake-forms/${formId}`)
}

/* ─── Fields ─── */

export async function setIntakeFields(
  formId: string,
  payload: SetFieldsApiPayload,
): Promise<IntakeFormApi["fields"]> {
  return api.put<IntakeFormApi["fields"]>(`/intake-forms/${formId}/fields`, payload)
}

/* ─── Responses ─── */

export async function fetchIntakeResponses(
  bookingId: string,
): Promise<IntakeResponseApi[]> {
  return api.get<IntakeResponseApi[]>(`/intake-forms/responses/${bookingId}`)
}
