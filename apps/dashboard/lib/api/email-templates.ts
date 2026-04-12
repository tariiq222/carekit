/**
 * Email Templates API — CareKit Dashboard
 */

import { api } from "@/lib/api"
import type {
  EmailTemplate,
  UpdateEmailTemplatePayload,
  TemplatePreviewPayload,
  TemplatePreviewResult,
} from "@/lib/types/email-template"

/* ─── List ─── */

export async function fetchEmailTemplates(): Promise<EmailTemplate[]> {
  return api.get<EmailTemplate[]>("/dashboard/comms/email-templates")
}

/* ─── Detail ─── */

export async function fetchEmailTemplate(id: string): Promise<EmailTemplate> {
  return api.get<EmailTemplate>(`/dashboard/comms/email-templates/${id}`)
}

/* ─── Update ─── */

export async function updateEmailTemplate(
  id: string,
  payload: UpdateEmailTemplatePayload,
): Promise<EmailTemplate> {
  return api.patch<EmailTemplate>(
    `/dashboard/comms/email-templates/${id}`,
    payload,
  )
}
