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
  return api.get<EmailTemplate[]>("/email-templates")
}

/* ─── Detail ─── */

export async function fetchEmailTemplate(slug: string): Promise<EmailTemplate> {
  return api.get<EmailTemplate>(`/email-templates/${slug}`)
}

/* ─── Update ─── */

export async function updateEmailTemplate(
  id: string,
  payload: UpdateEmailTemplatePayload,
): Promise<EmailTemplate> {
  return api.patch<EmailTemplate>(
    `/email-templates/${id}`,
    payload,
  )
}

/* ─── Preview ─── */

export async function previewEmailTemplate(
  slug: string,
  payload: TemplatePreviewPayload,
): Promise<TemplatePreviewResult> {
  return api.post<TemplatePreviewResult>(
    `/email-templates/${slug}/preview`,
    payload,
  )
}
